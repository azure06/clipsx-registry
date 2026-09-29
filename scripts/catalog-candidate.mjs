import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

export const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0
export function indexBytes(root) {
  const packages = readdirSync(resolve(root, 'packages')).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(resolve(root, 'packages', f))))
  if (!packages.length) throw Error('Cannot publish an empty registry')
  packages.sort((a, b) => compare(a.packageId, b.packageId) || compare(a.version, b.version))
  const revocations = JSON.parse(readFileSync(resolve(root, 'revocations.json'))).sort((a, b) => compare(a.packageId, b.packageId) || compare(a.version, b.version) || compare(a.sha256, b.sha256))
  return Buffer.from(JSON.stringify({ schemaVersion: 4, packages, revocations }, null, 2) + '\n')
}

export function assertCurrentHead(pr, expectedSha, repository) {
  if (pr.state !== 'open' || pr.base.ref !== 'main' || pr.head.ref === 'main' || pr.head.repo?.full_name !== repository || pr.head.sha !== expectedSha) throw Error('Candidate is stale or not an open same-repository main PR')
}

export function verifySigningEvidence(evidence, run, bytes, toolRef, repository) {
  if (evidence.schemaVersion !== 1 || evidence.repository !== repository || evidence.runId !== run.id || evidence.trustedRef !== run.head_sha || run.path !== '.github/workflows/prepare.yml' || run.head_repository?.full_name !== repository || run.event !== 'pull_request_target' || run.conclusion !== 'success' || evidence.toolRef !== toolRef || evidence.indexSha256 !== hash(bytes) || !Number.isSafeInteger(evidence.prNumber) || evidence.prNumber < 1 || !/^[a-f0-9]{40}$/.test(evidence.headSha)) throw Error('Signing evidence does not match the trusted preparation run')
}

// Read only allowlisted Git blobs. Never check out or execute a candidate's scripts,
// workflows, symlinks, submodules, hooks or package configuration.
export function snapshot(sha, destination) {
  if (!/^[a-f0-9]{40}$/.test(sha)) throw Error('Invalid snapshot revision')
  const tree = execFileSync('git', ['--no-replace-objects', 'ls-tree', '-rz', sha, '--', 'packages', 'icons', 'revocations.json', 'index.json', 'index.signatures.json'], { encoding: 'utf8' }).split('\0').filter(Boolean)
  if (tree.length > 2000) throw Error('Registry snapshot is oversized')
  for (const row of tree) {
    const [info, path] = row.split('\t')
    if (!/^100644 blob [a-f0-9]{40}$/.test(info) || !/^(packages\/[a-z0-9@.-]+\.json|icons\/[a-zA-Z0-9.-]+\.png|revocations\.json|index\.json|index\.signatures\.json)$/.test(path)) throw Error('Unsupported candidate file or symlink')
    const bytes = execFileSync('git', ['--no-replace-objects', 'show', `${sha}:${path}`], { maxBuffer: 2 * 1024 * 1024 })
    if (bytes.length > (path === 'index.json' ? 2 * 1024 * 1024 : 256 * 1024)) throw Error('Candidate file exceeds limit')
    const target = resolve(destination, path)
    mkdirSync(resolve(target, '..'), { recursive: true })
    writeFileSync(target, bytes)
  }
}
