from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


class AllocationIn(BaseModel):
    employee_id: int
    project_id: int
    allocation_pct: int = Field(100, ge=10, le=100)
    start_date: Optional[date] = None
    # Leave empty to auto-compute from rate card (role + experience + skills).
    bill_rate: Optional[float] = Field(None, ge=0)


class RoleRateIn(BaseModel):
    base_rate: float = Field(ge=0)
    per_year_rate: float = Field(ge=0)
    max_rate: Optional[float] = Field(None, ge=0)


class TextMatchIn(BaseModel):
    text: str
