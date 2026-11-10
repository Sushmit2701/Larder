// Larder: user interface. Reads and writes state only through Larder.logic and Larder.storage.
(function () {
  const L = Larder.logic;
  const S = Larder.storage;

  let state;
  let view = 'pantry';
  const VIEWS = ['pantry', 'shopping', 'recipes', 'today'];
  const ui = { q: '', cat: '', rq: '', recipeId: null, sort: 'match', maxMin: '', minProtein: '', maxKcal: '' };
  let undoSnapshot = null;
  let toastTimer = null;
  let clearArmed = null;

  const $ = (sel, el) => (el || document).querySelector(sel);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const today = () => L.todayISO();

  const ICON_CHECK = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M5 10.5l3.2 3.2L15 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // ---------- state ----------
  function init() {
    const saved = S.load();
    state = saved
      ? L.migrate(saved, { recipes: () => Larder.seed.recipes(today()), log: r => Larder.seed.log(r, today()) })
      : Larder.seed.create(today());
    state = L.refreshDue(state, today());
    S.save(state);
    const v = S.getPref('view', 'pantry');
    if (VIEWS.includes(v)) view = v;
    bind();
    render();
  }
  function persist() {
    if (!S.save(state)) showToast('Could not save. This browser is blocking storage for this page.');
  }
  function commit(next, message, opts) {
    opts = opts || {};
    if (opts.undoable) undoSnapshot = state;
    state = next;
    persist();
    render();
    if (message) showToast(message, opts.undoable ? { label: 'Undo', fn: undo } : opts.action);
  }
  function undo() {
    if (!undoSnapshot) return;
    state = undoSnapshot;
    undoSnapshot = null;
    persist();
    render();
    showToast('Undone');
  }

  // ---------- render ----------
  function render() {
    document.querySelectorAll('.tab').forEach(t => {
      const on = t.dataset.view === view;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $('#count-pantry').textContent = state.pantry.length;
    $('#count-shopping').textContent = state.shopping.filter(s => s.needed).length;
    $('#count-recipes').textContent = state.recipes.length;
    if (ui.recipeId && !state.recipes.some(r => r.id === ui.recipeId)) ui.recipeId = null;
    $('#main').innerHTML = view === 'pantry' ? renderPantry()
      : view === 'shopping' ? renderShopping()
      : view === 'today' ? renderToday()
      : ui.recipeId ? renderRecipeDetail(ui.recipeId) : renderRecipes();
  }

  // ---------- today: targets and food log ----------
  function meter(label, eaten, target, unit) {
    if (target == null) return `<div class="meter"><div class="meter-top"><span class="meter-label">${label}</span><span class="meter-nums">${esc(Math.round(eaten))}${unit}</span></div><p class="muted small">No target set.</p></div>`;
    const left = target - eaten;
    const pct = target > 0 ? Math.min(100, (eaten / target) * 100) : 100;
    const over = left < 0;
    return `<div class="meter ${over ? 'is-over' : ''}">
      <div class="meter-top">
        <span class="meter-label">${label}</span>
        <span class="meter-nums"><strong>${esc(Math.round(eaten))}</strong> / ${esc(target)}${unit}</span>
      </div>
      <div class="bar" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="${esc(target)}" aria-valuenow="${esc(Math.round(eaten))}"><span style="width:${pct.toFixed(1)}%"></span></div>
      <p class="meter-left">${over ? `${esc(Math.round(-left))}${unit} over` : `${esc(Math.round(left))}${unit} left`}</p>
    </div>`;
  }

  function renderToday() {
    const t = today();
    const totals = L.dayTotals(state.log, t);
    const tg = state.targets || L.DEFAULT_TARGETS;
    const left = L.remaining(tg, totals);
    const fits = L.recipesThatFit(state.recipes, left).slice(0, 5);
    const recipes = L.sortRecipes(state.recipes);
    return `${exampleBanner()}
      <section class="panel today-head" aria-labelledby="today-h">
        <div class="today-title">
          <h2 id="today-h">${esc(new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }))}</h2>
          <button class="btn small" data-action="edit-targets">Targets</button>
        </div>
        <div class="meters">
          ${meter('Calories', totals.kcal, tg.kcal, ' kcal')}
          ${meter('Protein', totals.protein, tg.protein, ' g')}
        </div>
        <form id="targets-form" class="targets-form" hidden>
          <label class="field"><span>Daily calories</span><input id="t-kcal" type="number" inputmode="numeric" min="0" value="${esc(tg.kcal ?? '')}"></label>
          <label class="field"><span>Daily protein (g)</span><input id="t-protein" type="number" inputmode="numeric" min="0" value="${esc(tg.protein ?? '')}"></label>
          <button class="btn primary" type="submit">Save targets</button>
        </form>
      </section>

      <section class="panel" aria-labelledby="eaten-h">
        <h3 id="eaten-h">Eaten today</h3>
        ${totals.entries.length ? `<ul class="log">${totals.entries.map(e => `<li>
            <div class="log-main"><span class="row-name">${esc(e.title)}</span>
              <span class="row-meta">${esc([e.kind === 'recipe' ? (e.servings === 1 ? '1 serving' : L.qtyLabel({ qty: e.servings }) + ' servings') : '', e.protein + ' g protein', e.carbs ? e.carbs + ' g carbs' : '', e.fat ? e.fat + ' g fat' : ''].filter(Boolean).join(' · '))}</span></div>
            <span class="log-kcal">${esc(e.kcal)} kcal</span>
            <button class="icon-btn" data-action="delete-log" data-id="${e.id}" aria-label="Remove ${esc(e.title)}">×</button>
          </li>`).join('')}</ul>` : '<p class="muted">Nothing logged yet today.</p>'}
      </section>

      <section class="panel" aria-labelledby="log-h">
        <h3 id="log-h">Log food</h3>
        ${recipes.length ? `<form id="log-recipe-form" class="log-form">
          <label class="field grow"><span>Recipe</span>
            <select id="lr-recipe">${recipes.map(r => `<option value="${r.id}">${esc(r.title)}</option>`).join('')}</select></label>
          <label class="field narrow"><span>Servings</span><input id="lr-servings" type="number" inputmode="decimal" min="0.25" step="0.25" value="1"></label>
          <button class="btn primary" type="submit">Log</button>
        </form>` : ''}
        <form id="log-quick-form" class="log-form quick">
          <label class="field grow"><span>Quick entry</span><input id="lq-title" placeholder="e.g. Protein shake" autocomplete="off"></label>
          <label class="field narrow"><span>kcal</span><input id="lq-kcal" type="number" inputmode="numeric" min="0"></label>
          <label class="field narrow"><span>Protein g</span><input id="lq-protein" type="number" inputmode="numeric" min="0"></label>
          <button class="btn" type="submit">Log</button>
        </form>
        <p class="form-error" id="lq-error" hidden>Enter the calories for a quick entry.</p>
      </section>

      <section aria-labelledby="fit-h" class="fit">
        <h2 class="list-head" id="fit-h">${left.kcal == null ? 'Highest protein recipes' : left.kcal > 0 ? `Fits the ${esc(Math.round(left.kcal))} kcal you have left` : 'You have reached your calorie target'}</h2>
        ${fits.length ? `<ul class="list">${fits.map(r => `<li class="row">
          <button class="row-main" data-action="open-recipe-from-today" data-id="${r.id}">
            <span class="row-name">${esc(r.title)}</span>
            <span class="row-meta">${esc([r.macros.kcal + ' kcal', (r.macros.protein ?? 0) + ' g protein', L.formatMinutes(L.totalMinutes(r))].join(' · '))}</span>
          </button>
          <button class="btn small" data-action="log-recipe" data-id="${r.id}">Log 1 serving</button>
        </li>`).join('')}</ul>` : (left.kcal != null && left.kcal > 0 ? '<p class="muted">None of your recipes fit in what is left. Recipes need calories entered to show here.</p>' : '')}
      </section>`;
  }

  function logged(next, title) {
    commit(next, `Logged ${title}`, { undoable: true });
  }

  // ---------- recipes ----------
  function macroText(r) {
    const m = r.macros || {};
    return [m.kcal != null ? m.kcal + ' kcal' : '', m.protein != null ? m.protein + ' g protein' : ''].filter(Boolean).join(' · ');
  }

  function renderRecipes() {
    const q = ui.rq.trim().toLowerCase();
    return `${exampleBanner()}
      <div class="toolbar">
        <input id="recipe-search" type="search" placeholder="Search recipes or ingredients" value="${esc(ui.rq)}" aria-label="Search recipes" autocomplete="off">
        <button class="btn primary" data-action="new-recipe">Add recipe</button>
      </div>
      <div class="filters" role="group" aria-label="Filter recipes">
        ${filterSelect('f-sort', 'Sort', ui.sort, [['match', 'Best match for my pantry'], ['az', 'A to Z']])}
        ${filterSelect('f-time', 'Time', ui.maxMin, [['', 'Any time'], ['15', '15 min or less'], ['30', '30 min or less'], ['45', '45 min or less'], ['60', '1 hr or less']])}
        ${filterSelect('f-protein', 'Protein', ui.minProtein, [['', 'Any protein'], ['20', '20 g or more'], ['30', '30 g or more'], ['40', '40 g or more']])}
        ${filterSelect('f-kcal', 'Calories', ui.maxKcal, [['', 'Any calories'], ['left', 'Fits what I have left today'], ['400', '400 kcal or less'], ['500', '500 kcal or less'], ['600', '600 kcal or less']])}
      </div>
      <ul class="list" id="recipe-list">${renderRecipeRows(q)}</ul>`;
  }

  function filterSelect(id, label, value, options) {
    return `<label class="filter"><span>${label}</span><select id="${id}">${options.map(([v, l]) => `<option value="${v}" ${String(value) === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
  }

  function currentFilters() {
    let maxKcal = Number(ui.maxKcal) || null;
    if (ui.maxKcal === 'left') {
      const left = L.remaining(state.targets || L.DEFAULT_TARGETS, L.dayTotals(state.log, today()));
      maxKcal = left.kcal == null ? null : Math.max(0, left.kcal);
      if (maxKcal === 0) maxKcal = -1; // nothing fits once the target is reached
    }
    return { maxMin: Number(ui.maxMin) || null, minProtein: Number(ui.minProtein) || null, maxKcal };
  }

  function shortList(names, n) {
    if (names.length <= n) return names.join(', ');
    return names.slice(0, n).join(', ') + ' and ' + (names.length - n) + ' more';
  }

  function renderRecipeRows(q) {
    if (!state.recipes.length) return `<li class="empty">No recipes yet. Add your first one with its ingredients, method and macros.</li>`;
    const t = today();
    const f = currentFilters();
    let ranked = L.rankRecipes(state.recipes, state.pantry, t);
    if (ui.sort === 'az') ranked = ranked.sort((a, b) => a.recipe.title.localeCompare(b.recipe.title));
    const list = ranked.filter(({ recipe: r }) => (!q
      || r.title.toLowerCase().includes(q)
      || r.ingredients.some(i => i.name.toLowerCase().includes(q)))
      && (f.maxKcal === -1 ? false : L.passesFilters(r, f)));
    if (!list.length) return `<li class="empty">No recipes match. Try fewer filters.</li>`;
    return list.map(({ recipe: r, match: m }) => {
      const all = m.total && !m.missing.length;
      const soonNames = [...new Set(m.soon.map(i => i.name))];
      return `<li class="row recipe-row">
      <button class="row-main" data-action="open-recipe" data-id="${r.id}">
        <span class="row-name">${esc(r.title)}</span>
        <span class="row-meta">${esc([L.formatMinutes(L.totalMinutes(r)), 'Serves ' + r.servings, macroText(r)].filter(Boolean).join(' · '))}</span>
        <span class="match">
          <span class="have-count ${all ? 'is-all' : ''}">${all ? 'You have everything' : `Have ${m.haveCount} of ${m.total}`}</span>
          ${m.missing.length ? `<span class="missing">Missing: ${esc(shortList(m.missing.map(i => i.name.toLowerCase()), 3))}</span>` : ''}
        </span>
        ${soonNames.length ? `<span class="uses-soon">Uses up ${esc(shortList(soonNames.map(n => n.toLowerCase()), 2))}</span>` : ''}
      </button>
      <span class="ratio" aria-hidden="true"><svg viewBox="0 0 36 36" width="36" height="36"><circle cx="18" cy="18" r="15" class="ratio-bg"/><circle cx="18" cy="18" r="15" class="ratio-fg" stroke-dasharray="${(m.total ? (m.haveCount / m.total) * 94.25 : 0).toFixed(2)} 94.25" transform="rotate(-90 18 18)"/></svg></span>
    </li>`;
    }).join('');
  }

  function renderRecipeDetail(id) {
    const r = state.recipes.find(x => x.id === id);
    const m = r.macros || {};
    const match = L.recipeMatch(r, state.pantry, today());
    const fig = (v, unit, label) => `<div class="macro"><span class="macro-n">${v == null ? '–' : esc(v)}<small>${v == null ? '' : unit}</small></span><span class="macro-l">${label}</span></div>`;
    return `<article class="recipe">
      <div class="recipe-nav">
        <button class="btn small" data-action="back-recipes">‹ All recipes</button>
        <button class="btn small" data-action="edit-recipe" data-id="${r.id}">Edit</button>
      </div>
      <header class="recipe-head">
        <h2>${esc(r.title)}</h2>
        <dl class="times">
          <div><dt>Prep</dt><dd>${esc(L.formatMinutes(r.prepMin))}</dd></div>
          <div><dt>Cook</dt><dd>${esc(L.formatMinutes(r.cookMin))}</dd></div>
          <div class="total"><dt>Total</dt><dd>${esc(L.formatMinutes(L.totalMinutes(r)))}</dd></div>
          <div><dt>Serves</dt><dd>${esc(r.servings)}</dd></div>
        </dl>
      </header>
      <section class="panel" aria-labelledby="macros-h">
        <h3 id="macros-h">Per serving</h3>
        <div class="macros">
          ${fig(m.kcal, '', 'kcal')}${fig(m.protein, ' g', 'protein')}${fig(m.carbs, ' g', 'carbs')}${fig(m.fat, ' g', 'fat')}
        </div>
      </section>
      <div class="recipe-actions">
        <button class="btn primary" data-action="log-recipe" data-id="${r.id}">Log 1 serving today</button>
        ${match.missing.length ? `<button class="btn" data-action="add-missing" data-id="${r.id}">Add ${match.missing.length} missing to shopping list</button>` : ''}
      </div>
      <section class="panel" aria-labelledby="ing-h">
        <h3 id="ing-h">Ingredients <span class="h3-note">${match.total ? (match.missing.length ? `You have ${match.haveCount} of ${match.total}` : 'You have everything') : ''}</span></h3>
        ${r.ingredients.length ? `<ul class="ingredients">${r.ingredients.map(i => {
          const h = match.have.find(x => x.ing === i);
          const staple = match.staples.includes(i);
          const st = h ? L.expiryStatus(h.item.expiry, today()) : '';
          const status = staple ? '<span class="ing-status muted">Cupboard staple</span>'
            : h ? `<span class="ing-status have">At home${h.item.name.toLowerCase() !== i.name.toLowerCase() ? ': ' + esc(h.item.name) : ''}${st === 'soon' || st === 'expired' ? ' · ' + pill(h.item.expiry) : ''}</span>`
            : '<span class="ing-status missing">Missing</span>';
          return `<li class="${h || staple ? 'is-have' : 'is-missing'}"><span class="ing-qty">${esc(L.qtyLabel(i))}</span><span class="ing-name">${esc(i.name)}${status}</span></li>`;
        }).join('')}</ul>` : '<p class="muted">No ingredients added.</p>'}
      </section>
      <section class="panel" aria-labelledby="method-h">
        <h3 id="method-h">Method</h3>
        ${r.steps.length ? `<ol class="steps">${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : '<p class="muted">No steps added.</p>'}
      </section>
      ${r.prepNote ? `<section class="panel prep" aria-labelledby="prep-h">
        <h3 id="prep-h">Weekend prep</h3>
        <p>${esc(r.prepNote).replace(/\n/g, '<br>')}</p>
      </section>` : ''}
    </article>`;
  }

  function openRecipeEditor(id) {
    const r = id ? state.recipes.find(x => x.id === id) : null;
    const v = r || { title: '', servings: 2, prepMin: '', cookMin: '', ingredients: [], steps: [], macros: {}, prepNote: '' };
    const m = v.macros || {};
    const dlg = $('#editor');
    const num = (fid, label, val, extra) => `<label class="field"><span>${label}</span><input id="${fid}" type="number" inputmode="numeric" min="0" step="any" value="${esc(val ?? '')}" ${extra || ''}></label>`;
    dlg.innerHTML = `<form id="recipe-form" class="sheet" novalidate>
      <h2>${r ? 'Edit recipe' : 'New recipe'}</h2>
      <label class="field"><span>Title</span>
        <input id="r-title" required value="${esc(v.title)}" autocomplete="off" placeholder="e.g. Lemon chicken traybake"></label>
      <div class="field-row three">
        ${num('r-servings', 'Servings', v.servings)}
        ${num('r-prep', 'Prep (min)', v.prepMin)}
        ${num('r-cook', 'Cook (min)', v.cookMin)}
      </div>
      <label class="field"><span>Ingredients, one per line</span>
        <textarea id="r-ingredients" rows="6" placeholder="500 g chicken thighs&#10;2 tbsp olive oil&#10;1 lemon">${esc(v.ingredients.map(L.ingredientLine).join('\n'))}</textarea></label>
      <label class="field"><span>Method, one step per line</span>
        <textarea id="r-steps" rows="6" placeholder="Heat the oven to 200°C.&#10;Toss everything in a roasting tin.">${esc(v.steps.join('\n'))}</textarea></label>
      <fieldset class="field-group">
        <legend>Per serving</legend>
        <div class="field-row four">
          ${num('r-kcal', 'Calories', m.kcal)}
          ${num('r-protein', 'Protein (g)', m.protein)}
          ${num('r-carbs', 'Carbs (g)', m.carbs)}
          ${num('r-fat', 'Fat (g)', m.fat)}
        </div>
      </fieldset>
      <label class="field"><span>Weekend prep note</span>
        <textarea id="r-prepnote" rows="3" placeholder="What can be chopped, cooked or portioned ahead, and how long it keeps.">${esc(v.prepNote)}</textarea></label>
      <p class="form-error" id="r-error" hidden>Give the recipe a title.</p>
      <div class="sheet-actions">
        ${r ? `<button type="button" class="btn danger-text" data-action="delete">Delete</button>` : ''}
        <span class="spacer"></span>
        <button type="button" class="btn" data-action="cancel">Cancel</button>
        <button type="submit" class="btn primary">${r ? 'Save' : 'Add recipe'}</button>
      </div>
    </form>`;
    const form = $('#recipe-form');
    form.addEventListener('click', e => {
      const b = e.target.closest('button[data-action]');
      if (!b) return;
      if (b.dataset.action === 'cancel') dlg.close();
      if (b.dataset.action === 'delete') {
        dlg.close();
        ui.recipeId = null;
        commit(L.deleteRecipe(state, id), `Deleted ${r.title}`, { undoable: true });
      }
    });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const title = $('#r-title').value.trim();
      if (!title) { $('#r-error').hidden = false; $('#r-title').focus(); return; }
      const data = {
        title,
        servings: $('#r-servings').value,
        prepMin: $('#r-prep').value,
        cookMin: $('#r-cook').value,
        ingredients: L.parseIngredients($('#r-ingredients').value),
        steps: L.parseSteps($('#r-steps').value),
        macros: { kcal: $('#r-kcal').value, protein: $('#r-protein').value, carbs: $('#r-carbs').value, fat: $('#r-fat').value },
        prepNote: $('#r-prepnote').value
      };
      dlg.close();
      if (r) {
        commit(L.updateRecipe(state, id, data), 'Saved');
      } else {
        const res = L.addRecipe(state, data, today());
        ui.recipeId = res.id;
        commit(res.state, `Added ${title}`);
        window.scrollTo(0, 0);
      }
    });
    dlg.showModal();
    if (!r) $('#r-title').focus();
  }

  function exampleBanner() {
    if (!state.example) return '';
    const armed = clearArmed !== null;
    return `<div class="banner">
      <p>These are example items so you can see how it works.</p>
      <button class="btn small ${armed ? 'danger' : ''}" data-action="clear-examples">${armed ? 'Tap again to clear everything' : 'Clear and start fresh'}</button>
    </div>`;
  }

  function pill(iso) {
    const st = L.expiryStatus(iso, today());
    return `<span class="pill pill-${st}">${esc(L.expiryLabel(iso, today()))}</span>`;
  }

  function renderPantry() {
    const t = today();
    const flagged = L.sortByExpiry(L.expiringSoon(state.pantry, t));
    const expired = flagged.filter(i => L.expiryStatus(i.expiry, t) === 'expired').length;
    const soon = flagged.length - expired;
    const parts = [];
    if (soon) parts.push(`${soon} to use within 7 days`);
    if (expired) parts.push(`${expired} past ${expired === 1 ? 'its' : 'their'} date`);

    return `${exampleBanner()}
      ${flagged.length ? `<section class="alert" aria-labelledby="use-soon-h">
        <h2 id="use-soon-h">Use soon <span class="alert-sum">${esc(parts.join(' · '))}</span></h2>
        <ul class="alert-list">${flagged.map(i => `<li>
          <button class="link" data-action="edit-pantry" data-id="${i.id}">${esc(i.name)}</button>${pill(i.expiry)}
        </li>`).join('')}</ul>
      </section>` : ''}
      <div class="toolbar">
        <input id="pantry-search" type="search" placeholder="Search pantry" value="${esc(ui.q)}" aria-label="Search pantry" autocomplete="off">
        <select id="pantry-cat" aria-label="Filter by category">
          <option value="">All categories</option>
          ${L.CATEGORIES.map(c => `<option ${ui.cat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
        </select>
        <button class="btn primary" data-action="new-pantry">Add item</button>
      </div>
      <p class="list-head">Soonest date first</p>
      <ul class="list" id="pantry-list">${renderPantryRows()}</ul>
      ${renderHistory()}`;
  }

  function renderPantryRows() {
    const t = today();
    const q = ui.q.trim().toLowerCase();
    const items = L.sortByExpiry(state.pantry).filter(i =>
      (!ui.cat || i.category === ui.cat) && (!q || i.name.toLowerCase().includes(q)));
    if (!state.pantry.length) return `<li class="empty">Your pantry is empty. Add what you have at home, or tick items off your shopping list to move them here.</li>`;
    if (!items.length) return `<li class="empty">Nothing matches that search.</li>`;
    return items.map(i => {
      const st = L.expiryStatus(i.expiry, t);
      const meta = [L.qtyLabel(i), i.category, i.expiry ? 'Use by ' + L.formatDate(i.expiry) : ''].filter(Boolean).join(' · ');
      return `<li class="row" data-status="${st}">
        <button class="tick" data-action="use" data-id="${i.id}" aria-label="Mark ${esc(i.name)} as used up" title="Used up">${ICON_CHECK}</button>
        <button class="row-main" data-action="edit-pantry" data-id="${i.id}">
          <span class="row-name">${esc(i.name)}</span>
          <span class="row-meta">${esc(meta)}</span>
        </button>
        ${pill(i.expiry)}
      </li>`;
    }).join('');
  }

  function renderHistory() {
    if (!state.history.length) return '';
    const shown = state.history.slice(0, 30);
    return `<details class="history">
      <summary>Used up <span class="muted">(${state.history.length})</span></summary>
      <ul class="list list-quiet">${shown.map(h => `<li class="row">
        <div class="row-main static">
          <span class="row-name">${esc(h.name)}</span>
          <span class="row-meta">${esc([L.qtyLabel(h), 'Used ' + L.formatDate(h.usedAt)].filter(Boolean).join(' · '))}</span>
        </div>
        <button class="btn small" data-action="restore" data-id="${h.id}">Put back</button>
      </li>`).join('')}</ul>
    </details>`;
  }

  function renderShopping() {
    const t = today();
    const toBuy = L.sortShopping(state.shopping.filter(s => s.needed));
    const bought = state.shopping.filter(s => !s.needed).sort((a, b) => (b.lastBought || '').localeCompare(a.lastBought || ''));
    const atHome = toBuy.filter(s => L.findInPantry(s.name, state.pantry).length).length;

    return `${exampleBanner()}
      <form class="quick-add" id="quick-add">
        <input id="quick-add-input" placeholder="Add an item, e.g. Milk 2 L weekly" aria-label="Add to shopping list" autocomplete="off" enterkeyhint="done">
        <button class="btn primary" type="submit">Add</button>
      </form>
      <div class="subbar">
        <button class="btn" data-action="import">Paste a list</button>
        ${atHome ? `<span class="note"><span class="dot" aria-hidden="true"></span>${atHome} ${atHome === 1 ? 'item is' : 'items are'} already at home</span>` : ''}
      </div>
      ${toBuy.length
        ? `<ul class="list">${toBuy.map(s => shopRow(s, t)).join('')}</ul>`
        : `<p class="empty">Nothing to buy. Add items above or paste your weekly list.</p>`}
      ${bought.length ? `<section class="bought">
        <h2 class="list-head">Bought</h2>
        <ul class="list list-quiet">${bought.map(s => boughtRow(s)).join('')}</ul>
      </section>` : ''}`;
  }

  function shopRow(s, t) {
    const have = L.findInPantry(s.name, state.pantry);
    const f = L.frequencyOf(s.frequency);
    const meta = [L.qtyLabel(s), s.category].filter(Boolean).join(' · ');
    const stock = have.map(h => [L.qtyLabel(h), h.expiry ? 'use by ' + L.formatDate(h.expiry) : ''].filter(Boolean).join(', ') || 'some').join('; ');
    return `<li class="row ${have.length ? 'has-stock' : ''}">
      <button class="tick" data-action="buy" data-id="${s.id}" aria-label="Bought ${esc(s.name)}, move it to the pantry" title="Bought">${ICON_CHECK}</button>
      <button class="row-main" data-action="edit-shop" data-id="${s.id}">
        <span class="row-name">${esc(s.name)}</span>
        ${meta ? `<span class="row-meta">${esc(meta)}</span>` : ''}
        ${have.length ? `<span class="stock">At home: ${esc(stock)}</span>` : ''}
      </button>
      ${f.short ? `<span class="chip" title="${esc(f.label)}">${esc(f.short)}</span>` : ''}
    </li>`;
  }

  function boughtRow(s) {
    const due = L.dueDate(s);
    const meta = ['Bought ' + L.formatDate(s.lastBought), due ? 'back on the list ' + L.formatDate(due) : ''].filter(Boolean).join(' · ');
    return `<li class="row">
      <div class="row-main static">
        <span class="row-name">${esc(s.name)}</span>
        <span class="row-meta">${esc(meta)}</span>
      </div>
      <button class="btn small" data-action="add-back" data-id="${s.id}">Add back</button>
    </li>`;
  }

  // ---------- editor dialog ----------
  function openEditor(kind, id) {
    const isPantry = kind === 'pantry';
    const list = isPantry ? state.pantry : state.shopping;
    const item = id ? list.find(x => x.id === id) : null;
    const v = item || { name: '', qty: '', unit: '', category: '', expiry: '', frequency: '' };
    const dlg = $('#editor');
    const title = item ? 'Edit ' + item.name : isPantry ? 'Add to pantry' : 'Add to shopping list';
    dlg.innerHTML = `<form id="editor-form" class="sheet" novalidate>
      <h2>${esc(title)}</h2>
      <label class="field"><span>Name</span>
        <input id="f-name" name="name" required value="${esc(v.name)}" autocomplete="off" placeholder="e.g. Greek yoghurt"></label>
      <div class="field-row">
        <label class="field"><span>Quantity</span>
          <input id="f-qty" name="qty" type="number" inputmode="decimal" min="0" step="any" value="${esc(v.qty ?? '')}"></label>
        <label class="field"><span>Unit</span>
          <select id="f-unit" name="unit">${L.UNITS.map(u => `<option value="${esc(u)}" ${u === v.unit ? 'selected' : ''}>${u ? esc(u) : '—'}</option>`).join('')}</select></label>
      </div>
      <label class="field"><span>Category</span>
        <select id="f-category" name="category">${L.CATEGORIES.map(c => `<option ${c === (v.category || '') ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      ${isPantry ? `<label class="field"><span>Use by</span>
          <input id="f-expiry" name="expiry" type="date" value="${esc(v.expiry || '')}"></label>
        <div class="quick-dates" role="group" aria-label="Set use-by date">
          ${[[3, '+3 days'], [7, '+1 week'], [14, '+2 weeks'], [30, '+1 month'], [180, '+6 months']].map(([n, l]) => `<button type="button" class="btn small" data-days="${n}">${l}</button>`).join('')}
          <button type="button" class="btn small" data-days="">No date</button>
        </div>`
      : `<label class="field"><span>How often I buy it</span>
          <select id="f-frequency" name="frequency">${L.FREQUENCIES.map(f => `<option value="${f.id}" ${f.id === (v.frequency || '') ? 'selected' : ''}>${esc(f.label)}</option>`).join('')}</select></label>`}
      <p class="form-error" id="f-error" hidden>Give the item a name.</p>
      <div class="sheet-actions">
        ${item ? `<button type="button" class="btn danger-text" data-action="delete">Delete</button>` : ''}
        <span class="spacer"></span>
        <button type="button" class="btn" data-action="cancel">Cancel</button>
        <button type="submit" class="btn primary">${item ? 'Save' : 'Add'}</button>
      </div>
    </form>`;

    const form = $('#editor-form');
    const nameInput = $('#f-name');
    if (!item) {
      // Suggest a category from the name until the person picks one.
      let picked = false;
      $('#f-category').addEventListener('change', () => { picked = true; });
      $('#f-category').value = 'Other';
      nameInput.addEventListener('input', () => { if (!picked) $('#f-category').value = L.guessCategory(nameInput.value); });
    }
    form.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.days !== undefined) {
        $('#f-expiry').value = b.dataset.days === '' ? '' : L.addDays(today(), Number(b.dataset.days));
      } else if (b.dataset.action === 'cancel') {
        dlg.close();
      } else if (b.dataset.action === 'delete') {
        dlg.close();
        const next = isPantry ? L.deletePantryItem(state, id) : L.deleteShoppingItem(state, id);
        commit(next, `Deleted ${item.name}`, { undoable: true });
      }
    });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const data = {
        name: nameInput.value.trim(),
        qty: $('#f-qty').value,
        unit: $('#f-unit').value,
        category: $('#f-category').value
      };
      if (!data.name) { $('#f-error').hidden = false; nameInput.focus(); return; }
      if (isPantry) data.expiry = $('#f-expiry').value;
      else data.frequency = $('#f-frequency').value;
      dlg.close();
      if (item) {
        commit(isPantry ? L.updatePantryItem(state, id, data) : L.updateShoppingItem(state, id, data), 'Saved');
      } else if (isPantry) {
        commit(L.addPantryItem(state, data, today()).state, `Added ${data.name} to the pantry`);
      } else {
        const r = L.addShoppingItem(state, data);
        commit(r.state, r.merged ? `${data.name} is back on the list` : `Added ${data.name}`);
      }
    });
    dlg.showModal();
    if (!item) nameInput.focus();
  }

  // ---------- import dialog ----------
  function openImporter() {
    const dlg = $('#importer');
    dlg.innerHTML = `<form id="import-form" class="sheet">
      <h2>Paste your list</h2>
      <p class="hint">One item per line. Add a quantity and how often you buy it if you like:
        <code>Milk 2 L weekly</code>, <code>Eggs x12 every 2 weeks</code>, <code>Rice 1 kg every 2-3 weeks</code>.</p>
      <label class="field"><span class="sr-only">List</span>
        <textarea id="import-text" rows="7" placeholder="Milk 2 L weekly&#10;Bananas 6 weekly&#10;Eggs x12 every 2 weeks"></textarea></label>
      <ul class="preview" id="import-preview" aria-live="polite"></ul>
      <div class="sheet-actions">
        <span class="spacer"></span>
        <button type="button" class="btn" data-action="cancel">Cancel</button>
        <button type="submit" class="btn primary" id="import-go" disabled>Add items</button>
      </div>
    </form>`;
    const ta = $('#import-text');
    const update = () => {
      const rows = L.parseList(ta.value);
      $('#import-go').disabled = !rows.length;
      $('#import-go').textContent = rows.length ? `Add ${rows.length} ${rows.length === 1 ? 'item' : 'items'}` : 'Add items';
      $('#import-preview').innerHTML = rows.map(r => `<li><span>${esc(r.name)}</span><span class="muted">${esc([L.qtyLabel(r), L.frequencyOf(r.frequency).label].filter(Boolean).join(' · '))}</span></li>`).join('');
    };
    ta.addEventListener('input', update);
    $('#import-form').addEventListener('click', e => {
      if (e.target.closest('[data-action="cancel"]')) dlg.close();
    });
    $('#import-form').addEventListener('submit', e => {
      e.preventDefault();
      const rows = L.parseList(ta.value);
      let next = state;
      rows.forEach(r => { next = L.addShoppingItem(next, r).state; });
      dlg.close();
      commit(next, `Added ${rows.length} ${rows.length === 1 ? 'item' : 'items'} to the list`, { undoable: true });
    });
    dlg.showModal();
    ta.focus();
  }

  // ---------- toast ----------
  function showToast(text, action) {
    const el = $('#toast');
    el.innerHTML = `<span>${esc(text)}</span>${action ? `<button class="toast-btn" type="button">${esc(action.label)}</button>` : ''}`;
    el.hidden = false;
    if (action) el.querySelector('button').addEventListener('click', () => { el.hidden = true; action.fn(); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, action ? 6000 : 2500);
  }

  // ---------- events ----------
  function bind() {
    document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
      view = t.dataset.view;
      if (view === 'recipes') ui.recipeId = null;
      S.setPref('view', view);
      render();
      window.scrollTo(0, 0);
    }));

    const main = $('#main');
    main.addEventListener('click', e => {
      const b = e.target.closest('[data-action]');
      if (!b) return;
      const id = b.dataset.id;
      switch (b.dataset.action) {
        case 'new-pantry': openEditor('pantry'); break;
        case 'edit-pantry': openEditor('pantry', id); break;
        case 'edit-shop': openEditor('shopping', id); break;
        case 'import': openImporter(); break;
        case 'new-recipe': openRecipeEditor(); break;
        case 'edit-recipe': openRecipeEditor(id); break;
        case 'open-recipe': ui.recipeId = id; render(); window.scrollTo(0, 0); break;
        case 'back-recipes': ui.recipeId = null; render(); window.scrollTo(0, 0); break;
        case 'open-recipe-from-today':
          view = 'recipes'; ui.recipeId = id; S.setPref('view', view); render(); window.scrollTo(0, 0); break;
        case 'add-missing': {
          const r = state.recipes.find(x => x.id === id);
          const res = L.addMissingToShopping(state, r, today());
          commit(res.state, `Added ${res.added} ${res.added === 1 ? 'item' : 'items'} to the shopping list`, { undoable: true });
          break;
        }
        case 'log-recipe': {
          const r = state.recipes.find(x => x.id === id);
          logged(L.logRecipe(state, r, 1, today()).state, r.title);
          break;
        }
        case 'delete-log': {
          const e = state.log.find(x => x.id === id);
          commit(L.deleteLogEntry(state, id), `Removed ${e.title}`, { undoable: true });
          break;
        }
        case 'edit-targets': {
          const f = $('#targets-form');
          f.hidden = !f.hidden;
          if (!f.hidden) $('#t-kcal').focus();
          break;
        }
        case 'use': {
          const item = state.pantry.find(p => p.id === id);
          commit(L.markUsed(state, id, today()), `${item.name} used up`, { undoable: true });
          break;
        }
        case 'restore': {
          const h = state.history.find(x => x.id === id);
          commit(L.restoreUsed(state, id), `${h.name} is back in the pantry`);
          break;
        }
        case 'buy': {
          const s = state.shopping.find(x => x.id === id);
          const r = L.buyShoppingItem(state, id, today());
          commit(r.state, `${s.name} moved to the pantry`, { action: { label: 'Set use-by date', fn: () => openEditor('pantry', r.id) } });
          break;
        }
        case 'add-back': {
          const s = state.shopping.find(x => x.id === id);
          commit(L.updateShoppingItem(state, id, { needed: true }), `${s.name} is back on the list`);
          break;
        }
        case 'clear-examples': {
          if (clearArmed === null) {
            clearArmed = setTimeout(() => { clearArmed = null; render(); }, 4000);
            render();
          } else {
            clearTimeout(clearArmed);
            clearArmed = null;
            commit(L.emptyState(), 'Cleared. Your pantry and list are empty.');
          }
          break;
        }
      }
    });

    main.addEventListener('input', e => {
      if (e.target.id === 'pantry-search') { ui.q = e.target.value; $('#pantry-list').innerHTML = renderPantryRows(); }
      if (e.target.id === 'recipe-search') { ui.rq = e.target.value; $('#recipe-list').innerHTML = renderRecipeRows(ui.rq.trim().toLowerCase()); }
    });
    main.addEventListener('change', e => {
      if (e.target.id === 'pantry-cat') { ui.cat = e.target.value; $('#pantry-list').innerHTML = renderPantryRows(); }
      const filterKeys = { 'f-sort': 'sort', 'f-time': 'maxMin', 'f-protein': 'minProtein', 'f-kcal': 'maxKcal' };
      if (filterKeys[e.target.id]) {
        ui[filterKeys[e.target.id]] = e.target.value;
        $('#recipe-list').innerHTML = renderRecipeRows(ui.rq.trim().toLowerCase());
      }
    });
    main.addEventListener('submit', e => {
      if (e.target.id === 'targets-form') {
        e.preventDefault();
        commit(L.setTargets(state, { kcal: $('#t-kcal').value, protein: $('#t-protein').value }), 'Targets saved');
        return;
      }
      if (e.target.id === 'log-recipe-form') {
        e.preventDefault();
        const r = state.recipes.find(x => x.id === $('#lr-recipe').value);
        if (r) logged(L.logRecipe(state, r, $('#lr-servings').value, today()).state, r.title);
        return;
      }
      if (e.target.id === 'log-quick-form') {
        e.preventDefault();
        const kcal = $('#lq-kcal').value;
        if (kcal === '') { $('#lq-error').hidden = false; $('#lq-kcal').focus(); return; }
        const title = $('#lq-title').value.trim() || 'Quick entry';
        logged(L.logEntry(state, { title, kcal, protein: $('#lq-protein').value }, today()).state, title);
        return;
      }
      if (e.target.id !== 'quick-add') return;
      e.preventDefault();
      const input = $('#quick-add-input');
      const parsed = L.parseListLine(input.value);
      if (!parsed) { input.focus(); return; }
      const r = L.addShoppingItem(state, parsed);
      commit(r.state, r.merged ? `${parsed.name} is back on the list` : `Added ${parsed.name}`);
      $('#quick-add-input').focus();
    });

    // Close dialogs when tapping the dimmed area outside them.
    document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

    // Bring due items back onto the list when the app is reopened on a later day.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      const next = L.refreshDue(state, today());
      if (next !== state) { state = next; persist(); }
      render(); // a new day resets the Today tab
    });
  }

  init();
})();
