import { createPublicKey, verify } from 'node:crypto'

export function hasTrustedSignature(bytes, envelope, keys) {
  if (envelope?.schemaVersion !== 1 || !Array.isArray(envelope.signatures)) return false
  return envelope.signatures.some(signature => {
    try {
      const key = keys.find(candidate => candidate.keyId === signature.keyId)
      if (!key || key.algorithm !== 'ed25519' || signature.algorithm !== 'ed25519') return false
      const raw = Buffer.from(key.publicKeyBase64, 'base64')
      if (raw.length !== 32) return false
      const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), raw])
      return verify(null, bytes, createPublicKey({ key: spki, format: 'der', type: 'spki' }), Buffer.from(signature.signature, 'base64'))
    } catch { return false }
  })
}
