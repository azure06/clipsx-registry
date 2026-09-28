import test from 'node:test'
import assert from 'node:assert/strict'
import { importEntry } from './import-release.mjs'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

test('import projects typed technical fields, preserves reviewed copy, and rejects object origins', () => {
  const previous = { categories: ['Productivity'], tags: ['ai'], iconAssets: { light: { sha256: 'reviewed' } } }
  const release = { packageId: 'infiniti.ask-ai', version: '2.0.1', apiVersion: '^3.2', displayName: 'Ask AI', description: 'Open text', license: 'Apache-2.0', releaseUrl: 'https://github.com/azure06/clipsx-extensions/releases/download/ask-ai-v2.0.1/ask-ai-2.0.1.clipsx', sha256: 'a'.repeat(64), archiveSizeBytes: 100, permissionFingerprint: 'b'.repeat(64), permissionReport: { http: [], externalNavigation: [{ origin: 'https://chatgpt.com' }], credentials: [], providers: [] }, portableSettings: [], contributions: ['ask-chatgpt'], httpOrigins: [], externalNavigationOrigins: ['https://chatgpt.com'], credentialLabels: [], providers: [], publishedAt: '2026-09-29T00:00:00Z' }
  const result = importEntry(release, previous)
  assert.deepEqual(result.externalNavigationOrigins, ['https://chatgpt.com'])
  assert.deepEqual(result.categories, previous.categories)
  assert.equal(result.iconAssets, previous.iconAssets)
  assert.throws(() => importEntry({ ...release, externalNavigationOrigins: release.permissionReport.externalNavigation }, previous))
  assert.throws(() => importEntry(release, null))
})

test('replaying the importer preserves an older version\'s reviewed fields and icons', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'metadata-import-test-'))
  mkdirSync(resolve(root, 'packages')); mkdirSync(resolve(root, 'icons'))
  const release = { packageId: 'infiniti.ask-ai', version: '2.0.0', apiVersion: '^3.2', displayName: 'Ask AI', description: 'Open text', license: 'MIT', releaseUrl: 'https://github.com/azure06/clipsx-extensions/releases/download/ask-ai-v2.0.0/ask-ai-2.0.0.clipsx', sha256: 'a'.repeat(64), archiveSizeBytes: 100, permissionFingerprint: 'b'.repeat(64), permissionReport: { http: [], externalNavigation: [], credentials: [], providers: [] }, portableSettings: [], contributions: ['ask-chatgpt'], httpOrigins: [], externalNavigationOrigins: [], credentialLabels: [], providers: [], publishedAt: '2026-09-27T00:00:00Z' }
  const icons = Object.fromEntries(['light', 'dark'].map(theme => [theme, { url: `https://raw.githubusercontent.com/azure06/clipsx-registry/main/icons/ask-ai-2.0.0-${theme}.png`, sha256: 'reviewed' }]))
  const reviewed = { ...release, categories: ['Reviewed'], tags: ['old'], iconAssets: icons, updatedAt: '2026-09-29T00:00:00Z' }
  const file = resolve(root, 'packages/infiniti.ask-ai@2.0.0.json')
  const bytes = Buffer.from(JSON.stringify(reviewed, null, 2) + '\n')
  writeFileSync(file, bytes)
  writeFileSync(resolve(root, 'packages/infiniti.ask-ai@2.0.1.json'), JSON.stringify({ ...reviewed, version: '2.0.1', categories: ['Newer version'] }))
  for (const theme of ['light', 'dark']) writeFileSync(resolve(root, `icons/ask-ai-2.0.0-${theme}.png`), 'reviewed icon')
  const bundle = resolve(root, 'bundle.json')
  writeFileSync(bundle, JSON.stringify({ schemaVersion: 1, sourceRepository: 'azure06/clipsx-extensions', sourceSha: 'a'.repeat(40), prNumber: 10, toolRef: 'b'.repeat(40), entries: [release] }))
  for (let replay = 0; replay < 2; replay++) execFileSync(process.execPath, [resolve('scripts/import-release.mjs'), bundle], { cwd: root })
  assert.equal(readFileSync(file).equals(bytes), true)
  assert.equal(readFileSync(resolve(root, 'icons/ask-ai-2.0.0-light.png'), 'utf8'), 'reviewed icon')
})
