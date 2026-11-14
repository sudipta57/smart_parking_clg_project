# Fee Rules

How the Smart Parking Fee Calculator works out a parking fee. The rules are coded in
[`backend/app/fee_engine.py`](../backend/app/fee_engine.py) and every number comes from
[`backend/app/config.py`](../backend/app/config.py).

## Rates

| Vehicle type | Day rate / hr | Night rate / hr | Daily cap (per 24 h) | Slots |
|---|---|---|---|---|
| Two-Wheeler (`BIKE`) | ₹10 | ₹15 | ₹100 | 20 |
| Car (`CAR`) | ₹20 | ₹30 | ₹200 | 30 |
| SUV / Heavy (`SUV`) | ₹30 | ₹45 | ₹300 | 10 |

- Grace period: **15 minutes**
- Night window: **22:00 to 06:00** (22:00 counts as night, 06:00 counts as day)
- Timezone: **Asia/Kolkata (IST)**. Durations are counted in whole minutes, and leftover seconds are dropped.

## The rules in plain English

1. **Grace period:** if the stay is 15 minutes or less, the fee is ₹0.
2. **Hourly billing, rounded up:** after the grace period, every started hour is billed in full. 16 min = 1 hour, 61 min = 2 hours. The grace period is not subtracted: 16 min bills as 1 full hour.
3. **Rate per hour block:** each hour block is charged at the rate in effect **when that block starts**. A block starting at or after 22:00, or before 06:00, uses the night rate. Otherwise it uses the day rate.
4. **Daily cap:** hour blocks are grouped into 24-hour windows counted from the entry time (blocks 1–24, 25–48, …). Each window's total is capped at the vehicle's daily cap.
5. **Total** = sum of all capped windows.

## Worked example: Car, 21:00 → 02:00 next day

| Block | Starts | Day or night? | Amount |
|---|---|---|---|
| 1 | 21:00 | Day (before 22:00) | ₹20 |
| 2 | 22:00 | Night | ₹30 |
| 3 | 23:00 | Night | ₹30 |
| 4 | 00:00 | Night | ₹30 |
| 5 | 01:00 | Night | ₹30 |

5 hours fall in one 24-hour window: raw ₹140, cap ₹200, so the cap does not apply. **Total ₹140.**

## Worked example: the daily cap, Car, 08:00 → 08:30 next day

24 h 30 m becomes **25 blocks**, starting at 08:00, 09:00, …, 07:00 and 08:00 the next day.

- Window 1 (blocks 1–24): 16 day blocks × ₹20 + 8 night blocks × ₹30 = ₹560, **capped to ₹200**
- Window 2 (block 25, which starts at 08:00): 1 day block = ₹20

**Total ₹220.**

## Test cases

All 21 cases are in [`backend/tests/test_fee_engine.py`](../backend/tests/test_fee_engine.py) as a single `@pytest.mark.parametrize` table. All dates are 2026-11-18 unless shown.

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

Extra assertions in the same file:

- Case 9: `billable_hours == 5`, `day_hours == 1`, `night_hours == 4`.
- Case 16: `windows[0].raw_amount == 220`, `windows[0].capped is True`.
- Case 18: `len(windows) == 2`, `windows[1].charged == 20`.
- Exit before entry (CAR, 10:00 → 09:59) raises `InvalidTimeRange`.
- Unknown type `"TRUCK"` raises `ValueError`.
- 15 min 59 s counts as 15 minutes (seconds are truncated), so it is still free.
- `format_duration`: `0 → "0m"`, `10 → "10m"`, `60 → "1h 0m"`, `160 → "2h 40m"`, `1470 → "1d 0h 30m"`.

## Why the engine is a "pure" module

`fee_engine.py` never reads the clock, the database or any file. It takes a vehicle type, an entry
time and an exit time, and returns a `FeeBreakdown`. This means:

- every rule can be tested with fixed times, so the tests give the same result whenever they run;
- the same function is used for the live "fee so far", the exit preview, the final bill, the
  Fee Simulator and the seed data, so the amounts always agree;
- the breakdown (blocks and windows) is what the UI shows, so every rupee can be explained.
