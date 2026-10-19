# Change log

## 2026-10-19 — Reliability review

- Prevent non-terminating grading for Unicode spaces, en dashes and em dashes.
- Accept only explicit UK/US spelling pairs instead of arbitrary suffix replacements.
- Correct Youdao accent mapping: UK `type=1`, US `type=2`.
- Cancel stale audio/TTS callbacks, release the online channel before fallback, and preload without playback.
- Calculate dictation accuracy from submitted answers; display unanswered questions separately.
- Add a single-word retry action to the wrong-word book.
- Keep the Chinese search input intact during IME composition and avoid automatic keyboard focus on learning pages.
- Show pronunciation fallback/errors, unsaved-record warnings, and known source-IPA issues.
- Preserve unreadable local records instead of overwriting them with empty defaults.
- Keep navigation labels on one line on narrow screens.

Validation: 41 existing grading cases, 31 new grading regressions, 11 audio regressions and 12 browser workflows pass. Source vocabulary is unchanged.

Recovery point: `e254c108f2e3e03c2d8675816db9e474b891cb20`. Keep the review on its separate branch until the change is accepted.

## 2026-10-19 — Jijing item dictation pilot

- Add 场景词 / 机经词 library navigation and Day28–30 source items.
- Add item selection, single-item practice, sequential/random quizzes and an isolated wrong-item book.
- Separate written numeric answers from spoken forms: double/triple digits, cardinal values, dates, times, decimals, explicit currency and quantity phrases.
- Play multiword readouts as cancellable dictionary-clip sequences; add generic playback/stop feedback without revealing quiz answers.
- Version script/style URLs to prevent mixing cached audio and new item modules.
- Preserve source text, duplicate entries and explicit alignment limitations; do not upload or delete original media.

## 2026-10-19 — Complete Day28–101 text practice

- Extend to 74 days / 3,018 daily records and expose 161 source groups / 3,553 overlapping source records.
- Preserve all pilot IDs and scene data. Label 27 user-approved sequential study days prominently; preserve the video-verified later ranges and repeated groups.
- Add source-only selection, persistence and grading through the end of the 2022 PDF without inventing extra check-in days.
- Handle percent, centimetre quantities, decimal quantities and explicit dotted/colon time formats; retain source spelling and audit text.
- Add a reproducible full-source generator and release asset version. Original media and system settings are untouched.

Validation: 53 pronunciation/grading cases, 26 source assertions, 16 Jijing browser workflows, 17 audio regressions and all prior scene/grading suites pass. Full mapping, performance sample, extraction repairs and rollback are recorded in JIJING_FULL_REVIEW.md.
