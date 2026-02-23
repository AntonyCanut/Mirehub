import { DbConnectionConfig, DbEngine, DbTable, DbTableInfo, DbQueryResult } from '../../../../shared/types'

/**
 * Detect if a SQL query already contains a LIMIT-like clause.
 * Strips string literals and comments before matching to avoid false positives.
 */
export function queryHasLimitClause(sql: string): boolean {
  const cleaned = sql
    .replace(/'[^']*'/g, '')
    .replace(/"[^"]*"/g, '')
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
  return (
    /\bLIMIT\s+\d+/i.test(cleaned) ||
    /\bFETCH\s+(FIRST|NEXT)\s+\d+/i.test(cleaned) ||
    /\bSELECT\s+TOP\s+\d+/i.test(cleaned)
  )
}

export interface DbDriver {
  engine: DbEngine
  connect(config: DbConnectionConfig): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean
  listDatabases(): Promise<string[]>
  listSchemas(): Promise<string[]>
  listTables(schema?: string): Promise<DbTable[]>
  getTableInfo(table: string, schema?: string): Promise<DbTableInfo>
  executeQuery(sql: string, limit?: number, offset?: number): Promise<DbQueryResult>
  cancelQuery(): void
  getDefaultPort(): number
  parseConnectionString(uri: string): Partial<DbConnectionConfig>
}
