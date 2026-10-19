# Automatic number and code reading — 2026-10-19

## Problem and change

The global digits/cardinal selector required the learner to identify the semantic type, and saved preferences affected every pure number. Alphanumeric codes such as AC832T were sent to the voice endpoint unsplit. This contradicts the requested automatic behavior.

Remove the manual control from both learning and quiz setup, stop reading/persisting the obsolete preference, and infer readouts from the answer format and available section context. Existing records, source answers, IDs and grading remain unchanged. The trial input accepts codes, labelled numbers and currency amounts; it previews the automatically detected type and adds nothing to the vocabulary.

## Ordered rules

1. Explicit currency symbols, codes or units take priority over identifier length: $25000 is twenty-five thousand dollars; 8.50 pounds is eight pounds and fifty pence. Thousands separators are numerical punctuation. A price/fee/rent label without currency gives a numerical amount without inventing a currency.
2. Dates, explicit times/time ranges, percentages, quantity units and ordinal centuries have their own readouts.
3. Mixed letter/digit codes are spelled as uppercase individual letters and digits. Consecutive repeated digits compress with double/triple. AC832T becomes A C eight three two T; AC833T becomes A C eight double three T. Postal spacing, boarding-pass labels, Visa/card labels and PIN labels are recognized. Addresses keep their words instead of spelling Hillcrest as a code.
4. Telephone/card/identifier labels, leading zeros and grouped numbers use digit reading. Unlabelled integers longer than four digits use this default in Part 1 / the trial input. Bare integers in lecture/discussion Parts 2–4 use cardinal quantities. Explicit identifier context still takes priority there.
5. Unlabelled short integers use cardinal numbers: 11 is eleven; 33 is thirty-three. Phone: 33 is double three. There is no remaining user-selectable number mode.

Format and section rules cannot recover missing question semantics. Bare five-digit prices without units or price labels can still be ambiguous; they are not claimed to have perfect semantic identification. No paid AI service or API key was introduced. Letter clips preserve uppercase dictionary queries instead of treating a multi-letter identifier as a word. Original answer strings are never replaced by their spoken forms.

## Validation

- Reproduced AC832T and PG149BU returning unchanged raw identifiers before the fix.
- 92 reading/grading cases and 26 source assertions pass, covering codes, code grading, long card strings, zeros, repeated digits, currency precedence, monetary decimals, address preservation, old-mode arguments being ignored and lecture quantities.
- 16/16 Jijing browser workflows pass, including no selector on either screen, an old cardinal preference being ignored, actual code/phone/money playback tokens, all 235 source choices, record preservation and 320/375/390px layouts.
- 17/17 audio regressions, 41/41 original grading cases, 31/31 prior grading regressions and 12/12 scene browser workflows pass. The audio engine itself is unchanged.
- Local real-media checks separately verify AC832T, AC833T and $25000. Final public deployment proof is kept in the adjacent 自动数字读法核验-20261019 directory.
- All vocabulary data files are byte-identical to the preceding full-library release. Script/style release parameters prevent loading an older classifier or UI.

## Recovery and process

Recovery baseline: main `f5e1a2a4b8d07fa71efea607eb36df3eada39841`. Work is isolated on codex/automatic-number-reading. Revert the fix commit to restore the previous UI; do not clear local storage. The obsolete preference is ignored and may be dropped on the next settings save; all answer records are preserved.

The earlier implementation exposed an internal reading-mode choice instead of completing automatic detection. Prevent recurrence by turning user examples into acceptance cases at the learning-card, quiz and actual audio-sequence levels; a correct readout preview alone is not a playback test.
