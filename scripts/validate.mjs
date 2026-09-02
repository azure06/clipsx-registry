import { createHash, createPublicKey, verify } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { expectedRelease, validatePublishedRelease } from './release-policy.mjs'

const root = resolve(import.meta.dirname, '..')
const args = new Set(process.argv.slice(2))
const downloadIndex = process.argv.indexOf('--download-dir')
const downloadDirectory = downloadIndex >= 0 ? resolve(process.argv[downloadIndex + 1]) : null
const requireCurrent = args.has('--require-current')
const verifyReleases = args.has('--verify-releases')
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const compare = (left, right) => (left < right ? -1 : left > right ? 1 : 0)
const compareSemver = (left, right) => {
  const parse = value => {
    const match = value.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/)
    if (!match) return null
    return { numbers: match.slice(1, 4).map(Number), prerelease: match[4]?.split('.') ?? [] }
  }
  const a = parse(left)
  const b = parse(right)
  if (!a || !b) fail('Cannot compare invalid SemVer')
  for (let index = 0; index < 3; index += 1) {
    if (a.numbers[index] !== b.numbers[index]) return a.numbers[index] - b.numbers[index]
  }
  if (!a.prerelease.length || !b.prerelease.length) return b.prerelease.length - a.prerelease.length
  for (let index = 0; index < Math.max(a.prerelease.length, b.prerelease.length); index += 1) {
    if (a.prerelease[index] === undefined) return -1
    if (b.prerelease[index] === undefined) return 1
    const aNumeric = /^\d+$/.test(a.prerelease[index])
    const bNumeric = /^\d+$/.test(b.prerelease[index])
    if (aNumeric && bNumeric) {
      const difference = Number(a.prerelease[index]) - Number(b.prerelease[index])
      if (difference) return difference
    } else if (aNumeric !== bNumeric) {
      return aNumeric ? -1 : 1
    } else {
      const difference = compare(a.prerelease[index], b.prerelease[index])
      if (difference) return difference
    }
  }
  return 0
}
const fail = message => {
  throw new Error(message)
}

const packageFiles = readdirSync(resolve(root, 'packages'))
  .filter(name => name.endsWith('.json'))
  .sort(compare)
const packages = packageFiles.map(name =>
  JSON.parse(readFileSync(resolve(root, 'packages', name), 'utf8'))
)
const revocations = JSON.parse(readFileSync(resolve(root, 'revocations.json'), 'utf8'))
const legacyReleases = JSON.parse(readFileSync(resolve(root, 'legacy-releases.json'), 'utf8'))
const identities = new Set()
const legacyIdentities = new Set()

for (const entry of legacyReleases) {
  const identity = `${entry.packageId}@${entry.version}`
  if (
    !/^infiniti\.[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.packageId) ||
    !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(entry.version) ||
    !/^[a-f0-9]{64}$/.test(entry.sha256) ||
    legacyIdentities.has(identity)
  ) {
    fail(`${identity}: invalid legacy release policy`)
  }
  legacyIdentities.add(identity)
}

for (const packageEntry of packages) {
  const identity = `${packageEntry.packageId}@${packageEntry.version}`
  if (!/^infiniti\.[a-z0-9]+(?:-[a-z0-9]+)*$/.test(packageEntry.packageId)) {
    fail(`${identity}: invalid Infiniti package ID`)
  }
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(packageEntry.version)) {
    fail(`${identity}: version is not SemVer`)
  }
  if (identities.has(identity)) fail(`${identity}: duplicate package release`)
  identities.add(identity)
  if (packageEntry.apiVersion !== '^2.0') fail(`${identity}: unsupported API range`)
  if (
    packageEntry.publisher?.id !== 'infiniti' ||
    packageEntry.publisher?.displayName !== 'Infiniti' ||
    packageEntry.publisher?.verified !== true
  ) {
    fail(`${identity}: publisher must be the verified Infiniti identity`)
  }
  if (packageEntry.releaseUrl !== expectedRelease(packageEntry).url) {
    fail(`${identity}: release URL is not an official immutable release`)
  }
  if (!/^[a-f0-9]{64}$/.test(packageEntry.sha256)) fail(`${identity}: invalid archive hash`)
  if (!Number.isSafeInteger(packageEntry.archiveSizeBytes) || packageEntry.archiveSizeBytes < 1 || packageEntry.archiveSizeBytes > 16 * 1024 * 1024) {
    fail(`${identity}: invalid archive size`)
  }
  if (!/^[a-f0-9]{64}$/.test(packageEntry.permissionFingerprint)) {
    fail(`${identity}: invalid permission fingerprint`)
  }
  if (!packageEntry.displayName || !packageEntry.description || packageEntry.license !== 'MIT') {
    fail(`${identity}: incomplete reviewed catalog metadata`)
  }
  if (!Array.isArray(packageEntry.categories) || packageEntry.categories.length < 1 || packageEntry.categories.length > 5) {
    fail(`${identity}: categories must contain 1-5 entries`)
  }
  if (!Array.isArray(packageEntry.tags) || packageEntry.tags.length < 1 || packageEntry.tags.length > 12) {
    fail(`${identity}: tags must contain 1-12 entries`)
  }
  for (const theme of ['light', 'dark']) {
    const descriptor = packageEntry.iconAssets?.[theme]
    const expectedPrefix = 'https://raw.githubusercontent.com/azure06/clipsx-registry/main/icons/'
    if (!descriptor?.url?.startsWith(expectedPrefix) || !/^[a-f0-9]{64}$/.test(descriptor.sha256)) {
      fail(`${identity}: invalid ${theme} icon descriptor`)
    }
    const path = resolve(root, 'icons', basename(new URL(descriptor.url).pathname))
    const bytes = readFileSync(path)
    const png = Buffer.from('89504e470d0a1a0a', 'hex')
    if (bytes.length > 256 * 1024 || !bytes.subarray(0, 8).equals(png)) {
      fail(`${identity}: ${theme} icon must be a bounded PNG`)
    }
    if (bytes.readUInt32BE(16) !== 256 || bytes.readUInt32BE(20) !== 256) {
      fail(`${identity}: ${theme} icon must be 256x256`)
    }
    if (sha256(bytes) !== descriptor.sha256) fail(`${identity}: ${theme} icon hash mismatch`)
  }
}

for (const legacy of legacyReleases) {
  if (
    !packages.some(
      packageEntry =>
        packageEntry.packageId === legacy.packageId &&
        packageEntry.version === legacy.version &&
        packageEntry.sha256 === legacy.sha256
    )
  ) {
    fail(`${legacy.packageId}@${legacy.version}: unused or altered legacy release policy`)
  }
}

const baseSha = process.env.REGISTRY_BASE_SHA
if (baseSha) {
  const tree = spawnSync('git', ['ls-tree', '-r', '--name-only', baseSha, 'packages'], {
    cwd: root,
    encoding: 'utf8',
  })
  if (tree.status !== 0) fail('Unable to inspect the base registry revision')
  const previous = tree.stdout
    .split(/\r?\n/)
    .filter(path => path.endsWith('.json'))
    .map(path => {
      const result = spawnSync('git', ['show', `${baseSha}:${path}`], { cwd: root, encoding: 'utf8' })
      if (result.status !== 0) fail(`Unable to read base metadata ${path}`)
      return JSON.parse(result.stdout)
    })
  const previousIdentities = new Set(previous.map(entry => `${entry.packageId}@${entry.version}`))
  for (const packageEntry of packages) {
    if (previousIdentities.has(`${packageEntry.packageId}@${packageEntry.version}`)) continue
    const priorVersions = previous
      .filter(entry => entry.packageId === packageEntry.packageId)
      .map(entry => entry.version)
    if (priorVersions.some(version => compareSemver(packageEntry.version, version) <= 0)) {
      fail(`${packageEntry.packageId}@${packageEntry.version}: new releases must increase SemVer`)
    }
  }
}

for (const revocation of revocations) {
  if (
    !/^infiniti\.[a-z0-9]+(?:-[a-z0-9]+)*$/.test(revocation.packageId) ||
    !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(revocation.version) ||
    !/^[a-f0-9]{64}$/.test(revocation.sha256) ||
    typeof revocation.reason !== 'string' ||
    revocation.reason.length > 500
  ) {
    fail('Invalid revocation entry')
  }
}

const indexBytes = readFileSync(resolve(root, 'index.json'))
const index = JSON.parse(indexBytes)
const signatures = JSON.parse(readFileSync(resolve(root, 'index.signatures.json'), 'utf8'))
if (index.schemaVersion !== 3 || signatures.schemaVersion !== 1 || !signatures.signatures?.length) {
  fail('Live registry files use an unsupported or unsigned schema')
}

const keys = readdirSync(resolve(root, 'keys'))
  .filter(name => name.endsWith('.json'))
  .map(name => JSON.parse(readFileSync(resolve(root, 'keys', name), 'utf8')))
const signatureValid = signatures.signatures.some(signature => {
  const key = keys.find(candidate => candidate.keyId === signature.keyId)
  if (!key || key.algorithm !== 'ed25519' || signature.algorithm !== 'ed25519') return false
  const raw = Buffer.from(key.publicKeyBase64, 'base64')
  if (raw.length !== 32) return false
  const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), raw])
  return verify(
    null,
    indexBytes,
    createPublicKey({ key: spki, format: 'der', type: 'spki' }),
    Buffer.from(signature.signature, 'base64')
  )
})
if (!signatureValid) fail('Live index has no valid trusted signature')

if (requireCurrent) {
  const normalizedPackages = [...packages].sort(
    (left, right) => compare(left.packageId, right.packageId) || compare(left.version, right.version)
  )
  const normalizedRevocations = [...revocations].sort(
    (left, right) =>
      compare(left.packageId, right.packageId) ||
      compare(left.version, right.version) ||
      compare(left.sha256, right.sha256)
  )
  if (JSON.stringify(index.packages) !== JSON.stringify(normalizedPackages) || JSON.stringify(index.revocations) !== JSON.stringify(normalizedRevocations)) {
    fail('Live index does not match reviewed package and revocation sources')
  }
}

if (downloadDirectory) {
  mkdirSync(downloadDirectory, { recursive: true })
  for (const packageEntry of packages) {
    const response = await fetch(packageEntry.releaseUrl, { redirect: 'follow' })
    if (!response.ok) fail(`${packageEntry.packageId}: release download failed (${response.status})`)
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length !== packageEntry.archiveSizeBytes || sha256(bytes) !== packageEntry.sha256) {
      fail(`${packageEntry.packageId}: downloaded archive does not match reviewed metadata`)
    }
    const path = resolve(downloadDirectory, `${packageEntry.packageId}-${packageEntry.version}.clipsx`)
    writeFileSync(path, bytes)
    const tool = process.env.EXTENSION_TOOL
    if (tool) {
      const result = spawnSync(tool, ['registry-entry', path, packageEntry.releaseUrl], {
        encoding: 'utf8',
      })
      if (result.status !== 0) fail(`${packageEntry.packageId}: host package validation failed`)
      const inspected = JSON.parse(result.stdout.slice(result.stdout.indexOf('{')))
      for (const field of ['packageId', 'version', 'apiVersion', 'displayName', 'description', 'sha256', 'archiveSizeBytes', 'permissionFingerprint']) {
        if (inspected[field] !== packageEntry[field]) fail(`${packageEntry.packageId}: ${field} differs from the archive`)
      }
    }
  }
}

if (verifyReleases) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2026-03-10',
    'User-Agent': 'clipsx-registry-validator',
  }
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  for (const packageEntry of packages) {
    const { tag } = expectedRelease(packageEntry)
    const response = await fetch(
      `https://api.github.com/repos/azure06/clipsx-extensions/releases/tags/${encodeURIComponent(tag)}`,
      { headers, redirect: 'error' }
    )
    if (!response.ok) {
      fail(`${packageEntry.packageId}: GitHub release lookup failed (${response.status})`)
    }
    validatePublishedRelease(packageEntry, await response.json(), legacyReleases)
  }
}

console.log(`validated ${packages.length} package releases and ${revocations.length} revocations`)
