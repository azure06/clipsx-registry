# Registry operations

## Normal release

After the versioned extension is merged to `main`, manually run its publication
workflow. The package manifest is the sole version source; the workflow builds,
validates, and publishes that immutable release. Verify GitHub reports
`immutable: true`, then review its requested permissions and catalog copy.
Merge the package metadata only after registry CI independently verifies the
repository, tag, asset name, size, digest, immutable status, and package
contents. Run the protected registry publication workflow last; it generates
deterministic index bytes and signs those exact bytes. Do not edit generated
index or signature files manually.

Each package entry must contain a canonically sorted `portableSettings` array.
It is empty unless the matching immutable archive declares reviewed portable
boolean or number settings. After the signed publication PR lands on `main`,
`Sync portable setting approvals` sends the exact registry commit and index
digest to `clipsx-web`. That workflow rejects stale or invalid signatures and
replaces `sync_internal.extension_settings` in one transaction. The registry
workflow follows the uniquely correlated downstream run and reports its result,
so a green registry run covers dispatch, reconciliation, readback, and artifact
upload.

## One-time approval-catalog configuration

This setup is not repeated for each extension release:

1. Add `CLIPSX_WEB_DISPATCH_TOKEN` as a repository secret in
   `clipsx-registry`. Use a fine-grained token restricted to `clipsx-web` with
   **Contents: read and write** for repository dispatch and **Actions: read**
   for downstream status. Metadata read access is implicit.
2. Add `SUPABASE_DB_URL` only to the protected `production` environment in
   `clipsx-web`. For GitHub-hosted runners, copy the Supabase **Session pooler**
   URI on port 5432. A direct `db.<project>.supabase.co` URI is suitable only
   when the project has working IPv4 direct connectivity.
3. Never commit either value or put the database URI in an application `.env`.
   Rotate the stored secret only when its credential or endpoint changes.

The public registry used by ClipsX Discover remains separate from this private
projection. Desktop catalog refresh, package installation, and updates read the
signed public registry directly; Supabase stores only the allow-list used to
validate portable extension settings during cloud configuration sync.

The extension and registry workflows pin the reviewed v3 host package tool by
full commit SHA. Update those pins together when the host package contract
changes; do not point publication at a moving branch. All catalog releases
must be immutable.

Catalog publication uses the existing `sync_internal.extension_settings` table;
adding or updating extension releases does not require a Supabase schema
migration. The signed-index merge dispatches the portable-setting
reconciliation to `clipsx-web`.

## Failure handling

- Validation failure: correct the source or publish a new extension version. Do
  not replace an existing release asset.
- Mutable release: discard the draft or publish a higher version after fixing
  repository immutability.
- Publication failure: leave the previous signed index live and rerun only after
  fixing the workflow or metadata.
- Approval-catalog failure: correct the one-time credential or network setting,
  then rerun `Sync portable setting approvals`. The downstream workflow can also
  be run manually with the exact registry commit and `index.json` SHA-256 for
  recovery; routine publications require no manual dispatch or database update.
- Registry outage: ClipsX retains its last verified catalog. Never bypass client
  signature checks to recover availability.

## Emergency revocation

Add the exact package ID, version, and archive SHA-256 to `revocations.json`,
merge after review, and run the protected publication workflow. Verify that a
fresh install is blocked and an installed matching release is quarantined.

## Key rotation

During an overlap window, set the `CLIPSX_REGISTRY_SECONDARY_KEY_ID`
environment variable and `CLIPSX_REGISTRY_SECONDARY_SIGNING_KEY_PEM` secret in
the protected `registry-signing` environment. Publication emits both signatures
in stable key-ID order. Ship a ClipsX release that trusts the new public key
before removing the old signer, then remove the old host trust key only after
the supported-client overlap window has closed.

1. Generate the replacement Ed25519 key outside both repositories.
2. Add its public key and ID to ClipsX while retaining the old key.
3. Release ClipsX with both trusted keys.
4. Add the new private key to the protected GitHub Environment.
5. Publish an index carrying valid signatures from both keys.
6. After unsupported clients age out, release ClipsX without the old public key.
7. Remove the old signing secret and stop emitting its signature.

If a private key may be compromised, stop normal publication, ship a client that
trusts the replacement key, and publish a new index only after that client is
available. Registry signatures cannot safely revoke their own sole trust root.

## Live smoke test

On a clean production-configured ClipsX profile:

1. Refresh Discover and verify all catalog names and light/dark icons.
2. Install each package and exercise at least one contribution.
3. Disable, re-enable, and remove each package.
4. Disconnect the network and confirm the verified cached catalog remains visible.
5. Reconnect and verify update checks recover without clearing canonical clips.
