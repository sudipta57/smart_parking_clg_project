"""API tests (PRD section 11, step 5). Each test starts with an empty lot."""

import re
from datetime import timedelta

from app.timeutils import now_ist, to_iso_ist

# A fixed date safely in the past, so demo entry times are never "in the future".
CASE9_ENTRY = "2026-01-15T21:00:00+05:30"
CASE9_EXIT = "2026-01-16T02:00:00+05:30"


def enter(client, plate, vehicle_type="CAR", entry_time=None):
    """POST a vehicle entry and return the response."""
    return client.post(
        "/api/sessions",
        json={"vehicle_number": plate, "vehicle_type": vehicle_type, "entry_time": entry_time},
    )


def hours_ago(hours: float) -> str:
    """ISO timestamp (+05:30) for N hours before now."""
    return to_iso_ist(now_ist() - timedelta(hours=hours))


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_config_has_rate_card(client):
    body = client.get("/api/config").json()
    assert body["rates"]["CAR"] == {"day": 20, "night": 30, "cap": 200}
    assert body["grace_minutes"] == 15
    assert body["capacity"]["BIKE"] == 20


def test_entry_assigns_lowest_slots(client):
    first = enter(client, "wb 02 ab 1234")
    assert first.status_code == 201
    body = first.json()
    assert body["slot_code"] == "C-01"
    assert body["vehicle_number"] == "WB02AB1234"
    assert body["status"] == "PARKED"
    assert body["entry_time"].endswith("+05:30")

    second = enter(client, "WB02AB5678")
    assert second.status_code == 201
    assert second.json()["slot_code"] == "C-02"


def test_duplicate_active_plate_is_rejected(client):
    enter(client, "WB02AB1234")
    response = enter(client, "wb-02-ab-1234")
    assert response.status_code == 409
    assert response.json()["detail"] == "Vehicle WB02AB1234 is already parked in slot C-01"


def test_invalid_plate_is_rejected(client):
    response = enter(client, "WB02AB12")
    assert response.status_code == 422
    assert response.json()["detail"] == "Invalid vehicle number format"


def test_future_entry_time_is_rejected(client):
    response = enter(client, "WB02AB1234", entry_time=hours_ago(-1))
    assert response.status_code == 422
    assert response.json()["detail"] == "Entry time cannot be in the future"


def test_lot_full_for_type(client):
    for n in range(20):
        assert enter(client, f"WB01A{n:04d}", "BIKE").status_code == 201
    response = enter(client, "WB01A9999", "BIKE")
    assert response.status_code == 409
    assert response.json()["detail"] == "No free slots for Two-Wheeler (20/20 occupied)"
    # Other types are unaffected.
    assert enter(client, "WB02AB1234", "CAR").status_code == 201


def test_active_list_has_fee_so_far(client):
    enter(client, "WB02AB1234", entry_time=hours_ago(2.5))
    enter(client, "WB02AB5678", entry_time=hours_ago(1))
    active = client.get("/api/sessions/active").json()
    assert [s["vehicle_number"] for s in active] == ["WB02AB1234", "WB02AB5678"]  # oldest first
    assert active[0]["elapsed_minutes"] == 150
    assert active[0]["elapsed_text"] == "2h 30m"
    assert active[0]["current_fee"] > 0


def test_exit_preview_with_fixed_exit_time(client):
    session_id = enter(client, "WB02AB1234", entry_time=CASE9_ENTRY).json()["id"]
    response = client.get(
        f"/api/sessions/{session_id}/exit-preview", params={"exit_time": CASE9_EXIT}
    )
    assert response.status_code == 200
    breakdown = response.json()["breakdown"]
    assert breakdown["total"] == 140
    assert breakdown["day_hours"] == 1 and breakdown["night_hours"] == 4
    assert breakdown["blocks"][0]["start"] == CASE9_ENTRY
    # Preview saves nothing.
    assert client.get(f"/api/sessions/{session_id}").json()["status"] == "PARKED"


def test_exit_completes_session_and_frees_slot(client):
    session_id = enter(client, "WB02AB1234", entry_time=CASE9_ENTRY).json()["id"]
    enter(client, "WB02AB5678")  # takes C-02

    response = client.post(
        f"/api/sessions/{session_id}/exit",
        json={"payment_method": "UPI", "exit_time": CASE9_EXIT},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "COMPLETED"
    assert re.match(r"^PK-\d{8}-\d{4}$", body["receipt_no"])
    assert body["receipt_no"] == "PK-20260116-0001"
    assert body["amount"] == 140
    assert body["payment_method"] == "UPI"
    assert body["fee_breakdown"]["total"] == 140

    # C-01 is free again, so the next car gets it.
    assert enter(client, "WB06K4521").json()["slot_code"] == "C-01"


def test_exit_twice_is_rejected(client):
    session_id = enter(client, "WB02AB1234", entry_time=hours_ago(1)).json()["id"]
    client.post(f"/api/sessions/{session_id}/exit", json={"payment_method": "CASH"})
    response = client.post(f"/api/sessions/{session_id}/exit", json={"payment_method": "CASH"})
    assert response.status_code == 409
    assert response.json()["detail"] == "Session already completed"


def test_exit_errors(client):
    session_id = enter(client, "WB02AB1234", entry_time=CASE9_ENTRY).json()["id"]

    missing = client.post("/api/sessions/9999/exit", json={"payment_method": "CASH"})
    assert missing.status_code == 404

    bad_method = client.post(f"/api/sessions/{session_id}/exit", json={"payment_method": "CARD"})
    assert bad_method.status_code == 422
    assert isinstance(bad_method.json()["detail"], str)  # readable text, not a list

    before_entry = client.post(
        f"/api/sessions/{session_id}/exit",
        json={"payment_method": "CASH", "exit_time": "2026-01-15T20:00:00+05:30"},
    )
    assert before_entry.status_code == 422
    assert before_entry.json()["detail"] == "Exit time cannot be before entry time"


def test_stats_after_two_exits(client):
    amounts = []
    for plate, hours, method in [("WB02AB1234", 3, "CASH"), ("WB06K4521", 1.5, "UPI")]:
        session_id = enter(client, plate, entry_time=hours_ago(hours)).json()["id"]
        exit_body = client.post(
            f"/api/sessions/{session_id}/exit", json={"payment_method": method}
        ).json()
        amounts.append(exit_body["amount"])
    enter(client, "WB24AF0099", "SUV")

    stats = client.get("/api/stats/today").json()
    assert stats["earnings_today"] == sum(amounts)
    assert stats["earnings_by_method"] == {"CASH": amounts[0], "UPI": amounts[1]}
    assert stats["vehicles_out_today"] == 2
    assert stats["currently_parked"] == 1
    assert stats["occupancy"]["SUV"] == {"parked": 1, "capacity": 10}


def test_history_filters(client):
    session_id = enter(client, "WB02AB1234", entry_time=CASE9_ENTRY).json()["id"]
    client.post(
        f"/api/sessions/{session_id}/exit",
        json={"payment_method": "CASH", "exit_time": CASE9_EXIT},
    )
    assert len(client.get("/api/sessions/history", params={"date": "2026-01-16"}).json()) == 1
    assert client.get("/api/sessions/history", params={"date": "2026-01-15"}).json() == []
    assert len(client.get("/api/sessions/history", params={"q": "ab 12"}).json()) == 1
    assert client.get("/api/sessions/history", params={"q": "ZZ"}).json() == []


def test_quote_case_20(client):
    response = client.post(
        "/api/quote",
        json={
            "vehicle_type": "SUV",
            "entry_time": "2026-11-18T20:00:00+05:30",
            "exit_time": "2026-11-19T01:00:00+05:30",
        },
    )
    assert response.status_code == 200
    assert response.json()["total"] == 195
    assert response.json()["duration_text"] == "5h 0m"


def test_quote_exit_before_entry(client):
    response = client.post(
        "/api/quote",
        json={
            "vehicle_type": "CAR",
            "entry_time": "2026-11-18T10:00:00+05:30",
            "exit_time": "2026-11-18T09:00:00+05:30",
        },
    )
    assert response.status_code == 422
    assert response.json()["detail"] == "Exit time cannot be before entry time"


def test_quote_converts_utc_to_ist(client):
    # 15:30Z = 21:00 IST, 20:30Z = 02:00 IST next day -> same as case 9.
    response = client.post(
        "/api/quote",
        json={
            "vehicle_type": "CAR",
            "entry_time": "2026-11-18T15:30:00Z",
            "exit_time": "2026-11-18T20:30:00Z",
        },
    )
    assert response.json()["total"] == 140
