import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock all native database modules
vi.mock('pg', () => ({ Pool: vi.fn() }))
vi.mock('mysql2/promise', () => ({ default: { createPool: vi.fn() }, createPool: vi.fn() }))
vi.mock('mssql', () => ({ default: { ConnectionPool: vi.fn(), NVarChar: 'nvarchar' }, ConnectionPool: vi.fn(), NVarChar: 'nvarchar' }))
vi.mock('mongodb', () => ({ MongoClient: vi.fn() }))
vi.mock('better-sqlite3', () => ({ default: vi.fn() }))

// Create mock drivers via vi.hoisted so they are available in vi.mock factories
const {
  mockPostgresqlDriver,
  mockMysqlDriver,
  mockMssqlDriver,
  mockMongodbDriver,
  mockSqliteDriver,
} = vi.hoisted(() => {
  function createMockDriver(engine: string) {
    return {
      engine,
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      isConnected: vi.fn().mockReturnValue(true),
      listDatabases: vi.fn().mockResolvedValue([]),
      listSchemas: vi.fn().mockResolvedValue([]),
      listTables: vi.fn().mockResolvedValue([]),
      getTableInfo: vi.fn().mockResolvedValue({ columns: [], indexes: [], rowCount: 0 }),
      executeQuery: vi.fn().mockResolvedValue({ columns: [], rows: [], rowCount: 0, executionTime: 0 }),
      cancelQuery: vi.fn(),
      getDefaultPort: vi.fn().mockReturnValue(5432),
      parseConnectionString: vi.fn().mockReturnValue({}),
    }
  }

  return {
    mockPostgresqlDriver: createMockDriver('postgresql'),
    mockMysqlDriver: createMockDriver('mysql'),
    mockMssqlDriver: createMockDriver('mssql'),
    mockMongodbDriver: createMockDriver('mongodb'),
    mockSqliteDriver: createMockDriver('sqlite'),
  }
})

// Use arrow functions in the factory that always return the hoisted mock drivers.
// This way, even after clearAllMocks, the constructor still works because
// the factory function itself is not a mock - only the returned object methods are.
vi.mock('../../src/main/services/database/drivers/postgresql', () => ({
  PostgresqlDriver: function() { return mockPostgresqlDriver },
}))

vi.mock('../../src/main/services/database/drivers/mysql', () => ({
  MysqlDriver: function() { return mockMysqlDriver },
}))

vi.mock('../../src/main/services/database/drivers/mssql', () => ({
  MssqlDriver: function() { return mockMssqlDriver },
}))

vi.mock('../../src/main/services/database/drivers/mongodb', () => ({
  MongodbDriver: function() { return mockMongodbDriver },
}))

vi.mock('../../src/main/services/database/drivers/sqlite', () => ({
  SqliteDriver: function() { return mockSqliteDriver },
}))

import { DatabaseService } from '../../src/main/services/database'
import type { DbConnectionConfig } from '../../src/shared/types'

describe('DatabaseService', () => {
  let service: DatabaseService

  beforeEach(() => {
    // Reset only mock call history, keep implementations
    mockPostgresqlDriver.connect.mockClear().mockResolvedValue(undefined)
    mockPostgresqlDriver.disconnect.mockClear().mockResolvedValue(undefined)
    mockPostgresqlDriver.isConnected.mockClear().mockReturnValue(true)
    mockMysqlDriver.connect.mockClear().mockResolvedValue(undefined)
    mockMysqlDriver.disconnect.mockClear().mockResolvedValue(undefined)
    mockMysqlDriver.isConnected.mockClear().mockReturnValue(true)
    mockMssqlDriver.connect.mockClear().mockResolvedValue(undefined)
    mockMssqlDriver.disconnect.mockClear().mockResolvedValue(undefined)
    mockMssqlDriver.isConnected.mockClear().mockReturnValue(true)
    mockMongodbDriver.connect.mockClear().mockResolvedValue(undefined)
    mockMongodbDriver.disconnect.mockClear().mockResolvedValue(undefined)
    mockMongodbDriver.isConnected.mockClear().mockReturnValue(true)
    mockSqliteDriver.connect.mockClear().mockResolvedValue(undefined)
    mockSqliteDriver.disconnect.mockClear().mockResolvedValue(undefined)
    mockSqliteDriver.isConnected.mockClear().mockReturnValue(true)

    service = new DatabaseService()
  })

  describe('createDriver', () => {
    it('cree un driver PostgreSQL', async () => {
      const driver = await service.createDriver('postgresql')

      expect(driver).toBeDefined()
      expect(driver.engine).toBe('postgresql')
    })

    it('cree un driver MySQL', async () => {
      const driver = await service.createDriver('mysql')

      expect(driver).toBeDefined()
      expect(driver.engine).toBe('mysql')
    })

    it('cree un driver MSSQL', async () => {
      const driver = await service.createDriver('mssql')

      expect(driver).toBeDefined()
      expect(driver.engine).toBe('mssql')
    })

    it('cree un driver MongoDB', async () => {
      const driver = await service.createDriver('mongodb')

      expect(driver).toBeDefined()
      expect(driver.engine).toBe('mongodb')
    })

    it('cree un driver SQLite', async () => {
      const driver = await service.createDriver('sqlite')

      expect(driver).toBeDefined()
      expect(driver.engine).toBe('sqlite')
    })

    it('lance une erreur pour un engine inconnu', async () => {
      await expect(
        service.createDriver('oracle' as never),
      ).rejects.toThrow('Unsupported database engine')
    })
  })

  describe('connect', () => {
    it('connecte avec un driver et le stocke', async () => {
      const config: DbConnectionConfig = {
        engine: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
      }

      await service.connect('conn-1', config)

      expect(mockPostgresqlDriver.connect).toHaveBeenCalledWith(config)
      expect(service.getDriver('conn-1')).toBeDefined()
    })

    it('deconnecte une connexion existante avant de reconnecter', async () => {
      const config: DbConnectionConfig = {
        engine: 'postgresql',
        host: 'localhost',
        database: 'testdb',
      }

      // First connection
      await service.connect('conn-1', config)

      // Reset the isConnected mock for second call
      mockPostgresqlDriver.isConnected.mockReturnValue(true)

      // Second connection with same ID
      await service.connect('conn-1', config)

      // disconnect should have been called for the existing connection
      expect(mockPostgresqlDriver.disconnect).toHaveBeenCalled()
    })

    it('ne deconnecte pas si la connexion existante est deja deconnectee', async () => {
      const config: DbConnectionConfig = {
        engine: 'postgresql',
        host: 'localhost',
        database: 'testdb',
      }

      await service.connect('conn-1', config)
      mockPostgresqlDriver.isConnected.mockReturnValue(false)
      mockPostgresqlDriver.disconnect.mockClear()

      await service.connect('conn-1', config)

      // disconnect should NOT have been called since isConnected returned false
      expect(mockPostgresqlDriver.disconnect).not.toHaveBeenCalled()
    })
  })

  describe('disconnect', () => {
    it('deconnecte et supprime une connexion existante', async () => {
      const config: DbConnectionConfig = {
        engine: 'postgresql',
        host: 'localhost',
        database: 'testdb',
      }

      await service.connect('conn-1', config)
      mockPostgresqlDriver.disconnect.mockClear()

      await service.disconnect('conn-1')

      expect(mockPostgresqlDriver.disconnect).toHaveBeenCalled()
      expect(service.getDriver('conn-1')).toBeUndefined()
    })

    it('ne fait rien pour une connexion inexistante', async () => {
      // Should not throw
      await expect(service.disconnect('inexistant')).resolves.not.toThrow()
    })
  })

  describe('getDriver', () => {
    it('retourne le driver pour une connexion active', async () => {
      const config: DbConnectionConfig = {
        engine: 'mysql',
        host: 'localhost',
        database: 'testdb',
      }

      await service.connect('conn-mysql', config)
      const driver = service.getDriver('conn-mysql')

      expect(driver).toBeDefined()
    })

    it('retourne undefined pour une connexion inexistante', () => {
      const driver = service.getDriver('conn-fantome')

      expect(driver).toBeUndefined()
    })

    it('retourne undefined apres deconnexion', async () => {
      const config: DbConnectionConfig = {
        engine: 'postgresql',
        host: 'localhost',
        database: 'testdb',
      }

      await service.connect('conn-1', config)
      await service.disconnect('conn-1')

      expect(service.getDriver('conn-1')).toBeUndefined()
    })
  })

  describe('disconnectAll', () => {
    it('deconnecte toutes les connexions actives', async () => {
      const pgConfig: DbConnectionConfig = {
        engine: 'postgresql',
        host: 'localhost',
        database: 'db1',
      }
      const mysqlConfig: DbConnectionConfig = {
        engine: 'mysql',
        host: 'localhost',
        database: 'db2',
      }

      await service.connect('conn-pg', pgConfig)
      await service.connect('conn-mysql', mysqlConfig)

      // Clear previous disconnect calls from connect setup
      mockPostgresqlDriver.disconnect.mockClear()
      mockMysqlDriver.disconnect.mockClear()

      await service.disconnectAll()

      expect(mockPostgresqlDriver.disconnect).toHaveBeenCalled()
      expect(mockMysqlDriver.disconnect).toHaveBeenCalled()
      expect(service.getDriver('conn-pg')).toBeUndefined()
      expect(service.getDriver('conn-mysql')).toBeUndefined()
    })

    it('ne lance pas d erreur quand aucune connexion n est active', async () => {
      await expect(service.disconnectAll()).resolves.not.toThrow()
    })

    it('gere les erreurs de deconnexion individuelles sans bloquer', async () => {
      const config: DbConnectionConfig = {
        engine: 'postgresql',
        host: 'localhost',
        database: 'db1',
      }

      await service.connect('conn-1', config)
      mockPostgresqlDriver.disconnect.mockClear()
      mockPostgresqlDriver.disconnect.mockRejectedValueOnce(new Error('Erreur de deconnexion'))

      // disconnectAll uses Promise.allSettled, so it should not throw
      await expect(service.disconnectAll()).resolves.not.toThrow()

      // All connections should be cleared even if some failed
      expect(service.getDriver('conn-1')).toBeUndefined()
    })
  })

  describe('gestion de connexions multiples', () => {
    it('gere plusieurs connexions independantes', async () => {
      const config1: DbConnectionConfig = {
        engine: 'postgresql',
        host: 'host1',
        database: 'db1',
      }
      const config2: DbConnectionConfig = {
        engine: 'mysql',
        host: 'host2',
        database: 'db2',
      }
      const config3: DbConnectionConfig = {
        engine: 'mssql',
        host: 'host3',
        database: 'db3',
      }

      await service.connect('conn-1', config1)
      await service.connect('conn-2', config2)
      await service.connect('conn-3', config3)

      expect(service.getDriver('conn-1')).toBeDefined()
      expect(service.getDriver('conn-2')).toBeDefined()
      expect(service.getDriver('conn-3')).toBeDefined()
    })

    it('deconnecter une connexion ne touche pas les autres', async () => {
      const config1: DbConnectionConfig = {
        engine: 'postgresql',
        host: 'host1',
        database: 'db1',
      }
      const config2: DbConnectionConfig = {
        engine: 'mysql',
        host: 'host2',
        database: 'db2',
      }

      await service.connect('conn-1', config1)
      await service.connect('conn-2', config2)

      await service.disconnect('conn-1')

      expect(service.getDriver('conn-1')).toBeUndefined()
      expect(service.getDriver('conn-2')).toBeDefined()
    })
  })
})
