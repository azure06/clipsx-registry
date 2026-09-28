import { readFileSync, appendFileSync } from 'node:fs'
import { api } from './github-publication.mjs'

const revision = process.env.GITHUB_SHA
const current = async () => (await api('git/ref/heads/main')).object.sha === revision
let verified = false
for (let attempt = 0; attempt < 10; attempt++) {
  if (!await current()) {
    appendFileSync(process.env.GITHUB_OUTPUT, 'current=false\n')
    console.log('A newer registry merge superseded this publication; its reconciliation owns the current catalog.')
    process.exit(0)
  }
  verified = true
  for (const file of ['index.json', 'index.signatures.json']) {
    const response = await fetch(`https://raw.githubusercontent.com/azure06/clipsx-registry/main/${file}`, { headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(15000) })
    const length = Number(response.headers.get('content-length'))
    if (length > 2 * 1024 * 1024) throw Error('Public catalog exceeds its limit')
    if (!response.ok || !Buffer.from(await response.arrayBuffer()).equals(readFileSync(file))) verified = false
  }
  if (verified) break
  await new Promise(resolve => setTimeout(resolve, 3000))
}
if (!verified) throw Error('Merged publication is not yet visible at the app URLs; retry verification, do not resign')
appendFileSync(process.env.GITHUB_OUTPUT, `current=${await current()}\n`)
console.log('Published index and signature bytes match the merged revision at both app URLs.')
