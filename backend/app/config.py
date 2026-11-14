"""All rates, limits and fixed settings for the parking lot.

This is the ONLY place where business numbers live. Every other module
imports from here, so changing a rate means editing one line in this file.
"""

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

# --- Operational settings (not fee rules) ---------------------------------

PAYMENT_METHODS = ("CASH", "UPI")

# A demo entry time may be at most this far ahead of the server clock
# (allows for a small clock difference between the browser and the server).
FUTURE_TOLERANCE_MINUTES = 1

RECEIPT_PREFIX = "PK"          # receipt numbers look like PK-20261118-0001
RECEIPT_SEQ_DIGITS = 4

CORS_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]
