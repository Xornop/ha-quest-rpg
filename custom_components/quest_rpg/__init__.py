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
from homeassistant.util import dt as dt_util

from .const import (
    ATTR_AMOUNT,
    ATTR_CONFIG_ENTRY_ID,
    ATTR_FULL_REFUND,
    ATTR_ITEM_EMOJI,
    ATTR_ITEM_NAME,
    ATTR_ITEM_PRICE,
    ATTR_ITEM_STOCK,
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
    SERVICE_ADD_SHOP_ITEM,
    SERVICE_ADD_TASK,
    SERVICE_BUY_ITEM,
    SERVICE_COMPLETE_QUEST,
    SERVICE_REDEEM_VOUCHER,
    SERVICE_REMOVE_SHOP_ITEM,
    SERVICE_SELL_VOUCHER,
    SERVICE_SPIN_WHEEL,
    SERVICE_UPDATE_SHOP_ITEM,
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
    with_stock,
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
            # cache_headers=True is safe (and desirable) here because the
            # URL itself is version-busted below - a browser cache hit on
            # an old version is impossible, and a cache hit on the current
            # version means the card loads instantly instead of racing
            # Lovelace's dashboard rendering on a slow first fetch.
            StaticPathConfig(
                "/quest_rpg_frontend", str(frontend_path), cache_headers=True
            )
        ]
    )

    # Cache-bust automatically using the file's mtime, so the browser always
    # fetches a fresh copy after any update - no manual version bump needed.
    card_file = frontend_path / "quest-rpg-card.js"
    version = int(card_file.stat().st_mtime) if card_file.exists() else 0
    versioned_url = f"{FRONTEND_URL}?v={version}"

    # Primary path: register as a genuine Lovelace dashboard resource. This
    # is the mechanism every other custom card uses (HACS included), and -
    # unlike add_extra_js_url - Lovelace's own dashboard rendering awaits
    # these before creating any card elements, which avoids a "Custom
    # element not found" race on a slow/first load (seen most often on the
    # mobile app, or the very first page load before anything is cached).
    registered_as_resource = await _async_ensure_lovelace_resource(
        hass, FRONTEND_URL, versioned_url
    )

    # Fallback / belt-and-suspenders: also inject it the old way. Harmless
    # if the resource above already covers it - the card's own registration
    # code no-ops (with a console warning) on a duplicate define().
    if not registered_as_resource:
        _LOGGER.warning(
            "Could not auto-register the Quest RPG dashboard resource "
            "(Lovelace may be in YAML mode). Add it manually: "
            "Settings > Dashboards > Resources > Add Resource > "
            "URL '%s', type 'JavaScript module'.",
            versioned_url,
        )
    add_extra_js_url(hass, versioned_url)


async def _async_ensure_lovelace_resource(
    hass: HomeAssistant, url_prefix: str, versioned_url: str
) -> bool:
    """Create or update our Lovelace resource entry. Returns success.

    The internal shape of hass.data for the lovelace integration has
    changed across HA versions (a plain dict with a "resources" key on
    older cores, a LovelaceData dataclass with a .resources attribute on
    newer ones) - handled defensively here since none of this is a stable
    public API, just the same approach HACS itself uses.
    """
    try:
        from homeassistant.components.lovelace.resources import (
            ResourceStorageCollection,
        )
    except ImportError:
        return False

    try:
        from homeassistant.components.lovelace.const import LOVELACE_DATA

        data_key = LOVELACE_DATA
    except ImportError:
        data_key = "lovelace"  # older HA cores keyed this as a plain string

    lovelace_data = hass.data.get(data_key)
    if lovelace_data is None:
        return False

    resources = (
        lovelace_data.resources
        if hasattr(lovelace_data, "resources")
        else lovelace_data.get("resources")
        if isinstance(lovelace_data, dict)
        else None
    )
    if not isinstance(resources, ResourceStorageCollection):
        return False  # YAML mode (or unrecognized shape) - not writable

    try:
        await resources.async_get_info()  # ensures the collection is loaded
        existing = next(
            (
                item
                for item in resources.async_items()
                if item.get("url", "").split("?")[0] == url_prefix
            ),
            None,
        )
        if existing is None:
            await resources.async_create_item(
                {"res_type": "module", "url": versioned_url}
            )
        elif existing.get("url") != versioned_url:
            await resources.async_update_item(
                existing["id"], {"url": versioned_url}
            )
        return True
    except Exception as err:  # noqa: BLE001 - never block setup on this
        _LOGGER.warning("Could not auto-register Lovelace resource: %s", err)
        return False


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


def _wheel_window_is_open(entry: ConfigEntry) -> bool:
    """Real-time check, independent of whether the daily open/close jobs
    actually fired (e.g. HA was restarted right when one was due - the
    scheduled jobs alone left the spin counter unreliable across a missed
    event, so this is now the authoritative gate)."""
    start_str = entry.options.get(CONF_WHEEL_WINDOW_START, DEFAULT_WHEEL_WINDOW_START)
    end_str = entry.options.get(CONF_WHEEL_WINDOW_END, DEFAULT_WHEEL_WINDOW_END)
    start = dt_util.parse_time(start_str)
    end = dt_util.parse_time(end_str)
    if start is None or end is None:
        return True  # misconfigured - fail open rather than lock the wheel

    now = dt_util.now().time()
    if start <= end:
        return start <= now <= end
    return now >= start or now <= end  # window wraps past midnight


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

        if not _wheel_window_is_open(entry):
            raise HomeAssistantError(
                "The wheel is only available during its configured daily time window"
            )

        gold = _gold_entity(hass, entry_id)
        spins = _spins_entity(hass, entry_id)

        if (spins.native_value or 0) >= max_spins:
            raise HomeAssistantError(
                "The wheel isn't available right now (today's spins are used up)"
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
        """Sell a voucher back. Half value normally, full value for admins."""
        full_refund = call.data.get(ATTR_FULL_REFUND, False)
        await _redeem_voucher_common(
            call.data[ATTR_CONFIG_ENTRY_ID],
            call.data[ATTR_VOUCHER_TEXT],
            refund_fraction=1.0 if full_refund else 0.5,
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

    async def handle_add_shop_item(call: ServiceCall) -> None:
        entry_id = call.data[ATTR_CONFIG_ENTRY_ID]
        name = call.data[ATTR_ITEM_NAME].strip()
        emoji = (call.data.get(ATTR_ITEM_EMOJI) or "").strip() or "🎫"
        price = int(call.data[ATTR_ITEM_PRICE])
        stock = call.data.get(ATTR_ITEM_STOCK)
        stock = int(stock) if stock not in (None, "") else None

        display_name = f"{emoji} {name}".strip()
        item_text = with_stock(display_name, price, stock)
        _todo(hass, entry_id, SUFFIX_SHOP_ITEMS).add_text_item(item_text)

    async def handle_remove_shop_item(call: ServiceCall) -> None:
        entry_id = call.data[ATTR_CONFIG_ENTRY_ID]
        item_text = call.data[ATTR_ITEM_TEXT]
        _todo(hass, entry_id, SUFFIX_SHOP_ITEMS).remove_text_item(item_text)

    async def handle_update_shop_item(call: ServiceCall) -> None:
        entry_id = call.data[ATTR_CONFIG_ENTRY_ID]
        item_text = call.data[ATTR_ITEM_TEXT]
        price = int(call.data[ATTR_ITEM_PRICE])
        stock = call.data.get(ATTR_ITEM_STOCK)
        stock = int(stock) if stock not in (None, "") else None

        shop_entity = _todo(hass, entry_id, SUFFIX_SHOP_ITEMS)
        name = strip_price_and_stock(item_text)
        new_text = with_stock(name, price, stock)
        shop_entity.rename_text_item(item_text, new_text)

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
            {
                **entry_id_schema,
                vol.Required(ATTR_VOUCHER_TEXT): cv.string,
                vol.Optional(ATTR_FULL_REFUND, default=False): cv.boolean,
            }
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
    hass.services.async_register(
        DOMAIN,
        SERVICE_ADD_SHOP_ITEM,
        handle_add_shop_item,
        schema=vol.Schema(
            {
                **entry_id_schema,
                vol.Required(ATTR_ITEM_NAME): cv.string,
                vol.Optional(ATTR_ITEM_EMOJI, default=""): cv.string,
                vol.Required(ATTR_ITEM_PRICE): vol.Coerce(int),
                vol.Optional(ATTR_ITEM_STOCK): vol.Any(vol.Coerce(int), None, ""),
            }
        ),
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_REMOVE_SHOP_ITEM,
        handle_remove_shop_item,
        schema=vol.Schema({**entry_id_schema, vol.Required(ATTR_ITEM_TEXT): cv.string}),
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_UPDATE_SHOP_ITEM,
        handle_update_shop_item,
        schema=vol.Schema(
            {
                **entry_id_schema,
                vol.Required(ATTR_ITEM_TEXT): cv.string,
                vol.Required(ATTR_ITEM_PRICE): vol.Coerce(int),
                vol.Optional(ATTR_ITEM_STOCK): vol.Any(vol.Coerce(int), None, ""),
            }
        ),
    )
