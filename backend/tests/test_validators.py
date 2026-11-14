"""Tests for number-plate normalization and validation (PRD section 5)."""

import pytest

from app.validators import is_valid_plate, normalize_plate


@pytest.mark.parametrize(
    "raw, normalized",
    [
        ("wb 02 ab 1234", "WB02AB1234"),
        ("WB-02-AB-1234", "WB02AB1234"),
        ("DL1C1234", "DL1C1234"),
        ("22BH1234AA", "22BH1234AA"),
    ],
)
def test_valid_plates(raw, normalized):
    plate = normalize_plate(raw)
    assert plate == normalized
    assert is_valid_plate(plate)


@pytest.mark.parametrize("raw", ["WB02AB12", "1234", ""])
def test_invalid_plates(raw):
    assert not is_valid_plate(normalize_plate(raw))


def test_normalize_removes_dots():
    assert normalize_plate("wb.06.k.4521") == "WB06K4521"
