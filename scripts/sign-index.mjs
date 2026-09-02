import { createPrivateKey, sign } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const index = readFileSync(resolve(root, 'index.json'))
const keyPairs = [
  [process.env.CLIPSX_REGISTRY_KEY_ID, process.env.CLIPSX_REGISTRY_SIGNING_KEY_PEM],
  [
    process.env.CLIPSX_REGISTRY_SECONDARY_KEY_ID,
    process.env.CLIPSX_REGISTRY_SECONDARY_SIGNING_KEY_PEM,
  ],
]

if (!keyPairs[0][0] || !keyPairs[0][1]) {
  throw new Error('Registry signing key ID and private key are required')
}
if (Boolean(keyPairs[1][0]) !== Boolean(keyPairs[1][1])) {
  throw new Error('Secondary registry key ID and private key must be configured together')
}

const signatures = keyPairs
  .filter(([keyId, privateKeyPem]) => keyId && privateKeyPem)
  .map(([keyId, privateKeyPem]) => ({
    keyId,
    algorithm: 'ed25519',
    signature: sign(null, index, createPrivateKey(privateKeyPem)).toString('base64'),
  }))
  .sort((left, right) => left.keyId.localeCompare(right.keyId))
writeFileSync(
  resolve(root, 'index.signatures.json'),
  `${JSON.stringify(
    {
      schemaVersion: 1,
      signatures,
    },
    null,
    2
  )}\n`
)
