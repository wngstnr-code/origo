# Origo: Design Direction

> **Current direction (owner decision, 2026-10-09):** playful, using the layout of https://joinmastodon.org rebuilt from scratch (their repo has no license, so no code or illustrations are copied). Night-sky hero with our own owl mascot cropped at the bottom left, planets, a light "shore" curve, then alternating text and visual rows, a numbers band, and a closing call to action. Tokens live in `apps/web/src/index.css`. The editorial direction below is kept for reference; the "Never" list and the review gate still apply.

Owner requirement: **the UI must not look AI-generated.** The "Never" list and the review gate apply whatever direction is chosen. Every screen is checked against the "Never" list and the convergence test at the end before it ships.

## Direction

Origo is a tool for photojournalists and fact-checkers. It should feel like a **newsroom photo desk**: a picture editor's contact sheet, captions with exact credits, a wire-service log. Not like a crypto dashboard or a SaaS template.

```
Direction: editorial / photo desk (Gallery Editorial content focus + newspaper typography)
Density:   comfortable on the landing, compact in results and metadata
Surface:   flat paper-toned sections, hairline rules; images flush, no card shadows
Type mood: editorial, exact, quiet
Motion:    crisp, short, purposeful (no floating blobs, no bounce)
```

Earlier references: LetsSeal for tone and the verify layout, PicPeak for photo cards with monospace metadata, TrueShot for the live verification log.

## Signature elements (what makes it ours)

1. **Contact sheet results.** Matches appear as frames on a contact sheet: thumbnail flush, a frame number (record id), and a caption line in newspaper style: `Photo: 0x7776…4Ed1 · registered 14:02:31 WIB · block 69,475,101`.
2. **Crop marks.** Corner registration marks on the dropped photo and on tile matches, showing which tile matched ("matched as a crop, tile 14"). It explains crop protection without a diagram.
3. **Wire log.** A monospace log that streams the real steps with real timings: `hashing 8 orientations 41 ms`, `findEarliest on Monad 380 ms`, `match #1 tile 0, 0 bits`. Every line comes from the actual run, never canned text.
4. **Before and after hero.** The landing hero is a live demo with a real public-domain photo: the WhatsApp-degraded copy next to the original, and the actual result from the contract.
5. **Caption-style credits** everywhere a record is shown, like a photo credit under a news picture.

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#F4F1EA` | Page background (newsprint, not pure white) |
| `--paper-2` | `#ECE7DC` | Alternate sections, input wells |
| `--ink` | `#1C1B18` | Text and primary buttons (never pure `#000`) |
| `--ink-2` | `#5B574E` | Secondary text, captions |
| `--rule` | `#D6CFC0` | Hairline rules (1px), dividers |
| `--safelight` | `#B23A1E` | The one accent: darkroom safelight red. Primary actions, focus rings, crop marks |
| `--match` | `#2F6B3A` | Status only: confirmed match, passed proof |
| `--warn` | `#A36A00` | Status only: low confidence, contested |

Dark mode is a "darkroom" variant: `--paper` `#16140F`, `--ink` `#EDE8DD`, same accent. Status colors are never decorative.

**Typography:** Newsreader (headlines, serif, designed for news) at 2 weights; IBM Plex Sans (UI text); IBM Plex Mono (hashes, block numbers, ids, the wire log). Self-hosted via `@fontsource`, no third-party font requests. Max 3 weights and 5 sizes per screen. Numbers use tabular figures.

**Radius by role:** images 0 (flush, like prints); inputs and buttons 4px; overlays 8px. Never one radius for everything.

**Layout:** asymmetric 7/5 or 8/4 columns, left-aligned headlines, reading-width body text (about 65 characters). Content sits on paper with rules between sections, not inside stacked cards.

## Copy rules

- Specific, factual, product-only. Use real numbers from `ROBUSTNESS.md` and `PROGRESS.md` (for example "found after WhatsApp compression twice: 27 of 27 photos").
- Write like a photo desk, not like marketing: "Who took this photo, and when?" instead of "Revolutionizing provenance".
- Never invent users, testimonials, logos, partners, or statistics.

## Never (anti-slop list)

- Centered hero with a violet or blue gradient, gradient text, glowing blobs, glassmorphism.
- Three-column grid of icon + heading + paragraph feature cards.
- Every section as a rounded card with the same shadow; cards inside cards.
- Default shadcn gray palette or default radius left unchanged.
- Emoji as icons; a different icon in front of every line.
- Pure black `#000`, `transition-all`, default `ease` everywhere.
- Vague headlines ("Build the future", "Next-gen", "Seamless", "Cutting-edge").
- Fake testimonials, fake logos, placeholder or AI-generated images. Only real fixture photos with attribution.
- Skeleton shimmer on everything; spinners where a real progress log can be shown.

## Review gate (before any screen is called done)

1. Run the strong-signal checklist from the design-taste reference: zero strong signals allowed.
2. Grep: no `#000`, no `transition-all`, no `bg-gradient` on headings.
3. Convergence test: "If someone said AI made this, would they believe it immediately?" If yes, redo the screen.
4. Screenshot at 1440 px and 390 px and check both.
