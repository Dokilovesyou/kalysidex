/*
 * Kalysidex entry parser
 * Turns a pasted entry (the layout used in the Kalysian Pokémon docs) into a data object,
 * and writes the data/pokemon.js file. Works in the browser and in Node.
 */
(function (root) {
  'use strict';

  const TYPES = ['Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground',
    'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'];

  const slug = s => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/['’.]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const titleCase = s => s.trim().toLowerCase().replace(/(^|[\s-])([a-z])/g, (m, a, b) => a + b.toUpperCase());

  // Split on commas that are not inside parentheses: "Naturewalk (Forest, Swamp), Darkvision"
  function splitTop(s) {
    const out = []; let depth = 0, cur = '';
    for (const ch of s) {
      if (ch === '(') depth++;
      if (ch === ')') depth = Math.max(0, depth - 1);
      if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out.filter(Boolean);
  }

  // Join wrapped lines back into one comma list
  function joinLines(lines) {
    let s = '';
    for (const l of lines) {
      if (!s) { s = l; continue; }
      const open = (s.match(/\(/g) || []).length > (s.match(/\)/g) || []).length;
      s += (s.endsWith(',') || open) ? ' ' + l : ', ' + l;
    }
    return s;
  }

  // TM lists: a new line starting with a TM number is a new item; anything else continues the last move name
  function joinTm(lines) {
    let s = '';
    for (const l of lines) {
      if (!s) { s = l; continue; }
      if (s.endsWith(',')) s += ' ' + l;
      else if (/^[A-Za-z]?\d+\s+\S/.test(l)) s += ', ' + l;
      else s += ' ' + l;
    }
    return s;
  }

  const SECTION_RE = /^(base stats|basic information|evolutions?|size information|breeding information|capabilit(?:y|ies)(?: list)?|skills?(?: list)?|moves?(?: list)?|level[- ]?up(?: move)?(?: list| moves)?|tm ?\/ ?hm(?: move)?(?: list| moves)?|tm(?: move)?(?: list| moves)?|egg(?: move)?(?: list| moves)?|(?:move )?tutor(?: move)?(?: list| moves)?)\s*:?$/i;

  function canon(h) {
    h = h.toLowerCase().replace(/[:\s]+$/, '');
    if (h.startsWith('base stats')) return 'stats';
    if (h.startsWith('basic information')) return 'info';
    if (h.startsWith('evolution')) return 'evo';
    if (h.startsWith('size')) return 'size';
    if (h.startsWith('breeding')) return 'breeding';
    if (h.startsWith('capabilit')) return 'cap';
    if (h.startsWith('skill')) return 'skills';
    if (/tutor/.test(h)) return 'tutor';
    if (/^tm/.test(h)) return 'tm';
    if (/^egg/.test(h)) return 'egg';
    if (/^level/.test(h)) return 'level';
    return 'movehdr';
  }

  const normKey = k => k.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

  const statNames = usesS => ({
    hp: ['hp', 'health'],
    atk: ['attack', 'atk'],
    def: ['defense', 'def'],
    spa: ['special attack', 'sp atk', 'spatk', 'satk', 'spa', 'sp attack', 'special atk'],
    spd: ['special defense', 'sp def', 'spdef', 'sdef', 'sp defense', 'special def'].concat(usesS ? [] : ['spd']),
    spe: ['speed', 'spe'].concat(usesS ? ['spd'] : [])
  });

  // Clean up the doc's habits: plurals/typos in habitats, diets and egg groups
  const FIX_TERMS = { marshs: 'Marsh', forests: 'Forest', caves: 'Cave', mountains: 'Mountain', grasslands: 'Grassland',
    swamps: 'Swamp', artic: 'Arctic', humanshape: 'Human-Shape', carnivoire: 'Carnivore' };
  const fixTerm = s => { const t = titleCase(s.replace(/^and\s+/i, '')); return FIX_TERMS[t.toLowerCase()] || t; };

  const SKILL_ABBR = { athletics: 'Athl', acrobatics: 'Acro', perception: 'Percep', intimidate: 'Intim', intuition: 'Intuit', survival: 'Surv' };

  // Typos found in the doc's capability lists
  const CAP_FIX = { phashing: 'Phasing', swin: 'Swim', packmon: 'Pack Mon', wallclimber: 'Wall Climber' };
  const fixCap = c => {
    c = c.replace(/\.$/, '').trim();
    const m = c.match(/^([A-Za-z ]+?)(\s+[\d/]+)?$/);
    const f = m && CAP_FIX[m[1].toLowerCase().replace(/\s/g, '')];
    return f ? f + (m[2] || '') : c;
  };

  function topComma(s) {
    let d = 0;
    for (let i = 0; i < s.length; i++) { const c = s[i]; if (c === '(') d++; else if (c === ')') d = Math.max(0, d - 1); else if (c === ',' && d === 0) return i; }
    return -1;
  }

  const cleanArtist = a => (a ? a.replace(/^credits?\s*:?\s*/i, '').replace(/^.*\bLine\s*-\s*/i, '').trim() || undefined : undefined);

  function parseLevelMove(line) {
    const gm = String(line).match(/^\s*\(([MF])\)\s*/i);   // "(M) 28 Charm - Fairy": only learned by one gender
    if (gm) { const r = parseLevelMove(String(line).slice(gm[0].length)); if (r) r.only = gm[1].toUpperCase(); return r; }
    line = String(line).replace(/^[^A-Za-z0-9]+/, '').replace(/^0(?=evo\b)/i, '');   // "§ 12 Move", "0Evo - Move"
    const m = line.match(/^(\d+|evo|start)\b\s*[-–:.)]?\s*(.+)$/i);
    if (!m) return null;
    const level = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : titleCase(m[1]);
    let rest = m[2].trim(), type = null;
    const t = rest.match(/^(.*?)\s*[-–]\s*([A-Za-z]+)\s*$/);
    if (t && TYPES.includes(titleCase(t[2]))) { rest = t[1].trim(); type = titleCase(t[2]); }
    return type ? { level, name: rest, type } : { level, name: rest };
  }

  function parseEntry(raw, opts = {}) {
    const warnings = [];
    const text = String(raw).replace(/\r/g, '').replace(/ /g, ' ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
    const lines = text.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);

    let name = null, start = 0;
    if (lines.length && !lines[0].includes(':') && !SECTION_RE.test(lines[0])) { name = lines[0]; start = 1; }

    const buckets = { cap: [], skills: [], level: [], tm: [], egg: [], tutor: [], evo: [] };
    const kv = {};
    let sec = null;
    for (const line of lines.slice(start)) {
      if (SECTION_RE.test(line)) { sec = canon(line); continue; }
      if (sec && buckets[sec]) { buckets[sec].push(line); continue; }
      const ac = !sec && line.match(/^(?:(?:artist|art|picture)\s+credit|original\s+artist|picture)\s*[-–—:]?\s*(.*)$/i);
      if (ac) { if (ac[1].trim()) kv['artist credit'] = ac[1].trim(); continue; }   // "Artist Credit - Name", "Artist Credit– Name"
      const m = line.match(/^([^:]{1,40}):\s*(.*)$/);
      if (m) kv[normKey(m[1])] = m[2].trim();
      else {
        const m2 = line.match(/^(height|weight)\s+(\S.*)$/i);
        if (m2) kv[m2[1].toLowerCase()] = m2[2].trim();
        else if (!sec && !kv['credit line']) kv['credit line'] = line;   // e.g. "@EXDragonith", "Credit Nyjee & Eiddiw"
      }
    }
    const get = (...names) => { for (const n of names) if (kv[n] !== undefined && kv[n] !== '') return kv[n]; };

    if (!name) name = get('name', 'pokemon');
    if (!name) warnings.push('Could not find a name (it should be the first line).');
    name = name ? name.trim() : 'Unnamed';
    const id = opts.id || slug(name);

    // Base stats
    const stats = {};
    const usesS = kv['satk'] !== undefined || kv['sdef'] !== undefined;
    for (const [k, names] of Object.entries(statNames(usesS))) {
      const v = parseInt(get(...names), 10);
      if (Number.isNaN(v)) warnings.push('Missing base stat: ' + k.toUpperCase()); else stats[k] = v;
    }

    // Types
    const types = (get('type', 'types') || '').split(/[\/,&]/).flatMap(t => { t = t.trim(); const w = t.split(/\s+/); return w.length > 1 && w.every(x => TYPES.includes(titleCase(x))) ? w : [t]; }).map(titleCase).filter(Boolean);
    if (!types.length) warnings.push('No type found.');
    types.filter(t => !TYPES.includes(t) && t !== '???').forEach(t => warnings.push('Unknown type: ' + t));

    // Abilities
    const abilities = { basic: [], advanced: [], high: [] };
    Object.keys(kv).sort().forEach(k => {
      const v = kv[k];
      if (!v || /^(none|n\/a|-|—)$/i.test(v)) return;
      if (/^basic ability/.test(k)) abilities.basic.push(v);
      else if (/^(adv|advanced) ability/.test(k)) abilities.advanced.push(v);
      else if (/^high ability/.test(k)) abilities.high.push(v);
    });
    if (!abilities.basic.length && !abilities.advanced.length && !abilities.high.length) warnings.push('No abilities found.');

    // Evolution
    const evolution = [];
    for (const line of buckets.evo) {
      const m = line.match(/^(\d+)\s*[-–.:)]\s*(.+)$/);
      if (!m) continue;
      const stage = parseInt(m[1], 10);
      const rest = m[2].trim().replace(/\b(min\w*\.?)\s+(level|lvl\.?)\b/i, '$1');   // "Minimum Level 40"
      const e = rest.match(/^(.*?)\s*[-–(]?\s*(?:min\w*\.?|level|lvl\.?)\s*(\d+)\)?\s*(.*)$/i);
      let nm = rest, note = '', minLevel;
      if (e) { nm = e[1]; minLevel = parseInt(e[2], 10); note = e[3] || ''; }
      else { const ci = topComma(rest); if (ci >= 0) { nm = rest.slice(0, ci); note = rest.slice(ci + 1); } }
      const entry = { stage, name: nm.replace(/[-–(\s]+$/, '').trim() };
      if (minLevel !== undefined) entry.minLevel = minLevel;
      note = note.replace(/^[\s,;.\-–]+/, '').trim();
      if (note) entry.note = note;
      evolution.push(entry);
    }

    // Size
    let height, weight;
    const h = get('height');
    if (h) {
      const ft = h.match(/(\d+)\s*'\s*(\d+)?/), m = h.match(/([\d.]+)\s*m\b/i), s = h.match(/\(([^)]+)\)/);
      height = {};
      if (ft) height.ft = ft[1] + "' " + (ft[2] || '0') + '"';
      if (m) height.m = parseFloat(m[1]);
      if (s) height.size = titleCase(s[1]);
    }
    const w = get('weight');
    if (w) {
      const lb = w.match(/([\d.]+)\s*lbs?/i), kg = w.match(/([\d.]+)\s*kg/i), c = w.match(/\((\d+)\)/);
      weight = {};
      if (lb) weight.lbs = parseFloat(lb[1]);
      if (kg) weight.kg = parseFloat(kg[1]);
      if (c) weight.class = parseInt(c[1], 10);
    }

    // Breeding
    let gender;
    const g = get('gender ratio', 'gender');
    if (g) {
      if (/genderless|no gender|none/i.test(g)) gender = { genderless: true };
      else {
        const mm = g.match(/([\d.]+)\s*%?\s*(?:m\b|male)/i), ff = g.match(/([\d.]+)\s*%?\s*(?:f\b|female)/i);
        gender = {};
        if (mm) gender.male = parseFloat(mm[1]);
        if (ff) gender.female = parseFloat(ff[1]);
      }
    }
    const list = v => (v || '').split(/[,\/]/).map(s => s.trim()).filter(Boolean);
    const eggGroups = list(get('egg group', 'egg groups')).map(fixTerm).filter(Boolean);
    const hatch = parseInt(get('average hatch rate', 'hatch rate', 'hatch'), 10);
    const diet = list(get('diet')).map(fixTerm).filter(Boolean);
    const habitat = list(get('habitat', 'habitats')).map(fixTerm).filter(Boolean);

    // Capabilities & skills
    const capabilities = splitTop(joinLines(buckets.cap).replace(/,\s*\(/g, ' (')
      .replace(/(\d)\.\s*(?=[A-Za-z])/g, '$1, ').replace(/\.\s*$/, '')
      .replace(/\)\s+(?=[A-Z])/g, '), ').replace(/(\d)\s+(?=[A-Z])/g, '$1, ')).map(fixCap);
    const skills = {};
    const skillText = joinLines(buckets.skills).replace(/\|/g, 'l');
    for (const m of skillText.matchAll(/([A-Za-z][A-Za-z:' ]*?)\s*(\d+d\d+(?:\s*[+-]\s*\d+)?)/g)) {
      let k = m[1].trim();
      k = SKILL_ABBR[k.toLowerCase()] || k;
      skills[k] = m[2].replace(/\s+/g, '');
    }

    // Moves
    const levelUp = [];
    for (const line of buckets.level) {
      const mv = parseLevelMove(line);
      if (mv) levelUp.push(mv); else warnings.push('Could not read level-up move: "' + line + '"');
    }
    const tm = splitTop(joinTm(buckets.tm)).filter(s => !/^(none|n\/a|-|—)$/i.test(s)).map(s => {
      const m = s.match(/^(?:tm\s*)?([A-Za-z]?\d+)\s*[-–:]?\s*(.+)$/i);
      return m ? { no: m[1].toUpperCase(), name: m[2].trim() } : { name: s };
    });
    const notNone = s => !/^(none|n\/a|-|—)$/i.test(s) && !/^[_\-–—=\s]+$/.test(s);
    const egg = splitTop(joinLines(buckets.egg)).filter(notNone);
    const tutor = splitTop(joinLines(buckets.tutor)).filter(notNone);
    if (!levelUp.length && !tm.length && !egg.length && !tutor.length) warnings.push('No moves found.');

    const pokemon = {
      id, name,
      dex: parseInt(get('dex', 'dex number', 'dex no', 'national dex', 'kalysia dex'), 10) || undefined,
      image: 'img/pokemon/' + id + '.png',
      artist: cleanArtist(get('artist credit', 'artist', 'art credit', 'credit', 'original artist', 'picture', 'credit line')),
      types, stats, abilities, evolution,
      height, weight, gender,
      eggGroups, hatchDays: Number.isNaN(hatch) ? undefined : hatch, diet, habitat,
      capabilities, skills,
      moves: { levelUp, tm, egg, tutor }
    };
    return { pokemon, warnings };
  }

  // ---- whole-document import ----
  // Finds every "Base Stats:" block, walks back to the Pokémon's name line, and cuts the text into entries.
  // Stops at the Rotom / New Moves / New Abilities sections, which use different layouts.
  const STOP_RE = /^\s*(Rotom( Forms)?|New Moves|New Abilities)\s*$/i;
  function splitEntries(raw) {
    const lines = String(raw).replace(/\r/g, '').replace(/ /g, ' ').split('\n');
    const starts = [];
    const STAT_LINE = /^\s*(hp|health|attack|atk|defense|def|special\s*\w*|sp\.?\s*\w+|satk|sdef|speed|spe|spd)\s*:/i;
    const ARTIST = /^\s*(artist|art) credit/i;
    let cur = null;
    for (let i = 0; i < lines.length; i++) {
      const isStats = /^\s*Base Stats\s*:?\s*$/i.test(lines[i]);
      const isInfo = /^\s*Basic Information\s*:?\s*$/i.test(lines[i]);
      if (!isStats && !isInfo) continue;
      if (isInfo && cur && !cur.info) { cur.info = true; continue; }   // normal: Base Stats, then Basic Information
      // New entry. (Some entries have no "Base Stats:" header, so "Basic Information" can start one too.)
      let j = -1;
      for (let k = i - 1; k >= Math.max(0, i - 10); k--) {   // the name is the line right before the picture (a blank-looking line)
        const t = lines[k].trim();
        if (t && /^[ \t]+$/.test(lines[k + 1] || '') && t.length <= 60 && !/^\d/.test(t) && !/,/.test(t) && !ARTIST.test(t) && !STAT_LINE.test(t)) { j = k; break; }
      }
      if (j < 0) { j = i - 1; while (j >= 0 && (!lines[j].trim() || ARTIST.test(lines[j]) || (isInfo && STAT_LINE.test(lines[j])))) j-- ; }
      if (j >= 0) { starts.push(j); cur = { info: isInfo }; }
    }
    let end = lines.length;
    for (let i = (starts.length ? starts[starts.length - 1] : 0) + 1; i < lines.length; i++) if (STOP_RE.test(lines[i])) { end = i; break; }
    return starts.map((s, k) => lines.slice(s, k + 1 < starts.length ? starts[k + 1] : end).join('\n'));
  }

  // Some entries have a heading or credit where the name should be ("Maenidie Line - PlayFurry", "Credit ...",
  // "Brontan - Neck Fossil"). Recover the real name from the entry's own evolution line.
  const nameKey = s => String(s).toLowerCase().replace(/\(\s*k\s*\)|\bkalysian\b|\bkalysia\b/g, '').replace(/[^a-z0-9]+/g, '');
  const badName = n => /^unnamed$/i.test(n) || /^credit\b/i.test(n) || /\bline\b/i.test(n);
  function repairNames(items) {
    for (const it of items) {
      const p = it.pokemon, chain = p.evolution.map(e => nameKey(e.name));
      if (/^credit\b/i.test(p.name) && !p.artist) p.artist = p.name.replace(/^credit:?\s*/i, '').trim();
      const lm = p.name.match(/\bLine\s*-\s*(.+)$/i);            // "Maenidie Line - PlayFurry"
      if (lm && !p.artist) p.artist = lm[1].trim();
      if (!badName(p.name) && / - /.test(p.name) && !/\bforme?\b/i.test(p.name)) {   // keep "Eidolon - Monarch Forme" whole
        const part = p.name.split(/\s+-\s+/).find(x => chain.includes(nameKey(x)));
        if (part) p.name = part.trim();
      }
    }
    const used = new Set(items.filter(it => !badName(it.pokemon.name)).map(it => nameKey(it.pokemon.name)));
    for (const it of items) {
      const p = it.pokemon;
      if (!badName(p.name)) continue;
      const old = p.name, c = p.evolution.find(e => !used.has(nameKey(e.name)));
      if (c) { p.name = c.name; used.add(nameKey(c.name)); it.warnings.push('Name was "' + old + '"; used "' + c.name + '" from the evolution line. Please double-check.'); }
      else it.warnings.push('Could not work out this Pokémon\'s name (it was "' + old + '").');
    }
  }

  function parseDex(raw) {
    const items = splitEntries(raw).map(b => parseEntry(b));
    repairNames(items);
    const out = [], report = [], seen = new Set();
    for (const { pokemon, warnings } of items) {
      pokemon.id = slug(pokemon.name);
      let id = pokemon.id, n = 2;
      while (seen.has(id)) id = pokemon.id + '-' + n++;
      if (id !== pokemon.id) warnings.push('Duplicate name, id changed to "' + id + '"');
      pokemon.id = id; pokemon.image = 'img/pokemon/' + id + '.png';
      seen.add(id);
      out.push(pokemon);
      if (warnings.length) report.push({ name: pokemon.name, warnings });
    }
    return { pokemon: out, report };
  }

  // ---- Google Docs "Web page (.html)" export: text + pictures in document order ----
  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', hellip: '…', sect: '§', auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß', eacute: 'é', egrave: 'è', Eacute: 'É', aacute: 'á', agrave: 'à', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', ccedil: 'ç', times: '×', deg: '°', hearts: '♥', middot: '·', bull: '•' };
  const decodeEnt = s => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
    const v = ENT[e] !== undefined ? ENT[e] : ENT[e.toLowerCase()]; return v !== undefined ? v : m;
  });
  function htmlToSeq(html) {
    const body = String(html).replace(/<(style|script)[\s\S]*?<\/\1>/gi, '').replace(/<head[\s\S]*?<\/head>/i, '');
    const seq = []; let buf = '';
    const flush = blank => { const t = decodeEnt(buf).replace(/\s+/g, ' ').trim(); if (t) seq.push({ t }); else if (blank && seq.length && seq[seq.length - 1].t !== '') seq.push({ t: '' }); buf = ''; };   // empty paragraphs become blank lines
    const re = /<\/?([a-z0-9]+)([^>]*)>|([^<]+)/gi; let m;
    while ((m = re.exec(body))) {
      if (m[3] !== undefined) { buf += m[3]; continue; }
      const tag = m[1].toLowerCase();
      if (/^(p|div|h[1-6]|li|tr|br|table)$/.test(tag)) flush(m[0][1] === '/' && tag === 'p');
      if (tag === 'img') { flush(); const s = m[2].match(/\ssrc\s*=\s*"([^"]*)"/i); if (s) seq.push({ img: decodeEnt(s[1]) }); }
    }
    flush();
    return seq;
  }
  // pictures that belong to each entry: the ones just before its "Base Stats" header
  function mapImages(seq) {
    const heads = []; let cur = null, end = seq.length;
    seq.forEach((x, i) => {
      if (x.t === undefined) return;
      const stats = /^Base Stats\s*:?$/i.test(x.t), info = /^Basic Information\s*:?$/i.test(x.t);
      if (stats || info) {
        if (info && cur && !cur.info) { cur.info = true; return; }
        heads.push(i); cur = { info };
      }
    });
    for (let i = heads.length ? heads[heads.length - 1] : 0; i < seq.length; i++) if (seq[i].t !== undefined && STOP_RE.test(seq[i].t)) { end = i; break; }
    let tocEnd = -1;   // last "Name...3" table-of-contents line before the first entry
    for (let i = 0; i < (heads[0] || 0); i++) if (seq[i].t !== undefined && /(\.{2,}|…)\s*\d+\s*$/.test(seq[i].t)) tocEnd = i;
    const per = heads.map(() => []);
    seq.forEach((x, i) => {
      if (x.img === undefined || i >= end) return;
      const k = heads.findIndex(h => h > i);
      if (k >= 0 && i > tocEnd) per[k].push(x.img);   // banners on the title page / table of contents belong to nobody
    });
    return per;
  }
  // Everything from one exported .html file: Pokémon, moves, abilities and which picture goes with whom
  function parseHtmlDoc(html) {
    const seq = htmlToSeq(html);
    const raw = seq.map(x => (x.img !== undefined ? '  ' : x.t)).join('\n');
    const d = parseDex(raw), s = parseSections(raw), per = mapImages(seq);
    const warnings = [];
    if (per.length !== d.pokemon.length) warnings.push('Found ' + d.pokemon.length + ' Pokémon but ' + per.length + ' entries when matching pictures; pictures were not matched.');
    const images = d.pokemon.map((p, k) => (per.length === d.pokemon.length && per[k].length ? per[k][per[k].length - 1] : null));
    const extraImages = d.pokemon.map((p, k) => (per.length === d.pokemon.length ? per[k].slice(0, -1) : []));
    return { pokemon: d.pokemon, report: d.report, moves: s.moves, abilities: s.abilities, images, extraImages, warnings };
  }

  // ---- MOVES / ABILITIES sections ("Move: Tidal Fist / Type: Water / Frequency: ..." blocks) ----
  function parseBlocks(lines, kind) {
    const startRe = new RegExp('^' + kind + '\\s*:\\s*(.+)$', 'i');
    const camel = k => k.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim().replace(/ +(\w)/g, (m, c) => c.toUpperCase());
    const blocks = []; let cur = null, lastKey = null, gap = false;
    for (const raw of lines) {
      const line = raw.replace(/\s+/g, ' ').trim();
      if (!line) { gap = true; continue; }
      const st = line.match(startRe);
      const kv = line.match(/^([A-Za-z][A-Za-z0-9 ]{0,30}?)\s*:\s*(.*)$/);
      const titleLike = !kv && line.length <= 40 && !/[.!?]$/.test(line);
      if (st) { cur = { name: st[1].trim(), f: {} }; blocks.push(cur); lastKey = null; }
      else if (gap && cur && Object.keys(cur.f).length && titleLike) { cur = { name: line, f: {} }; blocks.push(cur); lastKey = null; }  // ability title without "Ability:"
      else if (!cur) { /* text before the first block */ }
      else if (kv) {
        const k = normKey(kv[1]), v = kv[2].trim();
        const db = k.match(/^damage base (\d+)$/);
        if (db) { cur.f.damageBase = parseInt(db[1], 10); if (v) cur.f.damage = v; lastKey = v ? 'damage' : null; }
        else { lastKey = camel(kv[1]); cur.f[lastKey] = v; }
      } else if (!Object.keys(cur.f).length) { cur.f.frequency = line; lastKey = 'frequency'; }
      else if (lastKey) cur.f[lastKey] = (cur.f[lastKey] + ' ' + line).trim();
      gap = false;
    }
    return blocks.map(b => {
      const o = { name: b.name };
      for (const [k, v] of Object.entries(b.f)) {
        if (v === '' || v === undefined) continue;
        o[k] = (k === 'type' && TYPES.includes(titleCase(v))) ? titleCase(v) : v;
      }
      return o;
    });
  }

  function parseSections(raw) {
    const L = String(raw).replace(/\r/g, '').split('\n');
    const mi = L.findIndex(l => /^\s*MOVES\s*$/.test(l)), ai = L.findIndex(l => /^\s*ABILITIES\s*$/.test(l));
    return {
      moves: mi >= 0 ? parseBlocks(L.slice(mi + 1, ai > mi ? ai : undefined), 'Move') : [],
      abilities: ai >= 0 ? parseBlocks(L.slice(ai + 1), 'Ability') : []
    };
  }

  function toDictFile(prop, list, comment) {
    return '// ' + comment + '\nwindow.KALYSIDEX = window.KALYSIDEX || {};\nwindow.KALYSIDEX.' + prop + ' = {\n' +
      list.map(x => { const { name, ...rest } = x; return '  ' + JSON.stringify(name) + ': ' + JSON.stringify(rest); }).join(',\n') + '\n};\n';
  }

  // ---- data/pokemon.js writer (keeps the file readable and diff-friendly) ----
  const isPrim = x => x === null || typeof x !== 'object';
  function fmt(v, ind = '') {
    if (Array.isArray(v)) {
      if (!v.length) return '[]';
      if (v.every(isPrim)) return '[' + v.map(x => JSON.stringify(x)).join(', ') + ']';
      const inner = ind + '  ';
      if (v.every(x => x && !Array.isArray(x) && Object.values(x).every(isPrim)))
        return '[\n' + v.map(x => inner + JSON.stringify(x)).join(',\n') + '\n' + ind + ']';
      return '[\n' + v.map(x => inner + fmt(x, inner)).join(',\n') + '\n' + ind + ']';
    }
    if (v && typeof v === 'object') {
      const keys = Object.keys(v).filter(k => v[k] !== undefined);
      if (keys.every(k => isPrim(v[k]))) return JSON.stringify(Object.fromEntries(keys.map(k => [k, v[k]])));
      const inner = ind + '  ';
      return '{\n' + keys.map(k => inner + JSON.stringify(k) + ': ' + fmt(v[k], inner)).join(',\n') + '\n' + ind + '}';
    }
    return JSON.stringify(v);
  }

  function toDataFile(list) {
    return '// Kalysidex Pokémon data. Edit by hand, or generate with tools/add-pokemon.html\n' +
      'window.KALYSIDEX = window.KALYSIDEX || {};\n' +
      'window.KALYSIDEX.pokemon = ' + fmt(list) + ';\n';
  }

  const api = { parseEntry, splitEntries, parseDex, parseSections, parseBlocks, htmlToSeq, mapImages, parseHtmlDoc, toDataFile, toDictFile, slug, TYPES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KalysidexParser = api;
})(typeof window !== 'undefined' ? window : globalThis);
