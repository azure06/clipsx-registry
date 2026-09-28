import { readFileSync, readdirSync, writeFileSync, existsSync, copyFileSync } from 'node:fs'
import { resolve, basename } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expectedRelease } from './release-policy.mjs'

export function importEntry(released, previous) {
  if (!previous) throw Error('New packages require reviewed marketplace fields and icons before import')
  const technical = ['packageId', 'version', 'apiVersion', 'displayName', 'description', 'license', 'releaseUrl', 'sha256', 'archiveSizeBytes', 'permissionFingerprint', 'permissionReport', 'portableSettings', 'contributions', 'httpOrigins', 'externalNavigationOrigins', 'credentialLabels', 'providers']
  for (const key of technical) if (released[key] === undefined) throw Error(`Generated metadata is missing ${key}`)
  const derived = {
    httpOrigins: released.permissionReport.http.map(p => p.origin),
    externalNavigationOrigins: released.permissionReport.externalNavigation.map(p => p.origin),
    credentialLabels: released.permissionReport.credentials.map(p => p.label),
    providers: released.permissionReport.providers,
  }
  for (const [key, value] of Object.entries(derived)) if (JSON.stringify(released[key]) !== JSON.stringify(value)) throw Error(`Generated ${key} does not match permissions`)
  if (released.releaseUrl !== expectedRelease(released).url) throw Error('Unexpected release URL')
  if (!/^\d{4}-\d\d-\d\dT/.test(released.publishedAt)) throw Error('Missing GitHub publication timestamp')
  return { ...previous, ...Object.fromEntries(technical.map(key => [key, released[key]])), publishedAt: released.publishedAt, updatedAt: released.publishedAt }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const bundle = JSON.parse(readFileSync(process.argv[2]))
  if (bundle.schemaVersion !== 1 || bundle.sourceRepository !== 'azure06/clipsx-extensions' || !/^[a-f0-9]{40}$/.test(bundle.sourceSha) || !Number.isSafeInteger(bundle.prNumber) || !Array.isArray(bundle.entries) || bundle.entries.length > 6) throw Error('Invalid publication bundle')
  if (!/^[a-f0-9]{40}$/.test(bundle.toolRef)) throw Error('Publication bundle must identify reviewed tooling')
  const files = readdirSync('packages').filter(f => f.endsWith('.json'))
  for (const release of bundle.entries) {
    if (!/^infiniti\.[a-z0-9-]+$/.test(release.packageId) || !/^\d+\.\d+\.\d+$/.test(release.version)) throw Error('Invalid release identity')
    const oldFiles = files.filter(f => f.startsWith(`${release.packageId}@`))
    const candidates = oldFiles.map(f => ({ file: f, entry: JSON.parse(readFileSync(resolve('packages', f))) }))
    candidates.sort((a, b) => b.entry.version.localeCompare(a.entry.version, undefined, { numeric: true }))
    const previous = candidates[0]?.entry
    const entry = importEntry(release, previous)
    for (const theme of ['light', 'dark']) {
      const oldIcon = basename(new URL(previous.iconAssets[theme].url).pathname)
      const newIcon = `${release.packageId.slice(9)}-${release.version}-${theme}.png`
      const target = resolve('icons', newIcon)
      if (!existsSync(target)) copyFileSync(resolve('icons', oldIcon), target)
      entry.iconAssets = { ...entry.iconAssets, [theme]: { ...previous.iconAssets[theme], url: `https://raw.githubusercontent.com/azure06/clipsx-registry/main/icons/${newIcon}` } }
    }
    writeFileSync(resolve('packages', `${release.packageId}@${release.version}.json`), JSON.stringify(entry, null, 2) + '\n')
  }
}
