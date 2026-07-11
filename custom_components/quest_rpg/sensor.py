"""Sensor platform for Quest RPG.

Three sensors per player, mirroring what the Lovelace card needs. The state
is just a count; the actual list data lives in the `quests` (and for the
quest sensor, `due`) attribute.
"""
from __future__ import annotations

from datetime import timedelta

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.event import (
    async_track_state_change_event,
    async_track_time_interval,
)
from homeassistant.util import dt as dt_util

from .const import (
    ATTR_DUE,
    ATTR_ENTRY_ID,
    ATTR_PLAYER_NAME,
    ATTR_QUESTS,
    CONF_PLAYER_NAME,
    DOMAIN,
    SUFFIX_QUESTS,
    SUFFIX_SHOP_ITEMS,
    SUFFIX_VOUCHERS,
)
from .helpers import due_info

REFRESH_INTERVAL = timedelta(seconds=30)


class _BaseListSensor(SensorEntity):
    _attr_has_entity_name = True
    _attr_should_poll = False
    _attr_icon = "mdi:scroll"

    def __init__(
        self, entry: ConfigEntry, source_suffix: str, name: str, unique_suffix: str
    ) -> None:
        self._entry = entry
        self._source_suffix = source_suffix
        self._attr_unique_id = f"{entry.entry_id}_{unique_suffix}"
        self._attr_name = name
        self._attr_native_value = 0
        self._attr_extra_state_attributes: dict = {ATTR_QUESTS: []}

    @property
    def device_info(self):
        player_name = self._entry.data[CONF_PLAYER_NAME]
        return {
            "identifiers": {(DOMAIN, self._entry.entry_id)},
            "name": f"Quest RPG - {player_name}",
            "manufacturer": "Xornop",
            "model": "Quest RPG",
        }

    def _source_entity(self):
        return self.hass.data[DOMAIN][self._entry.entry_id]["todo_entities"].get(
            self._source_suffix
        )

    def _texts(self) -> list[str]:
        source = self._source_entity()
        return source.texts if source else []

    def _recompute(self) -> None:
        raise NotImplementedError

    def _base_attrs(self) -> dict:
        return {
            ATTR_ENTRY_ID: self._entry.entry_id,
            ATTR_PLAYER_NAME: self._entry.data[CONF_PLAYER_NAME],
        }

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        self._recompute()

        source = self._source_entity()
        if source is not None and source.entity_id:

            @callback
            def _on_source_update(_event=None) -> None:
                self._recompute()
                self.async_write_ha_state()

            self.async_on_remove(
                async_track_state_change_event(
                    self.hass, [source.entity_id], _on_source_update
                )
            )

        @callback
        def _on_todo_updated(event) -> None:
            if event.data.get("entry_id") != self._entry.entry_id:
                return
            if event.data.get("suffix") != self._source_suffix:
                return
            self._recompute()
            self.async_write_ha_state()

        self.async_on_remove(
            self.hass.bus.async_listen(f"{DOMAIN}_todo_updated", _on_todo_updated)
        )

        self.async_on_remove(
            async_track_time_interval(
                self.hass, self._interval_refresh, REFRESH_INTERVAL
            )
        )

    @callback
    def _interval_refresh(self, _now) -> None:
        self._recompute()
        self.async_write_ha_state()


class ActiveQuestsSensor(_BaseListSensor):
    """Quest list with live due-date/urgency info for the frontend card."""

    _attr_icon = "mdi:sword-cross"

    def _recompute(self) -> None:
        source = self._source_entity()
        items = source.items if source else []
        now = dt_util.now()
        texts = [i.summary for i in items if i.summary]
        due = [due_info(i.due, now) for i in items if i.summary]
        self._attr_native_value = len(texts)
        self._attr_extra_state_attributes = {
            **self._base_attrs(),
            ATTR_QUESTS: texts,
            ATTR_DUE: due,
        }


class ShopItemsSensor(_BaseListSensor):
    """Passthrough of the shop items todo list, count as state."""

    _attr_icon = "mdi:store"

    def _recompute(self) -> None:
        texts = self._texts()
        self._attr_native_value = len(texts)
        self._attr_extra_state_attributes = {**self._base_attrs(), ATTR_QUESTS: texts}


class VouchersSensor(_BaseListSensor):
    """Passthrough of the purchased-vouchers todo list."""

    _attr_icon = "mdi:ticket-confirmation"

    def _recompute(self) -> None:
        texts = self._texts()
        self._attr_native_value = len(texts)
        self._attr_extra_state_attributes = {**self._base_attrs(), ATTR_QUESTS: texts}


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    quests = ActiveQuestsSensor(entry, SUFFIX_QUESTS, "Quests", "quests_attributes")
    shop = ShopItemsSensor(
        entry, SUFFIX_SHOP_ITEMS, "Shop items", "shop_items_attributes"
    )
    vouchers = VouchersSensor(
        entry, SUFFIX_VOUCHERS, "Vouchers", "vouchers_attributes"
    )

    hass.data[DOMAIN][entry.entry_id]["sensor_entities"] = {
        SUFFIX_QUESTS: quests,
        SUFFIX_SHOP_ITEMS: shop,
        SUFFIX_VOUCHERS: vouchers,
    }
    async_add_entities([quests, shop, vouchers])
