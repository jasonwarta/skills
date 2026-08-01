---
name: gen-release-notes
description: Generate release notes for a specific release tag. Use when the user wants to write, create, or draft release notes for a version/tag, or a release is missing its notes.
disable-model-invocation: true
allowed-tools: Bash(gh *)
---

# Generate Release Notes

Generate release notes for the release tag provided as the first argument (e.g. `/gen-release-notes 8.30.6`).

An optional **second argument** is the exact predecessor tag defining the changelog range (e.g. `/gen-release-notes 8.30.6 8.30.5`). When provided, use it directly as the previous tag and skip the release-list resolution in step 1. CI passes this to avoid a race: when the merge queue creates several tags within seconds, the eventually-consistent release list can yield the wrong predecessor (or omit the just-created target), which previously caused the skill to abort and leave notes empty.

If no first argument is provided, ask the user which release tag to generate notes for.

## Execution Context

This skill runs primarily **unattended in CI** (`claude-release-notes.yml` invokes it with a prompt that says to skip the review step). Manual interactive runs are rare. When running unattended, never block waiting for input — apply the fail-safe actions marked "unattended:" below. Only ask questions when a human is actually present.

## Constraints

- ONLY look at the commit messages between the target tag and the immediately preceding tag.
  Do NOT read any other files, releases, or documentation.
- Keep notes short and proportional to the actual changes. A patch
  with one small fix should produce a few lines, not paragraphs.
- Do NOT escape HTML comment markers. Write `<!--` not `\<!--`.
- Do NOT use HTML entities for quotes. Write `'` not `&#39;`.

## Output Structure

The notes must contain two sections, wrapped in HTML comment markers:

1. **Summary** (between `<!-- SUMMARY -->` and `<!-- /SUMMARY -->`):
   Brief, non-technical, user-facing notes. End users don't care about
   implementation details — focus on what changed from their perspective.
   Keep it as concise as possible.

   If a release has **no user-facing changes** (e.g. only internal
   refactors, dependency bumps, CI changes, or developer tooling), leave
   the summary section empty — the markers on their own lines with nothing
   between them:
   ```
   <!-- SUMMARY -->
   <!-- /SUMMARY -->
   ```
   A downstream notification step can use this to decide whether to
   post to your user-facing channel; an empty summary means only an
   internal/developer channel gets notified.

2. **Technical Details** (between `<!-- TECHNICAL -->` and `<!-- /TECHNICAL -->`):
   More detailed notes for developers. Reference specific components,
   APIs, bug fixes, and behavioral changes. Still concise, but include
   enough detail to be useful for someone reviewing what shipped.

After both sections, append a links section wrapped in `<!-- LINKS -->` / `<!-- /LINKS -->` comment markers.

Example — release with user-facing changes:
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
<ul>
<li>Fixed duplicate event processing in the ingest worker by deduplicating on message id (<a href="https://github.com/your-org/your-repo/pull/3412">#3412</a>)</li>
<li>Added index on <code>events.created_at</code> to improve dashboard query performance (<a href="https://github.com/your-org/your-repo/pull/3415">#3415</a>)</li>
</ul>
<!-- /TECHNICAL -->
<!-- LINKS -->
<b>Full Changelog:</b> <a href="https://github.com/your-org/your-repo/compare/1.0.0...1.0.1">1.0.0...1.0.1</a>
<a href="https://github.com/your-org/your-repo/releases/tag/1.0.1">View full release notes on GitHub</a>
<!-- /LINKS -->
```

(Example URLs show a resolved slug for realism. Never copy URLs from examples — always build them from `{repo_slug}` resolved in step 0.)

Example — technical-only release (no user-facing changes):
```
<!-- SUMMARY -->
<!-- /SUMMARY -->
<!-- TECHNICAL -->
<b>Technical Details:</b>
<ul>
<li>Upgraded <code>socket.io</code> to v4.8.1 to resolve Node 24 deprecation warning (<a href="https://github.com/your-org/your-repo/pull/3420">#3420</a>)</li>
<li>Refactored barrel exports in <code>packages/utils</code> (<a href="https://github.com/your-org/your-repo/pull/3421">#3421</a>)</li>
</ul>
<!-- /TECHNICAL -->
<!-- LINKS -->
<b>Full Changelog:</b> <a href="https://github.com/your-org/your-repo/compare/1.0.1...1.0.2">1.0.1...1.0.2</a>
<a href="https://github.com/your-org/your-repo/releases/tag/1.0.2">View full release notes on GitHub</a>
<!-- /LINKS -->
```

(Same caveat: build real URLs from `{repo_slug}`, never by copying these examples.)

## Formatting Requirements

The notes are intended to be consumed by a chat/notification integration (e.g. Slack, Google Chat, Microsoft Teams) that renders HTML. They must:

- Use valid HTML only — no markdown. Use tags like `<b>`, `<i>`, `<a href="...">`, `<br>`, `<code>`, and `<ul>`/`<li>` for structure.
- Be valid for embedding in a JSON string — the workflow will handle any necessary JSON escaping. Do not include literal newline characters inside HTML tag content; use `<br>` tags or HTML block elements (`<ul>`, `<li>`, `<p>`) for line breaks and structure instead. Newlines between HTML tags (for readability) are fine.
- Avoid any characters or sequences that would break JSON parsing (e.g., unescaped control characters, tabs).

## Steps

0. Resolve the repo slug once: `gh repo view --json owner,name --jq '"\(.owner.login)/\(.name)"'` → use as `{repo_slug}` in every API call and URL below. Never hardcode the org — this repo has changed owners before.
1. Determine the tag immediately preceding the target tag.
   - **If a previous tag was passed as the second argument:** validate it matches `^[0-9]+\.[0-9]+\.[0-9]+$` (bare semver) and use it directly as `{previous_tag}`. Skip the rest of this step. Do NOT fall back to the release list -- the passed value is authoritative and race-free. (If it is malformed, abort with a clear error rather than guessing.)
   - **Otherwise (manual runs), resolve it from the release list:**
   `gh release list --json tagName --limit 100 --jq '.[].tagName'`
   - Filter to bare-semver release tags only (`^[0-9]+\.[0-9]+\.[0-9]+$`) — the release list may interleave prefixed tags like `cli-v0.1.7` that must be ignored.
   - Verify the target tag appears in the filtered list. If it doesn't, increase the limit (paginate) or stop and tell the user — do NOT guess a predecessor.
   - **Sort the filtered tags by semantic version** (numeric MAJOR, then MINOR, then PATCH — not lexically), and take the highest version strictly less than the target as `{previous_tag}`. Do NOT use the release-list order: that list is ordered by release creation/publish time, which is not version order once the merge queue creates several tags in a batch or a stale draft is recreated. (A recreated `9.70.3` draft landing next to `9.70.14` in the list is what caused a manual run to diff `9.70.3...9.70.14` — 36 commits — and duplicate every item already noted in 9.70.4–9.70.13.)
   - If no version strictly less than the target exists (the target is the earliest), do not fall back to a prefixed tag or guess. Unattended: abort with a clear error naming the problem. Interactive: ask the user for an explicit base tag.
2. Get the commit messages between the two tags:
   `gh api "repos/{repo_slug}/compare/{previous_tag}...{target_tag}" --jq '.commits[].commit.message'`
   This is your ONLY source of truth for what changed.
   The compare API returns at most 250 commits per page. Check `total_commits` in the response; if it exceeds the returned count, paginate (`?per_page=250&page=N`) until all commit messages are collected.
3. Write the two-section release notes based on those commit messages.
   If none of the commits have user-facing impact, leave the summary
   section empty (markers on their own lines with nothing between them).
   **PR links in technical details:** Merge commit messages contain PR numbers in `(#NNNN)` format. In the technical details section, turn each PR reference into a clickable link: `(<a href="https://github.com/{repo_slug}/pull/NNNN">#NNNN</a>)`. This lets the reader click through to the PR to see post-merge steps, deploy SQL, or other action items documented in the PR description. Commits without a `(#NNNN)` reference stay as plain text — never invent a link.
4. Append a links section wrapped in `<!-- LINKS -->` / `<!-- /LINKS -->` comment markers containing a full changelog link and a release link in this exact format (substituting `{repo_slug}` from step 0):
   ```
   <!-- LINKS -->
   <b>Full Changelog:</b> <a href="https://github.com/{repo_slug}/compare/{previous_tag}...{target_tag}">{previous_tag}...{target_tag}</a>
   <a href="https://github.com/{repo_slug}/releases/tag/{target_tag}">View full release notes on GitHub</a>
   <!-- /LINKS -->
   ```
5. Interactive runs only: present the notes for review (raw HTML plus a summary) and ask the user to approve or request changes. Unattended: skip this step and proceed — the CI prompt authorizes direct updates.
6. Before editing, check the release's draft status: `gh release view {target_tag} --json isDraft`. If `isDraft` is false the release is already published and its notes are prod-visible — never edit it silently. Unattended: abort with an error (CI only ever targets fresh drafts; a published target means something is wrong). Interactive: get explicit confirmation first (backfilling a published release's missing notes is legitimate, but must be deliberate).
   Once approved, update the release with:
   `gh release edit {target_tag} --notes <notes>`
   IMPORTANT: Only use `--notes` -- do not pass any other flags (`--draft`, `--prerelease`, `--title`, `--target`, etc.) or use any other command/API to modify the release. A draft release must remain a draft -- only your production deploy workflow (not this skill) is allowed to promote it.
