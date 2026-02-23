import Database from 'better-sqlite3'
import path from 'path'
import { DbDriver, queryHasLimitClause } from './base'
import { DbConnectionConfig, DbEngine, DbTable, DbTableInfo, DbColumn, DbIndex, DbQueryResult } from '../../../../shared/types'

export class SqliteDriver implements DbDriver {
  engine: DbEngine = 'sqlite'
  private db: Database.Database | null = null
  private filePath: string | null = null

  async connect(config: DbConnectionConfig): Promise<void> {
    const dbPath = config.filePath || config.database
    if (!dbPath) {
      throw new Error('SQLite requires a file path')
    }

    this.filePath = dbPath
    this.db = new Database(dbPath, { readonly: false })

    // Enable WAL mode for better concurrent access
    this.db.pragma('journal_mode = WAL')

    // Test the connection
    this.db.prepare('SELECT 1').get()
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }

  isConnected(): boolean {
    return this.db !== null && this.db.open
  }

  async listDatabases(): Promise<string[]> {
    if (!this.filePath) return []
    return [path.basename(this.filePath)]
  }

  async listSchemas(): Promise<string[]> {
    return ['main']
  }

  async listTables(_schema?: string): Promise<DbTable[]> {
    if (!this.db) throw new Error('Not connected')

    const rows = this.db
      .prepare(
        `SELECT name, type FROM sqlite_master
         WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
         ORDER BY name`,
      )
      .all() as { name: string; type: string }[]

    const tables: DbTable[] = []
    for (const row of rows) {
      let rowCount: number | undefined
      if (row.type === 'table') {
        try {
          const countResult = this.db
            .prepare(`SELECT COUNT(*) AS count FROM "${row.name}"`)
            .get() as { count: number } | undefined
          rowCount = countResult?.count
        } catch {
          // Ignore count errors
        }
      }

      tables.push({
        name: row.name,
        schema: 'main',
        type: row.type === 'view' ? 'view' : 'table',
        rowCount,
      })
    }

    return tables
  }

  async getTableInfo(table: string, _schema?: string): Promise<DbTableInfo> {
    if (!this.db) throw new Error('Not connected')

    // Get columns via PRAGMA
    const colRows = this.db.prepare(`PRAGMA table_info("${table}")`).all() as {
      cid: number
      name: string
      type: string
      notnull: number
      dflt_value: string | null
      pk: number
    }[]

    // Get foreign keys
    const fkRows = this.db.prepare(`PRAGMA foreign_key_list("${table}")`).all() as {
      from: string
    }[]
    const fkColumns = new Set(fkRows.map((fk) => fk.from))

    const columns: DbColumn[] = colRows.map((r) => ({
      name: r.name,
      type: r.type || 'any',
      nullable: r.notnull === 0,
      isPrimaryKey: r.pk > 0,
      isForeignKey: fkColumns.has(r.name),
      defaultValue: r.dflt_value ?? undefined,
    }))

    // Get indexes
    const idxRows = this.db.prepare(`PRAGMA index_list("${table}")`).all() as {
      name: string
      unique: number
      origin: string
    }[]

    const indexes: DbIndex[] = idxRows.map((idx) => {
      const idxInfoRows = this.db!.prepare(`PRAGMA index_info("${idx.name}")`).all() as {
        name: string
      }[]
      return {
        name: idx.name,
        columns: idxInfoRows.map((r) => r.name),
        unique: idx.unique === 1,
        type: idx.origin === 'pk' ? 'primary' : 'btree',
      }
    })

    // Get row count
    let rowCount = 0
    try {
      const countResult = this.db
        .prepare(`SELECT COUNT(*) AS count FROM "${table}"`)
        .get() as { count: number } | undefined
      rowCount = countResult?.count ?? 0
    } catch {
      // Ignore
    }

    return { columns, indexes, rowCount }
  }

  async executeQuery(sqlQuery: string, limit?: number, offset?: number): Promise<DbQueryResult> {
    if (!this.db) throw new Error('Not connected')

    const startTime = Date.now()

    try {
      let wrappedSql = sqlQuery.trim()
      const isSelect = wrappedSql.toUpperCase().startsWith('SELECT')

      if (isSelect && limit !== undefined && !queryHasLimitClause(wrappedSql)) {
        wrappedSql = wrappedSql.replace(/;\s*$/, '')
        wrappedSql = `${wrappedSql} LIMIT ${limit}`
        if (offset !== undefined && offset > 0) {
          wrappedSql = `${wrappedSql} OFFSET ${offset}`
        }
      }

      if (isSelect || wrappedSql.toUpperCase().startsWith('PRAGMA') || wrappedSql.toUpperCase().startsWith('WITH')) {
        const rows = this.db.prepare(wrappedSql).all() as Record<string, unknown>[]
        const executionTime = Date.now() - startTime

        const columns = rows.length > 0 ? Object.keys(rows[0]!) : []

        // Get total count for SELECT queries
        let totalRows: number | undefined
        if (isSelect && limit !== undefined) {
          try {
            const cleanSql = sqlQuery.trim().replace(/;\s*$/, '')
            const countResult = this.db
              .prepare(`SELECT COUNT(*) AS total FROM (${cleanSql})`)
              .get() as { total: number } | undefined
            totalRows = countResult?.total
          } catch {
            // Total count is optional
          }
        }

        return {
          columns,
          rows,
          rowCount: rows.length,
          totalRows,
          executionTime,
        }
      } else {
        // Non-SELECT statement (INSERT, UPDATE, DELETE, CREATE, etc.)
        const result = this.db.prepare(wrappedSql).run()
        const executionTime = Date.now() - startTime

        return {
          columns: ['changes', 'lastInsertRowid'],
          rows: [{ changes: result.changes, lastInsertRowid: Number(result.lastInsertRowid) }],
          rowCount: result.changes,
          executionTime,
        }
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
    // better-sqlite3 is synchronous, so queries cannot be cancelled mid-execution.
    // The query will complete before any other code runs.
  }

  getDefaultPort(): number {
    return 0
  }

  parseConnectionString(uri: string): Partial<DbConnectionConfig> {
    // SQLite "connection string" is just the file path
    // Handle sqlite:// prefix, file:// prefix, or raw path
    let filePath = uri

    if (filePath.startsWith('sqlite://')) {
      filePath = filePath.slice('sqlite://'.length)
    } else if (filePath.startsWith('file://')) {
      filePath = filePath.slice('file://'.length)
    }

    // Handle query parameters (e.g., ?mode=ro)
    const queryIndex = filePath.indexOf('?')
    if (queryIndex > -1) {
      filePath = filePath.slice(0, queryIndex)
    }

    return {
      engine: 'sqlite',
      filePath,
      database: path.basename(filePath),
    }
  }
}
