import { spawn, type ChildProcess } from 'child_process'
import { databaseService } from './index'
import type { DbNlPermissions, DbNlQueryResponse, DbNlGenerateResponse, DbNlInterpretResponse, DbNlHistoryEntry, DbTableInfo } from '../../../shared/types'

/** Active NL query processes, keyed by connectionId */
const activeProcesses = new Map<string, ChildProcess>()

/**
 * Build a schema context string for the given connection.
 * Lists all tables with their columns, types, and constraints.
 */
export async function getSchemaContext(connectionId: string): Promise<string> {
  const driver = databaseService.getDriver(connectionId)
  if (!driver) throw new Error('Not connected')

  const parts: string[] = []
  parts.push(`Database engine: ${driver.engine}`)

  // Try schemas first (PostgreSQL, MSSQL)
  const schemas = await driver.listSchemas()
  if (schemas.length > 0) {
    for (const schema of schemas) {
      const tables = await driver.listTables(schema)
      for (const table of tables) {
        let info: DbTableInfo | null = null
        try {
          info = await driver.getTableInfo(table.name, schema)
        } catch {
          // Skip tables we can't introspect
        }
        parts.push(formatTableContext(table.name, schema, info))
      }
    }
  } else {
    // Flat tables (MySQL, SQLite, MongoDB)
    const tables = await driver.listTables()
    for (const table of tables) {
      let info: DbTableInfo | null = null
      try {
        info = await driver.getTableInfo(table.name)
      } catch {
        // Skip tables we can't introspect
      }
      parts.push(formatTableContext(table.name, undefined, info))
    }
  }

  return parts.join('\n')
}

function formatTableContext(
  tableName: string,
  schema: string | undefined,
  info: DbTableInfo | null,
): string {
  const fullName = schema ? `${schema}.${tableName}` : tableName
  if (!info) return `Table: ${fullName} (no column info)`

  const cols = info.columns.map((c) => {
    const flags: string[] = []
    if (c.isPrimaryKey) flags.push('PK')
    if (c.isForeignKey) flags.push('FK')
    if (!c.nullable) flags.push('NOT NULL')
    const flagStr = flags.length > 0 ? ` [${flags.join(', ')}]` : ''
    return `  - ${c.name}: ${c.type}${flagStr}`
  })

  return `Table: ${fullName} (~${info.rowCount} rows)\n${cols.join('\n')}`
}

/**
 * Build the permission constraint description for the prompt.
 */
function buildPermissionConstraints(permissions: DbNlPermissions): string {
  const allowed: string[] = []
  const forbidden: string[] = []

  if (permissions.canRead) allowed.push('SELECT')
  else forbidden.push('SELECT')

  if (permissions.canUpdate) allowed.push('INSERT, UPDATE')
  else forbidden.push('INSERT, UPDATE')

  if (permissions.canDelete) allowed.push('DELETE, DROP, TRUNCATE')
  else forbidden.push('DELETE, DROP, TRUNCATE')

  const parts: string[] = []
  if (allowed.length > 0) parts.push(`Allowed operations: ${allowed.join(', ')}`)
  if (forbidden.length > 0) parts.push(`FORBIDDEN operations (never generate these): ${forbidden.join(', ')}`)

  return parts.join('\n')
}

/**
 * Cancel an active NL query for a connection.
 */
export function cancelNlQuery(connectionId: string): boolean {
  const proc = activeProcesses.get(connectionId)
  if (proc) {
    proc.kill('SIGTERM')
    activeProcesses.delete(connectionId)
    return true
  }
  return false
}

/**
 * Execute a natural language query via Claude CLI.
 * 1. Gets the DB schema context
 * 2. Builds a prompt for Claude Haiku
 * 3. Calls Claude CLI to generate SQL + explanation
 * 4. Validates permissions
 * 5. Executes the SQL
 */
export async function executeNlQuery(
  connectionId: string,
  prompt: string,
  permissions: DbNlPermissions,
): Promise<DbNlQueryResponse> {
  const driver = databaseService.getDriver(connectionId)
  if (!driver) {
    return { success: false, error: 'Not connected to database' }
  }

  // Get schema context
  let schemaContext: string
  try {
    schemaContext = await getSchemaContext(connectionId)
  } catch (err) {
    return { success: false, error: `Failed to get schema: ${String(err)}` }
  }

  // Build prompt for Claude
  const permissionConstraints = buildPermissionConstraints(permissions)
  const systemPrompt = `You are a SQL query generator. Given a database schema and a natural language question, generate the SQL query and a brief explanation.

RULES:
1. Output a JSON object with exactly two fields: "sql" (the raw SQL query) and "explanation" (one sentence in French describing what the query returns).
2. Output ONLY the JSON object, no markdown, no code blocks, no extra text.
3. ${permissionConstraints}
4. Use proper quoting for identifiers when needed.
5. For ${driver.engine}, use the appropriate SQL dialect.
6. Add LIMIT 100 to SELECT queries unless the user specifies otherwise.
7. Never generate destructive operations (DROP DATABASE, TRUNCATE) unless explicitly allowed.

DATABASE SCHEMA:
${schemaContext}

USER QUESTION: ${prompt}`

  // Call Claude CLI (Haiku for speed)
  let rawOutput: string
  try {
    rawOutput = await callClaude(connectionId, systemPrompt)
  } catch (err) {
    const msg = String(err)
    if (msg.includes('cancelled')) {
      return { success: false, error: 'Requete annulee' }
    }
    return { success: false, error: `Claude error: ${msg}` }
  }

  // Parse JSON response
  let sql: string
  let explanation: string
  try {
    const parsed = parseClaudeResponse(rawOutput)
    sql = parsed.sql
    explanation = parsed.explanation
  } catch {
    // Fallback: treat entire output as raw SQL
    sql = cleanSqlOutput(rawOutput)
    explanation = ''
  }

  if (!sql.trim()) {
    return { success: false, error: 'Claude returned empty SQL' }
  }

  // Validate permissions
  const violation = validateSqlPermissions(sql, permissions)
  if (violation) {
    return {
      success: false,
      sql,
      error: `Permission denied: ${violation}`,
    }
  }

  // Execute the SQL
  try {
    const result = await driver.executeQuery(sql, 100, 0)
    if (result.error) {
      return { success: false, sql, error: result.error }
    }
    const finalExplanation = explanation || `${result.rowCount} resultat(s)`
    return { success: true, sql, result, explanation: finalExplanation }
  } catch (err) {
    return { success: false, sql, error: `Execution error: ${String(err)}` }
  }
}

/** Human-readable engine labels for the prompt */
const ENGINE_LABELS: Record<string, string> = {
  postgresql: 'PostgreSQL',
  mysql: 'MySQL',
  mssql: 'Microsoft SQL Server (T-SQL)',
  sqlite: 'SQLite',
  mongodb: 'MongoDB',
}

/**
 * Format conversation history for the prompt.
 */
function formatHistory(history: DbNlHistoryEntry[]): string {
  if (history.length === 0) return ''

  const lines = history.map((entry) => {
    if (entry.role === 'user') {
      return `User: ${entry.content}`
    }
    // Assistant: include the SQL that was generated
    const sqlPart = entry.sql ? ` [SQL: ${entry.sql}]` : ''
    return `Assistant: ${entry.content}${sqlPart}`
  })

  return `\nCONVERSATION HISTORY:\n${lines.join('\n')}\n`
}

/**
 * Generate SQL from a natural language query via Claude CLI (without executing).
 * 1. Gets the DB schema context
 * 2. Builds a prompt for Claude Haiku (with engine type + conversation history)
 * 3. Calls Claude CLI to generate SQL + explanation
 * 4. Validates permissions
 * Returns the generated SQL and explanation without executing.
 */
export async function generateNlSql(
  connectionId: string,
  prompt: string,
  permissions: DbNlPermissions,
  history: DbNlHistoryEntry[] = [],
): Promise<DbNlGenerateResponse> {
  const driver = databaseService.getDriver(connectionId)
  if (!driver) {
    return { success: false, error: 'Not connected to database' }
  }

  let schemaContext: string
  try {
    schemaContext = await getSchemaContext(connectionId)
  } catch (err) {
    return { success: false, error: `Failed to get schema: ${String(err)}` }
  }

  const engineLabel = ENGINE_LABELS[driver.engine] || driver.engine
  const permissionConstraints = buildPermissionConstraints(permissions)
  const historyBlock = formatHistory(history)

  const quotingRule = driver.engine === 'postgresql'
    ? `CRITICAL QUOTING RULE: In PostgreSQL, unquoted identifiers are folded to lowercase. You MUST double-quote ALL column and table names exactly as they appear in the schema. Example: "subscriptionStatus", "createdAt", "User". ALWAYS quote every identifier.`
    : driver.engine === 'mysql'
      ? `Quoting: Use backticks for identifiers that are reserved words or contain special characters.`
      : ''

  const systemPrompt = `You are a SQL query generator for a **${engineLabel}** database.
Given the database schema and a user question, generate the appropriate SQL query.

RULES:
1. Output a JSON object with exactly two fields: "sql" (the raw SQL query) and "explanation" (one sentence in French describing what the query returns).
2. Output ONLY the JSON object, no markdown, no code blocks, no extra text.
3. ${permissionConstraints}
4. Use the **${engineLabel}** SQL dialect exclusively. Respect its syntax, quoting, and functions.
5. Add LIMIT 100 to SELECT queries unless the user specifies otherwise.
6. Never generate destructive operations (DROP DATABASE, TRUNCATE) unless explicitly allowed.
7. If the conversation history contains previous questions and SQL, use that context to understand follow-up questions (e.g. "and by city?" refers to the previous query subject).
${quotingRule ? `8. ${quotingRule}` : ''}

DATABASE ENGINE: ${engineLabel}

DATABASE SCHEMA:
${schemaContext}
${historyBlock}
USER QUESTION: ${prompt}`

  let rawOutput: string
  try {
    rawOutput = await callClaude(connectionId, systemPrompt)
  } catch (err) {
    const msg = String(err)
    if (msg.includes('cancelled')) {
      return { success: false, error: 'Requete annulee' }
    }
    return { success: false, error: `Claude error: ${msg}` }
  }

  let sql: string
  let explanation: string
  try {
    const parsed = parseClaudeResponse(rawOutput)
    sql = parsed.sql
    explanation = parsed.explanation
  } catch {
    sql = cleanSqlOutput(rawOutput)
    explanation = ''
  }

  if (!sql.trim()) {
    return { success: false, error: 'Claude returned empty SQL' }
  }

  const violation = validateSqlPermissions(sql, permissions)
  if (violation) {
    return { success: false, sql, error: `Permission denied: ${violation}` }
  }

  return { success: true, sql, explanation }
}

/**
 * Interpret query results via Claude CLI.
 * Given the user question, the SQL that was executed, and the results,
 * Claude either provides a human-friendly answer or suggests a corrected SQL.
 */
export async function interpretNlResults(
  connectionId: string,
  question: string,
  sql: string,
  columns: string[],
  rows: Record<string, unknown>[],
  rowCount: number,
  history: DbNlHistoryEntry[] = [],
): Promise<DbNlInterpretResponse> {
  const driver = databaseService.getDriver(connectionId)
  if (!driver) {
    return { success: false, error: 'Not connected to database' }
  }

  const engineLabel = ENGINE_LABELS[driver.engine] || driver.engine
  const historyBlock = formatHistory(history)

  // Build a compact summary of the results (max 10 rows to keep prompt small)
  const sampleRows = rows.slice(0, 10)
  const resultSummary = sampleRows.length > 0
    ? `Columns: ${columns.join(', ')}\nRows (${sampleRows.length} of ${rowCount}):\n${sampleRows.map((r) => columns.map((c) => `${c}=${r[c] ?? 'NULL'}`).join(', ')).join('\n')}`
    : 'No rows returned.'

  const prompt = `You analyzed a **${engineLabel}** database. A user asked a question, you generated SQL, and it was executed. Now review the results.

TASK: Respond with a JSON object with one of two formats:
A) Results correctly answer the question:
   {"answer": "A concise, natural answer in French. Use actual values from results. Be conversational, not technical."}
B) Results do NOT correctly answer the question (wrong filter, missing condition, bad assumption about column values, etc.):
   {"refinedSql": "The corrected SQL query"}

IMPORTANT:
- Look at the ACTUAL data returned. If column values suggest your WHERE clause was wrong, refine.
- For counts, say the number naturally: "Vous avez 6 utilisateurs." not just "6".
- For lists, summarize briefly: "Il y a 42 utilisateurs abonnes." or describe key findings.
- Output ONLY the JSON object, no markdown, no extra text.
${historyBlock}
USER QUESTION: ${question}

SQL EXECUTED: ${sql}

QUERY RESULTS (${rowCount} total rows):
${resultSummary}`

  let rawOutput: string
  try {
    rawOutput = await callClaude(connectionId, prompt)
  } catch (err) {
    const msg = String(err)
    if (msg.includes('cancelled')) {
      return { success: false, error: 'Requete annulee' }
    }
    return { success: false, error: `Claude error: ${msg}` }
  }

  try {
    let cleaned = rawOutput.trim()
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7)
    else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3)
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3)
    cleaned = cleaned.trim()

    const parsed = JSON.parse(cleaned)

    if (typeof parsed.answer === 'string') {
      return { success: true, answer: parsed.answer }
    }
    if (typeof parsed.refinedSql === 'string') {
      return { success: true, refinedSql: parsed.refinedSql }
    }

    // Fallback: treat raw output as the answer
    return { success: true, answer: rawOutput.trim() }
  } catch {
    return { success: true, answer: rawOutput.trim() }
  }
}

/**
 * Parse Claude's JSON response into sql + explanation.
 */
function parseClaudeResponse(raw: string): { sql: string; explanation: string } {
  let cleaned = raw.trim()
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7)
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3)
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3)
  cleaned = cleaned.trim()

  const parsed = JSON.parse(cleaned)
  if (typeof parsed.sql !== 'string') {
    throw new Error('Missing sql field')
  }
  return {
    sql: parsed.sql.trim(),
    explanation: typeof parsed.explanation === 'string' ? parsed.explanation : '',
  }
}

/**
 * Call Claude CLI with a prompt and return the output.
 * Uses Haiku model for fast responses.
 * Pipes prompt via stdin to avoid CLI argument length limits.
 * Uses --output-format json for reliable parsing.
 */
function callClaude(connectionId: string, prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Cancel any existing query for this connection
    cancelNlQuery(connectionId)

    // Strip CLAUDECODE + CLAUDE_CODE_ENTRYPOINT to allow spawning inside a Claude Code session
    // Set MIREHUB_NL_QUERY to tell the activity hook to skip (no bell sound)
    const env = { ...process.env }
    delete env.CLAUDECODE
    delete env.CLAUDE_CODE_ENTRYPOINT
    env.MIREHUB_NL_QUERY = '1'

    const proc = spawn('claude', ['-p', '--model', 'claude-haiku-4-5-20251001', '--output-format', 'json'], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    activeProcesses.set(connectionId, proc)

    // Pipe prompt via stdin instead of CLI argument (handles large schemas)
    proc.stdin?.write(prompt)
    proc.stdin?.end()

    let stdout = ''
    let stderr = ''

    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    proc.on('error', (err) => {
      activeProcesses.delete(connectionId)
      reject(new Error(`Failed to spawn Claude CLI: ${err.message}`))
    })

    proc.on('exit', (code, signal) => {
      activeProcesses.delete(connectionId)
      if (signal === 'SIGTERM') {
        reject(new Error('cancelled'))
      } else if (code === 0) {
        // Parse --output-format json wrapper: { result: "model response text" }
        try {
          const wrapper = JSON.parse(stdout)
          resolve(typeof wrapper.result === 'string' ? wrapper.result.trim() : stdout.trim())
        } catch {
          resolve(stdout.trim())
        }
      } else {
        reject(new Error(stderr.trim() || `Claude CLI exited with code ${code}`))
      }
    })

    // Timeout after 120 seconds (CLI startup + API call can take time)
    setTimeout(() => {
      if (activeProcesses.has(connectionId)) {
        proc.kill('SIGTERM')
        activeProcesses.delete(connectionId)
        reject(new Error('Claude CLI timed out after 120s'))
      }
    }, 120000)
  })
}

/**
 * Clean SQL output from Claude (remove markdown fences, etc.)
 */
function cleanSqlOutput(raw: string): string {
  let sql = raw.trim()
  if (sql.startsWith('```sql')) sql = sql.slice(6)
  else if (sql.startsWith('```')) sql = sql.slice(3)
  if (sql.endsWith('```')) sql = sql.slice(0, -3)
  return sql.trim()
}

/**
 * Validate that the generated SQL respects the given permissions.
 */
function validateSqlPermissions(sql: string, permissions: DbNlPermissions): string | null {
  const cleaned = sql
    .replace(/'[^']*'/g, '')
    .replace(/"[^"]*"/g, '')
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .toUpperCase()

  if (!permissions.canRead && /\bSELECT\b/.test(cleaned)) {
    return 'SELECT queries are not allowed on this connection'
  }

  if (!permissions.canUpdate) {
    if (/\bINSERT\b/.test(cleaned)) return 'INSERT queries are not allowed on this connection'
    if (/\bUPDATE\b/.test(cleaned)) return 'UPDATE queries are not allowed on this connection'
    if (/\bALTER\b/.test(cleaned)) return 'ALTER queries are not allowed on this connection'
    if (/\bCREATE\b/.test(cleaned)) return 'CREATE queries are not allowed on this connection'
  }

  if (!permissions.canDelete) {
    if (/\bDELETE\b/.test(cleaned)) return 'DELETE queries are not allowed on this connection'
    if (/\bDROP\b/.test(cleaned)) return 'DROP queries are not allowed on this connection'
    if (/\bTRUNCATE\b/.test(cleaned)) return 'TRUNCATE queries are not allowed on this connection'
  }

  return null
}
