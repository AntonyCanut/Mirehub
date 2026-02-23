import { DbDriver } from './drivers/base'
import { DbConnectionConfig, DbEngine } from '../../../shared/types'

/**
 * DatabaseService manages active database connections.
 * Drivers are loaded lazily to avoid crashing if a native module
 * (e.g. better-sqlite3) fails to load for the current Electron version.
 */
export class DatabaseService {
  private connections: Map<string, DbDriver> = new Map()

  /**
   * Create a new driver instance for the given engine.
   * Uses dynamic require() so that each driver module is only loaded
   * when actually needed — prevents a single broken native dep from
   * taking down all handlers.
   */
  async createDriver(engine: DbEngine): Promise<DbDriver> {
    switch (engine) {
      case 'postgresql': {
        const { PostgresqlDriver } = await import('./drivers/postgresql')
        return new PostgresqlDriver()
      }
      case 'mysql': {
        const { MysqlDriver } = await import('./drivers/mysql')
        return new MysqlDriver()
      }
      case 'mssql': {
        const { MssqlDriver } = await import('./drivers/mssql')
        return new MssqlDriver()
      }
      case 'mongodb': {
        const { MongodbDriver } = await import('./drivers/mongodb')
        return new MongodbDriver()
      }
      case 'sqlite': {
        const { SqliteDriver } = await import('./drivers/sqlite')
        return new SqliteDriver()
      }
      default: {
        const _exhaustive: never = engine
        throw new Error(`Unsupported database engine: ${_exhaustive}`)
      }
    }
  }

  /**
   * Connect to a database. If a connection with the same id already exists,
   * disconnect it first before creating a new one.
   */
  async connect(connectionId: string, config: DbConnectionConfig): Promise<void> {
    const existing = this.connections.get(connectionId)
    if (existing?.isConnected()) {
      await existing.disconnect()
    }
    const driver = await this.createDriver(config.engine)
    await driver.connect(config)
    this.connections.set(connectionId, driver)
  }

  /**
   * Disconnect a specific connection and remove it from the map.
   */
  async disconnect(connectionId: string): Promise<void> {
    const driver = this.connections.get(connectionId)
    if (driver) {
      await driver.disconnect()
      this.connections.delete(connectionId)
    }
  }

  /**
   * Get the driver for an active connection.
   */
  getDriver(connectionId: string): DbDriver | undefined {
    return this.connections.get(connectionId)
  }

  /**
   * Disconnect all active connections.
   */
  async disconnectAll(): Promise<void> {
    const disconnectPromises: Promise<void>[] = []
    for (const [, driver] of this.connections) {
      disconnectPromises.push(driver.disconnect())
    }
    await Promise.allSettled(disconnectPromises)
    this.connections.clear()
  }
}

/** Singleton instance used by IPC handlers. */
export const databaseService = new DatabaseService()
