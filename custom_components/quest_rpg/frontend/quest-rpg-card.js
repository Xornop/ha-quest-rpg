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

const THEME_PALETTES = {
  default: {
    bg: "#1A0E06",
    border: "#5A3018",
    headerBg: "#2C1810",
    accent: "#C9860A",
    accentText: "#F5D78E",
    subText: "#A07848",
    itemBg: "#1E1208",
    itemBorder: "#5A3018",
    itemText: "#F0C060",
    itemSubText: "#7A5530",
    badgeBg: "#3A1A08",
    badgeBorder: "#8B5A2B",
    badgeText: "#C9860A",
    urgentBorder: "#C93030",
    urgentBg: "#2E1A1A",
    urgentText: "#C93030",
    outOfStockBg: "#2E1010",
    outOfStockBorder: "#C93030",
    outOfStockText: "#C93030",
    timerBg: "#1A2E1A",
    timerBorder: "#3A8C3A",
    timerText: "#4CAF50",
    divColor: "#6B3D1E",
    emptyText: "#3A8C3A",
    btnBg: "#1A2E1A",
    btnBorder: "#3A8C3A",
    btnText: "#4CAF50",
    btnSellBg: "#3A1A08",
    btnSellBorder: "#8B5A2B",
    btnSellText: "#C9860A",
    addBtnBg: "#C9860A",
    addBtnText: "#1A0E06",
    inputBg: "#1E1208",
    inputBorder: "#5A3018",
    inputText: "#F0C060",
    placeholderText: "#7A5530",
    wheelBorder: "#C9860A",
    wheelBg: "#2C1810",
    wheelPointer: "#D4AF37",
    wheelCenterBg: "#D4AF37",
    wheelCenterBorder: "#1A0E06",
    wheelResultText: "#F5D78E",
    wheelBtnBg: "#2D6A2D",
    wheelBtnBorder: "#4CAF50",
    wheelBtnDisabledBg: "#2C1810",
    wheelBtnDisabledBorder: "#5A3018",
    wheelTextFill: "#F5D78E",
    wheelSegments: ["#3A1A08", "#5A3018", "#2D6A2D", "#1E4620", "#C9860A", "#D4AF37"],
  },
  pink: {
    bg: "#FFF3F8",
    border: "#F3B8D6",
    headerBg: "#FCE4F0",
    accent: "#E85FA6",
    accentText: "#8C2F63",
    subText: "#B0709A",
    itemBg: "#FFFAFC",
    itemBorder: "#F3C7DF",
    itemText: "#7A2E55",
    itemSubText: "#B0709A",
    badgeBg: "#FBDCEC",
    badgeBorder: "#EFA9CD",
    badgeText: "#B03D80",
    urgentBorder: "#E14C86",
    urgentBg: "#FDE3ED",
    urgentText: "#C6316E",
    outOfStockBg: "#FDE3ED",
    outOfStockBorder: "#E14C86",
    outOfStockText: "#C6316E",
    timerBg: "#E9FBF0",
    timerBorder: "#8FD9AE",
    timerText: "#2E9E5B",
    divColor: "#EFAAD0",
    emptyText: "#C67AAE",
    btnBg: "#E9FBF0",
    btnBorder: "#8FD9AE",
    btnText: "#2E9E5B",
    btnSellBg: "#FBDCEC",
    btnSellBorder: "#EFA9CD",
    btnSellText: "#B03D80",
    addBtnBg: "#E85FA6",
    addBtnText: "#FFFFFF",
    inputBg: "#FFFAFC",
    inputBorder: "#F3C7DF",
    inputText: "#7A2E55",
    placeholderText: "#CB9AB6",
    wheelBorder: "#E85FA6",
    wheelBg: "#FCE4F0",
    wheelPointer: "#E85FA6",
    wheelCenterBg: "#E85FA6",
    wheelCenterBorder: "#FFF3F8",
    wheelResultText: "#8C2F63",
    wheelBtnBg: "#E85FA6",
    wheelBtnBorder: "#C6316E",
    wheelBtnDisabledBg: "#FCE4F0",
    wheelBtnDisabledBorder: "#F3B8D6",
    wheelTextFill: "#FFFFFF",
    wheelSegments: ["#F49CC7", "#E85FA6", "#F7B6D9", "#D6428C", "#FBD2E8", "#C6316E"],
  },
};

const THEME_ICONS = {
  default: {
    questsActive: "⚔️",
    questsEmpty: "🛡️",
    questsTitle: "📜",
    questItem: "⚔️",
    questAction: "🗡️",
    shop: "🏪",
    buyBadge: "🛒",
    shopAdmin: "🧰",
    vouchers: "📋",
    wheel: "🎡",
    win: "🎉",
  },
  pink: {
    questsActive: "✨",
    questsEmpty: "🌸",
    questsTitle: "💌",
    questItem: "✨",
    questAction: "🎀",
    shop: "🏰",
    buyBadge: "💝",
    shopAdmin: "👑",
    vouchers: "🎀",
    wheel: "🎠",
    win: "✨",
  },
};

function themeVarsCss(theme) {
  const p = THEME_PALETTES[theme] || THEME_PALETTES.default;
  return `:host {
    --qr-bg: ${p.bg}; --qr-border: ${p.border}; --qr-header-bg: ${p.headerBg};
    --qr-accent: ${p.accent}; --qr-accent-text: ${p.accentText}; --qr-sub-text: ${p.subText};
    --qr-item-bg: ${p.itemBg}; --qr-item-border: ${p.itemBorder}; --qr-item-text: ${p.itemText};
    --qr-item-sub-text: ${p.itemSubText}; --qr-badge-bg: ${p.badgeBg}; --qr-badge-border: ${p.badgeBorder};
    --qr-badge-text: ${p.badgeText}; --qr-urgent-border: ${p.urgentBorder}; --qr-urgent-bg: ${p.urgentBg};
    --qr-urgent-text: ${p.urgentText}; --qr-outofstock-bg: ${p.outOfStockBg}; --qr-outofstock-border: ${p.outOfStockBorder};
    --qr-outofstock-text: ${p.outOfStockText}; --qr-timer-bg: ${p.timerBg}; --qr-timer-border: ${p.timerBorder};
    --qr-timer-text: ${p.timerText}; --qr-div-color: ${p.divColor}; --qr-empty-text: ${p.emptyText};
    --qr-btn-bg: ${p.btnBg}; --qr-btn-border: ${p.btnBorder}; --qr-btn-text: ${p.btnText};
    --qr-btn-sell-bg: ${p.btnSellBg}; --qr-btn-sell-border: ${p.btnSellBorder}; --qr-btn-sell-text: ${p.btnSellText};
    --qr-add-btn-bg: ${p.addBtnBg}; --qr-add-btn-text: ${p.addBtnText}; --qr-input-bg: ${p.inputBg};
    --qr-input-border: ${p.inputBorder}; --qr-input-text: ${p.inputText}; --qr-placeholder-text: ${p.placeholderText};
  }`;
}

const THEME = `
  :host { display: block; }
  .qr-card { background: var(--qr-bg); border: 1px solid var(--qr-border); border-radius: 14px; overflow: hidden; font-family: Roboto, sans-serif; }
  .qr-header { background: var(--qr-header-bg); border-bottom: 1px solid var(--qr-border); padding: 20px 18px 18px; position: relative; overflow: hidden; text-align: center; }
  .qr-header::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 2px; background: var(--qr-accent); }
  .qr-header-icon { font-size: 28px; display: block; margin-bottom: 6px; }
  .qr-header-title { font-size: 15px; font-weight: 500; color: var(--qr-accent-text); letter-spacing: 0.04em; }
  .qr-header-sub { font-size: 12px; color: var(--qr-sub-text); margin-top: 4px; }
  .qr-gold { position: absolute; top: 12px; left: 14px; display: flex; align-items: center; gap: 5px; background: var(--qr-badge-bg); border: 1px solid var(--qr-accent); border-radius: 99px; padding: 4px 10px 4px 7px; }
  .qr-gold-amount { font-size: 12px; font-weight: 500; color: var(--qr-accent-text); }
  .qr-body { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 8px; }
  .qr-div { font-size: 11px; text-align: center; color: var(--qr-div-color); letter-spacing: 6px; margin: 2px 0; }
  .qr-item { background: var(--qr-item-bg); border: 1px solid var(--qr-item-border); border-radius: 10px; padding: 14px 16px; display: flex; align-items: center; gap: 14px; cursor: pointer; border-left: 3px solid var(--qr-accent); position: relative; overflow: hidden; }
  .qr-item.urgent { border-left-color: var(--qr-urgent-border); }
  .qr-item.disabled { opacity: 0.4; cursor: not-allowed; border-left-color: var(--qr-item-border); }
  .qr-n { width: 32px; height: 32px; border-radius: 50%; background: var(--qr-badge-bg); border: 1px solid var(--qr-badge-border); display: flex; align-items: center; justify-content: center; font-size: 13px; color: var(--qr-accent-text); flex-shrink: 0; }
  .qr-t { font-size: 13px; font-weight: 500; color: var(--qr-item-text); line-height: 1.5; }
  .qr-s { font-size: 11px; color: var(--qr-item-sub-text); margin-top: 4px; }
  .qr-b { font-size: 10px; padding: 2px 8px; border-radius: 99px; background: var(--qr-badge-bg); border: 0.5px solid var(--qr-badge-border); color: var(--qr-badge-text); margin-left: 6px; }
  .qr-timer { font-size: 10px; padding: 2px 8px; border-radius: 99px; background: var(--qr-timer-bg); border: 0.5px solid var(--qr-timer-border); color: var(--qr-timer-text); margin-left: 6px; }
  .qr-timer.urgent { background: var(--qr-urgent-bg); border-color: var(--qr-urgent-border); color: var(--qr-urgent-text); }
  .qr-empty { text-align: center; padding: 18px 0 10px; color: var(--qr-empty-text); font-size: 13px; }
  .qr-btn { font-size: 11px; padding: 5px 12px; border-radius: 99px; background: var(--qr-btn-bg); border: 1px solid var(--qr-btn-border); color: var(--qr-btn-text); cursor: pointer; white-space: nowrap; flex-shrink: 0; }
  .qr-btn-sell { background: var(--qr-btn-sell-bg); border-color: var(--qr-btn-sell-border); color: var(--qr-btn-sell-text); margin-left: 6px; }
  .qr-badge-red { font-size: 10px; padding: 2px 8px; border-radius: 99px; background: var(--qr-outofstock-bg); border: 0.5px solid var(--qr-outofstock-border); color: var(--qr-outofstock-text); }
  .qr-add-row { display: flex; gap: 8px; padding: 4px 2px 10px; }
  .qr-add-input { flex: 1; background: var(--qr-input-bg); border: 1px solid var(--qr-input-border); border-radius: 8px; color: var(--qr-input-text); padding: 8px 10px; font-size: 13px; font-family: inherit; }
  .qr-add-input::placeholder { color: var(--qr-placeholder-text); }
  .qr-add-btn { background: var(--qr-add-btn-bg); border: none; border-radius: 8px; color: var(--qr-add-btn-text); font-weight: bold; padding: 0 14px; cursor: pointer; }
  .qr-add-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .qr-shopadmin-form { display: flex; flex-wrap: wrap; gap: 8px; padding: 4px 2px 4px; }
  .qr-shopadmin-emoji { flex: 0 0 56px; text-align: center; }
  .qr-shopadmin-name { flex: 1 1 160px; min-width: 120px; }
  .qr-shopadmin-num { flex: 0 0 110px; }
  .qr-shopadmin-rownum { flex: 0 0 60px; padding: 4px 6px; font-size: 11px; }
  .qr-stepper-btn { padding: 4px 9px; font-size: 11px; }
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

  _theme() {
    const t = (this._config && this._config.theme) || "default";
    return THEME_PALETTES[t] ? t : "default";
  }

  _icons() {
    return THEME_ICONS[this._theme()] || THEME_ICONS.default;
  }

  _palette() {
    return THEME_PALETTES[this._theme()] || THEME_PALETTES.default;
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
      <style>${themeVarsCss(this._theme())}${THEME}</style>
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
    const icons = this._icons();
    const isAdmin = !!this._config.admin;
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
    } else if (isAdmin) {
      body =
        `<div class="qr-div">✦ · · · ✦ · · · ✦</div>` +
        quests
          .map((q, i) => {
            const d = due[i] || { has_due: false, urgent: false, expired: false, timer_text: "" };
            const roman = i < 10 ? ROMAN[i] : String(i + 1);
            const short = q.replace(/\s*\(₡\d+\)[.!?]*\s*$/, "");
            const reward = d.expired ? 1 : priceOf(q);
            return `
              <div class="qr-item ${d.urgent || d.expired ? "urgent" : ""}" data-idx="${i}" style="cursor:default; align-items:flex-start;">
                ${VINES[i % 3]}
                <div class="qr-n">${roman}</div>
                <div style="flex:1;min-width:0;">
                  <input id="questText-${i}" class="qr-add-input" type="text" value="${short.replace(/"/g, "&quot;")}" style="width:100%; box-sizing:border-box;" />
                  <div class="qr-s" style="display:flex; align-items:center; gap:6px; margin-top:6px; flex-wrap:wrap;">
                    <button class="qr-btn qr-stepper-btn" data-dir="down" data-idx="${i}">▼</button>
                    <input id="questReward-${i}" class="qr-add-input qr-shopadmin-rownum" type="number" min="1" max="100" value="${reward}" />
                    <button class="qr-btn qr-stepper-btn" data-dir="up" data-idx="${i}">▲</button>
                    <button class="qr-btn qr-quest-complete" data-idx="${i}">✅</button>
                    <button class="qr-btn qr-quest-save" data-idx="${i}">💾</button>
                    <button class="qr-btn qr-btn-sell qr-quest-del" data-idx="${i}">✕</button>
                    ${d.has_due ? `<span class="qr-timer ${d.urgent || d.expired ? "urgent" : ""}">${d.timer_text}</span>` : ""}
                  </div>
                </div>
              </div>`;
          })
          .join("") +
        `<div class="qr-div">✦ · · · ✦ · · · ✦</div>`;
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
                  <div class="qr-t">${icons.questItem} ${short}</div>
                  <div class="qr-s">
                    ${icons.questAction} Tap to complete
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
      count > 0 ? icons.questsActive : icons.questsEmpty,
      `${icons.questsTitle} Active Quests${isAdmin ? " (Admin)" : ""}`,
      count > 0 ? `✦ ${count} quest${count > 1 ? "s" : ""} open ✦` : "✦ All quests complete ✦",
      gold,
      addRow + body
    );

    if (!isAdmin) {
      this.shadowRoot.querySelectorAll(".qr-item").forEach((el) => {
        el.addEventListener("click", () => {
          const i = parseInt(el.dataset.idx, 10);
          const questText = quests[i];
          if (confirm(`Is quest "${questText}" complete, Adventurer?`)) {
            this._callService("complete_quest", {
              config_entry_id: entryId,
              quest_text: questText,
            });
          }
        });
      });
    } else {
      this.shadowRoot.querySelectorAll(".qr-stepper-btn").forEach((stepBtn) => {
        stepBtn.addEventListener("click", () => {
          const i = parseInt(stepBtn.dataset.idx, 10);
          const rewardInput = this.shadowRoot.getElementById(`questReward-${i}`);
          let val = parseInt(rewardInput.value, 10) || 1;
          val += stepBtn.dataset.dir === "up" ? 1 : -1;
          rewardInput.value = Math.min(100, Math.max(1, val));
        });
      });

      this.shadowRoot.querySelectorAll(".qr-quest-complete").forEach((completeBtn) => {
        completeBtn.addEventListener("click", () => {
          const i = parseInt(completeBtn.dataset.idx, 10);
          const questText = quests[i];
          if (confirm(`Mark quest "${questText}" as complete and pay out the reward?`)) {
            this._callService("complete_quest", {
              config_entry_id: entryId,
              quest_text: questText,
            });
          }
        });
      });

      this.shadowRoot.querySelectorAll(".qr-quest-save").forEach((saveBtn) => {
        saveBtn.addEventListener("click", () => {
          const i = parseInt(saveBtn.dataset.idx, 10);
          const questText = quests[i];
          const textEl = this.shadowRoot.getElementById(`questText-${i}`);
          const rewardEl = this.shadowRoot.getElementById(`questReward-${i}`);
          const newText = textEl.value.trim();
          const reward = Math.min(100, Math.max(1, parseInt(rewardEl.value, 10) || 1));
          if (!newText) return;

          saveBtn.disabled = true;
          this._hass
            .callService("quest_rpg", "update_quest", {
              config_entry_id: entryId,
              quest_text: questText,
              new_text: newText,
              reward,
            })
            .catch((err) => {
              console.error("[quest-rpg] update_quest FAILED:", err);
            })
            .finally(() => {
              saveBtn.disabled = false;
            });
        });
      });

      this.shadowRoot.querySelectorAll(".qr-quest-del").forEach((delBtn) => {
        delBtn.addEventListener("click", () => {
          const i = parseInt(delBtn.dataset.idx, 10);
          const questText = quests[i];
          if (!confirm(`Remove quest "${questText}" without paying out?`)) return;

          delBtn.disabled = true;
          this._hass
            .callService("quest_rpg", "remove_quest", {
              config_entry_id: entryId,
              quest_text: questText,
            })
            .catch((err) => {
              console.error("[quest-rpg] remove_quest FAILED:", err);
              delBtn.disabled = false;
            });
        });
      });
    }

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
  connectedCallback() {
    // Backstop refresh, same role as the original design's time_pattern
    // "/5 seconds" trigger: forces a re-render off whatever hass data we
    // currently have, in case a real change didn't trip our dirty-check.
    if (!this._pollInterval) {
      this._pollInterval = setInterval(() => this._forceRender(), 5000);
    }
  }

  disconnectedCallback() {
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
  }

  _render() {
    if (!this._hass || !this._config) return;
    const icons = this._icons();
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
      return {
        item,
        prijs,
        stock,
        outofstock,
        cantafford,
        disabled: outofstock || cantafford,
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
            const buyBadge = !e.disabled ? `<span class="qr-b qr-buy-badge">${icons.buyBadge} Buy</span>` : "";
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

    this.shadowRoot.innerHTML = this._shell(icons.shop, `${icons.buyBadge} Reward Shop`, "✦ Spend your hard-earned gold ✦", gold, body);

    this.shadowRoot.querySelectorAll(".qr-item:not(.disabled)").forEach((el) => {
      el.addEventListener("click", () => {
        const i = parseInt(el.dataset.idx, 10);
        const itemText = enriched[i].item;

        // Prevent a double-tap in the brief moment before fresh data
        // lands - no artificial delay beyond that, real-time updates
        // (via the backend's change event) handle the rest.
        if (el.classList.contains("disabled")) return;
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
// Shop admin card - add, edit, and remove reward shop items
// ---------------------------------------------------------------------
class QuestRpgShopAdminCard extends QuestRpgBaseCard {
  _render() {
    if (!this._hass || !this._config) return;
    const icons = this._icons();
    const shopEntity = this._entity("shop_entity");
    const entryId = this._entryId(shopEntity, this._entity("gold_entity"));
    const items = (shopEntity && shopEntity.attributes.quests) || [];

    const listRows = items
      .map((item, i) => {
        const naam = nameOnly(item);
        const prijs = priceOf(item);
        const stock = stockOf(item);
        return `
          <div class="qr-item" data-idx="${i}" style="cursor:default;">
            ${VINES[i % 3]}
            <div class="qr-n">${firstWord(naam)}</div>
            <div style="flex:1;min-width:0;">
              <div class="qr-t">${restWords(naam)}</div>
              <div class="qr-s" style="display:flex; align-items:center; gap:6px; margin-top:6px;">
                ₡<input id="rowPrice-${i}" class="qr-add-input qr-shopadmin-rownum" type="number" min="1" value="${prijs}" />
                <input id="rowStock-${i}" class="qr-add-input qr-shopadmin-rownum" type="number" min="0" placeholder="∞" value="${stock === null ? "" : stock}" />
                <button class="qr-btn qr-shopadmin-save" data-idx="${i}">💾</button>
                <button class="qr-btn qr-btn-sell qr-shopadmin-del" data-idx="${i}">✕</button>
              </div>
            </div>
          </div>`;
      })
      .join("");

    const body = `
      <div class="qr-shopadmin-form">
        <input id="itemEmoji" class="qr-add-input qr-shopadmin-emoji" type="text" placeholder="🎫" maxlength="8" />
        <input id="itemName" class="qr-add-input qr-shopadmin-name" type="text" placeholder="Item name..." />
        <input id="itemPrice" class="qr-add-input qr-shopadmin-num" type="number" min="1" placeholder="Price ₡" />
        <input id="itemStock" class="qr-add-input qr-shopadmin-num" type="number" min="0" placeholder="Stock (blank=∞)" />
      </div>
      <button id="addItemBtn" class="qr-add-btn" style="width:100%; padding: 8px 0;">➕ Add item to shop</button>
      <div id="shopAdminMsg" class="qr-s" style="margin-top:6px; text-align:center;"></div>
      <div class="qr-div">✦ · · · ✦ · · · ✦</div>
      ${items.length ? listRows : `<div class="qr-empty">🌿 No items in the shop yet</div>`}
    `;

    this.shadowRoot.innerHTML = this._shell(
      icons.shopAdmin,
      "🛠️ Shop Management",
      "✦ Add, edit, or remove reward shop items ✦",
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

    this.shadowRoot.querySelectorAll(".qr-shopadmin-save").forEach((saveBtn) => {
      saveBtn.addEventListener("click", () => {
        const i = parseInt(saveBtn.dataset.idx, 10);
        const itemText = items[i];
        const priceEl = this.shadowRoot.getElementById(`rowPrice-${i}`);
        const stockEl = this.shadowRoot.getElementById(`rowStock-${i}`);
        const price = parseInt(priceEl.value, 10);
        if (!price || price <= 0) {
          msg.textContent = "⚠️ Price must be a positive number.";
          return;
        }
        const data = { config_entry_id: entryId, item_text: itemText, price };
        const stockRaw = stockEl.value.trim();
        if (stockRaw !== "") data.stock = parseInt(stockRaw, 10);

        saveBtn.disabled = true;
        this._hass
          .callService("quest_rpg", "update_shop_item", data)
          .then(() => {
            msg.textContent = "✅ Updated.";
          })
          .catch((err) => {
            console.error("[quest-rpg] update_shop_item FAILED:", err);
            msg.textContent = `❌ Could not update item: ${err && err.message ? err.message : err}`;
          })
          .finally(() => {
            saveBtn.disabled = false;
          });
      });
    });

    this.shadowRoot.querySelectorAll(".qr-shopadmin-del").forEach((delBtn) => {
      delBtn.addEventListener("click", () => {
        const i = parseInt(delBtn.dataset.idx, 10);
        const itemText = items[i];
        if (!confirm(`Remove "${nameOnly(itemText)}" from the shop?`)) return;

        delBtn.disabled = true;
        this._hass
          .callService("quest_rpg", "remove_shop_item", {
            config_entry_id: entryId,
            item_text: itemText,
          })
          .catch((err) => {
            console.error("[quest-rpg] remove_shop_item FAILED:", err);
            msg.textContent = `❌ Could not remove item: ${err && err.message ? err.message : err}`;
            delBtn.disabled = false;
          });
      });
    });
  }
}

// ---------------------------------------------------------------------
// Vouchers card
// ---------------------------------------------------------------------
class QuestRpgVouchersCard extends QuestRpgBaseCard {
  connectedCallback() {
    if (!this._pollInterval) {
      this._pollInterval = setInterval(() => this._forceRender(), 5000);
    }
  }

  disconnectedCallback() {
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
  }

  _render() {
    if (!this._hass || !this._config) return;
    const icons = this._icons();
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
      icons.vouchers,
      `${icons.vouchers} Voucher Management`,
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
    const icons = this._icons();
    const palette = this._palette();
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
    const colors = palette.wheelSegments;
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
        ${themeVarsCss(this._theme())}${THEME}
        .wheel-container { position: relative; width: 220px; height: 220px; margin: 30px auto 16px; }
        .wheel-svg-wrap { width: 100%; height: 100%; border-radius: 50%; border: 6px solid var(--qr-wheel-border, ${palette.wheelBorder}); box-sizing: border-box; background: var(--qr-wheel-bg, ${palette.wheelBg}); transition: transform 4.5s cubic-bezier(0.08,0.85,0.25,1); }
        .wheel-pointer { position: absolute; top: -14px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 11px solid transparent; border-right: 11px solid transparent; border-top: 18px solid ${palette.wheelPointer}; z-index: 10; filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.5)); }
        .wheel-center { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 22px; height: 22px; background: ${palette.wheelCenterBg}; border: 3px solid ${palette.wheelCenterBorder}; border-radius: 50%; z-index: 5; }
        .wheel-result { margin-top: 12px; height: 22px; font-size: 14px; color: ${palette.wheelResultText}; text-align: center; }
        .wheel-btn { display: block; margin: 8px auto 4px; background: ${palette.wheelBtnBg}; border: 1px solid ${palette.wheelBtnBorder}; border-radius: 10px; color: white; padding: 10px 22px; font-weight: bold; cursor: pointer; }
        .wheel-btn:disabled { opacity: 0.4; cursor: not-allowed; background: ${palette.wheelBtnDisabledBg}; border-color: ${palette.wheelBtnDisabledBorder}; }
        .wheel-text { font-family: Roboto, sans-serif; font-size: 13px; font-weight: bold; fill: ${palette.wheelTextFill}; }
      </style>
      <div class="qr-card" style="text-align:center; padding-bottom: 16px;">
        <div class="qr-header">
          <div class="qr-gold"><span>🪙</span><span id="goldLabel" class="qr-gold-amount">${gold} ₡</span></div>
          <span class="qr-header-icon">${icons.wheel}</span>
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
      result.innerText = prize > cost ? `${this._icons().win} You won: ${prize} ₡!` : prize === cost ? `Break even: ${prize} ₡` : `Unlucky: ${prize} ₡`;

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

window.setTimeout(() => {
  for (const [tag, cls, name, description] of QUEST_RPG_CARDS) {
    if (!window.customElements.get(tag)) {
      window.customElements.define(tag, cls);
    }
    if (!window.customCards.find((c) => c.type === tag)) {
      window.customCards.push({ type: tag, name, description });
    }
  }
}, 100);
