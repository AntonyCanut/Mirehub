import { describe, it, expect } from 'vitest'

describe('Native Modules Loading (pre-upgrade baseline)', () => {
  it('better-sqlite3 peut etre importe', async () => {
    const mod = await import('better-sqlite3')
    expect(mod).toBeDefined()
    expect(mod.default || mod).toBeDefined()
  })

  it('better-sqlite3 expose un constructeur Database', async () => {
    // The native binary is compiled for Electron's Node.js, not the system one,
    // so we verify the module structure rather than instantiating a database.
    const mod = await import('better-sqlite3')
    const Database = mod.default || mod
    expect(typeof Database).toBe('function')
  })

  it('node-pty peut etre importe', async () => {
    const mod = await import('node-pty')
    expect(mod).toBeDefined()
    expect(mod.spawn).toBeDefined()
  })

  it('node-pty expose la fonction spawn', async () => {
    const { spawn } = await import('node-pty')
    expect(typeof spawn).toBe('function')
  })
})
