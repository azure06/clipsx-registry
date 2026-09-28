import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import { hasTrustedSignature } from './catalog-signature.mjs'

test('exact catalog bytes need a reviewed key; malformed and wrong-key signatures fail', () => {
  const pair = generateKeyPairSync('ed25519'), other = generateKeyPairSync('ed25519')
  const bytes = Buffer.from('approved catalog')
  const keys = [{ keyId: 'test', algorithm: 'ed25519', publicKeyBase64: pair.publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('base64') }]
  const envelope = key => ({ schemaVersion: 1, signatures: [{ keyId: 'test', algorithm: 'ed25519', signature: sign(null, bytes, key).toString('base64') }] })
  assert.equal(hasTrustedSignature(bytes, envelope(pair.privateKey), keys), true)
  assert.equal(hasTrustedSignature(Buffer.from('changed'), envelope(pair.privateKey), keys), false)
  assert.equal(hasTrustedSignature(bytes, envelope(other.privateKey), keys), false)
  assert.equal(hasTrustedSignature(bytes, { schemaVersion: 1, signatures: [null] }, keys), false)
  assert.equal(hasTrustedSignature(bytes, { schemaVersion: 1, signatures: [] }, keys), false)
})
