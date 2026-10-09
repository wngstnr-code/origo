# CLAUDE.md

Project instructions for Claude Code. Read this first in every session.

## Project

**Origo** is a provenance registry for photos that survives re-encoding. A photo's visual fingerprint (perceptual hash) is registered on Monad, so a copy that was compressed by WhatsApp, screenshotted, resized, or mirrored can still be traced back to its original creator and registration time. Lookup runs fully on-chain plus in the browser, with no backend.

It is being built for the **Monad Metropolis Hackathon**, Track 04 (Trust, Identity & AI Infrastructure). Submission deadline: **Oct 13, 2026, 11:59 PM ET (Oct 14, 10:59 WIB)**.

## Rules (from the project owner, always follow)

1. **Language**
   - All documents, code, code comments, commit messages, README, and docs are written in **English**.
   - Talk to the project owner in **Bahasa Indonesia** in chat.
2. **No em dash.** Never use the em dash character (U+2014) in any file or commit message. Avoid the en dash (U+2013) too. Use a colon, comma, parentheses, "to", or a plain hyphen instead. Check with: `python3 scripts/check-dashes.py` (must print nothing).
3. **The project owner is the only contributor.**
   - Commits are authored only by the project owner (git identity: Wangsit Nursyahada). Never add `Co-Authored-By: Claude` or any Claude/Anthropic trailer, and never add "Generated with Claude Code" lines to commits, PRs, or files.
   - Never list Claude or any AI as a contributor or author in README, package.json, LICENSE, or anywhere else.
   - Exception required by the hackathon rules (Rules section 4.1.4): the README must contain a short neutral "AI tool disclosure" section stating that AI coding tools were used. This is a disclosure, not a contributor credit.
4. **Hackathon constraints**
   - No mock data and no mock features. Everything shown must be real and working.
   - No backend owned by us. Allowed: static frontend, smart contracts on Monad, public RPCs, and public/decentralized infrastructure (Envio, IPFS).
   - Commit history must cover the build window, so commit small and often.
   - Every contract deployment (testnet and mainnet) must be verified on Sourcify/MonadVision in the same step. Command in `docs/origo/ARCHITECTURE.md` section 4.
5. Only commit or push when the project owner asks.
6. **Split commits.** Never bundle unrelated work into one commit. Make one small commit per logical change (for example: contract, its tests, SDK module, UI page, docs), each building on its own where possible. Use Conventional Commits style: `feat(sdk): ...`, `fix(contracts): ...`, `docs: ...`, `chore: ...`, `test(...)`. Stage specific paths, never `git add -A` blindly.

## Docs map

| File | What it is |
| --- | --- |
| `docs/origo/PROGRESS.md` | **Living status: read first, update last.** Current phase, done/next tasks, decision log, open questions |
| `docs/origo/OVERVIEW.md` | Product: problem, users, pitch, scope, how it maps to the judging rubric |
| `docs/origo/ARCHITECTURE.md` | Technical spec: repo layout, hashing, contract interface, key derivation, data flows |
| `docs/origo/GAPS.md` | Known gaps, blockers, and limitations with status. Check before designing anything new |
| `docs/origo/CONTRACT_REVIEW.md` | Pre-freeze security review of the contract: changes made and accepted risks |
| `docs/origo/FRONTEND_REFERENCES.md` | Vetted open-source landing and app references with live links and licenses |
| `docs/origo/BUILD_PLAN.md` | Day-by-day plan to the deadline, MVP vs stretch, submission checklist, demo video script |
| `docs/hackathon.md` | Hackathon facts: tracks, rubric, bounties, rules, judges, resources |
| `docs/project-ideas.md` | Research on past winners, market landscape, and the 5 ideas compared |

## Session workflow

1. Start: read `docs/origo/PROGRESS.md`, then only the spec sections the task needs.
2. Work: follow `docs/origo/ARCHITECTURE.md`. If a decision changes the spec, update the spec in the same change.
3. End: update `docs/origo/PROGRESS.md` (status, checked tasks, new decisions with date, open questions). Keep it short and current.
4. Before finishing: run the em dash check above and the relevant tests.
