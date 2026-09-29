import { readFileSync, writeFileSync, mkdtempSync, cpSync, appendFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync, spawnSync } from 'node:child_process'
import { api, status, repository } from './github-publication.mjs'
import { assertCurrentHead, snapshot, indexBytes, hash } from './catalog-candidate.mjs'

const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH))
const number = event.pull_request?.number
if (!Number.isSafeInteger(number) || process.env.GITHUB_EVENT_NAME !== 'pull_request_target') throw Error('Preparation requires a trusted PR-target event')
const pr = await api(`pulls/${number}`)
const head = process.env.EXPECTED_HEAD || event.pull_request.head.sha
assertCurrentHead(pr, head, repository)
const output = text => appendFileSync(process.env.GITHUB_OUTPUT, text + '\n')
try {
  if (process.argv[2] === 'preflight') {
    await status(head, 'pending', 'Preparing the exact catalog for this revision')
    const root = mkdtempSync(resolve(process.env.RUNNER_TEMP || tmpdir(), 'clipsx-catalog-'))
    execFileSync('git', ['fetch', '--no-tags', 'origin', head], { stdio: 'pipe' })
    snapshot(head, root)
    if (!existsSync(resolve(root, 'index.json')) || !existsSync(resolve(root, 'index.signatures.json'))) throw Error('Established publication files cannot be removed from a metadata PR')
    cpSync('keys', resolve(root, 'keys'), { recursive: true })
    const expected = indexBytes(root)
    const current = readFileSync(resolve(root, 'index.json'))
    const local = spawnSync(process.execPath, ['scripts/validate.mjs', '--registry-dir', root, '--require-current'], { stdio: 'pipe' })
    if (current.equals(expected) && local.status === 0) {
      await status(head, 'success', 'Catalog and signature match reviewed sources')
      output('sign_required=false')
    } else {
      writeFileSync(resolve(root, 'index.json'), expected)
      output(`sign_required=true\nroot=${root}\nhead_sha=${head}\npr_number=${number}\ntool_ref=${readFileSync('.github/extension-tool-ref', 'utf8').trim()}`)
    }
  } else if (process.argv[2] === 'ready') {
    const root = process.env.CANDIDATE_ROOT
    const bytes = readFileSync(resolve(root, 'index.json'))
    if (!bytes.equals(indexBytes(root))) throw Error('Validated catalog no longer matches its sources')
    assertCurrentHead(await api(`pulls/${number}`), head, repository)
    writeFileSync(resolve(root, 'evidence.json'), JSON.stringify({ schemaVersion: 1, repository, prNumber: number, headSha: head, trustedRef: process.env.GITHUB_SHA, runId: Number(process.env.GITHUB_RUN_ID), toolRef: readFileSync('.github/extension-tool-ref', 'utf8').trim(), indexSha256: hash(bytes) }) + '\n')
    await status(head, 'pending', 'Validated catalog is waiting for automatic signing')
  } else if (process.argv[2] === 'failed') {
    await status(head, 'failure', 'Catalog preparation failed; inspect the workflow')
  } else throw Error('Unknown preparation phase')
} catch (error) {
  await status(head, 'failure', 'Catalog preparation failed; inspect the workflow')
  throw error
}
