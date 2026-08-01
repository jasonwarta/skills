# Phase 1 — Sync

Bring the current feature branch up to date with its base branch (`<base>`, resolved in Step 0 of SKILL.md) by merging in new changes, resolving conflicts, and addressing any impacts from releases that landed since the branch diverged.

## Prerequisites

- The current branch must NOT be the base branch itself. If it is, stop and tell the user.
- No uncommitted changes to tracked files (`git diff --quiet && git diff --cached --quiet`). If dirty, stop and tell the user to commit or stash first. Untracked files are fine — they don't block a merge.
- Verify you are in the correct worktree: `git worktree list` — confirm the listed path matches the current working directory. (Harmless in repos without extra worktrees; do not skip it.)
- Check for diverged upstream: run `git status -sb`. If the branch has diverged from its upstream (shows `[ahead N, behind M]`), stop and tell the user — they may need to reconcile before catching up. A branch with no upstream configured (no bracket suffix at all) is normal — proceed.

## Steps

### 1. Fetch and Determine the Branch Point

Fetch first so all refs are up to date:

```
git fetch origin <base>
```

Then find where the current branch diverged from the base:

```
git merge-base HEAD origin/<base>
```

Save this commit hash — it's the "branch point."

**Early exit:** if the branch point equals `git rev-parse origin/<base>`, the branch already contains everything on the base. Report that and skip the rest of this phase.

### 2. Identify Tagged Releases Since Branch Point

List all tags that are reachable from `origin/<base>` but not from the branch point:

```
git tag --merged origin/<base> --no-merged <branch-point>
```

Filter to the repo's release-tag convention. For example, a repo whose main releases are bare semver can be filtered with `grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' | sort -V` to exclude prefixed tag series (e.g. `cli-v*`, `api/*`, `deploy/*`). Inspect the unfiltered list and any repo docs to learn the convention before filtering. If the list is empty, the base moved but no release was tagged; note that and continue to the merge with whatever context the commit log provides.

For each release tag, fetch the release notes:

```
gh release view <tag> --json tagName,body --jq '{tag: .tagName, notes: .body}'
```

If a release exists but has an empty body, note it as "release notes pending" and continue — don't skip the tag. If no release exists for a tag, fall back to the annotated tag message:

```
git tag -n999 <tag>
```

### 3. Analyze Release Impact

For each tagged release identified in step 2:

1. Read the release notes (summary and technical sections).
2. Get the diff between consecutive tags (or from branch point to first tag) to understand what changed. Use local git — the GitHub compare API truncates file lists at 300 entries, while local diff is complete:
   ```
   git diff --name-only {base}..{head}
   ```
   (Tags pointing into the fetched `origin/<base>` history are auto-followed by `git fetch`. If a tag is missing locally, fetch it: `git fetch origin tag <tag>`.)
3. Compare the changed files against the files modified on the current branch:
   ```
   git diff --name-only <branch-point>..HEAD
   ```
4. Identify overlaps — files changed in both the releases and the current branch. These are high-risk areas for conflicts and semantic issues.

Present a summary to the user:

- Number of releases since the branch diverged
- Key changes in each release (from release notes)
- Files with overlap between branch and base-branch changes
- Any potential impacts (dependency updates, API changes, schema migrations, config changes, style/lint rule changes)

**Ask the user to confirm before proceeding with the merge.**

### 4. Merge

```
git merge origin/<base> --no-ff --no-edit
```

`--no-ff` guarantees a merge commit even when the branch has no commits of its own — step 6 relies on the merge commit's two parents existing.

This will either:

- **Succeed cleanly** — the merge commit is created automatically. Proceed to step 6.
- **Fail with conflicts** — the merge is paused. Proceed to step 5 to resolve, then you will manually complete the merge commit.

### 5. Resolve Merge Conflicts

If there are conflicts:

1. List all conflicted files: `git diff --name-only --diff-filter=U`
2. For each conflicted file:
   - Read the file to understand the conflict markers.
   - Use the release notes context from step 3 to understand the intent of both sides.
   - Resolve the conflict, preferring correctness over either side "winning."
   - If a conflict requires a design decision or is ambiguous, stop and ask the user.
3. Stage all resolved files with `git add`.
4. Complete the merge commit: `git commit --no-edit` (this finalizes the paused merge using the auto-generated merge message).
5. **Review the conflict resolutions.** Run your adversarial-review step (if the repo defines one) on the combined diff of the merge commit (skip if unavailable in this environment) — `git show <merge-commit>` shows exactly the hunks that differ from both parents, i.e. the resolutions you authored. Address any findings as fix commits in step 7. (A clean merge with no conflicts skips this — it contains no authored content; that is the documented exception to review-before-every-commit.)

### 6. Post-Merge Checks

Save the merge commit hash for use in this step: `git rev-parse HEAD` → `MERGE_COMMIT`.

After the merge is complete, check for issues that wouldn't show up as git conflicts but still need attention. Use `<branch-point>..${MERGE_COMMIT}^2` (what changed on the base since the branch diverged) — NOT `^1..^2`, which diffs the two parents directly and falsely includes the branch's own changes:

1. **Dependency changes**: Check if dependencies or package-manager config changed on the base:
   ```
   git diff --name-only <branch-point>..${MERGE_COMMIT}^2 -- '**/package.json' '**/yarn.lock' '**/.yarnrc.yml' '**/.yarn/**' '**/package-lock.json' '**/pnpm-lock.yaml'
   ```
   If any of these files changed, run the repo's install command (`yarn install`, `npm ci`, etc.) to sync.
2. **Schema/migration changes**: If any database migrations landed on the base, note them for the user.
3. **Lint/style changes**: Check if lint configs changed on the base:
   ```
   git diff --name-only <branch-point>..${MERGE_COMMIT}^2 -- '**/.eslintrc*' '**/eslint.config.*' '**/biome.json' '**/.prettierrc*' '**/tsconfig*.json'
   ```
   If config files changed, run the linter on the branch's changed files to catch new violations (prefer a structured lint MCP tool when available).
4. **Type checking**: Run type checking on affected packages to catch type errors introduced by the merge (prefer a structured build/typecheck MCP tool when available).
5. **Tests**: Run tests for packages that have overlapping changes (prefer a structured test-runner MCP tool when available).

**Note on version bumps**: Do NOT update `package.json` version fields on the feature branch to match the base's automated version bumps. The version on the base branch is managed by CI. The merge will bring in the base's version, which is correct — do not manually adjust it further.

### 7. Fix Issues

For any issues found in steps 5-6 (conflict-resolution review findings and post-merge check failures):

- Fix lint violations, type errors, and test failures.
- Commit fixes separately from the merge commit with clear commit messages (e.g., "fix: resolve lint violations after merging the base branch").
- Run your adversarial-review step before each commit if the repo defines one (skip if unavailable in this environment).

Do not push yet — pushing happens once, after the Fix phase, per SKILL.md's Final Step.
