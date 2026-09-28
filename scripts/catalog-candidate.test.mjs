import test from 'node:test'
import assert from 'node:assert/strict'
import { assertCurrentHead, indexBytes, hash, snapshot, verifySigningEvidence } from './catalog-candidate.mjs'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

test('source changes and closed, forked or main branches cannot be signed', () => {
  const sha = 'a'.repeat(40), repo = 'azure06/clipsx-registry'
  const pr = { state: 'open', base: { ref: 'main' }, head: { ref: 'codex/release', sha, repo: { full_name: repo } } }
  assert.doesNotThrow(() => assertCurrentHead(pr, sha, repo))
  assert.throws(() => assertCurrentHead(pr, 'b'.repeat(40), repo))
  assert.throws(() => assertCurrentHead({ ...pr, state: 'closed' }, sha, repo))
  assert.throws(() => assertCurrentHead({ ...pr, head: { ...pr.head, ref: 'main' } }, sha, repo))
  assert.throws(() => assertCurrentHead(pr, sha, 'other/repository'))
})

test('canonical catalog sorts sources, rejects empty sources, preserves typed values', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'catalog-test-'))
  mkdirSync(resolve(root, 'packages'))
  writeFileSync(resolve(root, 'revocations.json'), '[]')
  assert.throws(() => indexBytes(root))
  writeFileSync(resolve(root, 'packages/b.json'), JSON.stringify({ packageId: 'infiniti.b', version: '1.0.0' }))
  writeFileSync(resolve(root, 'packages/a.json'), JSON.stringify({ packageId: 'infiniti.a', version: '1.0.0' }))
  assert.equal(JSON.parse(indexBytes(root)).packages[0].packageId, 'infiniti.a')
  const expected = indexBytes(root)
  rmSync(resolve(root, 'packages/a.json'))
  writeFileSync(resolve(root, 'packages/z.json'), JSON.stringify({ packageId: 'infiniti.a', version: '1.0.0' }))
  assert.equal(indexBytes(root).equals(expected), true)
})

test('only the exact successful trusted workflow run can supply signing bytes', () => {
  const repository = 'azure06/clipsx-registry', bytes = Buffer.from('catalog'), toolRef = 'a'.repeat(40)
  const run = { id: 123, head_sha: 'b'.repeat(40), path: '.github/workflows/prepare.yml', head_repository: { full_name: repository }, event: 'pull_request_target', conclusion: 'success' }
  const evidence = { schemaVersion: 1, repository, runId: 123, trustedRef: run.head_sha, toolRef, indexSha256: hash(bytes), prNumber: 22, headSha: 'c'.repeat(40) }
  assert.doesNotThrow(() => verifySigningEvidence(evidence, run, bytes, toolRef, repository))
  for (const field of ['runId', 'trustedRef', 'toolRef', 'indexSha256', 'repository', 'headSha']) assert.throws(() => verifySigningEvidence({ ...evidence, [field]: 'forged' }, run, bytes, toolRef, repository))
  for (const field of ['path', 'event', 'conclusion']) assert.throws(() => verifySigningEvidence(evidence, { ...run, [field]: 'wrong' }, bytes, toolRef, repository))
  assert.throws(() => verifySigningEvidence(evidence, run, Buffer.from('changed catalog'), toolRef, repository))
})

test('snapshot copies allowlisted data, excludes scripts, and refuses symlink blobs', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'snapshot-test-'))
  const git = (...args) => execFileSync('git', ['-c', `safe.directory=${root}`, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', ...args], { cwd: root, encoding: 'utf8' }).trim()
  git('init', '--quiet')
  mkdirSync(resolve(root, 'packages')); mkdirSync(resolve(root, 'scripts'))
  writeFileSync(resolve(root, 'packages/test.json'), '{}')
  writeFileSync(resolve(root, 'scripts/untrusted.mjs'), 'throw Error("never execute")')
  git('add', '.'); git('commit', '--quiet', '-m', 'data fixture')
  const sha = git('rev-parse', 'HEAD')
  const destination = resolve(root, 'snapshot')
  const previous = process.cwd()
  process.chdir(root)
  try {
    snapshot(sha, destination)
    assert.equal(existsSync(resolve(destination, 'packages/test.json')), true)
    assert.equal(existsSync(resolve(destination, 'scripts/untrusted.mjs')), false)
    const blob = git('rev-parse', 'HEAD:packages/test.json')
    git('update-index', '--cacheinfo', `120000,${blob},packages/test.json`)
    git('commit', '--quiet', '-m', 'symlink fixture')
    assert.throws(() => snapshot(git('rev-parse', 'HEAD'), resolve(root, 'unsafe')), /symlink/)
  } finally { process.chdir(previous) }
})
