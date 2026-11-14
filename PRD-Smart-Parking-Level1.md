# PRD — The Smart Parking Fee Calculator (Level 1)

> **For Claude Code.** This document is the single source of truth for building Level 1 of the project end-to-end. Build everything in this file. Do not add features from the "Out of Scope" section. If you make a technical improvement beyond this spec, record it in `docs/CHANGELOG.md` with a one-line reason.

| Field | Value |
|---|---|
| Project | The Smart Parking Fee Calculator |
| Project ID | JIS/IT/2026-27/3rd Sem/020 |
| Team | Sudipta Ghorami, Sujoy Pramanick, Sukanya Gupta, Sukriti Kumari |
| Mentor | Mr. Ritadrik Chowdhury |
| Milestone | CAA Level 1 Evaluation — 18 Nov 2026 |
| Goal | Working, demo-able web app whose core is a correct, explainable, fully tested fee engine |

---

## 1. Problem & Product Summary

Parking lots that bill by hand make mistakes on partial hours, night rates and long stays, and they have no record of earnings. This app lets a **parking attendant** record vehicle entry and exit, calculates the correct fee automatically using clear rules, prints a receipt, and shows daily earnings.

**Single user role:** Attendant (no login in Level 1).

**Core user flow:**
1. A vehicle arrives → the attendant enters the plate number and vehicle type → the system records the entry time and assigns a slot.
2. The vehicle appears in the **Currently Parked** list with a live timer and the fee so far.
3. The vehicle leaves → the attendant opens its exit screen → the system calculates the fee with a full breakdown.
4. The attendant selects the payment method (Cash/UPI) → confirms → a receipt is generated.
5. The dashboard shows today's earnings, vehicle counts and occupancy.

---

## 2. Tech Stack (fixed — do not change)

| Layer | Choice |
|---|---|
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2.x, Pydantic v2, Uvicorn |
| Database | SQLite (file: `backend/parking.db`) |
| Frontend | React 18 + Vite, **JavaScript (not TypeScript)**, React Router v6, Tailwind CSS v4 (`@tailwindcss/vite` plugin) |
| Tests | pytest + FastAPI `TestClient` (backend) |
| Timezone | `Asia/Kolkata` (IST) everywhere |

Reason for JS over TS: all four team members must be able to read and explain the frontend code in the viva.

---

## 3. Constraints

1. No authentication, no external APIs, no cloud services, no Docker. It must run offline on one laptop.
2. All money values are **integers in rupees** (no paise, no floats).
3. The fee engine (`fee_engine.py`) must be a **pure module**: no DB access, no `datetime.now()` calls, no I/O. It takes inputs and returns a result.
4. All rates and limits live in **one config file** (`backend/app/config.py`). No magic numbers anywhere else.
5. Time handling: the backend converts every incoming datetime to IST, then stores it as a **naive datetime representing IST** in SQLite. Every outgoing datetime is serialized as ISO 8601 with a `+05:30` offset. Use a helper `now_ist()` in one place.
6. Durations are measured in whole minutes; **seconds are truncated** (`floor`).
7. The code must be readable by 2nd-year students: short functions, docstrings on every public function, comments explaining *why* in the fee engine.
8. Frontend talks to the backend only through `/api/*`, using the Vite dev proxy, so no CORS setup is needed in dev. Also enable CORS for `http://localhost:5173` as a fallback.

---

## 4. Fee Rules (the core — implement exactly)

### 4.1 Configuration (`backend/app/config.py`)

```python
from datetime import time

TIMEZONE = "Asia/Kolkata"
GRACE_MINUTES = 15            # stays of <= 15 min are free
NIGHT_START = time(22, 0)     # night window is [22:00, 06:00)
NIGHT_END = time(6, 0)
CAP_WINDOW_HOURS = 24         # daily cap applies per 24h window from entry

RATES = {
    "BIKE": {"day": 10, "night": 15, "cap": 100},
    "CAR":  {"day": 20, "night": 30, "cap": 200},
    "SUV":  {"day": 30, "night": 45, "cap": 300},
}

CAPACITY = {"BIKE": 20, "CAR": 30, "SUV": 10}
SLOT_PREFIX = {"BIKE": "B", "CAR": "C", "SUV": "S"}
VEHICLE_LABELS = {"BIKE": "Two-Wheeler", "CAR": "Car", "SUV": "SUV / Heavy"}
```

### 4.2 Rules in plain English (copy into `docs/FEE_RULES.md`)

1. **Grace period:** if the stay is 15 minutes or less, the fee is ₹0.
2. **Hourly billing, rounded up:** after the grace period, every started hour is billed in full. 16 min = 1 hour, 61 min = 2 hours. The grace period is not subtracted: 16 min bills as 1 full hour.
3. **Rate per hour block:** each hour block is charged at the rate in effect **when that block starts**. A block starting at or after 22:00, or before 06:00, uses the night rate. Otherwise it uses the day rate.
4. **Daily cap:** hour blocks are grouped into 24-hour windows counted from the entry time (blocks 1–24, 25–48, …). Each window's total is capped at the vehicle's daily cap.
5. **Total** = sum of all capped windows.

### 4.3 Pseudocode (`backend/app/fee_engine.py`)

```
class InvalidTimeRange(ValueError)

function is_night(t: time) -> bool:
    return t >= NIGHT_START or t < NIGHT_END

function calculate_fee(vehicle_type, entry_time, exit_time) -> FeeBreakdown:
    if vehicle_type not in RATES: raise ValueError("Unknown vehicle type")
    if exit_time < entry_time: raise InvalidTimeRange("Exit time is before entry time")

    duration_minutes = floor((exit_time - entry_time).total_seconds() / 60)
    rate = RATES[vehicle_type]

    if duration_minutes <= GRACE_MINUTES:
        return FeeBreakdown(duration_minutes, grace_applied=True, billable_hours=0,
                            blocks=[], windows=[], total=0, ...rates)

    billable_hours = ceil(duration_minutes / 60)
    blocks = []
    for i in 0 .. billable_hours-1:
        block_start = entry_time + i hours
        night = is_night(block_start.time())
        blocks.append(Block(index=i+1, start=block_start,
                            kind="NIGHT" if night else "DAY",
                            amount=rate.night if night else rate.day))

    windows = []
    for w, chunk in enumerate(chunks(blocks, CAP_WINDOW_HOURS)):
        raw = sum(b.amount for b in chunk)
        charged = min(raw, rate.cap)
        windows.append(Window(index=w+1, hours=len(chunk), raw_amount=raw,
                              cap=rate.cap, charged=charged, capped=raw > rate.cap))

    total = sum(w.charged for w in windows)
    return FeeBreakdown(
        vehicle_type, duration_minutes, grace_applied=False, billable_hours,
        day_hours=count(kind=="DAY"), night_hours=count(kind=="NIGHT"),
        day_rate=rate.day, night_rate=rate.night, daily_cap=rate.cap,
        blocks, windows, total)
```

`FeeBreakdown`, `Block` and `Window` are dataclasses (or Pydantic models) and must serialize to JSON for the API.

Also expose `format_duration(minutes) -> str`, e.g. `160 → "2h 40m"`, `1470 → "1d 0h 30m"`, `10 → "10m"`.

### 4.4 Fee test cases (must all pass — `backend/tests/test_fee_engine.py`)

All dates are 2026-11-18 unless shown. Write them as one `@pytest.mark.parametrize` table.

| # | Type | Entry | Exit | Duration | Expected ₹ | What it proves |
|---|---|---|---|---|---|---|
| 1 | CAR | 10:00 | 10:10 | 10m | **0** | Grace period |
| 2 | CAR | 10:00 | 10:15 | 15m | **0** | Grace boundary is inclusive |
| 3 | CAR | 10:00 | 10:16 | 16m | **20** | Just past grace → 1 full hour |
| 4 | CAR | 10:00 | 11:00 | 1h | **20** | Exact hour |
| 5 | CAR | 10:00 | 11:01 | 1h 1m | **40** | Round up |
| 6 | CAR | 10:00 | 12:40 | 2h 40m | **60** | 3 day blocks |
| 7 | BIKE | 10:00 | 12:40 | 2h 40m | **30** | Bike rate |
| 8 | SUV | 10:00 | 12:40 | 2h 40m | **90** | SUV rate |
| 9 | CAR | 21:00 | 02:00 (+1 day) | 5h | **140** | 1 day + 4 night blocks, crosses midnight |
| 10 | CAR | 21:30 | 23:00 | 1h 30m | **50** | Day block then night block |
| 11 | CAR | 05:30 | 07:00 | 1h 30m | **50** | Night block then day block |
| 12 | CAR | 21:59 | 22:30 | 31m | **20** | Rate decided at block start (day) |
| 13 | CAR | 22:00 | 22:30 | 30m | **30** | 22:00 is night (inclusive) |
| 14 | CAR | 06:00 | 06:30 | 30m | **20** | 06:00 is day (night ends exclusive) |
| 15 | CAR | 10:00 | 18:00 | 8h | **160** | Under cap |
| 16 | CAR | 10:00 | 21:00 | 11h | **200** | Raw 220 → capped at 200 |
| 17 | CAR | 08:00 | 08:00 (+1 day) | 24h | **200** | Raw 560 → one capped window |
| 18 | CAR | 08:00 | 08:30 (+1 day) | 24h 30m | **220** | 200 cap + 1 block in window 2 |
| 19 | BIKE | 10:00 | 10:00 (+2 days) | 48h | **200** | Two capped windows |
| 20 | SUV | 20:00 | 01:00 (+1 day) | 5h | **195** | 2×30 + 3×45 |
| 21 | CAR | 10:00 | 10:00 | 0m | **0** | Zero duration |

Extra assertions:
- Case 9: `billable_hours == 5`, `day_hours == 1`, `night_hours == 4`.
- Case 16: `windows[0].raw_amount == 220`, `windows[0].capped is True`.
- Case 18: `len(windows) == 2`, `windows[1].charged == 20`.
- Exit before entry (CAR, 10:00 → 09:59) raises `InvalidTimeRange`.
- Unknown type `"TRUCK"` raises `ValueError`.
- `format_duration`: `0 → "0m"`, `10 → "10m"`, `60 → "1h 0m"`, `160 → "2h 40m"`, `1470 → "1d 0h 30m"`.

---

## 5. Vehicle Number Validation (`backend/app/validators.py`)

`normalize_plate(raw: str) -> str`: uppercase, remove spaces, hyphens and dots.

Valid if it matches either pattern:
- Standard: `^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$`
- Bharat series: `^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$`

| Input | Result |
|---|---|
| `wb 02 ab 1234` | valid → `WB02AB1234` |
| `WB-02-AB-1234` | valid → `WB02AB1234` |
| `DL1C1234` | valid → `DL1C1234` |
| `22BH1234AA` | valid → `22BH1234AA` |
| `WB02AB12` | invalid |
| `1234` | invalid |
| `""` | invalid |

---

## 6. Data Model (SQLite via SQLAlchemy)

Table: **`parking_sessions`**

| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK autoincrement | |
| vehicle_number | TEXT, indexed | normalized |
| vehicle_type | TEXT | `BIKE` / `CAR` / `SUV` |
| slot_code | TEXT | e.g. `C-07` |
| status | TEXT | `PARKED` / `COMPLETED` |
| entry_time | DATETIME | naive IST |
| exit_time | DATETIME, nullable | naive IST |
| duration_minutes | INTEGER, nullable | set on exit |
| billable_hours | INTEGER, nullable | set on exit |
| amount | INTEGER, nullable | rupees, set on exit |
| payment_method | TEXT, nullable | `CASH` / `UPI` |
| receipt_no | TEXT, nullable, unique | `PK-YYYYMMDD-NNNN`, set on exit |
| fee_breakdown | TEXT (JSON), nullable | full `FeeBreakdown` snapshot at exit |
| created_at | DATETIME | |

Rules:
- **One active session per vehicle:** a vehicle with status `PARKED` cannot be entered again.
- **Slot assignment:** the lowest free number for that type, from 1 to `CAPACITY[type]`, formatted as `{PREFIX}-{NN}` (`C-01` … `C-30`). A slot is free if no `PARKED` session uses it.
- **Receipt number:** `PK-{exit date YYYYMMDD}-{NNNN}`, where NNNN is the count of sessions completed on that exit date + 1, zero-padded to 4 digits.
- Tables are created automatically on startup (`Base.metadata.create_all`).

---

## 7. API Specification

Base path `/api`. JSON only. All error responses look like `{"detail": "<human readable message>"}`.

| # | Method & Path | Purpose |
|---|---|---|
| 1 | `GET /api/health` | `{"status": "ok"}` |
| 2 | `GET /api/config` | Rates, grace minutes, night window, capacity, vehicle labels (for UI rate card) |
| 3 | `POST /api/quote` | Calculate a fee without saving anything (Simulator page) |
| 4 | `POST /api/sessions` | Vehicle entry |
| 5 | `GET /api/sessions/active` | All parked vehicles + fee so far |
| 6 | `GET /api/sessions/{id}` | One session (any status) |
| 7 | `GET /api/sessions/{id}/exit-preview?exit_time=` | Fee breakdown if the vehicle left now (or at `exit_time`) |
| 8 | `POST /api/sessions/{id}/exit` | Confirm exit + payment → completes the session |
| 9 | `GET /api/sessions/history?date=YYYY-MM-DD&q=` | Completed sessions, newest first; `date` filters by exit date, `q` partially matches the plate |
| 10 | `GET /api/stats/today` | Dashboard numbers |

### 7.1 Request / response details

**`POST /api/quote`**
```json
// request
{ "vehicle_type": "CAR", "entry_time": "2026-11-18T21:00:00+05:30", "exit_time": "2026-11-19T02:00:00+05:30" }
// response 200 -> FeeBreakdown JSON
{ "vehicle_type": "CAR", "duration_minutes": 300, "duration_text": "5h 0m", "grace_applied": false,
  "billable_hours": 5, "day_hours": 1, "night_hours": 4, "day_rate": 20, "night_rate": 30, "daily_cap": 200,
  "blocks": [ {"index":1,"start":"2026-11-18T21:00:00+05:30","kind":"DAY","amount":20}, ... ],
  "windows": [ {"index":1,"hours":5,"raw_amount":140,"cap":200,"charged":140,"capped":false} ],
  "total": 140 }
```
Errors: exit before entry → `422`, `"Exit time cannot be before entry time"`.

**`POST /api/sessions`**
```json
// request (entry_time optional — demo override; default = now IST)
{ "vehicle_number": "wb 02 ab 1234", "vehicle_type": "CAR", "entry_time": null }
// response 201
{ "id": 1, "vehicle_number": "WB02AB1234", "vehicle_type": "CAR", "slot_code": "C-01",
  "status": "PARKED", "entry_time": "2026-11-18T10:32:00+05:30" }
```
Errors:
- Invalid plate → `422` `"Invalid vehicle number format"`
- Already parked → `409` `"Vehicle WB02AB1234 is already parked in slot C-01"`
- Lot full for that type → `409` `"No free slots for Car (30/30 occupied)"`
- `entry_time` in the future (more than 1 minute ahead of now) → `422` `"Entry time cannot be in the future"`

**`GET /api/sessions/active`** → a list, oldest entry first. Each item = session fields + `elapsed_minutes`, `elapsed_text` and `current_fee` (computed with `now_ist()`).

**`POST /api/sessions/{id}/exit`**
```json
// request (exit_time optional — demo override; default = now IST)
{ "payment_method": "UPI", "exit_time": null }
// response 200 -> completed session including receipt_no, amount and fee_breakdown
```
Errors: not found → `404`; already completed → `409` `"Session already completed"`; exit before entry → `422`; bad payment method → `422`.

**`GET /api/stats/today`**
```json
{ "date": "2026-11-18", "earnings_today": 1240, "earnings_by_method": {"CASH": 800, "UPI": 440},
  "vehicles_in_today": 23, "vehicles_out_today": 17, "currently_parked": 6,
  "occupancy": { "BIKE": {"parked": 2, "capacity": 20}, "CAR": {"parked": 3, "capacity": 30}, "SUV": {"parked": 1, "capacity": 10} } }
```
`earnings_today` counts sessions by **exit date**. `vehicles_in_today` counts by **entry date**.

---

## 8. Frontend Specification

### 8.1 Layout
- Left sidebar with the app name "Smart Parking" and links: Dashboard, New Entry, Parked Vehicles, History, Fee Simulator, Rate Card.
- Clean, professional look: neutral background, one accent colour, cards with soft borders. Mobile-friendly enough for a laptop demo; full mobile polish is not needed.
- A global toast or inline banner for success and error messages (show the API's `detail` text).

### 8.2 Pages

| Route | Page | Requirements |
|---|---|---|
| `/` | **Dashboard** | Stat cards: Earnings Today (₹), Vehicles In, Vehicles Out, Currently Parked. Occupancy bar per vehicle type (`parked/capacity`). Earnings by method (Cash vs UPI). "Recent exits" list (last 5). Auto-refresh every 30 s. |
| `/entry` | **New Entry** | Vehicle number input (auto-uppercase as the user types), vehicle type as 3 large selectable cards (Bike / Car / SUV with rates shown), submit button. Collapsible "Demo: custom entry time" with a `datetime-local` input. On success, show the assigned slot in large text plus a "Add another" button. |
| `/parked` | **Parked Vehicles** | Search box (filters by plate). Table: Plate, Type, Slot, Entry Time, **live elapsed timer** (ticks every second on the client), Fee So Far (refetched every 30 s), "Exit" button. Empty state message. |
| `/exit/:id` | **Exit & Payment** | Vehicle summary. Collapsible "Demo: custom exit time". Full fee breakdown from `exit-preview` (see 8.3). Payment method toggle: Cash / UPI. "Confirm Exit & Generate Receipt" button → navigate to the receipt. |
| `/receipt/:id` | **Receipt** | Receipt card: receipt no., plate, type, slot, entry, exit, duration, breakdown summary, total (large), payment method. "Print" button (`window.print()`, with print CSS that hides the sidebar and buttons). "Back to Dashboard". |
| `/history` | **History** | Date picker (default today) + plate search. Table: Receipt No., Plate, Type, Entry, Exit, Duration, Amount, Method. Click a row → receipt page. Footer row: total amount for the filter. |
| `/simulator` | **Fee Simulator** | Pick type + entry + exit datetimes → calls `/api/quote` → shows the full breakdown. Include 4 preset buttons that fill the form: "2h 40m day", "Overnight 9PM–2AM", "Full day (cap)", "Grace (10 min)". This page is for the viva/Q&A. |
| `/rates` | **Rate Card** | Table from `/api/config`: type, day rate, night rate, daily cap, capacity. The rules list from section 4.2 in plain English. |

### 8.3 Fee breakdown component (reused on Exit, Receipt, Simulator)
Show, in order:
1. Duration (`duration_text`) and billable hours.
2. If `grace_applied`: a green badge "Within 15-min grace period — Free".
3. Day hours × day rate = ₹X, Night hours × night rate = ₹Y.
4. For each window, if `capped`: "Window N: ₹raw capped to ₹cap" (highlighted).
5. A collapsible "Hour-by-hour" list: block #, start time, DAY/NIGHT badge, ₹amount.
6. **Total** in large text.

### 8.4 Frontend structure
```
frontend/src/
  api.js                 # fetch wrapper: get/post, throws Error(detail)
  utils/format.js        # formatINR (₹1,240), formatDateTime (18 Nov, 10:32 PM), formatElapsed
  components/            # Sidebar, StatCard, FeeBreakdown, VehicleTypePicker, LiveTimer, Toast, EmptyState
  pages/                 # Dashboard, NewEntry, ParkedVehicles, ExitPayment, Receipt, History, Simulator, RateCard
  App.jsx, main.jsx, index.css
```
Convert `datetime-local` values to ISO with `+05:30` before sending.

---

## 9. Repository Structure

```
smart-parking/
├── README.md
├── run.sh                      # starts backend + frontend together (Linux/macOS)
├── run.bat                     # same for Windows
├── backend/
│   ├── requirements.txt
│   ├── seed.py                 # demo data
│   ├── app/
│   │   ├── main.py             # FastAPI app, CORS, routers, startup create_all
│   │   ├── config.py
│   │   ├── fee_engine.py
│   │   ├── validators.py
│   │   ├── timeutils.py        # now_ist(), to_ist_naive(), to_iso_ist()
│   │   ├── db.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── services.py         # entry/exit/slot/receipt logic
│   │   └── routers/ (sessions.py, quote.py, stats.py, meta.py)
│   └── tests/
│       ├── conftest.py         # temp SQLite DB per test
│       ├── test_fee_engine.py
│       ├── test_validators.py
│       └── test_api.py
├── frontend/  (Vite React app as in 8.4; vite.config.js proxies /api → http://localhost:8000)
└── docs/
    ├── FEE_RULES.md            # 4.2 rules + 4.4 test table (for report & viva)
    ├── ARCHITECTURE.md         # component diagram (Mermaid), request flow, data model
    ├── API.md                  # endpoint list with examples
    └── CHANGELOG.md
```

---

## 10. Seed Data (`backend/seed.py`)

`python seed.py` wipes and refills the DB relative to the current time so the dashboard looks alive during the demo:
- **6 currently parked:** 2 bikes, 3 cars, 1 SUV, with entry times 20 min, 1h 10m, 2h 45m, 4h, 6h 30m and 26h ago (the 26h one shows the cap in action).
- **15 completed today:** a mix of types and Cash/UPI, durations from 10 min (free) to 9h, including at least one overnight stay that exited this morning.
- **10 completed yesterday** (so the history date filter has something to show).
- Use realistic WB plates (e.g. `WB02AB1234`, `WB06K4521`, `WB24AF0099`).
- All amounts are computed through `calculate_fee`, never hardcoded.

Print a summary at the end:
```
Seeded: 6 parked, 15 completed today (₹XXXX), 10 completed yesterday.
```

---

## 11. Build Steps for Claude Code (in order)

Each step ends with a check. Do not move on until the check passes.

1. **Scaffold** the repo structure from section 9. Create `backend/requirements.txt` (`fastapi`, `uvicorn[standard]`, `sqlalchemy>=2`, `pydantic>=2`, `pytest`, `httpx`, `tzdata`).
   Check: `pip install -r requirements.txt` succeeds.
2. **Config + time utils + fee engine + validators** (sections 3–5).
   Check: `pytest tests/test_fee_engine.py tests/test_validators.py -v` → all pass.
3. **DB, models, schemas, services** (section 6).
4. **API routers** (section 7).
   Check: `pytest -v` → all pass. `uvicorn app.main:app --reload --port 8000`, then `curl localhost:8000/api/health` → `{"status":"ok"}`.
5. **API tests** (`test_api.py`), at minimum:
   - Entry → 201 with slot `C-01`. A second car gets `C-02`.
   - Duplicate active plate → 409.
   - Invalid plate → 422.
   - Future entry time → 422.
   - Fill BIKE capacity (20) → the 21st → 409.
   - Exit-preview with a fixed `exit_time` returns the correct total (use test case 9).
   - Exit → 200, `receipt_no` matches `^PK-\d{8}-\d{4}$`, status `COMPLETED`, slot freed (a new car gets the freed slot).
   - Exit an already completed session → 409.
   - Stats after 2 exits → `earnings_today` equals the sum of both.
   - `/api/quote` with case 20 → `total == 195`.
6. **Seed script** (section 10). Check: `python seed.py` prints the summary line.
7. **Frontend scaffold:** Vite React (JS), Tailwind v4, React Router, proxy. Check: `npm run dev` serves on 5173 and the Dashboard loads data from the API.
8. **Pages** in this order: Rate Card → New Entry → Parked Vehicles → Exit & Payment → Receipt → History → Simulator → Dashboard polish.
   Check: the full flow works manually (entry → parked → exit → receipt → appears in history and dashboard).
9. **Run scripts** `run.sh` and `run.bat`: install deps if missing, start both servers, print the URLs.
10. **Docs:** README (setup, run, test, demo script from section 13), `FEE_RULES.md`, `ARCHITECTURE.md` (with a Mermaid diagram: React UI → FastAPI routers → services → fee_engine / SQLite), `API.md`, `CHANGELOG.md`.
11. **Final verification:** run all tests, run seed, click through every page, fix console errors.

### Expected terminal output

```
$ cd backend && pytest -q
........................................                                 [100%]
40+ passed in 0.8s

$ python seed.py
Seeded: 6 parked, 15 completed today (₹1,185), 10 completed yesterday.

$ uvicorn app.main:app --port 8000
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)

$ cd ../frontend && npm run dev
  VITE v5.x  ready in 400 ms
  ➜  Local:   http://localhost:5173/
```
(Exact test count and seed amount will vary.)

---

## 12. Out of Scope for Level 1 (show as "Planned" in the PPT only — do NOT build)

- Login / roles (admin vs attendant)
- Editing rates from the UI
- Visual slot map / floor layout
- Number-plate recognition (OCR from camera)
- UPI QR generation / real payment gateway
- Monthly passes, discounts, lost-ticket penalty
- GST on receipts
- SMS/WhatsApp receipts
- Reports export (CSV/PDF), weekly/monthly analytics
- Multi-lot support, deployment to the cloud

---

## 13. Demo Script for Evaluation (put in README)

1. `python seed.py` → open the Dashboard: live numbers.
2. **New Entry:** `WB 02 XY 7777`, Car → slot assigned.
3. **Duplicate entry** of the same plate → clear error (shows validation).
4. **Parked Vehicles:** live timer; open the 26h vehicle → breakdown shows the **daily cap**.
5. **Exit** a vehicle with demo exit time → pay by UPI → **Receipt** → Print.
6. **History** shows it; the **Dashboard** earnings increase.
7. **Simulator:** run "Overnight 9PM–2AM" → explain the day block + night blocks = ₹140.
8. If asked, open `test_fee_engine.py` and run `pytest` live.

---

## 14. Definition of Done

- [ ] All fee engine test cases in 4.4 pass, plus validator and API tests.
- [ ] `python seed.py` + `run.sh` gives a working demo from a fresh clone in under 5 minutes.
- [ ] Every page in 8.2 works, with no console errors.
- [ ] The full flow entry → exit → receipt → history → dashboard updates correctly.
- [ ] Errors from the API are shown to the user in readable text.
- [ ] Receipt prints cleanly (no sidebar/buttons).
- [ ] All docs in `docs/` exist and match the code.
- [ ] No feature from section 12 has been built.
