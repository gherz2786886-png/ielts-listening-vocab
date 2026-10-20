# Cancel Jijing audio on settings changes — 2026-10-20

## Reproduction and cause

While a Jijing item is playing, selecting another day, PDF group or accent keeps the old pronunciation active. The re-rendered playback indicator says “发音就绪”, so it no longer describes the actual sound. A number/code sequence can also continue with old queued fragments.

The existing browser suite completes every substituted audio clip immediately. It therefore misses settings changes during an active clip. Three added workflows hold an actual playback lifecycle open while changing the day, PDF group and accent. Before the production fix, all three fail with `Old audio is still active after changing settings`; the preceding 16 workflows still pass.

Root cause: the Jijing settings change handler updates/persists the selection and renders the new screen without cancelling the old audio channel. Route changes already stop audio, but changes within the same route did not.

## Change

Call the existing `VocabAudio.stop()` after recognizing a Jijing setting change and before persist/render. This releases the active clip, cancels pending TTS and invalidates the queued sequence. The new selection does not autoplay. No new timer, network request, storage key, data migration or source-data change is introduced. Script/style release versions are bumped to avoid serving a cached old handler.

## Validation

The added workflows verify that the previous clip is paused/released, no next number fragment starts after a late old `ended`/`playing` event, wrong-item records remain identical, new playback uses the selected accent, and reloading preserves both the new selection and the old records. These are browser lifecycle tests with held media substitutes; they do not by themselves establish remote audio availability or human-perceived accents.

After the fix, **19/19 Jijing browser workflows** pass, including all three added cases. Also pass: **10/10 original-page media workflows** (all 29 recordings actually decode/play), **17/17 audio regressions**, and **92 reading/grading cases plus 26 source assertions**. JavaScript syntax and Git whitespace checks pass. Source vocabulary, media assets, grading and automatic-reading code are byte-identical to the baseline. Public deployment proof is recorded with the release receipt. Real original-page media tests remain separate in `qa/page_recording_tests.js`.

## Scope and recovery

Branch: `codex/jijing-settings-audio-cancel`. Baseline: `fafbf0934ae91054a7ea245dda788afe1f59d591`, the published original-page-recording release. Source vocabulary, original audio assets, grading, automatic-reading rules and browser records remain unchanged.

Rollback through a new commit reverting this change and republish Pages; do not clear localStorage or reset shared history. No source-media restoration is necessary. No system, proxy, DNS, account, permissions or environment configuration is modified.

## Process improvement

Immediately ended mock audio proves token order but cannot reveal actions during active playback. Lifecycle checks should hold a clip open across the user action, send a late callback after cancellation, and assert both visible status and actual audio state.
