import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const compare = (left, right) => (left < right ? -1 : left > right ? 1 : 0)
const packages = readdirSync(resolve(root, 'packages'), { withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
  .map(entry => JSON.parse(readFileSync(resolve(root, 'packages', entry.name), 'utf8')))
  .sort((left, right) => compare(left.packageId, right.packageId) || compare(left.version, right.version))
const revocations = JSON.parse(readFileSync(resolve(root, 'revocations.json'), 'utf8')).sort(
  (left, right) =>
    compare(left.packageId, right.packageId) ||
    compare(left.version, right.version) ||
    compare(left.sha256, right.sha256)
)

writeFileSync(
  resolve(root, 'index.json'),
  `${JSON.stringify({ schemaVersion: 3, packages, revocations }, null, 2)}\n`
)
