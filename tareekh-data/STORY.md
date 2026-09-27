# Tareekh: the story

> *Tareekh pe tareekh.* Every Indian knows the line. A civil case in Hyderabad runs 3 to 7 years and 30+ hearings.
> Each hearing lasts about two minutes. What gets lost isn't the law. It's what happened last time.

## The person

**Advocate Meera Rao**, 14 years at the bar, civil litigator. Her chamber is opposite the City Civil Court at Purana Haveli,
ten minutes from the Telangana High Court. She has 40 active matters (the real number would be closer to 140, but 40 is
enough to show the pattern) across four City Civil Courts and two High Court halls. On a normal day 10 to 15 are listed.

Her memory system today is a printed court diary, a notes app on her phone, and her junior **Sai Kiran**, who keeps his own notebook.
After each hearing she scribbles two lines in the diary, types a note on the phone, or dictates to Sai.
Certified copies of orders arrive days later as paper and get photographed.

Nothing connects any of it. The diary for 18 August doesn't know what happened in a different case on 11 February, even when it's
the same judge and the same opposing counsel doing the same thing.

## What Tareekh does

Meera uploads what she already produces: **photos of diary pages, typed notes (.txt / .docx), scanned certified copies**.
Tareekh OCRs them, splits a diary page into one entry per matter, resolves "Tadepalli" to `O.S. No. 318 of 2022`, and
`retain`s each hearing into Hindsight. It never gives legal advice. It remembers, and it cites the note or order behind every claim.

Three things memory makes possible:

1. **Morning brief**: for each matter on today's cause list, what happened last time, what's due from us, what this bench does.
2. **In-court recall**: a two-word query answered in two seconds, with the source.
3. **Cross-case patterns** (Hindsight `reflect`): things no single file contains. *IV ACJ imposes costs on a third adjournment.*
   *Achary cites illness in every court he is losing time in.* *Pinnamaneni J checks undertakings on the next date.*

## The demo (about 5 minutes)

**Beat 0: the problem (30 s).** Show the uploads folder: 300+ files, three formats, two people's handwriting.
"This is 19 months of one lawyer's practice. Her memory lives in here."

**Beat 1: amnesia (30 s).** Memory off. Upload `demo_live/cause_list_2026-10-05.pdf`. You get a bare list of 13 matters.
Ask "rejoinder?". The answer: "I don't have information about that."

**Beat 2: the backlog goes in (45 s).** Upload `uploads/backlog/` (replayed fast, pre-OCR'd if Wi-Fi is bad).
The memory panel fills up: hearings, undertakings, costs orders. Then patterns appear as `reflect` runs:
judge habits and counsel tactics, each linked to the cases it came from.

**Beat 3: the morning brief (60 s).** Same cause list, memory on. Four cards to point at:

| Matter | What the brief says | Where it came from |
|---|---|---|
| C07 Tadepalli (IV ACJ, item 14) | Other side has taken **2** adjournments, both "illness"; last order said *last opportunity*. This judge imposed costs on third requests in **C12 (Rs. 3,000)** and **C19 (Rs. 5,000)**. Client asked about costs on 18 Aug. | 4 notes + 2 certified copies across 3 cases |
| C23 Sai Balaji WP (CH-12, item 17) | You **undertook** on 12 Aug to file a reply within 3 weeks. Filed 3 Sep (**diary no. 4471**, one day late). GHMC counsel acknowledged receipt 4 Sep. This judge checks undertakings. | certified copy + handwritten diary + typed note |
| C31 Gudivada v Kasoju (XI ACJ, item 26), arguments | **PW1 contradiction**: chief (19 Nov 2025) "March 2016, sale-deed day"; cross (15 Jul 2026) "after Sankranti, Jan 2017". Order sheets don't record either. | two handwritten diary pages, 8 months apart |
| Not listed today: C35 Sunitha | **Appeal not filed.** Adverse order 8 Sep; certified copy received 24 Sep; limitation task with Sai pending, overdue since 25 Sep; conservative last date 22 Oct. You told the client "well in time". She messaged at 08:12. | handwritten note, Sai's typed note, client WhatsApp |

**Beat 4: the courtroom (45 s).** A hackathon judge plays the court and reads from a card:
*"Counsel, didn't you undertake to file the rejoinder last time?"* Meera types `rejoinder?`.
Tareekh already knows she's in Court Hall 12 for C23 and answers with the date, diary number and acknowledgement. She beats the question.

**Beat 5: learning live (45 s).** Upload `demo_live/IMG_20261005_114702.jpg` (photo of the note after the Tadepalli hearing:
third illness memo, Rs. 4,000 costs). Ask "how many times has Achary cited illness?". The count goes up by one, and the J2 costs
pattern now has three instances. Then **hand a judge the keyboard** and have them teach a rule ("for Somayajulu J always carry a
one-page list of dates"). Ask about tomorrow's C11 brief. The rule shows up there, citing the judge's input.

**Close (15 s).** "It doesn't know the law. It knows your practice. And it's self-hostable, because client data never
leaves the chamber."

## Why Hindsight, specifically

- **retain**: every OCR'd entry becomes a memory with case, court, judge, counsel, date and source-file metadata.
- **recall**: in-court queries are recall over the current matter plus its judge and counsel.
- **reflect**: the patterns in Beat 3 and Beat 5 are exactly what reflect exists for. No single document contains
  "IV ACJ penalises third adjournments". It shows up only across C12, C19 and C07.
- **improves over time**: Beat 5 shows the same question giving a better answer after one more upload.

## The planted facts (what the data is built to prove)

| Case | Planted | Notes-only? |
|---|---|---|
| C07 | OC3 illness adjournments 19.06.2026 and 18.08.2026 ("last opportunity"); client asked about costs; Sai saw OC3 arguing in HC on 18.08 afternoon | the corridor sighting is note-only |
| C12 | OC3's third adjournment 11.02.2026 → Rs. 3,000 costs | no |
| C19 | OC5's third adjournment 22.04.2026 → Rs. 5,000 costs; *"Third time is not a request, it is a strategy"* | the quote is note-only |
| C23 | undertaking 12.08.2026; filed 03.09.2026, diary no. 4471; receipt acknowledged 04.09.2026 | diary no. and receipt are note-only |
| C31 | PW1 possession: March 2016 (chief, 19.11.2025) vs January 2017 (cross, 15.07.2026) | yes, both, handwritten |
| C35 | I.A. dismissed 08.09.2026; copy applied 10.09, received 24.09; C.M.A. not filed | promise to client is note-only |

About 60% of the other 380-odd hearings are routine ("not reached", "judge on leave", boycott, time sought), so the patterns
look like discoveries rather than scripted plot points.
