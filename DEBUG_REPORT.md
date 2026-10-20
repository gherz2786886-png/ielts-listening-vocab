# Website reliability review — 2026-10-19

## Scope and evidence

Baseline: `e254c108f2e3e03c2d8675816db9e474b891cb20`.
The review retains the current learning/dictation/wrong-word flows, the meaning/spelling/listening tags, all vocabulary IDs and all existing storage keys. No source-PDF content or vocabulary data has been rewritten.

| Severity | Reproduced problem | Correction |
|---|---|---|
| P1 | `full–time job`, `full—time job`, and NBSP input vs `full-time job` exceed a bounded VM deadline. Normalization accepted characters that the alignment loop did not consume. | Share the Unicode separator definition and always advance alignment indexes. |
| P1 | `flowre` vs `flower`, `singre` vs `singer` are accepted as UK/US variants. | Match explicit lexical pairs; include `grey/gray` and phrase variants. |
| P1 | UK buttons request `type=2`, while the official dictionary labels UK as `type=1`. | Correct UK/US mapping throughout current code and README. |
| P2 | Stopped/replaced playback can start an old delayed TTS utterance; timeout fallback leaves the main audio alive; preloading invokes `play()`. | Scope callbacks to the current playback, cancel voice waits, release the old audio channel and use `load()` for preloading. |
| P2 | One correct answer followed by early exit displays 1 / 161 (1%). | Track submitted answers and freeze the planned range label. Zero submitted answers show no grade. |
| P2 | The documented single-word review action is missing. | Add `单词重练` for each active wrong-word entry. |
| P2 | Storage exceptions are silently swallowed; invalid records can later be replaced with empty defaults. | Show a persistent warning and block writes to unreadable keys. |
| P2 | Search rebuilds its input during Chinese composition; every learning render focuses search. | Wait for composition to finish and preserve focus only during deliberate search. |
| P2 | Navigation labels wrap vertically at 375px, despite no horizontal overflow. | Let the brand truncate and keep navigation labels on one line. |
| P2 | Known original-PDF IPA problems are explained only in repository documents. | Display source warnings on the five affected cards, retaining the original printed IPA. |

## Primary pronunciation evidence

[Youdao tomato dictionary entry](https://dict.youdao.com/w/eng/tomato/), retrieved 2026-10-19:

- `data-rel="tomato&type=1"` is paired with `dict.basic.ec.uk.voice`.
- `data-rel="tomato&type=2"` is paired with `dict.basic.ec.us.voice`.

An HTTP audio response alone does not establish the accent; the official button annotations provide the mapping.

## Validation

- `node qa/qa_dictation_cases.js`: **41/41** existing grading cases pass.
- `node qa/review_dictation_regressions.js`: **31/31** pass, with a deadline per grading call.
- `node qa/review_audio_regressions.js`: **11/11** pass with deterministic media/voice/timer substitutes. Before the fix, **1/11** passed.
- `node qa/review_browser_regressions.js [path-to-playwright]`: **12/12** pass in fresh, disposable Edge contexts using the local `file://` entry. Audio is substituted to keep regression runs silent and deterministic.
- Browser workflows cover early exit with zero/one submitted answer; wrong-word saving and reload; reason-tag union; mastery and restoration; single-word retry; legacy keys; storage failure and preservation; Chinese composition; autoplay cancellation; 375px and 390px layouts. Each asserts no uncaught page exception.
- Screenshots and browser assertions: `qa/review-results/`.
- `node --check` for all changed JavaScript and `git diff --check` pass.
- `data/vocab.json` and `data/vocab.js` remain byte-identical to the baseline: **1078 entries**, **1178 headwords**.

The previous Python integration script is tied to its author's local absolute path and old accent expectation. It was not used as proof for this checkout. The new browser test locates this checkout from its own file.

## Limits and follow-up decisions

- Browser audio regressions verify lifecycle and routing, not a human listening assessment of every word. Web Speech availability and accent depend on the device's installed voices; offline audio is not guaranteed.
- Learning records remain in each browser's local storage. This change does not add cross-device synchronization or Eudic synchronization.
- The explicit UK/US spelling list is intentionally finite. New legitimate pairs should be added with examples and regression coverage.
- A small local startup comparison alternated baseline/review loading in 12 fresh contexts each: baseline median 63.6 ms / P95 76.6 ms; review median 54.3 ms / P95 74.0 ms. No slowdown appeared in this sample. This is not a controlled performance benchmark or a speed guarantee; raw samples are in `qa/review-results/startup-comparison.json`.

## Rollback

This review is developed on `codex/vocab-reliability-review`; the baseline is preserved in Git. Before deployment, rollback is simply to continue serving the existing `main`. After accepting a merge, revert that merge/change through a new commit and republish Pages. Do not hard-reset a shared branch or clear browser storage.

## Process improvements

The overflow assertion alone missed vertical navigation text. The regression now checks text height as well as document width, and screenshots are visually inspected. Future review must verify the rendered result in addition to an automated pass count.


## 2026-10-19 Jijing range extension

Day28–101 and source-only PDF groups are implemented and validated. Source alignment, extraction defects caught during development, test-helper correction, retained limitations and rollback are documented in [JIJING_FULL_REVIEW.md](JIJING_FULL_REVIEW.md). No system/environment repair was required.


## Automatic readout correction

The global numeric preference and unsplit alphanumeric path caused the user-reported behavior. The manual control and preference dependency are removed, with ordered automatic rules and a richer trial input. Regression, media and recovery evidence is documented in [AUTO_NUMBER_REVIEW.md](AUTO_NUMBER_REVIEW.md).

## 2026-10-20 Original scene-page recording playback

The requested original recording was absent from the learning page. Source inspection found all 29 P2–P30 files, including irregularly named P17. They contain AAC audio despite their MP3 extensions. Direct stream copying preserves the original compressed audio while omitting the large video streams. The site now maps page numbers to on-demand native audio controls. Lifecycle, provenance, real-media checks, the corrected asynchronous test wait and rollback are documented in [PAGE_RECORDING_REVIEW.md](PAGE_RECORDING_REVIEW.md). No system configuration was changed.

## 2026-10-20 Jijing settings/audio mismatch

Changing the selected day, PDF group or accent re-rendered the page with “发音就绪” while the old audio/queued fragments continued. Three held-media browser workflows reproduce this on the previous release. Recognized setting changes now call the existing cancellation lifecycle before persisting and rendering. Answer records and data are untouched; see [SETTINGS_AUDIO_REVIEW.md](SETTINGS_AUDIO_REVIEW.md).
