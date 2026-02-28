import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { DbTableInfo, DbNlPermissions } from '../../src/shared/types'

// ---------------------------------------------------------------------------
// Mock: database service
// ---------------------------------------------------------------------------
const mockDriver = {
  engine: 'postgresql' as const,
  listSchemas: vi.fn(),
  listTables: vi.fn(),
  getTableInfo: vi.fn(),
  executeQuery: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  isConnected: vi.fn(),
  listDatabases: vi.fn(),
  cancelQuery: vi.fn(),
  getDefaultPort: vi.fn(),
  parseConnectionString: vi.fn(),
}
const mockGetDriver = vi.fn()

vi.mock('../../src/main/services/database/index', () => ({
  databaseService: { getDriver: (...args: unknown[]) => mockGetDriver(...args) },
}))

// ---------------------------------------------------------------------------
// Mock: child_process.spawn
// ---------------------------------------------------------------------------
const mockSpawn = vi.fn()

vi.mock('child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}))

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks are registered
// ---------------------------------------------------------------------------
const {
  getSchemaContext,
  cancelNlQuery,
  executeNlQuery,
  generateNlSql,
  interpretNlResults,
} = await import('../../src/main/services/database/nlQuery')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a fake ChildProcess-like object that emits stdout data and then exits. */
function createMockProcess(stdout: string, exitCode = 0) {
  const stdoutListeners: Record<string, Array<(data: Buffer) => void>> = {}
  const stderrListeners: Record<string, Array<(data: Buffer) => void>> = {}
  const procListeners: Record<string, Array<(...args: unknown[]) => void>> = {}

  const proc = {
    stdin: { write: vi.fn(), end: vi.fn() },
    stdout: {
      on: vi.fn((event: string, cb: (data: Buffer) => void) => {
        if (!stdoutListeners[event]) stdoutListeners[event] = []
        stdoutListeners[event].push(cb)
      }),
    },
    stderr: {
      on: vi.fn((event: string, cb: (data: Buffer) => void) => {
        if (!stderrListeners[event]) stderrListeners[event] = []
        stderrListeners[event].push(cb)
      }),
    },
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      if (!procListeners[event]) procListeners[event] = []
      procListeners[event].push(cb)
    }),
    kill: vi.fn(),
    pid: 1234,
  }

  // Schedule async emission of data + exit so that the Promise inside callClaude resolves
  setTimeout(() => {
    for (const cb of stdoutListeners['data'] ?? []) {
      cb(Buffer.from(stdout))
    }
  }, 0)

  setTimeout(() => {
    for (const cb of procListeners['exit'] ?? []) {
      cb(exitCode, null)
    }
  }, 5)

  return proc
}

/** Build a standard mock process that returns a Claude JSON wrapper. */
function mockClaudeResponse(payload: { sql: string; explanation: string }) {
  const wrapper = JSON.stringify({ result: JSON.stringify(payload) })
  const proc = createMockProcess(wrapper, 0)
  mockSpawn.mockReturnValue(proc)
  return proc
}

/** Build a mock process that returns an interpretation response. */
function mockClaudeInterpretResponse(payload: { answer?: string; refinedSql?: string }) {
  const wrapper = JSON.stringify({ result: JSON.stringify(payload) })
  const proc = createMockProcess(wrapper, 0)
  mockSpawn.mockReturnValue(proc)
  return proc
}

const ALL_PERMISSIONS: DbNlPermissions = { canRead: true, canUpdate: true, canDelete: true }
const READ_ONLY: DbNlPermissions = { canRead: true, canUpdate: false, canDelete: false }
const NO_READ: DbNlPermissions = { canRead: false, canUpdate: false, canDelete: false }
const NO_DELETE: DbNlPermissions = { canRead: true, canUpdate: true, canDelete: false }

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('nlQuery helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDriver.mockReturnValue(undefined)
  })

  // =========================================================================
  // getSchemaContext
  // =========================================================================
  describe('getSchemaContext', () => {
    it('lance une erreur si non connecte', async () => {
      mockGetDriver.mockReturnValue(undefined)

      await expect(getSchemaContext('conn-1')).rejects.toThrow('Not connected')
    })

    it('construit le contexte pour des tables avec schemas (PostgreSQL)', async () => {
      const tableInfo: DbTableInfo = {
        columns: [
          { name: 'id', type: 'integer', nullable: false, isPrimaryKey: true, isForeignKey: false },
          { name: 'name', type: 'varchar(255)', nullable: false, isPrimaryKey: false, isForeignKey: false },
          { name: 'org_id', type: 'integer', nullable: true, isPrimaryKey: false, isForeignKey: true },
        ],
        indexes: [],
        rowCount: 42,
      }

      mockGetDriver.mockReturnValue(mockDriver)
      mockDriver.listSchemas.mockResolvedValue(['public'])
      mockDriver.listTables.mockResolvedValue([{ name: 'users' }])
      mockDriver.getTableInfo.mockResolvedValue(tableInfo)

      const result = await getSchemaContext('conn-1')

      expect(result).toContain('Database engine: postgresql')
      expect(result).toContain('Table: public.users (~42 rows)')
      expect(result).toContain('id: integer [PK, NOT NULL]')
      expect(result).toContain('name: varchar(255) [NOT NULL]')
      expect(result).toContain('org_id: integer [FK]')
    })

    it('construit le contexte pour des tables sans schemas (MySQL/SQLite)', async () => {
      const mysqlDriver = { ...mockDriver, engine: 'mysql' as const }
      const tableInfo: DbTableInfo = {
        columns: [
          { name: 'id', type: 'int', nullable: false, isPrimaryKey: true, isForeignKey: false },
        ],
        indexes: [],
        rowCount: 100,
      }

      mockGetDriver.mockReturnValue(mysqlDriver)
      mysqlDriver.listSchemas.mockResolvedValue([])
      mysqlDriver.listTables.mockResolvedValue([{ name: 'orders' }])
      mysqlDriver.getTableInfo.mockResolvedValue(tableInfo)

      const result = await getSchemaContext('conn-2')

      expect(result).toContain('Database engine: mysql')
      // No schema prefix for flat tables
      expect(result).toContain('Table: orders (~100 rows)')
      expect(result).not.toContain('.')
      // Column flags
      expect(result).toContain('id: int [PK, NOT NULL]')
    })

    it('inclut les colonnes avec flags PK/FK/NOT NULL', async () => {
      const tableInfo: DbTableInfo = {
        columns: [
          { name: 'pk_col', type: 'uuid', nullable: false, isPrimaryKey: true, isForeignKey: false },
          { name: 'fk_col', type: 'int', nullable: true, isPrimaryKey: false, isForeignKey: true },
          { name: 'both_col', type: 'int', nullable: false, isPrimaryKey: true, isForeignKey: true },
          { name: 'plain_col', type: 'text', nullable: true, isPrimaryKey: false, isForeignKey: false },
        ],
        indexes: [],
        rowCount: 10,
      }

      mockGetDriver.mockReturnValue(mockDriver)
      mockDriver.listSchemas.mockResolvedValue(['public'])
      mockDriver.listTables.mockResolvedValue([{ name: 'test_table' }])
      mockDriver.getTableInfo.mockResolvedValue(tableInfo)

      const result = await getSchemaContext('conn-1')

      // PK + NOT NULL
      expect(result).toContain('pk_col: uuid [PK, NOT NULL]')
      // FK only (nullable)
      expect(result).toContain('fk_col: int [FK]')
      // PK + FK + NOT NULL
      expect(result).toContain('both_col: int [PK, FK, NOT NULL]')
      // No flags at all
      expect(result).toMatch(/plain_col: text$/)
    })

    it('gere les tables sans info colonnes', async () => {
      mockGetDriver.mockReturnValue(mockDriver)
      mockDriver.listSchemas.mockResolvedValue(['public'])
      mockDriver.listTables.mockResolvedValue([{ name: 'broken_table' }])
      mockDriver.getTableInfo.mockRejectedValue(new Error('no access'))

      const result = await getSchemaContext('conn-1')

      expect(result).toContain('Table: public.broken_table (no column info)')
    })
  })

  // =========================================================================
  // cancelNlQuery
  // =========================================================================
  describe('cancelNlQuery', () => {
    it('retourne false si pas de processus actif', () => {
      const result = cancelNlQuery('conn-nonexistent')
      expect(result).toBe(false)
    })

    it('retourne true et tue le processus actif', async () => {
      // We need to start a query so that an active process exists.
      // We create a process that never exits so we can cancel it.
      const neverExitListeners: Record<string, Array<(...args: unknown[]) => void>> = {}
      const proc = {
        stdin: { write: vi.fn(), end: vi.fn() },
        stdout: {
          on: vi.fn((event: string, cb: (data: Buffer) => void) => {
            if (!neverExitListeners[event]) neverExitListeners[event] = []
            neverExitListeners[event].push(cb as (...args: unknown[]) => void)
          }),
        },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
          if (!neverExitListeners[event]) neverExitListeners[event] = []
          neverExitListeners[event].push(cb)
        }),
        kill: vi.fn(),
        pid: 9999,
      }
      mockSpawn.mockReturnValue(proc)

      // Set up the driver so executeNlQuery gets past the connection check
      mockGetDriver.mockReturnValue(mockDriver)
      mockDriver.listSchemas.mockResolvedValue([])
      mockDriver.listTables.mockResolvedValue([])

      // Start a query (it will hang because the process never exits)
      const queryPromise = executeNlQuery('conn-cancel', 'SELECT 1', ALL_PERMISSIONS)

      // Give time for the process to be registered
      await new Promise((r) => setTimeout(r, 10))

      // Now cancel
      const cancelled = cancelNlQuery('conn-cancel')
      expect(cancelled).toBe(true)
      expect(proc.kill).toHaveBeenCalledWith('SIGTERM')

      // Simulate the exit after SIGTERM so the promise resolves
      for (const cb of neverExitListeners['exit'] ?? []) {
        cb(null, 'SIGTERM')
      }

      const result = await queryPromise
      expect(result.success).toBe(false)
      expect(result.error).toContain('annulee')
    })
  })

  // =========================================================================
  // executeNlQuery
  // =========================================================================
  describe('executeNlQuery', () => {
    it('retourne erreur si non connecte', async () => {
      mockGetDriver.mockReturnValue(undefined)

      const result = await executeNlQuery('conn-bad', 'list users', ALL_PERMISSIONS)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Not connected')
    })

    it('retourne erreur si schema echoue', async () => {
      mockGetDriver.mockReturnValue(mockDriver)
      mockDriver.listSchemas.mockRejectedValue(new Error('schema error'))

      const result = await executeNlQuery('conn-1', 'list users', ALL_PERMISSIONS)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Failed to get schema')
    })

    it('execute une requete valide avec succes', async () => {
      mockGetDriver.mockReturnValue(mockDriver)
      mockDriver.listSchemas.mockResolvedValue([])
      mockDriver.listTables.mockResolvedValue([])
      mockDriver.executeQuery.mockResolvedValue({
        columns: ['id', 'name'],
        rows: [{ id: 1, name: 'Alice' }],
        rowCount: 1,
        executionTime: 50,
      })

      mockClaudeResponse({
        sql: 'SELECT id, name FROM users LIMIT 100',
        explanation: 'Liste des utilisateurs',
      })

      const result = await executeNlQuery('conn-1', 'show users', ALL_PERMISSIONS)

      expect(result.success).toBe(true)
      expect(result.sql).toBe('SELECT id, name FROM users LIMIT 100')
      expect(result.explanation).toBe('Liste des utilisateurs')
      expect(result.result?.rowCount).toBe(1)
    })

    it('refuse SELECT si canRead=false', async () => {
      mockGetDriver.mockReturnValue(mockDriver)
      mockDriver.listSchemas.mockResolvedValue([])
      mockDriver.listTables.mockResolvedValue([])

      mockClaudeResponse({
        sql: 'SELECT * FROM users',
        explanation: 'All users',
      })

      const result = await executeNlQuery('conn-1', 'show users', NO_READ)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Permission denied')
      expect(result.error).toContain('SELECT')
    })

    it('refuse INSERT si canUpdate=false', async () => {
      mockGetDriver.mockReturnValue(mockDriver)
      mockDriver.listSchemas.mockResolvedValue([])
      mockDriver.listTables.mockResolvedValue([])

      mockClaudeResponse({
        sql: "INSERT INTO users (name) VALUES ('Bob')",
        explanation: 'Insert user',
      })

      const result = await executeNlQuery('conn-1', 'add user Bob', READ_ONLY)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Permission denied')
      expect(result.error).toContain('INSERT')
    })

    it('refuse UPDATE si canUpdate=false', async () => {
      mockGetDriver.mockReturnValue(mockDriver)
      mockDriver.listSchemas.mockResolvedValue([])
      mockDriver.listTables.mockResolvedValue([])

      mockClaudeResponse({
        sql: "UPDATE users SET name = 'Charlie' WHERE id = 1",
        explanation: 'Update user',
      })

      const result = await executeNlQuery('conn-1', 'rename user 1', READ_ONLY)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Permission denied')
      expect(result.error).toContain('UPDATE')
    })

    it('refuse DELETE si canDelete=false', async () => {
      mockGetDriver.mockReturnValue(mockDriver)
      mockDriver.listSchemas.mockResolvedValue([])
      mockDriver.listTables.mockResolvedValue([])

      mockClaudeResponse({
        sql: 'DELETE FROM users WHERE id = 1',
        explanation: 'Delete user',
      })

      const result = await executeNlQuery('conn-1', 'delete user 1', NO_DELETE)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Permission denied')
      expect(result.error).toContain('DELETE')
    })

    it('refuse DROP si canDelete=false', async () => {
      mockGetDriver.mockReturnValue(mockDriver)
      mockDriver.listSchemas.mockResolvedValue([])
      mockDriver.listTables.mockResolvedValue([])

      mockClaudeResponse({
        sql: 'DROP TABLE users',
        explanation: 'Drop table',
      })

      const result = await executeNlQuery('conn-1', 'drop users table', NO_DELETE)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Permission denied')
      expect(result.error).toContain('DROP')
    })

    it('refuse TRUNCATE si canDelete=false', async () => {
      mockGetDriver.mockReturnValue(mockDriver)
      mockDriver.listSchemas.mockResolvedValue([])
      mockDriver.listTables.mockResolvedValue([])

      mockClaudeResponse({
        sql: 'TRUNCATE TABLE users',
        explanation: 'Truncate table',
      })

      const result = await executeNlQuery('conn-1', 'clear users table', NO_DELETE)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Permission denied')
      expect(result.error).toContain('TRUNCATE')
    })

    it('ignore les mots-cles SQL dans les strings litterales', async () => {
      mockGetDriver.mockReturnValue(mockDriver)
      mockDriver.listSchemas.mockResolvedValue([])
      mockDriver.listTables.mockResolvedValue([])
      mockDriver.executeQuery.mockResolvedValue({
        columns: ['id'],
        rows: [{ id: 1 }],
        rowCount: 1,
        executionTime: 10,
      })

      // The SQL contains DELETE inside a string literal, but the actual operation is SELECT
      mockClaudeResponse({
        sql: "SELECT id FROM logs WHERE message = 'DELETE failed' LIMIT 100",
        explanation: 'Logs with delete errors',
      })

      const result = await executeNlQuery('conn-1', 'find delete error logs', READ_ONLY)

      // canUpdate=false, canDelete=false, but the real operation is SELECT which is allowed
      expect(result.success).toBe(true)
    })

    it('ignore les mots-cles SQL dans les commentaires', async () => {
      mockGetDriver.mockReturnValue(mockDriver)
      mockDriver.listSchemas.mockResolvedValue([])
      mockDriver.listTables.mockResolvedValue([])
      mockDriver.executeQuery.mockResolvedValue({
        columns: ['count'],
        rows: [{ count: 5 }],
        rowCount: 1,
        executionTime: 10,
      })

      mockClaudeResponse({
        sql: '-- This could DELETE data but it only reads\nSELECT count(*) FROM users LIMIT 100',
        explanation: 'Count of users',
      })

      const result = await executeNlQuery('conn-1', 'count users', READ_ONLY)

      expect(result.success).toBe(true)
    })

    it('gere les reponses Claude sans JSON valide (fallback sur SQL brut)', async () => {
      mockGetDriver.mockReturnValue(mockDriver)
      mockDriver.listSchemas.mockResolvedValue([])
      mockDriver.listTables.mockResolvedValue([])
      mockDriver.executeQuery.mockResolvedValue({
        columns: ['id'],
        rows: [{ id: 1 }],
        rowCount: 1,
        executionTime: 10,
      })

      // Claude returns raw SQL wrapped in markdown fences instead of JSON
      const wrapper = JSON.stringify({ result: '```sql\nSELECT id FROM users LIMIT 100\n```' })
      const proc = createMockProcess(wrapper, 0)
      mockSpawn.mockReturnValue(proc)

      const result = await executeNlQuery('conn-1', 'get user ids', ALL_PERMISSIONS)

      expect(result.success).toBe(true)
      expect(result.sql).toBe('SELECT id FROM users LIMIT 100')
    })

    it('retourne erreur si Claude renvoie un SQL vide', async () => {
      mockGetDriver.mockReturnValue(mockDriver)
      mockDriver.listSchemas.mockResolvedValue([])
      mockDriver.listTables.mockResolvedValue([])

      const wrapper = JSON.stringify({ result: '' })
      const proc = createMockProcess(wrapper, 0)
      mockSpawn.mockReturnValue(proc)

      const result = await executeNlQuery('conn-1', 'do something', ALL_PERMISSIONS)

      expect(result.success).toBe(false)
      expect(result.error).toContain('empty SQL')
    })

    it('retourne erreur si execution SQL echoue', async () => {
      mockGetDriver.mockReturnValue(mockDriver)
      mockDriver.listSchemas.mockResolvedValue([])
      mockDriver.listTables.mockResolvedValue([])
      mockDriver.executeQuery.mockResolvedValue({
        columns: [],
        rows: [],
        rowCount: 0,
        executionTime: 0,
        error: 'relation "users" does not exist',
      })

      mockClaudeResponse({
        sql: 'SELECT * FROM users LIMIT 100',
        explanation: 'All users',
      })

      const result = await executeNlQuery('conn-1', 'show users', ALL_PERMISSIONS)

      expect(result.success).toBe(false)
      expect(result.error).toContain('relation "users" does not exist')
    })
  })

  // =========================================================================
  // generateNlSql
  // =========================================================================
  describe('generateNlSql', () => {
    it('retourne erreur si non connecte', async () => {
      mockGetDriver.mockReturnValue(undefined)

      const result = await generateNlSql('conn-bad', 'list users', ALL_PERMISSIONS)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Not connected')
    })

    it('genere du SQL sans executer', async () => {
      mockGetDriver.mockReturnValue(mockDriver)
      mockDriver.listSchemas.mockResolvedValue([])
      mockDriver.listTables.mockResolvedValue([])

      mockClaudeResponse({
        sql: 'SELECT * FROM users LIMIT 100',
        explanation: 'Liste de tous les utilisateurs',
      })

      const result = await generateNlSql('conn-1', 'show users', ALL_PERMISSIONS)

      expect(result.success).toBe(true)
      expect(result.sql).toBe('SELECT * FROM users LIMIT 100')
      expect(result.explanation).toBe('Liste de tous les utilisateurs')
      // Should NOT have called executeQuery
      expect(mockDriver.executeQuery).not.toHaveBeenCalled()
    })

    it('valide les permissions avant de retourner le SQL', async () => {
      mockGetDriver.mockReturnValue(mockDriver)
      mockDriver.listSchemas.mockResolvedValue([])
      mockDriver.listTables.mockResolvedValue([])

      mockClaudeResponse({
        sql: "INSERT INTO users (name) VALUES ('test')",
        explanation: 'Insert user',
      })

      const result = await generateNlSql('conn-1', 'add user', READ_ONLY)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Permission denied')
    })

    it('inclut historique de conversation dans le prompt', async () => {
      mockGetDriver.mockReturnValue(mockDriver)
      mockDriver.listSchemas.mockResolvedValue([])
      mockDriver.listTables.mockResolvedValue([])

      mockClaudeResponse({
        sql: 'SELECT city, COUNT(*) FROM users GROUP BY city LIMIT 100',
        explanation: 'Utilisateurs par ville',
      })

      const history = [
        { role: 'user' as const, content: 'show all users' },
        { role: 'assistant' as const, content: 'All users', sql: 'SELECT * FROM users LIMIT 100' },
      ]

      const result = await generateNlSql('conn-1', 'and by city?', ALL_PERMISSIONS, history)

      expect(result.success).toBe(true)
      // Verify spawn was called and the prompt includes history
      expect(mockSpawn).toHaveBeenCalled()
      const stdinWrite = mockSpawn.mock.results[0]?.value?.stdin?.write
      if (stdinWrite) {
        const promptArg = stdinWrite.mock.calls[0]?.[0] as string | undefined
        if (promptArg) {
          expect(promptArg).toContain('CONVERSATION HISTORY')
          expect(promptArg).toContain('User: show all users')
          expect(promptArg).toContain('SELECT * FROM users LIMIT 100')
        }
      }
    })

    it('retourne erreur si Claude annule', async () => {
      mockGetDriver.mockReturnValue(mockDriver)
      mockDriver.listSchemas.mockResolvedValue([])
      mockDriver.listTables.mockResolvedValue([])

      // Simulate a SIGTERM exit (cancelled)
      const procListeners: Record<string, Array<(...args: unknown[]) => void>> = {}
      const proc = {
        stdin: { write: vi.fn(), end: vi.fn() },
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
          if (!procListeners[event]) procListeners[event] = []
          procListeners[event].push(cb)
        }),
        kill: vi.fn(),
        pid: 5555,
      }
      mockSpawn.mockReturnValue(proc)

      const promise = generateNlSql('conn-1', 'show users', ALL_PERMISSIONS)

      // Let the event loop register handlers
      await new Promise((r) => setTimeout(r, 5))

      // Simulate SIGTERM exit
      for (const cb of procListeners['exit'] ?? []) {
        cb(null, 'SIGTERM')
      }

      const result = await promise

      expect(result.success).toBe(false)
      expect(result.error).toContain('annulee')
    })
  })

  // =========================================================================
  // interpretNlResults
  // =========================================================================
  describe('interpretNlResults', () => {
    it('retourne erreur si non connecte', async () => {
      mockGetDriver.mockReturnValue(undefined)

      const result = await interpretNlResults(
        'conn-bad', 'how many?', 'SELECT count(*) FROM users', ['count'], [{ count: 5 }], 1,
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Not connected')
    })

    it('retourne une reponse textuelle (answer)', async () => {
      mockGetDriver.mockReturnValue(mockDriver)

      mockClaudeInterpretResponse({ answer: 'Vous avez 5 utilisateurs.' })

      const result = await interpretNlResults(
        'conn-1',
        'how many users?',
        'SELECT count(*) FROM users',
        ['count'],
        [{ count: 5 }],
        1,
      )

      expect(result.success).toBe(true)
      expect(result.answer).toBe('Vous avez 5 utilisateurs.')
      expect(result.refinedSql).toBeUndefined()
    })

    it('retourne un SQL corrige (refinedSql)', async () => {
      mockGetDriver.mockReturnValue(mockDriver)

      mockClaudeInterpretResponse({
        refinedSql: "SELECT count(*) FROM users WHERE status = 'active'",
      })

      const result = await interpretNlResults(
        'conn-1',
        'how many active users?',
        'SELECT count(*) FROM users',
        ['count'],
        [{ count: 100 }],
        1,
      )

      expect(result.success).toBe(true)
      expect(result.refinedSql).toBe("SELECT count(*) FROM users WHERE status = 'active'")
      expect(result.answer).toBeUndefined()
    })

    it('gere une reponse Claude non-JSON en fallback', async () => {
      mockGetDriver.mockReturnValue(mockDriver)

      // Return plain text instead of JSON
      const wrapper = JSON.stringify({ result: 'Vous avez 5 utilisateurs dans la base.' })
      const proc = createMockProcess(wrapper, 0)
      mockSpawn.mockReturnValue(proc)

      const result = await interpretNlResults(
        'conn-1',
        'how many users?',
        'SELECT count(*) FROM users',
        ['count'],
        [{ count: 5 }],
        1,
      )

      // Falls back to treating the raw output as the answer
      expect(result.success).toBe(true)
      expect(result.answer).toBe('Vous avez 5 utilisateurs dans la base.')
    })

    it('gere une reponse Claude en markdown fences', async () => {
      mockGetDriver.mockReturnValue(mockDriver)

      const jsonInFences = '```json\n{"answer": "Il y a 42 resultats."}\n```'
      const wrapper = JSON.stringify({ result: jsonInFences })
      const proc = createMockProcess(wrapper, 0)
      mockSpawn.mockReturnValue(proc)

      const result = await interpretNlResults(
        'conn-1',
        'count?',
        'SELECT count(*) FROM x',
        ['count'],
        [{ count: 42 }],
        1,
      )

      expect(result.success).toBe(true)
      expect(result.answer).toBe('Il y a 42 resultats.')
    })

    it('inclut historique dans le prompt d interpretation', async () => {
      mockGetDriver.mockReturnValue(mockDriver)

      mockClaudeInterpretResponse({ answer: 'Reponse contextuelle.' })

      const history = [
        { role: 'user' as const, content: 'show active users' },
        { role: 'assistant' as const, content: 'Active users listed', sql: "SELECT * FROM users WHERE active = true" },
      ]

      const result = await interpretNlResults(
        'conn-1',
        'and by city?',
        'SELECT city, count(*) FROM users GROUP BY city',
        ['city', 'count'],
        [{ city: 'Paris', count: 10 }],
        1,
        history,
      )

      expect(result.success).toBe(true)
      // Verify the prompt included history
      const stdinWrite = mockSpawn.mock.results[0]?.value?.stdin?.write
      if (stdinWrite) {
        const promptArg = stdinWrite.mock.calls[0]?.[0] as string | undefined
        if (promptArg) {
          expect(promptArg).toContain('CONVERSATION HISTORY')
          expect(promptArg).toContain('User: show active users')
        }
      }
    })
  })

  // =========================================================================
  // Permission edge cases (tested through executeNlQuery)
  // =========================================================================
  describe('permission edge cases', () => {
    beforeEach(() => {
      mockGetDriver.mockReturnValue(mockDriver)
      mockDriver.listSchemas.mockResolvedValue([])
      mockDriver.listTables.mockResolvedValue([])
    })

    it('refuse ALTER si canUpdate=false', async () => {
      mockClaudeResponse({
        sql: 'ALTER TABLE users ADD COLUMN age int',
        explanation: 'Add age column',
      })

      const result = await executeNlQuery('conn-1', 'add age column', READ_ONLY)

      expect(result.success).toBe(false)
      expect(result.error).toContain('ALTER')
    })

    it('refuse CREATE si canUpdate=false', async () => {
      mockClaudeResponse({
        sql: 'CREATE TABLE new_table (id int)',
        explanation: 'Create table',
      })

      const result = await executeNlQuery('conn-1', 'create new table', READ_ONLY)

      expect(result.success).toBe(false)
      expect(result.error).toContain('CREATE')
    })

    it('autorise SELECT avec canRead=true meme si canUpdate et canDelete sont false', async () => {
      mockDriver.executeQuery.mockResolvedValue({
        columns: ['id'],
        rows: [{ id: 1 }],
        rowCount: 1,
        executionTime: 5,
      })

      mockClaudeResponse({
        sql: 'SELECT id FROM users LIMIT 100',
        explanation: 'User ids',
      })

      const result = await executeNlQuery('conn-1', 'list ids', READ_ONLY)

      expect(result.success).toBe(true)
    })

    it('ignore les mots-cles dans les identifiants entre guillemets doubles', async () => {
      mockDriver.executeQuery.mockResolvedValue({
        columns: ['DELETE_FLAG'],
        rows: [{ DELETE_FLAG: true }],
        rowCount: 1,
        executionTime: 5,
      })

      mockClaudeResponse({
        sql: 'SELECT "DELETE_FLAG" FROM users LIMIT 100',
        explanation: 'Delete flags',
      })

      const result = await executeNlQuery('conn-1', 'get delete flags', READ_ONLY)

      // The word DELETE is inside double quotes, so it should be stripped before checking
      expect(result.success).toBe(true)
    })

    it('ignore les mots-cles dans les commentaires bloc', async () => {
      mockDriver.executeQuery.mockResolvedValue({
        columns: ['count'],
        rows: [{ count: 3 }],
        rowCount: 1,
        executionTime: 5,
      })

      mockClaudeResponse({
        sql: '/* TODO: DELETE old records later */\nSELECT count(*) FROM users LIMIT 100',
        explanation: 'Count',
      })

      const result = await executeNlQuery('conn-1', 'count users', READ_ONLY)

      expect(result.success).toBe(true)
    })
  })
})
