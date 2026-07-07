/**
 * Quest RPG Lovelace cards.
 *
 * Four custom elements, all sharing the same parchment/gold RPG theme:
 *   custom:quest-rpg-quests-card    { gold_entity, quests_entity, new_task_entity? }
 *   custom:quest-rpg-shop-card      { gold_entity, shop_entity }
 *   custom:quest-rpg-vouchers-card  { vouchers_entity }
 *   custom:quest-rpg-wheel-card     { gold_entity, spins_entity, cost?, prizes?, max_spins? }
 *
 * Every write goes through the quest_rpg.* services (or, for the new-task
 * box, the entity's own text.set_value) - no direct entity mutation beyond
 * that, so there is one source of truth in Python.
 */

const THEME = `
  :host { display: block; }
  .qr-card { background: #1A0E06; border: 1px solid #5A3018; border-radius: 14px; overflow: hidden; font-family: Roboto, sans-serif; }
  .qr-header { background: #2C1810; border-bottom: 1px solid #5A3018; padding: 20px 18px 18px; position: relative; text-align: center; }
  .qr-header::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 2px; background: #C9860A; }
  .qr-header-icon { font-size: 28px; display: block; margin-bottom: 6px; }
  .qr-header-title { font-size: 15px; font-weight: 500; color: #F5D78E; letter-spacing: 0.04em; }
  .qr-header-sub { font-size: 12px; color: #A07848; margin-top: 4px; }
  .qr-gold { position: absolute; top: 12px; left: 14px; display: flex; align-items: center; gap: 5px; background: #3A1A08; border: 1px solid #C9860A; border-radius: 99px; padding: 4px 10px 4px 7px; }
  .qr-gold-amount { font-size: 12px; font-weight: 500; color: #F5D78E; }
  .qr-body { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 8px; }
  .qr-div { font-size: 11px; text-align: center; color: #6B3D1E; letter-spacing: 6px; margin: 2px 0; }
  .qr-item { background: #1E1208; border: 1px solid #5A3018; border-radius: 10px; padding: 14px 16px; display: flex; align-items: center; gap: 14px; cursor: pointer; border-left: 3px solid #C9860A; }
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
`;

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
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

class QuestRpgBaseCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
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
          ${gold !== null ? `<div class="qr-gold"><span>🪙</span><span class="qr-gold-amount">${gold} g</span></div>` : ""}
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
    const newTaskEntity = this._entity("new_task_entity");
    const gold = goldEntity ? Math.round(parseFloat(goldEntity.state) || 0) : null;

    const quests = (questsEntity && questsEntity.attributes.quests) || [];
    const due = (questsEntity && questsEntity.attributes.due) || [];
    const entryId = this._entryId(questsEntity, goldEntity);
    const count = quests.length;

    let addRow = "";
    if (newTaskEntity) {
      addRow = `
        <div class="qr-add-row">
          <input id="newTaskInput" class="qr-add-input" type="text" placeholder="Add a new task..." />
          <button id="addTaskBtn" class="qr-add-btn">➕ Add</button>
        </div>`;
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
            const short = q.replace(/\s*\(₡\d+\)$/, "");
            const reward = d.expired ? 1 : priceOf(q);
            return `
              <div class="qr-item ${d.urgent || d.expired ? "urgent" : ""}" data-idx="${i}">
                <div class="qr-n">${roman}</div>
                <div style="flex:1;min-width:0;">
                  <div class="qr-t">⚔️ ${short}</div>
                  <div class="qr-s">
                    🗡️ Tap to complete
                    <span class="qr-b">${reward > 0 ? `${reward}g` : ""}</span>
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
    if (input && addBtn && newTaskEntity) {
      const submit = () => {
        const value = input.value.trim();
        if (!value) return;
        addBtn.disabled = true;
        this._hass.callService("text", "set_value", {
          entity_id: newTaskEntity.entity_id,
          value,
        });
        input.value = "";
        setTimeout(() => (addBtn.disabled = false), 1500);
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
      return { item, prijs, stock, outofstock, cantafford, disabled: outofstock || cantafford };
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
            return `
              <div class="qr-item ${e.disabled ? "disabled" : ""}" data-idx="${i}">
                <div class="qr-n">${firstWord(naam)}</div>
                <div style="flex:1;min-width:0;">
                  <div class="qr-t">${restWords(naam)}</div>
                  <div class="qr-s">🪙 ${e.prijs}g ${stockLabel}</div>
                </div>
                ${!e.disabled ? `<span class="qr-b">🛒 Buy</span>` : ""}
              </div>`;
          })
          .join("") +
        `<div class="qr-div">✦ · · · ✦ · · · ✦</div>`;
    }

    this.shadowRoot.innerHTML = this._shell("🏪", "🛒 Reward Shop", "✦ Spend your hard-earned gold ✦", gold, body);

    this.shadowRoot.querySelectorAll(".qr-item:not(.disabled)").forEach((el) => {
      el.addEventListener("click", () => {
        const i = parseInt(el.dataset.idx, 10);
        this._callService("buy_item", {
          config_entry_id: entryId,
          item_text: enriched[i].item,
        });
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
            return `
              <div class="qr-item" style="cursor:default;" data-idx="${i}">
                <div class="qr-n">${firstWord(naam)}</div>
                <div style="flex:1;min-width:0;">
                  <div class="qr-t">${restWords(naam)}</div>
                  <div class="qr-s">Value: 🪙 ${waarde}g</div>
                </div>
                <button class="qr-btn" data-action="redeem" data-idx="${i}">✅ Redeem</button>
                <button class="qr-btn qr-btn-sell" data-action="sell" data-idx="${i}">↩️ Sell back</button>
              </div>`;
          })
          .join("") +
        `<div class="qr-div">✦ · · · ✦ · · · ✦</div>`;
    }

    this.shadowRoot.innerHTML = this._shell("📋", "⚔️ Voucher Management", "✦ Pending rewards ✦", null, body);

    this.shadowRoot.querySelectorAll("button[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = parseInt(btn.dataset.idx, 10);
        const service = btn.dataset.action === "redeem" ? "redeem_voucher" : "sell_voucher";
        this._callService(service, {
          config_entry_id: entryId,
          voucher_text: vouchers[i],
        });
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

  setConfig(config) {
    super.setConfig(config);
    this._cost = config.cost ?? 10;
    this._prizes = config.prizes ?? [0, 5, 10, 15, 20, 30];
    this._maxSpins = config.max_spins ?? 3;
  }

  set hass(hass) {
    const firstRun = !this._hass;
    this._hass = hass;
    if (firstRun) this._subscribe();
    this._render();
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

    if (this.shadowRoot.querySelector("#wheel") && this._built) {
      // already built - only refresh the gold readout unless we're mid-spin
      const goldLabel = this.shadowRoot.querySelector("#goldLabel");
      if (goldLabel && !this._spinning) goldLabel.textContent = `${gold} g`;
      return;
    }
    this._built = true;

    const canSpin = !this._spinning && gold >= this._cost && spinsToday < this._maxSpins;
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
          <div class="qr-gold"><span>🪙</span><span id="goldLabel" class="qr-gold-amount">${gold} g</span></div>
          <span class="qr-header-icon">🎡</span>
          <div class="qr-header-title">Wheel of Fortune</div>
          <div class="qr-header-sub">✦ ${spinsToday}/${this._maxSpins} spins used today ✦</div>
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
                    `<text transform="rotate(${rotations[i]}) translate(65,0) rotate(90)" text-anchor="middle" class="wheel-text">${p}g</text>`
                )
                .join("")}
            </g>
          </svg>
        </div>
        <div id="result" class="wheel-result">Spin for ${this._cost} gold!</div>
        <button id="spin" class="wheel-btn" ${canSpin ? "" : "disabled"}>SPIN</button>
      </div>
    `;

    const btn = this.shadowRoot.getElementById("spin");
    btn.addEventListener("click", () => {
      if (btn.disabled || this._spinning) return;
      this._spinning = true;
      btn.disabled = true;
      this.shadowRoot.getElementById("result").innerText = "The wheel is spinning...";
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
      result.innerText = prize > cost ? `🎉 You won: ${prize}g!` : prize === cost ? `Break even: ${prize}g` : `Unlucky: ${prize}g`;
      this._spinning = false;
      this._built = false;
      // Re-render shortly after so the gold/spins readout catches up.
      setTimeout(() => this._render(), 500);
    }, 4500);
  }
}

customElements.define("quest-rpg-quests-card", QuestRpgQuestsCard);
customElements.define("quest-rpg-shop-card", QuestRpgShopCard);
customElements.define("quest-rpg-vouchers-card", QuestRpgVouchersCard);
customElements.define("quest-rpg-wheel-card", QuestRpgWheelCard);

window.customCards = window.customCards || [];
window.customCards.push(
  { type: "quest-rpg-quests-card", name: "Quest RPG - Quests", description: "Active quests with reward and deadline." },
  { type: "quest-rpg-shop-card", name: "Quest RPG - Shop", description: "Reward shop." },
  { type: "quest-rpg-vouchers-card", name: "Quest RPG - Vouchers", description: "Purchased, not-yet-redeemed vouchers." },
  { type: "quest-rpg-wheel-card", name: "Quest RPG - Wheel of Fortune", description: "Daily wheel of fortune." }
);
