# API Reference

Base URL: `http://localhost:8000/api`. In development the frontend calls `/api/*` on port 5173 and
Vite forwards it to this server. Interactive docs (Swagger UI) are at `http://localhost:8000/docs`.

- Requests and responses are JSON.
- Money is always an **integer number of rupees**.
- Datetimes are ISO 8601. Responses always use the IST offset, e.g. `2026-11-18T21:00:00+05:30`.
  Requests may use any offset; times without an offset are treated as IST.
- Every error looks like `{"detail": "<human readable message>"}`.

| # | Method & path | Purpose |
|---|---|---|
| 1 | `GET /api/health` | Liveness check |
| 2 | `GET /api/config` | Rates, grace minutes, night window, capacity, labels |
| 3 | `POST /api/quote` | Calculate a fee without saving (Fee Simulator) |
| 4 | `POST /api/sessions` | Vehicle entry |
| 5 | `GET /api/sessions/active` | Parked vehicles with fee so far |
| 6 | `GET /api/sessions/{id}` | One session (any status) |
| 7 | `GET /api/sessions/{id}/exit-preview?exit_time=` | Fee if the vehicle left now / at `exit_time` |
| 8 | `POST /api/sessions/{id}/exit` | Confirm exit and payment |
| 9 | `GET /api/sessions/history?date=&q=&limit=` | Completed sessions, newest first |
| 10 | `GET /api/stats/today` | Dashboard numbers |

---

## 1. `GET /api/health`

```json
{ "status": "ok" }
```

## 2. `GET /api/config`

```json
{
  "timezone": "Asia/Kolkata",
  "grace_minutes": 15,
  "night_start": "22:00",
  "night_end": "06:00",
  "cap_window_hours": 24,
  "rates": {
    "BIKE": { "day": 10, "night": 15, "cap": 100 },
    "CAR":  { "day": 20, "night": 30, "cap": 200 },
    "SUV":  { "day": 30, "night": 45, "cap": 300 }
  },
  "capacity": { "BIKE": 20, "CAR": 30, "SUV": 10 },
  "vehicle_labels": { "BIKE": "Two-Wheeler", "CAR": "Car", "SUV": "SUV / Heavy" },
  "payment_methods": ["CASH", "UPI"],
  "vehicle_types": [
    { "type": "BIKE", "label": "Two-Wheeler", "day_rate": 10, "night_rate": 15, "daily_cap": 100, "capacity": 20 },
    { "type": "CAR", "label": "Car", "day_rate": 20, "night_rate": 30, "daily_cap": 200, "capacity": 30 },
    { "type": "SUV", "label": "SUV / Heavy", "day_rate": 30, "night_rate": 45, "daily_cap": 300, "capacity": 10 }
  ]
}
```

`vehicle_types` holds the same data as a list, which makes it easy to render the rate card and the type picker.

## 3. `POST /api/quote`

Nothing is saved.

```json
// request
{ "vehicle_type": "CAR", "entry_time": "2026-11-18T21:00:00+05:30", "exit_time": "2026-11-19T02:00:00+05:30" }
```

```json
// 200 -> FeeBreakdown
{
  "vehicle_type": "CAR", "duration_minutes": 300, "duration_text": "5h 0m", "grace_applied": false,
  "billable_hours": 5, "day_hours": 1, "night_hours": 4, "day_rate": 20, "night_rate": 30, "daily_cap": 200,
  "blocks": [
    { "index": 1, "start": "2026-11-18T21:00:00+05:30", "kind": "DAY",   "amount": 20 },
    { "index": 2, "start": "2026-11-18T22:00:00+05:30", "kind": "NIGHT", "amount": 30 },
    { "index": 3, "start": "2026-11-18T23:00:00+05:30", "kind": "NIGHT", "amount": 30 },
    { "index": 4, "start": "2026-11-19T00:00:00+05:30", "kind": "NIGHT", "amount": 30 },
    { "index": 5, "start": "2026-11-19T01:00:00+05:30", "kind": "NIGHT", "amount": 30 }
  ],
  "windows": [ { "index": 1, "hours": 5, "raw_amount": 140, "cap": 200, "charged": 140, "capped": false } ],
  "total": 140
}
```

| Error | Status | `detail` |
|---|---|---|
| Exit before entry | 422 | `Exit time cannot be before entry time` |
| Unknown vehicle type | 422 | `vehicle_type: Input should be 'BIKE', 'CAR' or 'SUV'` |

## 4. `POST /api/sessions`: vehicle entry

```json
// request (entry_time is optional: a demo override; default = now IST)
{ "vehicle_number": "wb 02 ab 1234", "vehicle_type": "CAR", "entry_time": null }
```

```json
// 201
{
  "id": 1, "vehicle_number": "WB02AB1234", "vehicle_type": "CAR", "slot_code": "C-01",
  "status": "PARKED", "entry_time": "2026-11-18T10:32:00+05:30",
  "exit_time": null, "duration_minutes": null, "billable_hours": null, "amount": null,
  "payment_method": null, "receipt_no": null, "fee_breakdown": null,
  "created_at": "2026-11-18T10:32:00+05:30"
}
```

| Error | Status | `detail` |
|---|---|---|
| Invalid plate | 422 | `Invalid vehicle number format` |
| Already parked | 409 | `Vehicle WB02AB1234 is already parked in slot C-01` |
| Lot full for that type | 409 | `No free slots for Car (30/30 occupied)` |
| `entry_time` more than 1 min ahead of now | 422 | `Entry time cannot be in the future` |

Plates are normalized (uppercase; spaces, dots and hyphens removed) and must match
`^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$` or the Bharat series `^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$`.

## 5. `GET /api/sessions/active`

Parked vehicles, oldest entry first. Each item has the session fields plus live values computed with `now_ist()`:

```json
[
  {
    "id": 24, "vehicle_number": "WB20BK3310", "vehicle_type": "CAR", "slot_code": "C-03",
    "status": "PARKED", "entry_time": "2026-11-14T15:38:01+05:30", "exit_time": null,
    "duration_minutes": null, "billable_hours": null, "amount": null, "payment_method": null,
    "receipt_no": null, "fee_breakdown": null, "created_at": "2026-11-14T22:08:01+05:30",
    "elapsed_minutes": 394, "elapsed_text": "6h 34m", "current_fee": 140
  }
]
```

## 6. `GET /api/sessions/{id}`

One session, parked or completed. A completed session includes `exit_time`, `amount`,
`payment_method`, `receipt_no` and the saved `fee_breakdown` object. Error: `404` `Session 99 not found`.

## 7. `GET /api/sessions/{id}/exit-preview?exit_time=`

What the fee would be if the vehicle left now, or at `exit_time`. Nothing is saved. Encode `+` as
`%2B` in the query string (`URLSearchParams` does this for you).

```json
{
  "session":   { "id": 12, "vehicle_number": "WB02AB1234", "status": "PARKED", "...": "..." },
  "exit_time": "2026-11-19T02:00:00+05:30",
  "breakdown": { "total": 140, "...": "same shape as /api/quote" }
}
```

| Error | Status | `detail` |
|---|---|---|
| Not found | 404 | `Session 12 not found` |
| Already completed | 409 | `Session already completed` |
| `exit_time` before entry | 422 | `Exit time cannot be before entry time` |
| `exit_time` in the future | 422 | `Exit time cannot be in the future` |

## 8. `POST /api/sessions/{id}/exit`

```json
// request (exit_time is optional: a demo override; default = now IST)
{ "payment_method": "UPI", "exit_time": null }
```

```json
// 200 -> the completed session
{
  "id": 12, "vehicle_number": "WB02AB1234", "vehicle_type": "CAR", "slot_code": "C-01",
  "status": "COMPLETED", "entry_time": "2026-01-15T21:00:00+05:30", "exit_time": "2026-01-16T02:00:00+05:30",
  "duration_minutes": 300, "billable_hours": 5, "amount": 140, "payment_method": "UPI",
  "receipt_no": "PK-20260116-0001",
  "fee_breakdown": { "total": 140, "...": "full FeeBreakdown snapshot" },
  "created_at": "2026-11-14T22:08:01+05:30"
}
```

| Error | Status | `detail` |
|---|---|---|
| Not found | 404 | `Session 12 not found` |
| Already completed | 409 | `Session already completed` |
| Exit before entry | 422 | `Exit time cannot be before entry time` |
| Exit time in the future | 422 | `Exit time cannot be in the future` |
| Bad payment method | 422 | `payment_method: Input should be 'CASH' or 'UPI'` |

The receipt number is `PK-{exit date YYYYMMDD}-{exits completed that date + 1, 4 digits}`.

## 9. `GET /api/sessions/history`

Completed sessions, newest exit first. All parameters are optional.

| Parameter | Meaning |
|---|---|
| `date=YYYY-MM-DD` | Only sessions that **exited** on this date. Leave it out to get all dates. |
| `q=` | Any part of the plate (normalized, so `ab 12` matches `WB02AB1234`) |
| `limit=` | Return at most this many rows (1–500). The Dashboard uses `limit=5`. |

Returns a list of completed sessions (same shape as #8).

## 10. `GET /api/stats/today`

```json
{
  "date": "2026-11-18",
  "earnings_today": 1240,
  "earnings_by_method": { "CASH": 800, "UPI": 440 },
  "vehicles_in_today": 23,
  "vehicles_out_today": 17,
  "currently_parked": 6,
  "occupancy": {
    "BIKE": { "parked": 2, "capacity": 20 },
    "CAR":  { "parked": 3, "capacity": 30 },
    "SUV":  { "parked": 1, "capacity": 10 }
  }
}
```

`earnings_today` and `vehicles_out_today` count sessions by **exit date**. `vehicles_in_today` counts by **entry date**.
