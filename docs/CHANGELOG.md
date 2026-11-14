# Changelog

## Level 1 (CAA evaluation, 18 Nov 2026)

Everything in `PRD-Smart-Parking-Level1.md` is built. Nothing from the PRD's "Out of Scope" list
was added.

### Technical improvements beyond the PRD

Each line gives the change and why it was made.

- **Partial unique indexes on `parking_sessions`** (`uq_parked_vehicle`, `uq_parked_slot`, both `WHERE status = 'PARKED'`). The database itself blocks a duplicate parked plate or a double-booked slot, even if two requests arrive at the same moment.
- **Demo exit time cannot be in the future** (same 1-minute tolerance as entry). A future exit would give a receipt dated tomorrow and would not show in today's earnings or history.
- **A demo entry time slightly ahead of the server clock (within the 1-minute tolerance) is saved as "now".** Durations can never be negative.
- **Exit preview of a completed session returns 409 `Session already completed`.** The exit screen can then send the user to the receipt instead of showing a fee.
- **History endpoint: `date` is optional and there is a new optional `limit` parameter.** The Dashboard's "Recent exits" uses `limit=5`, and leaving out `date` lists all dates.
- **Pydantic validation errors are reformatted as one sentence** (e.g. `payment_method: Input should be 'CASH' or 'UPI'`). This keeps every error in the PRD's `{"detail": "<text>"}` shape.
- **More settings in `config.py`:** `PAYMENT_METHODS`, `FUTURE_TOLERANCE_MINUTES`, `RECEIPT_PREFIX`, `RECEIPT_SEQ_DIGITS` and `CORS_ORIGINS`. No magic numbers outside the config file.
- **`/api/config` also returns `vehicle_types`** (one list with label, rates, cap and capacity). The UI can draw the rate card and type picker without merging four dicts.
- **The Vite proxy targets `http://127.0.0.1:8000` instead of `localhost:8000`.** Node 17+ may resolve `localhost` to IPv6 `::1` while uvicorn listens on IPv4, which caused "ECONNREFUSED".
- **CORS also allows `http://127.0.0.1:5173`.** Same reason: the app works whichever address is typed.
- **`run.sh` / `run.bat` run `seed.py` on the first start if `parking.db` does not exist.** A fresh clone opens with a working demo.
- **`pytest.ini` silences Starlette's "use httpx2" deprecation warning.** Test output stays clean. The PRD's required `httpx` is still used.
- **Frontend: vehicle type and payment method have no default.** The attendant has to choose, so a bike is never billed as a car by mistake.
- **Frontend: system fonts only, no web fonts or CDNs.** The app must run fully offline.
- **Frontend: the exit preview refreshes every 30 s while it uses the current time.** The fee shown keeps up if the driver waits at the desk.
- **Frontend: History has Today / Yesterday / All dates shortcuts, and the sidebar shows a live IST clock.** Small conveniences for the attendant and the demo.

### Notes

- The repository root is this project folder (the PRD calls it `smart-parking/`).
- Tested with Python 3.14, FastAPI 0.162, SQLAlchemy 2.1, Node 24, Vite 8, React 18.3, React Router 6.30 and Tailwind CSS 4.3.
