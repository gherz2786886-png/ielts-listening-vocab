# Complete connected Jijing speech — 2026-10-22

## Problem and root cause

The user reported the Day29 date `1 August` sounding like separate words. `playText()` split `the first of August` through `audioParts()` and used `playSequence()` to request four dictionary clips. This design originated in an earlier full-phrase dictionary HTTP 500 workaround; it cannot preserve phrase-level prosody.

## Final behavior

Source multiword/compound readouts use complete hosted MP3 recordings. Each requested item plays one file from `audio/jijing/`, with UK `en-GB-SoniaNeural` and US `en-US-JennyNeural`, generated at -5% rate. Multiple overlapping source entries share their identical spoken text recording. These are synthetic recordings, not the source teacher's voice.

The original text rules still produce `the first of August`, `A C eight double three T`, `double three` and normal money readouts before synthesis. Written answers, alternatives, grading, old IDs and localStorage records are unchanged. Single words still prefer the dictionary. The existing cancellation lifecycle stops a complete recording when replaying, changing settings/routes or beginning another playback.

Unknown text entered in the trial box uses one complete device utterance when no hosted recording exists. Failed device speech reports an error; it never silently reverts to per-word stitching. The browser voice remains a fallback for a hosted clip that fails to load.

## Why hosted recordings

An initial continuous Web Speech implementation passed mocked lifecycle tests, but real Edge checks did not establish playback: the voice list contained English voices while the tested requests returned `end` without `start`. Both an online US voice and a local English comparison behaved this way. This is a current-device observation, not a proven Windows/network root cause. No system voice, browser, proxy, DNS or service settings were changed to force playback.

Current full dictionary probes returned complete audio for the date and `back door`, but HTTP 500 for money and code expansions. Depending only on either dictionary phrase requests or device speech would leave known coverage gaps. The final source library therefore stores complete generated audio with the existing static site.

Speech fallback now requires an actual start before treating end as success. A request that ends without starting is surfaced as failure. Intentional device speech is not falsely labelled an online-dictionary failure.

## Reproducible generation and verification

`scripts/list_jijing_readouts.js` uses the browser's actual automatic-reading rules over all daily and PDF source records. It identifies **471 distinct source multiword/compound readouts**. Adding the documented trial examples yields **475 unique readouts**, each with two accents: **950 MP3 files**.

`scripts/generate_jijing_recordings.py` uses edge-tts 7.3.1 only during audio preparation; generation requires service connectivity. Temporary package dependencies are isolated in the task evidence directory, not installed into the shared Python environment. Existing proxy settings are only read for the tool request; no proxy configuration is edited. Four concurrent requests and at most two script attempts per missing clip are used. Existing valid files are reused; failed partial output is retained and no incomplete manifest is published.

Each file is probed for audio-only content, nonzero duration and size, decoded by FFmpeg and hashed with SHA-256. The detailed manifest `data/jijing-recordings.json` records voices, rate, duration, size and hash; `data/jijing-recordings.js` provides the compact runtime lookup. No TTS library, service credential or backend is required by the browser. Audio is loaded only on playback.

Maintenance example:

```sh
python scripts/generate_jijing_recordings.py --tool-deps /path/to/isolated-edge-tts --ffmpeg /path/to/ffmpeg --ffprobe /path/to/ffprobe
node qa/connected_speech_media_tests.js /path/to/playwright
node qa/jijing_browser_tests.js /path/to/playwright
node qa/review_audio_regressions.js
```

The build-time client documentation: https://github.com/rany2/edge-tts . Browser utterance semantics: https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance . Generated source playback does not call either service at runtime.

## Validation boundaries

The regression suite asserts complete phrase/date/code/money requests instead of old per-word token arrays, validates cache use without device voices, and covers replay, hidden quiz answers, setting changes, record preservation and stale callbacks. Native media tests independently check inventory equality, every file hash/size, and real browser decoding/playback for both accents across dates, ordinary phrases, identifiers and money. Generated files are all decoded by FFmpeg during generation. Human listening review of every source name is not claimed.

Final local checks pass: **24/24 audio regressions**, **21/21 Jijing browser workflows**, **12/12 real MP3 playback samples**, **12/12 scene browser workflows**, **10/10 original-page media workflows**, and **92 reading/grading cases plus 26 source assertions**. All 950 MP3 files match the inventory and their hashes/sizes; all decoded successfully with FFmpeg during generation. Published generated audio totals **12,336,912 bytes**. The real-media fixture disables device speech entirely and still plays the source date, phrase and identifier through the actual app, once per item in each accent. Browser QA records and media proof are in `qa/jijing-results/` and `qa/connected-speech-results/`.

Original scene-page recordings are untouched and retain their separate real-media regression suite. Public deployment evidence is saved with the release receipt; local passes alone do not establish publication.

## Recovery and process

Baseline: `5f6c308a72bcd607503ec1c5a3f80ca76fd62035`. Branch: `codex/connected-jijing-speech`. Revert this feature through a new commit and republish Pages to recover the earlier player. Do not reset shared history, clear browser storage or delete original IELTS files.

Mocked speech start events alone did not establish that a device could speak the phrase. The final design uses verified native audio files for the known library; acceptance requires advancing media time and actual playback events. The test runner now enforces a real completion deadline so an unresolved mocked promise cannot exit without reporting the remainder of its tests. Temporary CDP diagnostics were confined to the local preview tab and are removed by reloading/closing it.
