# Commit message guide

**For AI agents:** Use this style when the user asks you to commit. Match the existing history in this repo; do not introduce Conventional Commits (`feat:`, `fix:`, etc.) unless the project adopts them later.

## Subject line

Write a **single imperative sentence** describing what the commit does.

- Start with a verb: `Add`, `Remove`, `Change`, `Refactor`, `Restore`, `Rename`, `Move`, `Reduce`, and similar.
- Use present tense / imperative mood (`Add Undo feature`, not `Added Undo feature`).
- Capitalize the first word only (sentence case), unless a proper noun or quoted title requires otherwise.
- Keep one logical change per commit when possible.
- Most commits in this repo use **subject only**; a body is optional.

### Common prefixes

| Intent | Prefix | Example |
|--------|--------|---------|
| New behavior or UI | `Add …` | `Add notification dot to routes added last turn` |
| Delete code or behavior | `Remove …` | `Remove unneeded back compat code` |
| Restructure without changing behavior | `Refactor …` | `Refactor nav bar hint into a component` |
| Change existing behavior | `Change …` | `Change rewardValue to moneyValue for congruence with upgrade costs` |
| Bring back prior behavior | `Restore …` | `Restore confirmation before deleting a game in progress` |
| Rename only | `Rename …` | `Rename "Delete" to "Discard"` |
| Bug fix | `bug fix: …` | `bug fix: do not trigger end-of-round actions when transitioning from setup to play` |
| Revert | `Revert "…"` | `Revert "Visual update to contracts, paper-like instead of digital card"` |

For bug fixes, prefer **`bug fix:`** (lowercase, with colon). Older history also uses `bug:`; new commits should standardize on `bug fix:`.

### When the subject needs more detail

If several tightly related edits belong in one commit, extend the subject with commas or a short clause rather than adding a body:

```
Add build:sim script for RR sim, update Vite config for conditional simulator loading, and update build/run docs
```

For a small follow-on tweak in the same area, a short subject is fine:

```
Color tweaks for sim map output
```

Avoid file lists (`Update Board.tsx, gameStore.ts, and App.tsx`) unless the subject would otherwise be meaningless.

## Body (optional)

Add a body only when the **why** is not obvious from the subject:

- Linking an issue: `Fixes #33 by reserving space for the home indicator…`
- Non-obvious motivation, tradeoffs, or follow-up notes
- Revert context when the original commit message alone is not enough

Separate subject and body with a blank line:

```
Add iOS safe-area bottom padding to phone layout.

Fixes #33 by reserving space for the home indicator and curved screen edges on iPhones.
```

Do not repeat the subject in the body. Do not add a body just to list changed files.

## What to avoid

- **Conventional Commits prefixes** — no `feat:`, `fix:`, `chore:`, etc.
- **Past tense** — `Added feature` instead of `Add feature`
- **Vague subjects** — `Updates`, `WIP`, `Fix stuff`
- **Unrelated changes in one commit** — split when review or revert would be painful
- **Typos in user-visible strings** — proofread subjects; they are permanent history

## Examples from this repo

Good subjects:

```
Add Undo feature
Remove confirmation to cancel BYOD game not yet started
Refactor growIndependentRailroads to modern JS
bug fix: only consider routes that do not touch other indies or their neighboring cities
Remember player names and active lobby tab in local storage
Manually chunk out third-party code in build, reducing chunk size and (hopefully) increasing cache hits
```

Good subject + body:

```
Add iOS safe-area bottom padding to phone layout.

Fixes #33 by reserving space for the home indicator and curved screen edges on iPhones.
```

## Workflow reminders

- Commit only when the user explicitly asks.
- Before committing, run `git status`, `git diff`, and skim recent messages (`git log --oneline -10`) to match tone.
- Write the message around **why** the change exists, not a inventory of every touched file.
