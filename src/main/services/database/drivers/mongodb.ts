import { MongoClient, Db, Document } from 'mongodb'
import { DbDriver } from './base'
import { DbConnectionConfig, DbEngine, DbTable, DbTableInfo, DbColumn, DbIndex, DbQueryResult } from '../../../../shared/types'

export class MongodbDriver implements DbDriver {
  engine: DbEngine = 'mongodb'
  private client: MongoClient | null = null
  private db: Db | null = null

  async connect(config: DbConnectionConfig): Promise<void> {
    const uri =
      config.connectionString ||
      `mongodb://${config.username ? `${encodeURIComponent(config.username)}:${encodeURIComponent(config.password || '')}@` : ''}${config.host || 'localhost'}:${config.port || 27017}/${config.database || ''}`

    this.client = new MongoClient(uri, {
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000,
    })

    await this.client.connect()

    // Use the specified database or default from URI
    if (config.database) {
      this.db = this.client.db(config.database)
    } else {
      this.db = this.client.db()
    }

    // Test the connection
    await this.db.command({ ping: 1 })
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close()
      this.client = null
      this.db = null
    }
  }

  isConnected(): boolean {
    return this.client !== null
  }

  async listDatabases(): Promise<string[]> {
    if (!this.client) throw new Error('Not connected')
    const admin = this.client.db().admin()
    const result = await admin.listDatabases()
    return result.databases.map((d) => d.name)
  }

  async listSchemas(): Promise<string[]> {
    // MongoDB does not have schemas
    return []
  }

  async listTables(_schema?: string): Promise<DbTable[]> {
    if (!this.db) throw new Error('Not connected')

    const collections = await this.db.listCollections().toArray()
    const tables: DbTable[] = []

    for (const col of collections) {
      let rowCount: number | undefined
      try {
        rowCount = await this.db.collection(col.name).estimatedDocumentCount()
      } catch {
        // Ignore count errors
      }

      tables.push({
        name: col.name,
        type: 'collection',
        rowCount,
      })
    }

    return tables.sort((a, b) => a.name.localeCompare(b.name))
  }

  async getTableInfo(table: string, _schema?: string): Promise<DbTableInfo> {
    if (!this.db) throw new Error('Not connected')

    const collection = this.db.collection(table)

    // Sample documents to infer schema
    const sampleDocs = await collection.find().limit(100).toArray()

    // Build column info from sampled documents
    const fieldMap = new Map<string, { types: Set<string>; count: number }>()

    for (const doc of sampleDocs) {
      for (const [key, value] of Object.entries(doc)) {
        const existing = fieldMap.get(key)
        const valueType = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value
        if (existing) {
          existing.types.add(valueType)
          existing.count++
        } else {
          fieldMap.set(key, { types: new Set([valueType]), count: 1 })
        }
      }
    }

    const columns: DbColumn[] = Array.from(fieldMap.entries()).map(([name, info]) => ({
      name,
      type: Array.from(info.types).join(' | '),
      nullable: info.count < sampleDocs.length,
      isPrimaryKey: name === '_id',
      isForeignKey: false,
      defaultValue: undefined,
    }))

    // Get indexes
    const rawIndexes = await collection.indexes()
    const indexes: DbIndex[] = rawIndexes.map((idx) => ({
      name: idx.name || 'unknown',
      columns: Object.keys(idx.key as Record<string, unknown>),
      unique: idx.unique ?? false,
      type: Object.values(idx.key as Record<string, unknown>).includes('text') ? 'text' : 'btree',
    }))

    // Get row count
    let rowCount = 0
    try {
      rowCount = await collection.estimatedDocumentCount()
    } catch {
      // Ignore
    }

    return { columns, indexes, rowCount }
  }

  async executeQuery(queryString: string, limit?: number, offset?: number): Promise<DbQueryResult> {
    if (!this.db) throw new Error('Not connected')

    const startTime = Date.now()

    try {
      // Parse the query string: expected format is either:
      // 1. JSON object for find: { "collection": "name", "filter": {}, "sort": {}, "projection": {} }
      // 2. Aggregate: { "collection": "name", "aggregate": [...pipeline...] }
      // 3. Simple collection name for find all
      // 4. Raw JSON filter to apply to a default collection

      let parsed: Record<string, unknown>

      try {
        parsed = JSON.parse(queryString)
      } catch {
        // If not valid JSON, treat as a collection name for find all
        const collectionName = queryString.trim()
        const collection = this.db.collection(collectionName)
        const effectiveLimit = limit || 100
        const effectiveOffset = offset || 0

        const docs = await collection
          .find()
          .skip(effectiveOffset)
          .limit(effectiveLimit)
          .toArray()

        let totalRows: number | undefined
        try {
          totalRows = await collection.estimatedDocumentCount()
        } catch {
          // Optional
        }

        const executionTime = Date.now() - startTime
        const columns = docs.length > 0 ? Object.keys(docs[0]!) : []

        return {
          columns,
          rows: docs as unknown as Record<string, unknown>[],
          rowCount: docs.length,
          totalRows,
          executionTime,
        }
      }

      const collectionName = parsed.collection as string
      if (!collectionName) {
        throw new Error('Query must specify a "collection" field')
      }

      const collection = this.db.collection(collectionName)

      // Aggregate pipeline
      if (parsed.aggregate && Array.isArray(parsed.aggregate)) {
        const pipeline = parsed.aggregate as Document[]
        if (limit !== undefined) {
          pipeline.push({ $skip: offset || 0 })
          pipeline.push({ $limit: limit })
        }
        const docs = await collection.aggregate(pipeline).toArray()
        const executionTime = Date.now() - startTime
        const columns = docs.length > 0 ? Object.keys(docs[0]!) : []

        return {
          columns,
          rows: docs as unknown as Record<string, unknown>[],
          rowCount: docs.length,
          executionTime,
        }
      }

      // Find query
      const filter = (parsed.filter as Document) || {}
      const sort = (parsed.sort as Document) || {}
      const projection = (parsed.projection as Document) || {}
      const effectiveLimit = limit || (parsed.limit as number) || 100
      const effectiveOffset = offset || (parsed.offset as number) || 0

      const cursor = collection
        .find(filter)
        .sort(sort)
        .project(projection)
        .skip(effectiveOffset)
        .limit(effectiveLimit)

      const docs = await cursor.toArray()
      const executionTime = Date.now() - startTime

      // Get total count for the filter
      let totalRows: number | undefined
      try {
        totalRows = await collection.countDocuments(filter)
      } catch {
        // Optional
      }

      const columns = docs.length > 0 ? Object.keys(docs[0]!) : []

      return {
        columns,
        rows: docs as unknown as Record<string, unknown>[],
        rowCount: docs.length,
        totalRows,
        executionTime,
      }
    } catch (err) {
      const executionTime = Date.now() - startTime
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTime,
        error: String(err),
      }
    }
  }

  cancelQuery(): void {
    // MongoDB Node.js driver does not support direct query cancellation
    // Queries will time out based on connection settings
  }

  getDefaultPort(): number {
    return 27017
  }

  parseConnectionString(uri: string): Partial<DbConnectionConfig> {
    try {
      const url = new URL(uri)
      const database = url.pathname.slice(1).split('?')[0] || undefined

      return {
        engine: 'mongodb',
        connectionString: uri,
        host: url.hostname || 'localhost',
        port: url.port ? parseInt(url.port, 10) : 27017,
        username: url.username || undefined,
        password: url.password ? decodeURIComponent(url.password) : undefined,
        database,
        ssl: url.searchParams.get('tls') === 'true' || url.searchParams.get('ssl') === 'true',
      }
    } catch {
      return { engine: 'mongodb', connectionString: uri }
    }
  }
}
