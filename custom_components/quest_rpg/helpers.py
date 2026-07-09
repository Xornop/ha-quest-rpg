"""Text parsing helpers shared by the sensors and services.

Item text conventions (kept human-readable so lists stay editable by hand
in the UI if needed):

  Quest:      "<description> (₡<reward>)" - deadline uses the todo item's
              native `due` field, not the text.
  Shop item:  "<name> (₡<price>) (<stock>)"   stock is a number, or "∞"
  Voucher:    "<name> (₡<value>)"
"""
from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any

from homeassistant.util import dt as dt_util

from .const import PRICE_RE, STOCK_RE

URGENT_THRESHOLD_SECONDS = 3600  # inside 1 hour of the deadline = urgent


def extract_price(text: str) -> int:
    match = re.search(PRICE_RE, text)
    return int(match.group(1)) if match else 0


def extract_stock(text: str) -> int | None:
    """Return None for unlimited stock (∞ or missing), else an int."""
    match = re.search(STOCK_RE, text)
    if not match:
        return None
    raw = match.group(1).strip()
    if raw in ("", "∞", "null"):
        return None
    try:
        return int(raw)
    except ValueError:
        return None


def strip_price_and_stock(text: str) -> str:
    """Return the display name with the (₡N) and (stock) suffixes removed."""
    cleaned = re.sub(r"\s*\(₡\d+\)\s*", "", text)
    cleaned = re.sub(r"\s*\([^)]*\)\s*$", "", cleaned)
    return cleaned.strip()


def strip_price_only(text: str) -> str:
    return re.sub(r"\s*\(₡\d+\)[.!?]*\s*$", "", text).strip()


def with_stock(name: str, price: int, stock: int | None) -> str:
    stock_str = "∞" if stock is None else str(stock)
    return f"{name} (₡{price}) ({stock_str})"


def bump_stock(text: str, delta: int) -> str:
    """Return the item text with its stock count adjusted by delta."""
    stock = extract_stock(text)
    if stock is None:
        return text
    new_stock = max(0, stock + delta)
    return re.sub(STOCK_RE, f"({new_stock})", text)


def due_info(due: date | datetime | None, now: datetime) -> dict[str, Any]:
    """Build the per-quest timer metadata block used by the frontend card."""
    if due is None:
        return {
            "has_due": False,
            "timer_text": "",
            "urgent": False,
            "expired": False,
            "diff": None,
        }

    if isinstance(due, datetime):
        due_dt = due if due.tzinfo else dt_util.as_local(due)
    else:
        # A plain date (no time) - treat as end of that day.
        due_dt = dt_util.as_local(
            datetime.combine(due, datetime.max.time().replace(microsecond=0))
        )

    diff = (due_dt - now).total_seconds()
    expired = diff <= 0
    urgent = (not expired) and diff <= URGENT_THRESHOLD_SECONDS

    if expired:
        timer_text = "⚠️ Expired"
    else:
        days, remainder = divmod(int(diff), 86400)
        hours, remainder = divmod(remainder, 3600)
        minutes = remainder // 60
        if days > 0:
            timer_text = f"⏳ {days}d {hours}h"
        elif hours > 0:
            timer_text = f"⏳ {hours}h {minutes}m"
        else:
            timer_text = f"⏳ {minutes}m"

    return {
        "has_due": True,
        "timer_text": timer_text,
        "urgent": urgent,
        "expired": expired,
        "diff": diff,
    }
