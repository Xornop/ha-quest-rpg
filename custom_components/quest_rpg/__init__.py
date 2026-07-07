"""The Quest RPG integration.

Turns household chores into an RPG-style quest board with a gold economy
and a reward shop. One config entry = one player; add the integration
again to set up a second player with fully separate entities.
"""
from __future__ import annotations

import logging
import random
from pathlib import Path

import voluptuous as vol

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.event import async_track_time_change

from .const import (
    ATTR_AMOUNT,
    ATTR_CONFIG_ENTRY_ID,
    ATTR_ITEM_TEXT,
    ATTR_QUEST_TEXT,
    ATTR_TASK_TEXT,
    ATTR_VOUCHER_TEXT,
    CONF_AI_TASK_ENTITY_ID,
    CONF_QUEST_LANGUAGE,
    CONF_WHEEL_COST,
    CONF_WHEEL_MAX_SPINS,
    CONF_WHEEL_WINDOW_END,
    CONF_WHEEL_WINDOW_START,
    DEFAULT_QUEST_LANGUAGE,
    DEFAULT_WHEEL_COST,
    DEFAULT_WHEEL_MAX_SPINS,
    DEFAULT_WHEEL_PRIZES,
    DEFAULT_WHEEL_WINDOW_END,
    DEFAULT_WHEEL_WINDOW_START,
    DOMAIN,
    PLATFORMS,
    SERVICE_ADD_GOLD,
    SERVICE_ADD_TASK,
    SERVICE_BUY_ITEM,
    SERVICE_COMPLETE_QUEST,
    SERVICE_REDEEM_VOUCHER,
    SERVICE_SELL_VOUCHER,
    SERVICE_SPIN_WHEEL,
    SUFFIX_GOLD,
    SUFFIX_QUESTS,
    SUFFIX_SHOP_ITEMS,
    SUFFIX_VOUCHERS,
    SUFFIX_WHEEL_SPINS,
)
from .helpers import (
    bump_stock,
    extract_price,
    extract_stock,
    strip_price_and_stock,
    strip_price_only,
)
from .quest_ai import QuestAiError, generate_quest

_LOGGER = logging.getLogger(__name__)

FRONTEND_URL = "/quest_rpg_frontend/quest-rpg-card.js"


async def _async_register_frontend(hass: HomeAssistant) -> None:
    if hass.data[DOMAIN].get("_frontend_registered"):
        return
    hass.data[DOMAIN]["_frontend_registered"] = True

    frontend_path = Path(__file__).parent / "frontend"
    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                "/quest_rpg_frontend", str(frontend_path), cache_headers=False
            )
        ]
    )

    # Cache-bust automatically using the file's mtime, so the browser (and
    # HA's service worker) always fetches a fresh copy after any update -
    # no manual version bump to remember.
    card_file = frontend_path / "quest-rpg-card.js"
    version = int(card_file.stat().st_mtime) if card_file.exists() else 0
    add_extra_js_url(hass, f"{FRONTEND_URL}?v={version}")


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = {}

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(_async_update_listener))

    await _async_register_frontend(hass)
    _async_register_services(hass)
    _schedule_wheel_window(hass, entry)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        for key in ("wheel_start_unsub", "wheel_end_unsub"):
            unsub = hass.data[DOMAIN][entry.entry_id].pop(key, None)
            if unsub:
                unsub()
        hass.data[DOMAIN].pop(entry.entry_id, None)
    return unload_ok


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    # Options (AI Task entity/language, wheel cost/limit/window) are read
    # fresh on every service call - only the wheel window schedule itself
    # needs to be re-armed when its options change.
    _schedule_wheel_window(hass, entry)


def _entry_data(hass: HomeAssistant, entry_id: str) -> dict:
    if entry_id not in hass.data.get(DOMAIN, {}):
        raise HomeAssistantError(f"Unknown Quest RPG config entry: {entry_id}")
    return hass.data[DOMAIN][entry_id]


def _todo(hass: HomeAssistant, entry_id: str, suffix: str):
    return _entry_data(hass, entry_id)["todo_entities"][suffix]


def _gold_entity(hass: HomeAssistant, entry_id: str):
    return _entry_data(hass, entry_id)["number_entities"][SUFFIX_GOLD]


def _spins_entity(hass: HomeAssistant, entry_id: str):
    return _entry_data(hass, entry_id)["number_entities"][SUFFIX_WHEEL_SPINS]


async def _add_gold(hass: HomeAssistant, entry_id: str, amount: float) -> float:
    gold = _gold_entity(hass, entry_id)
    new_value = max(0, (gold.native_value or 0) + amount)
    await gold.async_set_native_value(new_value)
    return new_value


async def _do_add_task(hass: HomeAssistant, entry_id: str, task_text: str) -> None:
    """Shared by the add_task service and the New Task text entity."""
    entry: ConfigEntry = hass.config_entries.async_get_entry(entry_id)
    if entry is None:
        raise HomeAssistantError(f"Unknown config entry: {entry_id}")

    quest_text, due = await generate_quest(
        hass,
        task_text,
        entry.options.get(CONF_AI_TASK_ENTITY_ID) or None,
        entry.options.get(CONF_QUEST_LANGUAGE, DEFAULT_QUEST_LANGUAGE),
    )
    _todo(hass, entry_id, SUFFIX_QUESTS).add_text_item(quest_text, due=due)


def _schedule_wheel_window(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """(Re)arm the two daily jobs that open/close the fortune wheel window."""
    entry_data = hass.data[DOMAIN][entry.entry_id]
    for key in ("wheel_start_unsub", "wheel_end_unsub"):
        unsub = entry_data.pop(key, None)
        if unsub:
            unsub()

    start_str = entry.options.get(CONF_WHEEL_WINDOW_START, DEFAULT_WHEEL_WINDOW_START)
    end_str = entry.options.get(CONF_WHEEL_WINDOW_END, DEFAULT_WHEEL_WINDOW_END)
    max_spins = entry.options.get(CONF_WHEEL_MAX_SPINS, DEFAULT_WHEEL_MAX_SPINS)

    async def _open_window(_now) -> None:
        spins = _spins_entity(hass, entry.entry_id)
        await spins.async_set_native_value(0)

    async def _close_window(_now) -> None:
        spins = _spins_entity(hass, entry.entry_id)
        await spins.async_set_native_value(max_spins)

    start_h, start_m, start_s = (int(p) for p in start_str.split(":"))
    end_h, end_m, end_s = (int(p) for p in end_str.split(":"))

    entry_data["wheel_start_unsub"] = async_track_time_change(
        hass, _open_window, hour=start_h, minute=start_m, second=start_s
    )
    entry_data["wheel_end_unsub"] = async_track_time_change(
        hass, _close_window, hour=end_h, minute=end_m, second=end_s
    )


def _async_register_services(hass: HomeAssistant) -> None:
    if hass.services.has_service(DOMAIN, SERVICE_ADD_TASK):
        return  # services are domain-wide, only register once

    async def handle_add_task(call: ServiceCall) -> None:
        try:
            await _do_add_task(
                hass, call.data[ATTR_CONFIG_ENTRY_ID], call.data[ATTR_TASK_TEXT]
            )
        except QuestAiError as err:
            raise HomeAssistantError(f"Quest generation failed: {err}") from err

    async def handle_complete_quest(call: ServiceCall) -> None:
        entry_id = call.data[ATTR_CONFIG_ENTRY_ID]
        quest_text = call.data[ATTR_QUEST_TEXT]
        quests_entity = _todo(hass, entry_id, SUFFIX_QUESTS)

        reward = extract_price(quest_text) or 10
        quests_entity.remove_text_item(quest_text)
        await _add_gold(hass, entry_id, reward)

    async def handle_spin_wheel(call: ServiceCall) -> None:
        entry_id = call.data[ATTR_CONFIG_ENTRY_ID]
        entry: ConfigEntry = hass.config_entries.async_get_entry(entry_id)

        cost = entry.options.get(CONF_WHEEL_COST, DEFAULT_WHEEL_COST)
        max_spins = entry.options.get(CONF_WHEEL_MAX_SPINS, DEFAULT_WHEEL_MAX_SPINS)
        prizes = DEFAULT_WHEEL_PRIZES

        gold = _gold_entity(hass, entry_id)
        spins = _spins_entity(hass, entry_id)

        if (spins.native_value or 0) >= max_spins:
            raise HomeAssistantError(
                "The wheel isn't available right now (outside its daily window, "
                "or today's spins are used up)"
            )
        if (gold.native_value or 0) < cost:
            raise HomeAssistantError("Not enough gold to spin the wheel")

        prize = random.choice(prizes)
        await _add_gold(hass, entry_id, prize - cost)
        await spins.async_set_native_value((spins.native_value or 0) + 1)

        hass.bus.async_fire(
            f"{DOMAIN}_wheel_result",
            {ATTR_CONFIG_ENTRY_ID: entry_id, "prize": prize, "cost": cost},
        )

    async def handle_buy_item(call: ServiceCall) -> None:
        entry_id = call.data[ATTR_CONFIG_ENTRY_ID]
        item_text = call.data[ATTR_ITEM_TEXT]

        shop_entity = _todo(hass, entry_id, SUFFIX_SHOP_ITEMS)
        vouchers_entity = _todo(hass, entry_id, SUFFIX_VOUCHERS)
        gold = _gold_entity(hass, entry_id)

        price = extract_price(item_text)
        stock = extract_stock(item_text)
        if stock is not None and stock <= 0:
            raise HomeAssistantError("Item is out of stock")
        if (gold.native_value or 0) < price:
            raise HomeAssistantError("Not enough gold")

        name = strip_price_and_stock(item_text)
        await _add_gold(hass, entry_id, -price)
        vouchers_entity.add_text_item(f"{name} (₡{price})")

        if stock is not None:
            shop_entity.rename_text_item(item_text, bump_stock(item_text, -1))

    async def _redeem_voucher_common(
        entry_id: str, voucher_text: str, refund_fraction: float
    ) -> None:
        vouchers_entity = _todo(hass, entry_id, SUFFIX_VOUCHERS)
        shop_entity = _todo(hass, entry_id, SUFFIX_SHOP_ITEMS)

        value = extract_price(voucher_text)
        name = strip_price_only(voucher_text)
        vouchers_entity.remove_text_item(voucher_text)

        if refund_fraction > 0:
            await _add_gold(hass, entry_id, int(value * refund_fraction))
            # put the stock back if this item still exists in the shop
            for item_text in shop_entity.texts:
                if (
                    strip_price_and_stock(item_text) == name
                    and extract_price(item_text) == value
                ):
                    stock = extract_stock(item_text)
                    if stock is not None:
                        shop_entity.rename_text_item(
                            item_text, bump_stock(item_text, 1)
                        )
                    break

    async def handle_sell_voucher(call: ServiceCall) -> None:
        """Sell a voucher back for half its value (impulse-buy undo)."""
        await _redeem_voucher_common(
            call.data[ATTR_CONFIG_ENTRY_ID],
            call.data[ATTR_VOUCHER_TEXT],
            refund_fraction=0.5,
        )

    async def handle_redeem_voucher(call: ServiceCall) -> None:
        """Cash in a voucher in full (the reward has been handed over)."""
        await _redeem_voucher_common(
            call.data[ATTR_CONFIG_ENTRY_ID],
            call.data[ATTR_VOUCHER_TEXT],
            refund_fraction=0.0,
        )

    async def handle_add_gold(call: ServiceCall) -> None:
        await _add_gold(
            hass, call.data[ATTR_CONFIG_ENTRY_ID], call.data[ATTR_AMOUNT]
        )

    entry_id_schema = {vol.Required(ATTR_CONFIG_ENTRY_ID): cv.string}

    hass.services.async_register(
        DOMAIN,
        SERVICE_ADD_TASK,
        handle_add_task,
        schema=vol.Schema({**entry_id_schema, vol.Required(ATTR_TASK_TEXT): cv.string}),
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_COMPLETE_QUEST,
        handle_complete_quest,
        schema=vol.Schema(
            {**entry_id_schema, vol.Required(ATTR_QUEST_TEXT): cv.string}
        ),
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_SPIN_WHEEL,
        handle_spin_wheel,
        schema=vol.Schema(entry_id_schema),
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_BUY_ITEM,
        handle_buy_item,
        schema=vol.Schema({**entry_id_schema, vol.Required(ATTR_ITEM_TEXT): cv.string}),
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_SELL_VOUCHER,
        handle_sell_voucher,
        schema=vol.Schema(
            {**entry_id_schema, vol.Required(ATTR_VOUCHER_TEXT): cv.string}
        ),
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_REDEEM_VOUCHER,
        handle_redeem_voucher,
        schema=vol.Schema(
            {**entry_id_schema, vol.Required(ATTR_VOUCHER_TEXT): cv.string}
        ),
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_ADD_GOLD,
        handle_add_gold,
        schema=vol.Schema(
            {**entry_id_schema, vol.Required(ATTR_AMOUNT): vol.Coerce(float)}
        ),
    )
