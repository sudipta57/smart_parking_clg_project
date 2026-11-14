"""Pydantic models: the shape of every API request and response."""

import json
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, PlainSerializer, field_validator

from app.timeutils import to_iso_ist

VehicleType = Literal["BIKE", "CAR", "SUV"]
PaymentMethod = Literal["CASH", "UPI"]

# A datetime that is always sent to the client as ISO 8601 with "+05:30".
ISTDateTime = Annotated[datetime, PlainSerializer(to_iso_ist, return_type=str)]


# --- Fee breakdown (mirrors the dataclasses in fee_engine.py) --------------

class BlockOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    index: int
    start: ISTDateTime
    kind: str
    amount: int


class WindowOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    index: int
    hours: int
    raw_amount: int
    cap: int
    charged: int
    capped: bool


class FeeBreakdownOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    vehicle_type: str
    duration_minutes: int
    duration_text: str
    grace_applied: bool
    billable_hours: int
    day_hours: int
    night_hours: int
    day_rate: int
    night_rate: int
    daily_cap: int
    blocks: list[BlockOut]
    windows: list[WindowOut]
    total: int


# --- Requests ---------------------------------------------------------------

class QuoteRequest(BaseModel):
    vehicle_type: VehicleType
    entry_time: datetime
    exit_time: datetime


class EntryRequest(BaseModel):
    vehicle_number: str
    vehicle_type: VehicleType
    entry_time: datetime | None = None   # demo override; default = now (IST)


class ExitRequest(BaseModel):
    payment_method: PaymentMethod
    exit_time: datetime | None = None    # demo override; default = now (IST)


# --- Responses --------------------------------------------------------------

class SessionOut(BaseModel):
    """A parking session as stored, with times in IST."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    vehicle_number: str
    vehicle_type: str
    slot_code: str
    status: str
    entry_time: ISTDateTime
    exit_time: ISTDateTime | None = None
    duration_minutes: int | None = None
    billable_hours: int | None = None
    amount: int | None = None
    payment_method: str | None = None
    receipt_no: str | None = None
    fee_breakdown: dict | None = None
    created_at: ISTDateTime | None = None

    @field_validator("fee_breakdown", mode="before")
    @classmethod
    def parse_breakdown(cls, value):
        """The DB stores the breakdown as JSON text; send it as an object."""
        if isinstance(value, str):
            return json.loads(value)
        return value


class ActiveSessionOut(SessionOut):
    """A parked vehicle plus how long it has been here and the fee so far."""

    elapsed_minutes: int
    elapsed_text: str
    current_fee: int


class ExitPreviewOut(BaseModel):
    """What the fee would be if the vehicle left at `exit_time`."""

    session: SessionOut
    exit_time: ISTDateTime
    breakdown: FeeBreakdownOut


class OccupancyOut(BaseModel):
    parked: int
    capacity: int


class StatsOut(BaseModel):
    date: date
    earnings_today: int
    earnings_by_method: dict[str, int]
    vehicles_in_today: int
    vehicles_out_today: int
    currently_parked: int
    occupancy: dict[str, OccupancyOut]
