#!/usr/bin/env bash
#
# Reply to a PR review comment and optionally resolve its thread.
#
# Usage:
#   resolve-pr-comment.sh [options] <pr-number> <comment-id> <reply-body>
#
# Arguments:
#   pr-number   - The PR number (e.g., 3035)
#   comment-id  - The REST API comment ID (numeric, from gh api .../pulls/N/comments)
#   reply-body  - The text to post as a reply
#
# Options:
#   --no-resolve   Post the reply but do NOT resolve the thread (for disagreements)
#   --resolve-only Skip posting a reply and just resolve the thread
#
# The repo is auto-detected via `gh repo view`. Override with REPO=owner/name.
#
# Examples:
#   resolve-pr-comment.sh 3035 2948976313 "Fixed -- removed unused imports."
#   resolve-pr-comment.sh --no-resolve 3035 2948977001 "I disagree because..."
#   resolve-pr-comment.sh --resolve-only 3035 2948976313

set -euo pipefail

RESOLVE=true
POST_REPLY=true

while [[ $# -gt 0 && "$1" == --* ]]; do
  case "$1" in
    --no-resolve)   RESOLVE=false; shift ;;
    --resolve-only) POST_REPLY=false; shift ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if [ "$POST_REPLY" = true ] && [ $# -lt 3 ]; then
  echo "Usage: $0 [--no-resolve|--resolve-only] <pr-number> <comment-id> <reply-body>" >&2
  exit 1
fi

if [ "$POST_REPLY" = false ] && [ $# -lt 2 ]; then
  echo "Usage: $0 --resolve-only <pr-number> <comment-id>" >&2
  exit 1
fi

PR_NUMBER="$1"
COMMENT_ID="$2"
REPLY_BODY="${3:-}"

# Auto-detect repo if not set
if [ -z "${REPO:-}" ]; then
  REPO=$(gh repo view --json owner,name --jq '"\(.owner.login)/\(.name)"')
fi

# 1. Post the reply
if [ "$POST_REPLY" = true ]; then
  gh api "repos/${REPO}/pulls/${PR_NUMBER}/comments/${COMMENT_ID}/replies" \
    -f body="${REPLY_BODY}" \
    --jq '.id' > /dev/null
  echo "Reply posted on comment ${COMMENT_ID}."
fi

# 2. Resolve the thread
if [ "$RESOLVE" = true ]; then
  OWNER="${REPO%%/*}"
  NAME="${REPO##*/}"

  # Look up the thread ID by matching the comment's databaseId.
  # The comment could be the top-level comment or any reply in the thread,
  # so we fetch all comments per thread and check all of them.
  THREAD_ID=$(gh api graphql \
    -f owner="${OWNER}" \
    -f name="${NAME}" \
    -F pr="${PR_NUMBER}" \
    -f query='
    query($owner: String!, $name: String!, $pr: Int!) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $pr) {
          reviewThreads(first: 100) {
            nodes {
              id
              isResolved
              comments(first: 100) {
                nodes { databaseId }
              }
            }
          }
        }
      }
    }' --jq ".data.repository.pullRequest.reviewThreads.nodes[] | select(.comments.nodes[].databaseId == ${COMMENT_ID}) | .id")

  if [ -z "${THREAD_ID}" ]; then
    echo "Warning: could not find thread for comment ${COMMENT_ID}. Thread not resolved." >&2
    exit 1
  fi

  gh api graphql \
    -f threadId="${THREAD_ID}" \
    -f query='mutation($threadId: ID!) {
      resolveReviewThread(input: {threadId: $threadId}) {
        thread { isResolved }
      }
    }' --jq '.data.resolveReviewThread.thread.isResolved' > /dev/null

  echo "Thread resolved for comment ${COMMENT_ID}."
fi

echo "Done: PR #${PR_NUMBER}, comment ${COMMENT_ID}."
