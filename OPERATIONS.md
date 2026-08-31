# Registry operations

## Normal release

Validate the immutable extension release, review its requested permissions and
catalog copy, merge the package metadata, then run the protected publication
workflow. The workflow generates deterministic index bytes and signs those exact
bytes. Do not edit generated index or signature files manually.

## Failure handling

- Validation failure: correct the source or publish a new extension version. Do
  not replace an existing release asset.
- Publication failure: leave the previous signed index live and rerun only after
  fixing the workflow or metadata.
- Registry outage: ClipsX retains its last verified catalog. Never bypass client
  signature checks to recover availability.

## Emergency revocation

Add the exact package ID, version, and archive SHA-256 to `revocations.json`,
merge after review, and run the protected publication workflow. Verify that a
fresh install is blocked and an installed matching release is quarantined.

## Key rotation

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
