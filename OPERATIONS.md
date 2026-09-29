# Registry operations

## Normal release

The extension-source PR builds affected packages once; merging publishes its
checked immutable assets and opens/updates a registry metadata PR. Technical
metadata uses `node scripts/import-release.mjs <published-releases.json>`;
marketplace fields and versioned icons retain their reviewed values. There is
no manual conversion procedure.

`Prepare registry publication` runs on `pull_request_target` using code from
reviewed registry `main`. It fetches only allowlisted, bounded JSON/PNG blobs
from the PR; it never checks out its scripts, hooks, symlinks or workflows.
It verifies exact immutable releases, downloads/checks archives, validates
permission fingerprints/icons, assembles the complete catalog and invokes the
pinned host tool's `validate-registry` command. This shares Discover's actual
parser, including origin field types. Candidate evidence binds those exact
bytes to the PR head, successful preparation run and tooling revision.

`Sign registry candidate` runs separately after successful preparation. Only
trusted `main` code and pinned actions can access signing credentials. It
rechecks the PR head before signing and before a non-forced branch update,
then commits both generated files into the existing PR. Stale candidates are
rejected. A key mismatch stops before committing. App commits trigger the next
preparation run, whose lightweight signature/source integrity check satisfies
`publication-ready` without downloading unchanged archives or signing again.
A source change creates a new candidate and requires preparation again.

Merge the complete metadata/index/signature PR after required checks pass.
This merge is publication approval and changes both public files together at
the existing registry URLs. There is no extra publication PR, manual dispatch,
or per-run environment approval. Never hand-edit generated files.

The merge verifies the public bytes, then `Sync portable setting approvals`
dispatches the exact commit and digest to `clipsx-web`, waits for the correlated
run and reports readback. Publication and reconciliation are reported separately:
a database/network failure cannot undo the successful public catalog merge.
Superseded runs do not reconcile an older catalog.

## One-time publication configuration

1. Merge the reviewed host validator first and put its full SHA in
   `.github/extension-tool-ref` here and in `clipsx-extensions`. Never use a
   moving validator branch. Candidate evidence records the pin and inconsistent
   tooling revisions fail signing/promotion.
2. Install a dedicated GitHub App only in the extension and registry repositories.
   Grant **Contents: read/write** and **Pull requests: read/write**, with no
   Workflows, Administration or branch-protection bypass permission. App tokens
   create data branches/PR commits so GitHub executes required validation.
3. Add `CLIPSX_RELEASE_APP_ID` as a repository variable in both repositories.
   Keep `CLIPSX_RELEASE_APP_PRIVATE_KEY` only in `extension-publication` in the
   extension repository and `registry-signing` here. Keep
   `CLIPSX_REGISTRY_SIGNING_KEY_PEM` in `registry-signing`; never move private
   keys to repository-level secrets where same-repo PR jobs could access them.
4. Restrict those environments to `main`. After trusted workflows and replacement
   checks exist, remove the old `registry-signing` reviewer gate: human PR merge
   is the approval. Ordinary build/test jobs have no signing environment.
5. Keep protected `main` with strict required checks, enforced for administrators,
   and human-controlled merges. Require `validate` and `publication-ready` here;
   require `release-ready` in extensions. Replace old required contexts only
   after their replacements have run. Restrict updates to `main` to human
   maintainers with a main-only update ruleset or supported push restriction;
   the App may update PR branches but cannot merge or push to `main`.
   Confine the owner's allowance to the update-only ruleset. It must not bypass
   the separate, administrator-enforced PR and required-check protections.
   Do not add the publication App or every administrator to that allowance.
6. Validate existing assets/fixtures during the transition. Do not bump package
   versions or replace the current signed catalog solely to test automation.

The generated metadata PR is a review boundary; automation never auto-merges it.
The signing workflow signs a candidate, not a promise that a merge is approved.
Unmerged signed candidates are not published because clients read only `main`.

Before declaring the workflow transition ready, check the live repository
settings as well as the workflow files. Extensions require `release-ready`;
the registry requires `validate` and `publication-ready`. Old individual
`package (...)` requirements must not remain: documentation and workflow fixes
correctly skip package builds, so those old requirements would wait forever.
A registry documentation-only PR exercises the trusted readiness check against
the unchanged signed catalog without rebuilding archives or accessing signing
credentials. A passing check proves that path; it does not prove App credentials
or the signing/upload path are configured.

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

| Stage | Recovery |
| --- | --- |
| Metadata/archive/host-contract validation | Fix the open source PR; bad released content needs a higher immutable version |
| Signing credentials, App token or key mismatch | Correct one-time setup; rerun the failed signing job |
| Stale PR head | Discard the old candidate; the new revision prepares automatically |
| Candidate artifact expired | Rerun the trusted preparation workflow for the open PR, then its automatic signer |
| Public URLs lag the merged bytes | Rerun URL verification; do not resign or rebuild |
| Portable-setting dispatch/reconciliation/readback | Fix credentials/network, then rerun only `Sync portable setting approvals` |
| Conflicting or mutable release | Stop and correct publication with a higher version; never replace assets |
| Registry outage | Keep the last verified cached catalog; never bypass client signatures |

Use `gh run rerun <run-id> --failed` for a failed stage, or rerun the preparation
run when its artifact needs replacing. Recovery dispatch of the existing sync
workflow is available with the exact registry revision and digest; routine
publication needs no dispatch, database update or reset. A source PR that
removes the established index/signature or all package records fails preparation.

## Emergency revocation

Add the exact package ID, version, and archive SHA-256 to `revocations.json`,
let trusted preparation sign it in the same PR, then merge after review. Verify that a
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
