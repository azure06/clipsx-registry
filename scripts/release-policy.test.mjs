import assert from 'node:assert/strict'
import test from 'node:test'
import { expectedRelease, validatePublishedRelease } from './release-policy.mjs'

const packageEntry = {
  packageId: 'infiniti.base64',
  version: '1.8.5',
  releaseUrl:
    'https://github.com/azure06/clipsx-extensions/releases/download/base64-v1.8.5/base64-1.8.5.clipsx',
  sha256: 'a'.repeat(64),
  archiveSizeBytes: 42,
}
const release = {
  tag_name: 'base64-v1.8.5',
  draft: false,
  prerelease: false,
  immutable: false,
  assets: [
    {
      name: 'base64-1.8.5.clipsx',
      state: 'uploaded',
      browser_download_url: packageEntry.releaseUrl,
      size: 42,
      digest: `sha256:${packageEntry.sha256}`,
    },
  ],
}

test('derives the only accepted release tag, asset, and URL', () => {
  assert.deepEqual(expectedRelease(packageEntry), {
    tag: 'base64-v1.8.5',
    asset: 'base64-1.8.5.clipsx',
    url: packageEntry.releaseUrl,
  })
})

test('requires immutable releases', () => {
  assert.throws(() => validatePublishedRelease(packageEntry, release), /not immutable/)
  assert.doesNotThrow(() => validatePublishedRelease(packageEntry, { ...release, immutable: true }))
})

test('rejects altered repository, tag, asset, size, and digest metadata', () => {
  assert.throws(
    () => validatePublishedRelease({ ...packageEntry, releaseUrl: 'https://example.com/package' }, release),
    /unexpected release URL/
  )
  assert.throws(
    () => validatePublishedRelease(packageEntry, { ...release, tag_name: 'other-v1.8.5' }),
    /expected tag/
  )
  assert.throws(
    () => validatePublishedRelease(packageEntry, { ...release, assets: [] }),
    /asset metadata/
  )
})
