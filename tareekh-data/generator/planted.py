"""Hand-written hearing histories for the six cases the demo depends on.

{NEXT} in an order sheet is replaced with the next date as dd.mm.yyyy.
"fmt" says how the note reaches the app: "hw" = photo of handwritten diary page,
"txt" = typed phone note, "docx" = typed case note. "scan" = a certified copy of
the order sheet is also uploaded for that date.
"""


def H(date, listed_for, outcome, order_sheet, note, fmt="txt", author="Meera", adj=None, adj_reason=None,
      costs=None, actions=None, client=None, scan=False, progress=False):
    return {
        "date": date, "listed_for": listed_for, "outcome": outcome, "order_sheet": order_sheet,
        "note": note, "note_author": author, "fmt": fmt, "scan": scan,
        "adjournment_sought_by": adj, "adjournment_reason": adj_reason, "costs_imposed": costs,
        "action_items": actions or [], "client_interaction": client, "progress": progress,
    }


def A(task, owner, due, status, done_on=None, reference=None):
    return {"task": task, "owner": owner, "due": due, "status": status, "done_on": done_on, "reference": reference}


PLANTED = {}

# --------------------------------------------------------------------------------------------
# C07  Tadepalli: OC3 has sought two adjournments citing illness before J2. Third is expected.
# --------------------------------------------------------------------------------------------
PLANTED["C07"] = {"final_next": "2026-10-05", "hearings": [
    H("2025-03-12", "cross-examination of PW1", "PW1 partly cross-examined by counsel for defendants",
      "PW1 present. Partly cross-examined by counsel for defendants. For further cross-examination, call on {NEXT}.",
      "OS 318/22 Tadepalli. PW1 (Gopal garu himself) cross by Achary for about 40 min. Mostly on why balance "
      "consideration was not tendered before the agreement date. He held up ok. Achary kept asking about the bank "
      "statement - make sure Ex.A7 original is in the file next time.",
      fmt="hw", progress=True,
      actions=[A("keep original of Ex.A7 bank statement in court file", "Sai Kiran", "2025-04-16", "done", "2025-04-10")]),
    H("2025-04-16", "further cross-examination of PW1", "PW1 cross-examination concluded",
      "PW1 further cross-examined and discharged. Plaintiff to take steps for PW2. Call on {NEXT}.",
      "Tadepalli - PW1 cross over, finally. Achary tried the 'readiness and willingness' line again, Gopal garu "
      "answered well, said he had the loan sanction letter ready from Jan 2021. Need to summon the attesting "
      "witness Narsing Rao as PW2. Sai to prepare summons batta.",
      fmt="txt", progress=True,
      actions=[A("take out summons to attesting witness (PW2) with batta", "Sai Kiran", "2025-06-20", "done", "2025-04-28")]),
    H("2025-06-25", "evidence of PW2", "Not reached",
      "Not reached. Call on {NEXT}.",
      "Tadepalli - not reached. PW2 Narsing Rao came and waited till 4.30, poor man. Paid his auto fare. "
      "Told him we will call a day before next date.",
      fmt="hw", author="Sai Kiran"),
    H("2025-07-30", "evidence of PW2", "PW2 examined and cross-examined; plaintiff evidence closed",
      "PW2 examined in chief. Cross-examined by counsel for defendants. Discharged. Plaintiff's evidence closed. "
      "For defendants' evidence, call on {NEXT}.",
      "Tadepalli - PW2 done, judge recorded it the same day even though it went till 5.15. Achary's cross of PW2 "
      "was short, only asked if he read the agreement before signing. Plaintiff evidence closed. Now DW1 chief affidavit "
      "has to come from their side. Told Gopal garu it will still take some months.",
      fmt="docx", progress=True, scan=True,
      client="Told client that defendant evidence is next and it may take 3-4 months."),
    H("2025-09-10", "defendants' evidence", "Presiding officer on leave",
      "Presiding Officer on leave. Adjourned to {NEXT}.",
      "Tadepalli - judge on leave. Nothing.", fmt="txt", author="Sai Kiran"),
    H("2025-11-12", "defendants' evidence", "DW1 chief-examination affidavit filed; posted for cross",
      "Chief-examination affidavit of DW1 (1st defendant) filed. Exs. B1 to B4 marked. For cross-examination of DW1, call on {NEXT}.",
      "Tadepalli - DW1 affidavit (Anwar Hussain) filed and B1-B4 marked. B3 is a so-called 'cancellation notice' "
      "dated 2021 which we never received - need to check the postal cover in our file. Prepare cross. "
      "Key point: he admits receipt of 18 lakh in para 6 of his own affidavit.",
      fmt="hw", progress=True,
      actions=[A("check whether cancellation notice (Ex.B3) was ever received; look for postal cover", "Sai Kiran",
                 "2025-12-17", "done", "2025-12-05", "no postal cover in our file; client confirms never received")]),
    H("2025-12-17", "cross-examination of DW1", "Time sought by counsel for plaintiff",
      "Counsel for plaintiff seeks time as she is part-heard in the High Court. Granted. Call on {NEXT}.",
      "Tadepalli - I could not reach, stuck in HC part-heard (Bedi WP). Sai sought time on our behalf. "
      "That is one adjournment on OUR side before this judge, remember he counts.",
      fmt="txt", adj="Meera", adj_reason="counsel part-heard in High Court"),
    H("2026-02-04", "cross-examination of DW1", "Not reached (court busy with part-heard trial)",
      "Part-heard trial in O.S. 1043/2021 in progress. This matter not reached. Call on {NEXT}.",
      "Tadepalli - not reached, judge spent the whole day on the Lakshmi Ganapathi arguments (our own matter, "
      "funny). Nothing new.", fmt="hw"),
    H("2026-03-18", "cross-examination of DW1", "DW1 partly cross-examined by counsel for plaintiff",
      "DW1 present. Partly cross-examined by counsel for plaintiff. For further cross-examination, call on {NEXT}.",
      "Tadepalli - cross of DW1 started. Got him to admit he received 18 lakh in 3 instalments and that he never "
      "returned it. He said the cancellation notice was sent by 'ordinary post' - no proof. Still to cover: the "
      "encumbrance he created in 2023 (mortgage to Andhra Bank). Continue next date.",
      fmt="docx", progress=True, scan=True,
      actions=[A("get certified copy of 2023 mortgage deed from SRO Nagole", "Sai Kiran", "2026-06-15", "done", "2026-04-09", "CC no. 2291/2026")]),
    H("2026-04-29", "further cross-examination of DW1", "Not reached",
      "Not reached. Call on {NEXT}.", "Tadepalli - not reached. Board had 60+ items.", fmt="txt", author="Sai Kiran"),
    H("2026-06-19", "further cross-examination of DW1", "Adjournment sought by defendants' counsel citing illness; granted",
      "Counsel for defendants absent. Junior counsel represents that Sri Ch. Venugopal Achary is unwell and files memo seeking "
      "time. Granted. Call on {NEXT}.",
      "Tadepalli - Achary's junior came with a memo, 'counsel unwell, viral fever'. Judge granted without fuss, "
      "first one from their side. DW1 was not even present, so they were not going to go ahead anyway. "
      "Gopal garu upset, said he has been coming for 4 years.",
      fmt="hw", adj="opposing side", adj_reason="counsel Sri Ch. Venugopal Achary unwell (viral fever), memo filed by junior",
      client="Calmed client down, explained first adjournment is usually granted."),
    H("2026-07-22", "further cross-examination of DW1", "DW1 cross-examination continued, not concluded",
      "DW1 further cross-examined in part by counsel for plaintiff. For further cross-examination, call on {NEXT}.",
      "Tadepalli - good day. Confronted DW1 with the 2023 mortgage CC. He admitted mortgaging the plot AFTER the suit "
      "was filed and during the pendency. That goes to his conduct and also lis pendens. Need one more short session, "
      "maybe 30 min, on the valuation point. Then their DW2.",
      fmt="txt", progress=True),
    H("2026-08-18", "further cross-examination of DW1", "Second adjournment sought by defendants' counsel citing illness; last opportunity",
      "Counsel for defendants absent. Memo filed stating counsel is indisposed. Adjournment granted as a last opportunity. "
      "Call on {NEXT}.",
      "Tadepalli - AGAIN Achary unwell, memo filed at 10.40 by his junior. 2nd time on their side in this case. "
      "Judge wrote 'last opportunity' and said orally 'next time I will not be so kind, counsel'. "
      "Gopal garu asked me in the corridor whether we can ask for costs - he has taken leave 6 times. Told him "
      "yes, if they seek time again we will press for costs and the judge has done it before.",
      fmt="hw", adj="opposing side", adj_reason="counsel Sri Ch. Venugopal Achary indisposed, memo filed by junior",
      client="Client asked whether costs can be claimed for repeated adjournments. Told him we will press for costs if a third adjournment is sought.",
      actions=[A("if defendants seek time again, press for costs; keep C12 and C19 cost orders handy", "Meera", "2026-10-05", "pending")]),
    H("2026-09-16", "further cross-examination of DW1", "Not reached",
      "Not reached. Call on {NEXT}.",
      "Tadepalli - not reached, long list. Achary's junior was present this time (!). Next date 5 Oct.",
      fmt="txt", author="Sai Kiran"),
]}

# --------------------------------------------------------------------------------------------
# C12  Lakshmi Ganapathi: OC3's third adjournment before J2 drew Rs. 3,000 costs.
# --------------------------------------------------------------------------------------------
PLANTED["C12"] = {"final_next": "2026-10-05", "hearings": [
    H("2025-03-19", "cross-examination of DW1", "DW1 partly cross-examined",
      "DW1 present. Partly cross-examined by counsel for plaintiff. Call on {NEXT}.",
      "Lakshmi Ganapathi (OS 1043/21) - DW1 is their accountant, not the proprietor. Admitted 17 of 23 invoices bear "
      "their shop stamp. Denied the other 6. Need the delivery challans for those 6 - ask Srinivas garu.",
      fmt="hw", progress=True,
      actions=[A("collect delivery challans for 6 disputed invoices from client", "client", "2025-04-23", "done", "2025-04-19")]),
    H("2025-04-23", "further cross-examination of DW1", "DW1 cross concluded; defendants' evidence closed",
      "DW1 further cross-examined and discharged. Defendants' evidence closed. For arguments, call on {NEXT}.",
      "Lakshmi Ganapathi - DW1 done. Confronted with the 6 challans, he said 'I cannot say'. Good enough. "
      "Their evidence closed. Now arguments. Prepare a table of invoice / challan / exhibit numbers for the judge.",
      fmt="docx", progress=True, scan=True,
      actions=[A("prepare invoice-challan-exhibit table for arguments", "Sai Kiran", "2025-07-16", "done", "2025-07-10")]),
    H("2025-07-16", "arguments", "Adjournment sought by defendants' counsel citing illness",
      "Counsel for defendant absent; memo filed stating counsel is unwell. Adjourned to {NEXT}.",
      "Lakshmi Ganapathi - Achary 'unwell', memo through junior. First time in this case. Srinivas garu's accountant "
      "had come all the way from Siddipet.", fmt="txt", adj="opposing side",
      adj_reason="counsel Sri Ch. Venugopal Achary unwell, memo filed"),
    H("2025-09-24", "arguments", "Not reached", "Not reached. Call on {NEXT}.",
      "Lakshmi Ganapathi - not reached.", fmt="hw", author="Sai Kiran"),
    H("2025-11-19", "arguments", "Adjournment sought by defendants' counsel (counsel held up in another court)",
      "Counsel for defendant represents that he is held up in the High Court. Adjourned to {NEXT}.",
      "Lakshmi Ganapathi - this time Achary 'held up in HC'. 2nd adjournment from their side before IV ACJ. "
      "Judge looked at his register and said 'second time, counsel, please note'. I argued our part for 20 min "
      "anyway so the invoice table is on record.",
      fmt="hw", adj="opposing side", adj_reason="counsel held up in the High Court", progress=False),
    H("2026-02-04", "arguments", "Plaintiff's arguments heard in part (part-heard)",
      "Arguments of counsel for plaintiff heard in part. Part-heard. Call on {NEXT}.",
      "Lakshmi Ganapathi - argued for almost the full day (this is why Tadepalli was not reached). Judge engaged a lot on "
      "the limitation of the 2019 invoices - I showed the acknowledgement letter Ex.A24 dated 12.08.2021 which extends "
      "limitation under S.18. He seemed satisfied. Our arguments nearly done.",
      fmt="docx", progress=True),
    H("2026-02-11", "arguments", "Third adjournment sought by defendants' counsel citing illness; granted with costs of Rs. 3,000",
      "Counsel for defendant absent. Memo filed that counsel is unwell. This is the third adjournment sought on behalf of the "
      "defendant. Adjournment granted subject to payment of costs of Rs. 3,000/- to the plaintiff before the next date. "
      "Call on {NEXT}.",
      "Lakshmi Ganapathi - Achary illness memo AGAIN, third time for their side. IV ACJ granted it but imposed "
      "Rs 3000 costs payable to our client before next date. Judge said 'the court's register shows this is the third "
      "request'. So he really does count. Remember this for Tadepalli.",
      fmt="hw", adj="opposing side", adj_reason="counsel Sri Ch. Venugopal Achary unwell, memo filed",
      costs={"amount": 3000, "on": "opposing side"}, scan=True,
      actions=[A("confirm receipt of Rs. 3,000 costs from defendant", "Sai Kiran", "2026-03-25", "done", "2026-03-25", "paid in court by DD")]),
    H("2026-03-25", "arguments", "Costs paid; defendants' arguments heard in part",
      "Costs paid by DD. Arguments of counsel for defendant heard in part. Call on {NEXT}.",
      "Lakshmi Ganapathi - costs of 3000 paid by DD in court. Achary argued for 45 min, mostly that the 6 invoices are "
      "fabricated. Nothing new. He asked to continue next date.",
      fmt="txt", progress=True),
    H("2026-07-08", "arguments", "Not reached", "Not reached. Call on {NEXT}.",
      "Lakshmi Ganapathi - not reached.", fmt="txt", author="Sai Kiran"),
    H("2026-08-26", "arguments", "Defendant's arguments continued; reply by plaintiff to follow",
      "Arguments of counsel for defendant heard. For reply arguments of plaintiff, call on {NEXT}.",
      "Lakshmi Ganapathi - Achary finished. Our reply next date - short, 15 min, just the S.18 acknowledgement and "
      "the 6 challans. After that, judgment. Told Srinivas garu judgment may come by Diwali.",
      fmt="hw", progress=True, client="Told client judgment is likely by Diwali if reply arguments finish on next date."),
]}

# --------------------------------------------------------------------------------------------
# C19  Kamala Devi wall: OC5's third adjournment before J2 drew Rs. 5,000 costs and the "strategy" line.
# --------------------------------------------------------------------------------------------
PLANTED["C19"] = {"final_next": "2026-10-05", "hearings": [
    H("2025-03-26", "framing of issues", "Issues framed",
      "Issues framed. For plaintiff's evidence, call on {NEXT}.",
      "Kamala Devi wall (OS 227/24) - issues framed, 4 issues. Main one: whether the wall encroaches 3 ft into plaintiff's "
      "plot. We should push for an advocate commissioner with a surveyor - our survey sketch from 2019 is strong.",
      fmt="txt", progress=True,
      actions=[A("draft I.A. for appointment of advocate commissioner with surveyor", "Sai Kiran", "2025-07-02", "done", "2025-06-20")]),
    H("2025-07-02", "plaintiff's evidence", "I.A. for advocate commissioner filed; plaintiff sought time for evidence",
      "I.A. No. 1320 of 2025 filed by defendant for appointment of advocate commissioner. Notice. Counsel for plaintiff seeks "
      "time to file chief-examination affidavit of PW1. Granted. Call on {NEXT}.",
      "Kamala Devi - filed our commissioner IA. Jadhav sought time for PW1 affidavit - 'client out of station'. 1st "
      "time from their side. Harsha (son) drove Kamala amma here, she sat in the corridor 3 hours. Must tell them "
      "she need not come unless I call.",
      fmt="hw", adj="opposing side", adj_reason="plaintiff out of station, chief affidavit not ready",
      client="Told Harsha his mother need not attend unless specifically told."),
    H("2025-08-20", "plaintiff's evidence and I.A. 1320/2025", "Commissioner appointed; plaintiff's evidence deferred",
      "I.A. No. 1320 of 2025 allowed. Sri K. Anand Kumar, Advocate, appointed as Advocate Commissioner to measure the "
      "boundary with the help of a licensed surveyor and file report. Plaintiff's evidence after report. Call on {NEXT}.",
      "Kamala Devi - commissioner IA allowed!! Anand Kumar appointed with surveyor. Jadhav objected loudly but judge "
      "said 'measurement will help both sides'. Coordinate with Anand Kumar for site visit date.",
      fmt="docx", progress=True, scan=True,
      actions=[A("coordinate advocate commissioner site visit and deposit his fee", "Sai Kiran", "2025-10-29", "done", "2025-09-15", "fee Rs. 15,000 deposited")]),
    H("2025-10-29", "report of advocate commissioner", "Commissioner's report filed",
      "Report of Advocate Commissioner filed. Copies to both sides. Objections, if any, in two weeks. For plaintiff's evidence, call on {NEXT}.",
      "Kamala Devi - commissioner report filed. Wall is within our boundary except a 4 inch deviation at the rear corner. "
      "That is huge for us - plaintiff claimed 3 FEET. Jadhav will file objections.",
      fmt="hw", progress=True),
    H("2025-12-10", "plaintiff's evidence", "Plaintiff sought time again for PW1 affidavit",
      "Counsel for plaintiff seeks time to file chief-examination affidavit of PW1 and objections to the report. Granted. Call on {NEXT}.",
      "Kamala Devi - Jadhav again sought time, 'objections to commissioner report under preparation'. This is their 2nd "
      "adjournment before IV ACJ. Judge made a note. I said nothing, no need.",
      fmt="txt", adj="opposing side", adj_reason="objections to commissioner's report under preparation"),
    H("2026-02-18", "plaintiff's evidence", "Not reached", "Not reached. Call on {NEXT}.",
      "Kamala Devi - not reached.", fmt="hw", author="Sai Kiran"),
    H("2026-04-22", "plaintiff's evidence", "Third adjournment sought by plaintiff's counsel; granted with costs of Rs. 5,000",
      "Counsel for plaintiff again seeks time to file chief-examination affidavit of PW1. This is the third request on behalf of "
      "the plaintiff. Granted subject to costs of Rs. 5,000/- payable to the defendant. Call on {NEXT}.",
      "Kamala Devi wall - Jadhav asked for time a 3rd time, said PW1 is travelling. IV ACJ imposed Rs 5000 costs, "
      "payable to Kamala amma. And he said orally, looking straight at Jadhav: \"Third time is not a request, it is a "
      "strategy.\" Not in the order, only oral. Whole court went quiet. Harsha was thrilled.",
      fmt="hw", adj="opposing side", adj_reason="PW1 travelling, chief affidavit not filed",
      costs={"amount": 5000, "on": "opposing side"}, scan=True,
      client="Told Harsha the Rs. 5,000 costs will come to his mother; next time they must file PW1 affidavit."),
    H("2026-06-24", "plaintiff's evidence", "PW1 chief-examination affidavit filed; costs paid",
      "Costs paid. Chief-examination affidavit of PW1 filed. Exs. A1 to A5 marked. For cross-examination of PW1, call on {NEXT}.",
      "Kamala Devi - costs 5000 paid by cash receipt, given to Harsha. PW1 affidavit filed finally. His own sale deed "
      "(A1) gives the plot as 30 ft x 45 ft - commissioner measured 30 ft x 44 ft 8 in. So the 3 ft claim is nonsense. "
      "Prepare cross around A1 dimensions + commissioner report.",
      fmt="docx", progress=True,
      actions=[A("prepare cross-examination of PW1 around Ex.A1 dimensions and commissioner report", "Meera", "2026-10-05", "pending")]),
    H("2026-08-05", "cross-examination of PW1", "Presiding officer on leave", "Presiding Officer on leave. Adjourned to {NEXT}.",
      "Kamala Devi - judge on leave.", fmt="txt", author="Sai Kiran"),
]}

# --------------------------------------------------------------------------------------------
# C23  Sai Balaji GHMC WP (High Court, J3): Meera undertook to file a reply (rejoinder) affidavit.
# --------------------------------------------------------------------------------------------
PLANTED["C23"] = {"final_next": "2026-10-05", "hearings": [
    H("2025-06-12", "admission", "Admitted; interim suspension of demolition notice for 8 weeks",
      "Heard learned counsel for the petitioner. Admit. Notice. Pending further orders, there shall be interim suspension of "
      "the impugned notice dated 22.04.2025 for a period of eight weeks. List on {NEXT}.",
      "Sai Balaji GHMC WP - admitted, interim suspension for 8 weeks (Pinnamaneni J never gives open-ended interim). "
      "Ravi Shankar garu (secretary) very relieved. Must keep extending the interim on every date.",
      fmt="docx", progress=True, scan=True,
      client="Sent written update to association secretary Ravi Shankar Mallela: notice suspended for 8 weeks."),
    H("2025-08-07", "counter-affidavit by respondents / extension of interim order", "Interim order extended; GHMC sought time for counter",
      "Learned Standing Counsel for GHMC seeks time to file counter-affidavit. Interim order extended for eight weeks. List on {NEXT}.",
      "Sai Balaji WP - GHMC SC (Hemalatha Ravuri) sought time for counter. Interim extended 8 weeks. Fine.",
      fmt="hw"),
    H("2025-10-08", "counter-affidavit by respondents / extension of interim order", "Interim extended; counter still awaited",
      "Counter-affidavit not filed. Interim order extended till the next date. List on {NEXT}.",
      "Sai Balaji WP - still no counter. Interim extended. Pinnamaneni J told SC 'this is the last time without counter'.",
      fmt="txt", author="Sai Kiran"),
    H("2026-02-26", "counter-affidavit by respondents / extension of interim order", "Counter filed in part; synopsis ordered",
      "Counter-affidavit of respondent No. 2 filed. Paper book exceeds 200 pages; both sides to file synopsis. "
      "Interim order extended till the next date. List on {NEXT}.",
      "Sai Balaji WP - GHMC counter filed, huge, with building plans - 230+ pages with ours. Judge wants synopsis "
      "from both sides (her standard >200 pages rule). Draft 3-page synopsis.",
      fmt="hw", progress=True,
      actions=[A("draft 3-page synopsis for W.P. 14872/2025", "Meera", "2026-06-30", "done", "2026-06-22")]),
    H("2026-07-01", "hearing", "Synopsis filed by petitioner; respondent 3 counter awaited",
      "Synopsis filed on behalf of the petitioner. Counter-affidavit of respondent No. 3 awaited. Interim order extended till the next date. List on {NEXT}.",
      "Sai Balaji WP - filed our synopsis. R3 (Town Planning) counter still not filed. Interim extended.",
      fmt="txt"),
    H("2026-08-12", "hearing", "Counter of R3 filed; petitioner's counsel undertakes to file reply within three weeks",
      "Counter-affidavit of respondent No. 3 filed and served in court. Learned counsel for the petitioner undertakes to file "
      "reply affidavit within three weeks. Interim order extended till the next date. List on {NEXT}.",
      "Sai Balaji GHMC WP (WP 14872/25). R3 counter served in court today. I undertook to file our reply/rejoinder "
      "within 3 WEEKS - judge recorded it word for word in the order (her habit). So due by 2 Sept. "
      "R3 says the setback violation is 1.2 m on the east side - our approved plan says 1.5 m setback was left. "
      "Need the approved plan copy from Ravi Shankar garu + the 2014 occupancy certificate.",
      fmt="hw", progress=True, scan=True,
      actions=[A("file reply (rejoinder) affidavit to counter of R3 - undertaking to court", "Meera", "2026-09-02", "done",
                 "2026-09-03", "diary no. 4471"),
               A("collect approved plan and 2014 occupancy certificate from association secretary", "client", "2026-08-20", "done", "2026-08-19")]),
    H("2026-09-04", "hearing", "Reply affidavit on record; receipt acknowledged by GHMC Standing Counsel",
      "Reply affidavit filed on behalf of the petitioner is on record. Interim order extended till the next date. List for hearing on {NEXT}.",
      "Sai Balaji WP - our reply was filed yesterday 3 Sept (diary no. 4471) - ONE DAY late on the undertaking, "
      "judge did not comment. Hemalatha Ravuri (GHMC SC) acknowledged receipt of the reply copy in court today, "
      "4 Sept, signed on our copy. Listed for final hearing 5 Oct. Keep the approved plan flagged at page 64.",
      fmt="txt", progress=True,
      client="Updated association secretary: reply filed, final hearing on 5 October, interim continues."),
]}

# --------------------------------------------------------------------------------------------
# C31  Gudivada v Kasoju (J5): PW1's possession date contradicts. Only Meera's handwritten notes have both.
# --------------------------------------------------------------------------------------------
PLANTED["C31"] = {"final_next": "2026-10-05", "hearings": [
    H("2025-03-20", "plaintiff's evidence", "Not reached", "Not reached. Call on {NEXT}.",
      "Gudivada v Kasoju - not reached (item 44).", fmt="txt", author="Sai Kiran"),
    H("2025-07-17", "plaintiff's evidence", "Plaintiff sought time; PW1 affidavit not ready",
      "Counsel for plaintiff seeks time to file chief-examination affidavit. Granted. Call on {NEXT}.",
      "Gudivada v Kasoju (OS 764/20) - Jadhav sought time for PW1 affidavit. Kasoju garu says the plaintiff has been "
      "telling people in the colony that he 'got possession only after the old tenant left' - remember this.",
      fmt="hw", adj="opposing side", adj_reason="chief-examination affidavit not ready"),
    H("2025-11-19", "chief-examination of PW1", "PW1 examined in chief; Exs. A1 to A9 marked",
      "PW1 examined in chief. Exs. A1 to A9 marked. For cross-examination of PW1, call on {NEXT}.",
      "Gudivada v Kasoju - PW1 (Lakshmana Rao Gudivada) chief today. In his additional chief he said clearly: "
      "he was put in possession in MARCH 2016, on the day of the sale deed (A1, dt 03.03.2016), and has been in "
      "possession since. Wrote it down exactly. A6 = property tax receipts from 2018 only. No receipts for 2016-17!",
      fmt="hw", progress=True, scan=True),
    H("2026-02-12", "cross-examination of PW1", "Not reached", "Not reached. Call on {NEXT}.",
      "Gudivada v Kasoju - not reached.", fmt="txt", author="Sai Kiran"),
    H("2026-04-08", "cross-examination of PW1", "Cross-examination of PW1 commenced",
      "PW1 partly cross-examined by counsel for defendant. Call on {NEXT}.",
      "Gudivada v Kasoju - started cross of PW1, only 30 min after lunch (Quadri sir takes evidence only post lunch). "
      "Covered A1 and the tax receipts. Kept the possession question for next time, want him relaxed.",
      fmt="txt", progress=True),
    H("2026-07-15", "further cross-examination of PW1", "PW1 cross-examined and discharged",
      "PW1 further cross-examined by counsel for defendant and discharged. Plaintiff's evidence closed. "
      "For defendant's evidence, call on {NEXT}.",
      "Gudivada v Kasoju - BIG. In cross PW1 said possession was handed over 'after Sankranti, January 2017, when the "
      "old tenant Mallesh vacated'. In chief (19 Nov 2025) he said March 2016 on the sale deed day! "
      "10 months difference - and our case is that Kasoju was in possession through 2016. "
      "Order sheet only says 'PW1 cross-examined'. Get certified copy of deposition.",
      fmt="hw", progress=True,
      actions=[A("apply for certified copy of PW1 deposition (chief and cross)", "Sai Kiran", "2026-08-31", "done", "2026-07-20", "CA no. 3318/2026"),
               A("prepare arguments note on the possession contradiction", "Meera", "2026-10-05", "pending")]),
    H("2026-08-19", "defendant's evidence", "DW1 examined and cross-examined; evidence closed",
      "DW1 examined in chief. Cross-examined by counsel for plaintiff and discharged. Evidence of both sides closed. "
      "For arguments, call on {NEXT}.",
      "Gudivada v Kasoju - Kasoju garu (DW1) deposed, held up well under Jadhav's 1.5 hr cross. Evidence closed both "
      "sides. Arguments 5 Oct. Quadri sir likes exact exhibit numbers - make a list: A1 sale deed, A6 tax receipts, "
      "B2 electricity bills in Kasoju's name 2015-2017.",
      fmt="docx", progress=True,
      client="Told Kasoju garu arguments are on 5 October; he need not attend."),
]}

# --------------------------------------------------------------------------------------------
# C35  Sunitha injunction (J6): adverse order on I.A. 08.09.2026; appeal not filed yet.
# --------------------------------------------------------------------------------------------
PLANTED["C35"] = {"final_next": "2026-11-09", "hearings": [
    H("2025-03-10", "service of notice on defendants", "Defendants served; vakalat filed for D1",
      "Service on defendants complete. Vakalat filed for D1. D2 called absent. For counter in I.A. No. 402 of 2025 and "
      "written statement, call on {NEXT}.",
      "Sunitha injunction (OS 145/25) - Tummala madam checked service and vakalat before anything else, as usual. "
      "Siddiqui appeared for the builder (D1). D2 (landowner) absent.", fmt="txt", progress=True),
    H("2025-06-11", "counter in I.A. 402/2025 and written statement", "Counter and written statement filed by D1",
      "Counter in I.A. No. 402 of 2025 and written statement filed by D1. D2 set ex parte. For hearing on I.A., call on {NEXT}.",
      "Sunitha - builder filed counter + WS. Says 4th floor has GHMC permission dated 2024. Our point: permission is for "
      "G+3 only, the 4th floor is over the common staircase. Sunitha garu sent photos - construction still going on.",
      fmt="hw", progress=True),
    H("2025-08-13", "hearing on I.A. 402/2025", "I.A. heard in part", "I.A. heard in part. Call on {NEXT}.",
      "Sunitha - argued IA for 30 min. Madam asked for the sanctioned plan - builder's counsel said he will produce.",
      fmt="txt", progress=True),
    H("2025-10-15", "hearing on I.A. 402/2025", "Papers returned for defect; sanctioned plan not produced",
      "Sanctioned plan not produced by D1. Documents filed by plaintiff returned for want of proper index. Call on {NEXT}.",
      "Sunitha - our additional documents returned because index page numbers didn't match (Tummala madam is strict on "
      "this). My fault, Sai fix it. Builder still hasn't produced the plan.", fmt="hw"),
    H("2026-02-09", "hearing on I.A. 402/2025", "Arguments on I.A. concluded; orders reserved",
      "Arguments on I.A. No. 402 of 2025 heard. Orders reserved. Call on {NEXT}.",
      "Sunitha - IA arguments done, orders reserved. Builder produced a plan only today, and it shows 'G+3 + headroom'. "
      "Our point is strong but she reserves everything, may take months.",
      fmt="docx", progress=True),
    H("2026-09-08", "orders on I.A. 402/2025", "I.A. for temporary injunction dismissed",
      "Orders pronounced in I.A. No. 402 of 2025. For the reasons recorded separately, the I.A. is dismissed. No costs. "
      "For plaintiff's evidence, call on {NEXT}.",
      "Sunitha injunction - IA 402 DISMISSED. Madam held the 'headroom' is not a floor and no prima facie case of "
      "violation. Bad. Told Sunitha garu we will file the appeal (CMA) well in time, not to worry. "
      "Sai - apply for certified copy tomorrow itself and compute limitation for CMA before Chief Judge. "
      "Construction will go faster now.",
      fmt="hw", progress=True, scan=True,
      client="Told client: 'we will file the appeal (C.M.A.) well in time, don't worry'.",
      actions=[A("apply for certified copy of order in I.A. 402/2025", "Sai Kiran", "2026-09-10", "done", "2026-09-10", "CA no. 3907/2026"),
               A("compute limitation and draft C.M.A. against order dt. 08.09.2026", "Sai Kiran", "2026-09-25", "pending")]),
]}

# Extra notes that are not tied to a single hearing date (uploaded as their own files).
EXTRA_NOTES = [
    {"date": "2026-08-18", "author": "Sai Kiran", "fmt": "hw", "case_ids": ["C07"],
     "text": "18/8 - 2.35 pm, HC CH-12 corridor. Saw Achary sir arguing a matter in Court Hall 12 (not ours). Looked "
             "perfectly fine. This is the same day his junior filed 'counsel indisposed' memo in Tadepalli at 10.40 am. "
             "Told Meera madam."},
    {"date": "2026-09-24", "author": "Sai Kiran", "fmt": "txt", "case_ids": ["C35"],
     "text": "Sunitha OS 145/25 - certified copy of order in IA 402/2025 received today 24.09.2026 (applied 10.09.2026, "
             "CA no. 3907/2026). Will do limitation calculation and CMA draft. -Sai"},
]
