import { describe, it, expect, vi } from 'vitest'

// Mock all native database modules to prevent import failures
vi.mock('pg', () => ({
  Pool: vi.fn(),
}))

vi.mock('mysql2/promise', () => ({
  default: { createPool: vi.fn() },
  createPool: vi.fn(),
}))

vi.mock('mssql', () => ({
  default: {
    ConnectionPool: vi.fn(),
    NVarChar: 'nvarchar',
  },
  ConnectionPool: vi.fn(),
  NVarChar: 'nvarchar',
}))

vi.mock('mongodb', () => ({
  MongoClient: vi.fn(),
}))

vi.mock('better-sqlite3', () => ({
  default: vi.fn(),
}))

import { PostgresqlDriver } from '../../src/main/services/database/drivers/postgresql'
import { MysqlDriver } from '../../src/main/services/database/drivers/mysql'
import { MssqlDriver } from '../../src/main/services/database/drivers/mssql'
import { MongodbDriver } from '../../src/main/services/database/drivers/mongodb'
import { SqliteDriver } from '../../src/main/services/database/drivers/sqlite'

describe('Database Drivers - parseConnectionString et getDefaultPort', () => {
  // ---------- PostgreSQL ----------
  describe('PostgresqlDriver', () => {
    const driver = new PostgresqlDriver()

    describe('getDefaultPort', () => {
      it('retourne 5432 comme port par defaut', () => {
        expect(driver.getDefaultPort()).toBe(5432)
      })
    })

    describe('parseConnectionString', () => {
      it('parse une URI PostgreSQL complete', () => {
        const result = driver.parseConnectionString(
          'postgresql://admin:secret@db.example.com:5433/mydb?sslmode=require',
        )

        expect(result).toEqual({
          engine: 'postgresql',
          host: 'db.example.com',
          port: 5433,
          username: 'admin',
          password: 'secret',
          database: 'mydb',
          ssl: true,
        })
      })

      it('parse une URI avec les valeurs par defaut', () => {
        const result = driver.parseConnectionString('postgresql://localhost/testdb')

        expect(result.engine).toBe('postgresql')
        expect(result.host).toBe('localhost')
        expect(result.port).toBe(5432)
        expect(result.database).toBe('testdb')
        expect(result.username).toBeUndefined()
        expect(result.password).toBeUndefined()
        expect(result.ssl).toBe(false)
      })

      it('parse une URI minimale sans base de donnees', () => {
        const result = driver.parseConnectionString('postgresql://localhost')

        expect(result.engine).toBe('postgresql')
        expect(result.host).toBe('localhost')
        expect(result.database).toBeUndefined()
      })

      it('decode le mot de passe encode en URL', () => {
        const result = driver.parseConnectionString(
          'postgresql://user:p%40ss%23word@localhost/db',
        )

        expect(result.password).toBe('p@ss#word')
      })

      it('gere le schema postgres:// comme alias', () => {
        const result = driver.parseConnectionString(
          'postgres://user:pass@host:5432/db',
        )

        expect(result.engine).toBe('postgresql')
        expect(result.host).toBe('host')
        expect(result.username).toBe('user')
        expect(result.password).toBe('pass')
        expect(result.database).toBe('db')
      })

      it('gere sslmode absent (pas de ssl)', () => {
        const result = driver.parseConnectionString(
          'postgresql://localhost/db',
        )

        expect(result.ssl).toBe(false)
      })

      it('retourne un objet minimal pour une URI invalide', () => {
        const result = driver.parseConnectionString('not-a-valid-uri')

        expect(result).toEqual({ engine: 'postgresql' })
      })
    })
  })

  // ---------- MySQL ----------
  describe('MysqlDriver', () => {
    const driver = new MysqlDriver()

    describe('getDefaultPort', () => {
      it('retourne 3306 comme port par defaut', () => {
        expect(driver.getDefaultPort()).toBe(3306)
      })
    })

    describe('parseConnectionString', () => {
      it('parse une URI MySQL complete', () => {
        const result = driver.parseConnectionString(
          'mysql://root:password@mysql.example.com:3307/appdb?ssl=true',
        )

        expect(result).toEqual({
          engine: 'mysql',
          host: 'mysql.example.com',
          port: 3307,
          username: 'root',
          password: 'password',
          database: 'appdb',
          ssl: true,
        })
      })

      it('parse une URI avec les valeurs par defaut', () => {
        const result = driver.parseConnectionString('mysql://localhost/testdb')

        expect(result.engine).toBe('mysql')
        expect(result.host).toBe('localhost')
        expect(result.port).toBe(3306)
        expect(result.database).toBe('testdb')
        expect(result.ssl).toBe(false)
      })

      it('gere ssl absent (pas de ssl)', () => {
        const result = driver.parseConnectionString('mysql://localhost/db')

        expect(result.ssl).toBe(false)
      })

      it('decode le mot de passe encode en URL', () => {
        const result = driver.parseConnectionString(
          'mysql://user:mot%20de%20passe@localhost/db',
        )

        expect(result.password).toBe('mot de passe')
      })

      it('retourne un objet minimal pour une URI invalide', () => {
        const result = driver.parseConnectionString('invalid')

        expect(result).toEqual({ engine: 'mysql' })
      })

      it('gere une URI sans base de donnees', () => {
        const result = driver.parseConnectionString('mysql://user:pass@host:3306')

        expect(result.engine).toBe('mysql')
        expect(result.host).toBe('host')
        expect(result.port).toBe(3306)
        expect(result.database).toBeUndefined()
      })
    })
  })

  // ---------- MSSQL ----------
  describe('MssqlDriver', () => {
    const driver = new MssqlDriver()

    describe('getDefaultPort', () => {
      it('retourne 1433 comme port par defaut', () => {
        expect(driver.getDefaultPort()).toBe(1433)
      })
    })

    describe('parseConnectionString', () => {
      it('parse une URI MSSQL complete', () => {
        const result = driver.parseConnectionString(
          'mssql://sa:P%40ssword@sql-server.local:1434/master?encrypt=true',
        )

        expect(result).toEqual({
          engine: 'mssql',
          host: 'sql-server.local',
          port: 1434,
          username: 'sa',
          password: 'P@ssword',
          database: 'master',
          ssl: true,
        })
      })

      it('parse une URI avec les valeurs par defaut', () => {
        const result = driver.parseConnectionString('mssql://localhost/mydb')

        expect(result.engine).toBe('mssql')
        expect(result.host).toBe('localhost')
        expect(result.port).toBe(1433)
        expect(result.database).toBe('mydb')
        expect(result.ssl).toBe(false)
      })

      it('parse le format chaine de connexion ADO.NET', () => {
        const result = driver.parseConnectionString(
          'Server=myserver;Database=mydb;User Id=admin;Password=secret',
        )

        expect(result.engine).toBe('mssql')
        expect(result.host).toBe('myserver')
        expect(result.database).toBe('mydb')
        expect(result.username).toBe('admin')
        expect(result.password).toBe('secret')
      })

      it('parse le format ADO.NET avec Data Source et Initial Catalog', () => {
        const result = driver.parseConnectionString(
          'Data Source=server.local;Initial Catalog=proddb;uid=user1;pwd=pass1',
        )

        expect(result.engine).toBe('mssql')
        expect(result.host).toBe('server.local')
        expect(result.database).toBe('proddb')
        expect(result.username).toBe('user1')
        expect(result.password).toBe('pass1')
      })

      it('gere un mot de passe contenant un signe egal dans le format ADO.NET', () => {
        const result = driver.parseConnectionString(
          'Server=host;Database=db;User Id=user;Password=pass=word=123',
        )

        expect(result.password).toBe('pass=word=123')
      })

      it('retourne un objet minimal pour une URI et une chaine ADO.NET invalides', () => {
        // A string that is not a valid URL and not a valid key=value pair
        const result = driver.parseConnectionString('')

        expect(result.engine).toBe('mssql')
      })
    })
  })

  // ---------- MongoDB ----------
  describe('MongodbDriver', () => {
    const driver = new MongodbDriver()

    describe('getDefaultPort', () => {
      it('retourne 27017 comme port par defaut', () => {
        expect(driver.getDefaultPort()).toBe(27017)
      })
    })

    describe('parseConnectionString', () => {
      it('parse une URI MongoDB complete', () => {
        const result = driver.parseConnectionString(
          'mongodb://admin:pass123@mongo.example.com:27018/appdb?tls=true',
        )

        expect(result).toMatchObject({
          engine: 'mongodb',
          host: 'mongo.example.com',
          port: 27018,
          username: 'admin',
          password: 'pass123',
          database: 'appdb',
          ssl: true,
        })
        expect(result.connectionString).toBe(
          'mongodb://admin:pass123@mongo.example.com:27018/appdb?tls=true',
        )
      })

      it('parse une URI avec les valeurs par defaut', () => {
        const result = driver.parseConnectionString('mongodb://localhost/testdb')

        expect(result.engine).toBe('mongodb')
        expect(result.host).toBe('localhost')
        expect(result.port).toBe(27017)
        expect(result.database).toBe('testdb')
        expect(result.ssl).toBe(false)
      })

      it('gere le parametre ssl=true', () => {
        const result = driver.parseConnectionString(
          'mongodb://localhost/db?ssl=true',
        )

        expect(result.ssl).toBe(true)
      })

      it('gere le parametre tls=true', () => {
        const result = driver.parseConnectionString(
          'mongodb://localhost/db?tls=true',
        )

        expect(result.ssl).toBe(true)
      })

      it('conserve la connectionString originale', () => {
        const uri = 'mongodb://localhost:27017/mydb'
        const result = driver.parseConnectionString(uri)

        expect(result.connectionString).toBe(uri)
      })

      it('decode le mot de passe encode en URL', () => {
        const result = driver.parseConnectionString(
          'mongodb://user:p%40ss%23@localhost/db',
        )

        expect(result.password).toBe('p@ss#')
      })

      it('retourne un objet minimal avec la connectionString pour une URI invalide', () => {
        const result = driver.parseConnectionString('not-valid')

        expect(result.engine).toBe('mongodb')
        expect(result.connectionString).toBe('not-valid')
      })

      it('gere une URI sans base de donnees', () => {
        const result = driver.parseConnectionString('mongodb://localhost:27017')

        expect(result.engine).toBe('mongodb')
        expect(result.database).toBeUndefined()
      })
    })
  })

  // ---------- SQLite ----------
  describe('SqliteDriver', () => {
    const driver = new SqliteDriver()

    describe('getDefaultPort', () => {
      it('retourne 0 comme port par defaut (pas de port pour SQLite)', () => {
        expect(driver.getDefaultPort()).toBe(0)
      })
    })

    describe('parseConnectionString', () => {
      it('parse un chemin de fichier brut', () => {
        const result = driver.parseConnectionString('/path/to/database.db')

        expect(result).toEqual({
          engine: 'sqlite',
          filePath: '/path/to/database.db',
          database: 'database.db',
        })
      })

      it('parse une URI avec le prefixe sqlite://', () => {
        const result = driver.parseConnectionString('sqlite:///data/app.sqlite3')

        expect(result.engine).toBe('sqlite')
        expect(result.filePath).toBe('/data/app.sqlite3')
        expect(result.database).toBe('app.sqlite3')
      })

      it('parse une URI avec le prefixe file://', () => {
        const result = driver.parseConnectionString('file:///tmp/test.db')

        expect(result.engine).toBe('sqlite')
        expect(result.filePath).toBe('/tmp/test.db')
        expect(result.database).toBe('test.db')
      })

      it('supprime les parametres de requete', () => {
        const result = driver.parseConnectionString('/data/app.db?mode=ro')

        expect(result.filePath).toBe('/data/app.db')
        expect(result.database).toBe('app.db')
      })

      it('supprime les parametres de requete avec le prefixe sqlite://', () => {
        const result = driver.parseConnectionString('sqlite:///data/app.db?mode=rw&cache=shared')

        expect(result.filePath).toBe('/data/app.db')
      })

      it('gere un chemin relatif', () => {
        const result = driver.parseConnectionString('data/local.db')

        expect(result.engine).toBe('sqlite')
        expect(result.filePath).toBe('data/local.db')
        expect(result.database).toBe('local.db')
      })

      it('gere un nom de fichier seul', () => {
        const result = driver.parseConnectionString('test.db')

        expect(result.engine).toBe('sqlite')
        expect(result.filePath).toBe('test.db')
        expect(result.database).toBe('test.db')
      })
    })
  })

  // ---------- Verification croisee des engines ----------
  describe('Verification croisee des engines', () => {
    it('chaque driver declare le bon engine', () => {
      expect(new PostgresqlDriver().engine).toBe('postgresql')
      expect(new MysqlDriver().engine).toBe('mysql')
      expect(new MssqlDriver().engine).toBe('mssql')
      expect(new MongodbDriver().engine).toBe('mongodb')
      expect(new SqliteDriver().engine).toBe('sqlite')
    })

    it('parseConnectionString retourne toujours le bon engine', () => {
      expect(new PostgresqlDriver().parseConnectionString('postgresql://localhost').engine).toBe('postgresql')
      expect(new MysqlDriver().parseConnectionString('mysql://localhost').engine).toBe('mysql')
      expect(new MssqlDriver().parseConnectionString('mssql://localhost').engine).toBe('mssql')
      expect(new MongodbDriver().parseConnectionString('mongodb://localhost').engine).toBe('mongodb')
      expect(new SqliteDriver().parseConnectionString('/tmp/test.db').engine).toBe('sqlite')
    })

    it('les ports par defaut sont differents pour chaque driver (sauf SQLite)', () => {
      const ports = [
        new PostgresqlDriver().getDefaultPort(),
        new MysqlDriver().getDefaultPort(),
        new MssqlDriver().getDefaultPort(),
        new MongodbDriver().getDefaultPort(),
      ]

      const uniquePorts = new Set(ports)
      expect(uniquePorts.size).toBe(ports.length)
    })
  })
})
