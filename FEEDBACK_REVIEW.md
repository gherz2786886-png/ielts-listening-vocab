# Layered dictation feedback — 2026-10-23

Baseline and rollback point: `7152b210cb58f4cfbac52f7bb52d99b9b2c6cae1`.

## Problem and resulting behavior

The original character alignment correctly describes small spelling mistakes, but misleadingly describes unrelated words or a date-versus-word mismatch as many letter replacements. Preserve the acceptance engine and add a presentation layer shared by scene/Jijing results and wrong books.

| Submitted → expected | Display |
| --- | --- |
| `27 Apeil → 27 April` | Keep letter correction: mark only `e`, retain the short `r/e` explanation. |
| `Accomodation → accommodation` | Keep original letters/case and show a red omission marker; do not insert an answer letter into the learner's text. |
| `hot drinks → cold drinks` | Mark `hot` as a substituted word; keep `drinks` unmarked; offer separate word playback. |
| `although → 1 August` | Mark the complete mismatch and indicate that a date is expected. |
| `loyal → lawyer` | Remain incorrect; show possible sound confusion and separate submitted/expected-word playback. |
| `waste → west` | Fine letter comparison can coexist with a possible word/sound-confusion hint. |

`js/dictation-feedback.js` compares words first, then uses existing character alignment for bounded spelling differences. Actual-word sound hints require pronunciation evidence, not spelling similarity alone. The display cannot establish the learner's mental cause and does not assign a confirmed hearing-error diagnosis.

## Data, storage and pronunciation boundaries

- `Dictation.check`, UK/US spelling rules, Jijing accepted alternatives, date rules, number readings and item IDs are unchanged. Similar pronunciation does not make an incorrect word acceptable.
- Historical Jijing entries with `lastInput` render a new display from the original input without rewriting counts, reasons, custom fields or other history. Records lacking original input retain their old reason. Newly submitted scene mistakes additionally save `lastInput`; all existing keys and reason tags remain.
- Word contrast buttons use the current accent and the existing cancellable dictionary/browser-voice playback service. No new paid API or key is added. Actual pronunciation availability still depends on the existing service/device; request-routing tests do not establish audibility of every contrasted word.
- The pinned CMUdict subset contains 23,001 word entries, 603,659 bytes, derived from source vocabulary and phonetic neighbours. It is loaded once, only when a word-level/spelling correction needs it. A late load updates only visible feedback blocks and does not replace the quiz or its input. If unavailable, ordinary correction remains usable and the page does not retry indefinitely.
- CMUdict is a US-English reference, includes names and alternate pronunciations, and is incomplete. Similarity is a conservative display hint, not a complete classifier of English words or UK accents. Unknown names and unsupported cases receive neutral difference feedback.
- Data provenance: [CMUdict](https://github.com/cmusphinx/cmudict), revision `74790861f652b15e4ac49015a90074ad62a27690`; license retained in `data/CMUDICT-LICENSE.txt`. Source hash and coverage are in `data/feedback-lexicon-source.json`. Rebuild using `scripts/build_feedback_lexicon.py --cache <outside-repo-cache>`.
- All learner-controlled content is escaped. Red omission markers have accessible labels; removal of markers from the learner line yields the original submitted text.

## Validation

Disposable Edge contexts; no connection to the user's browser/profile. Artifacts are outside the repository in `outputs/分层听写批改-20261023`.

- New rule/display checks: **14/14**, including small spelling differences, actual-word confusions, type mismatches, omissions, transpositions, original case/spacing, accepted alternatives, escaping and inherited object-property names.
- New browser checks: **8/8**, including lazy loading, original-record preservation, scene/Jijing submissions, exact contrast-word/accent requests and 320/390/768-pixel layouts.
- Existing Jijing workflows: **21/21**. Two old assertions expected the retired single-line arrow display; replace those assertions with checks for the preserved submitted text and expected answer, retaining the original storage checks. The first run's assertion failures are retained in the evidence directory.
- Existing scene browser workflows: **12/12**; audio regressions **24/24**; reading/grading **92 cases + 26 data assertions**; scene grading **31/31 + 41/41**.
- Existing actual connected-MP3 samples **12/12**; page-recording workflows **10/10**, including actual decode/start for all 29 pages. Contrast-request checks use simulated audio; do not conflate them with these native-media tests.
- Initial eager lexicon loading added about 10 ms to the local startup median, so change it to on-demand loading. Final 12-sample local-file comparison: baseline median 73.8 ms / p95 88.5 ms; updated median 65.4 ms / p95 110 ms. These small, noisy measurements do not establish a speed improvement or a guaranteed tail-latency bound. The browser check directly verifies no pronunciation-index load before correction is needed; slow-network first-use latency is not measured.
- The reusable `ielts-dictation-feedback` skill was created following `skill-creator` and passed its bundled validator using dependencies isolated in the evidence directory.

## Rollback and remaining work

Revert this change with a new reverting commit and redeploy Pages. Do not reset shared history or clear browser storage. The extra scene `lastInput` field is backward compatible and can remain if rolled back. The generated pronunciation data is read-only and adds no storage migration.

The earlier audit's multi-tab record-overwrite and session-resume issues are separate, remain unresolved, and are not changed by this feedback-only patch. This patch neither restores records already lost nor asserts that the user's real data has been inspected.

Lesson: retain effective fine-grained spelling feedback rather than replacing it wholesale; test the boundary where a character difference represents another word or a different answer type.
