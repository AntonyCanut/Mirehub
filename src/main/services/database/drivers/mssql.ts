import sql from 'mssql'
import { DbDriver, queryHasLimitClause } from './base'
import { DbConnectionConfig, DbEngine, DbTable, DbTableInfo, DbColumn, DbIndex, DbQueryResult } from '../../../../shared/types'

export class MssqlDriver implements DbDriver {
  engine: DbEngine = 'mssql'
  private pool: sql.ConnectionPool | null = null
  private activeRequest: sql.Request | null = null

  async connect(config: DbConnectionConfig): Promise<void> {
    if (config.connectionString) {
      this.pool = new sql.ConnectionPool(config.connectionString)
    } else {
      this.pool = new sql.ConnectionPool({
        server: config.host || 'localhost',
        port: config.port || 1433,
        user: config.username,
        password: config.password,
        database: config.database,
        options: {
          encrypt: config.ssl ?? false,
          trustServerCertificate: true,
          connectTimeout: 10000,
          requestTimeout: 30000,
        },
      })
    }

    await this.pool.connect()
    // Test the connection
    await this.pool.request().query('SELECT 1 AS test')
  }

  async disconnect(): Promise<void> {
    if (this.activeRequest) {
      this.activeRequest.cancel()
      this.activeRequest = null
    }
    if (this.pool) {
      await this.pool.close()
      this.pool = null
    }
  }

  isConnected(): boolean {
    return this.pool !== null && this.pool.connected
  }

  async listDatabases(): Promise<string[]> {
    if (!this.pool) throw new Error('Not connected')
    const result = await this.pool
      .request()
      .query('SELECT name FROM sys.databases WHERE state_desc = \'ONLINE\' ORDER BY name')
    return result.recordset.map((r: { name: string }) => r.name)
  }

  async listSchemas(): Promise<string[]> {
    if (!this.pool) throw new Error('Not connected')
    const result = await this.pool.request().query(
      `SELECT DISTINCT TABLE_SCHEMA
       FROM INFORMATION_SCHEMA.TABLES
       ORDER BY TABLE_SCHEMA`,
    )
    return result.recordset.map((r: { TABLE_SCHEMA: string }) => r.TABLE_SCHEMA)
  }

  async listTables(schema?: string): Promise<DbTable[]> {
    if (!this.pool) throw new Error('Not connected')
    const targetSchema = schema || 'dbo'

    const result = await this.pool.request().input('schema', sql.NVarChar, targetSchema).query(
      `SELECT TABLE_NAME, TABLE_TYPE
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = @schema
       ORDER BY TABLE_NAME`,
    )

    const tables: DbTable[] = []
    for (const row of result.recordset as { TABLE_NAME: string; TABLE_TYPE: string }[]) {
      let rowCount: number | undefined
      try {
        const countResult = await this.pool
          .request()
          .input('schema', sql.NVarChar, targetSchema)
          .input('table', sql.NVarChar, row.TABLE_NAME)
          .query(
            `SELECT SUM(p.rows) AS count
             FROM sys.partitions p
             JOIN sys.tables t ON p.object_id = t.object_id
             JOIN sys.schemas s ON t.schema_id = s.schema_id
             WHERE s.name = @schema AND t.name = @table AND p.index_id IN (0, 1)`,
          )
        if (countResult.recordset[0]) {
          rowCount = countResult.recordset[0].count ?? undefined
        }
      } catch {
        // Ignore count errors
      }

      tables.push({
        name: row.TABLE_NAME,
        schema: targetSchema,
        type: row.TABLE_TYPE === 'VIEW' ? 'view' : 'table',
        rowCount,
      })
    }

    return tables
  }

  async getTableInfo(table: string, schema?: string): Promise<DbTableInfo> {
    if (!this.pool) throw new Error('Not connected')
    const targetSchema = schema || 'dbo'

    // Get columns
    const colResult = await this.pool
      .request()
      .input('schema', sql.NVarChar, targetSchema)
      .input('table', sql.NVarChar, table)
      .query(
        `SELECT
           c.COLUMN_NAME,
           c.DATA_TYPE,
           c.IS_NULLABLE,
           c.COLUMN_DEFAULT,
           CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS IS_PRIMARY_KEY,
           CASE WHEN fk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS IS_FOREIGN_KEY
         FROM INFORMATION_SCHEMA.COLUMNS c
         LEFT JOIN (
           SELECT kcu.COLUMN_NAME
           FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
           JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
             ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
             AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
           WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
             AND tc.TABLE_SCHEMA = @schema
             AND tc.TABLE_NAME = @table
         ) pk ON pk.COLUMN_NAME = c.COLUMN_NAME
         LEFT JOIN (
           SELECT kcu.COLUMN_NAME
           FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
           JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
             ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
             AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
           WHERE tc.CONSTRAINT_TYPE = 'FOREIGN KEY'
             AND tc.TABLE_SCHEMA = @schema
             AND tc.TABLE_NAME = @table
         ) fk ON fk.COLUMN_NAME = c.COLUMN_NAME
         WHERE c.TABLE_SCHEMA = @schema AND c.TABLE_NAME = @table
         ORDER BY c.ORDINAL_POSITION`,
      )

    const columns: DbColumn[] = colResult.recordset.map(
      (r: {
        COLUMN_NAME: string
        DATA_TYPE: string
        IS_NULLABLE: string
        COLUMN_DEFAULT: string | null
        IS_PRIMARY_KEY: number
        IS_FOREIGN_KEY: number
      }) => ({
        name: r.COLUMN_NAME,
        type: r.DATA_TYPE,
        nullable: r.IS_NULLABLE === 'YES',
        isPrimaryKey: r.IS_PRIMARY_KEY === 1,
        isForeignKey: r.IS_FOREIGN_KEY === 1,
        defaultValue: r.COLUMN_DEFAULT ?? undefined,
      }),
    )

    // Get indexes
    const idxResult = await this.pool
      .request()
      .input('schema', sql.NVarChar, targetSchema)
      .input('table', sql.NVarChar, table)
      .query(
        `SELECT
           i.name AS index_name,
           COL_NAME(ic.object_id, ic.column_id) AS column_name,
           i.is_unique,
           i.type_desc
         FROM sys.indexes i
         JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
         JOIN sys.tables t ON i.object_id = t.object_id
         JOIN sys.schemas s ON t.schema_id = s.schema_id
         WHERE s.name = @schema AND t.name = @table AND i.name IS NOT NULL
         ORDER BY i.name, ic.key_ordinal`,
      )

    const indexMap = new Map<string, DbIndex>()
    for (const row of idxResult.recordset as {
      index_name: string
      column_name: string
      is_unique: boolean
      type_desc: string
    }[]) {
      const existing = indexMap.get(row.index_name)
      if (existing) {
        existing.columns.push(row.column_name)
      } else {
        indexMap.set(row.index_name, {
          name: row.index_name,
          columns: [row.column_name],
          unique: row.is_unique,
          type: row.type_desc,
        })
      }
    }
    const indexes = Array.from(indexMap.values())

    // Get row count
    let rowCount = 0
    try {
      const countResult = await this.pool
        .request()
        .input('schema', sql.NVarChar, targetSchema)
        .input('table', sql.NVarChar, table)
        .query(
          `SELECT SUM(p.rows) AS count
           FROM sys.partitions p
           JOIN sys.tables t ON p.object_id = t.object_id
           JOIN sys.schemas s ON t.schema_id = s.schema_id
           WHERE s.name = @schema AND t.name = @table AND p.index_id IN (0, 1)`,
        )
      rowCount = countResult.recordset[0]?.count ?? 0
    } catch {
      // Ignore
    }

    return { columns, indexes, rowCount }
  }

  async executeQuery(sql_query: string, limit?: number, offset?: number): Promise<DbQueryResult> {
    if (!this.pool) throw new Error('Not connected')

    const startTime = Date.now()

    try {
      let wrappedSql = sql_query.trim()
      const isSelect = wrappedSql.toUpperCase().startsWith('SELECT')

      if (isSelect && limit !== undefined && !queryHasLimitClause(wrappedSql)) {
        wrappedSql = wrappedSql.replace(/;\s*$/, '')

        // MSSQL uses OFFSET FETCH syntax (requires ORDER BY)
        const hasOrderBy = /ORDER\s+BY/i.test(wrappedSql)
        if (!hasOrderBy) {
          wrappedSql = `${wrappedSql} ORDER BY (SELECT NULL)`
        }
        wrappedSql = `${wrappedSql} OFFSET ${offset || 0} ROWS FETCH NEXT ${limit} ROWS ONLY`
      }

      this.activeRequest = this.pool.request()
      const result = await this.activeRequest.query(wrappedSql)
      this.activeRequest = null
      const executionTime = Date.now() - startTime

      // Get total count for SELECT queries
      let totalRows: number | undefined
      if (isSelect && limit !== undefined) {
        try {
          const cleanSql = sql_query.trim().replace(/;\s*$/, '')
          const countResult = await this.pool
            .request()
            .query(`SELECT COUNT(*) AS total FROM (${cleanSql}) AS _count_query`)
          totalRows = countResult.recordset[0]?.total ?? undefined
        } catch {
          // Total count is optional
        }
      }

      const columns = result.recordset.columns
        ? Object.keys(result.recordset.columns)
        : result.recordset.length > 0
          ? Object.keys(result.recordset[0]!)
          : []

      return {
        columns,
        rows: result.recordset as Record<string, unknown>[],
        rowCount: result.rowsAffected[0] ?? result.recordset.length,
        totalRows,
        executionTime,
      }
    } catch (err) {
      this.activeRequest = null
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
    if (this.activeRequest) {
      this.activeRequest.cancel()
      this.activeRequest = null
    }
  }

  getDefaultPort(): number {
    return 1433
  }

  parseConnectionString(uri: string): Partial<DbConnectionConfig> {
    try {
      // Handle mssql:// URI format
      const url = new URL(uri)
      return {
        engine: 'mssql',
        host: url.hostname || 'localhost',
        port: url.port ? parseInt(url.port, 10) : 1433,
        username: url.username || undefined,
        password: url.password ? decodeURIComponent(url.password) : undefined,
        database: url.pathname.slice(1) || undefined,
        ssl: url.searchParams.get('encrypt') === 'true',
      }
    } catch {
      // Try parsing as Server=...;Database=...;User Id=...;Password=... format
      try {
        const parts = uri.split(';').reduce(
          (acc, part) => {
            const [key, ...values] = part.split('=')
            if (key && values.length > 0) {
              acc[key.trim().toLowerCase()] = values.join('=').trim()
            }
            return acc
          },
          {} as Record<string, string>,
        )
        return {
          engine: 'mssql',
          host: parts['server'] || parts['data source'] || undefined,
          database: parts['database'] || parts['initial catalog'] || undefined,
          username: parts['user id'] || parts['uid'] || undefined,
          password: parts['password'] || parts['pwd'] || undefined,
        }
      } catch {
        return { engine: 'mssql' }
      }
    }
  }
}
