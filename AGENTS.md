# ClipsX registry

`packages/` and `revocations.json` are reviewed catalog sources; `icons/`
contains versioned marketplace icons. Generated `index.json` and its detached
signature publish together on `main`. Preserve immutable assets and unrelated
changes; never edit generated signatures or commit private keys.

Use [clipsx-registry-publication](.agents/skills/clipsx-registry-publication/SKILL.md)
and [operating instructions](.agents/skills/clipsx-registry-publication/references/operations.md) for metadata import, signing, publication or
recovery. Trusted preparation reads PR files as bounded data, never executable
code. Run `npm test`, relevant source validation and workflow checks; host
`validate-registry` remains the authoritative Discover contract check.

## Documentation maintenance

After completing a task, review affected documentation and skills. Update the authoritative source only. Remove obsolete statements and duplication; simplify existing text before adding sections. Describe current behavior, not implementation history. Code and tests own implementation details; retain contracts and operational requirements that cannot be safely inferred. Do not claim passing checks or production availability without evidence. Avoid maintaining roadmaps or completed investigation reports.
