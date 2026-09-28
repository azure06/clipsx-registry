# ClipsX registry

`packages/` and `revocations.json` are reviewed catalog sources; `icons/`
contains versioned marketplace icons. Generated `index.json` and its detached
signature publish together on `main`. Preserve immutable assets and unrelated
changes; never edit generated signatures or commit private keys.

Use [clipsx-registry-publication](.agents/skills/clipsx-registry-publication/SKILL.md)
and [OPERATIONS.md](OPERATIONS.md) for metadata import, signing, publication or
recovery. Trusted preparation reads PR files as bounded data, never executable
code. Run `npm test`, relevant source validation and workflow checks; host
`validate-registry` remains the authoritative Discover contract check.
