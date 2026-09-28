import { readFileSync, readdirSync, lstatSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { api, status, repository } from './github-publication.mjs'
import { assertCurrentHead, verifySigningEvidence } from './catalog-candidate.mjs'
import { hasTrustedSignature } from './catalog-signature.mjs'

const root = resolve(process.argv[2])
const files = readdirSync(root).sort()
if (JSON.stringify(files) !== JSON.stringify(['evidence.json', 'index.json']) || files.some(f => !lstatSync(resolve(root, f)).isFile())) throw Error('Unexpected signing artifact contents')
const bytes = readFileSync(resolve(root, 'index.json'))
if (bytes.length > 2 * 1024 * 1024) throw Error('Signing candidate exceeds its limit')
const evidenceBytes = readFileSync(resolve(root, 'evidence.json'))
if (evidenceBytes.length > 16 * 1024) throw Error('Signing evidence exceeds its limit')
const evidence = JSON.parse(evidenceBytes)
const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH))
const run = event.workflow_run
verifySigningEvidence(evidence, run, bytes, readFileSync('.github/extension-tool-ref', 'utf8').trim(), repository)
try {
  const pr = await api(`pulls/${evidence.prNumber}`)
  assertCurrentHead(pr, evidence.headSha, repository)
  execFileSync(process.execPath, ['scripts/sign-index.mjs', root], { stdio: 'pipe' })
  const signature = readFileSync(resolve(root, 'index.signatures.json'))
  const keys = readdirSync('keys').filter(name => name.endsWith('.json')).map(name => JSON.parse(readFileSync(resolve('keys', name))))
  if (!hasTrustedSignature(bytes, JSON.parse(signature), keys)) throw Error('Signing key does not match a reviewed trust root; no PR update was made')
  const entries = []
  for (const [path, content] of [['index.json', bytes], ['index.signatures.json', signature]]) {
    const blob = await api('git/blobs', { method: 'POST', body: { content: content.toString('base64'), encoding: 'base64' } })
    entries.push({ path, mode: '100644', type: 'blob', sha: blob.sha })
  }
  assertCurrentHead(await api(`pulls/${evidence.prNumber}`), evidence.headSha, repository)
  const parent = await api(`git/commits/${evidence.headSha}`)
  const tree = await api('git/trees', { method: 'POST', body: { base_tree: parent.tree.sha, tree: entries } })
  const commit = await api('git/commits', { method: 'POST', body: { message: 'chore: prepare signed catalog for review', tree: tree.sha, parents: [evidence.headSha] } })
  // Non-forced update is the final race fence. Never update main or replay over a user edit.
  await api(`git/refs/heads/${pr.head.ref.split('/').map(encodeURIComponent).join('/')}`, { method: 'PATCH', body: { sha: commit.sha, force: false } })
  console.log(`Prepared signed catalog in existing PR #${evidence.prNumber}; final checks run on ${commit.sha}`)
} catch (error) {
  await status(evidence.headSha, 'failure', 'Automatic signing failed; retry after resolving the cause')
  throw error
}
