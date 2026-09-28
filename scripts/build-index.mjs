import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { indexBytes } from './catalog-candidate.mjs'
const root = process.argv[2] ? resolve(process.argv[2]) : resolve(import.meta.dirname, '..')
writeFileSync(resolve(root, 'index.json'), indexBytes(root))
