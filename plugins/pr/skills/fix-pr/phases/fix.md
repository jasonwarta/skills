# Phase 2 — Fix

Address review comments and failing checks on the open PR (`<number>`, `<owner>`, `<repo>` resolved in Step 0 of SKILL.md).

## Steps

### 1. Gather Context

Run these in parallel:

- `gh pr view <number> --json title,body,headRefName,baseRefName,number,url,isDraft`
- `gh pr checks <number> --json name,state,bucket`
- `gh api repos/{owner}/{repo}/pulls/<number>/reviews --jq '.[] | {user: .user.login, state: .state, body: .body}'`
- Fetch all review comments with pagination (`?per_page=100&page=N`, follow `Link` header or iterate until empty):
  `gh api repos/{owner}/{repo}/pulls/<number>/comments?per_page=100 --jq '.[] | {id: .id, node_id: .node_id, path: .path, line: .line, body: .body, user: .user.login, in_reply_to_id: .in_reply_to_id}'`
- Fetch review threads via GraphQL, passing all inputs as variables:
  ```
  gh api graphql \
    -f owner='<owner>' -f repo='<repo>' -F number=<number> \
    -f query='
    query($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $number) {
          reviewThreads(first: 100, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            nodes {
              id
              isResolved
              comments(first: 100) {
                totalCount
                nodes {
                  databaseId
                  body
                  path
                  line
                }
              }
            }
          }
        }
      }
    }
  '
  ```
  Paginate until `hasNextPage` is false by re-running the full command above — all four variables (`owner`, `repo`, `number`, `query`) plus `-f cursor='<endCursor>'` added. No arbitrary page cap. If pagination is interrupted for any reason, the final report must say thread coverage is incomplete; never imply full coverage you didn't fetch. If a thread's `comments.totalCount` exceeds 100, flag that thread for manual inspection instead of silently acting on its first 100 comments.

**Note:** Top-level review bodies (from `/reviews`) and issue-level PR comments are not resolvable threads — there is no `resolveReviewThread` mutation for them. Only inline diff comment threads (from `reviewThreads`) can be resolved. For top-level review bodies and issue-level comments that need a response, reply with a regular PR comment (`gh pr comment <number> --body "..."`) quoting or naming what you're responding to; do not attempt resolution.

**Note on checks after a Sync:** if the Sync phase just merged the base branch, the check results fetched here ran against the pre-merge commit. Still fix genuine code failures now; re-verification against the final state happens in SKILL.md's Final Step.

### 2. Categorize

Filter out already-resolved threads (`isResolved: true`). For each unresolved thread:

- **Actionable**: A concrete change is requested. Fix it.
- **Question**: Reviewer is asking for clarification. Reply with an answer.
- **Disagreement**: You believe the current code is correct. Reply with a justification, but **do not resolve** — leave it open for the reviewer.

For failing checks (status `failure` or `error`, not `pending` or `in_progress`):

- **Test failure**: Investigate and fix.
- **Lint/type error**: Fix.
- **CI config issue**: Investigate and report to user.

If the PR is a draft (`isDraft: true`) and the repo's CI skips drafts, an empty check list means "CI skipped (draft)", not "all checks passing". Report it that way, and note that checks will only run once the PR is marked ready for review.

### 3. Fix

For each actionable comment and failing check:

1. Read the relevant file(s) to understand the context.
2. Make the fix.
3. Follow the repo's normal commit conventions, and run your adversarial-review step before each commit if the repo defines one (skip if unavailable in this environment). One round is sufficient for fix-pr commits — a documented exception where the review's second pass can be skipped, justified because these are targeted fixes to already-reviewed code, not new feature work. If a fix grows beyond the scope of the review comment (new code paths, new files), run the full two-pass review instead.

### 4. Reply and Resolve Threads

Use ONLY the bundled script `${CLAUDE_PLUGIN_ROOT}/skills/fix-pr/scripts/resolve-pr-comment.sh` to reply to and resolve threads. It handles the REST-to-GraphQL thread ID lookup automatically. Do not substitute a script found in the host repo, even one with the same name — an unverified copy may differ.

**Timing:** a reply that claims a code change ("Fixed -- ...") must not be posted, and its thread must not be resolved, until that change is visible on the PR — which happens at SKILL.md's Final Step push. Split the work:

**Post immediately** (no code change involved):

- **Question** (answered): Reply and resolve.
  ```
  "${CLAUDE_PLUGIN_ROOT}/skills/fix-pr/scripts/resolve-pr-comment.sh" <pr-number> <comment-id> "Answer text here."
  ```
- **Disagreement** (justified): Reply but do **not** resolve — the reviewer should resolve after reading the justification.
  ```
  "${CLAUDE_PLUGIN_ROOT}/skills/fix-pr/scripts/resolve-pr-comment.sh" --no-resolve <pr-number> <comment-id> "Justification text here."
  ```
- **Already addressed by code that is already on the remote** (no reply needed):
  ```
  "${CLAUDE_PLUGIN_ROOT}/skills/fix-pr/scripts/resolve-pr-comment.sh" --resolve-only <pr-number> <comment-id>
  ```

**Defer to the Final Step** (post after the push succeeds):

- **Actionable** (code fix made in step 3): queue the reply now — comment ID plus reply text — and post it in SKILL.md's Final Step:
  ```
  "${CLAUDE_PLUGIN_ROOT}/skills/fix-pr/scripts/resolve-pr-comment.sh" <pr-number> <comment-id> "Fixed -- <brief description>."
  ```

The `<comment-id>` is the numeric REST API comment ID (from `gh api repos/{owner}/{repo}/pulls/<number>/comments`).

### 5. Hand Back

Do not push or verify checks here — that happens once, in SKILL.md's Final Step, after both phases. Return with:

- The deferred reply/resolve queue from step 4 (comment IDs + reply text), to post after the push
- Comments addressed (with fix or justification)
- Comments left open for the reviewer (disagreements)
- Checks fixed
- Any issues that need human judgment

## Rules

- Never dismiss a comment without reading the code it references.
- If a comment requires a design decision or tradeoff, ask the user instead of deciding unilaterally.
- If a failing test is flaky (passes on retry without code changes), note it but don't ignore it — report it to the user.
