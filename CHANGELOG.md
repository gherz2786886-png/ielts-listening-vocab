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
