const OFFICIAL_RELEASE_PREFIX =
  'https://github.com/azure06/clipsx-extensions/releases/download/'

export const expectedRelease = packageEntry => {
  const slug = packageEntry.packageId.replace(/^infiniti\./, '')
  const tag = `${slug}-v${packageEntry.version}`
  const asset = `${slug}-${packageEntry.version}.clipsx`
  return {
    tag,
    asset,
    url: `${OFFICIAL_RELEASE_PREFIX}${tag}/${asset}`,
  }
}

export const isLegacyRelease = (packageEntry, legacyReleases) =>
  legacyReleases.some(
    entry =>
      entry.packageId === packageEntry.packageId &&
      entry.version === packageEntry.version &&
      entry.sha256 === packageEntry.sha256
  )

export const validatePublishedRelease = (packageEntry, release, legacyReleases) => {
  const expected = expectedRelease(packageEntry)
  if (packageEntry.releaseUrl !== expected.url) {
    throw new Error(`${packageEntry.packageId}@${packageEntry.version}: unexpected release URL`)
  }
  if (release.tag_name !== expected.tag || release.draft || release.prerelease) {
    throw new Error(`${packageEntry.packageId}@${packageEntry.version}: release is not published from the expected tag`)
  }
  const asset = release.assets?.find(candidate => candidate.name === expected.asset)
  if (
    !asset ||
    asset.state !== 'uploaded' ||
    asset.browser_download_url !== expected.url ||
    asset.size !== packageEntry.archiveSizeBytes ||
    asset.digest !== `sha256:${packageEntry.sha256}`
  ) {
    throw new Error(`${packageEntry.packageId}@${packageEntry.version}: GitHub asset metadata does not match the registry`)
  }
  if (release.immutable !== true && !isLegacyRelease(packageEntry, legacyReleases)) {
    throw new Error(`${packageEntry.packageId}@${packageEntry.version}: release is not immutable`)
  }
}
