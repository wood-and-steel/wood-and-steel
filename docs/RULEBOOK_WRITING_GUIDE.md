# Rulebook Writing & Editing Guide (for AI agents)

Use this guide when you are asked to **write a new board game rulebook** or **edit/review an existing one**, especially for medium-to-heavy games. It distills the practices of three recent heavy games whose rulebooks reviewers single out for clarity:

- **Galactic Cruise** (Kinson Key Games, 2025) — in-world "Training Manual" with a mentor narrator, intro game, and companion books.
- **SETI: Search for Extraterrestrial Intelligence** (Czech Games Edition, 2024) — tight per-action spreads, sidebars for free actions, hidden rule sheets for content discovered mid-game.
- **Arcs** (Leder Games, 2024) — big-picture-first teaching, dense page cross-references, a separate "Fine Print" for meta-rules, glossary + index.

The goal is a rulebook that (1) teaches a first-time reader in one pass, (2) works as a lookup reference during play, and (3) never forces the reader to flip pages to understand the basics.

---

## 1. Core principles

1. **Teach in the order the player meets things.** Overview → components → setup → the shape of a turn → each action → round/game end → scoring → variants. Never explain a rule before the reader knows what it acts on. (All three books follow this order.)
2. **Big picture before detail.** Before any procedure, state in a few sentences: the premise, how you win, roughly how long it takes, and the overall loop. Arcs gives the win threshold by player count and first-game vs. later play time up front. SETI opens with a one-line framing, then the goal.
3. **Separate *learning* from *reference*, but keep both in the box.** The main body is written for a first read; reference material (edge cases, terminology, meta-rules, index, quick-reference sheet) lives at the back or in separate aids. Arcs' "Fine Print," SETI's reminders/terminology/FAQ section, and Galactic Cruise's "Clarifications and Edge Cases" all do this.
4. **One rule, one home.** Each rule is stated fully in exactly one place. Elsewhere, refer to it by name and page — don't restate it with slightly different wording. Divergent restatements are the #1 source of rules disputes.
5. **Defer complexity the first game doesn't need.** Recommend an intro setup or tell players to leave modules out at first, and say so plainly. Galactic Cruise strongly recommends its Intro Game; Arcs tells you not to use Leaders & Lore in your first game; SETI keeps each alien species' rules on a sealed-off sheet until that species is discovered.
6. **Show, then tell the edge cases.** Every non-trivial rule gets a worked example next to it. Edge cases go in a dedicated Q&A section, not inline clutter.
7. **Precision in rules text; warmth in the voice around it.** Friendly second-person tone and light humor are fine (all three use it), but the sentence that *is* the rule must be unambiguous and testable.

---

## 2. Recommended document structure

Adapt section names to the game's theme, but keep this order:

| # | Section | Purpose | Model |
|---|---------|---------|-------|
| 0 | **How to use this book** (½ page) | Explain callout types, which parts are optional (examples, flavor), and the recommended learning path. | Galactic Cruise |
| 1 | **Introduction / Object of the game** | Premise in 1–2 sentences, win condition, game length, overall loop, link/QR to a video teach. | Arcs, SETI |
| 2 | **Components** | Labeled inventory, grouped by where it's used (board, per-player, shared, solo-only, sealed content). Anatomy diagrams for cards/boards. | SETI, Arcs |
| 3 | **Setup** | Numbered or lettered checklist keyed to callouts on a single setup diagram. Player-count differences flagged inline. Intro setup first; standard setup as *differences from* intro. | All three |
| 4 | **Core concepts** | The 3–6 ideas every rule builds on (e.g., Loyal/Rival, main vs. free actions, the round shape). Short, before any procedure. | Arcs "Core Concepts," SETI "Game overview" |
| 5 | **Turn / round structure** | Numbered steps (Step 1, 2a/2b/2c, 3). Each step names the section that details it. | Galactic Cruise, Arcs |
| 6 | **Actions** | One subsection per action, each in the *same pattern* (see §4). | All three |
| 7 | **End of round / phase / game** | Numbered resolution sequence; what triggers the end. | All three |
| 8 | **Scoring** | Bulleted scoring categories, then a fully worked tally for one example player. Tiebreakers in strict order. | Galactic Cruise |
| 9 | **Player-count variants & solo** | Written as *overrides* to the base rules ("Normal rules apply except…"), with their own setup diagram if needed. | Galactic Cruise, SETI |
| 10 | **Optional modules / expansions** | Explicitly marked "after you've played a few games." State which base setup steps they replace. | Arcs Leaders & Lore |
| 11 | **Fine print / meta-rules** | Card-vs-rulebook precedence, component limits, running out of pieces, negotiation/table-talk norms, tiebreakers, "don't sweat technicalities." | Arcs "Fine Print" |
| 12 | **Clarifications / FAQ** | Q&A with bolded questions phrased the way a player would ask them. | Galactic Cruise, SETI |
| 13 | **Glossary / terminology** | One-line definition + page reference for every capitalized term. | Arcs, SETI |
| 14 | **Index** | Terms with page numbers and sub-entries. | Arcs |
| — | **Quick-reference sheet(s)** | Separate card/sheet: turn sequence, action list with costs, free actions, end-of-round steps, icon key. | SETI, Galactic Cruise player aids |

Short games can merge 4–5, 11–12, and 13–14. Heavy games should not drop the glossary or index.

---

## 3. Setup sections

- Use **one master diagram** with lettered callouts (A, B, C…) and a **numbered step list** that refers to those letters. (SETI: numbered steps keyed to lettered callouts; Arcs: lettered checklist split into "table" and "players.")
- Split into **shared/table setup** and **per-player setup**.
- **Flag player-count differences inline** with a consistent marker (e.g., a "2 Players Only" tag or icon) rather than a separate section the reader has to cross-check.
- If there's an **intro setup**, write it in full, then write the standard setup as a short list of *deltas*. Galactic Cruise color-codes intro vs. standard steps and writes standard as changes to intro.
- End setup with **who goes first** and the **starting state** (resources, hand size) so nothing is left implicit.

---

## 4. Teaching actions and procedures

Give every action the **same internal pattern** so readers learn the rhythm:

1. **Name** (consistent with the board/card/aid label). Optionally its category, e.g., Arcs writes the action followed by its suit in parentheses.
2. *(Optional)* **One line of flavor**, visually set apart, skippable. Galactic Cruise opens each action with an in-world line; SETI keeps flavor separate from mechanics.
3. **Cost / requirement.**
4. **Effect**, as a single "This action lets you…" sentence, followed by bulleted sub-rules and restrictions.
5. **Example** (boxed, beside a diagram).
6. **Cross-references** to anything it triggers, by name and page.

Other procedure rules:

- **Number every sequence** (turn steps, launch steps, end-of-round steps). Thematic labels are great if they still sort (Galactic Cruise's countdown "T-Minus 5 … T-Minus 0").
- **Say what's *not* allowed when timing matters.** SETI states plainly that free actions can happen before, after, or *during* your main action, and that they can't happen between turns or on another player's turn. State both the permission and the boundary.
- **Put secondary/always-available actions in sidebars** next to where they first become relevant, then collect them on the reference sheet (SETI's free actions).
- **Use tables** for anything that varies by a number (costs by level, thresholds by player count, rewards by position).

---

## 5. Examples

Examples are where clear rulebooks earn their reputation. Rules:

- **At least one example per action and per non-obvious scoring rule.** Place it **beside** the rule and diagram, never in an appendix.
- **Label it consistently**: "EXAMPLE:" (SETI), "E.g." boxes (Galactic Cruise), or shaded callouts (Arcs).
- **Use recurring named players or colors** across the book (Arcs reuses the same three named players; Galactic Cruise uses player colors). Readers stop parsing who's who.
- **Tie the diagram to the text** with lettered/numbered markers (A, B, 1, 2) that appear in both.
- **Show the result**, including any arithmetic ("…for a total of 7 points"). Don't narrate every decision.
- **Prefer examples that hit an edge** (a tie, a limit, an interaction) over the trivial case.
- Tell the reader examples are **optional on a first read** if the rule stands alone (Galactic Cruise does this explicitly). This keeps the book from feeling longer than it is.

---

## 6. Terminology and typography

- **Capitalize defined game terms** (Worker, Cruise, Loyal, Rival) and use them identically everywhere — on components, aids, and in the book. Never introduce a synonym.
- **Bold a term where it is defined**, and only there.
- **Every capitalized term goes in the glossary** with a one-line definition and a page reference.
- **Icons in text** must match printed icons exactly, and every icon must appear in an icon key (rulebook and reference sheet).
- **Use fixed phrases for fixed meanings.** E.g., "may" = optional, "must" = mandatory, "immediately" = interrupts current step, "at the end of your turn" = a specific step number. Define these in the Fine Print.
- **Headings name the thing, not a description of it**, so they scan and index well.

---

## 7. Callouts and sidebars

Use a **small, fixed set** of callout types, each with a distinct look, and explain them in "How to use this book." Recommended set (drawn from the three books):

| Callout | Use for | Model |
|---------|---------|-------|
| **Key Concept** | Fundamentals the reader must not skip. | Galactic Cruise "Key Concept" boxes |
| **Example** | Worked illustration of the adjacent rule. | All three |
| **Mentor tip / reminder** | Commonly forgotten rules, first-game advice, strategy nudges. Friendly voice. | Galactic Cruise "Notes from Zoë," Arcs sidebars |
| **Player-count / solo flag** | "In a 2-player game, instead…" with page ref. | Galactic Cruise icon flags |
| **Sidebar rule** | A secondary rule (free action, timing window) first introduced where relevant. | SETI free-action sidebars |

Don't invent new callout types mid-book. A callout must never contain a rule that isn't also in the main text or reference section — callouts can be skipped.

---

## 8. Voice and tone

- **Second person, present tense, active voice.** "You draw 2 cards," not "2 cards are drawn by the active player."
- **A light narrator or theme frame is fine** (Galactic Cruise's corporate trainer, Arcs' quips), but keep it to intros, callouts, and transitions. The rule sentence itself is plain.
- **Give reading guidance.** Tell readers when to skip ahead and come back (Galactic Cruise does this explicitly), and when to *not* use a module yet (Arcs).
- **Give permission to be flexible** on minor technicalities when it doesn't change the outcome (Arcs' Fine Print says as much), while staying firm where precision matters.

---

## 9. Cross-references

- **Reference by name *and* page**: "(see Launch a Ship, page 24)." Arcs puts page numbers on nearly every mention of a concept.
- **Point forward** when a term is used before it's fully explained ("You'll learn more in…"), and **back** when a later rule depends on an earlier one.
- **Point to companion materials precisely** ("page 7 of your Handbook"), and don't duplicate their contents in the rulebook.
- **Verify every page reference before finalizing.** A pre-release Galactic Cruise manual had page references that didn't match its own table of contents — exactly the kind of error that undermines trust. Treat page references as code: test them.

---

## 10. Reference material at the back

- **Fine Print / meta-rules:** precedence (cards override rulebook), component limits and what happens when you run out, hidden vs. public information, table-talk/negotiation norms, tiebreakers, timing conventions.
- **Clarifications / FAQ:** bolded questions in player voice ("What happens when I … and all my Workers are in space?"), each with a one- or two-sentence answer and page ref.
- **Reminders / commonly missed rules:** terse one-liners (SETI collects these).
- **Glossary** and **index** (Arcs has both; heavy games should too).
- **Quick-reference sheet(s):** turn summary, action list with costs, free actions, end-of-round steps, scoring, icon key. Everything on the sheet must match the rulebook word-for-word on numbers and terms. (Reviewers flagged an Arcs aid that conflicted with the rulebook — avoid this.)

---

## 11. Hidden, modular, and expansion content

- **Hidden content:** If something is meant to be discovered (SETI's alien species), put its rules on a separate sheet and tell players in the main book *when* to read it and the exact steps to follow when it's revealed.
- **Modules:** Mark them as optional, say when to add them ("after a few games"), and list exactly which base setup steps they **replace** or **add to** (Arcs).
- **Variants and player counts:** Write as overrides with "Normal rules apply" for everything else.

---

## 12. Workflow: writing a new rulebook

1. **Gather source of truth.** Get the designer's rules notes, component list, card text, and any known FAQ. List every open question; don't invent rules to fill gaps — flag them for the designer.
2. **Build the term list first.** Every capitalized game term, its one-line definition, and where it's defined. Use it to enforce consistency throughout.
3. **Outline using §2.** Decide the intro setup, which modules to defer, and what goes to the reference sheet.
4. **Write the "spine":** Introduction → Core Concepts → Turn Structure. Check that a reader could explain the game loop after these pages alone.
5. **Write each action using the §4 pattern**, with an example placeholder for each (describe the board state the example needs; note any diagram to be drawn).
6. **Write end-of-game and scoring**, with a fully worked tally.
7. **Write the back matter:** Fine Print, FAQ, glossary, index, reference sheet.
8. **Run the review checklist (§14).**

## 13. Workflow: editing an existing rulebook

1. **Read it once as a first-time player.** Note every point where you had to flip pages, guess, or re-read. These are the priority fixes.
2. **Map the structure** against §2. Note missing sections (often: core concepts, fine print, glossary, index) and out-of-order teaching (rules used before they're explained).
3. **Extract the term list.** Find synonyms, inconsistent capitalization, and terms used but never defined.
4. **Find duplicated rules** and check whether the copies agree. Consolidate to one home; replace the others with references.
5. **Check every action against the §4 pattern** and every rule for an adjacent example.
6. **Check all numbers and references:** page refs vs. table of contents, costs/values vs. components and reference sheets, player-count tables.
7. **Return changes as a tracked list** (location → issue → proposed fix), separating **clarity edits** (wording, order, examples) from **rules questions** (genuine ambiguity or contradiction the designer must decide). Never silently change what a rule does.

---

## 14. Review checklist

**Teaching flow**
- [ ] The first page states premise, win condition, game length, and the overall loop.
- [ ] No rule is used before it's explained (or there's a forward reference).
- [ ] Turn and round steps are numbered and each links to its detail section.
- [ ] A first game can be set up and played using only the intro path.
- [ ] Optional modules are clearly deferred, with replaced setup steps listed.

**Clarity**
- [ ] Every action follows the same pattern (name, cost, effect, sub-rules, example, refs).
- [ ] Every action and non-obvious scoring rule has an adjacent example with a visible result.
- [ ] Timing rules state both what's allowed and what's not.
- [ ] Each rule is stated in full in exactly one place.
- [ ] Rule sentences are in plain, active, second-person voice. Flavor is set apart.

**Consistency**
- [ ] Every capitalized term is defined once, in bold, and appears in the glossary.
- [ ] No synonyms for defined terms. Names match the components.
- [ ] Icons in text match printed icons; all icons appear in an icon key.
- [ ] Numbers in the rulebook, reference sheet, and components agree.

**Reference**
- [ ] Every cross-reference names the section and the correct page.
- [ ] The table of contents matches the actual section order and page numbers.
- [ ] Fine Print covers precedence, component limits, running out, hidden info, and tiebreakers.
- [ ] The FAQ answers the questions playtesters actually asked.
- [ ] A glossary and an index exist (for medium-heavy and heavier games).
- [ ] The quick-reference sheet covers turn order, actions/costs, free actions, end of round, scoring, and icons, and agrees with the book.

---

## 15. Anti-patterns to avoid

- Rules explained only through examples (examples illustrate; they don't define).
- Important rules living only in sidebars, flavor text, or callouts.
- The same rule worded differently in two places.
- Page references that weren't re-checked after layout changed.
- Reference sheets that disagree with the rulebook.
- Asymmetric or advanced content mixed into the first-game teach.
- "See the card" for a rule that applies generally.
- Undefined jargon, or a term that means two things.
- A long rulebook with no index.
