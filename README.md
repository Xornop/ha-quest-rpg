# Quest RPG for Home Assistant

Turn household chores into an RPG-style quest board: a gold economy, a
reward shop, a fortune wheel, and voucher redemption - all backed by a
proper Home Assistant integration instead of a pile of helpers and Jinja
templates.

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
  Ollama, OpenRouter, ...). Quest RPG doesn't talk to any AI provider
  directly and doesn't need its own API key.
- **A fortune wheel** with a configurable cost, prize table, and a daily
  *time window* during which it's spinnable (mirroring the original design:
  e.g. only playable between 18:30-19:30).
- **A reward shop** with stock tracking, and a **voucher system** so
  purchases can be redeemed later (or sold back for half value if it was an
  impulse buy).
- **Four Lovelace cards** matching the original dark parchment/RPG look,
  now fully config-driven instead of hardcoded to one person's entities.

## Requirements

- Home Assistant **2025.7** or newer (for the AI Task integration).
- Some AI Task-capable integration configured (Google Generative AI, OpenAI,
  Anthropic Conversation, Ollama, OpenRouter, etc.) if you want quests to be
  auto-generated. Without one, you can still add quests manually via the
  `quest_rpg.add_task` service with a plain description - it'll just skip
  the AI flavour text and use a flat default reward.

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
| Player name | Anything - this becomes the device/entity names, e.g. "Liselotte" |
| AI Task entity | Optional. Leave blank to use your HA-wide default AI Task entity. |
| Quest language | The language quest text should be generated in (default: English) |
| Wheel spin cost | Gold cost per spin (default: 10) |
| Max wheel spins per day | How many spins are allowed inside the window (default: 3) |
| Wheel available from / until | The daily time window the wheel can be spun in (default: 18:30-19:30) |

Add the integration again for a second player - names, options, and every
entity are fully independent per entry.

All of this can be changed later via the integration's **Configure** button.

### Entities created per player

- `number.<player>_gold`
- `number.<player>_wheel_spins_today`
- `text.<player>_new_task` - type a plain task in here (or use the card's
  built-in input box) and it gets turned into a quest automatically
- `todo.<player>_quests`
- `todo.<player>_shop_items` - add items yourself as
  `Name (₡price) (stock)`, e.g. `🍦 Ice cream trip (₡40) (2)`; use `(∞)`
  or omit the stock group entirely for unlimited stock
- `todo.<player>_vouchers`
- `sensor.<player>_quests_attributes` / `..._shop_items_attributes` /
  `..._vouchers_attributes` - what the cards actually read from

## Dashboard cards

The card JS is served automatically once the integration is set up - no
HACS frontend resource step needed. Add cards like this to any dashboard:

```yaml
type: custom:quest-rpg-quests-card
gold_entity: number.liselotte_gold
quests_entity: sensor.liselotte_quests_attributes
new_task_entity: text.liselotte_new_task   # optional, adds an input box

type: custom:quest-rpg-shop-card
gold_entity: number.liselotte_gold
shop_entity: sensor.liselotte_shop_items_attributes

type: custom:quest-rpg-vouchers-card
vouchers_entity: sensor.liselotte_vouchers_attributes

type: custom:quest-rpg-wheel-card
gold_entity: number.liselotte_gold
spins_entity: number.liselotte_wheel_spins_today
cost: 10            # keep in sync with your configured wheel cost
max_spins: 3         # keep in sync with your configured max spins
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

## Notes on the redesign

Compared to the original single-file Lovelace dashboard:

- Every `input_number`/`todo.*_user2` helper is now created and owned by the
  integration itself - nothing to set up by hand, nothing named after one
  specific person.
- Quest deadlines use the `todo` platform's native `due` field instead of
  being encoded into the text.
- Gold rewards and shop price/stock still live in the item text (e.g.
  `(₡15)`, `(3)`) - kept human-editable, and it's the one convention the
  original design got right.
- The wheel's "3 spins between 18:30 and 19:30" behaviour is preserved
  exactly, just made configurable instead of hardcoded in an automation.

## License

MIT - see [LICENSE](LICENSE).
