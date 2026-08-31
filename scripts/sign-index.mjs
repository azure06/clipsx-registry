import { createPrivateKey, sign } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const keyId = process.env.CLIPSX_REGISTRY_KEY_ID
const privateKeyPem = process.env.CLIPSX_REGISTRY_SIGNING_KEY_PEM
if (!keyId || !privateKeyPem) throw new Error('Registry signing key ID and private key are required')

const index = readFileSync(resolve(root, 'index.json'))
const signature = sign(null, index, createPrivateKey(privateKeyPem)).toString('base64')
writeFileSync(
  resolve(root, 'index.signatures.json'),
  `${JSON.stringify(
    {
      schemaVersion: 1,
      signatures: [{ keyId, algorithm: 'ed25519', signature }],
    },
    null,
    2
  )}\n`
)
