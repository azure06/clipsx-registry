import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { api, repository } from './github-publication.mjs'
import { snapshot, assertCurrentHead } from './catalog-candidate.mjs'

const bundlePath = resolve(process.argv[2])
const bundle = JSON.parse(readFileSync(bundlePath))
if (bundle.schemaVersion !== 1 || bundle.sourceRepository !== 'azure06/clipsx-extensions' || !Number.isSafeInteger(bundle.prNumber) || bundle.prNumber < 1 || !/^[a-f0-9]{40}$/.test(bundle.sourceSha)) throw Error('Invalid release bundle')
if (bundle.toolRef !== readFileSync('.github/extension-tool-ref', 'utf8').trim()) throw Error('Published candidate tooling differs from reviewed registry tooling')
const branch = `codex/extension-publication-pr-${bundle.prNumber}`
const run = (command, ...args) => execFileSync(command, args, { encoding: 'utf8' }).trim()
const existing = await api(`pulls?state=open&head=azure06:${encodeURIComponent(branch)}`)
const main = await api('git/ref/heads/main')
const branches = await api(`git/matching-refs/heads/${branch}`)
const reference = branches.find(ref => ref.ref === `refs/heads/${branch}`)
const parentSha = existing[0]?.head.sha || reference?.object.sha || main.object.sha
if (existing.length) assertCurrentHead(existing[0], parentSha, repository)

// No PR checkout: even icons and metadata are untrusted until regular-file and
// size checks pass. The importer executes reviewed main code against data only.
const root = mkdtempSync(resolve(tmpdir(), 'clipsx-import-'))
run('git', 'fetch', '--no-tags', 'origin', parentSha)
snapshot(parentSha, root)
const files = () => ['packages', 'icons'].flatMap(dir => readdirSync(resolve(root, dir)).map(name => `${dir}/${name}`))
const before = new Map(files().map(path => [path, readFileSync(resolve(root, path))]))
execFileSync(process.execPath, [resolve('scripts/import-release.mjs'), bundlePath], { cwd: root, stdio: 'inherit' })
const entries = []
for (const path of files()) {
  const content = readFileSync(resolve(root, path))
  if (before.get(path)?.equals(content)) continue
  const blob = await api('git/blobs', { method: 'POST', body: { content: content.toString('base64'), encoding: 'base64' } })
  entries.push({ path, mode: '100644', type: 'blob', sha: blob.sha })
}
if (entries.length) {
  const parent = await api(`git/commits/${parentSha}`)
  const tree = await api('git/trees', { method: 'POST', body: { base_tree: parent.tree.sha, tree: entries } })
  const commit = await api('git/commits', { method: 'POST', body: { message: 'chore: prepare extension catalog releases', tree: tree.sha, parents: [parentSha] } })
  if (reference) await api(`git/refs/heads/${branch}`, { method: 'PATCH', body: { sha: commit.sha, force: false } })
  else await api('git/refs', { method: 'POST', body: { ref: `refs/heads/${branch}`, sha: commit.sha } })
} else if (!existing.length && !reference) {
  console.log('Reviewed metadata already contains these releases.'); process.exit(0)
}
if (!existing.length) {
  const body = resolve(root, 'pr-body.md')
  writeFileSync(body, `Published immutable assets from clipsx-extensions PR #${bundle.prNumber}, source ${bundle.sourceSha}.\n\nTechnical metadata was imported from the checked release assets. Review marketplace fields and permissions; trusted preparation adds the matching catalog and signature before merge.\n`)
  console.log(run('gh', 'pr', 'create', '--repo', repository, '--base', 'main', '--head', branch, '--title', 'chore: update extension catalog', '--body-file', body))
} else console.log(`Updated registry PR #${existing[0].number}`)
