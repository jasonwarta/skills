---
name: hours-tracker
description: Generate monthly billing for a client from git history. Run at end of month to produce a daily hours breakdown with per-day charge rates based on work categories. Use when the user says things like "figure out billing", "hours for this month", "what do we bill the client", or "run hours tracker".
---

# Hours Tracker

Generate a daily hours-and-billing CSV for the current (or specified) month. Each row is one work day with hours estimated from commit timestamps, work categorized from commit/PR/issue data, and a charge rate computed per day from the category mix.

## Quick Start

Default behavior (no arguments): generate for the previous calendar month, using the configured git author, output to `~/Downloads/`.

Ask the user only if:
- They want a different month or date range
- They want a different author
- They mention time off that needs to be zeroed out

## Data Collection

Collect in parallel. Substitute `<author>` with the git author you are billing for.

### 1. Commits with line stats
```bash
git log --all --author="<author>" \
  --since="<month-start>" --until="<month-end+1>" \
  --format="COMMIT|%H|%aI|%s" --numstat
```
Pass one or more `--author=` values to match every name/email variant the author commits under.
Filter out: merge commits, version bumps (`bump version`).
Dedupe rebased duplicates: the same commit can appear under multiple SHAs across rebased branches — count a (author date, subject) pair once. Hour spans are immune (author dates survive rebase), but line counts would double-weight categories.

### 2. Tags with annotations
```bash
git tag -l --format='%(creatordate:iso-strict)|%(refname:short)' --sort=-creatordate
git tag -l --format='%(contents)' <tag-name>
```
Parse "What's New" and "Technical Details" sections.

### 3. Pull requests

Run two searches and union the results — `created:` alone misses long-lived PRs that were merged during the target month but created earlier:
```bash
gh pr list --author=@me --state=all --limit=500 \
  --json number,title,createdAt,mergedAt,closedAt,state \
  --search "created:<month-start>..<month-end>"
gh pr list --author=@me --state=all --limit=500 \
  --json number,title,createdAt,mergedAt,closedAt,state \
  --search "merged:<month-start>..<month-end>"
```
Also fetch commit timelines for bookending PR detection:
```bash
gh pr view <number> --json commits --jq '.commits[].committedDate'
```
This is slow (~1 req/PR). Only fetch for PRs created or merged within 30 days of the target month.

### 4. Issues
```bash
gh issue list --state=all --limit=100 \
  --json number,title,closedAt,updatedAt,state \
  --search "involves:<author> updated:<month-start>..<month-end>"
```

## Work Day Assignment

**8am cutoff**: commits before 8am belong to the previous calendar day. Many authors start late and work past midnight, sometimes into the early morning; the cutoff keeps a single late-night session on one day.

## Hours Estimation

### Days with commits
1. Normalize timestamps: hours before 8am become `hour + 24`.
2. `estimated = max(timestamps) - min(timestamps) + 2.5` (buffer for pre/post-commit work).
3. **Floor: 13 hours. Cap: 20 hours.**

These values were calibrated against Claude Code session logs (over a two-month window where both data sources overlapped). Days hitting the floor averaged ~13.5h of actual Claude session activity; the 2.5h buffer matched the median delta on above-floor days. Recalibrate the floor, cap, and buffer against your own session data before relying on them.

### Gap days (weekdays, no commits)
- **13 hours** default.
- Weekends without commits are excluded entirely.
- Context from **bookending PRs** (author had commits within `gap_length + 7 days` on both sides) and **issues** updated during the gap.
- Do NOT use "open PRs" as signal -- many sit open for months without active work.

### Waking-hours gap deduction (when Claude logs are available)

For months where Claude Code session logs exist (`~/.claude/projects/`), apply an additional correction:

1. Parse all session timestamps for the day, converted to the author's local time via a named IANA zone (e.g., `America/New_York`). Do not hardcode a fixed offset; daylight-saving transitions shift the waking-hours window by an hour, so winter billing months would otherwise be off.
2. Find gaps > 3 hours that fall within **waking hours (9am - midnight local)**.
3. Deduct those gaps from the day's hours. Floor at 8h after deduction.

Gaps <= 3h are NOT deducted (short breaks, non-Claude work, thinking time). Gaps during midnight-9am are NOT deducted (sleep, already excluded by cutoff). This typically reduces ~7% of hours in months where it applies.

### Weekends with commits
Included with commit-based hour calculation, same as weekdays.

## Category Classification

Keyword matching on commit subjects, most-specific-first. The rule set below is an example tuned for a hardware/IoT product; replace the categories with ones that fit your own project's domain. ~60 rules covering:
- Hardware/operations: cable*, logger*, sensor*, site*, geo/map, ERP integration, pricing/BOM, orders, email ingestion, notifications, domain-specific charts
- Platform: CI/CD, AWS/Terraform, dev tooling, framework upgrades, testing, release management, CLI, analytics, security, reporting, landing page/CMS, MCP server product (MCP tools/specs)
- Mixed: auth, database migrations, bug fixes, UI components, documentation

When uncategorized commits exceed ~5%, add new rules.

## Percentage Weighting

Blended score per category per day:
- **70% lines changed** (additions + deletions)
- **30% commit count**

### Multipliers on lines changed
| Category | Multiplier | Rationale |
|----------|-----------|-----------|
| Documentation/specs/ADRs | 5x | Planning artifacts require ~5-10x more thinking per line (validated by Claude session data: ADR sessions consume 60-100% of daily effort but produce 10-20% of lines) |
| Bug fixes | 2x | Investigation time dwarfs the code change |

### Formatting
- Round to nearest 5% (min 5% per category).
- Max 6 named categories; remainder rolled into "other (...)".

## Charge Rate (Per Day)

Each work category has a billable-attribution rate — the share of that work you charge to the client. Set the tiers and rates to match your own engagement; the values below are an example split.

| Tier | Rate | Categories |
|------|------|-----------|
| Clearly billable to the client | 80% | Domain/product features the client pays for (e.g., hardware/device management, sites/geo, ERP integration, pricing/BOM, orders, email ingestion, notifications, domain charts, maps) |
| Clearly internal / not billable | 20% | Work that benefits your own infrastructure (e.g., CI/CD, AWS/Terraform, dev tooling/MCP, in-house product surfaces, framework upgrades, linting/refactoring, testing infra, release management, CLI, analytics, security, reporting, landing page/CMS) |
| Mixed | 50% | Shared work (e.g., auth/permissions, database migrations, bug fixes, UI components, API validation, feature development, cleanup) |

**Documentation/specs/ADRs are topic-aware**: instead of a flat 50%, the attribution depends on what the doc is about. An ADR about a client-facing feature gets the billable (high) rate; an ADR about internal infrastructure gets the internal (low) rate. Determine by matching the commit subject against your billable/internal topic keywords.

**Per-day charge rate** = weighted average of attribution rates across that day's categories, rounded to nearest 5%.

Example: a day with 40% client-feature work (80%) + 60% CI/CD (20%) = `0.4*0.8 + 0.6*0.2 = 44%`, rounded to 45%.

## Output Format

CSV at `~/Downloads/hours_<YYYY-MM>.csv`:

```
Sort, Name, Date, Hours worked, Charge %, Total charged, Month, Task worked on, Details, Tags
```

- **Charge %**: per-day billable rate from category attribution (e.g., "65%")
- **Total charged**: hours * charge rate
- **Task worked on**: category percentages
- **Details**: narrative from tags, issues, PRs, commits
- **Tags**: version tags released that day

## Post-Generation Review

Present to the user:

1. **Monthly summary table**: total hours, billable hours, effective charge rate.
2. **Gap days > 3 consecutive weekdays** -- ask if they were working or on PTO.
3. **Holidays with 0 commits/issues** -- confirm zeroing out.
4. **Days with > 20h raw span** -- flag for review.
5. **Any new uncategorized commit patterns** -- propose new rules.

Then ask: "Any time off or adjustments?"

## Updating the Methodology Doc

If `~/Downloads/hours_methodology.md` exists, append the new month's summary. If not, generate it from scratch with these sections:

1. **Purpose** — what the document is and who reads it.
2. **Data sources** — git log, tags, PRs, issues, Claude session logs (with the commands used).
3. **Work day assignment** — the 8am cutoff rule.
4. **Hours estimation** — span formula, buffer, floor/cap, gap-day defaults, waking-hours deduction, and the calibration basis for each.
5. **Category classification** — the keyword-rule approach and current rule count.
6. **Percentage weighting** — 70/30 blend, multipliers, rounding.
7. **Charge rate tiers** — the billable/internal/mixed attribution table and topic-aware docs rule.
8. **Per-month summaries** — appendix, one entry per generated month (totals, effective rate, adjustments made).
