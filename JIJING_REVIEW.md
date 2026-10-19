# Jijing item dictation pilot — 2026-10-19

## Behavior

The header switches between 场景词 and 机经词. The existing scene library, routes and `ieltsVocab.*` records are retained. The new item practice starts at check-in Day28 and supports selecting items, one-item practice, sequential/random quizzes, separate wrong records and mastery/restoration.

This pilot contains **110 source records**: Day28 / 2019 group 5 = 40; Day29 / group 6 = 38; Day30 / group 7 = 32. Repeated `passport` entries are retained as distinct records. The source PDF contains 24 S1 group starts, matching 24 source-day files. The daily index maps global Day28–30 to 2019 Day5–7. Group-to-original-audio alignment has not been individually audited; this qualification is visible in each day's source disclosure. No later year/day has been silently assigned.

Source PDF SHA256: `3c971b70adf201cbf90d2652c3c2726b7861d01c9a83261a6ae5d9d8c011a173`. Source pages 1 and 2 were rendered and visually reviewed. `feedback,long-term,planning` continues Day29 onto page 2; `10 weeks` remains a single Day30 answer. Topic headings and numbered list prefixes are excluded, rather than mistaken for answers. `sourceText` retains the original group text for audit. Proper names retain source spelling and are not represented as verified pronunciations.

## Pronunciation

Written answers are separate from spoken forms. The number-string mode is the default requested by the user: `33 -> double three`, `333 -> triple three`, `0033 -> double zero double three`. The cardinal mode instead reads `33 -> thirty-three`. Leading zeros are retained in number-string mode and grading. Dates, explicit a.m./p.m. times, decimals, explicit currency amounts and recognized quantity phrases have separate rules; unknown mixed codes retain their source wording.

[British Council telephone-number example](https://learnenglish.britishcouncil.org/sites/podcasts/files/learnenglish-elementary-podcasts-01-06-support-pack-transcript_1.pdf) supports double-three usage in a phone-number context. This is a practice preference, not a claim that every occurrence of 33 must have this pronunciation.

The online dictionary endpoint returned HTTP 500 for the entire `double three` phrase. Requests for `double` and `three` independently returned HTTP 200 / audio/mpeg, 9837 and 11093 bytes in the current snapshot. Multiword readouts now play individual dictionary clips in order, with the browser voice fallback available for failed clips. Stop, a new clip, or a route switch invalidates the remaining sequence. This does not reproduce the teacher's original voice or recording rhythm.

A real local in-app-browser trial displayed `33 -> double three`, recorded **two media playing events**, reached the end/stop state and displayed no fallback/error notice after the sequence fix. This is stronger than HTTP status alone; it is not a human listening assessment of every entry.

A preview initially mixed a cached older audio script with the new item module (`playSequence is not a function`). Script/style release query identifiers were added and the corrected version was reloaded before the successful real-media check.

## Storage and scope

New records use `ieltsJijing.v1`, keyed by source item ID; identical text on different days does not overwrite another record. Scene storage is not migrated or cleared. Wrong answers, original attempted input, counts, mastery and selected day survive reload. An unreadable record is reported and not overwritten. Quizzes hide both the written answer and expanded readout until submission.

No original video/audio is needed for item practice. No original media was uploaded, moved or deleted. The `33` demo is separate from the source vocabulary. Only Day28–30 are advertised as available; Day31–101 require further source grouping review. Original full-recording playback is not implemented by this pilot.

## Validation

- `node qa/jijing_speech_tests.js`: **45** pronunciation/grading cases and **6** source-data assertions pass.
- `node qa/jijing_browser_tests.js [path-to-playwright]`: **12/12** workflows pass, including source selection, both numeric modes, exact two-item queues, numeric answers, dates and alternatives, old/new library isolation, wrong records after reload, mastery/restoration, early exit, broken storage, hidden answers and 320/375/390px layout.
- `node qa/review_audio_regressions.js`: **17/17** pass, including sequence-order/cancellation regressions and bounded browser-speech startup/end timeouts.
- Existing scene browser workflows: **12/12** pass.
- Existing grading cases: **41/41**, previous grading regressions: **31/31** pass.
- Updated scripts pass `node --check`; source scene vocabulary remains byte-identical to the preceding review baseline.

Browser automation uses isolated Edge contexts and silent media substitutes; real dictionary playback was checked separately as described above. Screenshots/results are under `qa/jijing-results/` and source render evidence under `qa/jijing-source-review/`.

## Recovery and follow-up

This feature is isolated on `codex/jijing-item-dictation`, based on the prior reliability review commit `567e54e63ee58927c2f88ca7cabdd95d546e18ef`. Reverting the feature commit restores the preceding review. Shared main history and browser records must not be reset.

To extend the daily range, reconcile later PDF grouping with each original day first; e.g. the 2020 PDF has 39 S1 groups but the source directory has 19 day recordings. That mismatch must not be converted to fabricated one-group-per-day mappings. Item audio needs only text and dictionary requests, so extending the text data does not require bulk media hosting.
