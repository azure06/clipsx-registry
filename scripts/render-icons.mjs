import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '..')
const extensions = resolve(process.env.EXTENSIONS_REPO || '../clipsx-extensions')
const output = resolve(root, 'icons')
mkdirSync(output, { recursive: true })

const icons = {
  'ask-ai': ['ask-ai/icons/package-light.svg', 'ask-ai/icons/package-dark.svg'],
  base64: ['base64/icons/binary-mark-light.svg', 'base64/icons/binary-mark-dark.svg'],
  'data-tools': ['data-tools/icons/package-light.svg', 'data-tools/icons/package-dark.svg'],
  'jwt-inspector': ['jwt-inspector/icons/jwt-mark-light.svg', 'jwt-inspector/icons/jwt-mark-dark.svg'],
  mermaid: ['mermaid-viewer/icons/mermaid.svg', 'mermaid-viewer/icons/mermaid.svg'],
}

for (const [slug, themed] of Object.entries(icons)) {
  for (const [index, source] of themed.entries()) {
    const theme = index === 0 ? 'light' : 'dark'
    await sharp(resolve(extensions, 'extensions', source), { density: 192 })
      .resize(192, 192, { fit: 'contain' })
      .extend({ top: 32, bottom: 32, left: 32, right: 32, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9, adaptiveFiltering: false })
      .toFile(resolve(output, `${slug}-${theme}.png`))
  }
}
