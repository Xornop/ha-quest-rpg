"""Constants for the Quest RPG integration."""

DOMAIN = "quest_rpg"
PLATFORMS = ["number", "todo", "text", "sensor"]

# Config / options keys
CONF_PLAYER_NAME = "player_name"
CONF_AI_TASK_ENTITY_ID = "ai_task_entity_id"
CONF_QUEST_LANGUAGE = "quest_language"
CONF_WHEEL_COST = "wheel_cost"
CONF_WHEEL_MAX_SPINS = "wheel_max_spins"
CONF_WHEEL_WINDOW_START = "wheel_window_start"
CONF_WHEEL_WINDOW_END = "wheel_window_end"

DEFAULT_QUEST_LANGUAGE = "English"
DEFAULT_WHEEL_MAX_SPINS = 3
DEFAULT_WHEEL_COST = 10
DEFAULT_WHEEL_PRIZES = [0, 5, 10, 15, 20, 30]
DEFAULT_WHEEL_WINDOW_START = "18:30:00"
DEFAULT_WHEEL_WINDOW_END = "19:30:00"

# Runtime storage keys (hass.data[DOMAIN][entry_id][...])
DATA_TODO_ENTITIES = "todo_entities"
DATA_NUMBER_ENTITIES = "number_entities"

# Entity unique_id suffixes
SUFFIX_GOLD = "gold"
SUFFIX_WHEEL_SPINS = "wheel_spins_today"
SUFFIX_QUESTS = "quests"
SUFFIX_SHOP_ITEMS = "shop_items"
SUFFIX_VOUCHERS = "vouchers"
SUFFIX_NEW_TASK = "new_task"

# Attributes exposed on the quest/shop/voucher sensors
ATTR_QUESTS = "quests"
ATTR_DUE = "due"
ATTR_ENTRY_ID = "entry_id"
ATTR_PLAYER_NAME = "player_name"

# Services
SERVICE_ADD_TASK = "add_task"
SERVICE_COMPLETE_QUEST = "complete_quest"
SERVICE_SPIN_WHEEL = "spin_wheel"
SERVICE_BUY_ITEM = "buy_item"
SERVICE_SELL_VOUCHER = "sell_voucher"
SERVICE_REDEEM_VOUCHER = "redeem_voucher"
SERVICE_ADD_GOLD = "add_gold"
SERVICE_ADD_SHOP_ITEM = "add_shop_item"
SERVICE_REMOVE_SHOP_ITEM = "remove_shop_item"
SERVICE_UPDATE_SHOP_ITEM = "update_shop_item"

ATTR_CONFIG_ENTRY_ID = "config_entry_id"
ATTR_QUEST_TEXT = "quest_text"
ATTR_ITEM_TEXT = "item_text"
ATTR_VOUCHER_TEXT = "voucher_text"
ATTR_AMOUNT = "amount"
ATTR_TASK_TEXT = "task_text"
ATTR_FULL_REFUND = "full_refund"
ATTR_ITEM_NAME = "name"
ATTR_ITEM_EMOJI = "emoji"
ATTR_ITEM_PRICE = "price"
ATTR_ITEM_STOCK = "stock"

# Item text convention: "<name> (₡<price>) (<stock|empty>)" for shop items.
# Quests carry their gold reward the same way: "<description> (₡<reward>)".
# The deadline, if any, lives in the todo item's native `due` field - not in
# the text - since the `todo` integration already supports that natively.
PRICE_RE = r"₡(\d+)"
STOCK_RE = r"\(([^₡)]+)\)\s*$"
