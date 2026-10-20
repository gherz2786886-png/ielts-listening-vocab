# Change log

## 2026-10-20 — Cancel Jijing playback on settings changes

- Stop the old pronunciation and cancel queued number/code fragments when changing the practice day, PDF group or accent. Do not autoplay a new item.
- Preserve answer records and persist the new setting; use the existing audio cancellation lifecycle.
- Add held-media regressions for day, PDF group and accent switches, stale media events, subsequent playback and reload persistence.

The three new workflows fail on the prior release because the old clip remains active. Full validation and rollback are recorded in SETTINGS_AUDIO_REVIEW.md.

## 2026-10-20 — Original scene-page recordings

- Add original P2–P30 recordings beside the scene learning-page navigation, with native playback, pause, seek and volume controls; wrap below navigation on mobile.
- Extract 29 AAC tracks without re-encoding from the supplied source media, reducing published media to 35,934,445 bytes. Verify identical compressed audio-packet hashes and retain source provenance in the manifest.
- Load recordings on demand, switch without autoplay, stop on search/route changes, preserve position during same-page wrong-word updates, and prevent overlapping word/page playback.
- Surface load errors with one explicit retry action and ignore stale callbacks after page changes.
- Keep scene/Jijing vocabulary, numeric reading, grading, storage keys and original local media unchanged.

Validation: all 29 native recordings decode/play; 10 media/browser workflows, 12 scene workflows, 17 audio regressions and 92 reading/grading cases plus 26 source assertions pass. Details, retained limitations and rollback: PAGE_RECORDING_REVIEW.md.

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

## 2026-10-19 — Automatic number/code reading fix

- Remove the digits/cardinal UI and ignore obsolete saved preferences.
- Automatically distinguish explicit money, dates, quantities, long/labelled numbers and alphanumeric identifiers. Spell letter/digit codes with double/triple for repeated digits; retain leading zeros and address words.
- Read monetary decimals as major/minor currency units; prioritize money over number length. Unlabelled short integers use cardinal values.
- Broaden the trial input to codes, numbers and amounts; show the detected type without changing vocabulary or answer records.

Validation: 92 reading/grading cases, 26 source assertions, 16 Jijing browser workflows, 17 audio regressions and all prior scene/grading suites pass. Rules and limitations are recorded in AUTO_NUMBER_REVIEW.md.
