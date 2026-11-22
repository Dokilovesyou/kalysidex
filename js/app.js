/* Kalysidex app: no build step, no server. Data comes from data/pokemon.js (window.KALYSIDEX.pokemon). */
(() => {
  'use strict';

  const K = window.KALYSIDEX || {};
  const POKEMON = Array.isArray(K.pokemon) ? K.pokemon : [];
  const MOVE_INFO = K.moves || {};          // data/moves.js: details for custom moves
  const ABILITY_INFO = K.abilities || {};   // data/abilities.js: details for custom abilities

  const TYPES = ['Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground',
    'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'];
  const STATS = [['hp', 'HP'], ['atk', 'Atk'], ['def', 'Def'], ['spa', 'SpA'], ['spd', 'SpD'], ['spe', 'Spe']];
  const STAT_MAX = 15;                       // bar scale
  const VIA = [['level', 'Level-up'], ['egg', 'Egg'], ['tm', 'TM'], ['tutor', 'Tutor']];
  const SLOTS = [['basic', 'Basic'], ['advanced', 'Advanced'], ['high', 'High']];
  const SKILL_NAMES = { Athl: 'Athletics', Acro: 'Acrobatics', Percep: 'Perception', Intim: 'Intimidate', Intuit: 'Intuition' };
  const NUMERIC_SORTS = new Set(['hp', 'atk', 'def', 'spa', 'spd', 'spe', 'bst', 'height', 'weight']);

  const app = document.getElementById('app');

  /* ---------- helpers ---------- */
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const key = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const nkey = s => String(s ?? '').toLowerCase().replace(/\(\s*k\s*\)|\bkalysian\b|\bkalysia\b/g, '').replace(/[^a-z0-9]+/g, '');  // "Chikorita (K)" = "Chikorita Kalysian"
  const slug = s => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/['’.]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const num = (x, d = 0) => (Number.isFinite(+x) && x !== null && x !== '' ? +x : d);
  const fmtDex = n => '#' + String(n).padStart(3, '0');
  const capBase = c => String(c).replace(/\.$/, '').replace(/\s*\(.*\)\s*$/, '').replace(/\s+[\d/]+\s*$/, '').trim();
  const unique = arr => [...new Set(arr)];

  const typeChip = (t, link = true) => link
    ? `<a class="type" data-t="${esc(t)}" href="#/?type=${encodeURIComponent(t)}">${esc(t)}</a>`
    : `<span class="type" data-t="${esc(t)}">${esc(t)}</span>`;
  const typeChips = p => `<span class="types">${(p.types || []).map(t => typeChip(t)).join('')}</span>`;
  const imgTag = (p, cls = '', alt = '', thumb = false) => {
    const full = p.image || 'img/placeholder.svg';
    const small = thumb && p.image ? p.image.replace('/pokemon/', '/thumbs/') : full;
    // thumbnail -> full picture -> placeholder, whichever exists
    return `<img class="${cls}" src="${esc(small)}" data-full="${esc(full)}" alt="${esc(alt)}" loading="lazy" onerror="if(this.src.indexOf(this.dataset.full)<0){this.src=this.dataset.full}else{this.onerror=null;this.src='img/placeholder.svg'}">`;
  };
  const pokeLink = p => `#/pokemon/${encodeURIComponent(p.id)}`;

  /* ---------- build indexes ---------- */
  const PICS = K.pictures || {};
  const COLLS = Array.isArray(K.collections) ? K.collections : [];
  const collOf = p => p.collection || (COLLS[0] && COLLS[0].id) || '';
  const collName = id => (COLLS.find(c => c.id === id) || {}).short || id;
  const byId = new Map(), byNameKey = new Map(), byNKey = new Map(), byCollName = new Map(), byGroup = new Map();
  const MOVES = new Map(), ABILITIES = new Map();
  const FACET = { egg: new Set(), habitat: new Set(), diet: new Set(), size: new Set(), cap: new Set(), type: new Set() };

  function moveEntry(name) {
    const k = key(name);
    let m = MOVES.get(k);
    if (!m) { m = { key: k, name, type: null, total: 0, n: { level: 0, tm: 0, egg: 0, tutor: 0 } }; MOVES.set(k, m); }
    return m;
  }
  function learn(p, name, via) {
    if (!name) return null;
    const m = moveEntry(name);
    let arr = p.learn.get(m.key);
    if (!arr) { arr = []; p.learn.set(m.key, arr); m.total++; }
    if (!arr.some(v => v.kind === via.kind)) m.n[via.kind]++;
    arr.push(via);
    return m;
  }

  POKEMON.forEach((p, i) => {
    p.id = p.id || slug(p.name);
    p._order = i;
    p.types = p.types || [];
    p.stats = p.stats || {};
    p.bst = STATS.reduce((n, [k]) => n + num(p.stats[k]), 0);
    p.learn = new Map();
    const mv = p.moves || {};
    (mv.levelUp || []).forEach(e => { const m = learn(p, e.name, { kind: 'level', level: e.level }); if (m && e.type && !m.type) m.type = e.type; });
    (mv.tm || []).forEach(e => learn(p, e.name, { kind: 'tm', no: e.no }));
    (mv.egg || []).forEach(e => learn(p, typeof e === 'string' ? e : e.name, { kind: 'egg' }));
    (mv.tutor || []).forEach(e => learn(p, typeof e === 'string' ? e : e.name, { kind: 'tutor' }));

    p.abilSlots = new Map();
    for (const [slot] of SLOTS) for (const a of (p.abilities && p.abilities[slot]) || []) {
      const k = key(a);
      if (p.abilSlots.has(k)) continue;
      p.abilSlots.set(k, slot);
      let ab = ABILITIES.get(k);
      if (!ab) { ab = { key: k, name: a, total: 0, n: { basic: 0, advanced: 0, high: 0 } }; ABILITIES.set(k, ab); }
      ab.total++; ab.n[slot]++;
    }

    byId.set(p.id, p);
    p.collection = collOf(p);
    if (!p.image && PICS[p.collection]) p.image = PICS[p.collection] + '/pokemon/' + p.id + '.png';   // pictures added later through tools/add-pictures.html
    if (p.formGroup && !byGroup.has(p.collection + '|' + key(p.formGroup))) byGroup.set(p.collection + '|' + key(p.formGroup), p);
    if (!byNameKey.has(key(p.name))) byNameKey.set(key(p.name), p);
    if (!byNKey.has(nkey(p.name))) byNKey.set(nkey(p.name), p);
    if (!byCollName.has(p.collection + '|' + key(p.name))) byCollName.set(p.collection + '|' + key(p.name), p);
    if (!byCollName.has(p.collection + '|n' + nkey(p.name))) byCollName.set(p.collection + '|n' + nkey(p.name), p);
    (p.eggGroups || []).forEach(v => FACET.egg.add(v));
    (p.habitat || []).forEach(v => FACET.habitat.add(v));
    (p.diet || []).forEach(v => FACET.diet.add(v));
    if (p.height && p.height.size) FACET.size.add(p.height.size);
    (p.capabilities || []).forEach(c => { const b = capBase(c); if (b) FACET.cap.add(b); });
    p.types.forEach(t => FACET.type.add(t));
    p._caps = new Set((p.capabilities || []).map(c => capBase(c)));
  });
  // optional move info file overrides/adds move types
  const infoByKey = new Map(Object.entries(MOVE_INFO).map(([n, v]) => [key(n), v]));
  const abilInfoByKey = new Map(Object.entries(ABILITY_INFO).map(([n, v]) => [key(n), v]));
  Object.keys(MOVE_INFO).forEach(n => moveEntry(n));
  Object.keys(ABILITY_INFO).forEach(n => { const k = key(n); if (!ABILITIES.has(k)) ABILITIES.set(k, { key: k, name: n, total: 0, n: { basic: 0, advanced: 0, high: 0 } }); });
  MOVES.forEach(m => { const i = infoByKey.get(m.key); if (i && i.type) m.type = i.type; });
  const moveType = (name, own) => own || (MOVES.get(key(name)) || {}).type || null;

  const dexKey = p => (p.dex != null ? p.dex : 1e6 + p._order);
  const ORDERED = [...POKEMON].sort((a, b) => dexKey(a) - dexKey(b));
  const sortedList = arr => [...arr].sort((a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: 'base' }));

  /* ---------- view helpers ---------- */
  const viaRank = { level: 0, egg: 1, tm: 2, tutor: 3 };
  function viaChip(v) {
    if (v.kind === 'level') return `<span class="via level">Lv ${esc(v.level)}</span>`;
    if (v.kind === 'tm') return `<span class="via tm">TM${v.no ? ' ' + esc(v.no) : ''}</span>`;
    if (v.kind === 'egg') return '<span class="via egg">Egg</span>';
    return '<span class="via tutor">Tutor</span>';
  }
  const levelNum = v => (typeof v.level === 'number' ? v.level : 0);

  function setTheme(type) {
    if (type) document.body.setAttribute('data-theme', type); else document.body.removeAttribute('data-theme');
  }
  const detailRows = rows => `<dl class="info">${rows.filter(r => r[1]).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
  function setTitle(t) { document.title = t ? t + ' · Kalysidex' : 'Kalysidex · Kalysian Pokédex'; }
  function setNav(name) { document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === name)); }

  /* ---------- Pokédex table view (also used for move + ability pages) ---------- */
  const SORT_FIELDS = {
    dex: r => dexKey(r.p),
    name: r => r.p.name.toLowerCase(),
    hp: r => num(r.p.stats.hp), atk: r => num(r.p.stats.atk), def: r => num(r.p.stats.def),
    spa: r => num(r.p.stats.spa), spd: r => num(r.p.stats.spd), spe: r => num(r.p.stats.spe),
    bst: r => r.p.bst,
    height: r => num(r.p.height && r.p.height.m, -1),
    weight: r => num(r.p.weight && r.p.weight.kg, -1),
    learn: r => r.learnLevel
  };
  const SORT_LABELS = [['dex', 'Dex order'], ['name', 'Name'], ['hp', 'HP'], ['atk', 'Attack'], ['def', 'Defense'], ['spa', 'Sp. Attack'],
    ['spd', 'Sp. Defense'], ['spe', 'Speed'], ['bst', 'Base stat total'], ['height', 'Height'], ['weight', 'Weight'], ['learn', 'Level move is learned']];

  function matchKeys(map, text) {
    const k = key(text);
    if (!k) return null;
    if (map.has(k)) return [k];
    return [...map.keys()].filter(x => x.includes(k));
  }

  function applyFilters(st) {
    const nq = key(st.q);
    const typesSel = st.type ? st.type.split(',').filter(Boolean) : [];
    const mKeys = matchKeys(MOVES, st.move);
    const aKeys = matchKeys(ABILITIES, st.ability);
    const rows = [];
    for (const p of POKEMON) {
      if (nq && !key(p.name).includes(nq)) continue;
      if (st.dex && p.collection !== st.dex) continue;
      if (typesSel.length && !typesSel.every(t => p.types.includes(t))) continue;
      if (st.egg && !(p.eggGroups || []).includes(st.egg)) continue;
      if (st.habitat && !(p.habitat || []).includes(st.habitat)) continue;
      if (st.diet && !(p.diet || []).includes(st.diet)) continue;
      if (st.size && !(p.height && p.height.size === st.size)) continue;
      if (st.cap && !p._caps.has(st.cap)) continue;
      const row = { p, via: null, slot: null, learnLevel: 0 };
      if (mKeys) {
        const found = [];
        for (const k of mKeys) {
          const arr = p.learn.get(k);
          if (arr) arr.filter(v => !st.via || v.kind === st.via).forEach(v => found.push(Object.assign({ move: MOVES.get(k).name }, v)));
        }
        if (!found.length) continue;
        found.sort((a, b) => viaRank[a.kind] - viaRank[b.kind] || levelNum(a) - levelNum(b));
        row.via = found;
        const lv = found.filter(v => v.kind === 'level').map(levelNum);
        row.learnLevel = lv.length ? Math.min(...lv) : 9999;
      }
      if (aKeys) {
        const k = aKeys.find(x => p.abilSlots.has(x));
        if (!k) continue;
        row.slot = SLOTS.find(s => s[0] === p.abilSlots.get(k))[1];
      }
      rows.push(row);
    }
    return rows;
  }

  function sortRows(rows, st) {
    const f = SORT_FIELDS[st.sort] || SORT_FIELDS.dex;
    const d = st.dir === 'desc' ? -1 : 1;
    rows.sort((a, b) => {
      const x = f(a), y = f(b);
      const c = typeof x === 'string' ? x.localeCompare(y) : x - y;
      return c ? c * d : SORT_FIELDS.dex(a) - SORT_FIELDS.dex(b);
    });
  }

  function suggestHtml(q) {
    const nq = key(q);
    if (!nq) return '';
    const pk = POKEMON.filter(p => key(p.name).includes(nq)).slice(0, 5);
    const mv = [...MOVES.values()].filter(m => m.key.includes(nq)).slice(0, 5);
    const ab = [...ABILITIES.values()].filter(a => a.key.includes(nq)).slice(0, 5);
    if (!pk.length && !mv.length && !ab.length) return '';
    let h = '';
    if (pk.length) h += '<h4>Pokémon</h4>' + pk.map(p => `<a href="${pokeLink(p)}">${imgTag(p, '', '', true)}<b>${esc(p.name)}</b>${typeChips(p).replace(/href="[^"]*"/g, '')}</a>`).join('');
    if (mv.length) h += '<h4>Moves</h4>' + mv.map(m => `<a href="#/move/${m.key}"><b>${esc(m.name)}</b>${m.type ? typeChip(m.type, false) : ''}<small>${m.total} Pokémon</small></a>`).join('');
    if (ab.length) h += '<h4>Abilities</h4>' + ab.map(a => `<a href="#/ability/${a.key}"><b>${esc(a.name)}</b><small>${a.total} Pokémon</small></a>`).join('');
    return h;
  }

  function viewDex(qs, preset = {}) {
    const base = preset.basePath || '/';
    const defaults = { q: '', dex: '', type: '', ability: '', move: '', via: '', egg: '', habitat: '', diet: '', size: '', cap: '', sort: 'dex', dir: 'asc' };
    const st = Object.assign({}, defaults, Object.fromEntries(new URLSearchParams(qs)));
    if (preset.move) st.move = preset.move;
    if (preset.ability) st.ability = preset.ability;

    if (!POKEMON.length) {
      app.innerHTML = `<div class="panel empty"><h1>No Pokémon yet</h1><p>Add some with <code>tools/add-pokemon.html</code> (see the README), then reload.</p></div>`;
      return;
    }

    const opt = (arr, cur, label) => `<option value="">${label}</option>` + sortedList(arr).map(v => `<option${v === cur ? ' selected' : ''}>${esc(v)}</option>`).join('');
    const typesPresent = TYPES.filter(t => FACET.type.has(t)).concat([...FACET.type].filter(t => !TYPES.includes(t)));
    const selTypes = new Set(st.type.split(',').filter(Boolean));

    app.innerHTML = `
      ${preset.header || ''}
      <section class="panel filters" aria-label="Search and filters">
        <div class="searchbox">
          <label class="sr" for="f-q">Search</label>
          <input id="f-q" type="search" autocomplete="off" placeholder="Search Pokémon, moves or abilities…  (press / to jump here)" value="${esc(st.q)}">
          <div id="suggest" class="suggest" hidden></div>
        </div>
        ${COLLS.length > 1 ? `<div class="dextabs" id="f-dexes" role="group" aria-label="Which Pokédex"><span class="label">Dex</span>
          ${[{ id: '', short: 'All' }].concat(COLLS).map(c => `<button type="button" class="dtab" data-d="${esc(c.id)}" aria-pressed="${st.dex === c.id}">${esc(c.short)} <i>${c.id ? POKEMON.filter(p => p.collection === c.id).length : POKEMON.length}</i></button>`).join('')}
        </div>` : ''}
        <div class="typerow" id="f-types"><span class="label">Type</span>
          ${typesPresent.map(t => `<button type="button" class="type tbtn" data-t="${t}" aria-pressed="${selTypes.has(t)}">${t}</button>`).join('')}
        </div>
        <div class="selects">
          ${preset.ability ? '' : `<label>Ability<input id="f-ability" list="dl-ab" value="${esc(st.ability)}" placeholder="Any"></label>`}
          ${preset.move ? '' : `<label>Learns move<input id="f-move" list="dl-mv" value="${esc(st.move)}" placeholder="Any"></label>`}
          <label>Learned by<select id="f-via"><option value="">Any method</option>${VIA.map(([k, l]) => `<option value="${k}"${st.via === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
          <label>Egg group<select id="f-egg">${opt([...FACET.egg], st.egg, 'Any')}</select></label>
          <label>Habitat<select id="f-habitat">${opt([...FACET.habitat], st.habitat, 'Any')}</select></label>
          <label>Diet<select id="f-diet">${opt([...FACET.diet], st.diet, 'Any')}</select></label>
          <label>Size<select id="f-size">${opt([...FACET.size], st.size, 'Any')}</select></label>
          <label>Capability<select id="f-cap">${opt([...FACET.cap], st.cap, 'Any')}</select></label>
          <div class="sortline">
            <label>Sort by<select id="f-sort">${SORT_LABELS.map(([k, l]) => `<option value="${k}"${st.sort === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
            <button type="button" class="btn" id="f-dir" title="Reverse order" aria-label="Reverse sort order"></button>
          </div>
          <div><button type="button" class="btn" id="f-reset">Reset filters</button></div>
        </div>
        <datalist id="dl-ab">${sortedList([...ABILITIES.values()].map(a => a.name)).map(n => `<option value="${esc(n)}">`).join('')}</datalist>
        <datalist id="dl-mv">${sortedList([...MOVES.values()].map(m => m.name)).map(n => `<option value="${esc(n)}">`).join('')}</datalist>
      </section>
      <div class="summary" id="summary" aria-live="polite"></div>
      <div class="tablewrap" id="results"></div>`;

    const $ = id => document.getElementById(id);
    const sugg = $('suggest'), qInput = $('f-q');

    function read() {
      st.q = qInput.value;
      const dt = document.querySelector('#f-dexes .dtab[aria-pressed="true"]'); st.dex = dt ? dt.dataset.d : '';
      st.type = [...document.querySelectorAll('#f-types .tbtn[aria-pressed="true"]')].map(b => b.dataset.t).join(',');
      if (!preset.ability) st.ability = $('f-ability').value;
      if (!preset.move) st.move = $('f-move').value;
      for (const [id, k] of [['f-via', 'via'], ['f-egg', 'egg'], ['f-habitat', 'habitat'], ['f-diet', 'diet'], ['f-size', 'size'], ['f-cap', 'cap'], ['f-sort', 'sort']]) st[k] = $(id).value;
    }

    function writeUrl() {
      const p = new URLSearchParams();
      for (const k of Object.keys(defaults)) {
        if (preset.move && k === 'move') continue;
        if (preset.ability && k === 'ability') continue;
        if (st[k] && st[k] !== defaults[k]) p.set(k, st[k]);
      }
      const s = p.toString();
      history.replaceState(null, '', '#' + base + (s ? '?' + s : ''));
    }

    function renderResults() {
      const rows = applyFilters(st);
      sortRows(rows, st);
      $('f-dir').textContent = st.dir === 'desc' ? '▼ High → Low' : '▲ Low → High';
      const showVia = !!st.move, showSlot = !!st.ability;
      const multiMove = showVia && matchKeys(MOVES, st.move).length > 1;
      const poolN = st.dex ? POKEMON.filter(p => p.collection === st.dex).length : POKEMON.length;
      $('summary').innerHTML = `<span>Showing <b>${rows.length}</b> of ${poolN} Pokémon${st.dex ? ' in the ' + esc((COLLS.find(c => c.id === st.dex) || {}).name || st.dex) : ''}</span>`;
      if (!rows.length) { $('results').innerHTML = '<div class="empty">No Pokémon match these filters.</div>'; return; }

      const th = (label, k, cls = '') => `<th class="${cls}" scope="col"${st.sort === k ? ` aria-sort="${st.dir === 'desc' ? 'descending' : 'ascending'}"` : ''}><button type="button" data-sort="${k}">${label}</button></th>`;
      $('results').innerHTML = `<table class="dex"><thead><tr>
          <th scope="col" class="c-img"><span class="sr">Picture</span></th>${th('Pokémon', 'name')}<th scope="col">Type</th>
          ${STATS.map(([k, l]) => th(l, k, 'st')).join('')}${th('BST', 'bst', 'st')}
          ${showVia ? '<th scope="col">Learned via</th>' : ''}${showSlot ? '<th scope="col">Ability slot</th>' : ''}
        </tr></thead><tbody>
        ${rows.map(({ p, via, slot }) => `<tr data-pt="${esc(p.types[0] || '')}">
          <td class="c-img"><a href="${pokeLink(p)}" tabindex="-1" aria-hidden="true">${imgTag(p, '', '', true)}</a></td>
          <td class="c-name"><a href="${pokeLink(p)}"><b>${esc(p.name)}</b></a>${COLLS.length > 1 && !st.dex ? `<span class="dexchip">${esc(collName(p.collection))}</span>` : ''}${p.dex != null ? `<span class="dexno">${fmtDex(p.dex)}</span>` : ''}</td>
          <td>${typeChips(p)}</td>
          ${STATS.map(([k]) => { const v = num(p.stats[k]); return `<td class="st" style="--p:${Math.round(Math.min(1, v / STAT_MAX) * 65)}%">${v}</td>`; }).join('')}
          <td class="st bst">${p.bst}</td>
          ${showVia ? `<td class="wrapcell">${viaCell(via, multiMove)}</td>` : ''}${showSlot ? `<td>${esc(slot)}</td>` : ''}
        </tr>`).join('')}
        </tbody></table>`;
    }

    function viaCell(via, multi) {
      const groups = new Map();
      via.forEach(v => { if (!groups.has(v.move)) groups.set(v.move, []); groups.get(v.move).push(v); });
      return [...groups].map(([name, arr]) => (multi ? `<span class="viamove">${esc(name)}</span> ` : '') + arr.map(viaChip).join(' ')).join('<br>');
    }

    const applyTheme = () => { const t = st.type.split(',').filter(Boolean); setTheme(preset.theme || (t.length === 1 ? t[0] : null)); };
    function update() { read(); applyTheme(); renderResults(); writeUrl(); }

    function setSort(k, toggle) {
      if (st.sort === k && toggle) st.dir = st.dir === 'desc' ? 'asc' : 'desc';
      else { st.sort = k; st.dir = NUMERIC_SORTS.has(k) || k === 'learn' && false ? 'desc' : 'asc'; }
      $('f-sort').value = st.sort;
      renderResults(); writeUrl();
    }

    // events
    qInput.addEventListener('input', () => { const h = suggestHtml(qInput.value); sugg.innerHTML = h; sugg.hidden = !h; update(); });
    qInput.addEventListener('focus', () => { const h = suggestHtml(qInput.value); sugg.innerHTML = h; sugg.hidden = !h; });
    qInput.addEventListener('blur', () => setTimeout(() => { sugg.hidden = true; }, 200));
    qInput.addEventListener('keydown', e => { if (e.key === 'Escape') sugg.hidden = true; });
    sugg.addEventListener('mousedown', e => e.preventDefault());
    if ($('f-dexes')) $('f-dexes').addEventListener('click', e => {
      const b = e.target.closest('.dtab'); if (!b) return;
      document.querySelectorAll('#f-dexes .dtab').forEach(x => x.setAttribute('aria-pressed', x === b)); update();
    });
    $('f-types').addEventListener('click', e => {
      const b = e.target.closest('.tbtn'); if (!b) return;
      b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true'); update();
    });
    app.querySelectorAll('.selects select:not(#f-sort), .selects input').forEach(el => el.addEventListener('input', update));
    $('f-sort').addEventListener('change', () => { read(); setSort(st.sort, false); });
    $('f-dir').addEventListener('click', () => { st.dir = st.dir === 'desc' ? 'asc' : 'desc'; renderResults(); writeUrl(); });
    $('results').addEventListener('click', e => { const b = e.target.closest('[data-sort]'); if (b) { read(); setSort(b.dataset.sort, true); } });
    $('f-reset').addEventListener('click', () => { location.hash = '#' + base; });

    applyTheme();
    renderResults();
  }

  /* ---------- move / ability pages ---------- */
  function viewMove(k) {
    const m = MOVES.get(k);
    if (!m) return notFound('move');
    setNav('moves'); setTitle(m.name);
    const info = infoByKey.get(k);
    const header = `<section class="panel hero"><p class="kicker"><a href="#/moves">Moves</a></p>
      <h1>${esc(m.name)} ${m.type ? typeChip(m.type) : ''}</h1>
      <p>Learned by <b>${m.total}</b> Pokémon · Level-up ${m.n.level} · Egg ${m.n.egg} · TM ${m.n.tm} · Tutor ${m.n.tutor}</p>
      ${info ? detailRows([['Frequency', info.frequency], ['Accuracy check', info.ac], ['Damage base', info.damageBase != null ? 'DB ' + info.damageBase + (info.damage ? ' (' + info.damage + ')' : '') : ''],
        ['Class', info.class], ['Range', info.range], ['Effect', info.effect], ['Target effect', info.targetEffect],
        ['Contest', [info.contestType, info.contestEffect].filter(Boolean).join(' · ')]]) : ''}</section>`;
    viewDex(currentQs, { move: m.name, basePath: '/move/' + k, header, theme: m.type });
  }
  function viewAbility(k) {
    const a = ABILITIES.get(k);
    if (!a) return notFound('ability');
    setNav('abilities'); setTitle(a.name);
    const info = abilInfoByKey.get(k);
    const header = `<section class="panel hero"><p class="kicker"><a href="#/abilities">Abilities</a></p>
      <h1>${esc(a.name)}</h1>
      <p>Found on <b>${a.total}</b> Pokémon · Basic ${a.n.basic} · Advanced ${a.n.advanced} · High ${a.n.high}</p>
      ${info ? detailRows([['Frequency', info.frequency], ['Trigger', info.trigger], ['Target', info.target], ['Effect', info.effect]]) : ''}</section>`;
    viewDex(currentQs, { ability: a.name, basePath: '/ability/' + k, header });
  }

  /* ---------- moves + abilities index lists ---------- */
  const listState = { moves: { q: '', sort: 'name', dir: 'asc', type: '' }, abilities: { q: '', sort: 'name', dir: 'asc' } };
  function viewList(kind) {
    const isMoves = kind === 'moves';
    setNav(kind); setTitle(isMoves ? 'Moves' : 'Abilities');
    const s = listState[kind];
    const all = [...(isMoves ? MOVES : ABILITIES).values()];
    const cols = isMoves
      ? [['name', 'Move'], ['type', 'Type'], ['total', 'Pokémon'], ['level', 'Level-up'], ['egg', 'Egg'], ['tm', 'TM'], ['tutor', 'Tutor']]
      : [['name', 'Ability'], ['total', 'Pokémon'], ['basic', 'Basic'], ['advanced', 'Advanced'], ['high', 'High']];
    const val = (r, k) => (k === 'name' ? r.name.toLowerCase() : k === 'type' ? (r.type || '~') : k === 'total' ? r.total : r.n[k]);
    const movetypes = unique(all.map(m => m.type).filter(Boolean));

    app.innerHTML = `<section class="panel hero"><h1>${isMoves ? 'Moves' : 'Abilities'}</h1>
      <p class="muted">${isMoves ? 'Every move that appears in a Kalysian Pokémon\'s move list. Pick one to see who learns it and how.' : 'Every ability used by a Kalysian Pokémon, and which slot it sits in.'}</p></section>
      <section class="panel filters"><div class="selects">
        <label>Search<input id="l-q" type="search" value="${esc(s.q)}" placeholder="Type to filter…"></label>
        ${isMoves ? `<label>Type<select id="l-type"><option value="">Any</option>${sortedList(movetypes).map(t => `<option${s.type === t ? ' selected' : ''}>${t}</option>`).join('')}</select></label>` : ''}
      </div></section>
      <div class="summary" id="l-sum"></div><div class="tablewrap" id="l-res"></div>`;

    const render = () => {
      let rows = all.filter(r => key(r.name).includes(key(s.q)) && (!isMoves || !s.type || r.type === s.type));
      const d = s.dir === 'desc' ? -1 : 1;
      rows.sort((a, b) => { const x = val(a, s.sort), y = val(b, s.sort); const c = typeof x === 'string' ? x.localeCompare(y) : x - y; return c ? c * d : a.name.localeCompare(b.name); });
      document.getElementById('l-sum').innerHTML = `<span>Showing <b>${rows.length}</b> of ${all.length}</span>`;
      const path = isMoves ? 'move' : 'ability';
      document.getElementById('l-res').innerHTML = rows.length ? `<table class="dex"><thead><tr>${cols.map(([k, l]) =>
        `<th scope="col"${s.sort === k ? ` aria-sort="${s.dir === 'desc' ? 'descending' : 'ascending'}"` : ''}><button type="button" data-sort="${k}">${l}</button></th>`).join('')}</tr></thead><tbody>
        ${rows.map(r => `<tr>${cols.map(([k]) => k === 'name' ? `<td><a href="#/${path}/${r.key}"><b>${esc(r.name)}</b></a></td>`
          : k === 'type' ? `<td>${r.type ? typeChip(r.type, false) : '<span class="muted">—</span>'}</td>`
            : `<td class="countlink">${k === 'total' ? r.total : r.n[k]}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '<div class="empty">Nothing matches.</div>';
    };
    document.getElementById('l-q').addEventListener('input', e => { s.q = e.target.value; render(); });
    const t = document.getElementById('l-type'); if (t) t.addEventListener('input', e => { s.type = e.target.value; render(); });
    document.getElementById('l-res').addEventListener('click', e => {
      const b = e.target.closest('[data-sort]'); if (!b) return;
      const k = b.dataset.sort;
      if (s.sort === k) s.dir = s.dir === 'desc' ? 'asc' : 'desc'; else { s.sort = k; s.dir = k === 'name' || k === 'type' ? 'asc' : 'desc'; }
      render();
    });
    render();
  }

  /* ---------- Pokémon detail page ---------- */
  function evoHtml(p) {
    const ev = p.evolution || [];
    if (ev.length < 2) return '<p class="muted">Does not evolve.</p>';
    const stages = unique(ev.map(e => e.stage)).sort((a, b) => a - b);
    const card = e => {
      const q = (key(p.name).startsWith(key(e.name)) && !byCollName.get(p.collection + '|' + key(e.name)) ? p : null) || byCollName.get(p.collection + '|' + key(e.name)) || byCollName.get(p.collection + '|n' + nkey(e.name)) || byGroup.get(p.collection + '|' + key(e.name)) || byGroup.get(p.collection + '|' + nkey(e.name)) || byNameKey.get(key(e.name)) || byNKey.get(nkey(e.name));
      const note = [e.minLevel ? 'Min. level ' + e.minLevel : '', e.note || ''].filter(Boolean).join(' · ');
      const inner = `${q ? imgTag(q, '', '', true) : '<img src="img/placeholder.svg" alt="">'}<b>${esc(e.name)}</b>${note ? `<small>${esc(note)}</small>` : ''}`;
      return q ? `<a class="evo-card${q.id === p.id ? ' is-current' : ''}" href="${pokeLink(q)}">${inner}</a>`
        : `<div class="evo-card unlisted" title="Not in the Kalysidex yet">${inner}</div>`;
    };
    return `<div class="evo">${stages.map((s, i) => (i ? '<div class="evo-arrow" aria-hidden="true">→</div>' : '') +
      `<div class="evo-stage">${ev.filter(e => e.stage === s).map(card).join('')}</div>`).join('')}</div>`;
  }

  function moveLink(name, p, own) {
    const t = moveType(name, own);
    return `<a href="#/move/${key(name)}"${t && p.types.includes(t) ? ' class="stab"' : ''}>${esc(name)}</a>`;
  }

  function viewPokemon(id) {
    const p = byId.get(id);
    if (!p) return notFound('Pokémon');
    setNav('dex'); setTitle(p.name); setTheme(p.types[0]);
    const formTabs = p.formGroup ? POKEMON.filter(x => x.formGroup === p.formGroup && x.collection === p.collection) : [];
    const SIB = ORDERED.filter(x => x.collection === p.collection);
    // every form of a Pokémon shares the same prev/next: the entries before and after the whole group
    const members = p.formGroup ? SIB.filter(x => x.formGroup === p.formGroup) : [p];
    const idx = members.map(x => SIB.indexOf(x));
    const prev = SIB[Math.min(...idx) - 1], next = SIB[Math.max(...idx) + 1];
    const navLink = x => pokeLink(x.formGroup ? (byGroup.get(x.collection + '|' + key(x.formGroup)) || x) : x);
    const navName = x => x.formGroup ? (byGroup.get(x.collection + '|' + key(x.formGroup)) || x).name : x.name;
    const mv = p.moves || {};
    const ab = p.abilities || {};
    const abLinks = list => (list && list.length) ? list.map(a => `<a href="#/ability/${key(a)}" title="${esc((abilInfoByKey.get(key(a)) || {}).effect || '')}">${esc(a)}</a>`).join(', ') : '<span class="muted">—</span>';
    const stBars = STATS.map(([k, l]) => { const v = num(p.stats[k]); return `<div class="statrow"><span class="lab">${l}</span><span class="val">${v}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, v / STAT_MAX * 100)}%"></div></div></div>`; }).join('');
    const g = p.gender;
    const gender = !g ? '—' : g.genderless ? 'Genderless'
      : `${num(g.male)}% ♂ / ${num(g.female)}% ♀<div class="genderbar" role="img" aria-label="${num(g.male)} percent male, ${num(g.female)} percent female"><i class="m" style="width:${num(g.male)}%"></i><i class="f" style="width:${num(g.female)}%"></i></div>`;
    const links = (arr, param) => (arr && arr.length) ? arr.map(v => `<a href="#/?${param}=${encodeURIComponent(v)}">${esc(v)}</a>`).join(', ') : '—';
    const h = p.height || {}, w = p.weight || {};
    const skills = Object.entries(p.skills || {});

    const levelRows = (mv.levelUp || []).map(e => { const t = moveType(e.name, e.type); return `<tr><td>${esc(e.level)}</td><td>${moveLink(e.name, p, e.type)}${e.only ? ` <small class="gonly">${e.only === 'M' ? '♂' : '♀'} only</small>` : ''}</td><td>${t ? typeChip(t, false) : ''}</td></tr>`; }).join('');
    const tmRows = (mv.tm || []).map(e => `<div><span class="no">${esc(e.no || '')}</span>${moveLink(e.name, p)}</div>`).join('');
    const chipList = arr => `<div class="chips">${arr.map(e => { const n = typeof e === 'string' ? e : e.name; const t = moveType(n); return `<a class="chip${t && p.types.includes(t) ? ' stab' : ''}" href="#/move/${key(n)}">${esc(n)}${e.natural ? ' <sup class="nat" title="Natural move (marked (N) in the PTU Pokédex)">N</sup>' : ''}${e.only ? ` <small class="gonly">${e.only === 'M' ? '♂' : '♀'}</small>` : ''}</a>`; }).join('')}</div>`;

    app.innerHTML = `
      <div class="crumbs"><a href="#/">Pokédex</a> › ${esc(p.name)}</div>
      <div class="mon-head">
        <h1>${esc(p.name)}${p.dex != null ? `<span class="dexno">${fmtDex(p.dex)}</span>` : ''}</h1>
        ${typeChips(p)}
        ${COLLS.length > 1 ? `<a class="dexchip big" href="#/?dex=${encodeURIComponent(p.collection)}" title="See this whole dex">${esc((COLLS.find(c => c.id === p.collection) || {}).name || p.collection)}</a>` : ''}
        <span class="grow"></span>
        <div class="prevnext">
          ${prev ? `<a class="btn" href="${navLink(prev)}">‹ ${esc(navName(prev))}</a>` : ''}
          ${next ? `<a class="btn" href="${navLink(next)}">${esc(navName(next))} ›</a>` : ''}
        </div>
      </div>
      ${p.note ? `<p class="panel entrynote">${esc(p.note)}</p>` : ''}
      <div class="mon-grid">
        <div class="col">
          <section class="panel sprite-card">${formTabs.length > 1 ? `<div class="formtabs" role="tablist" aria-label="Forms of ${esc(p.formGroup)}">${formTabs.map(f => `<a role="tab" class="ftab${f.id === p.id ? ' on' : ''}" aria-selected="${f.id === p.id}" href="${pokeLink(f)}">${esc(f.formLabel || f.name)}</a>`).join('')}</div>` : ''}${imgTag(p, '', p.name)}${(p.gallery || []).length ? `<div class="gallery">${p.gallery.map(g => `<img src="${esc(g)}" alt="${esc(p.name)} (another picture)" loading="lazy" onerror="this.remove()">`).join('')}</div>` : ''}${p.artist ? `<p class="credit">Art by ${esc(p.artist)}</p>` : ''}</section>
          <section class="panel"><h2>Base stats</h2>${stBars}<div class="bstline"><span>Total</span><span>${p.bst}</span></div></section>
          <section class="panel"><h2>Abilities</h2><dl class="info">
            <dt>Basic</dt><dd>${abLinks(ab.basic)}</dd><dt>Advanced</dt><dd>${abLinks(ab.advanced)}</dd><dt>High</dt><dd>${abLinks(ab.high)}</dd></dl></section>
          <section class="panel"><h2>Evolution</h2>${evoHtml(p)}</section>
          <section class="panel"><h2>Size &amp; breeding</h2><dl class="info">
            <dt>Height</dt><dd>${[h.ft, h.m != null ? h.m + ' m' : ''].filter(Boolean).join(' / ') || '—'}${h.size ? ` <a class="chip" href="#/?size=${encodeURIComponent(h.size)}">${esc(h.size)}</a>` : ''}</dd>
            <dt>Weight</dt><dd>${[w.lbs != null ? w.lbs + ' lbs' : '', w.kg != null ? w.kg + ' kg' : ''].filter(Boolean).join(' / ') || '—'}${w.class != null ? ` <span class="chip">Weight class ${esc(w.class)}</span>` : ''}</dd>
            <dt>Gender</dt><dd>${gender}</dd>
            <dt>Egg group</dt><dd>${links(p.eggGroups, 'egg')}</dd>
            <dt>Hatch rate</dt><dd>${p.hatchDays != null ? esc(p.hatchDays) + ' days' : '—'}</dd>
            <dt>Diet</dt><dd>${links(p.diet, 'diet')}</dd>
            <dt>Habitat</dt><dd>${links(p.habitat, 'habitat')}</dd></dl></section>
        </div>
        <div class="col">
          <section class="panel"><h2>Capabilities</h2><div class="chips">${(p.capabilities || []).map(c => `<a class="chip" href="#/?cap=${encodeURIComponent(capBase(c))}">${esc(c)}</a>`).join('') || '—'}</div></section>
          <section class="panel"><h2>Skills</h2>${skills.length ? `<dl class="skills">${skills.map(([k, v]) => `<div><dt>${esc(SKILL_NAMES[k] || k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : '—'}</section>
          <section class="panel"><h2>Moves</h2>
            <h3>Level-up</h3>${levelRows ? `<table class="moves"><thead><tr><th>Lv</th><th>Move</th><th>Type</th></tr></thead><tbody>${levelRows}</tbody></table>` : '<p class="muted">None listed.</p>'}
            <h3>TM / HM</h3>${tmRows ? `<div class="tmgrid">${tmRows}</div>` : '<p class="muted">None listed.</p>'}
            <h3>Egg moves</h3>${(mv.egg || []).length ? chipList(mv.egg) : '<p class="muted">None listed.</p>'}
            <h3>Tutor moves</h3>${(mv.tutor || []).length ? chipList(mv.tutor) : '<p class="muted">None listed.</p>'}
            <p class="legend">Bold moves match this Pokémon's type (STAB).</p>
          </section>
        </div>
      </div>`;
  }

  function notFound(what) {
    setNav(''); setTitle('Not found');
    app.innerHTML = `<div class="panel empty"><h1>Couldn't find that ${esc(what || 'page')}</h1><p><a href="#/">Back to the Pokédex</a></p></div>`;
  }

  /* ---------- router ---------- */
  let currentQs = '';
  function route() {
    const raw = location.hash.replace(/^#/, '') || '/';
    const qi = raw.indexOf('?');
    const path = qi < 0 ? raw : raw.slice(0, qi);
    currentQs = qi < 0 ? '' : raw.slice(qi + 1);
    const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
    window.scrollTo(0, 0);
    setTheme(null);
    try {
      if (!parts.length) { setNav('dex'); setTitle(''); viewDex(currentQs); }
      else if (parts[0] === 'pokemon' && parts[1]) viewPokemon(parts[1]);
      else if (parts[0] === 'moves') viewList('moves');
      else if (parts[0] === 'abilities') viewList('abilities');
      else if (parts[0] === 'move' && parts[1]) viewMove(parts[1]);
      else if (parts[0] === 'ability' && parts[1]) viewAbility(parts[1]);
      else notFound();
    } catch (err) {
      console.error(err);
      app.innerHTML = `<div class="panel empty"><h1>Something went wrong</h1><p>${esc(err.message)}</p><p>Check the browser console (F12) for details. A typo in data/pokemon.js is the usual cause.</p></div>`;
    }
  }
  window.addEventListener('hashchange', route);
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) {
      const q = document.getElementById('f-q');
      if (q) { e.preventDefault(); q.focus(); }
    }
  });
  route();
})();
