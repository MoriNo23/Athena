import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { cierrePrisma } from '../scripts/complete-standalone.mjs'
import { ENTRA } from '../scripts/build-standalone-bundle.mjs'

const RAIZ = join(import.meta.dir, '..')

describe('cierrePrisma: dependencias que necesita el paquete standalone', () => {
  test('trae el CLI de Prisma y su cierre completo del scope @prisma', () => {
    const cierre = cierrePrisma(RAIZ)
    // el CLI y el cliente generado son la razón de ser del cierre
    expect(cierre).toContain('prisma')
    expect(cierre).toContain('@prisma/client')
    expect(cierre).toContain('.prisma/client')
    // el hueco real: sin @prisma/config y @prisma/engines el `db push` del
    // arranque se caía (y @prisma/debug es de quien cuelga engines)
    expect(cierre).toContain('@prisma/config')
    expect(cierre).toContain('@prisma/engines')
    expect(cierre).toContain('@prisma/debug')
  })

  test('cada paquete del cierre existe de verdad en node_modules', () => {
    for (const nombre of cierrePrisma(RAIZ)) {
      expect(existsSync(join(RAIZ, 'node_modules', nombre, 'package.json'))).toBe(true)
    }
  })

  test('es determinista y no arrastra tipos ni devDependencies', () => {
    const cierre = cierrePrisma(RAIZ)
    expect(cierre).toEqual([...cierre].sort())
    expect(cierre.some((n) => n.startsWith('@types/'))).toBe(false)
    expect(cierre).not.toContain('typescript')
  })
})

describe('ENTRA: la lista blanca del artefacto standalone', () => {
  test('lleva lo imprescindible para arrancar con solo Node', () => {
    for (const imprescindible of [
      'server-dist',
      'start.sh',
      'node_modules',
      'dist',
      'prisma',
      'package.json',
      'LICENSE',
      'INICIO.md',
    ]) {
      expect(ENTRA).toContain(imprescindible)
    }
  })

  test('no lleva restos del repo de desarrollo', () => {
    for (const resto of [
      'src',
      'tests',
      'scripts',
      'android',
      'deploy',
      'bin',
      'AGENTS.md',
      'README.md',
      'bun.lock',
      'vite.config.ts',
      'index.html',
      'login.html',
    ]) {
      expect(ENTRA).not.toContain(resto)
    }
  })
})
