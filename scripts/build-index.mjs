import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const packages = readdirSync(resolve(root, 'packages'), { withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
  .map(entry => JSON.parse(readFileSync(resolve(root, 'packages', entry.name), 'utf8')))
  .sort((left, right) =>
    left.packageId.localeCompare(right.packageId) || left.version.localeCompare(right.version)
  )
const revocations = JSON.parse(readFileSync(resolve(root, 'revocations.json'), 'utf8')).sort(
  (left, right) =>
    left.packageId.localeCompare(right.packageId) ||
    left.version.localeCompare(right.version) ||
    left.sha256.localeCompare(right.sha256)
)

writeFileSync(
  resolve(root, 'index.json'),
  `${JSON.stringify({ schemaVersion: 3, packages, revocations }, null, 2)}\n`
)
