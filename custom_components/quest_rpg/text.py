"""Text platform for Quest RPG: the 'type a new task here' input.

Setting this entity's value (e.g. from the quests card, a voice assistant,
or an automation) kicks off AI quest generation for that text and adds the
result straight to the player's quest list. The field clears itself once
done (or on failure, so it never gets stuck).
"""
from __future__ import annotations

import logging

from homeassistant.components.text import TextEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.restore_state import RestoreEntity

from .const import (
    CONF_AI_TASK_ENTITY_ID,
    CONF_PLAYER_NAME,
    CONF_QUEST_CUSTOM_INSTRUCTIONS,
    CONF_QUEST_LANGUAGE,
    DEFAULT_QUEST_CUSTOM_INSTRUCTIONS,
    DEFAULT_QUEST_LANGUAGE,
    DOMAIN,
    SUFFIX_NEW_TASK,
    SUFFIX_QUESTS,
)
from .quest_ai import QuestAiError, generate_quest

_LOGGER = logging.getLogger(__name__)


class NewTaskTextEntity(TextEntity, RestoreEntity):
    _attr_has_entity_name = True
    _attr_should_poll = False
    _attr_icon = "mdi:script-text-outline"
    _attr_mode = "text"
    _attr_native_max = 255

    def __init__(self, entry: ConfigEntry) -> None:
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_{SUFFIX_NEW_TASK}"
        self._attr_name = "New task"
        self._attr_native_value = ""

    @property
    def device_info(self):
        player_name = self._entry.data[CONF_PLAYER_NAME]
        return {
            "identifiers": {(DOMAIN, self._entry.entry_id)},
            "name": f"Quest RPG - {player_name}",
            "manufacturer": "Xornop",
            "model": "Quest RPG",
        }

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last_state = await self.async_get_last_state()
        if last_state is not None and last_state.state not in (
            "unknown",
            "unavailable",
        ):
            self._attr_native_value = last_state.state

    async def async_set_value(self, value: str) -> None:
        self._attr_native_value = value
        self.async_write_ha_state()

        text = value.strip()
        if not text:
            return

        try:
            quest_text, due = await generate_quest(
                self.hass,
                text,
                self._entry.options.get(CONF_AI_TASK_ENTITY_ID) or None,
                self._entry.options.get(
                    CONF_QUEST_LANGUAGE, DEFAULT_QUEST_LANGUAGE
                ),
                self._entry.options.get(
                    CONF_QUEST_CUSTOM_INSTRUCTIONS, DEFAULT_QUEST_CUSTOM_INSTRUCTIONS
                ),
            )
            quests_entity = self.hass.data[DOMAIN][self._entry.entry_id][
                "todo_entities"
            ][SUFFIX_QUESTS]
            quests_entity.add_text_item(quest_text, due=due)
        except QuestAiError as err:
            _LOGGER.error("Quest generation failed for '%s': %s", text, err)
        except HomeAssistantError:
            _LOGGER.exception("Unexpected error generating quest for '%s'", text)
        finally:
            self._attr_native_value = ""
            self.async_write_ha_state()


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    async_add_entities([NewTaskTextEntity(entry)])
