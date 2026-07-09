/**
 * Quest RPG Lovelace cards.
 *
 * Five custom elements, all sharing the same parchment/gold RPG theme:
 *   custom:quest-rpg-quests-card      { gold_entity, quests_entity, hide_add_task? }
 *   custom:quest-rpg-shop-card        { gold_entity, shop_entity }
 *   custom:quest-rpg-shop-admin-card  { shop_entity }
 *   custom:quest-rpg-vouchers-card    { vouchers_entity, admin? }
 *   custom:quest-rpg-wheel-card       { gold_entity, spins_entity, cost?, prizes?, max_spins? }
 *
 * Every write goes through the quest_rpg.* services - no direct entity
 * mutation, so there is one source of truth in Python. cost/prizes/max_spins
 * on the wheel card are read live from the spins entity's attributes (kept
 * in sync with the integration's options); the config fields are only an
 * optional manual override.
 */

const THEME = `
  :host { display: block; }
  .qr-card { background: #1A0E06; border: 1px solid #5A3018; border-radius: 14px; overflow: hidden; font-family: Roboto, sans-serif; }
  .qr-header { background: #2C1810; border-bottom: 1px solid #5A3018; padding: 20px 18px 18px; position: relative; overflow: hidden; text-align: center; }
  .qr-header::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 2px; background: #C9860A; }
  .qr-header-icon { font-size: 28px; display: block; margin-bottom: 6px; }
  .qr-header-title { font-size: 15px; font-weight: 500; color: #F5D78E; letter-spacing: 0.04em; }
  .qr-header-sub { font-size: 12px; color: #A07848; margin-top: 4px; }
  .qr-gold { position: absolute; top: 12px; left: 14px; display: flex; align-items: center; gap: 5px; background: #3A1A08; border: 1px solid #C9860A; border-radius: 99px; padding: 4px 10px 4px 7px; }
  .qr-gold-amount { font-size: 12px; font-weight: 500; color: #F5D78E; }
  .qr-body { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 8px; }
  .qr-div { font-size: 11px; text-align: center; color: #6B3D1E; letter-spacing: 6px; margin: 2px 0; }
  .qr-item { background: #1E1208; border: 1px solid #5A3018; border-radius: 10px; padding: 14px 16px; display: flex; align-items: center; gap: 14px; cursor: pointer; border-left: 3px solid #C9860A; position: relative; overflow: hidden; }
  .qr-item.urgent { border-left-color: #C93030; }
  .qr-item.disabled { opacity: 0.4; cursor: not-allowed; border-left-color: #5A3018; }
  .qr-n { width: 32px; height: 32px; border-radius: 50%; background: #3A1A08; border: 1px solid #8B5A2B; display: flex; align-items: center; justify-content: center; font-size: 13px; color: #F5D78E; flex-shrink: 0; }
  .qr-t { font-size: 13px; font-weight: 500; color: #F0C060; line-height: 1.5; }
  .qr-s { font-size: 11px; color: #7A5530; margin-top: 4px; }
  .qr-b { font-size: 10px; padding: 2px 8px; border-radius: 99px; background: #3A1A08; border: 0.5px solid #8B5A2B; color: #C9860A; margin-left: 6px; }
  .qr-timer { font-size: 10px; padding: 2px 8px; border-radius: 99px; background: #1A2E1A; border: 0.5px solid #3A8C3A; color: #4CAF50; margin-left: 6px; }
  .qr-timer.urgent { background: #2E1A1A; border-color: #C93030; color: #C93030; }
  .qr-empty { text-align: center; padding: 18px 0 10px; color: #3A8C3A; font-size: 13px; }
  .qr-btn { font-size: 11px; padding: 5px 12px; border-radius: 99px; background: #1A2E1A; border: 1px solid #3A8C3A; color: #4CAF50; cursor: pointer; white-space: nowrap; flex-shrink: 0; }
  .qr-btn-sell { background: #3A1A08; border-color: #8B5A2B; color: #C9860A; margin-left: 6px; }
  .qr-badge-red { font-size: 10px; padding: 2px 8px; border-radius: 99px; background: #2E1010; border: 0.5px solid #C93030; color: #C93030; }
  .qr-add-row { display: flex; gap: 8px; padding: 4px 2px 10px; }
  .qr-add-input { flex: 1; background: #1E1208; border: 1px solid #5A3018; border-radius: 8px; color: #F0C060; padding: 8px 10px; font-size: 13px; font-family: inherit; }
  .qr-add-input::placeholder { color: #7A5530; }
  .qr-add-btn { background: #C9860A; border: none; border-radius: 8px; color: #1A0E06; font-weight: bold; padding: 0 14px; cursor: pointer; }
  .qr-add-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .qr-shopadmin-form { display: flex; flex-wrap: wrap; gap: 8px; padding: 4px 2px 4px; }
  .qr-shopadmin-emoji { flex: 0 0 56px; text-align: center; }
  .qr-shopadmin-name { flex: 1 1 160px; min-width: 120px; }
  .qr-shopadmin-num { flex: 0 0 110px; }
`;

const VINE_HEADER =
  '<svg style="position:absolute;top:0;left:0;width:100px;height:90px;pointer-events:none;" viewBox="0 0 100 90"><path d="M0 0 Q25 15 30 38 Q34 58 22 75" fill="none" stroke="#2D6A2D" stroke-width="2" stroke-linecap="round"/><path d="M10 12 Q20 8 19 20" fill="none" stroke="#2D6A2D" stroke-width="1.3" stroke-linecap="round"/><path d="M22 34 Q12 30 11 42" fill="none" stroke="#2D6A2D" stroke-width="1.3" stroke-linecap="round"/><path d="M24 54 Q33 50 32 62" fill="none" stroke="#2D6A2D" stroke-width="1.3" stroke-linecap="round"/><ellipse cx="18" cy="19" rx="6" ry="4" fill="#3A8C3A" transform="rotate(20 18 19)"/><ellipse cx="12" cy="39" rx="5.5" ry="3.5" fill="#2D6A2D" transform="rotate(-25 12 39)"/><ellipse cx="31" cy="60" rx="5" ry="3.5" fill="#3A8C3A" transform="rotate(15 31 60)"/><ellipse cx="23" cy="74" rx="4" ry="2.8" fill="#4CAF50" transform="rotate(-10 23 74)" opacity="0.85"/></svg><svg style="position:absolute;top:0;right:0;width:100px;height:90px;pointer-events:none;" viewBox="0 0 100 90"><path d="M100 0 Q75 15 70 38 Q66 58 78 75" fill="none" stroke="#2D6A2D" stroke-width="2" stroke-linecap="round"/><path d="M90 12 Q80 8 81 20" fill="none" stroke="#2D6A2D" stroke-width="1.3" stroke-linecap="round"/><path d="M78 34 Q88 30 89 42" fill="none" stroke="#2D6A2D" stroke-width="1.3" stroke-linecap="round"/><path d="M76 54 Q67 50 68 62" fill="none" stroke="#2D6A2D" stroke-width="1.3" stroke-linecap="round"/><ellipse cx="82" cy="19" rx="6" ry="4" fill="#4CAF50" transform="rotate(-20 82 19)"/><ellipse cx="88" cy="39" rx="5.5" ry="3.5" fill="#2D6A2D" transform="rotate(25 88 39)"/><ellipse cx="69" cy="60" rx="5" ry="3.5" fill="#3A8C3A" transform="rotate(-15 69 60)"/><ellipse cx="77" cy="74" rx="4" ry="2.8" fill="#4CAF50" transform="rotate(10 77 74)" opacity="0.85"/></svg>';

const VINES = [
  '<svg style="position:absolute;top:0;right:0;width:90px;height:80px;pointer-events:none;" viewBox="0 0 90 80"><path d="M90 0 Q70 10 60 25 Q50 38 55 55" fill="none" stroke="#2D6A2D" stroke-width="1.8" stroke-linecap="round"/><path d="M75 8 Q65 5 62 14" fill="none" stroke="#2D6A2D" stroke-width="1.2" stroke-linecap="round"/><path d="M65 20 Q72 15 74 24" fill="none" stroke="#2D6A2D" stroke-width="1.2" stroke-linecap="round"/><path d="M58 36 Q66 34 66 43" fill="none" stroke="#2D6A2D" stroke-width="1.2" stroke-linecap="round"/><ellipse cx="62" cy="13" rx="5" ry="3.5" fill="#3A8C3A" transform="rotate(-30 62 13)"/><ellipse cx="73" cy="23" rx="5" ry="3" fill="#2D6A2D" transform="rotate(20 73 23)"/><ellipse cx="65" cy="41" rx="4.5" ry="3" fill="#3A8C3A" transform="rotate(-15 65 41)"/><ellipse cx="54" cy="54" rx="4" ry="2.5" fill="#4CAF50" transform="rotate(10 54 54)" opacity="0.8"/></svg>',
  '<svg style="position:absolute;top:0;left:0;width:80px;height:75px;pointer-events:none;" viewBox="0 0 80 75"><path d="M0 0 Q18 12 22 30 Q26 46 18 62" fill="none" stroke="#2D6A2D" stroke-width="1.8" stroke-linecap="round"/><path d="M8 10 Q16 7 16 17" fill="none" stroke="#2D6A2D" stroke-width="1.2" stroke-linecap="round"/><path d="M18 26 Q10 22 9 32" fill="none" stroke="#2D6A2D" stroke-width="1.2" stroke-linecap="round"/><path d="M20 44 Q28 42 27 52" fill="none" stroke="#2D6A2D" stroke-width="1.2" stroke-linecap="round"/><ellipse cx="15" cy="16" rx="5" ry="3" fill="#3A8C3A" transform="rotate(20 15 16)"/><ellipse cx="10" cy="30" rx="4.5" ry="3" fill="#2D6A2D" transform="rotate(-25 10 30)"/><ellipse cx="26" cy="50" rx="4" ry="3" fill="#3A8C3A" transform="rotate(15 26 50)"/><ellipse cx="19" cy="61" rx="3.5" ry="2.5" fill="#4CAF50" transform="rotate(-10 19 61)" opacity="0.8"/></svg>',
  '<svg style="position:absolute;top:0;right:0;width:90px;height:80px;pointer-events:none;" viewBox="0 0 90 80"><path d="M90 0 Q70 10 60 25 Q50 38 55 55" fill="none" stroke="#2D6A2D" stroke-width="1.8" stroke-linecap="round"/><path d="M75 8 Q65 5 62 14" fill="none" stroke="#2D6A2D" stroke-width="1.2" stroke-linecap="round"/><path d="M63 22 Q71 18 72 28" fill="none" stroke="#2D6A2D" stroke-width="1.2" stroke-linecap="round"/><ellipse cx="62" cy="13" rx="5" ry="3.5" fill="#4CAF50" transform="rotate(-30 62 13)"/><ellipse cx="71" cy="26" rx="5" ry="3" fill="#2D6A2D" transform="rotate(20 71 26)"/><ellipse cx="54" cy="54" rx="4" ry="2.5" fill="#3A8C3A" transform="rotate(10 54 54)" opacity="0.8"/></svg><svg style="position:absolute;bottom:0;left:0;width:70px;height:60px;pointer-events:none;" viewBox="0 0 70 60"><path d="M0 60 Q15 45 22 30 Q28 18 20 5" fill="none" stroke="#2D6A2D" stroke-width="1.8" stroke-linecap="round"/><path d="M10 50 Q18 52 17 42" fill="none" stroke="#2D6A2D" stroke-width="1.2" stroke-linecap="round"/><path d="M20 32 Q12 28 11 38" fill="none" stroke="#2D6A2D" stroke-width="1.2" stroke-linecap="round"/><ellipse cx="16" cy="43" rx="4.5" ry="3" fill="#3A8C3A" transform="rotate(15 16 43)"/><ellipse cx="12" cy="30" rx="4" ry="3" fill="#4CAF50" transform="rotate(-20 12 30)" opacity="0.9"/><ellipse cx="21" cy="7" rx="3.5" ry="2.5" fill="#2D6A2D" transform="rotate(5 21 7)"/></svg>',
];

function priceOf(text) {
  const m = text.match(/₡(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}
function stockOf(text) {
  const m = text.match(/\(([^₡)]+)\)\s*$/);
  if (!m) return null;
  const raw = m[1].trim();
  if (raw === "" || raw === "∞" || raw === "null") return null;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}
function nameOnly(text) {
  return text.replace(/\s*\(₡\d+\)\s*/, "").replace(/\s*\([^)]*\)\s*$/, "").trim();
}
function firstWord(text) {
  const m = text.match(/^(\S+)/);
  return m ? m[1] : "🎁";
}
function restWords(text) {
  return text.replace(/^\S+\s*/, "");
}
function isWithinWindow(startStr, endStr, now) {
  if (!startStr || !endStr) return true;
  const toMinutes = (s) => {
    const [h, m] = s.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  const start = toMinutes(startStr);
  const end = toMinutes(endStr);
  const cur = now.getHours() * 60 + now.getMinutes();
  if (start <= end) return cur >= start && cur <= end;
  return cur >= start || cur <= end; // window wraps past midnight
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

class QuestRpgBaseCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._lastSig = null;
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    this._config = config;
    this._forceRender();
  }

  set hass(hass) {
    this._hass = hass;
    const sig = this._signature();
    if (sig === this._lastSig) return; // nothing we care about changed - don't touch the DOM
    this._lastSig = sig;
    this._forceRender();
  }

  /** Subclasses can override to include extra fields (e.g. due timers). */
  _signature() {
    const ids = Object.keys(this._config || {}).filter((k) => k.endsWith("_entity"));
    return JSON.stringify(
      ids.map((k) => {
        const e = this._entity(k);
        return e ? [e.entity_id, e.state, e.attributes] : null;
      })
    );
  }

  /** Re-render while preserving every <input>'s value, plus focus/cursor of the active one. */
  _forceRender() {
    const root = this.shadowRoot;
    const previousValues = {};
    root.querySelectorAll("input").forEach((el) => {
      if (el.id) previousValues[el.id] = el.value;
    });

    const active = root.activeElement;
    const isInput = active && active.tagName === "INPUT";
    const savedId = isInput ? active.id : null;
    const savedSelectionStart = isInput ? active.selectionStart : null;
    const savedSelectionEnd = isInput ? active.selectionEnd : null;

    this._render();

    root.querySelectorAll("input").forEach((el) => {
      if (el.id && previousValues[el.id] !== undefined) {
        el.value = previousValues[el.id];
      }
    });

    if (savedId) {
      const restored = root.getElementById(savedId);
      if (restored) {
        restored.focus();
        try {
          restored.setSelectionRange(savedSelectionStart, savedSelectionEnd);
        } catch (_e) {
          // ignore - not all input types support selection ranges
        }
      }
    }
  }

  getCardSize() {
    return 4;
  }

  _entity(key) {
    const id = this._config && this._config[key];
    if (!id || !this._hass) return null;
    return this._hass.states[id] || null;
  }

  _entryId(...entities) {
    for (const e of entities) {
      if (e && e.attributes && e.attributes.entry_id) return e.attributes.entry_id;
    }
    return this._config && this._config.entry_id;
  }

  _callService(service, data) {
    if (!this._hass) return;
    this._hass.callService("quest_rpg", service, data);
  }

  _shell(headerIcon, title, sub, gold, bodyHtml) {
    return `
      <style>${THEME}</style>
      <div class="qr-card">
        <div class="qr-header">
          ${VINE_HEADER}
          ${gold !== null ? `<div class="qr-gold"><span>🪙</span><span class="qr-gold-amount">${gold} ₡</span></div>` : ""}
          <span class="qr-header-icon">${headerIcon}</span>
          <div class="qr-header-title">${title}</div>
          <div class="qr-header-sub">${sub}</div>
        </div>
        <div class="qr-body">${bodyHtml}</div>
      </div>
    `;
  }
}

// ---------------------------------------------------------------------
// Quests card
// ---------------------------------------------------------------------
class QuestRpgQuestsCard extends QuestRpgBaseCard {
  _render() {
    if (!this._hass || !this._config) return;
    const questsEntity = this._entity("quests_entity");
    const goldEntity = this._entity("gold_entity");
    const gold = goldEntity ? Math.round(parseFloat(goldEntity.state) || 0) : null;

    const quests = (questsEntity && questsEntity.attributes.quests) || [];
    const due = (questsEntity && questsEntity.attributes.due) || [];
    const entryId = this._entryId(questsEntity, goldEntity);
    const count = quests.length;

    let addRow = "";
    if (!this._config.hide_add_task) {
      addRow = `
        <div class="qr-add-row">
          <input id="newTaskInput" class="qr-add-input" type="text" placeholder="Add a new task..." />
          <button id="addTaskBtn" class="qr-add-btn">➕ Add</button>
        </div>
        <div id="addTaskMsg" class="qr-s"></div>`;
    }

    let body;
    if (count === 0) {
      body = `<div class="qr-empty">🌿 No quests - rest easy, hero! 🌿</div>`;
    } else {
      body =
        `<div class="qr-div">✦ · · · ✦ · · · ✦</div>` +
        quests
          .map((q, i) => {
            const d = due[i] || { has_due: false, urgent: false, expired: false, timer_text: "" };
            const roman = i < 10 ? ROMAN[i] : String(i + 1);
            const short = q.replace(/\s*\(₡\d+\)[.!?]*\s*$/, "");
            const reward = d.expired ? 1 : priceOf(q);
            return `
              <div class="qr-item ${d.urgent || d.expired ? "urgent" : ""}" data-idx="${i}">
                ${VINES[i % 3]}
                <div class="qr-n">${roman}</div>
                <div style="flex:1;min-width:0;">
                  <div class="qr-t">⚔️ ${short}</div>
                  <div class="qr-s">
                    🗡️ Tap to complete
                    <span class="qr-b">${reward > 0 ? `${reward} ₡` : ""}</span>
                    ${d.has_due ? `<span class="qr-timer ${d.urgent || d.expired ? "urgent" : ""}">${d.timer_text}</span>` : ""}
                  </div>
                </div>
              </div>`;
          })
          .join("") +
        `<div class="qr-div">✦ · · · ✦ · · · ✦</div>`;
    }

    this.shadowRoot.innerHTML = this._shell(
      count > 0 ? "⚔️" : "🛡️",
      "📜 Active Quests",
      count > 0 ? `✦ ${count} quest${count > 1 ? "s" : ""} open ✦` : "✦ All quests complete ✦",
      gold,
      addRow + body
    );

    this.shadowRoot.querySelectorAll(".qr-item").forEach((el) => {
      el.addEventListener("click", () => {
        const i = parseInt(el.dataset.idx, 10);
        const questText = quests[i];
        const short = questText;
        if (confirm(`Is quest "${short}" complete, Adventurer?`)) {
          this._callService("complete_quest", {
            config_entry_id: entryId,
            quest_text: questText,
          });
        }
      });
    });

    const input = this.shadowRoot.getElementById("newTaskInput");
    const addBtn = this.shadowRoot.getElementById("addTaskBtn");
    const msg = this.shadowRoot.getElementById("addTaskMsg");
    if (input && addBtn) {
      const submit = () => {
        const value = input.value.trim();
        if (!value) return;
        if (!entryId) {
          if (msg) msg.textContent = "⚠️ Card misconfigured: no entry_id found on quests_entity/gold_entity.";
          console.error("[quest-rpg] add_task: could not resolve entryId - check card config");
          return;
        }
        addBtn.disabled = true;
        if (msg) msg.textContent = "⏳ Generating quest...";
        this._hass
          .callService("quest_rpg", "add_task", {
            config_entry_id: entryId,
            task_text: value,
          })
          .then(() => {
            if (msg) msg.textContent = "";
          })
          .catch((err) => {
            console.error("[quest-rpg] add_task FAILED:", err);
            if (msg) msg.textContent = `❌ Could not add task: ${err && err.message ? err.message : err}`;
            input.value = value; // restore so the user doesn't lose their text
          })
          .finally(() => {
            addBtn.disabled = false;
          });
        input.value = "";
      };
      addBtn.addEventListener("click", submit);
      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") submit();
      });
    }
  }
}

// ---------------------------------------------------------------------
// Shop card
// ---------------------------------------------------------------------
class QuestRpgShopCard extends QuestRpgBaseCard {
  constructor() {
    super();
    this._buyLocks = new Set();
  }

  _render() {
    if (!this._hass || !this._config) return;
    const shopEntity = this._entity("shop_entity");
    const goldEntity = this._entity("gold_entity");
    const gold = goldEntity ? Math.round(parseFloat(goldEntity.state) || 0) : 0;
    const items = (shopEntity && shopEntity.attributes.quests) || [];
    const entryId = this._entryId(shopEntity, goldEntity);

    const enriched = items.map((item) => {
      const prijs = priceOf(item);
      const stock = stockOf(item);
      const outofstock = stock !== null && stock <= 0;
      const cantafford = gold < prijs;
      const locked = this._buyLocks.has(item);
      return {
        item,
        prijs,
        stock,
        outofstock,
        cantafford,
        locked,
        disabled: outofstock || cantafford || locked,
      };
    });
    enriched.sort((a, b) => {
      const rank = (e) => (e.outofstock ? 2 : e.cantafford ? 1 : 0);
      const r = rank(a) - rank(b);
      return r !== 0 ? r : a.prijs - b.prijs;
    });

    let body;
    if (items.length === 0) {
      body = `<div class="qr-empty">⏳ The shop is empty</div>`;
    } else {
      body =
        `<div class="qr-div">✦ · · · ✦ · · · ✦</div>` +
        enriched
          .map((e, i) => {
            const naam = nameOnly(e.item);
            const stockLabel = e.outofstock
              ? `<span class="qr-badge-red">✕ Out of stock</span>`
              : e.stock === null
              ? `<span class="qr-b">∞</span>`
              : `<span class="qr-b">${e.stock} available</span>`;
            const buyBadge = e.locked
              ? `<span class="qr-b qr-buy-badge">⏳ Buying...</span>`
              : !e.disabled
              ? `<span class="qr-b qr-buy-badge">🛒 Buy</span>`
              : "";
            return `
              <div class="qr-item ${e.disabled ? "disabled" : ""}" data-idx="${i}">
                ${VINES[i % 3]}
                <div class="qr-n">${firstWord(naam)}</div>
                <div style="flex:1;min-width:0;">
                  <div class="qr-t">${restWords(naam)}</div>
                  <div class="qr-s">🪙 ${e.prijs} ₡ ${stockLabel}</div>
                </div>
                ${buyBadge}
              </div>`;
          })
          .join("") +
        `<div class="qr-div">✦ · · · ✦ · · · ✦</div>`;
    }

    this.shadowRoot.innerHTML = this._shell("🏪", "🛒 Reward Shop", "✦ Spend your hard-earned gold ✦", gold, body);

    this.shadowRoot.querySelectorAll(".qr-item:not(.disabled)").forEach((el) => {
      el.addEventListener("click", () => {
        const i = parseInt(el.dataset.idx, 10);
        const itemText = enriched[i].item;
        if (this._buyLocks.has(itemText)) return;

        this._buyLocks.add(itemText);
        setTimeout(() => this._buyLocks.delete(itemText), 5000);

        // Reflect the lock immediately, don't wait for hass to push new state.
        el.classList.add("disabled");
        const badge = el.querySelector(".qr-buy-badge");
        if (badge) badge.textContent = "⏳ Buying...";

        this._callService("buy_item", {
          config_entry_id: entryId,
          item_text: itemText,
        });
      });
    });
  }
}

// ---------------------------------------------------------------------
// Shop admin card - add new items to the reward shop
// ---------------------------------------------------------------------
class QuestRpgShopAdminCard extends QuestRpgBaseCard {
  _render() {
    if (!this._hass || !this._config) return;
    const entryId = this._entryId(this._entity("shop_entity"), this._entity("gold_entity"));

    const body = `
      <div class="qr-shopadmin-form">
        <input id="itemEmoji" class="qr-add-input qr-shopadmin-emoji" type="text" placeholder="🎁" maxlength="8" />
        <input id="itemName" class="qr-add-input qr-shopadmin-name" type="text" placeholder="Item name..." />
        <input id="itemPrice" class="qr-add-input qr-shopadmin-num" type="number" min="1" placeholder="Price ₡" />
        <input id="itemStock" class="qr-add-input qr-shopadmin-num" type="number" min="0" placeholder="Stock (blank=∞)" />
      </div>
      <button id="addItemBtn" class="qr-add-btn" style="width:100%; padding: 8px 0;">➕ Add item to shop</button>
      <div id="shopAdminMsg" class="qr-s" style="margin-top:6px; text-align:center;"></div>
    `;

    this.shadowRoot.innerHTML = this._shell(
      "🧰",
      "🛠️ Shop Management",
      "✦ Add new reward shop items ✦",
      null,
      body
    );

    const nameInput = this.shadowRoot.getElementById("itemName");
    const emojiInput = this.shadowRoot.getElementById("itemEmoji");
    const priceInput = this.shadowRoot.getElementById("itemPrice");
    const stockInput = this.shadowRoot.getElementById("itemStock");
    const btn = this.shadowRoot.getElementById("addItemBtn");
    const msg = this.shadowRoot.getElementById("shopAdminMsg");

    const submit = () => {
      const name = nameInput.value.trim();
      const price = parseInt(priceInput.value, 10);
      if (!name || !price || price <= 0) {
        msg.textContent = "⚠️ Enter at least a name and a price.";
        return;
      }
      if (!entryId) {
        msg.textContent = "⚠️ Card misconfigured: no entry_id found on shop_entity/gold_entity.";
        console.error("[quest-rpg] add_shop_item: could not resolve entryId - check card config");
        return;
      }

      const data = {
        config_entry_id: entryId,
        name,
        emoji: emojiInput.value.trim(),
        price,
      };
      const stockRaw = stockInput.value.trim();
      if (stockRaw !== "") data.stock = parseInt(stockRaw, 10);

      btn.disabled = true;
      msg.textContent = "⏳ Adding...";
      this._hass
        .callService("quest_rpg", "add_shop_item", data)
        .then(() => {
          msg.textContent = `✅ Added "${name}" to the shop.`;
          nameInput.value = "";
          emojiInput.value = "";
          priceInput.value = "";
          stockInput.value = "";
        })
        .catch((err) => {
          console.error("[quest-rpg] add_shop_item FAILED:", err);
          msg.textContent = `❌ Could not add item: ${err && err.message ? err.message : err}`;
        })
        .finally(() => {
          btn.disabled = false;
        });
    };

    btn.addEventListener("click", submit);
    [nameInput, emojiInput, priceInput, stockInput].forEach((el) => {
      el.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") submit();
      });
    });
  }
}

// ---------------------------------------------------------------------
// Vouchers card
// ---------------------------------------------------------------------
class QuestRpgVouchersCard extends QuestRpgBaseCard {
  _render() {
    if (!this._hass || !this._config) return;
    const vouchersEntity = this._entity("vouchers_entity");
    const vouchers = (vouchersEntity && vouchersEntity.attributes.quests) || [];
    const entryId = this._entryId(vouchersEntity);
    const isAdmin = !!this._config.admin;

    let body;
    if (vouchers.length === 0) {
      body = `<div class="qr-empty">🌿 No pending vouchers</div>`;
    } else {
      body =
        `<div class="qr-div">✦ · · · ✦ · · · ✦</div>` +
        vouchers
          .map((v, i) => {
            const naam = nameOnly(v);
            const waarde = priceOf(v);
            const sellAmount = isAdmin ? waarde : Math.floor(waarde / 2);
            return `
              <div class="qr-item" style="cursor:default;" data-idx="${i}">
                <div class="qr-n">${firstWord(naam)}</div>
                <div style="flex:1;min-width:0;">
                  <div class="qr-t">${restWords(naam)}</div>
                  <div class="qr-s">Value: 🪙 ${waarde} ₡</div>
                </div>
                ${isAdmin ? `<button class="qr-btn" data-action="redeem" data-idx="${i}">✅ Redeem</button>` : ""}
                <button class="qr-btn qr-btn-sell" data-action="sell" data-idx="${i}">↩️ Sell back (${sellAmount} ₡)</button>
              </div>`;
          })
          .join("") +
        `<div class="qr-div">✦ · · · ✦ · · · ✦</div>`;
    }

    this.shadowRoot.innerHTML = this._shell(
      "📋",
      "⚔️ Voucher Management",
      isAdmin ? "✦ Admin mode ✦" : "✦ Pending rewards ✦",
      null,
      body
    );

    this.shadowRoot.querySelectorAll("button[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = parseInt(btn.dataset.idx, 10);
        const service = btn.dataset.action === "redeem" ? "redeem_voucher" : "sell_voucher";
        const data = { config_entry_id: entryId, voucher_text: vouchers[i] };
        if (service === "sell_voucher" && isAdmin) data.full_refund = true;
        this._callService(service, data);
      });
    });
  }
}

// ---------------------------------------------------------------------
// Wheel card
// ---------------------------------------------------------------------
class QuestRpgWheelCard extends QuestRpgBaseCard {
  constructor() {
    super();
    this._spinning = false;
  }

  set hass(hass) {
    const firstRun = !this._hass;
    this._hass = hass;
    if (firstRun) this._subscribe();
    const sig = this._signature();
    if (sig === this._lastSig) return;
    this._lastSig = sig;
    this._forceRender();
  }

  async _subscribe() {
    if (!this._hass || this._unsub) return;
    this._unsub = await this._hass.connection.subscribeEvents((event) => {
      const entryId = this._entryId(this._entity("gold_entity"));
      if (event.data.config_entry_id !== entryId) return;
      this._landOn(event.data.prize, event.data.cost);
    }, "quest_rpg_wheel_result");
  }

  disconnectedCallback() {
    if (this._unsub) this._unsub();
  }

  _render() {
    if (!this._hass || !this._config) return;
    const goldEntity = this._entity("gold_entity");
    const spinsEntity = this._entity("spins_entity");
    const gold = goldEntity ? Math.round(parseFloat(goldEntity.state) || 0) : 0;
    const spinsToday = spinsEntity ? parseInt(spinsEntity.state, 10) || 0 : 0;
    const entryId = this._entryId(goldEntity, spinsEntity);

    // Read cost/prizes/max_spins/window live from the entity (kept in sync
    // with the integration's options); config values, if given, override.
    const attrs = (spinsEntity && spinsEntity.attributes) || {};
    this._cost = this._config.cost ?? attrs.cost ?? 10;
    this._prizes = this._config.prizes ?? attrs.prizes ?? [0, 5, 10, 15, 20, 30];
    this._maxSpins = this._config.max_spins ?? attrs.max_spins ?? 3;
    const windowStart = attrs.window_start;
    const windowEnd = attrs.window_end;
    const windowOpen = isWithinWindow(windowStart, windowEnd, new Date());
    const subText = windowOpen
      ? `✦ ${spinsToday}/${this._maxSpins} spins used today ✦`
      : `✦ Wheel opens at ${(windowStart || "").slice(0, 5)} ✦`;

    if (this.shadowRoot.querySelector("#wheel") && this._built) {
      // already built - only refresh the readouts unless we're mid-spin
      if (!this._spinning) {
        const goldLabel = this.shadowRoot.querySelector("#goldLabel");
        if (goldLabel) goldLabel.textContent = `${gold} ₡`;
        const sub = this.shadowRoot.querySelector(".qr-header-sub");
        if (sub) sub.textContent = subText;
        const btn = this.shadowRoot.getElementById("spin");
        if (btn) btn.disabled = !windowOpen || gold < this._cost || spinsToday >= this._maxSpins;
      }
      return;
    }
    this._built = true;

    const canSpin = !this._spinning && windowOpen && gold >= this._cost && spinsToday < this._maxSpins;
    const colors = ["#3A1A08", "#5A3018", "#2D6A2D", "#1E4620", "#C9860A", "#D4AF37"];
    const segPaths = [
      "M0,0 L100,0 A100,100 0 0,1 50,86.6 Z",
      "M0,0 L50,86.6 A100,100 0 0,1 -50,86.6 Z",
      "M0,0 L-50,86.6 A100,100 0 0,1 -100,0 Z",
      "M0,0 L-100,0 A100,100 0 0,1 -50,-86.6 Z",
      "M0,0 L-50,-86.6 A100,100 0 0,1 50,-86.6 Z",
      "M0,0 L50,-86.6 A100,100 0 0,1 100,0 Z",
    ];
    const rotations = [30, 90, 150, 210, 270, 330];

    this.shadowRoot.innerHTML = `
      <style>
        ${THEME}
        .wheel-container { position: relative; width: 220px; height: 220px; margin: 30px auto 16px; }
        .wheel-svg-wrap { width: 100%; height: 100%; border-radius: 50%; border: 6px solid #C9860A; background: #2C1810; transition: transform 4.5s cubic-bezier(0.08,0.85,0.25,1); }
        .wheel-pointer { position: absolute; top: -14px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 11px solid transparent; border-right: 11px solid transparent; border-top: 18px solid #D4AF37; }
        .wheel-center { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 22px; height: 22px; background: #D4AF37; border: 3px solid #1A0E06; border-radius: 50%; }
        .wheel-result { margin-top: 12px; height: 22px; font-size: 14px; color: #F5D78E; text-align: center; }
        .wheel-btn { display: block; margin: 8px auto 4px; background: #2D6A2D; border: 1px solid #4CAF50; border-radius: 10px; color: white; padding: 10px 22px; font-weight: bold; cursor: pointer; }
        .wheel-btn:disabled { opacity: 0.4; cursor: not-allowed; background: #2C1810; border-color: #5A3018; }
        .wheel-text { font-family: Roboto, sans-serif; font-size: 13px; font-weight: bold; fill: #F5D78E; }
      </style>
      <div class="qr-card" style="text-align:center; padding-bottom: 16px;">
        <div class="qr-header">
          <div class="qr-gold"><span>🪙</span><span id="goldLabel" class="qr-gold-amount">${gold} ₡</span></div>
          <span class="qr-header-icon">🎡</span>
          <div class="qr-header-title">Wheel of Fortune</div>
          <div class="qr-header-sub">${subText}</div>
        </div>
        <div class="wheel-container">
          <div class="wheel-pointer"></div>
          <div class="wheel-center"></div>
          <svg id="wheel" class="wheel-svg-wrap" viewBox="0 0 200 200">
            <g transform="translate(100,100)">
              ${segPaths.map((p, i) => `<path d="${p}" fill="${colors[i]}"/>`).join("")}
              ${this._prizes
                .map(
                  (p, i) =>
                    `<text transform="rotate(${rotations[i]}) translate(65,0) rotate(90)" text-anchor="middle" class="wheel-text">${p} ₡</text>`
                )
                .join("")}
            </g>
          </svg>
        </div>
        <div id="result" class="wheel-result">Spin for ${this._cost} ₡!</div>
        <button id="spin" class="wheel-btn" ${canSpin ? "" : "disabled"}>SPIN</button>
      </div>
    `;

    const btn = this.shadowRoot.getElementById("spin");
    btn.addEventListener("click", () => {
      if (btn.disabled || this._spinning) return;
      this._spinning = true;
      btn.disabled = true;
      this.shadowRoot.getElementById("result").innerText = "The wheel is spinning...";

      // Optimistic UI: show the cost being deducted immediately, same as
      // the original design, instead of waiting for the backend round-trip.
      const goldLabel = this.shadowRoot.getElementById("goldLabel");
      if (goldLabel) goldLabel.textContent = `${gold - this._cost} ₡`;
      this._optimisticGold = gold - this._cost;

      this._callService("spin_wheel", { config_entry_id: entryId });
      // Safety timeout in case the result event never arrives.
      this._spinTimeout = setTimeout(() => {
        this._spinning = false;
        this._built = false;
        this._render();
      }, 9000);
    });
  }

  _landOn(prize, cost) {
    clearTimeout(this._spinTimeout);
    const wheel = this.shadowRoot.getElementById("wheel");
    const result = this.shadowRoot.getElementById("result");
    if (!wheel || !result) {
      this._spinning = false;
      return;
    }
    const index = Math.max(0, this._prizes.indexOf(prize));
    const degPerSeg = 360 / this._prizes.length;
    const baseAngle = 270 - index * degPerSeg - degPerSeg / 2;
    const offset = Math.random() * 50 - 25;
    let targetAngle = baseAngle + offset;
    if (targetAngle < 0) targetAngle += 360;
    const totalDeg = 1800 + targetAngle;
    wheel.style.transform = `rotate(${totalDeg}deg)`;

    setTimeout(() => {
      result.innerText = prize > cost ? `🎉 You won: ${prize} ₡!` : prize === cost ? `Break even: ${prize} ₡` : `Unlucky: ${prize} ₡`;

      // Optimistic final gold total, shown immediately rather than waiting
      // for the entity's state push to arrive.
      const goldLabel = this.shadowRoot.getElementById("goldLabel");
      if (goldLabel && this._optimisticGold !== undefined) {
        goldLabel.textContent = `${this._optimisticGold + prize} ₡`;
      }

      this._spinning = false;
      this._built = false;
      // Re-render shortly after so the gold/spins readout catches up.
      setTimeout(() => this._render(), 500);
    }, 4500);
  }
}

const QUEST_RPG_CARDS = [
  ["quest-rpg-quests-card", QuestRpgQuestsCard, "Quest RPG - Quests", "Active quests with reward and deadline."],
  ["quest-rpg-shop-card", QuestRpgShopCard, "Quest RPG - Shop", "Reward shop."],
  ["quest-rpg-shop-admin-card", QuestRpgShopAdminCard, "Quest RPG - Shop Management", "Add new items to the reward shop."],
  ["quest-rpg-vouchers-card", QuestRpgVouchersCard, "Quest RPG - Vouchers", "Purchased, not-yet-redeemed vouchers."],
  ["quest-rpg-wheel-card", QuestRpgWheelCard, "Quest RPG - Wheel of Fortune", "Daily wheel of fortune."],
];

window.customCards = window.customCards || [];

for (const [tag, cls, name, description] of QUEST_RPG_CARDS) {
  try {
    if (window.customElements.get(tag)) {
      console.warn(`[quest-rpg] ${tag} was already registered (script loaded twice?) - skipping re-define.`);
    } else {
      window.customElements.define(tag, cls);
      console.info(`[quest-rpg] registered ${tag}`);
    }
    window.customCards.push({ type: tag, name, description });
  } catch (err) {
    console.error(`[quest-rpg] FAILED to register ${tag}:`, err);
  }
}

// Sanity check: prove to ourselves (and the console) whether the tags are
// actually resolvable via the registry Home Assistant itself will query.
for (const [tag] of QUEST_RPG_CARDS) {
  const resolved = window.customElements.get(tag);
  console.info(`[quest-rpg] post-registration check - customElements.get('${tag}') ->`, resolved);
}
