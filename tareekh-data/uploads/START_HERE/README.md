# Start here

Ignore `backlog/` for now. These 12 files are copies of the ones the demo depends on.
Get each level working before moving on. Every level ends with a question your app must answer.

## Level 1: one case, three file types (build the pipeline)
Case C23, the Sai Balaji apartment building vs GHMC (municipality).

| File | What it is |
|---|---|
| `1_IMG_20260812_171906.jpg` | Meera's diary photo. **Two cases on one page** (C21 and C23); your code must split them |
| `2_CC_WP_14872-25_2026-08-12.jpg` | court's official stamped record: "counsel undertakes to file reply within three weeks" |
| `3_court_notes_2026-09-04.txt` | typed note: filed on 3 Sep, diary no. 4471, other side acknowledged receipt |

**Ask:** `rejoinder?` or "Did I file the reply in the Sai Balaji case?"
**Expect:** promised 12 Aug, filed 3 Sep (diary no. 4471, 1 day late), receipt acknowledged 4 Sep, with the source file named.

## Level 2: memory across time
Case C31. The same witness gave two different dates, 8 months apart.

| File | What it is |
|---|---|
| `1_IMG_20251119_144239.jpg` | Nov 2025 diary page: witness says he got the land in **March 2016** (page also has C12) |
| `2_IMG_20260715_154434.jpg` | Jul 2026 diary page: same witness says **January 2017** |

**Ask:** "What did PW1 say about possession in Gudivada v Kasoju?"
**Expect:** both statements with both dates, flagged as a contradiction.

## Level 3: pattern across cases (this is where `reflect` comes in)

| File | Case | What it is |
|---|---|---|
| `1_IMG_20260211_...` | C12 | same judge fines a 3rd postponement: Rs 3,000 |
| `2_IMG_20260422_...` | C19 | same judge fines a 3rd postponement: Rs 5,000, "Third time is not a request, it is a strategy" |
| `3_IMG_20260619_...` | C07 | Achary "sick", 1st postponement |
| `4_IMG_20260818_142011` | C07 | Sai's notebook (different handwriting): saw Achary arguing elsewhere that afternoon |
| `5_IMG_20260818_162936` | C07 | Achary "sick" again, 2nd postponement, "last opportunity" |

**Ask:** "What should I expect in Tadepalli today?"
**Expect:** "They've postponed twice; this judge fined the third postponement in C12 and C19, so push for costs." No single file says this.

## Level 4: a dropped task
Case C35.

| File | What it is |
|---|---|
| `1_IMG_20260908_111437.jpg` | judge rejected our request; Meera promised the client an appeal "well in time"; Sai assigned to compute the deadline |
| `2_sai_misc_2026-09-24.txt` | Sai: certified copy received 24 Sep, will compute the deadline (and never did) |

**Ask:** "Did we file the appeal for Sunitha?"
**Expect:** No. Order 8 Sep, copy received 24 Sep, task pending, deadline roughly 22 Oct.

---
Once all 4 levels work, point the same pipeline at `backlog/` (342 files). If Level 3 still works with 300 other files around it, the demo is ready.
The correct text of every file is in `../manifest.json` (`source_text`), so you can check your OCR output against it.
