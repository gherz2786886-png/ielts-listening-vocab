# Cloud continuation handoff — 2026-10-19

Repository: https://github.com/gherz2786886-png/ielts-listening-vocab

User requested automatic recognition of number strings, long numbers, alphanumeric boarding/card codes (e.g. AC832T), normal money readouts, and removal of the manual digits/cardinal selector. User now needs to power off the local Windows PC and asked for cloud continuation or another solution.

## Completed and safely on GitHub

- Fix commit: b99f38e5d14e277fd86c52cefa9482b7af36b1b5.
- PR #4 merged: https://github.com/gherz2786886-png/ielts-listening-vocab/pull/4
- Main merge: 0faea13d427a261f14370316499bbec967c9130c.
- README, CHANGELOG, DEBUG_REPORT and AUTO_NUMBER_REVIEW.md document behavior, rules, limitations, tests and rollback.
- No vocabulary, answer IDs or local history were changed. All source media and Windows settings remain untouched.
- 92 reading/grading cases, 26 data assertions, 16 Jijing browser workflows, 17 audio regressions, 41 old grading cases, 31 grading regressions and 12 scene browser workflows passed.
- Real online dictionary clips were actually played for AC832T (A C eight three two T), AC833T (A C eight double three T) and $25000 (twenty-five thousand dollars). No page errors. All 304 numeric source records expanded without raw numeric tokens remaining.

## Remaining cloud work

GitHub Pages run: https://github.com/gherz2786886-png/ielts-listening-vocab/actions/runs/39279611972

At the latest local check the run was queued, legacy Pages status building, commit 0faea13...; the public site still served the preceding release. GitHub itself will process the queued build without this PC. Do not repeatedly rerun/cancel it or modify proxy/system settings.

After deployment, verify:
https://gherz2786886-png.github.io/ielts-listening-vocab/?release=b99f38e#/jijing/learn

Confirm no jNumberMode selector in learning or quiz setup; 235 day/source choices remain; code/phone/money readouts and actual playback work; records and mobile layout survive. Capture actual media started events rather than treating HTTP200 or preview text as playback proof. If cloud media is unavailable, state that limit and preserve the verified local evidence described above.

The desktop Work Cloud creation attempt returned "ChatGPT is not available for this account." The Codex CLI returned an empty cloud-task list; its environment picker exposed only All Environments, no usable environment. No cloud agent task was successfully started. Do not claim otherwise, copy local tokens or change credentials. A later cloud session can clone the public repository using main and this handoff.

## Automatic rules

Money/currency markers, amount labels, dates, time ranges, percentages and quantity units have priority. Codes spell letters and digits; repeated digits compress double/triple. Leading zeros and grouped/labelled phone/card numbers are identifiers. Unlabelled integers longer than four digits default to identifier reading in Part1; lecture/discussion Parts2–4 are cardinal quantities. Unlabelled short numbers are cardinal (33 -> thirty-three); Phone:33 -> double three. Missing source semantics can remain ambiguous; no perfect inference is claimed.

## Constraints

Continue the user's authorized repair in this repository with reversible Git commits and appropriate tests, then PR/merge/publish if needed. Preserve data and source media. Do not change Windows, FlClash, VPN/proxy/DNS, permissions, accounts or secrets. No deletion, no new scheduled tasks or unrelated messages. The remaining issue is deployment/verification, not a need to rewrite a completed feature.
