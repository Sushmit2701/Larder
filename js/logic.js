// Larder: pure logic. No DOM access here, so this file can be reused as-is
// when the app is wrapped for iPhone or moved to another UI layer.
window.Larder = window.Larder || {};

Larder.logic = (function () {
  const DAY = 86400000;

  const CATEGORIES = [
    'Fruit & veg', 'Dairy & eggs', 'Meat & fish', 'Bakery', 'Cupboard',
    'Tins & jars', 'Frozen', 'Drinks', 'Snacks', 'Household', 'Other'
  ];

  const UNITS = ['', 'g', 'kg', 'ml', 'L', 'pcs', 'pack', 'tin', 'jar', 'bottle', 'bag', 'loaf', 'bunch', 'dozen', 'tbsp', 'tsp', 'cup', 'clove', 'slice', 'handful', 'pinch'];

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
    ['Cupboard', ['rice', 'basmati', 'pasta', 'spaghetti', 'oat', 'rolled oat', 'flour', 'sugar', 'cereal', 'granola', 'noodle', 'quinoa', 'oil', 'olive oil', 'vinegar', 'spice', 'salt', 'stock', 'honey', 'nut', 'coffee', 'tea', 'powder', 'oregano', 'dried', 'cumin', 'paprika', 'chilli flakes']],
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
  const UNIT_RE = '(kg|g|ml|l|tbsps?|tsps?|cups?|cloves?|pinch(?:es)?|handfuls?|slices?|pcs?|packs?|tins?|cans?|jars?|bottles?|bags?|dozen|loaf|loaves|bunch(?:es)?|x)';
  function normUnit(u) {
    if (!u) return '';
    u = u.toLowerCase();
    const map = { l: 'L', x: '', pc: 'pcs', pcs: 'pcs', can: 'tin', cans: 'tin', loaves: 'loaf', bunches: 'bunch', pinches: 'pinch' };
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
    const q = splitQty(text);
    if (!q) return null;
    return { name: q.name, qty: q.qty, unit: q.unit, frequency, category: guessCategory(q.name) };
  }
  function parseList(block) {
    return String(block).split(/\r?\n/).map(parseListLine).filter(Boolean);
  }

  // Pulls a quantity and unit off the front or end of a line: "200 g spinach", "Eggs x12", "½ tsp salt".
  const NUM_RE = '(\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?|[½¼¾⅓⅔])';
  const FRACTIONS = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };
  function toNumber(s) {
    s = s.trim();
    if (s in FRACTIONS) return FRACTIONS[s];
    const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
    const frac = s.match(/^(\d+)\/(\d+)$/);
    if (frac) return Number(frac[1]) / Number(frac[2]);
    return Number(s);
  }
  function splitQty(text) {
    text = String(text).replace(/\s+/g, ' ').trim();
    let qty = null, unit = '', m;
    m = text.match(new RegExp('^' + NUM_RE + '\\s*' + UNIT_RE + '?\\b\\s*(?:of\\s+)?(.+)$', 'i'));
    if (m) {
      qty = toNumber(m[1]); unit = normUnit(m[2]); text = m[3];
    } else {
      m = text.match(new RegExp('^(.+?)\\s+(?:x\\s*)?' + NUM_RE + '\\s*' + UNIT_RE + '?$', 'i'));
      if (m) { text = m[1]; qty = toNumber(m[2]); unit = normUnit(m[3]); }
    }
    text = text.replace(/[-–—,]+$/, '').trim();
    if (!text) return null;
    return { name: text.charAt(0).toUpperCase() + text.slice(1), qty, unit };
  }
  function parseIngredientLine(line) {
    const t = String(line).replace(/^\s*([-*•]|\d+[.)])\s+/, '').trim();
    return t ? splitQty(t) : null;
  }
  function parseIngredients(block) {
    return String(block).split(/\r?\n/).map(parseIngredientLine).filter(Boolean);
  }
  function parseSteps(block) {
    return String(block).split(/\r?\n/)
      .map(s => s.replace(/^\s*(step\s*)?\d+[.):]?\s+/i, '').replace(/^\s*[-*•]\s+/, '').trim())
      .filter(Boolean);
  }

  // ---------- display helpers ----------
  function fmtNum(n) {
    n = Number(n);
    if (Number.isInteger(n)) return String(n);
    const whole = Math.floor(n);
    const rest = n - whole;
    const glyph = [[0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾']].find(([v]) => Math.abs(v - rest) < 0.01);
    if (glyph) return (whole ? whole : '') + glyph[1];
    return String(Math.round(n * 100) / 100);
  }
  function qtyLabel(i) {
    if (i.qty === null || i.qty === undefined || i.qty === '') return i.unit || '';
    const num = fmtNum(i.qty);
    const PLURAL = { clove: 'cloves', cup: 'cups', tin: 'tins', jar: 'jars', bottle: 'bottles', bag: 'bags', slice: 'slices', handful: 'handfuls', pack: 'packs', loaf: 'loaves', bunch: 'bunches', pinch: 'pinches' };
    const unit = Number(i.qty) > 1 && PLURAL[i.unit] ? PLURAL[i.unit] : i.unit;
    return unit ? num + ' ' + unit : num;
  }
  function ingredientLine(i) {
    const q = qtyLabel(i);
    return q ? q + ' ' + i.name : i.name;
  }
  function formatMinutes(min) {
    min = Number(min) || 0;
    if (min < 60) return min + ' min';
    const h = Math.floor(min / 60), m = min % 60;
    return h + ' hr' + (m ? ' ' + m + ' min' : '');
  }
  function totalMinutes(r) {
    return (Number(r.prepMin) || 0) + (Number(r.cookMin) || 0);
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
  // ---------- recipes ----------
  function cleanRecipe(r) {
    const n = v => (v === '' || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v));
    const m = r.macros || {};
    return {
      ...r,
      title: String(r.title || '').trim(),
      servings: n(r.servings) || 1,
      prepMin: n(r.prepMin) || 0,
      cookMin: n(r.cookMin) || 0,
      ingredients: (r.ingredients || []).map(i => ({ name: String(i.name).trim(), qty: n(i.qty), unit: i.unit || '' })).filter(i => i.name),
      steps: (r.steps || []).map(s => String(s).trim()).filter(Boolean),
      macros: { kcal: n(m.kcal), protein: n(m.protein), carbs: n(m.carbs), fat: n(m.fat) },
      prepNote: String(r.prepNote || '').trim()
    };
  }
  function addRecipe(state, recipe, today) {
    const r = { id: uid(), createdAt: today || todayISO(), ...cleanRecipe(recipe) };
    return { state: { ...state, recipes: [...state.recipes, r] }, id: r.id };
  }
  function updateRecipe(state, id, changes) {
    return { ...state, recipes: state.recipes.map(r => (r.id === id ? cleanRecipe({ ...r, ...changes }) : r)) };
  }
  function deleteRecipe(state, id) {
    return { ...state, recipes: state.recipes.filter(r => r.id !== id) };
  }
  function sortRecipes(list) {
    return [...list].sort((a, b) => a.title.localeCompare(b.title));
  }

  // ---------- matching recipes to the pantry ----------
  // Things most kitchens always have; they never count as missing.
  const STAPLES = ['salt', 'pepper', 'black pepper', 'salt and pepper', 'water', 'ice'];
  function isStaple(name) {
    const v = nameVariants(name);
    return STAPLES.some(s => v.has(s));
  }
  function words(name) {
    return String(name).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
      .map(w => (w.endsWith('es') && w.length > 4 ? w.slice(0, -2) : w.endsWith('s') && w.length > 3 ? w.slice(0, -1) : w));
  }
  // Exact name first ("Eggs" = "Egg"), then every word of one name inside the other ("Rice" ~ "Basmati rice").
  function matchIngredient(name, pantry) {
    const exact = pantry.filter(p => sameItem(p.name, name));
    const pool = exact.length ? exact : pantry.filter(p => {
      const a = words(name), b = words(p.name);
      if (!a.length || !b.length) return false;
      const [short, long] = a.length <= b.length ? [a, b] : [b, a];
      return short.every(w => long.includes(w));
    });
    return sortByExpiry(pool)[0] || null;
  }
  function recipeMatch(recipe, pantry, today) {
    const have = [], missing = [], staples = [];
    let urgency = 0;
    const soon = [];
    recipe.ingredients.forEach(ing => {
      if (isStaple(ing.name)) { staples.push(ing); return; }
      const item = matchIngredient(ing.name, pantry);
      if (!item) { missing.push(ing); return; }
      have.push({ ing, item });
      const n = daysUntil(item.expiry, today);
      if (n !== null && n <= 7) {
        urgency += n < 0 ? 4 : 8 - n; // past-date items still count, but less than ones due tomorrow
        soon.push(item);
      }
    });
    const total = have.length + missing.length;
    return { have, missing, staples, total, haveCount: have.length, urgency, soon };
  }
  // Recipes that use food about to go off come first, then the ones you can cook with least shopping.
  function rankRecipes(recipes, pantry, today) {
    return recipes.map(recipe => ({ recipe, match: recipeMatch(recipe, pantry, today) }))
      .sort((a, b) => {
        if (b.match.urgency !== a.match.urgency) return b.match.urgency - a.match.urgency;
        const fa = a.match.total ? a.match.haveCount / a.match.total : 0;
        const fb = b.match.total ? b.match.haveCount / b.match.total : 0;
        if (fb !== fa) return fb - fa;
        if (a.match.missing.length !== b.match.missing.length) return a.match.missing.length - b.match.missing.length;
        return a.recipe.title.localeCompare(b.recipe.title);
      });
  }
  // filters: { maxMin, minProtein, maxKcal } — any left empty is ignored.
  function passesFilters(recipe, f) {
    const m = recipe.macros || {};
    if (f.maxMin && totalMinutes(recipe) > f.maxMin) return false;
    if (f.minProtein && !(m.protein >= f.minProtein)) return false;
    if (f.maxKcal && !(m.kcal != null && m.kcal <= f.maxKcal)) return false;
    return true;
  }
  function addMissingToShopping(state, recipe, today) {
    const m = recipeMatch(recipe, state.pantry, today);
    let next = state, added = 0;
    m.missing.forEach(ing => {
      const r = addShoppingItem(next, { name: ing.name, qty: null, unit: '', category: guessCategory(ing.name) });
      next = r.state; added++;
    });
    return { state: next, added };
  }

  // ---------- daily targets and food log ----------
  const DEFAULT_TARGETS = { kcal: 2000, protein: 120 };
  function setTargets(state, t) {
    const n = v => (v === '' || v === null || isNaN(Number(v)) ? null : Math.max(0, Number(v)));
    return { ...state, targets: { kcal: n(t.kcal), protein: n(t.protein) } };
  }
  function logEntry(state, entry, today) {
    const n = v => (v === '' || v === null || v === undefined || isNaN(Number(v)) ? 0 : Number(v));
    const e = {
      id: uid(), date: today || todayISO(), at: Date.now(),
      kind: entry.kind || 'quick', recipeId: entry.recipeId || null,
      title: String(entry.title || 'Quick entry').trim(),
      servings: n(entry.servings) || 1,
      kcal: n(entry.kcal), protein: n(entry.protein), carbs: n(entry.carbs), fat: n(entry.fat)
    };
    return { state: { ...state, log: [...state.log, e] }, id: e.id };
  }
  function logRecipe(state, recipe, servings, today) {
    const s = Number(servings) || 1;
    const m = recipe.macros || {};
    const x = v => Math.round((Number(v) || 0) * s);
    return logEntry(state, { kind: 'recipe', recipeId: recipe.id, title: recipe.title, servings: s, kcal: x(m.kcal), protein: x(m.protein), carbs: x(m.carbs), fat: x(m.fat) }, today);
  }
  function deleteLogEntry(state, id) {
    return { ...state, log: state.log.filter(e => e.id !== id) };
  }
  function dayTotals(log, date) {
    const entries = log.filter(e => e.date === date).sort((a, b) => a.at - b.at);
    const sum = k => entries.reduce((t, e) => t + (Number(e[k]) || 0), 0);
    return { entries, kcal: sum('kcal'), protein: sum('protein'), carbs: sum('carbs'), fat: sum('fat') };
  }
  function remaining(targets, totals) {
    return {
      kcal: targets.kcal == null ? null : targets.kcal - totals.kcal,
      protein: targets.protein == null ? null : targets.protein - totals.protein
    };
  }
  // Recipes whose one serving fits in the calories left, most protein first.
  function recipesThatFit(recipes, left) {
    return recipes
      .filter(r => r.macros && r.macros.kcal != null && (left.kcal == null || r.macros.kcal <= left.kcal))
      .sort((a, b) => (b.macros.protein || 0) - (a.macros.protein || 0) || a.macros.kcal - b.macros.kcal);
  }

  function emptyState() {
    return { version: 3, example: false, pantry: [], history: [], shopping: [], recipes: [], targets: { ...DEFAULT_TARGETS }, log: [] };
  }
  // Brings data saved by an older version up to date.
  function migrate(state, examples) {
    let s = { ...emptyState(), ...state };
    if (!Array.isArray(state.recipes)) s.recipes = s.example && examples ? examples.recipes() : [];
    if (!state.targets) s.targets = { ...DEFAULT_TARGETS };
    if (!Array.isArray(state.log)) s.log = s.example && examples ? examples.log(s.recipes) : [];
    s.version = 3;
    return s;
  }

  return {
    CATEGORIES, UNITS, FREQUENCIES,
    uid, todayISO, addDays, daysUntil, formatDate,
    expiryStatus, expiryLabel, sortByExpiry, expiringSoon,
    sameItem, findInPantry, guessCategory,
    parseListLine, parseList, parseIngredients, parseSteps,
    qtyLabel, ingredientLine, formatMinutes, totalMinutes, frequencyOf, dueDate, sortShopping,
    addRecipe, updateRecipe, deleteRecipe, sortRecipes, migrate,
    isStaple, matchIngredient, recipeMatch, rankRecipes, passesFilters, addMissingToShopping,
    DEFAULT_TARGETS, setTargets, logEntry, logRecipe, deleteLogEntry, dayTotals, remaining, recipesThatFit,
    addPantryItem, updatePantryItem, deletePantryItem, markUsed, restoreUsed,
    addShoppingItem, updateShoppingItem, deleteShoppingItem, buyShoppingItem,
    refreshDue, emptyState
  };
})();
