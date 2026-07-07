"""Number platform for Quest RPG: gold balance + daily wheel-spin counter."""
from __future__ import annotations

from homeassistant.components.number import NumberMode, RestoreNumber
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import (
    ATTR_ENTRY_ID,
    ATTR_PLAYER_NAME,
    CONF_PLAYER_NAME,
    DOMAIN,
    SUFFIX_GOLD,
    SUFFIX_WHEEL_SPINS,
)


class _BaseNumber(RestoreNumber):
    _attr_has_entity_name = True
    _attr_should_poll = False
    _attr_mode = NumberMode.BOX

    def __init__(self, entry: ConfigEntry, suffix: str, name: str, icon: str) -> None:
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_{suffix}"
        self._attr_name = name
        self._attr_icon = icon
        self._attr_native_value = 0

    @property
    def device_info(self):
        player_name = self._entry.data[CONF_PLAYER_NAME]
        return {
            "identifiers": {(DOMAIN, self._entry.entry_id)},
            "name": f"Quest RPG - {player_name}",
            "manufacturer": "Xornop",
            "model": "Quest RPG",
        }

    @property
    def extra_state_attributes(self):
        return {
            ATTR_ENTRY_ID: self._entry.entry_id,
            ATTR_PLAYER_NAME: self._entry.data[CONF_PLAYER_NAME],
        }

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last_data = await self.async_get_last_number_data()
        if last_data is not None and last_data.native_value is not None:
            self._attr_native_value = last_data.native_value

    async def async_set_native_value(self, value: float) -> None:
        self._attr_native_value = value
        self.async_write_ha_state()


class GoldNumber(_BaseNumber):
    """Gold balance. Editable directly, but normally changed via services."""

    _attr_native_min_value = 0
    _attr_native_max_value = 999999
    _attr_native_step = 1
    _attr_icon = "mdi:hand-coin"


class WheelSpinsNumber(_BaseNumber):
    """How many times the fortune wheel has been spun in the current window.

    Reset-to-zero (window opens) and set-to-limit (window closes, blocking
    further spins) are scheduled centrally in __init__.py based on the
    player's configured wheel time window.
    """

    _attr_native_min_value = 0
    _attr_native_max_value = 999
    _attr_native_step = 1
    _attr_icon = "mdi:ferris-wheel"


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    gold = GoldNumber(entry, SUFFIX_GOLD, "Gold", "mdi:hand-coin")
    spins = WheelSpinsNumber(
        entry, SUFFIX_WHEEL_SPINS, "Wheel spins today", "mdi:ferris-wheel"
    )
    hass.data[DOMAIN][entry.entry_id]["number_entities"] = {
        SUFFIX_GOLD: gold,
        SUFFIX_WHEEL_SPINS: spins,
    }
    async_add_entities([gold, spins])
