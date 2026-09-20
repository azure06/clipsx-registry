# ClipsX Extension Registry

The official signed catalog for [ClipsX](https://github.com/azure06/clipsx).
Package source and checksum-pinned `.clipsx` release assets live in
[`azure06/clipsx-extensions`](https://github.com/azure06/clipsx-extensions).
GitHub release immutability is enforced for new releases. The five initial
catalog entries are exact hash-pinned legacy exceptions because GitHub cannot
apply immutability retroactively.

The registry is a trust root, not a package host. `index.json` contains reviewed
metadata, archive checksums, catalog-icon checksums, reviewed portable-setting
declarations, and revocations.
`index.signatures.json` contains detached Ed25519 signatures over the exact
bytes of `index.json`.

The public signed registry and the private approval catalog have different
jobs. ClipsX reads the public registry directly for Discover, installation, and
updates. `clipsx-web` projects only the reviewed portable boolean/number setting
declarations into Supabase so configuration-sync RPCs can reject forged setting
IDs. The Supabase projection is not involved in discovering or downloading an
extension.

## Identity conventions

- Publisher ID: `infiniti`
- Package IDs: `infiniti.<lowercase-kebab-case-name>`
- Release tags: `<package>-v<semver>`
- Release assets: `<package>-<semver>.clipsx`
- Contribution IDs are package-local; ClipsX qualifies them as
  `<package-id>/<contribution-id>`.
- Semantic facets are qualified as `<package-id>.<facet-id>`.

Published IDs and versions are immutable. A bad release is revoked and replaced
by a higher version; it is never overwritten.

## Publication

1. Merge the versioned extension after its package CI passes, then manually run
   **Publish extension release** for that package. A merge alone never publishes.
2. Verify GitHub reports the resulting release as immutable and publicly
   downloadable.
3. Add or update one reviewed file under `packages/`, including the exact archive
   and icon hashes.
4. Merge the metadata PR after registry CI independently downloads and validates
   the release.
5. Run **Publish signed registry**. The protected `registry-signing` environment
   requires manual approval and exposes the signing key only to that job.
6. Review and merge the generated publication PR containing both live files.
7. The merge automatically dispatches the exact signed revision to `clipsx-web`,
   which verifies it and transactionally reconciles the private Supabase
   approval catalog. The registry workflow waits for that exact downstream run
   and fails if reconciliation or readback fails.
8. Refresh Discover in a production ClipsX build and complete the smoke test in
   [OPERATIONS.md](OPERATIONS.md).

Never commit a private key. See [OPERATIONS.md](OPERATIONS.md) for revocation,
key rotation, and recovery.

Ordinary workflows use readable major action versions. Actions in the protected
signing job remain pinned to reviewed commits because that job alone can read
the catalog private key. This narrow exception protects the trust root without
making routine CI difficult to maintain.
