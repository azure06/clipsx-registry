---
name: clipsx-registry-publication
description: Import ClipsX release metadata, validate and sign registry candidates, verify merge publication or recover a failed catalog/reconciliation stage.
---

# Registry publication workflow

1. Read [operations](../../../OPERATIONS.md) and the actual
   [trusted preparation](../../../.github/workflows/prepare.yml),
   [signer](../../../.github/workflows/publish.yml) and
   [reconciliation](../../../.github/workflows/sync-portable-settings.yml).
2. Use `scripts/import-release.mjs` for checked release metadata. Preserve
   reviewed marketplace fields and versioned icons; do not invent ad hoc field
   conversions or change immutable assets. New packages need reviewed metadata.
3. Validate exact releases and the complete catalog through the pinned host
   `validate-registry` command. Trusted automation reads bounded PR data and
   signs only a successful candidate for the current PR revision. Never execute
   PR code with signing or App credentials.
4. Keep generated index and signature in the same metadata PR. Require
   `publication-ready` and repository tests before an authorized human merge.
   Do not hand-edit generated files or create a separate publication branch/PR.
5. After merge, verify bytes at both app URLs and report portable-setting
   reconciliation/readback separately. Reconciliation failures do not require
   republishing or a database reset.
6. Follow the operations recovery table and retry only the failed stage. Discard
   stale candidates, preserve the previous signed catalog on failures and never
   bypass signature verification. Loading this skill does not authorize an
   external merge or publication.

Versions, schemas, keys and environment requirements live in their authoritative
sources and operations guide, not in this skill.
