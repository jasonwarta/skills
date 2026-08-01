# CLAUDE.md — skills

A collection of Claude Code skills, packaged as an installable plugin marketplace.
Guidance for agents and contributors working in this repository.

## Layout

Standard Claude Code marketplace:
- `.claude-plugin/marketplace.json` lists the plugins.
- Each `plugins/<name>/` has `.claude-plugin/plugin.json` and one or more
  `skills/<skill>/SKILL.md` (plus `phases/`, `reference/`, `templates/`, or engine files
  as a skill needs).

Plugins: `spec`, `review`, `pr`, `orchestrator`, `hours-tracker`, `release-notes`.

## Install

```
/plugin marketplace add jasonwarta/skills
/plugin install <plugin>@jasonwarta      # e.g. spec@jasonwarta
```

Or point it at a local checkout: `/plugin marketplace add ~/projects/skills`.

## Adding or editing a skill

- A skill is a `SKILL.md` with YAML frontmatter (`name`, `description`, optional
  `allowed-tools`, etc.) under `plugins/<plugin>/skills/<skill>/`.
- Keep each `plugin.json` `name` in sync with its `marketplace.json` entry, and bump
  `version` on changes.
- Skills should be **repo-agnostic**: no hardcoded org/repo/branch assumptions —
  parameterize (default branch, base branch, client name) rather than baking them in.
- `review`'s `code-review-checklist/config.json` ships a **starter** paths→severity
  config; treat its rules as examples to customize per project.

## The review engine

`plugins/review/skills/code-review-checklist/` is a small TypeScript engine. If you change
`engine.ts`/`cli.ts`/`types.ts`, run `example.ts` (`npx tsx example.ts`) and any tests
before committing — the checklist skill depends on the config schema staying stable.
