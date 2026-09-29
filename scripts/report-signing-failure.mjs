import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { status } from './github-publication.mjs'

const evidence = JSON.parse(readFileSync(resolve(process.argv[2], 'evidence.json')))
if (!/^[a-f0-9]{40}$/.test(evidence.headSha)) throw Error('Invalid failed-candidate revision')
await status(evidence.headSha, 'failure', 'Signing failed; inspect credentials and rerun this signing job')
