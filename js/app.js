// Larder: user interface. Reads and writes state only through Larder.logic and Larder.storage.
(function () {
  const L = Larder.logic;
  const S = Larder.storage;

  let state;
  let view = 'pantry';
  const ui = { q: '', cat: '' };
  let undoSnapshot = null;
  let toastTimer = null;
  let clearArmed = null;

  const $ = (sel, el) => (el || document).querySelector(sel);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const today = () => L.todayISO();

  const ICON_CHECK = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M5 10.5l3.2 3.2L15 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // ---------- state ----------
  function init() {
    state = S.load() || Larder.seed.create(today());
    state = L.refreshDue(state, today());
    S.save(state);
    const v = S.getPref('view', 'pantry');
    if (v === 'pantry' || v === 'shopping') view = v;
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
    $('#main').innerHTML = view === 'pantry' ? renderPantry() : renderShopping();
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
    });
    main.addEventListener('change', e => {
      if (e.target.id === 'pantry-cat') { ui.cat = e.target.value; $('#pantry-list').innerHTML = renderPantryRows(); }
    });
    main.addEventListener('submit', e => {
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
      if (next !== state) { state = next; persist(); render(); }
    });
  }

  init();
})();
