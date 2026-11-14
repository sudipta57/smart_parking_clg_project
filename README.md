# The Smart Parking Fee Calculator

A web app for a parking attendant. It records vehicle entry and exit, calculates the correct fee
automatically (grace period, day/night rates, daily cap), prints a receipt and shows daily earnings.

| | |
|---|---|
| Project ID | JIS/IT/2026-27/3rd Sem/020 |
| Team | Sudipta Ghorami, Sujoy Pramanick, Sukanya Gupta, Sukriti Kumari |
| Mentor | Mr. Ritadrik Chowdhury |
| Milestone | CAA Level 1 Evaluation, 18 Nov 2026 |

**Stack:** Python 3.11+ · FastAPI · SQLAlchemy 2 · SQLite · React 18 + Vite (JavaScript) ·
React Router 6 · Tailwind CSS 4 · pytest. Runs offline on one laptop. No login, no cloud.

---

## Quick start

You need **Python 3.11+** and **Node.js 18+**.

**Linux / macOS**

```bash
./run.sh
```

**Windows**

```bat
run.bat
```

On the first run the script installs the dependencies, creates the database with demo data and
starts both servers:

- App: <http://localhost:5173>
- API docs (Swagger): <http://localhost:8000/docs>

Press `Ctrl+C` to stop (on Windows, close the two server windows).

## Manual setup

```bash
# Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python seed.py                       # optional: demo data
uvicorn app.main:app --reload --port 8000

# Frontend (second terminal)
cd frontend
npm install
npm run dev
```

## Tests

```bash
cd backend
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pytest -q
```

```
..........................................................               [100%]
58 passed in 0.6s
```

- `tests/test_fee_engine.py`: the 21 fee cases from the PRD (one parametrized table) plus edge cases
- `tests/test_validators.py`: number-plate rules
- `tests/test_api.py`: every endpoint, using a temporary SQLite database per test

## Demo data

```bash
cd backend && python seed.py
```

```
Seeded: 6 parked, 15 completed today (₹860), 10 completed yesterday.
```

This wipes the database and refills it **relative to the current time**: 6 parked vehicles
(including one parked for 26 hours, which shows the daily cap), 15 exits today and 10 yesterday.
Every amount is calculated by the fee engine. The rupee total depends on the time you run it.

---

## Demo script (Level 1 evaluation)

1. Run `python seed.py`, then open the **Dashboard**: live numbers.
2. **New Entry:** `WB 02 XY 7777`, Car. A slot is assigned.
3. **Duplicate entry** of the same plate shows a clear error (validation).
4. **Parked Vehicles:** live timer. Open the 26 h vehicle: the breakdown shows the **daily cap**.
5. **Exit** a vehicle using "Demo: custom exit time", pay by UPI, see the **Receipt**, click **Print**.
6. **History** shows it, and the **Dashboard** earnings go up.
7. **Fee Simulator:** run "Overnight 9PM–2AM" and explain 1 day block + 4 night blocks = ₹140.
8. If asked, open `backend/tests/test_fee_engine.py` and run `pytest` live.

Run `python seed.py` again just before the evaluation. It resets the data, so the step 2 plate is
free again.

---

## Fee rules (summary)

| Type | Day / hr | Night / hr (22:00–06:00) | Daily cap |
|---|---|---|---|
| Two-Wheeler | ₹10 | ₹15 | ₹100 |
| Car | ₹20 | ₹30 | ₹200 |
| SUV / Heavy | ₹30 | ₹45 | ₹300 |

1. 15 minutes or less is free.
2. After that, every started hour is billed in full (16 min = 1 h, 61 min = 2 h).
3. Each hour is charged at the rate in effect when that hour **starts**.
4. Each 24-hour window from entry is capped at the daily cap.
5. Total = sum of the capped windows.

Full rules, worked examples and the test table are in [docs/FEE_RULES.md](docs/FEE_RULES.md).
All rates live in [backend/app/config.py](backend/app/config.py).

## Project structure

```
├── README.md
├── run.sh / run.bat            start backend + frontend
├── backend/
│   ├── requirements.txt
│   ├── seed.py                 demo data
│   ├── app/
│   │   ├── main.py             FastAPI app, CORS, routers, error handlers, startup create_all
│   │   ├── config.py           all rates and limits
│   │   ├── fee_engine.py       pure fee calculation
│   │   ├── validators.py       number-plate rules
│   │   ├── timeutils.py        now_ist(), to_ist_naive(), to_iso_ist()
│   │   ├── db.py · models.py · schemas.py
│   │   ├── services.py         entry / exit / slot / receipt / stats logic
│   │   └── routers/            meta.py, quote.py, sessions.py, stats.py
│   └── tests/                  conftest.py, test_fee_engine.py, test_validators.py, test_api.py
├── frontend/                   Vite + React app (see docs/ARCHITECTURE.md)
└── docs/
    ├── FEE_RULES.md            rules + test table (for the report and viva)
    ├── ARCHITECTURE.md         diagrams, request flow, data model
    ├── API.md                  endpoints with examples
    └── CHANGELOG.md            improvements beyond the PRD
```

## Troubleshooting

| Problem | Fix |
|---|---|
| Page says "Cannot reach the server" | The backend is not running. Start it with `run.sh` or `uvicorn app.main:app --port 8000` from `backend/`. |
| `Port 5173 is already in use` | Another Vite server is running. Close it, or stop the old `run.sh`. |
| "Vehicle … is already parked" during the demo | That plate is still parked from an earlier run. Exit it, or run `python seed.py` to reset. |
| Want a completely empty lot | Stop the servers, delete `backend/parking.db`, and start the backend with `uvicorn` (it recreates empty tables). `run.sh` / `run.bat` would load the demo data again. |
# smart_parking_clg_project
