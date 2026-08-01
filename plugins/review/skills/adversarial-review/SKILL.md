---
name: adversarial-review
description: Run adversarial multi-model review of code changes or documents (specs, ADRs, designs). Use when about to commit code, finalizing changes for commit, preparing to push, or when asked to review a spec, design doc, or ADR. Triggers on "adversarial review", "cross-model review", "multi-model review", "review this spec", "review this design", "review this commit".
---

# Adversarial Multi-Model Review

This skill orchestrates adversarial reviews using multiple AI models in parallel. The **orchestrator** (you) plans, dispatches, and consolidates. **Reviewers** (external models) emit structured JSON findings. A **consolidation step** merges findings deterministically.

## Roles

| Role          | Who                                                                 | Responsibility                                                                                                         |
| ------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Orchestrator  | You (Claude Code)                                                   | Detect mode, load spec, compute tags/phases/checks, build per-model prompts, dispatch, consolidate, handle orch checks |
| Reviewer      | HydraMCP models, Claude Code agents                                 | Apply assigned checks against diff/document, emit JSON findings, nothing else                                          |
| Consolidation | Code-based `cli.ts merge` (preferred) or model-assisted (fallback)  | Dedup, severity merge, S2 drop                                                                                         |

## Model Tiers

| Tier        | Models                                                          | Capabilities                                                      |
| ----------- | --------------------------------------------------------------- | ----------------------------------------------------------------- |
| `all`       | Codestral, Mistral Nemo, other local/lightweight                | Pattern matching, syntax, logic tracing from diff                 |
| `reasoning` | Current frontier models (e.g. Gemini 2.5 Pro, GPT-5.x, Claude)  | Multi-step reasoning, OWASP knowledge, architecture judgment      |
| `repo`      | Claude Code agents                                              | Browse repo beyond diff, verify file existence, read related code |

Model names above are examples, not an inventory. Always discover the currently available models with HydraMCP `list_models` before dispatching — do not request a model by a hardcoded name from this table. If a discovered model errors (e.g. requires a client upgrade), fall back to the next best in its family.

When dispatching, map each model to its tier. Checks are pre-filtered per tier -- reviewers only see checks they can evaluate.

## Deferred-work gate (both modes)

Deferred work that isn't tracked gets forgotten. On **every** review — commit or document — the orchestrator runs the `PROC-DEFER` check itself (it is not dispatched to reviewers):

1. Scan **spec/ADR prose and the PR description** for language that explicitly punts work to later: "deferred", "out of scope (for now)", "follow-up", "later", "future work", "not in this PR", "do this later", "revisit", "TBD".
2. For each such item, require an inline GitHub issue link (`#NNN` or a full URL).
3. Emit an S1 finding for any deferred item with **no** linked issue.
4. Where a link is present, verify the issue exists and is open with `gh issue view <n>`; flag dangling or closed links.

**Scope: explicit prose deferrals only.** Do NOT flag inline code comments like `// TODO` or `// FIXME` — those are intentionally out of scope for this gate.

Do not let a review pass with untracked prose deferrals. If the author confirms an item is genuinely deferred, the fix is to open a tracking issue and link it — not to delete the mention.

## Detecting the Mode

- **Commit review mode:** User is about to commit, has staged changes, or asks for a code review.
- **Document review mode:** User points at a specific file (spec, ADR, design doc) or asks for a document review.

If ambiguous, ask.

## Determining the review target (commit review)

Before planning, establish which diff is under review. Check two things:

1. **Local pending changes** — `git status`: staged or unstaged modifications to tracked files. Untracked files count only when they are intended for the commit — if unclear, ask rather than silently excluding them.
2. **An open PR for the current branch** — `gh pr view --json number,state` (resolves the current branch's own PR; prefer it over `gh pr list --head <branch>`, which can match same-named branches from forks).

| Local pending changes | Open PR on branch | Review target |
| --- | --- | --- |
| Yes | No | The local changes: the staged diff when a commit is the immediate next step; otherwise the full working-tree diff (staged + unstaged). |
| No | Yes | **The PR.** Review `gh pr diff <n>`. This is the normal case in a worktree checked out to a PR branch with nothing in flight. Include the PR description in the PROC-DEFER scan. |
| Yes | Yes | **Ask the user** how to proceed: review the local changes, the PR diff, or both together (`git diff $(git merge-base <base-branch> HEAD)` — the PR's commits plus the uncommitted work). Do not guess. |
| No | No | Nothing to review — ask the user what they want reviewed (a commit range, a branch, a document). |

## Cumulative context and PR size (commit review, non-integration branches)

When the current branch is not the repo's default branch, reviewers receive **cumulative branch context** in addition to the review-target diff — a new commit can contradict an earlier one on the branch, and increment-only reviewers cannot see that. Findings default to the review-target diff; the size table below widens or narrows that scope explicitly. Conflicts between the increment and earlier branch commits are in scope at every size.

This composes with "Determining the review target": the target from that table is the *increment*. When the target is already the PR diff, target and cumulative diff coincide and no extra context is needed — this section matters chiefly when the target is local changes on a branch that has prior commits.

**Measure the cumulative size first:**

```
BASE=$(git merge-base <base-branch> HEAD)
git diff --shortstat "$BASE"     # files / insertions / deletions
git diff "$BASE" | wc -c         # bytes; divide by 4 to estimate tokens
```

**Route context by size:**

| Size | Cumulative diff | Context strategy |
| --- | --- | --- |
| **S** | < ~15k tokens (~60 KB) | Full cumulative diff to **every** tier. Findings may target anything in the branch. |
| **M** | ~15k–100k tokens | Full cumulative diff as context to reasoning + repo tiers; the `all` tier gets the increment only. Findings scoped to the increment. |
| **L** | > ~100k tokens (~400 KB) | Reasoning tiers get the increment plus a structured context summary: changed-file tree (`git diff --stat "$BASE"`), the PR description, and the known-findings ledger. The repo-tier agent reads the full cumulative diff from disk itself. The presented review output MUST open with an advisory: *"Context-limited review — cumulative diff is N files / M lines. Schedule a full-scope checkpoint review, or reconsider whether this is still one unit of work."* |

Label context as context in reviewer prompts: "for reference — do not emit findings on unchanged context lines unless the new diff conflicts with them."

## Known-findings ledger (branches with an open PR)

Repeated reviews on the same branch must not re-flag findings that were already adjudicated. When the branch has an open PR:

- **After consolidation**, upsert a single PR comment opening with the marker `<!-- adversarial-review:ledger -->`, listing every consolidated finding with a status: `open`, `fixed`, `accepted` (user chose to keep as-is), or `rejected` (false positive). On later reviews update that comment in place — find its id by listing `gh api repos/<owner>/<repo>/issues/<pr>/comments` and matching the marker, then `gh api -X PATCH repos/<owner>/<repo>/issues/comments/<comment-id> -f body=...`. Do not append duplicate ledgers.
- **Before dispatch**, fetch the ledger and include the `accepted` and `rejected` entries in reviewer prompts as known findings: do not re-flag unless the new diff changes the evidence. `open` entries are still outstanding — carry them into the presented results without re-discovering them. `fixed` entries are verified, not trusted: confirm the fix is still present in the current diff; if it regressed, flip the entry back to `open`.
- No open PR → keep the ledger in conversation context for the session; write nothing durable.

---

## Mode 1: Commit Review

### Step 1: Orchestrator Planning

1. Get the diff for the review target established above (`git diff --staged`, `gh pr diff <n>`, etc. — see "Determining the review target").
2. Load the review spec from `${CLAUDE_PLUGIN_ROOT}/skills/code-review-checklist/config.json`.
3. Compute:
   - **Active tags** -- match changed files against tag globs and diff keywords.
   - **Active phases** -- resolve via routing rules + phase gates.
   - **Checks per model tier** -- filter by phase, tag, and tier. Exclude `meta` and `orch` kinds.
   - **High-risk notes** -- if all tags in a `high_risk_combos` entry are active, collect its note.
4. Handle `orch`-kind checks yourself (DEP-LIST, DEP-AGE, DEP-LATEST, SCH-PR, PROC-DEFER). These are not dispatched to reviewers. **PROC-DEFER runs on every review regardless of active phases/tags** -- scan spec/ADR prose and the PR description for explicit deferral language and flag any deferred item lacking a linked tracking issue (see "Deferred-work gate" below).

### Step 2: Build Per-Model Prompts

For each reviewer, build a prompt containing only:

- Output format instructions (JSON array, silence = pass)
- The checks assigned to that model's tier (pre-selected by orchestrator)
- High-risk notes (if any) -- instruct reviewers to prioritize those areas
- The diff
- Cumulative branch context and known findings per the size routing (see "Cumulative context and PR size" and "Known-findings ledger" above)

Prompt format by tier:

- `all` tier: minimal output schema (`check_id`, `severity`, `title`, `target`)
- `reasoning` / `repo` tier: full output schema (add `evidence`, `suggested_fix` for S0/S1)

Do NOT include the full checklist. Do NOT tell reviewers to walk the entire spec. Checks are pre-selected.

### Step 3: Dispatch Reviews in Parallel

Run all of these in parallel:

- **HydraMCP `compare_models`** with the best available Gemini and GPT models (run `list_models` to discover current options). These are `reasoning` tier -- give them the `reasoning`-tier prompt.
- **Claude Code agent** (`model: "sonnet"`) with the `repo`-tier prompt. This reviewer can browse the repo beyond the diff.
- **Local Codestral** (if available via HydraMCP, e.g. `lmstudio/mistralai/codestral-22b-v0.1`): `all`-tier prompt. Focus on bugs, logic errors, edge cases. If unavailable, skip without error.
- **Local Mistral Nemo** (if available): `all`-tier prompt. Same focus. If unavailable, skip without error.

All reviewers MUST output a JSON array of findings. No prose summaries, no markdown, no explanations outside the JSON structure.

### Step 4: Consolidate Findings

**Primary path (required when available):**

Write ALL reviewer findings to a single temp JSON file — one flat array combining every reviewer's output (the CLI reads exactly one file; per-reviewer files would each merge alone with reviewer_count stuck at 1). Tag each finding with a `reviewer` field — findings missing it get the CLI's source string `findings file '<path>'` as their reviewer. Then run:

```
npx tsx "${CLAUDE_PLUGIN_ROOT}/skills/code-review-checklist/cli.ts" merge --findings-file <path>
```

Use the CLI, not a direct `mergeFindings` import — the CLI validates required fields and rejects unknown severities before merging. The engine is dependency-free (vendored glob matcher), so `npx tsx` from the repo root is all that's needed. Use the JSON output as the canonical result.

**Do NOT manually simulate consolidation if execution is possible.**

**Fallback path (only if execution is not possible):**

If a TypeScript runtime is unavailable:

- Reproduce the consolidation behavior exactly:
  - dedup by `(check_id, target)`
  - max severity wins
  - apply `dedup_with` rules
  - drop S2 from a single reviewer unless `target` contains a line number
- Output must still be structured findings JSON (no prose)

Present consolidated findings grouped by severity: S0, then S1, then S2.

### Step 5: Address Concerns

Fix legitimate issues before committing.

### Step 6: Second-Pass Review

Re-run review on:

- Only the **changed code** (new diff from fixes)
- Only **unresolved findings** from the first pass

Do NOT re-run the full checklist blindly. Recompute tags/phases/checks for the new diff. If no code changed and all findings were addressed, skip.

**Documented exceptions:**
- Targeted fix flows (e.g. the `fix-pr` skill addressing review comments on already-reviewed code) may stop after one round — unless the fix grows beyond the comment's scope (new code paths, new files), in which case run the full two-pass review.
- Clean merge commits (no conflicts) skip review entirely — they contain no authored content. Conflicted merges get one review round on the conflict-resolution diff (`git show <merge-commit>`; see the `catch-up` skill).

Any other caller gets the full two-pass treatment.

---

## Mode 2: Document Review

Review a spec, ADR, or design document for correctness, completeness, and feasibility.

### Step 1: Summarize the Document

Describe its purpose, scope, and key decisions.

### Step 2: Build Review Prompts

Document reviews use the same structured output format as commit reviews but evaluate different dimensions:

- **Correctness:** Are technical claims accurate? Will the approach work? Are SQL/type mappings sound?
- **Completeness:** Missing edge cases, error paths, behavioral gaps vs current code?
- **Feasibility:** Hidden dependencies, unstated assumptions, impractical requirements?
- **Risk:** Migration risks, rollback gaps, data integrity, performance regressions?
- **Consistency:** Internal contradictions? Implementation checklist covers the design?

Instruct reviewers to emit findings as JSON:

- `check_id`: Use doc-review IDs: `DOC-CORRECT`, `DOC-COMPLETE`, `DOC-FEASIBLE`, `DOC-RISK`, `DOC-CONSISTENT`
- `severity`: S0/S1/S2
- `title`, `target` (section name or heading), `evidence`, `suggested_fix` for S0/S1

If the document contains code or SQL, also apply relevant code-specific checks from config.json (SI-SQL, SCH-\*, etc.) using the same structured output.

Always run the orchestrator-handled `PROC-DEFER` check on the document (see "Deferred-work gate" above): every deferred / out-of-scope / follow-up / future-work item in a spec or ADR must carry a linked tracking issue.

### Step 3: Dispatch in Parallel

Same model dispatch as commit review:

- HydraMCP `compare_models` (reasoning tier)
- Claude Code agent (repo tier -- can cross-reference the codebase)
- Local models if available (all tier)

### Step 4: Consolidate and Present

Same consolidation rules. Group by severity.

### Step 5: Second-Pass Review

If the user fixes the document, review only the updated sections and unresolved findings.

---

## Fallback

If HydraMCP is unavailable:

1. Fall back to CLI: `gemini -p "..."`, `claude -p "..."`, or equivalent.
2. At minimum, `claude` is always available.
3. If code-based consolidation (the `cli.ts merge` command) cannot be executed (no TypeScript runtime), fall back to model-assisted consolidation: instruct a model to dedup by (check_id, target), apply max-severity-wins, and drop single-reviewer S2 without line numbers.
4. If only one model is available, run two passes with it instead of parallel dispatch.
