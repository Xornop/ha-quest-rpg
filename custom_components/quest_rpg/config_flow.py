"""Config flow for Quest RPG.

Every config entry represents ONE player. Add the integration again to add
another player - each gets its own set of entities (gold, quests, shop,
vouchers), fully isolated by the config entry's unique_id (a slug of the
player name).
"""
from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers import selector
from homeassistant.util import slugify

from .const import (
    CONF_AI_TASK_ENTITY_ID,
    CONF_PLAYER_NAME,
    CONF_QUEST_CUSTOM_INSTRUCTIONS,
    CONF_QUEST_LANGUAGE,
    CONF_WHEEL_COST,
    CONF_WHEEL_MAX_SPINS,
    CONF_WHEEL_WINDOW_END,
    CONF_WHEEL_WINDOW_START,
    DEFAULT_QUEST_CUSTOM_INSTRUCTIONS,
    DEFAULT_QUEST_LANGUAGE,
    DEFAULT_WHEEL_COST,
    DEFAULT_WHEEL_MAX_SPINS,
    DEFAULT_WHEEL_WINDOW_END,
    DEFAULT_WHEEL_WINDOW_START,
    DOMAIN,
)


def _options_schema(defaults: dict[str, Any]) -> vol.Schema:
    return vol.Schema(
        {
            vol.Optional(
                CONF_AI_TASK_ENTITY_ID,
                default=defaults.get(CONF_AI_TASK_ENTITY_ID, ""),
            ): selector.EntitySelector(
                selector.EntitySelectorConfig(domain="ai_task")
            ),
            vol.Optional(
                CONF_QUEST_LANGUAGE,
                default=defaults.get(CONF_QUEST_LANGUAGE, DEFAULT_QUEST_LANGUAGE),
            ): str,
            vol.Optional(
                CONF_QUEST_CUSTOM_INSTRUCTIONS,
                default=defaults.get(
                    CONF_QUEST_CUSTOM_INSTRUCTIONS,
                    DEFAULT_QUEST_CUSTOM_INSTRUCTIONS,
                ),
            ): selector.TextSelector(
                selector.TextSelectorConfig(
                    multiline=True, type=selector.TextSelectorType.TEXT
                )
            ),
            vol.Optional(
                CONF_WHEEL_COST,
                default=defaults.get(CONF_WHEEL_COST, DEFAULT_WHEEL_COST),
            ): vol.Coerce(int),
            vol.Optional(
                CONF_WHEEL_MAX_SPINS,
                default=defaults.get(CONF_WHEEL_MAX_SPINS, DEFAULT_WHEEL_MAX_SPINS),
            ): vol.Coerce(int),
            vol.Optional(
                CONF_WHEEL_WINDOW_START,
                default=defaults.get(
                    CONF_WHEEL_WINDOW_START, DEFAULT_WHEEL_WINDOW_START
                ),
            ): selector.TimeSelector(),
            vol.Optional(
                CONF_WHEEL_WINDOW_END,
                default=defaults.get(CONF_WHEEL_WINDOW_END, DEFAULT_WHEEL_WINDOW_END),
            ): selector.TimeSelector(),
        }
    )


class QuestRpgConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle the initial setup of a player."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.FlowResult:
        errors: dict[str, str] = {}

        if user_input is not None:
            name = user_input[CONF_PLAYER_NAME].strip()
            slug = slugify(name)

            if not slug:
                errors[CONF_PLAYER_NAME] = "invalid_name"
            else:
                await self.async_set_unique_id(slug)
                self._abort_if_unique_id_configured()

                options = {k: v for k, v in user_input.items() if k != CONF_PLAYER_NAME}
                return self.async_create_entry(
                    title=name,
                    data={CONF_PLAYER_NAME: name},
                    options=options,
                )

        schema = vol.Schema({vol.Required(CONF_PLAYER_NAME): str}).extend(
            _options_schema({}).schema
        )
        return self.async_show_form(
            step_id="user", data_schema=schema, errors=errors
        )

    @staticmethod
    @callback
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry,
    ) -> QuestRpgOptionsFlow:
        return QuestRpgOptionsFlow(config_entry)


class QuestRpgOptionsFlow(config_entries.OptionsFlow):
    """Allow editing AI Task + wheel settings after setup, per player."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        self._config_entry = config_entry

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.FlowResult:
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        return self.async_show_form(
            step_id="init", data_schema=_options_schema(self._config_entry.options)
        )
