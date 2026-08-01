# skills

A collection of [Claude Code](https://docs.claude.com/en/docs/claude-code) skills,
packaged as an installable plugin marketplace.

## Install

```
/plugin marketplace add jasonwarta/skills
/plugin install <plugin>@jasonwarta
```

## Plugins

- **spec** — phased feature-design workflow: Discovery → optional ADR → Specification, with a real decision gate.
- **review** — adversarial multi-model code/spec review, backed by a machine-optimized code-review-checklist engine with a customizable paths→severity config.
- **pr** — keep a pull request healthy: sync its branch with the base, then address review comments and failing checks.
- **orchestrator** — the Principal-Engineer `orchestrate` skill for dispatching disciplined execution across interchangeable AI workers (the [Loom](https://github.com/jasonwarta/loom) platform).
- **hours-tracker** — generate monthly billing from git history: a daily hours breakdown with per-day charge rates by work category.
- **release-notes** — generate and consolidate GitHub release notes from commits and draft releases.

## Layout

A standard Claude Code marketplace: `.claude-plugin/marketplace.json` lists the plugins;
each `plugins/<name>/` holds a `plugin.json` and its skills. See the individual
`SKILL.md` files for what each skill does and when it triggers.

## License

MIT — see [LICENSE](./LICENSE).
