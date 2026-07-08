<p align="center">
  <img src="custom_components/quest_rpg/brand/logo.png" alt="Quest RPG Logo" width="300">
</p>

# Quest RPG for Home Assistant

Turn household chores into an RPG-style quest board: a gold economy, a
reward shop, a fortune wheel, and voucher redemption - all backed by a
proper Home Assistant integration.

Originally built as a single-user Lovelace dashboard; rebuilt here as a
reusable **custom integration + companion Lovelace card**, so it can be
installed via HACS and configured entirely through the UI - no YAML
helpers, no manual template sensors, no hardcoded names.

## What you get

- **One config entry per player.** Add the integration once per person; each
  gets fully separate gold, quests, shop and vouchers.
- **AI-generated quests**, via Home Assistant's own [AI Task](https://www.home-assistant.io/integrations/ai_task/)
  integration (introduced in HA 2025.7) - works with whatever AI Task entity
  you've already got configured (Google Generative AI, OpenAI, Anthropic,
  Ollama, OpenRouter, ...).
- **A fortune wheel** with a configurable cost, prize table, and a daily
  *time window* during which it's spinnable. This is done so players will 
  think about their quests at least once a day during this window.
  It also has a max amount of spins per day, so players can't keep spinning
  the wheel, since the odds are in the players favor.
- **A reward shop** with stock tracking, and a **voucher system** so
  purchases can be redeemed later (or sold back for half value if it was an
  impulse buy).
- **Four Lovelace cards** matching the original dark parchment/RPG look,
  now fully config-driven instead of hardcoded to one person's entities.

## Requirements

- Home Assistant **2025.7** or newer (for the AI Task integration).
- Some AI Task-capable integration configured (Google Generative AI, OpenAI,
  Anthropic Conversation, Ollama, OpenRouter, etc.)

## Installation

### Via HACS (recommended)

1. HACS → the "⋮" menu → **Custom repositories** → add
   `https://github.com/Xornop/ha-quest-rpg` as type **Integration**.
2. Install "Quest RPG", restart Home Assistant.
3. Settings → Devices & Services → **Add Integration** → search for
   "Quest RPG".

### Manually

Copy `custom_components/quest_rpg` into your Home Assistant `config/custom_components/`
folder and restart.

## Setting up a player

When you add the integration you'll be asked for:

| Field | Description |
|---|---|
| Player name | Anything - this becomes the device/entity names, e.g. "johnny" |
| AI Task entity | Optional. Leave blank to use your HA-wide default AI Task entity. |
| Quest language | The English name for the language quest text should be generated in, e.g. "English" "Dutch" "German" (default: English) |
| Wheel spin cost | Gold cost per spin (default: 10) |
| Max wheel spins per day | How many spins are allowed inside the window (default: 3) |
| Wheel available from / until | The daily time window the wheel can be spun in (default: 18:30-19:30) |

Add the integration again for a second player - names, options, and every
entity are fully independent per entry.

All of this can be changed later via the integration's **Configure** button.

### Entities created per player

- `number.quest_rpg_<player>_gold`
- `number.quest_rpg_<player>_wheel_spins_today`
- `text.quest_rpg_<player>_new_task` - type a plain task in here (or use the card's
  built-in input box) and it gets turned into a quest automatically
- `todo.quest_rpg_<player>_quests`
- `todo.quest_rpg_<player>_shop_items` - add items yourself as
  `Name (₡price) (stock)`, e.g. `🍦 Ice cream trip (₡40) (2)`; use `(∞)`
  or omit the stock group entirely for unlimited stock
- `todo.quest_rpg_<player>_vouchers`
- `sensor.quest_rpg_<player>_quests_attributes` / `..._shop_items_attributes` /
  `..._vouchers_attributes` - what the cards actually read from

## Dashboard cards

The card JS is served automatically once the integration is set up - no
HACS frontend resource step needed. Add cards like this to any dashboard:

```yaml
type: custom:quest-rpg-quests-card
gold_entity: number.quest_rpg_johnny_gold
quests_entity: sensor.quest_rpg_johnny_quests
new_task_entity: text.quest_rpg_johnny_new_task   # optional, adds an input box

type: custom:quest-rpg-shop-card
gold_entity: number.quest_rpg_johnny_gold
shop_entity: sensor.quest_rpg_johnny_shop_items

type: custom:quest-rpg-shop-admin-card
shop_entity: sensor.quest_rpg_johnny_shop_items   # used to resolve which player
# a small form (emoji / name / price / stock) that calls quest_rpg.add_shop_item

type: custom:quest-rpg-vouchers-card
vouchers_entity: sensor.quest_rpg_johnny_vouchers

type: custom:quest-rpg-wheel-card
gold_entity: number.quest_rpg_johnny_gold
spins_entity: number.quest_rpg_johnny_wheel_spins_today
prizes: [0, 5, 10, 15, 20, 30]
```

`entry_id` is picked up automatically from the sensor/number entities'
attributes, so you don't need to look it up yourself.

## Services

All state changes go through services (called by the cards, or usable
directly from your own automations/scripts):

- `quest_rpg.add_task` - `config_entry_id`, `task_text` → AI-generate a quest
- `quest_rpg.complete_quest` - `config_entry_id`, `quest_text` → pay out + remove
- `quest_rpg.spin_wheel` - `config_entry_id`
- `quest_rpg.buy_item` - `config_entry_id`, `item_text`
- `quest_rpg.sell_voucher` - `config_entry_id`, `voucher_text` (50% refund)
- `quest_rpg.redeem_voucher` - `config_entry_id`, `voucher_text` (full redeem)
- `quest_rpg.add_gold` - `config_entry_id`, `amount` (can be negative)


## License

MIT - see [LICENSE](LICENSE).
