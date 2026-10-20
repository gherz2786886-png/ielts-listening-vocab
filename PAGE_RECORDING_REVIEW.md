# Original scene-page recordings — 2026-10-20

## Requested behavior and scope

Add original whole-page audio to the right of the scene library page-navigation row. The user delegated the choice of recording type; use their original recordings to preserve order, voice and pauses. This feature covers P2–P30 of the scene library. Jijing item practice and automatic numeric/currency reading remain unchanged.

The implementation is isolated on `codex/scene-page-recordings`, based on main `0faea13d427a261f14370316499bbec967c9130c`. Existing commits preserve the prior site. No browser records, original source files, proxy, network, account, permissions or system settings were modified.

## Sources and media verification

- Local source: `D:\Study\IELTS\听力场景词汇-课后音频听写版`.
- All 29 page files P2–P30 are present. P17 uses the irregular name `P17面-顺序版.mp3`.
- Their MP3-looking names do not describe the actual format: FFprobe reports MP4/MOV containers with AAC stereo 44.1kHz audio.
- Combined original source size: **12,381,299,827 bytes**. These large files include video.
- Published, audio-only M4A size: **35,934,445 bytes**, 29 files. No original video is published.
- P27: **1,306,443 bytes**, **402.740 seconds** (displayed **6:42**). The source video frame at eight seconds shows `agriculture`, the first P27 vocabulary entry. That private frame remains outside the repository.
- `scripts/extract_page_recordings.py` copies the original AAC stream using FFmpeg `-c:a copy`, removes video/metadata/chapters and moves the M4A header to the start for web playback. It does not re-encode or replace the voice.
- Every output was checked for a single audio-only stream. SHA-256 of the compressed audio packets matches its source for **all 29 files**. Whole-file source/output hashes and sizes are recorded in `data/page-recordings.json`; `data/page-recordings.js` provides the browser mapping.
- The extractor refuses overwrites. Original sources are read-only inputs and remain on disk; this release itself does **not** release local disk space.

The 35.9 MB total is small enough to serve as same-origin static assets under `audio/pages/` with the existing site. This avoids a new storage account, paid service or external media redirect. The existing public GitHub Pages access model applies; knowing the link is sufficient to access it, with no login protection.

## Playback lifecycle

- Native `<audio controls preload="none">` handles play/pause, seeking and volume. No automatic recording download occurs at startup.
- Desktop controls sit to the right of the page badge; at widths below 700px they move below the navigation row.
- Changing page releases the old media source and does not autoplay the next page. Search results and route changes unmount playback.
- Same-page card updates reuse the media element and preserve progress.
- Starting a word pauses page playback. Starting/resuming page playback calls `VocabAudio.stop()` to cancel the word/TTS channel.
- Per-mount generation guards ignore late events from removed elements.
- Network/decoder errors display a retry action. Retries are user-triggered; no retry loop is introduced.

## Validation

`qa/page_recording_tests.js` serves the site with HTTP byte-range support and runs disposable Microsoft Edge contexts. The recording element uses the real browser media implementation; only dictionary word audio is substituted for deterministic overlap tests. It checks:

1. No recording bytes requested at startup and correct desktop placement.
2. All 29 files decode, match manifest durations and advance playback time.
3. Seeking to 45 seconds, pause/resume, and a confirmed wrong-word mark preserve playback position.
4. Page changes release old media; late errors cannot change the new page state.
5. Search and route changes stop playback with no subsequent autoplay.
6. Word and page playback interrupt each other.
7. A simulated HTTP 503 displays the error; one manual retry restores actual playback.
8. No overflow at mobile widths 320, 375 and 390px.

Result: **10/10 workflows pass**. Manifest SHA-256/size checks cover all 29 published files. Screenshots and assertions are retained in `qa/page-recording-results/`.

Other relevant regression suites: **12/12 scene browser workflows**, **17/17 audio regressions**, and **92 automatic-reading/grading cases plus 26 source assertions** pass. Source vocabulary, Jijing data, scoring logic and storage keys are unchanged.

An initial media test inspected `paused` and an already nonzero `currentTime` immediately after clicking resume, before the browser dispatched the queued `play`/`playing` events. That produced a premature overlap assertion. The helper now waits for the actual `playing` event state before asserting cancellation; production playback logic did not need a workaround. During layout checks, `.btn` display styling was found to override the browser's hidden retry button; a player-scoped `[hidden]` rule fixes that visibility defect. Future media checks should wait for media events and inspect screenshots in addition to checking DOM properties.

Real decoding/playback is established by advancing media time, duration and ready state, not solely by HTTP success. This is not a human listening audit of every word or a guarantee of connectivity on every device. `preload="none"` prevents initial media transfers; click-to-play can still buffer that selected recording. Browser cache may consume some local storage during listening.

## Rollback

Before merge, continue serving the unchanged main baseline. After merge, revert the feature through a new Git commit and let GitHub Pages publish that revert; do not hard-reset shared history or clear browser storage. The earlier numeric-reading fix remains in baseline `0faea13d427a261f14370316499bbec967c9130c`. Source media needs no restoration because it was not modified.
