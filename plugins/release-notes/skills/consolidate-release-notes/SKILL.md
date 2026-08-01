---
name: consolidate-release-notes
description: Consolidate multiple draft GitHub releases into a single set of release notes. Use when the user wants to combine/merge draft releases, clean up accumulated drafts before deploying, or prepare release notes that span multiple versions.
disable-model-invocation: true
allowed-tools: Bash(gh *)
---

# Consolidate Release Notes

## Execution Context

This skill runs primarily **unattended in CI** (`claude-consolidate-release-notes.yml` invokes it with a prompt that says to skip the review step; a follow-up workflow step verifies exactly one draft remains). Manual interactive runs are rare. When running unattended, never block waiting for input — apply the fail-safe actions marked "unattended:" below.

Find any draft releases created since the last published release. Generate consolidated release notes by combining the individual draft notes and GitHub diffs across all drafts. The consolidated notes replace the per-version drafts with a single set of notes on the most recent draft, covering everything since the last published release.

Note: Each individual draft release already has AI-generated notes (from the `claude-release-notes.yml` GitHub Action) containing summary and technical sections. Your job is to consolidate across multiple drafts — deduplicating, grouping related changes, and producing a cohesive result.

## Output Structure

The notes must contain two sections, wrapped in HTML comment markers:

1. **Summary** (between `<!-- SUMMARY -->` and `<!-- /SUMMARY -->`): Brief, non-technical, user-facing notes. End users don't care about implementation details — focus on what changed from their perspective. Keep it as concise as possible. A deploy pipeline may extract only this section to post to a user-facing notification channel.

2. **Technical Details** (between `<!-- TECHNICAL -->` and `<!-- /TECHNICAL -->`): More detailed notes for developers, **grouped by version** (most recent first). Each version gets a bold heading followed by its list of changes. This makes it easy to trace a specific fix back to a particular release for git blame or bisect. Reference specific components, APIs, bug fixes, and behavioral changes. Still concise, but include enough detail to be useful for someone reviewing what shipped.

After both sections, append a links section wrapped in `<!-- LINKS -->` / `<!-- /LINKS -->` comment markers.

Example structure:
```
<!-- SUMMARY -->
<b>What's New:</b>
<ul>
<li>Fixed an issue where items could appear duplicated in the activity feed</li>
<li>Improved loading speed of the dashboard page</li>
</ul>
<!-- /SUMMARY -->
<!-- TECHNICAL -->
<b>Technical Details:</b>
<br>
<b>8.24.3</b>
<ul>
<li>Fixed duplicate event processing in the ingest worker by deduplicating on message id (<a href="https://github.com/your-org/your-repo/pull/3412">#3412</a>)</li>
</ul>
<b>8.24.2</b>
<ul>
<li>Added index on <code>events.created_at</code> to improve dashboard query performance (<a href="https://github.com/your-org/your-repo/pull/3415">#3415</a>)</li>
</ul>
<!-- /TECHNICAL -->
<!-- LINKS -->
<b>Full Changelog:</b> <a href="https://github.com/your-org/your-repo/compare/8.23.0...8.24.3">8.23.0...8.24.3</a>
<a href="https://github.com/your-org/your-repo/releases/tag/8.24.3">View full release notes on GitHub</a>
<!-- /LINKS -->
```

(Example URLs show a resolved slug for realism. Never copy URLs from examples — always build them from `{repo_slug}` resolved in step 0.)

## Formatting Requirements

The release notes body is intended to be consumed by a chat/notification integration (e.g. Slack, Google Chat, Microsoft Teams) that posts them to a channel and renders HTML. The notes must:

- Use valid HTML only — no markdown. Use tags like `<b>`, `<i>`, `<a href="...">`, `<br>`, `<code>`, and `<ul>`/`<li>` for structure.
- Be valid for embedding in a JSON string — the workflow will handle any necessary JSON escaping. Do not include literal newline characters inside HTML tag content; use `<br>` tags or HTML block elements (`<ul>`, `<li>`, `<p>`) for line breaks and structure instead. Newlines between HTML tags (for readability) are fine.
- Avoid any characters or sequences that would break JSON parsing (e.g., unescaped control characters, tabs).

## Steps

0. Resolve the repo slug once: `gh repo view --json owner,name --jq '"\(.owner.login)/\(.name)"'` → use as `{repo_slug}` in every API call and URL below. Never hardcode the org — this repo has changed owners before.
1. Use `gh release list --limit 100 --json tagName,isDraft,publishedAt` to identify the last published release (`isDraft: false`) and all draft releases created after it. Filter explicitly on `isDraft` — do not infer draft status from list position. If the last published release isn't in the first 100 entries, increase the limit. If there are zero drafts, there is nothing to consolidate — exit cleanly saying so. If there is exactly one draft, consolidation is a no-op: unattended, leave it untouched and exit successfully (its notes already exist from `claude-release-notes.yml`, and the CI verify step expects exactly one draft); interactive, ask whether the user wants its notes regenerated anyway. Sanity-check ordering: every draft's semver must be greater than the last published release's tag. If a published release is interleaved among the drafts, abort with a clear error describing the anomaly — the changelog base and the "broken before the oldest draft" reasoning both depend on clean ordering. Never proceed past an interleaved-release anomaly, attended or not.
2. For each draft release, fetch its notes with `gh release view <tag> --json body`. If a draft's body is empty or minimal (e.g., just a PR title), fall back to the tag annotation via the GitHub API: resolve the ref with `gh api "repos/{repo_slug}/git/ref/tags/<tag>"` and inspect `.object.type` and `.object.sha`. If the type is `tag`, fetch `gh api "repos/{repo_slug}/git/tags/<sha>" --jq '.message'` to get the annotated tag message. If the type is `commit`, the tag is lightweight and has no tag message to recover. This stays within the skill's `gh *` tool allowlist and, for annotated tags, avoids GPG signature blocks that raw git format strings would include. If neither the release body nor an annotated tag message yields useful notes, continue without recovered notes for that release.
3. Get the diff between each consecutive pair of release tags using `gh api "repos/{repo_slug}/compare/{base}...{head}"` to understand what changed. The pairs are independent — run these compare calls in parallel, not one at a time. (For the oldest draft, `{base}` is the last published release tag.) Note the compare API caps commits at 250 per page (paginate via `total_commits` if needed) and file lists at 300 entries — for unusually large ranges, treat the file list as incomplete context, not ground truth.
4. Synthesize all draft notes and diffs into a single consolidated set of release notes following the two-section structure above. The summary should deduplicate and consolidate related changes — when multiple patches address the same feature or fix, present a single item describing the **final state only**. The technical details section should group items by version (most recent first), with each version as a bold heading followed by its changes. This preserves traceability to specific releases for git blame/bisect.
   **PR links:** Each technical detail item must include a link to its PR. If the individual draft notes already contain PR links (`<a href="...pull/NNNN">#NNNN</a>`), preserve them. If they don't, extract PR numbers from merge commit messages (`(#NNNN)` format) and add links: `(<a href="https://github.com/{repo_slug}/pull/NNNN">#NNNN</a>)`. This is critical -- the PR description contains post-merge action items (deploy SQL, migration scripts, manual steps) that the deployer needs to check at release time.
5. Keep the summary language non-technical and concise — focus on what changed from the user's perspective, not implementation details. Apply the **"explain it" test**: if it would take a developer or technical person to explain what a bullet point means, it does not belong in the Summary. The audience is people who use your product, not developers.

   **Exclude from the Summary** any change where:
   - The impact is invisible or nearly invisible to end users (CI/CD, deploy pipelines, GitHub Actions, release notification plumbing)
   - The change only affects developers (Claude Code hooks, ESLint rules, daemon behavior, MCP configs, worktree management, console.log cleanup)
   - The change is infrastructure or ops (CloudWatch, PM2, Terraform, cron schedules, Sentry/PostHog internal config, Node version upgrades, webpack targets)
   - The change is a pure refactor with no behavior change (barrel exports, type safety improvements, code reorganization)
   - The user-visible impact is real but too minor or edge-case to warrant a bullet point, AND explaining it would require technical context the reader doesn't have
   - The change affects a part of the app users don't actively see or interact with (version numbers, diagnostic metadata, admin-only internals, footer details)

   **Include in the Summary** only when an end user would notice the difference in their normal use of the app AND understand the bullet point without further explanation — a new capability, a fix for something that was visibly broken, or a change to how they interact with the app.

   If every draft release in the batch falls into the exclude categories, the Summary section should be empty (just the markers with nothing between them). A deploy pipeline can handle empty summaries by skipping the external user-facing notification.

   Apply the **"final state" rule** aggressively in the summary:
   - If a feature was added in one release and then adjusted/fixed in subsequent releases, describe the feature once as it exists now — not as "added X" followed by "fixed X" and "tweaked X".
   - If multiple releases contain fixes to the same area (e.g., "fix chart rendering", "fix chart axis labels", "fix chart tooltip alignment"), collapse them into a single entry describing the end result (e.g., "Fixed chart rendering issues").
   - The reader should never see a sequence of entries that tells the story of iterative development. They should see the outcome.
   - Only mention something as a "fix" in the summary if it was broken before the oldest draft release being consolidated. If a bug was introduced and fixed within the same batch of drafts, it never existed from the summary reader's perspective — describe the working feature instead. (The technical details section should still list the individual changes per version for traceability.)

   After drafting the summary, **make a second pass** reviewing each bullet against the full list of drafts. For every summary item, check: was this feature or the thing it fixes introduced within this same batch of drafts (i.e., after the last published release)? If so, it's not a fix from the reader's perspective — either fold it into the description of the new feature or drop it entirely. This catches follow-up bug fixes, config corrections, and iterative polish on things that were never shipped to prod in a broken state.
6. Append a links section wrapped in `<!-- LINKS -->` / `<!-- /LINKS -->` comment markers containing a full changelog link and a release link in this exact format, where `{base}` is the last published release tag, `{head}` is the most recent draft release tag, and `{repo_slug}` comes from step 0:
   ```
   <!-- LINKS -->
   <b>Full Changelog:</b> <a href="https://github.com/{repo_slug}/compare/{base}...{head}">{base}...{head}</a>
   <a href="https://github.com/{repo_slug}/releases/tag/{head}">View full release notes on GitHub</a>
   <!-- /LINKS -->
   ```
7. Interactive runs only: present the consolidated notes for review — a rendered markdown version (for readability) and the raw HTML that will be published — and ask the user to approve or request changes. Unattended: skip this step and proceed; the CI prompt authorizes direct updates.
8. Once approved, update the most recent draft release with the consolidated notes using `gh release edit <tag> --notes <notes>`.
9. **Verify before deleting:** re-fetch the most recent draft (`gh release view <tag> --json body`) and confirm the body now contains the consolidated notes (check for the `<!-- SUMMARY -->` and `<!-- LINKS -->` markers and a spot-check line). Only after verification succeeds, delete all older draft releases using `gh release delete <tag> --yes`. If verification fails, stop — deleting the older drafts at that point would destroy the only copies of their notes. Only the most recent draft with the consolidated notes should remain. **NEVER pass `--cleanup-tag` when deleting releases.** Git tags carry annotated release notes and are the only record of per-version changes after drafts are cleaned up. Deleting a tag is irreversible and destroys traceability. Always preserve tags.
