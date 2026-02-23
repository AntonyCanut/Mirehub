import { Pool, PoolClient } from 'pg'
import { DbDriver, queryHasLimitClause } from './base'
import { DbConnectionConfig, DbEngine, DbTable, DbTableInfo, DbColumn, DbIndex, DbQueryResult } from '../../../../shared/types'

export class PostgresqlDriver implements DbDriver {
  engine: DbEngine = 'postgresql'
  private pool: Pool | null = null
  private activeClient: PoolClient | null = null

  async connect(config: DbConnectionConfig): Promise<void> {
    const connectionConfig = config.connectionString
      ? { connectionString: config.connectionString, ssl: config.ssl ? { rejectUnauthorized: false } : undefined }
      : {
          host: config.host || 'localhost',
          port: config.port || 5432,
          user: config.username,
          password: config.password,
          database: config.database,
          ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
        }

    this.pool = new Pool({
      ...connectionConfig,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    })

    // Test the connection
    const client = await this.pool.connect()
    try {
      await client.query('SELECT 1')
    } finally {
      client.release()
    }
  }

  async disconnect(): Promise<void> {
    if (this.activeClient) {
      this.activeClient.release()
      this.activeClient = null
    }
    if (this.pool) {
      await this.pool.end()
      this.pool = null
    }
  }

  isConnected(): boolean {
    return this.pool !== null && this.pool.totalCount > 0
  }

  async listDatabases(): Promise<string[]> {
    if (!this.pool) throw new Error('Not connected')
    const result = await this.pool.query(
      'SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname',
    )
    return result.rows.map((r: { datname: string }) => r.datname)
  }

  async listSchemas(): Promise<string[]> {
    if (!this.pool) throw new Error('Not connected')
    const result = await this.pool.query(
      `SELECT schema_name FROM information_schema.schemata
       WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
       ORDER BY schema_name`,
    )
    return result.rows.map((r: { schema_name: string }) => r.schema_name)
  }

  async listTables(schema?: string): Promise<DbTable[]> {
    if (!this.pool) throw new Error('Not connected')
    const targetSchema = schema || 'public'
    const result = await this.pool.query(
      `SELECT table_name, table_type
       FROM information_schema.tables
       WHERE table_schema = $1
       ORDER BY table_name`,
      [targetSchema],
    )

    const tables: DbTable[] = []
    for (const row of result.rows as { table_name: string; table_type: string }[]) {
      // Get row count estimate from pg_stat_user_tables for performance
      let rowCount: number | undefined
      try {
        const countResult = await this.pool.query(
          `SELECT n_live_tup AS count FROM pg_stat_user_tables
           WHERE schemaname = $1 AND relname = $2`,
          [targetSchema, row.table_name],
        )
        if (countResult.rows[0]) {
          rowCount = parseInt(String(countResult.rows[0].count), 10)
        }
      } catch {
        // Ignore count errors
      }

      tables.push({
        name: row.table_name,
        schema: targetSchema,
        type: row.table_type === 'VIEW' ? 'view' : 'table',
        rowCount,
      })
    }

    return tables
  }

  async getTableInfo(table: string, schema?: string): Promise<DbTableInfo> {
    if (!this.pool) throw new Error('Not connected')
    const targetSchema = schema || 'public'

    // Get columns
    const colResult = await this.pool.query(
      `SELECT
         c.column_name,
         c.data_type,
         c.is_nullable,
         c.column_default,
         CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS is_primary_key,
         CASE WHEN fk.column_name IS NOT NULL THEN true ELSE false END AS is_foreign_key
       FROM information_schema.columns c
       LEFT JOIN (
         SELECT kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema = kcu.table_schema
         WHERE tc.constraint_type = 'PRIMARY KEY'
           AND tc.table_schema = $1
           AND tc.table_name = $2
       ) pk ON pk.column_name = c.column_name
       LEFT JOIN (
         SELECT kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema = kcu.table_schema
         WHERE tc.constraint_type = 'FOREIGN KEY'
           AND tc.table_schema = $1
           AND tc.table_name = $2
       ) fk ON fk.column_name = c.column_name
       WHERE c.table_schema = $1 AND c.table_name = $2
       ORDER BY c.ordinal_position`,
      [targetSchema, table],
    )

    const columns: DbColumn[] = colResult.rows.map(
      (r: {
        column_name: string
        data_type: string
        is_nullable: string
        column_default: string | null
        is_primary_key: boolean
        is_foreign_key: boolean
      }) => ({
        name: r.column_name,
        type: r.data_type,
        nullable: r.is_nullable === 'YES',
        isPrimaryKey: r.is_primary_key,
        isForeignKey: r.is_foreign_key,
        defaultValue: r.column_default ?? undefined,
      }),
    )

    // Get indexes
    const idxResult = await this.pool.query(
      `SELECT
         indexname,
         indexdef
       FROM pg_indexes
       WHERE schemaname = $1 AND tablename = $2
       ORDER BY indexname`,
      [targetSchema, table],
    )

    const indexes: DbIndex[] = idxResult.rows.map(
      (r: { indexname: string; indexdef: string }) => {
        const isUnique = r.indexdef.toUpperCase().includes('UNIQUE')
        // Extract column names from index definition
        const colMatch = r.indexdef.match(/\((.+)\)/)
        const indexColumns = colMatch
          ? colMatch[1]!.split(',').map((c: string) => c.trim().replace(/"/g, ''))
          : []
        const typeMatch = r.indexdef.match(/USING\s+(\w+)/i)
        const indexType = typeMatch ? typeMatch[1]! : 'btree'

        return {
          name: r.indexname,
          columns: indexColumns,
          unique: isUnique,
          type: indexType,
        }
      },
    )

    // Get row count
    let rowCount = 0
    try {
      const countResult = await this.pool.query(
        `SELECT COUNT(*) AS count FROM "${targetSchema}"."${table}"`,
      )
      rowCount = parseInt(String(countResult.rows[0]?.count ?? 0), 10)
    } catch {
      // Fallback to estimate
      try {
        const estResult = await this.pool.query(
          `SELECT n_live_tup AS count FROM pg_stat_user_tables
           WHERE schemaname = $1 AND relname = $2`,
          [targetSchema, table],
        )
        rowCount = parseInt(String(estResult.rows[0]?.count ?? 0), 10)
      } catch {
        // Ignore
      }
    }

    return { columns, indexes, rowCount }
  }

  async executeQuery(sql: string, limit?: number, offset?: number): Promise<DbQueryResult> {
    if (!this.pool) throw new Error('Not connected')

    const startTime = Date.now()

    try {
      // Wrap with LIMIT/OFFSET if provided and query is a SELECT
      let wrappedSql = sql.trim()
      const isSelect = wrappedSql.toUpperCase().startsWith('SELECT')

      if (isSelect && limit !== undefined && !queryHasLimitClause(wrappedSql)) {
        // Remove trailing semicolon for wrapping
        wrappedSql = wrappedSql.replace(/;\s*$/, '')
        wrappedSql = `${wrappedSql} LIMIT ${limit}`
        if (offset !== undefined && offset > 0) {
          wrappedSql = `${wrappedSql} OFFSET ${offset}`
        }
      }

      this.activeClient = await this.pool.connect()
      try {
        const result = await this.activeClient.query(wrappedSql)
        const executionTime = Date.now() - startTime

        // For SELECT queries, try to get total count
        let totalRows: number | undefined
        if (isSelect && limit !== undefined) {
          try {
            const cleanSql = sql.trim().replace(/;\s*$/, '')
            const countResult = await this.activeClient.query(
              `SELECT COUNT(*) AS total FROM (${cleanSql}) AS _count_query`,
            )
            totalRows = parseInt(String(countResult.rows[0]?.total ?? 0), 10)
          } catch {
            // Total count is optional
          }
        }

        const columns = result.fields ? result.fields.map((f) => f.name) : []
        const rows = (result.rows ?? []) as Record<string, unknown>[]

        return {
          columns,
          rows,
          rowCount: result.rowCount ?? rows.length,
          totalRows,
          executionTime,
        }
      } finally {
        this.activeClient.release()
        this.activeClient = null
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
    if (this.activeClient) {
      // pg doesn't have a direct cancel, but releasing the client will abort
      this.activeClient.release()
      this.activeClient = null
    }
  }

  getDefaultPort(): number {
    return 5432
  }

  parseConnectionString(uri: string): Partial<DbConnectionConfig> {
    try {
      const url = new URL(uri)
      return {
        engine: 'postgresql',
        host: url.hostname || 'localhost',
        port: url.port ? parseInt(url.port, 10) : 5432,
        username: url.username || undefined,
        password: url.password ? decodeURIComponent(url.password) : undefined,
        database: url.pathname.slice(1) || undefined,
        ssl: url.searchParams.get('sslmode') === 'require',
      }
    } catch {
      return { engine: 'postgresql' }
    }
  }
}
