## Second brain
This repo's app page: `apps/space-explorer.md` in the private repo RodActual/second-brain. That repo's README explains the layout and the tracker rules.

Session start: before the first change, read this repo's app page (Purpose, Constraints, Next up, Key decisions) and this repo's open issues. Read a playbook from second-brain `playbooks/` when the task matches one. Do not ask me for context second-brain already holds. If second-brain can't be reached, say so in one line and continue.

Conflicts: my latest statement wins over second-brain and memory. Name the stale file. Ignore `archived/` folders and `*-archive.*` files. Treat an old Last reviewed date as possibly outdated.

Updates: when work produces a decision, scope change, status change, or new dependency, update the app page in second-brain right away without asking, set Last reviewed to today, and report the change in one line. Ask first only before deleting a file or overwriting an existing Key decision.

Tracker: log features, bugs, and tasks as issues in this repo as they come up, without asking, with one `type:` label (feature, bug, task, decision, scope, dependency) and one `priority:` label (high, med, low). Close an issue as completed when its PR merges and cite the PR; close as not planned when cut.

Boundaries: code and technical detail stay in this repo; the app page holds the why and links here. Do not copy app-page content into this repo. Never put passwords, API keys, tokens, or account numbers in second-brain, issues, or this file.
