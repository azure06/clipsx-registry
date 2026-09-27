import assert from 'node:assert/strict'
import test from 'node:test'
import { invalidHostStringArray } from './catalog-shape.mjs'

test('host-facing catalog lists contain strings, not permission-report objects', () => {
  const entry = {
    contributions: ['ask-chatgpt'],
    httpOrigins: [],
    externalNavigationOrigins: ['https://chatgpt.com'],
    credentialLabels: [],
    providers: [],
    categories: ['AI'],
    tags: ['assistant'],
  }
  assert.equal(invalidHostStringArray(entry), undefined)
  assert.equal(
    invalidHostStringArray({ ...entry, externalNavigationOrigins: [{ origin: 'https://chatgpt.com' }] }),
    'externalNavigationOrigins'
  )
  assert.equal(invalidHostStringArray({ ...entry, providers: undefined }), 'providers')
})
