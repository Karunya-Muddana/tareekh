"""World bible for Tareekh synthetic data.

Every person, firm and case here is fictional. Court names follow the real
structure of the Hyderabad City Civil Court and the Telangana High Court so the
documents read true, but no real judge, advocate or litigant is depicted.
"""
import datetime as dt

DEMO_DAY = dt.date(2026, 10, 5)          # Monday
HISTORY_START = dt.date(2025, 3, 1)
HISTORY_END = dt.date(2026, 10, 2)

ADVOCATE = {
    "name": "Meera Rao",
    "enrolment_no": "TS/1187/2012",
    "chamber_address": "Flat 204, Lakshmi Towers, Opp. City Civil Court, Purana Haveli, Hyderabad 500002",
    "practice": "Civil litigation: property, contracts, injunctions, writs against municipal action",
    "junior": {"name": "Sai Kiran Bollam", "enrolment_no": "TS/3021/2023"},
    "clerk": {"name": "Yadagiri", "role": "chamber clerk, handles filings and certified copies"},
}

JUDGES = [
    {
        "id": "J1", "name": "Hon'ble Sri Justice T. Venkatadri Somayajulu",
        "short": "Somayajulu J", "court": "High Court for the State of Telangana",
        "court_hall": "Court Hall 7", "level": "High Court",
        "temperament": "Precise and quick. Reads the file before the matter is called and gets irritated when counsel is not ready with dates.",
        "habits": [
            "asks about limitation and delay before hearing anything on merits",
            "wants a one-page list of dates handed up at the start",
            "dictates short orders in open court immediately after hearing",
            "does not accept pass-over requests after the first round of calling",
        ],
    },
    {
        "id": "J2", "name": "Sri Kondapalli Vishweshwar, IV Additional Chief Judge",
        "short": "IV ACJ (Vishweshwar)", "court": "City Civil Court, Hyderabad",
        "court_hall": "Court of the IV Additional Chief Judge", "level": "City Civil Court",
        "temperament": "Patient for the first two dates, then firm. Keeps his own register of who sought time and reads from it.",
        "habits": [
            "grants a first and second adjournment freely but imposes costs (Rs. 2,000 to 5,000) on any third adjournment request by the same side",
            "starts at 10:30 sharp and calls the list twice before lunch",
            "prefers evidence to be recorded the same day the witness is present, even if it runs late",
        ],
    },
    {
        "id": "J3", "name": "Hon'ble Smt. Justice Aruna Lakshmi Pinnamaneni",
        "short": "Pinnamaneni J", "court": "High Court for the State of Telangana",
        "court_hall": "Court Hall 12", "level": "High Court",
        "temperament": "Thorough and courteous. Records undertakings given by counsel word for word and checks them on the next date.",
        "habits": [
            "insists on a synopsis for any matter where the paper book exceeds 200 pages",
            "records counsel's undertakings verbatim in the order and asks about compliance on the next date",
            "prefers short written submissions after oral arguments",
            "continues interim orders only for a fixed period, never 'until further orders'",
        ],
    },
    {
        "id": "J4", "name": "Smt. Rajeshwari Doddapaneni, VII Additional Chief Judge",
        "short": "VII ACJ (Doddapaneni)", "court": "City Civil Court, Hyderabad",
        "court_hall": "Court of the VII Additional Chief Judge", "level": "City Civil Court",
        "temperament": "Settlement-minded. Asks at almost every stage whether parties have explored mediation.",
        "habits": [
            "asks whether the parties have tried mediation before framing issues or starting evidence",
            "refers family property disputes to the Lok Adalat / mediation centre at least once",
            "strict about amendment applications filed after trial has begun",
        ],
    },
    {
        "id": "J5", "name": "Sri Syed Irfanuddin Quadri, XI Additional Chief Judge",
        "short": "XI ACJ (Quadri)", "court": "City Civil Court, Hyderabad",
        "court_hall": "Court of the XI Additional Chief Judge", "level": "City Civil Court",
        "temperament": "Relaxed, heavy board. Many matters are simply not reached, but arguments once started are heard fully.",
        "habits": [
            "takes up evidence and arguments only after lunch; the morning is for calls and I.A.s",
            "matters beyond item 30 are usually not reached",
            "asks counsel to point to the exact exhibit number during arguments",
        ],
    },
    {
        "id": "J6", "name": "Kum. Pallavi Tummala, III Junior Civil Judge",
        "short": "III JCJ (Tummala)", "court": "City Civil Court, Hyderabad",
        "court_hall": "Court of the III Junior Civil Judge", "level": "City Civil Court",
        "temperament": "Recently posted, meticulous about procedure. Reserves orders on I.A.s and writes detailed reasons.",
        "habits": [
            "checks service of notice and vakalat filing before anything else",
            "reserves orders on interim applications instead of deciding the same day",
            "returns papers for minor defects (page numbering, index) rather than condoning them",
        ],
    },
]

OPPOSING_COUNSEL = [
    {"id": "OC1", "name": "Sri Bhaskar Rao Gundlapalli", "chamber": "Gundlapalli & Associates, Koti",
     "style": "Procedural fighter. Rarely argues merits if a technical point is available.",
     "tactics": ["files a fresh I.A. a day or two before an important date", "objects to marking of documents on stamp duty grounds"]},
    {"id": "OC2", "name": "Smt. Hemalatha Ravuri", "chamber": "Ravuri Law Chambers, Himayatnagar",
     "style": "Well prepared, formal. Takes maintainability and jurisdiction points early.",
     "tactics": ["raises maintainability as a preliminary issue", "files detailed written arguments"]},
    {"id": "OC3", "name": "Sri Ch. Venugopal Achary", "chamber": "Achary Chambers, Nampally",
     "style": "Senior in years, carries a very heavy board across courts. Charming in court, hard to pin to a date.",
     "tactics": ["seeks adjournments citing personal illness, usually through a junior or a letter",
                 "asks for the matter to be passed over and then does not return",
                 "files adjournment memos on the morning of the hearing"]},
    {"id": "OC4", "name": "Sri Farooq Ahmed Siddiqui", "chamber": "Siddiqui & Siddiqui, Abids",
     "style": "Reasonable and commercial. Usually for builders and traders.",
     "tactics": ["floats settlement figures in the corridor", "proposes Lok Adalat when his client is weak on evidence"]},
    {"id": "OC5", "name": "Sri Pradeep Kumar Jadhav", "chamber": "Jadhav Law Office, Secunderabad",
     "style": "Aggressive cross-examiner, uneven preparation.",
     "tactics": ["very long cross-examinations on side issues", "seeks time when his own witness is not ready"]},
    {"id": "OC6", "name": "Smt. Swathi Kolluru", "chamber": "Kolluru & Co., Ameerpet",
     "style": "Sharp, young, relies on paperwork gaps.",
     "tactics": ["claims copies of filings were not served on her", "serves her own documents in court on the day of hearing"]},
    {"id": "OC7", "name": "Sri R. Dattatreya Sarma (Senior Counsel)", "chamber": "Sarma Chambers, Basheerbagh",
     "style": "Senior counsel, excellent on law, mostly appears through juniors.",
     "tactics": ["juniors seek pass-over saying senior is in another court", "appears in person only for final arguments"]},
    {"id": "OC8", "name": "Sri Imran Baig", "chamber": "Baig Legal, Tolichowki",
     "style": "Punctual and fair. Keeps to dates and concedes obvious points.",
     "tactics": ["agrees to timelines on consent", "files compilations in advance"]},
]

CLIENTS = [
    {"id": "CL1", "name": "Gopal Krishna Tadepalli", "type": "individual, retired bank officer", "note": "calls after every date, frustrated with delay, asks about costs"},
    {"id": "CL2", "name": "M/s Lakshmi Ganapathi Traders (partner: Srinivas Gupta Nalla)", "type": "partnership firm, hardware wholesale", "note": "only reachable after 7 pm, sends accountant to court"},
    {"id": "CL3", "name": "Smt. Kamala Devi Bommireddy", "type": "individual, widow, 68", "note": "comes to court with son Harsha; son handles calls"},
    {"id": "CL4", "name": "Sri Sai Balaji Residency Owners Welfare Association", "type": "housing society, 48 flats, Kukatpally", "note": "secretary Mr. Ravi Shankar Mallela coordinates, wants written updates for the committee"},
    {"id": "CL5", "name": "Smt. Sunitha Raghunath", "type": "individual, schoolteacher", "note": "anxious, WhatsApps often, neighbour's construction is going up daily"},
    {"id": "CL6", "name": "Sri Mohd. Khaja Moinuddin", "type": "individual, shop owner, Charminar", "note": "does not read English, prefers voice calls in Urdu/Hindi"},
    {"id": "CL7", "name": "Dr. Anuradha Velagapudi", "type": "individual, paediatrician", "note": "busy, replies only by email"},
    {"id": "CL8", "name": "Sri Raghavendra Chary Kasoju", "type": "individual, goldsmith", "note": "comes to chamber in person every Saturday"},
    {"id": "CL9", "name": "M/s Deccan Polymers Pvt. Ltd.", "type": "company, plastics manufacturer, Cherlapally", "note": "legal head Ms. Nikitha Reddy Sama, wants monthly status report"},
    {"id": "CL10", "name": "Smt. Parvathamma Gollapudi and others", "type": "family, four siblings", "note": "siblings disagree among themselves; eldest brother Ramulu gives instructions"},
    {"id": "CL11", "name": "Sri Harpreet Singh Bedi", "type": "individual, transport business", "note": "travels a lot, junior brother attends court"},
    {"id": "CL12", "name": "Sri Narasimha Swamy Temple Committee, Uppal", "type": "temple trust", "note": "committee meets monthly, decisions are slow"},
    {"id": "CL13", "name": "Sri Venkat Rao Pasupuleti", "type": "individual, landlord", "note": "impatient, wants tenant out quickly"},
    {"id": "CL14", "name": "Smt. Farzana Begum", "type": "individual, homemaker", "note": "only reachable through son Adil"},
    {"id": "CL15", "name": "M/s Sri Vaishnavi Constructions", "type": "builder, partnership", "note": "MD Mr. Kiran Kumar Yarlagadda, fond of settlements"},
    {"id": "CL16", "name": "Sri Joseph Anthony Pinto", "type": "individual, retired railway employee", "note": "polite, forgets documents, needs reminders"},
    {"id": "CL17", "name": "Smt. Lalitha Kumari Vadlamani", "type": "individual, landowner", "note": "calls daily, anxious"},
    {"id": "CL18", "name": "Sri Balaraju Mudiraj", "type": "individual, farmer turned plot owner, Ghatkesar", "note": "comes with a village elder, prefers Telugu"},
    {"id": "CL19", "name": "M/s Hyderabad Fresh Dairy LLP", "type": "LLP, dairy distribution", "note": "accounts team sends papers late"},
    {"id": "CL20", "name": "Sri Prakash Chand Agarwal", "type": "individual, cloth merchant, Begum Bazar", "note": "careful with fees, asks for itemised bills"},
    {"id": "CL21", "name": "Smt. Revathi Nandyala", "type": "individual, software engineer (in US)", "note": "reachable on WhatsApp late night IST; father attends court"},
    {"id": "CL22", "name": "Sri Abdul Rasheed Khan", "type": "individual, tenant (commercial)", "note": "calm, pays on time"},
    {"id": "CL23", "name": "Greenfield Villas Residents Association, Gandipet", "type": "residents association", "note": "president changes every year"},
    {"id": "CL24", "name": "Sri Suresh Babu Kandregula", "type": "individual, contractor", "note": "overconfident, underplays weak points"},
    {"id": "CL25", "name": "Smt. Vijaya Durga Chilukuri", "type": "individual, retired teacher", "note": "writes long letters, very organised with papers"},
]

# Final stage labels used for the last listing of each case.
# (id, case_number, judge, title, meera_represents, client, oc, nature, filed_on, kind, final_listed_for, summary)
CASES = [
    ("C01", "O.S. No. 1180 of 2021", "J4", "Parvathamma Gollapudi & 3 others vs Ramulu Gollapudi & 2 others", "plaintiff", "CL10", "OC2",
     "partition suit", "2021-11-08", "suit", "cross-examination of DW1",
     "Partition of ancestral house at Malakpet and 1.2 acres at Ibrahimpatnam among five siblings."),
    ("C02", "O.S. No. 902 of 2024", "J6", "Mohd. Khaja Moinuddin vs Syed Zaheer Hashmi", "plaintiff", "CL6", "OC6",
     "suit for permanent injunction over shop frontage", "2024-07-15", "suit", "framing of issues",
     "Neighbouring shop owner encroaching on common passage at Laad Bazaar."),
    ("C03", "O.S. No. 655 of 2023", "J2", "Raghavendra Chary Kasoju vs Nagaraju Pendyala", "plaintiff", "CL8", "OC1",
     "suit for recovery of money on promissory note", "2023-05-22", "suit", "arguments",
     "Recovery of Rs. 8,40,000 with interest on a pronote dated 11.02.2020."),
    ("C04", "C.R.P. No. 2211 of 2025", "J1", "Deccan Polymers Pvt. Ltd. vs Shiva Shakti Packaging & another", "petitioner", "CL9", "OC8",
     "civil revision petition against order rejecting amendment", "2025-04-21", "crp", "hearing",
     "Revision against trial court's refusal to allow amendment of plaint in a supply dispute."),
    ("C05", "O.S. No. 377 of 2022", "J5", "Anuradha Velagapudi vs Sri Vaishnavi Constructions", "plaintiff", "CL7", "OC4",
     "suit for specific performance and delivery of flat", "2022-03-30", "suit", "chief-examination of DW1",
     "Builder has not delivered a 3BHK flat at Kondapur despite 92% payment."),
    ("C06", "O.S. No. 1415 of 2024", "J4", "Venkat Rao Pasupuleti vs Srikanth Oruganti", "plaintiff", "CL13", "OC6",
     "suit for eviction of tenant and arrears of rent", "2024-10-03", "suit", "cross-examination of PW1",
     "Eviction of tenant from first floor at Chikkadpally, arrears of Rs. 3,12,000."),
    ("C07", "O.S. No. 318 of 2022", "J2", "Gopal Krishna Tadepalli vs Mohd. Anwar Hussain & another", "plaintiff", "CL1", "OC3",
     "suit for specific performance of agreement of sale", "2022-02-14", "suit", "cross-examination of DW1",
     "Agreement of sale for a 200 sq. yd plot at Nagole; defendants refuse to execute sale deed after receiving Rs. 18 lakh advance."),
    ("C08", "O.S. No. 1127 of 2023", "J6", "Joseph Anthony Pinto vs Hyderabad Metro Housing Society & another", "plaintiff", "CL16", "OC8",
     "suit for declaration and refund of membership amount", "2023-09-18", "suit", "chief-examination of PW1",
     "Society expelled plaintiff and refuses refund of Rs. 4,50,000."),
    ("C09", "O.S. No. 842 of 2021", "J5", "Prakash Chand Agarwal vs Hanuman Textiles & 2 others", "plaintiff", "CL20", "OC1",
     "suit for recovery of money for goods sold", "2021-08-09", "suit", "cross-examination of DW1",
     "Recovery of Rs. 11,26,500 for cloth supplied on credit, Begum Bazar."),
    ("C10", "W.P. No. 18342 of 2024", "J3", "Greenfield Villas Residents Association vs State of Telangana & 3 others", "petitioner", "CL23", "OC2",
     "writ petition against conversion of park land", "2024-09-02", "wp", "hearing",
     "Layout open space earmarked as park being allotted for a commercial complex."),
    ("C11", "W.P. No. 9921 of 2025", "J1", "Harpreet Singh Bedi vs Regional Transport Authority & another", "petitioner", "CL11", "OC2",
     "writ petition against cancellation of stage carriage permits", "2025-03-24", "wp", "hearing",
     "RTA cancelled four permits without hearing."),
    ("C12", "O.S. No. 1043 of 2021", "J2", "Lakshmi Ganapathi Traders vs Sri Venkateswara Agencies", "plaintiff", "CL2", "OC3",
     "suit for recovery of money on unpaid invoices", "2021-10-11", "suit", "arguments",
     "Recovery of Rs. 14,62,000 on 23 unpaid invoices for hardware supplied in 2019-20."),
    ("C13", "A.S. No. 58 of 2024", "J4", "Lalitha Kumari Vadlamani vs Bhoomaiah Kurma", "appellant", "CL17", "OC5",
     "first appeal against dismissal of injunction suit", "2024-02-12", "as", "hearing",
     "Appeal against dismissal of suit for injunction over agricultural land at Shamshabad."),
    ("C14", "C.M.A. No. 640 of 2025", "J1", "Hyderabad Fresh Dairy LLP vs Tirumala Cold Chain Pvt. Ltd.", "appellant", "CL19", "OC3",
     "civil miscellaneous appeal against refusal of attachment before judgment", "2025-05-26", "cma", "hearing",
     "Appeal against order refusing attachment before judgment in a Rs. 36 lakh recovery suit."),
    ("C15", "W.P. No. 3310 of 2025", "J3", "Narasimha Swamy Temple Committee, Uppal vs Commissioner of Endowments & another", "petitioner", "CL12", "OC7",
     "writ petition against appointment of executive officer", "2025-02-10", "wp", "hearing",
     "Endowments department appointed an executive officer overriding the hereditary committee."),
    ("C16", "O.S. No. 214 of 2023", "J5", "Revathi Nandyala vs Srinivasa Rao Nandyala", "plaintiff", "CL21", "OC4",
     "partition suit", "2023-03-06", "suit", "framing of issues",
     "Daughter seeks share in father's self-acquired-turned-ancestral property; father contesting through brother."),
    ("C17", "O.S. No. 1302 of 2024", "J6", "Abdul Rasheed Khan vs Mohd. Iqbal Ahmed", "defendant", "CL22", "OC5",
     "suit for eviction (Meera for tenant)", "2024-09-23", "suit", "chief-examination of PW1",
     "Landlord seeks eviction of commercial tenant claiming bona fide need."),
    ("C18", "O.S. No. 509 of 2022", "J2", "Suresh Babu Kandregula vs Nirmala Engineering Works", "plaintiff", "CL24", "OC8",
     "suit for recovery of contract dues", "2022-05-02", "suit", "cross-examination of PW1",
     "Civil contractor claims Rs. 22,80,000 for works at a factory shed."),
    ("C19", "O.S. No. 227 of 2024", "J2", "Syed Mustafa Ali vs Kamala Devi Bommireddy", "defendant", "CL3", "OC5",
     "suit for injunction over boundary wall", "2024-02-19", "suit", "cross-examination of PW1",
     "Neighbour claims the boundary wall at Mehdipatnam encroaches 3 feet into his plot."),
    ("C20", "O.S. No. 1520 of 2023", "J4", "Vijaya Durga Chilukuri vs Chilukuri Srinivas & another", "plaintiff", "CL25", "OC7",
     "suit for declaration of gift deed as void", "2023-12-04", "suit", "evidence of PW2",
     "Mother challenges gift deed obtained by son while she was hospitalised."),
    ("C21", "C.R.P. No. 1874 of 2025", "J3", "Balaraju Mudiraj vs Yellaiah Kummari", "petitioner", "CL18", "OC1",
     "civil revision petition against order refusing to reopen evidence", "2025-04-01", "crp", "hearing",
     "Trial court refused to recall PW1 to mark revenue records."),
    ("C22", "O.S. No. 1011 of 2022", "J5", "Farzana Begum vs Mohd. Salahuddin & 4 others", "plaintiff", "CL14", "OC6",
     "partition suit", "2022-08-29", "suit", "cross-examination of PW1",
     "Share in father's house at Tolichowki after his death."),
    ("C23", "W.P. No. 14872 of 2025", "J3", "Sri Sai Balaji Residency Owners Welfare Association vs GHMC & 2 others", "petitioner", "CL4", "OC2",
     "writ petition against demolition notice", "2025-05-12", "wp", "hearing",
     "GHMC issued notice under Sec. 636 GHMC Act to demolish the parking-level structure alleging setback violation."),
    ("C24", "O.S. No. 488 of 2025", "J6", "Deccan Polymers Pvt. Ltd. vs Arun Enterprises", "plaintiff", "CL9", "OC4",
     "suit for recovery of money", "2025-03-03", "suit", "filing of written statement",
     "Recovery of Rs. 6,75,000 for goods supplied."),
    ("C25", "W.P. No. 22019 of 2025", "J1", "Vijaya Durga Chilukuri vs Sub-Registrar, Uppal & another", "petitioner", "CL25", "OC2",
     "writ petition against refusal to register cancellation deed", "2025-08-18", "wp", "counter-affidavit by respondents",
     "Sub-Registrar refused to register a deed cancelling the disputed gift deed."),
    ("C26", "O.S. No. 1650 of 2022", "J5", "Balaraju Mudiraj vs Ghatkesar Developers & another", "plaintiff", "CL18", "OC4",
     "suit for declaration of title and possession", "2022-11-21", "suit", "evidence of PW2",
     "Developer included plaintiff's 400 sq. yd plot in a layout at Ghatkesar."),
    ("C27", "O.S. No. 733 of 2023", "J4", "Sri Vaishnavi Constructions vs Manikanta Steels", "plaintiff", "CL15", "OC3",
     "suit for recovery of advance and damages", "2023-06-12", "suit", "cross-examination of DW1",
     "Steel supplier took Rs. 9 lakh advance and delivered short."),
    ("C28", "O.S. No. 1198 of 2023", "J2", "Harpreet Singh Bedi vs Satnam Motors", "plaintiff", "CL11", "OC6",
     "suit for rendition of accounts", "2023-10-09", "suit", "framing of issues",
     "Dissolved transport partnership; accounts never settled."),
    ("C29", "W.P. No. 12577 of 2025", "J1", "Sri Sai Balaji Residency Owners Welfare Association vs Telangana State Southern Power Distribution Co. & another", "petitioner", "CL4", "OC8",
     "writ petition against back-billing demand", "2025-05-05", "wp", "hearing",
     "DISCOM raised a Rs. 7.8 lakh back-billing demand for common area meters."),
    ("C30", "O.S. No. 95 of 2024", "J5", "Kamala Devi Bommireddy vs Nageshwar Rao Tenneti", "plaintiff", "CL3", "OC3",
     "suit for recovery of possession from licensee", "2024-01-22", "suit", "cross-examination of PW1",
     "Licensee of an outhouse at Mehdipatnam refuses to vacate."),
    ("C31", "O.S. No. 764 of 2020", "J5", "Lakshmana Rao Gudivada vs Raghavendra Chary Kasoju", "defendant", "CL8", "OC5",
     "suit for perpetual injunction based on possession", "2020-12-07", "suit", "arguments",
     "Plaintiff claims possession of 150 sq. yd at Saroornagar since his sale deed of 03.03.2016; Meera's client says plaintiff was never in possession."),
    ("C32", "O.S. No. 1066 of 2024", "J4", "Revathi Nandyala vs Brick & Mortar Realty", "plaintiff", "CL21", "OC4",
     "suit for refund of booking amount", "2024-07-29", "suit", "framing of issues",
     "Refund of Rs. 12 lakh booking amount for a villa project that never got permission."),
    ("C33", "W.P. No. 27730 of 2024", "J3", "Joseph Anthony Pinto vs South Central Railway & 2 others", "petitioner", "CL16", "OC8",
     "writ petition for revision of pension", "2024-11-25", "wp", "reply affidavit",
     "Pension fixed without counting 4 years of casual service."),
    ("C34", "O.S. No. 610 of 2025", "J6", "Prakash Chand Agarwal vs Shree Balaji Fabrics", "plaintiff", "CL20", "OC1",
     "suit for recovery of money", "2025-04-14", "suit", "framing of issues",
     "Recovery of Rs. 3,90,000 on dishonoured cheques' underlying debt."),
    ("C35", "O.S. No. 145 of 2025", "J6", "Sunitha Raghunath vs Sri Lakshmi Narasimha Builders & another", "plaintiff", "CL5", "OC4",
     "suit for permanent injunction against construction", "2025-02-17", "suit", "chief-examination of PW1",
     "Builder constructing a fourth floor over the common staircase and blocking light and air to plaintiff's house at Bowenpally."),
    ("C36", "A.S. No. 112 of 2025", "J2", "Farzana Begum vs Mohd. Rafi", "appellant", "CL14", "OC5",
     "first appeal against decree for eviction", "2025-06-16", "as", "hearing",
     "Appeal against eviction decree from a junior civil judge court."),
    ("C37", "O.S. No. 288 of 2025", "J4", "Hyderabad Fresh Dairy LLP vs Tirumala Cold Chain Pvt. Ltd.", "plaintiff", "CL19", "OC3",
     "suit for recovery of money", "2025-01-27", "suit", "framing of issues",
     "Recovery of Rs. 36,40,000 for spoiled stock due to cold chain failure."),
    ("C38", "C.M.A. No. 1181 of 2025", "J3", "Kiran Kumar Yarlagadda vs Srinidhi Estates", "appellant", "CL15", "OC7",
     "civil miscellaneous appeal against grant of temporary injunction", "2025-08-04", "cma", "hearing",
     "Appeal against temporary injunction restraining sale of flats in a joint development project."),
    ("C39", "O.S. No. 1433 of 2023", "J5", "Temple Committee, Uppal vs Uppalaiah Chakali & others", "plaintiff", "CL12", "OC1",
     "suit for recovery of temple land", "2023-11-13", "suit", "chief-examination of PW1",
     "Recovery of 0.8 acres of endowment land held by former tenants."),
    ("C40", "C.R.P. No. 3065 of 2025", "J1", "Anuradha Velagapudi vs Sri Vaishnavi Constructions", "petitioner", "CL7", "OC4",
     "civil revision petition against order refusing to appoint advocate commissioner", "2025-10-27", "crp", "hearing",
     "Trial court refused to appoint advocate commissioner to inspect the incomplete flat."),
]

# Short names Meera uses in her own notes (she rarely writes full case numbers).
SHORT_NAMES = {
    "C01": "Gollapudi partition", "C02": "Khaja Moinuddin", "C03": "Kasoju pronote", "C04": "Deccan Polymers CRP",
    "C05": "Dr. Anuradha flat", "C06": "Pasupuleti eviction", "C07": "Tadepalli", "C08": "Pinto society",
    "C09": "Agarwal / Hanuman Textiles", "C10": "Greenfield park WP", "C11": "Bedi permits WP", "C12": "Lakshmi Ganapathi",
    "C13": "Vadlamani appeal", "C14": "Fresh Dairy CMA", "C15": "Uppal temple WP", "C16": "Revathi partition",
    "C17": "Rasheed Khan (tenant)", "C18": "Kandregula contract", "C19": "Kamala Devi wall", "C20": "Vijaya Durga gift deed",
    "C21": "Balaraju CRP", "C22": "Farzana partition", "C23": "Sai Balaji GHMC WP", "C24": "Deccan Polymers v Arun",
    "C25": "Vijaya Durga SRO WP", "C26": "Balaraju title suit", "C27": "Vaishnavi v Manikanta", "C28": "Bedi accounts",
    "C29": "Sai Balaji DISCOM WP", "C30": "Kamala Devi outhouse", "C31": "Gudivada v Kasoju", "C32": "Revathi refund",
    "C33": "Pinto pension WP", "C34": "Agarwal v Balaji Fabrics", "C35": "Sunitha injunction", "C36": "Farzana eviction appeal",
    "C37": "Fresh Dairy suit", "C38": "Yarlagadda CMA", "C39": "Uppal temple land", "C40": "Dr. Anuradha CRP",
}

DEMO_CAUSE_LIST = {
    # judge: [(case_id, item_no)]
    "J2": [("C12", 7), ("C07", 14), ("C19", 22), ("C03", 31)],
    "J5": [("C09", 18), ("C31", 26), ("C26", 40)],
    "J3": [("C38", 9), ("C23", 17), ("C15", 33)],
    "J1": [("C11", 4), ("C29", 12), ("C40", 21)],
}

# Court closures. Weekends are closed too.
VACATIONS = [
    ("2025-05-01", "2025-06-06", "summer vacation"),
    ("2025-09-29", "2025-10-04", "Dasara vacation"),
    ("2025-12-24", "2026-01-01", "Christmas break"),
    ("2026-01-12", "2026-01-17", "Sankranti vacation"),
    ("2026-05-01", "2026-06-05", "summer vacation"),
]
HOLIDAYS = [
    "2025-03-14", "2025-03-31", "2025-04-14", "2025-04-18", "2025-07-21", "2025-08-15", "2025-08-27",
    "2025-09-05", "2025-10-02", "2025-10-20", "2025-11-05", "2026-01-26", "2026-03-04", "2026-03-20",
    "2026-04-03", "2026-04-14", "2026-09-14", "2026-10-02",
]


def is_court_day(d: dt.date) -> bool:
    if d.weekday() >= 5:
        return False
    s = d.isoformat()
    if s in HOLIDAYS:
        return False
    return not any(a <= s <= b for a, b, _ in VACATIONS)


def next_court_day(d: dt.date) -> dt.date:
    while not is_court_day(d):
        d += dt.timedelta(days=1)
    return d


def judge(jid):
    return next(j for j in JUDGES if j["id"] == jid)


def oc(oid):
    return next(o for o in OPPOSING_COUNSEL if o["id"] == oid)


def client(cid):
    return next(c for c in CLIENTS if c["id"] == cid)


def case_stub(cid):
    row = next(r for r in CASES if r[0] == cid)
    keys = ["id", "case_number", "judge_id", "title", "meera_represents", "client_id", "opposing_counsel_id",
            "nature", "filed_on", "kind", "final_listed_for", "one_line_summary"]
    d = dict(zip(keys, row))
    j = judge(d["judge_id"])
    d["court_level"] = j["level"]
    d["court"] = j["court_hall"] + ", " + j["court"]
    d["short_name"] = SHORT_NAMES[cid]
    return d
