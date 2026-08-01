---
name: fix-pr
description: Get a pull request in sync and fixed — merge the base branch into the PR branch (resolving conflicts and downstream release impacts), then address review comments, resolve threads, and fix failing checks, with a single push at the end. Use when the user wants to fix PR feedback, respond to reviewers, address review comments, resolve PR threads, fix failing CI checks, sync/update/catch up a branch with its base branch, or pastes a PR URL with issues to address.
---

# Fix PR

Bring a pull request fully up to date in two phases: **Sync** the branch with its base branch, then **Fix** review comments and failing checks. Commits accumulate locally across both phases and are pushed once at the end, so CI runs a single time against the final state.

## Scope

The default is both phases, in order (Sync first, so fixes are written against the current base and CI reflects the merged state). Narrow the scope when the user asks for less:

- Sync-only ask ("catch up", "merge the base branch in", "my branch is behind") → run Sync, then stop. Do not touch review comments.
- Fix-only ask is still preceded by a Sync check — if the branch is behind its base, say so and confirm whether to sync first; if the user declines, run Fix alone.
- No open PR → Sync only, against the repo default branch. Report that there is no PR to fix.

## Step 0 — Resolve Context

Run once, up front:

1. **Repo**: `gh repo view --json owner,name,defaultBranchRef --jq '{owner: .owner.login, name: .name, defaultBranch: .defaultBranchRef.name}'`. If this fails or returns empty values, stop and tell the user — all downstream API calls depend on it.
2. **PR**: if a PR number was provided as an argument (e.g. `/fix-pr 123`), use it. Otherwise detect the PR for the current branch: `gh pr view --json number,state,headRefName,baseRefName,isDraft,url`. Verify `state` is `OPEN` — `gh pr view` happily returns a merged or closed PR for the branch.
3. **Branch match**: verify the current branch (`git branch --show-current`) equals the PR's `headRefName`. If it doesn't — common with explicit PR-number arguments and multi-worktree setups — stop and tell the user which branch the PR expects; never sync or fix on a branch that isn't the PR's head.
4. **Base branch**: the PR's `baseRefName` when a PR exists; otherwise the repo default branch.

## Phases

Detailed instructions live in files alongside this one. **Read the phase file in full before starting that phase.**

| Phase | File | Run when |
|---|---|---|
| 1. Sync | `phases/sync.md` | The branch is behind `origin/<base>`. The phase file's step 1 contains the exact check; if the branch already contains everything on the base, report that and skip. |
| 2. Fix | `phases/fix.md` | An open PR exists with unresolved review threads, top-level review bodies or PR comments needing a reply or requesting changes, or failing checks. |

If neither phase has work, report that the PR is already in sync and clean, and stop.

## Final Step — Push, Verify, Report

1. Push the branch (only if there is an open PR, or the user asked for a push; for a PR-less sync, report and let the user push).
2. **After the push succeeds**, post the deferred actionable-thread replies and resolutions queued by the Fix phase (fix.md step 4) — only now are the fixes visible on the PR, so only now is a "Fixed" reply truthful.
3. If the PR is a draft, note that some repos configure CI to skip draft PRs — an empty check list then means "CI skipped (draft)", not "all checks passing". Report it that way and skip check polling.
4. Otherwise wait for checks to start, then verify: `gh pr checks <number> --json name,state,bucket`. If checks are still `in_progress` or `queued`, poll up to 10 minutes (30s intervals). If still pending after the timeout, report them as pending rather than passing.
5. Report a combined summary:
   - Sync: base-branch releases merged in, conflicts resolved (files + approach), post-merge fixes applied.
   - Fix: comments addressed (with fix or justification), comments left open for the reviewer (disagreements), checks fixed.
   - Checks still pending or flaky, and anything that needs human judgment.
   - Whether the user should re-run the full test suite (particularly when the post-merge checks covered only affected packages).

## Rules

- Never dismiss a review comment without reading the code it references.
- If a comment, conflict, or check failure requires a design decision or tradeoff, ask the user instead of deciding unilaterally.
- Never force-push or rewrite history without explicit user approval.
- Never use `--no-verify` (or otherwise bypass hooks) when committing — if a hook fails, fix the underlying issue.
- Commit the merge and each logical fix as separate commits for clear history.
- Follow the host repo's CLAUDE.md conventions. In particular, if the repo requires a review step before commits (e.g. an adversarial-review skill), honor it — the phase files note the sanctioned exceptions.
- Prefer structured MCP tools (for git, tests, builds, and linting) over raw CLI commands when they are available.
