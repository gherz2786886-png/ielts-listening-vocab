# Full Jijing text library — 2026-10-19

## Result and evidence boundaries

Day28–Day101 now contains 74 practice days and 3,018 daily records. A separate selector exposes 161 source PDF groups and 3,553 records (including repeats); these overlap with the daily entries. Coverage starts at 2019 group 5, includes all 2020/2021 groups and all 2022 dates. 2019 groups 1–4 predate the requested starting day.

The user explicitly accepted sequential PDF study plans for the 27 audio-only days. The UI prominently labels them `练习编排，未核对原录音`; they are not presented as verified transcriptions or teacher-assigned boundaries. 20 2019 days follow matching PDF/file structure, also explicitly unverified against individual recordings. 27 later days have their group ranges checked against original video start/middle/end frames, not word-by-word listening.

The 2021 videos actually repeat groups: source Day19/20 overlap at 9.18 and Day24/25 at 11.6. Source Day11 covers three groups and Day25 four. The mapping below preserves those boundaries. 2022's seven recordings end at 4.30; the remaining 30 dates are source-only selectable groups.

## Source extraction

All 24 source PDF pages (5+4+8+7) were rendered and visually inspected. Extracted groups retain the raw sourceText and page provenance. Explicit layout repairs include Chinese parentheses after flamingo, packaging split across lines, omitted comma at farm/forest, period-separated walls/concrete and architecture/identical, the thousands comma in 10,000, and the misnumbered 19.Grateley. Chinese and English topic headings are excluded. Source spelling (e.g. flims, dinning room, proper names) is retained, not silently corrected. The source `463 Beacon Street/Avenue` accepts either full address, not `Avenue` alone. Numbered lists retain decimals and `16 October,1980` as single answers.

Local-only PDF render/video-frame evidence is in the adjacent `机经词完整词库核验-20261019/sources` directory. Raw video frames include application chrome and were intentionally not published. The website contains text data and application code, not original media.

| Source | SHA256 | Groups |
| --- | --- | --- |
| 2019机经词汇.pdf | `3c971b70adf201cbf90d2652c3c2726b7861d01c9a83261a6ae5d9d8c011a173` | 24 |
| 2020机经词汇.pdf | `561a27db4c430f35d0639299003ff70b685cf317f44979165c33e6d2ecf8512c` | 39 |
| 2021机经词汇.pdf | `8c0182dc06713ebf4299b028f9c7102f7f96f2095fce1a902d59a1597db6b258` | 58 |
| 2022机经词汇.pdf | `794094339fc4e2656783e96c7b84a061f1d4da3b7b57e42843a84023bb16a6b5` | 44 |

## Validation and compatibility

- 53 reading/grading cases and 26 source assertions pass; first 110 pilot IDs/answers/alternatives/parts are preserved by the generator assertion.
- 16/16 Jijing browser workflows pass. All 235 choices are rendered and checked for source/counts; source-only choice survives reload and is gradable. Existing pilot wrong records survive extension. 320/375/390px layouts pass.
- 17/17 audio regressions, 41/41 original grading cases, 31/31 prior grading regressions and 12/12 scene browser regressions pass.
- 12 alternating fresh-context local startup samples: original median 52.6ms / p95 75.1ms; extended version 59.5ms / p95 86.2ms. This small uncontrolled local difference does not establish a network performance guarantee. The compact JS text library is under 1MB and no media loads automatically.
- Scene vocabulary files are unchanged. `ieltsJijing.v1` and all old IDs remain in place. Daily and source-only records have distinct IDs to avoid one exercise overwriting another.
- An initial extractor run caught a changed numeric pilot answer and aborted before writing. A later audit caught a Chinese-parenthesis line being mistaken for a heading; a regression now checks flamingo. An initial browser test edit accidentally invoked the test helper recursively; that agent-owned run was stopped, the cases moved into the suite, and the corrected run completed 16/16. Future changes should check helper scope and review both counts and representative content, not counts alone.

## Rollback

Recovery baseline: main merge `edbdccb87f25b8b0318273fcb8073cc45ab6df77`. Changes are isolated on `codex/jijing-remaining-days`. Revert the extension commit on main and deploy the revert to restore the pilot. Do not reset shared history or clear browser storage; extension records can remain harmlessly stored until that data is restored. Original source PDFs/media and the original Doubao checkout are untouched.

## Daily map

`practice` = user-approved sequential study plan; `structure` = matching 2019 PDF/file structure; `video` = reviewed video group range. Source-only PDF groups do not create extra Day numbers.

| Day | Year / source Day | PDF groups | Items | Evidence |
| --- | --- | --- | --- | --- |
| 28 | 2019 / 5 | 5 | 40 | structure |
| 29 | 2019 / 6 | 6 | 38 | structure |
| 30 | 2019 / 7 | 7 | 32 | structure |
| 31 | 2019 / 8 | 8 | 38 | structure |
| 32 | 2019 / 9 | 9 | 42 | structure |
| 33 | 2019 / 10 | 10 | 40 | structure |
| 34 | 2019 / 11 | 11 | 43 | structure |
| 35 | 2019 / 12 | 12 | 39 | structure |
| 36 | 2019 / 13 | 13 | 39 | structure |
| 37 | 2019 / 14 | 14 | 44 | structure |
| 38 | 2019 / 15 | 15 | 37 | structure |
| 39 | 2019 / 16 | 16 | 44 | structure |
| 40 | 2019 / 17 | 17 | 45 | structure |
| 41 | 2019 / 18 | 18 | 41 | structure |
| 42 | 2019 / 19 | 19 | 44 | structure |
| 43 | 2019 / 20 | 20 | 46 | structure |
| 44 | 2019 / 21 | 21 | 44 | structure |
| 45 | 2019 / 22 | 22 | 45 | structure |
| 46 | 2019 / 23 | 23 | 41 | structure |
| 47 | 2019 / 24 | 24 | 40 | structure |
| 48 | 2020 / 1 | 1, 2 | 34 | practice |
| 49 | 2020 / 2 | 3, 4 | 43 | practice |
| 50 | 2020 / 3 | 5, 6 | 33 | practice |
| 51 | 2020 / 4 | 7, 8 | 36 | practice |
| 52 | 2020 / 5 | 9, 10 | 33 | practice |
| 53 | 2020 / 6 | 11, 12 | 37 | practice |
| 54 | 2020 / 7 | 13, 14 | 36 | practice |
| 55 | 2020 / 8 | 15, 16 | 36 | practice |
| 56 | 2020 / 9 | 17, 18 | 38 | practice |
| 57 | 2020 / 10 | 19, 20 | 34 | practice |
| 58 | 2020 / 11 | 21, 22 | 37 | practice |
| 59 | 2020 / 12 | 23, 24 | 36 | practice |
| 60 | 2020 / 13 | 25, 26 | 39 | practice |
| 61 | 2020 / 14 | 27, 28 | 35 | practice |
| 62 | 2020 / 15 | 29, 30 | 35 | practice |
| 63 | 2020 / 16 | 31, 32 | 37 | practice |
| 64 | 2020 / 17 | 33, 34 | 40 | practice |
| 65 | 2020 / 18 | 35, 36 | 35 | practice |
| 66 | 2020 / 19 | 37, 38, 39 | 52 | practice |
| 67 | 2021 / 1 | 1.9, 1.16 | 39 | practice |
| 68 | 2021 / 2 | 1.23, 1.30 | 37 | practice |
| 69 | 2021 / 3 | 2.6, 2.20 | 40 | practice |
| 70 | 2021 / 4 | 2.25, 2.27 | 45 | practice |
| 71 | 2021 / 5 | 3.6, 3.13 | 36 | practice |
| 72 | 2021 / 6 | 3.20, 3.27 | 41 | practice |
| 73 | 2021 / 7 | 4.3, 4.10 | 34 | practice |
| 74 | 2021 / 8 | 4.17, 4.24, 4.29 | 66 | practice |
| 75 | 2021 / 9 | 5.8, 5.15 | 35 | video |
| 76 | 2021 / 10 | 5.20, 5.22 | 45 | video |
| 77 | 2021 / 11 | 5.29, 6.5, 6.12 | 50 | video |
| 78 | 2021 / 12 | 6.17, 6.19 | 40 | video |
| 79 | 2021 / 13 | 6.26, 7.1 | 40 | video |
| 80 | 2021 / 14 | 7.10, 7.17 | 40 | video |
| 81 | 2021 / 15 | 7.24, 7.31 | 40 | video |
| 82 | 2021 / 16 | 8.7, 8.12 | 37 | video |
| 83 | 2021 / 17 | 8.14, 8.21 | 49 | video |
| 84 | 2021 / 18 | 8.28, 9.4 | 31 | video |
| 85 | 2021 / 19 | 9.11, 9.18 | 40 | video |
| 86 | 2021 / 20 | 9.18, 9.19 | 44 | video |
| 87 | 2021 / 21 | 9.25, 9.26 | 40 | video |
| 88 | 2021 / 22 | 10.9, 10.16 | 40 | video |
| 89 | 2021 / 23 | 10.17, 10.23 | 40 | video |
| 90 | 2021 / 24 | 10.30, 11.6 | 44 | video |
| 91 | 2021 / 25 | 11.6, 11.11, 11.20, 11.27 | 81 | video |
| 92 | 2021 / 26 | 12.2, 12.4 | 45 | video |
| 93 | 2021 / 27 | 12.11, 12.18 | 41 | video |
| 94 | 2021 / 28 | 12.25, 12.30 | 42 | video |
| 95 | 2022 / 1 | 1.8, 1.15 | 42 | video |
| 96 | 2022 / 2 | 1.22, 2.12 | 44 | video |
| 97 | 2022 / 3 | 2.19, 2.26 | 37 | video |
| 98 | 2022 / 4 | 3.3, 3.12 | 42 | video |
| 99 | 2022 / 5 | 3.19, 3.26 | 39 | video |
| 100 | 2022 / 6 | 4.9, 4.16 | 44 | video |
| 101 | 2022 / 7 | 4.23, 4.30 | 40 | video |
