import mysql, { Pool, PoolConnection } from 'mysql2/promise'
import { DbDriver, queryHasLimitClause } from './base'
import { DbConnectionConfig, DbEngine, DbTable, DbTableInfo, DbColumn, DbIndex, DbQueryResult } from '../../../../shared/types'

export class MysqlDriver implements DbDriver {
  engine: DbEngine = 'mysql'
  private pool: Pool | null = null
  private activeConnection: PoolConnection | null = null
  private currentDatabase: string | undefined

  async connect(config: DbConnectionConfig): Promise<void> {
    if (config.connectionString) {
      const parsed = this.parseConnectionString(config.connectionString)
      this.currentDatabase = parsed.database
      this.pool = mysql.createPool({
        uri: config.connectionString,
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0,
        connectTimeout: 10000,
      })
    } else {
      this.currentDatabase = config.database
      this.pool = mysql.createPool({
        host: config.host || 'localhost',
        port: config.port || 3306,
        user: config.username,
        password: config.password,
        database: config.database,
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0,
        connectTimeout: 10000,
        ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
      })
    }

    // Test the connection
    const conn = await this.pool.getConnection()
    try {
      await conn.query('SELECT 1')
    } finally {
      conn.release()
    }
  }

  async disconnect(): Promise<void> {
    if (this.activeConnection) {
      this.activeConnection.release()
      this.activeConnection = null
    }
    if (this.pool) {
      await this.pool.end()
      this.pool = null
    }
  }

  isConnected(): boolean {
    return this.pool !== null
  }

  async listDatabases(): Promise<string[]> {
    if (!this.pool) throw new Error('Not connected')
    const [rows] = await this.pool.query('SHOW DATABASES')
    return (rows as { Database: string }[]).map((r) => r.Database)
  }

  async listSchemas(): Promise<string[]> {
    // MySQL uses databases as schemas
    return this.listDatabases()
  }

  async listTables(schema?: string): Promise<DbTable[]> {
    if (!this.pool) throw new Error('Not connected')
    const db = schema || this.currentDatabase
    if (!db) throw new Error('No database selected')

    const [rows] = await this.pool.query(`SHOW FULL TABLES FROM \`${db}\``)
    const tables: DbTable[] = []

    for (const row of rows as Record<string, string>[]) {
      const tableName = row[`Tables_in_${db}`]
      const tableType = row['Table_type']
      if (!tableName) continue

      // Get row count estimate
      let rowCount: number | undefined
      try {
        const [countRows] = await this.pool.query(
          `SELECT TABLE_ROWS AS count FROM information_schema.TABLES
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
          [db, tableName],
        )
        const countRow = (countRows as { count: number }[])[0]
        if (countRow) {
          rowCount = countRow.count
        }
      } catch {
        // Ignore count errors
      }

      tables.push({
        name: tableName,
        schema: db,
        type: tableType === 'VIEW' ? 'view' : 'table',
        rowCount,
      })
    }

    return tables
  }

  async getTableInfo(table: string, schema?: string): Promise<DbTableInfo> {
    if (!this.pool) throw new Error('Not connected')
    const db = schema || this.currentDatabase
    if (!db) throw new Error('No database selected')

    // Get columns using DESCRIBE
    const [colRows] = await this.pool.query(`DESCRIBE \`${db}\`.\`${table}\``)
    const columns: DbColumn[] = (
      colRows as {
        Field: string
        Type: string
        Null: string
        Key: string
        Default: string | null
        Extra: string
      }[]
    ).map((r) => ({
      name: r.Field,
      type: r.Type,
      nullable: r.Null === 'YES',
      isPrimaryKey: r.Key === 'PRI',
      isForeignKey: r.Key === 'MUL',
      defaultValue: r.Default ?? undefined,
    }))

    // Get indexes
    const [idxRows] = await this.pool.query(`SHOW INDEX FROM \`${db}\`.\`${table}\``)
    const indexMap = new Map<string, DbIndex>()
    for (const row of idxRows as {
      Key_name: string
      Column_name: string
      Non_unique: number
      Index_type: string
    }[]) {
      const existing = indexMap.get(row.Key_name)
      if (existing) {
        existing.columns.push(row.Column_name)
      } else {
        indexMap.set(row.Key_name, {
          name: row.Key_name,
          columns: [row.Column_name],
          unique: row.Non_unique === 0,
          type: row.Index_type,
        })
      }
    }
    const indexes = Array.from(indexMap.values())

    // Get row count
    let rowCount = 0
    try {
      const [countRows] = await this.pool.query(
        `SELECT COUNT(*) AS count FROM \`${db}\`.\`${table}\``,
      )
      const countRow = (countRows as { count: number }[])[0]
      if (countRow) {
        rowCount = countRow.count
      }
    } catch {
      // Ignore
    }

    return { columns, indexes, rowCount }
  }

  async executeQuery(sql: string, limit?: number, offset?: number): Promise<DbQueryResult> {
    if (!this.pool) throw new Error('Not connected')

    const startTime = Date.now()

    try {
      let wrappedSql = sql.trim()
      const isSelect = wrappedSql.toUpperCase().startsWith('SELECT')

      if (isSelect && limit !== undefined && !queryHasLimitClause(wrappedSql)) {
        wrappedSql = wrappedSql.replace(/;\s*$/, '')
        wrappedSql = `${wrappedSql} LIMIT ${limit}`
        if (offset !== undefined && offset > 0) {
          wrappedSql = `${wrappedSql} OFFSET ${offset}`
        }
      }

      this.activeConnection = await this.pool.getConnection()
      try {
        const [rows, fields] = await this.activeConnection.query(wrappedSql)
        const executionTime = Date.now() - startTime

        // For SELECT queries, try to get total count
        let totalRows: number | undefined
        if (isSelect && limit !== undefined) {
          try {
            const cleanSql = sql.trim().replace(/;\s*$/, '')
            const [countRows] = await this.activeConnection.query(
              `SELECT COUNT(*) AS total FROM (${cleanSql}) AS _count_query`,
            )
            const countRow = (countRows as { total: number }[])[0]
            if (countRow) {
              totalRows = countRow.total
            }
          } catch {
            // Total count is optional
          }
        }

        const resultRows = Array.isArray(rows) ? (rows as Record<string, unknown>[]) : []
        const columns = Array.isArray(fields)
          ? fields.map((f: { name: string }) => f.name)
          : []

        return {
          columns,
          rows: resultRows,
          rowCount: resultRows.length,
          totalRows,
          executionTime,
        }
      } finally {
        this.activeConnection.release()
        this.activeConnection = null
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
    if (this.activeConnection) {
      this.activeConnection.release()
      this.activeConnection = null
    }
  }

  getDefaultPort(): number {
    return 3306
  }

  parseConnectionString(uri: string): Partial<DbConnectionConfig> {
    try {
      const url = new URL(uri)
      return {
        engine: 'mysql',
        host: url.hostname || 'localhost',
        port: url.port ? parseInt(url.port, 10) : 3306,
        username: url.username || undefined,
        password: url.password ? decodeURIComponent(url.password) : undefined,
        database: url.pathname.slice(1) || undefined,
        ssl: url.searchParams.get('ssl') === 'true',
      }
    } catch {
      return { engine: 'mysql' }
    }
  }
}
