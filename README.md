# ClipsX Extension Registry

The official signed catalog for [ClipsX](https://github.com/azure06/clipsx).
Package source and checksum-pinned `.clipsx` release assets live in
[`azure06/clipsx-extensions`](https://github.com/azure06/clipsx-extensions).
Every current catalog release must be immutable and use Extension API v3.2.
The previous signed index remains verifiable until its protected replacement is merged.

The registry is a trust root, not a package host. Reviewed package records in
`packages/` and `revocations.json` are the source. The protected publication
workflow generates `index.json` with metadata, checksums, portable-setting
declarations, and revocations, then creates `index.signatures.json` with
detached Ed25519 signatures over the exact index bytes. ClipsX reads these
published files directly for Discover and installation.

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

1. A versioned extension PR prepares tested archives once. Merging it publishes
   those exact immutable bytes and opens or updates a registry metadata PR.
2. Trusted registry automation imports and verifies the exact archive identity,
   digest, permissions and icons. It builds the complete candidate catalog and
   checks it with the same parser used by Discover.
3. A separate trusted workflow signs validated bytes and commits `index.json`
   and `index.signatures.json` into that same metadata PR. It never executes
   PR-controlled code. The final `publication-ready` check verifies both files
   exactly match their reviewed sources.
4. Merge this complete PR to publish at the existing raw URLs. There is no
   additional publication PR, human signing approval or routine manual dispatch.
5. The merge verifies public bytes and triggers `clipsx-web` reconciliation and
   readback. Publication and database reconciliation have separate status.
6. Refresh Discover and follow [OPERATIONS.md](OPERATIONS.md) for installed
   checks, credentials, revocation and recovery. Agent work uses the
   [publication skill](.agents/skills/clipsx-registry-publication/SKILL.md).

Never commit a private key. See [OPERATIONS.md](OPERATIONS.md) for revocation,
key rotation, and recovery.

Ordinary workflows use readable major action versions. Actions in the protected
signing job remain pinned to reviewed commits because that job alone can read
the catalog private key. This narrow exception protects the trust root without
making routine CI difficult to maintain.
