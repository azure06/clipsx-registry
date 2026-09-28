import test from 'node:test'
import assert from 'node:assert/strict'
import { importEntry } from './import-release.mjs'

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
