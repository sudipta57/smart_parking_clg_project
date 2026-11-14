"""Indian vehicle registration number (number plate) validation."""

import re

# Standard plate: state (2 letters) + district (1-2 digits)
# + series (0-3 letters) + number (4 digits). Example: WB02AB1234, DL1C1234.
STANDARD_PATTERN = re.compile(r"^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$")

# Bharat (BH) series: year (2 digits) + "BH" + number (4 digits)
# + 1-2 letters. Example: 22BH1234AA.
BHARAT_PATTERN = re.compile(r"^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$")

# Characters people commonly type between the parts of a plate.
SEPARATORS = re.compile(r"[\s.\-]")


def normalize_plate(raw: str) -> str:
    """Uppercase the plate and remove spaces, hyphens and dots.

    "wb 02 ab-1234" -> "WB02AB1234"
    """
    return SEPARATORS.sub("", raw or "").upper()


def is_valid_plate(plate: str) -> bool:
    """Return True if an already-normalized plate matches a known format."""
    return bool(STANDARD_PATTERN.match(plate) or BHARAT_PATTERN.match(plate))
