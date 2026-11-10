// Larder: pure logic. No DOM access here, so this file can be reused as-is
// when the app is wrapped for iPhone or moved to another UI layer.
window.Larder = window.Larder || {};

Larder.logic = (function () {
  const DAY = 86400000;

  const CATEGORIES = [
    'Fruit & veg', 'Dairy & eggs', 'Meat & fish', 'Bakery', 'Cupboard',
    'Tins & jars', 'Frozen', 'Drinks', 'Snacks', 'Household', 'Other'
  ];

  const UNITS = ['', 'g', 'kg', 'ml', 'L', 'pcs', 'pack', 'tin', 'jar', 'bottle', 'bag', 'loaf', 'bunch', 'dozen'];

  const FREQUENCIES = [
    { id: 'weekly', label: 'Weekly', short: 'Weekly', days: 7 },
    { id: '2w', label: 'Every 2 weeks', short: '2 wks', days: 14 },
    { id: '2-3w', label: 'Every 2–3 weeks', short: '2–3 wks', days: 14 },
    { id: '', label: 'As needed', short: '', days: 0 }
  ];

  // ---------- ids and dates ----------
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function toISO(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function parseISO(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function todayISO(now) {
    return toISO(now ? new Date(now) : new Date());
  }
  function addDays(iso, n) {
    const d = parseISO(iso);
    d.setDate(d.getDate() + n);
    return toISO(d);
  }
  function daysUntil(iso, today) {
    if (!iso) return null;
    return Math.round((parseISO(iso) - parseISO(today || todayISO())) / DAY);
  }
  function formatDate(iso) {
    if (!iso) return '';
    return parseISO(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  }

  // ---------- expiry ----------
  function expiryStatus(iso, today) {
    const n = daysUntil(iso, today);
    if (n === null) return 'none';
    if (n < 0) return 'expired';
    if (n <= 7) return 'soon';
    return 'ok';
  }
  function expiryLabel(iso, today) {
    const n = daysUntil(iso, today);
    if (n === null) return 'No date';
    if (n < -1) return -n + ' days over';
    if (n === -1) return '1 day over';
    if (n === 0) return 'Today';
    if (n === 1) return 'Tomorrow';
    if (n < 60) return n + ' days';
    return Math.round(n / 30) + ' months';
  }
  function sortByExpiry(items) {
    return [...items].sort((a, b) => {
      if (!a.expiry && !b.expiry) return a.name.localeCompare(b.name);
      if (!a.expiry) return 1;
      if (!b.expiry) return -1;
      if (a.expiry !== b.expiry) return a.expiry < b.expiry ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }
  function expiringSoon(items, today) {
    return items.filter(i => {
      const s = expiryStatus(i.expiry, today);
      return s === 'soon' || s === 'expired';
    });
  }

  // ---------- matching names ("Eggs" on the list vs "Egg" in the pantry) ----------
  function nameVariants(s) {
    const b = String(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const v = new Set([b]);
    if (b.endsWith('s')) v.add(b.slice(0, -1));
    if (b.endsWith('es')) v.add(b.slice(0, -2));
    return v;
  }
  function sameItem(a, b) {
    const va = nameVariants(a);
    for (const x of nameVariants(b)) if (va.has(x)) return true;
    return false;
  }
  function findInPantry(name, pantry) {
    return pantry.filter(p => sameItem(p.name, name));
  }

  // ---------- category guess ----------
  const CAT_WORDS = [
    ['Frozen', ['frozen', 'ice cream', 'fish fingers']],
    ['Tins & jars', ['tin', 'tinned', 'canned', 'beans', 'chickpea', 'lentil', 'passata', 'chopped tomato', 'jam', 'peanut butter', 'pesto', 'sauce', 'olives']],
    ['Household', ['soap', 'detergent', 'washing', 'toilet', 'kitchen roll', 'bin bag', 'sponge', 'shampoo', 'toothpaste', 'foil', 'cling']],
    ['Meat & fish', ['chicken', 'beef', 'pork', 'lamb', 'mince', 'bacon', 'sausage', 'salmon', 'tuna', 'fish', 'prawn', 'shrimp', 'turkey', 'ham', 'cod', 'steak', 'tofu']],
    ['Dairy & eggs', ['milk', 'yoghurt', 'yogurt', 'cheese', 'cheddar', 'feta', 'butter', 'cream', 'egg', 'paneer', 'mozzarella', 'parmesan', 'halloumi']],
    ['Fruit & veg', ['apple', 'banana', 'berr', 'blueberr', 'strawberr', 'grape', 'lemon', 'lime', 'orange', 'pear', 'spinach', 'lettuce', 'salad', 'tomato', 'cherry tomato', 'onion', 'garlic', 'potato', 'sweet potato', 'carrot', 'pepper', 'broccoli', 'cucumber', 'avocado', 'mushroom', 'courgette', 'zucchini', 'kale', 'herb', 'coriander', 'parsley', 'basil', 'ginger', 'celery', 'leek', 'cabbage', 'fruit', 'veg', 'kiwi', 'mango']],
    ['Cupboard', ['rice', 'basmati', 'pasta', 'spaghetti', 'oat', 'rolled oat', 'flour', 'sugar', 'cereal', 'granola', 'noodle', 'quinoa', 'oil', 'olive oil', 'vinegar', 'spice', 'salt', 'stock', 'honey', 'nut', 'coffee', 'tea']],
    ['Bakery', ['bread', 'loaf', 'bagel', 'wrap', 'tortilla', 'pitta', 'pita', 'roll', 'croissant', 'sourdough', 'bun', 'wholemeal']],
    ['Drinks', ['juice', 'water', 'soda', 'beer', 'wine', 'cola', 'kombucha']],
    ['Snacks', ['crisps', 'chips', 'biscuit', 'cookie', 'chocolate', 'snack', 'popcorn', 'crackers']]
  ];
  function guessCategory(name) {
    const n = String(name).toLowerCase();
    for (const [cat, words] of CAT_WORDS) {
      if (words.some(w => new RegExp('\\b' + w.replace(/ /g, '\\s+')).test(n))) return cat;
    }
    return 'Other';
  }

  // ---------- parsing a typed or pasted list line ----------
  // Handles lines like "Milk 2 L weekly", "500g rice (every 2-3 weeks)", "- Eggs x12, fortnightly".
  function parseFrequency(t) {
    t = t.toLowerCase();
    if (/(\d|two)\s*(-|–|to)\s*(\d|three)\s*w(ee)?ks?/.test(t)) return '2-3w';
    if (/\b(2|two)\s*w(ee)?ks?\b|fortnight|bi-?weekly/.test(t)) return '2w';
    if (/weekly|every\s+week|each\s+week|\b1\s*w(ee)?k\b/.test(t)) return 'weekly';
    return '';
  }
  function stripFrequency(t) {
    return t
      .replace(/\(?\s*(every|each)?\s*((\d|two)\s*(-|–|to)\s*(\d|three)|2|two|1)\s*w(ee)?ks?\b\s*\)?/ig, ' ')
      .replace(/\(?\s*(fortnightly|fortnight|bi-?weekly|weekly|every\s+week|each\s+week)\s*\)?/ig, ' ');
  }
  const UNIT_RE = '(kg|g|ml|l|pcs?|packs?|tins?|cans?|jars?|bottles?|bags?|dozen|loaf|loaves|bunch(?:es)?|x)';
  function normUnit(u) {
    if (!u) return '';
    u = u.toLowerCase();
    const map = { l: 'L', x: '', pc: 'pcs', pcs: 'pcs', can: 'tin', cans: 'tin', loaves: 'loaf', bunches: 'bunch' };
    if (u in map) return map[u];
    return u.endsWith('s') ? u.slice(0, -1) : u;
  }
  function parseListLine(line) {
    let text = String(line)
      .replace(/^\s*([-*•]|\d+[.)])\s+/, '')
      .replace(/^\s*\[[ xX]?\]\s*/, '')
      .trim();
    if (!text) return null;
    const frequency = parseFrequency(text);
    text = stripFrequency(text)
      .replace(/[,;:]/g, ' ')
      .replace(/\s[-–—]\s/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    let qty = null, unit = '', m;
    m = text.match(new RegExp('^(\\d+(?:\\.\\d+)?)\\s*' + UNIT_RE + '?\\b\\s*(?:of\\s+)?(.+)$', 'i'));
    if (m) {
      qty = Number(m[1]); unit = normUnit(m[2]); text = m[3];
    } else {
      m = text.match(new RegExp('^(.+?)\\s+(?:x\\s*)?(\\d+(?:\\.\\d+)?)\\s*' + UNIT_RE + '?$', 'i'));
      if (m) { text = m[1]; qty = Number(m[2]); unit = normUnit(m[3]); }
    }
    text = text.replace(/[-–—]+$/, '').trim();
    if (!text) return null;
    const name = text.charAt(0).toUpperCase() + text.slice(1);
    return { name, qty, unit, frequency, category: guessCategory(name) };
  }
  function parseList(block) {
    return String(block).split(/\r?\n/).map(parseListLine).filter(Boolean);
  }

  // ---------- display helpers ----------
  function qtyLabel(i) {
    if (i.qty === null || i.qty === undefined || i.qty === '') return i.unit || '';
    const n = Number(i.qty);
    const num = Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
    return i.unit ? num + ' ' + i.unit : num;
  }
  function frequencyOf(id) {
    return FREQUENCIES.find(f => f.id === (id || '')) || FREQUENCIES[3];
  }
  function dueDate(item) {
    const f = frequencyOf(item.frequency);
    if (!item.lastBought || !f.days) return null;
    return addDays(item.lastBought, f.days);
  }
  function sortShopping(items) {
    const order = c => { const i = CATEGORIES.indexOf(c); return i < 0 ? 99 : i; };
    return [...items].sort((a, b) => order(a.category) - order(b.category) || a.name.localeCompare(b.name));
  }

  // ---------- state changes (each returns a new state) ----------
  function clean(item) {
    const qty = item.qty === '' || item.qty === null || item.qty === undefined || isNaN(Number(item.qty)) ? null : Number(item.qty);
    return { ...item, name: String(item.name || '').trim(), qty, unit: item.unit || '', category: item.category || 'Other' };
  }

  function addPantryItem(state, item, today) {
    const p = { id: uid(), addedAt: today || todayISO(), expiry: '', ...clean(item) };
    return { state: { ...state, pantry: [...state.pantry, p] }, id: p.id };
  }
  function updatePantryItem(state, id, changes) {
    return { ...state, pantry: state.pantry.map(p => (p.id === id ? clean({ ...p, ...changes }) : p)) };
  }
  function deletePantryItem(state, id) {
    return { ...state, pantry: state.pantry.filter(p => p.id !== id) };
  }
  function markUsed(state, id, today) {
    const item = state.pantry.find(p => p.id === id);
    if (!item) return state;
    const entry = { ...item, usedAt: today || todayISO() };
    return {
      ...state,
      pantry: state.pantry.filter(p => p.id !== id),
      history: [entry, ...state.history].slice(0, 200)
    };
  }
  function restoreUsed(state, id) {
    const entry = state.history.find(h => h.id === id);
    if (!entry) return state;
    const { usedAt, ...item } = entry;
    return { ...state, history: state.history.filter(h => h.id !== id), pantry: [...state.pantry, item] };
  }

  function addShoppingItem(state, item) {
    // If the item is already on the list (or was bought), bring it back instead of duplicating it.
    const existing = state.shopping.find(s => sameItem(s.name, item.name));
    if (existing) {
      const changes = { needed: true };
      if (item.frequency) changes.frequency = item.frequency;
      if (item.qty !== null && item.qty !== undefined) { changes.qty = item.qty; changes.unit = item.unit; }
      return { state: updateShoppingItem(state, existing.id, changes), id: existing.id, merged: true };
    }
    const s = { id: uid(), frequency: '', lastBought: '', ...clean(item), needed: true };
    return { state: { ...state, shopping: [...state.shopping, s] }, id: s.id, merged: false };
  }
  function updateShoppingItem(state, id, changes) {
    return { ...state, shopping: state.shopping.map(s => (s.id === id ? clean({ ...s, ...changes }) : s)) };
  }
  function deleteShoppingItem(state, id) {
    return { ...state, shopping: state.shopping.filter(s => s.id !== id) };
  }
  // Ticking an item off the list: it goes into the pantry, and stays on file
  // under "Bought" so it can come back when it is due again.
  function buyShoppingItem(state, id, today) {
    const s = state.shopping.find(x => x.id === id);
    if (!s) return { state, id: null };
    today = today || todayISO();
    const added = addPantryItem(state, { name: s.name, qty: s.qty, unit: s.unit, category: s.category, expiry: '' }, today);
    return { state: updateShoppingItem(added.state, id, { needed: false, lastBought: today }), id: added.id };
  }
  function refreshDue(state, today) {
    let changed = false;
    const shopping = state.shopping.map(s => {
      if (!s.needed) {
        const d = dueDate(s);
        if (d && d <= today) { changed = true; return { ...s, needed: true }; }
      }
      return s;
    });
    return changed ? { ...state, shopping } : state;
  }
  function emptyState() {
    return { version: 1, example: false, pantry: [], history: [], shopping: [] };
  }

  return {
    CATEGORIES, UNITS, FREQUENCIES,
    uid, todayISO, addDays, daysUntil, formatDate,
    expiryStatus, expiryLabel, sortByExpiry, expiringSoon,
    sameItem, findInPantry, guessCategory,
    parseListLine, parseList,
    qtyLabel, frequencyOf, dueDate, sortShopping,
    addPantryItem, updatePantryItem, deletePantryItem, markUsed, restoreUsed,
    addShoppingItem, updateShoppingItem, deleteShoppingItem, buyShoppingItem,
    refreshDue, emptyState
  };
})();
