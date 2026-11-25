---
name: redact-sensitive-history
description: Use when personal data, secrets, or an unwanted file must be
  removed from git history (not just from HEAD), or when the user asks to
  "remove X from all commits". Covers rewrite, unreferenced-object purge,
  verification, and the force-push handback to the user.
---

# Redacting data from git history

Only on explicit user request (root AGENTS.md: history rewrites are
opt-in). If the sensitive content is still arriving, stop the source first.

## 1. Scope

- Identify the content to remove (paths and/or content) and from when.
- Identify everything that must survive: `git log --oneline | wc -l` and
  `git ls-files` before touching anything — record them.

## 2. Rewrite (no git-filter-repo? filter-branch works for path removals)

```bash
FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch --force \
  --index-filter "git rm --cached --ignore-unmatch <PATH>" \
  --prune-empty --tag-name-filter cat -- --all
```

For content inside remaining files (secrets, names), `git filter-repo
--replace-text` is the right tool — check whether it is installed; if it is
not, rewriting blobs via filter-branch is possible but error-prone: prefer
installing `git-filter-repo` first.

## 3. Purge locally — the step that makes redaction real

A rewrite alone leaves old commits recoverable. Remove them:

```bash
rm -rf .git/refs/original
rm -rf .git/logs            # or: git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

## 4. Verify before claiming success

```bash
git fsck --full --unreachable --dangling      # expect: empty
git rev-list --objects --all                  # no trace of the path/blob
git grep <needle> $(git rev-list --all)       # content gone from every commit
git log --format='%an <%ae> %cn <%ce>' --all  # metadata check, if relevant
```

All of these must come back clean *before* you report done.

## 5. Handback

- The user pushes `--force-with-lease` from a machine with their key (this
  sandbox cannot push).
- Anyone with an old clone holds the data: collaborators must re-clone, and
  forks/caches (GitHub views, CI logs, issue attachments) are outside our
  reach — say so explicitly.
- Re-run the private-information audit checklist if the data was personal.

## Aftermath

Update `.gitignore` if the leak was comitted-by-convention (this is why
`plan/` is gitignored), and add a root-AGENTS.md rule if the process allowed
the leak in the first place.
