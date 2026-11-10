import { describe, expect, test } from 'bun:test'
import { ENTRA } from '../scripts/build-standalone-bundle.mjs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = join(import.meta.dir, '..')

describe('ENTRA: la lista blanca del artefacto standalone', () => {
  test('lleva lo imprescindible para arrancar con solo Node', () => {
    for (const imprescindible of [
      'server-dist',
      'start.sh',
      'dist',
      'public',
      'package.json',
      'LICENSE',
      'INICIO.md',
    ]) {
      expect(ENTRA).toContain(imprescindible)
    }
  })

  test('no arrastra dependencias ni el repo de desarrollo', () => {
    for (const resto of [
      'src',
      'tests',
      'scripts',
      'android',
      'AGENTS.md',
      'README.md',
      'bun.lock',
      'vite.config.ts',
      'index.html',
      'login.html',
      'node_modules',
      'prisma',
    ]) {
      expect(ENTRA).not.toContain(resto)
    }
  })
})

describe('start.sh del standalone: arranque sin pasos técnicos', () => {
  test('arranca node server-dist/server.cjs y no toca esquemas ni clientes', () => {
    // el texto vive dentro de scripts/complete-standalone.mjs
    const fuente = readFileSync(join(RAIZ, 'scripts', 'complete-standalone.mjs'), 'utf8')
    expect(fuente).toContain('exec env ATHENA_MODO=')
    expect(fuente).toContain('node server-dist/server.cjs')
    expect(fuente).not.toContain('prisma')
    expect(fuente).not.toContain('db push')
    expect(fuente).not.toContain('migrate')
  })
})
