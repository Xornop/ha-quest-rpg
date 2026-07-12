"""Turn a plain task into an RPG-flavoured quest using Home Assistant's
built-in AI Task integration (`ai_task.generate_data`).

This deliberately does NOT talk to any AI provider directly - whichever
AI Task entity the user has configured in Home Assistant (Google Generative
AI, OpenAI, Anthropic, or anything else that implements the AI Task
platform) is used, selected either explicitly per player or via HA's system
default.
"""
from __future__ import annotations

import logging
import re
from datetime import datetime

from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.util import dt as dt_util

_LOGGER = logging.getLogger(__name__)

INSTRUCTIONS_TEMPLATE = """You are a fairytale/RPG narrator. Rewrite the \
following everyday household task as a short, atmospheric RPG quest for an \
adventurer.

Rules for the quest text:
- One sentence at most.
- The concrete action must stay crystal clear - don't hide it behind vague \
metaphors.
- Vary the tone: sometimes a dangerous adventure, sometimes a royal duty, \
sometimes a friendly favour.
- Assign a fair gold reward between 1 and 100, based on how tedious or \
time-consuming the task is. If the task already mentions a point or gold \
amount, use that instead.
- Write the quest text in {language}.
- Use natural, clear language - avoid old-fashioned, archaic, or overly \
poetic wording unless the extra instructions below say otherwise.
{custom_instructions_block}
- The reward MUST be the very last thing in the string, formatted exactly \
as "(₡N)" with N a whole number. Do not add a period, exclamation mark, or \
any other character after the closing parenthesis - it must be the last \
character of the string.

Rules for the deadline:
- Look for time references in the task (e.g. "before 10am", "today", \
"tomorrow at 2pm", "within 2 hours").
- Work out the exact target time based on the current time: {now}.
- If there is no specific time or deadline mentioned, leave the deadline \
empty.

Task: {task}"""

STRUCTURE = {
    "quest": {
        "selector": {"text": {}},
        "description": (
            "The rewritten quest text. It MUST end with the gold reward "
            "formatted exactly as (₡N), e.g. 'Slay the dust-dragon under "
            "the bed (₡15)' - the closing parenthesis must be the very "
            "last character, no trailing period or other punctuation."
        ),
        "required": True,
    },
    "due": {
        "selector": {"text": {}},
        "description": (
            "ISO 8601 datetime (YYYY-MM-DDTHH:MM:SS) for the deadline, or "
            "an empty string if the task has no deadline."
        ),
        "required": False,
    },
}


class QuestAiError(HomeAssistantError):
    """Raised when quest generation fails or returns something unusable."""


def _parse_due(raw: str | None) -> datetime | None:
    if not raw or not raw.strip():
        return None
    raw = raw.strip()
    for parser in (
        lambda s: datetime.fromisoformat(s),
        lambda s: datetime.strptime(s, "%Y-%m-%d %H:%M:%S"),
        lambda s: datetime.strptime(s, "%Y-%m-%d"),
    ):
        try:
            parsed = parser(raw)
            return parsed if parsed.tzinfo else dt_util.as_local(parsed)
        except ValueError:
            continue
    _LOGGER.warning("Could not parse due date from AI response: %s", raw)
    return None


async def generate_quest(
    hass: HomeAssistant,
    task_text: str,
    ai_task_entity_id: str | None,
    language: str,
    custom_instructions: str = "",
) -> tuple[str, datetime | None]:
    """Return (quest_text_with_reward, due_datetime_or_none)."""
    custom_instructions = (custom_instructions or "").strip()
    custom_instructions_block = (
        f"- Additional style instructions from the player's household: "
        f"{custom_instructions}"
        if custom_instructions
        else ""
    )
    instructions = INSTRUCTIONS_TEMPLATE.format(
        language=language or "English",
        custom_instructions_block=custom_instructions_block,
        now=dt_util.now().strftime("%Y-%m-%d %H:%M:%S"),
        task=task_text,
    )

    data: dict = {
        "task_name": "Rewrite household task as RPG quest",
        "instructions": instructions,
        "structure": STRUCTURE,
    }
    if ai_task_entity_id:
        data["entity_id"] = ai_task_entity_id

    try:
        result = await hass.services.async_call(
            "ai_task",
            "generate_data",
            data,
            blocking=True,
            return_response=True,
        )
    except HomeAssistantError as err:
        raise QuestAiError(f"AI Task generation failed: {err}") from err

    payload = (result or {}).get("data") or {}
    quest_text = payload.get("quest")
    if not quest_text:
        raise QuestAiError("AI Task returned no quest text")

    quest_text = quest_text.strip()
    # Defensive backstop: some models still tack on a trailing period or
    # similar after the closing parenthesis despite the prompt saying not
    # to - strip it so "(₡N)" is reliably the last thing in the string.
    quest_text = re.sub(r"(\(₡\d+\))[.!?]+$", r"\1", quest_text)
    if "₡" not in quest_text:
        quest_text = f"{quest_text} (₡10)"

    due = _parse_due(payload.get("due"))
    return quest_text, due
