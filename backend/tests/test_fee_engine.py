"""Tests for the fee engine. The table below is PRD section 4.4, case by case."""

from datetime import datetime, timedelta

import pytest

from app.fee_engine import InvalidTimeRange, calculate_fee, format_duration

BASE_DAY = datetime(2026, 11, 18)


def at(hhmm: str, plus_days: int = 0) -> datetime:
    """Build a datetime on 2026-11-18 (+ N days) from "HH:MM"."""
    hours, minutes = map(int, hhmm.split(":"))
    return BASE_DAY + timedelta(days=plus_days, hours=hours, minutes=minutes)


# (case #, type, entry, exit, expected total, what it proves)
FEE_CASES = [
    (1, "CAR", at("10:00"), at("10:10"), 0, "Grace period"),
    (2, "CAR", at("10:00"), at("10:15"), 0, "Grace boundary is inclusive"),
    (3, "CAR", at("10:00"), at("10:16"), 20, "Just past grace -> 1 full hour"),
    (4, "CAR", at("10:00"), at("11:00"), 20, "Exact hour"),
    (5, "CAR", at("10:00"), at("11:01"), 40, "Round up"),
    (6, "CAR", at("10:00"), at("12:40"), 60, "3 day blocks"),
    (7, "BIKE", at("10:00"), at("12:40"), 30, "Bike rate"),
    (8, "SUV", at("10:00"), at("12:40"), 90, "SUV rate"),
    (9, "CAR", at("21:00"), at("02:00", 1), 140, "1 day + 4 night blocks, crosses midnight"),
    (10, "CAR", at("21:30"), at("23:00"), 50, "Day block then night block"),
    (11, "CAR", at("05:30"), at("07:00"), 50, "Night block then day block"),
    (12, "CAR", at("21:59"), at("22:30"), 20, "Rate decided at block start (day)"),
    (13, "CAR", at("22:00"), at("22:30"), 30, "22:00 is night (inclusive)"),
    (14, "CAR", at("06:00"), at("06:30"), 20, "06:00 is day (night ends exclusive)"),
    (15, "CAR", at("10:00"), at("18:00"), 160, "Under cap"),
    (16, "CAR", at("10:00"), at("21:00"), 200, "Raw 220 -> capped at 200"),
    (17, "CAR", at("08:00"), at("08:00", 1), 200, "Raw 560 -> one capped window"),
    (18, "CAR", at("08:00"), at("08:30", 1), 220, "200 cap + 1 block in window 2"),
    (19, "BIKE", at("10:00"), at("10:00", 2), 200, "Two capped windows"),
    (20, "SUV", at("20:00"), at("01:00", 1), 195, "2x30 + 3x45"),
    (21, "CAR", at("10:00"), at("10:00"), 0, "Zero duration"),
]


@pytest.mark.parametrize(
    "case_no, vehicle_type, entry, exit_, expected, reason",
    FEE_CASES,
    ids=[f"case{c[0]:02d}-{c[5]}" for c in FEE_CASES],
)
def test_fee_table(case_no, vehicle_type, entry, exit_, expected, reason):
    result = calculate_fee(vehicle_type, entry, exit_)
    assert result.total == expected, f"Case {case_no} ({reason})"


def test_case9_block_counts():
    result = calculate_fee("CAR", at("21:00"), at("02:00", 1))
    assert result.billable_hours == 5
    assert result.day_hours == 1
    assert result.night_hours == 4


def test_case16_window_is_capped():
    result = calculate_fee("CAR", at("10:00"), at("21:00"))
    assert result.windows[0].raw_amount == 220
    assert result.windows[0].capped is True


def test_case18_second_window():
    result = calculate_fee("CAR", at("08:00"), at("08:30", 1))
    assert len(result.windows) == 2
    assert result.windows[1].charged == 20


def test_grace_breakdown_has_no_blocks():
    result = calculate_fee("CAR", at("10:00"), at("10:10"))
    assert result.grace_applied is True
    assert result.billable_hours == 0
    assert result.blocks == [] and result.windows == []


def test_seconds_are_truncated():
    # 15 min 59 s is still 15 whole minutes -> inside grace.
    entry = at("10:00")
    result = calculate_fee("CAR", entry, entry + timedelta(minutes=15, seconds=59))
    assert result.duration_minutes == 15
    assert result.total == 0


def test_exit_before_entry_raises():
    with pytest.raises(InvalidTimeRange):
        calculate_fee("CAR", at("10:00"), at("09:59"))


def test_unknown_vehicle_type_raises():
    with pytest.raises(ValueError):
        calculate_fee("TRUCK", at("10:00"), at("11:00"))


@pytest.mark.parametrize(
    "minutes, text",
    [(0, "0m"), (10, "10m"), (60, "1h 0m"), (160, "2h 40m"), (1470, "1d 0h 30m")],
)
def test_format_duration(minutes, text):
    assert format_duration(minutes) == text
