/* Montador de Time Pokemon (Cobbleverse)
   - dados de especie/golpes/evolucao: PokeAPI
   - sets sugeridos: data.pkmn.cc (Smogon)
   - persistencia: server.js local -> arquivos .txt em times/
*/

const POKEAPI = 'https://pokeapi.co/api/v2';
const SMOGON_SETS = 'https://data.pkmn.cc/sets/gen9.json';
const MAX_TEAM = 6;

const TYPE_COLORS = {
  normal: '#b6b58c', fire: '#ff9248', water: '#6fa0ff', electric: '#f7d02c',
  grass: '#7ac74c', ice: '#96d9d6', fighting: '#e0483f', poison: '#c665c4',
  ground: '#e2bf65', flying: '#a98ff3', psychic: '#ff6f9b', bug: '#bcd12a',
  rock: '#c9b247', ghost: '#9b7fd4', dragon: '#8b5cff', dark: '#a1846d',
  steel: '#c3c3dc', fairy: '#ee9ec5', status: '#8b93a1',
};

const NATURES = [
  ['Hardy', ''], ['Lonely', '+Ataque, −Defesa'], ['Brave', '+Ataque, −Velocidade'],
  ['Adamant', '+Ataque, −Sp. Atk'], ['Naughty', '+Ataque, −Sp. Def'],
  ['Bold', '+Defesa, −Ataque'], ['Docile', ''], ['Relaxed', '+Defesa, −Velocidade'],
  ['Impish', '+Defesa, −Sp. Atk'], ['Lax', '+Defesa, −Sp. Def'],
  ['Timid', '+Velocidade, −Ataque'], ['Hasty', '+Velocidade, −Defesa'], ['Serious', ''],
  ['Jolly', '+Velocidade, −Sp. Atk'], ['Naive', '+Velocidade, −Sp. Def'],
  ['Modest', '+Sp. Atk, −Ataque'], ['Mild', '+Sp. Atk, −Defesa'], ['Quiet', '+Sp. Atk, −Velocidade'],
  ['Bashful', ''], ['Rash', '+Sp. Atk, −Sp. Def'],
  ['Calm', '+Sp. Def, −Ataque'], ['Gentle', '+Sp. Def, −Defesa'], ['Sassy', '+Sp. Def, −Velocidade'],
  ['Careful', '+Sp. Def, −Sp. Atk'], ['Quirky', ''],
];

const NATURE_EFFECT = Object.fromEntries(NATURES);

const EV_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const EV_LABELS = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };
const STAT_MAP = { hp: 'hp', attack: 'atk', defense: 'def', 'special-attack': 'spa', 'special-defense': 'spd', speed: 'spe' };

// ordem de preferencia de formato ao escolher um set do Smogon
const FORMAT_PRIORITY = ['ou', 'uu', 'ru', 'nu', 'pu', 'zu', 'ubers', 'lc', 'monotype',
  'nationaldex', 'doublesou', 'battlestadiumsingles', '1v1', 'anythinggoes'];

const state = {
  team: [],
  dex: [],
  smogon: null,
  smogonIndex: null,
  slotSeq: 0,
};

/* ---------------- utilidades ---------------- */

const $ = (sel) => document.querySelector(sel);

// especies: mantem o hifen ("ninetales-alola" -> "Ninetales-Alola")
function pretty(apiName) {
  return String(apiName).split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('-');
}

// golpes, habilidades e itens: hifen vira espaco ("nasty-plot" -> "Nasty Plot")
function prettyWords(apiName) {
  return String(apiName).split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

// "Nasty Plot" -> "nasty-plot" (formato de nome da PokeAPI)
function toApiName(label) {
  return String(label).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function norm(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let toastTimer;
function toast(msg, kind = '') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast ' + kind;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(url + ' -> HTTP ' + res.status);
  return res.json();
}

/* ---------------- PokeAPI ---------------- */

async function loadDex() {
  const cached = localStorage.getItem('dex-v1');
  if (cached) {
    try { state.dex = JSON.parse(cached); return; } catch { /* recarrega */ }
  }
  const data = await getJson(POKEAPI + '/pokemon?limit=20000');
  state.dex = data.results.map((r) => r.name);
  try { localStorage.setItem('dex-v1', JSON.stringify(state.dex)); } catch { /* quota */ }
}

function describeEvoDetail(d) {
  const bits = [];
  if (d.min_level) bits.push('Nv. ' + d.min_level);
  const trigger = d.trigger && d.trigger.name;
  if (trigger === 'trade') bits.push('troca — Linking Cord no Cobblemon');
  if (trigger === 'use-item' && d.item) bits.push(prettyWords(d.item.name));
  if (d.held_item) bits.push('segurando ' + prettyWords(d.held_item.name));
  if (d.min_happiness) bits.push('amizade ' + d.min_happiness);
  if (d.known_move) bits.push('sabendo ' + prettyWords(d.known_move.name));
  if (d.known_move_type) bits.push('golpe ' + prettyWords(d.known_move_type.name));
  if (d.time_of_day) bits.push(d.time_of_day === 'day' ? 'de dia' : 'de noite');
  if (d.location) bits.push('em ' + prettyWords(d.location.name));
  if (d.min_beauty) bits.push('beleza ' + d.min_beauty);
  if (d.needs_overworld_rain) bits.push('na chuva');
  if (d.gender === 1) bits.push('fêmea');
  if (d.gender === 2) bits.push('macho');
  if (!bits.length && trigger && trigger !== 'level-up') bits.push(prettyWords(trigger));
  return bits.join(', ');
}

// procura o caminho da cadeia evolutiva que leva ate o pokemon atual
function evoLine(chain, targetName) {
  function walk(node, path) {
    const here = path.concat([{ name: node.species.name, detail: node.evolution_details && node.evolution_details[0] }]);
    if (norm(node.species.name) === norm(targetName)) return here;
    for (const next of node.evolves_to) {
      const found = walk(next, here);
      if (found) return found;
    }
    return null;
  }
  // se o alvo for uma forma regional, a cadeia pode nao conter o nome exato: cai para a linha inteira
  let path = walk(chain, []);
  if (!path) {
    path = [];
    let node = chain;
    while (node) { path.push({ name: node.species.name, detail: node.evolution_details && node.evolution_details[0] }); node = node.evolves_to[0]; }
  }
  return path.map((step, i) => {
    const label = pretty(step.name);
    if (i === 0) return label;
    const how = step.detail ? describeEvoDetail(step.detail) : '';
    return label + (how ? ' (' + how + ')' : '');
  }).join(' → ');
}

async function fetchPokemon(name) {
  const p = await getJson(POKEAPI + '/pokemon/' + encodeURIComponent(name));

  const stats = {};
  p.stats.forEach((s) => { stats[STAT_MAP[s.stat.name]] = s.base_stat; });

  const movePool = [...new Set(p.moves.map((m) => m.move.name))].sort();

  let evolution = '';
  try {
    const species = await getJson(p.species.url);
    if (species.evolution_chain && species.evolution_chain.url) {
      const chain = await getJson(species.evolution_chain.url);
      evolution = evoLine(chain.chain, p.name);
    }
  } catch { evolution = ''; }

  return {
    id: 'slot' + (++state.slotSeq),
    api: p.name,
    name: pretty(p.name),
    sprite: (p.sprites.other && p.sprites.other['official-artwork'] && p.sprites.other['official-artwork'].front_default)
      || p.sprites.front_default || '',
    types: p.types.map((t) => t.type.name),
    matchups: await computeMatchups(p.types.map((t) => t.type.name)),
    stats,
    abilities: p.abilities.map((a) => ({ name: prettyWords(a.ability.name), hidden: a.is_hidden })),
    movePool,
    evolution,
    // campos editaveis
    nature: '',
    ability: '',
    abilityNote: '',
    item: '',
    itemNote: '',
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    moves: [null, null, null, null],
    moveAlts: [[], [], [], []],
    itemAlts: [],
    role: '',
    swaps: '',
    setSource: '',
  };
}

/* ---------------- efetividade de tipo ---------------- */

const ALL_TYPES = ['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison',
  'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'];

const typeCache = {};
async function typeRelations(typeName) {
  if (typeCache[typeName]) return typeCache[typeName];
  const t = await getJson(POKEAPI + '/type/' + encodeURIComponent(typeName));
  const names = (list) => list.map((x) => x.name);
  const rel = {
    double: names(t.damage_relations.double_damage_from),
    half: names(t.damage_relations.half_damage_from),
    none: names(t.damage_relations.no_damage_from),
  };
  typeCache[typeName] = rel;
  return rel;
}

// multiplicador de dano recebido para cada um dos 18 tipos, combinando os tipos do Pokemon
async function computeMatchups(types) {
  const mult = {};
  ALL_TYPES.forEach((t) => { mult[t] = 1; });
  for (const t of types) {
    let rel;
    try { rel = await typeRelations(t); } catch { continue; }
    rel.double.forEach((a) => { mult[a] *= 2; });
    rel.half.forEach((a) => { mult[a] *= 0.5; });
    rel.none.forEach((a) => { mult[a] *= 0; });
  }
  return mult;
}

const MULT_LABEL = { 0: '0×', 0.25: '¼×', 0.5: '½×', 1: '1×', 2: '2×', 4: '4×' };
const multLabel = (m) => MULT_LABEL[m] || m + '×';

// agrupa os 18 tipos em fraco / resiste / imune / normal
function groupMatchups(mult) {
  const groups = { weak: [], resist: [], immune: [], normal: [] };
  if (!mult) return groups;
  ALL_TYPES.forEach((t) => {
    const m = mult[t];
    if (m === 0) groups.immune.push([t, m]);
    else if (m > 1) groups.weak.push([t, m]);
    else if (m < 1) groups.resist.push([t, m]);
    else groups.normal.push([t, m]);
  });
  groups.weak.sort((a, b) => b[1] - a[1]);
  groups.resist.sort((a, b) => a[1] - b[1]);
  return groups;
}

const moveCache = {};
async function fetchMove(moveApiName) {
  if (moveCache[moveApiName]) return moveCache[moveApiName];
  try {
    const m = await getJson(POKEAPI + '/move/' + encodeURIComponent(moveApiName));
    const info = {
      name: (m.names.find((n) => n.language.name === 'en') || {}).name || prettyWords(m.name),
      type: m.type.name,
      power: m.power,
      category: m.damage_class.name,
      accuracy: m.accuracy,
      pp: m.pp,
    };
    moveCache[moveApiName] = info;
    return info;
  } catch {
    return { name: prettyWords(moveApiName), type: '', power: null, category: '', accuracy: null, pp: null };
  }
}

/* ---------------- Smogon ---------------- */

async function loadSmogon() {
  if (state.smogon) return;
  state.smogon = await getJson(SMOGON_SETS);
  state.smogonIndex = {};
  Object.keys(state.smogon).forEach((key) => { state.smogonIndex[norm(key)] = key; });
}

function pickSet(apiName) {
  const key = state.smogonIndex[norm(apiName)];
  if (!key) return null;
  const byFormat = state.smogon[key];
  const formats = Object.keys(byFormat);
  const chosen = FORMAT_PRIORITY.find((f) => formats.includes(f)) || formats[0];
  if (!chosen) return null;
  const sets = byFormat[chosen];
  const setName = Object.keys(sets)[0];
  return { format: chosen, setName, set: sets[setName], species: key };
}

const first = (v) => (Array.isArray(v) ? v[0] : v);
const rest = (v) => (Array.isArray(v) ? v.slice(1) : []);

async function applySmogonSet(slot) {
  await loadSmogon();
  const found = pickSet(slot.api);
  if (!found) { toast('Sem set do Smogon para ' + slot.name + ' — preencha à mão.', 'err'); return false; }

  const s = found.set;
  if (s.nature) slot.nature = first(s.nature);
  if (s.ability) slot.ability = first(s.ability);
  else if (slot.abilities.length) slot.ability = (slot.abilities.find((a) => !a.hidden) || slot.abilities[0]).name;
  if (s.item) { slot.item = first(s.item); slot.itemAlts = rest(s.item); }

  EV_KEYS.forEach((k) => { slot.evs[k] = (s.evs && s.evs[k]) || 0; });

  slot.moves = [null, null, null, null];
  slot.moveAlts = [[], [], [], []];
  const moveSlots = (s.moves || []).slice(0, 4);
  await Promise.all(moveSlots.map(async (entry, i) => {
    const chosen = first(entry);
    slot.moveAlts[i] = rest(entry);
    slot.moves[i] = await fetchMove(toApiName(chosen));
  }));

  slot.setSource = 'Smogon ' + found.format + ' · "' + found.setName + '"';
  return true;
}

/* ---------------- autocomplete generico ---------------- */

function attachAutocomplete(input, dropdown, getItems, onPick) {
  let items = [];
  let cursor = -1;

  function close() { dropdown.hidden = true; cursor = -1; }

  function open(list) {
    items = list;
    if (!list.length) { close(); return; }
    dropdown.innerHTML = list.map((it, i) =>
      '<div data-i="' + i + '">' + esc(it.label) + (it.hint ? '<span class="hint">' + esc(it.hint) + '</span>' : '') + '</div>'
    ).join('');
    dropdown.hidden = false;
  }

  function pick(i) {
    if (!items[i]) return;
    onPick(items[i]);
    close();
  }

  input.addEventListener('input', () => open(getItems(input.value.trim())));
  input.addEventListener('focus', () => { if (input.value.trim()) open(getItems(input.value.trim())); });
  input.addEventListener('blur', () => setTimeout(close, 150));
  input.addEventListener('keydown', (e) => {
    if (dropdown.hidden) return;
    const nodes = [...dropdown.children];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      cursor = Math.max(0, Math.min(nodes.length - 1, cursor + (e.key === 'ArrowDown' ? 1 : -1)));
      nodes.forEach((n, i) => n.classList.toggle('on', i === cursor));
      nodes[cursor].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(cursor >= 0 ? cursor : 0);
    } else if (e.key === 'Escape') { close(); }
  });
  dropdown.addEventListener('mousedown', (e) => {
    const row = e.target.closest('[data-i]');
    if (row) { e.preventDefault(); pick(Number(row.dataset.i)); }
  });
}

function filterNames(list, query, limit = 15, labeller = pretty) {
  const q = norm(query);
  if (!q) return list.slice(0, limit).map((n) => ({ value: n, label: labeller(n) }));
  const starts = [];
  const has = [];
  for (const n of list) {
    const nn = norm(n);
    if (nn.startsWith(q)) starts.push(n);
    else if (nn.includes(q)) has.push(n);
    if (starts.length >= limit) break;
  }
  return starts.concat(has).slice(0, limit).map((n) => ({ value: n, label: labeller(n) }));
}

/* ---------------- render ---------------- */

const SLOT_COLORS = ['#7aa2f7', '#f7768e', '#e0af68', '#9ece6a', '#bb9af7', '#7dcfff'];

function typeBadge(t) {
  const c = TYPE_COLORS[t] || '#8b93a1';
  return '<span class="type" style="color:' + c + '">' + esc(t) + '</span>';
}

function evsText(evs) {
  const parts = EV_KEYS.filter((k) => evs[k] > 0).map((k) => evs[k] + ' ' + EV_LABELS[k]);
  return parts.length ? parts.join(' / ') : '—';
}

function statsLine(stats) {
  const bst = EV_KEYS.reduce((sum, k) => sum + (stats[k] || 0), 0);
  return EV_KEYS.map((k) => EV_LABELS[k] + ' ' + (stats[k] || 0)).join(' · ') + ' (BST ' + bst + ')';
}

const STAT_COLORS = { hp: '#7ee787', atk: '#f0a35e', def: '#e0c341', spa: '#6fa0ff', spd: '#9b7fd4', spe: '#f7768e' };
const STAT_MAX = 255; // maior stat base do jogo — mantem as barras comparaveis entre Pokemon

function statBars(stats) {
  const bst = EV_KEYS.reduce((sum, k) => sum + (stats[k] || 0), 0);
  const rows = EV_KEYS.map((k) => {
    const v = stats[k] || 0;
    const pct = Math.min(100, (v / STAT_MAX) * 100);
    return '<div class="stat-row"><span class="k">' + EV_LABELS[k] + '</span><span class="v">' + v + '</span>'
      + '<span class="bar"><i style="width:' + pct.toFixed(1) + '%;background:' + STAT_COLORS[k] + '"></i></span></div>';
  }).join('');
  return '<div class="stats">' + rows
    + '<div class="stat-row total"><span class="k">BST</span><span class="v">' + bst + '</span>'
    + '<span class="bar"><i style="width:' + Math.min(100, (bst / 720) * 100).toFixed(1) + '%;background:var(--txt-3)"></i></span></div></div>';
}

function effChip(t, m) {
  const c = TYPE_COLORS[t] || '#8b93a1';
  return '<span class="eff" style="color:' + c + '">' + esc(t) + '<b>' + multLabel(m) + '</b></span>';
}

function matchupBlock(mult) {
  const g = groupMatchups(mult);
  if (!g.weak.length && !g.resist.length && !g.immune.length) return '';
  const row = (label, list) => (list.length
    ? '<div class="mrow"><span class="label">' + label + '</span>' + list.map(([t, m]) => effChip(t, m)).join('') + '</div>'
    : '');
  return '<div class="matchups">'
    + row('Fraco a', g.weak)
    + row('Resiste', g.resist)
    + row('Imune a', g.immune)
    + '</div>';
}

function moveMeta(m) {
  if (!m) return '';
  const c = TYPE_COLORS[m.type] || TYPE_COLORS.status;
  const power = m.power ? '<b>' + m.power + '</b>' : (m.category === 'status' ? 'status' : '—');
  return '<span style="color:' + c + '">' + esc(m.type || m.category || '') + '</span> ' + power;
}

function renderCard(slot, index) {
  const color = SLOT_COLORS[index % SLOT_COLORS.length];
  const el = document.createElement('article');
  el.className = 'card';
  el.style.setProperty('--slot', color);
  el.dataset.id = slot.id;

  const natureOpts = ['<option value="">—</option>'].concat(NATURES.map(([n]) =>
    '<option value="' + n + '"' + (slot.nature === n ? ' selected' : '') + '>' + n + '</option>'
  )).join('');

  const abilityOpts = ['<option value="">—</option>'].concat(slot.abilities.map((a) =>
    '<option value="' + esc(a.name) + '"' + (slot.ability === a.name ? ' selected' : '') + '>' + esc(a.name) + (a.hidden ? ' (oculta)' : '') + '</option>'
  )).join('');
  // habilidade sugerida pelo Smogon pode nao estar na lista do PokeAPI (formas)
  const abilityExtra = slot.ability && !slot.abilities.some((a) => a.name === slot.ability)
    ? '<option value="' + esc(slot.ability) + '" selected>' + esc(slot.ability) + '</option>' : '';

  const evTotal = EV_KEYS.reduce((s, k) => s + Number(slot.evs[k] || 0), 0);

  el.innerHTML = `
    <div class="card-left">
    <div class="card-head">
      <div class="card-title">
        <span class="slot-no">0${index + 1}</span>
        ${slot.sprite ? '<img src="' + esc(slot.sprite) + '" alt="">' : ''}
        <h3>${esc(slot.name)}</h3>
      </div>
      <div class="evo">${esc(slot.evolution || '—')}</div>
      <div class="types">${slot.types.map(typeBadge).join('')}</div>
      <div class="card-actions">
        <button class="btn btn-sm" data-act="suggest">Sugerir set (Smogon)</button>
        <button class="btn btn-sm btn-ghost btn-danger" data-act="remove">Remover</button>
      </div>
    </div>

    ${statBars(slot.stats)}
    ${matchupBlock(slot.matchups)}
    </div>

    <div class="card-right">

    ${slot.setSource ? '<div class="set-src">Base: <b>' + esc(slot.setSource) + '</b> — editável</div>' : ''}

    <div class="fields">
      <div class="field">
        <div class="label">Nature</div>
        <select data-f="nature">${natureOpts}</select>
        <div class="note" data-naturenote>${esc(NATURE_EFFECT[slot.nature] || '')}</div>
      </div>
      <div class="field">
        <div class="label">Habilidade</div>
        <select data-f="ability">${abilityOpts}${abilityExtra}</select>
        <input class="note-input" type="text" data-f="abilityNote" placeholder="nota (o que ela faz)" value="${esc(slot.abilityNote)}" style="margin-top:6px;font-size:11.5px;padding:5px 8px" />
      </div>
      <div class="field full">
        <div class="label">Item</div>
        <input type="text" data-f="item" placeholder="ex: Life Orb" value="${esc(slot.item)}" />
        <input type="text" data-f="itemNote" placeholder="nota (efeito)" value="${esc(slot.itemNote)}" style="margin-top:6px;font-size:11.5px;padding:5px 8px" />
        ${slot.itemAlts.length ? '<div class="note">alternativas: ' + slot.itemAlts.map((a) => '<button class="chip" data-act="alt-item" data-val="' + esc(a) + '">' + esc(a) + '</button>').join(' ') + '</div>' : ''}
      </div>
      <div class="field full">
        <div class="label">EVs</div>
        <div class="ev-grid">
          ${EV_KEYS.map((k) => '<label><span>' + EV_LABELS[k] + '</span><input type="number" min="0" max="252" step="4" data-ev="' + k + '" value="' + (slot.evs[k] || 0) + '"></label>').join('')}
        </div>
        <div class="ev-total${evTotal > 508 ? ' over' : ''}">total ${evTotal} / 508</div>
      </div>
    </div>

    <div class="moves">
      ${[0, 1, 2, 3].map((i) => `
        <div class="move">
          <input type="text" data-move="${i}" placeholder="Golpe ${i + 1}" value="${esc(slot.moves[i] ? slot.moves[i].name : '')}" autocomplete="off" />
          <div class="dropdown" data-movedd="${i}" hidden></div>
          <div class="move-meta" data-movemeta="${i}">${moveMeta(slot.moves[i])}</div>
        </div>`).join('')}
    </div>

    ${slot.moveAlts.some((a) => a.length) ? '<div class="alts"><span class="label">Alternativas</span>' +
      slot.moveAlts.map((alts, i) => alts.map((a) =>
        '<button class="chip" data-act="alt-move" data-i="' + i + '" data-val="' + esc(a) + '">' + esc(a) + ' <span style="opacity:.6">→ ' + (i + 1) + '</span></button>').join('')).join('') + '</div>' : ''}

    <div class="notes">
      <div>
        <div class="label">Papel</div>
        <textarea data-f="role" placeholder="o que esse Pokémon resolve no time...">${esc(slot.role)}</textarea>
      </div>
      <div>
        <div class="label">Trocas / observações</div>
        <textarea data-f="swaps" placeholder="alternativas de golpe, item, plano B...">${esc(slot.swaps)}</textarea>
      </div>
    </div>
    </div>
  `;

  wireCard(el, slot, index);
  return el;
}

function wireCard(el, slot, index) {
  el.querySelectorAll('[data-f]').forEach((input) => {
    input.addEventListener('input', () => { slot[input.dataset.f] = input.value; });
    input.addEventListener('change', () => { slot[input.dataset.f] = input.value; });
  });

  const natureSel = el.querySelector('[data-f="nature"]');
  natureSel.addEventListener('change', () => {
    el.querySelector('[data-naturenote]').textContent = NATURE_EFFECT[natureSel.value] || '';
  });

  el.querySelectorAll('[data-ev]').forEach((input) => {
    input.addEventListener('input', () => {
      let v = Math.max(0, Math.min(252, Number(input.value) || 0));
      slot.evs[input.dataset.ev] = v;
      const total = EV_KEYS.reduce((s, k) => s + Number(slot.evs[k] || 0), 0);
      const totalEl = el.querySelector('.ev-total');
      totalEl.textContent = 'total ' + total + ' / 508';
      totalEl.classList.toggle('over', total > 508);
    });
  });

  [0, 1, 2, 3].forEach((i) => {
    const input = el.querySelector('[data-move="' + i + '"]');
    const dd = el.querySelector('[data-movedd="' + i + '"]');
    attachAutocomplete(input, dd,
      (q) => filterNames(slot.movePool, q, 20, prettyWords),
      async (item) => {
        const info = await fetchMove(item.value);
        slot.moves[i] = info;
        input.value = info.name;
        el.querySelector('[data-movemeta="' + i + '"]').innerHTML = moveMeta(info);
      });
    input.addEventListener('change', () => {
      if (!input.value.trim()) { slot.moves[i] = null; el.querySelector('[data-movemeta="' + i + '"]').innerHTML = ''; }
    });
  });

  el.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;

    if (act === 'remove') {
      state.team = state.team.filter((s) => s.id !== slot.id);
      renderTeam();
    } else if (act === 'suggest') {
      btn.disabled = true;
      btn.textContent = 'buscando...';
      try {
        const ok = await applySmogonSet(slot);
        if (ok) replaceCard(slot);
      } catch (err) {
        toast('Falha ao buscar sets: ' + err.message, 'err');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Sugerir set (Smogon)';
      }
    } else if (act === 'alt-item') {
      const val = btn.dataset.val;
      slot.itemAlts = slot.itemAlts.filter((a) => a !== val).concat([slot.item]).filter(Boolean);
      slot.item = val;
      replaceCard(slot);
    } else if (act === 'alt-move') {
      const i = Number(btn.dataset.i);
      const val = btn.dataset.val;
      const current = slot.moves[i] ? slot.moves[i].name : null;
      slot.moves[i] = await fetchMove(toApiName(val));
      slot.moveAlts[i] = slot.moveAlts[i].filter((a) => a !== val).concat(current ? [current] : []);
      replaceCard(slot);
    }
  });
}

function replaceCard(slot) {
  const index = state.team.findIndex((s) => s.id === slot.id);
  const old = $('#team').querySelector('[data-id="' + slot.id + '"]');
  if (old && index >= 0) old.replaceWith(renderCard(slot, index));
}

function renderTeam() {
  const grid = $('#team');
  grid.innerHTML = '';
  state.team.forEach((slot, i) => grid.appendChild(renderCard(slot, i)));
  $('#empty').hidden = state.team.length > 0;
  $('#counter').textContent = state.team.length + ' / ' + MAX_TEAM;
  $('#add').disabled = state.team.length >= MAX_TEAM || !$('#search').dataset.pick;
}

/* ---------------- .txt: gerar e ler ---------------- */

function serializeTeam(teamName) {
  const now = new Date();
  const stamp = now.toLocaleString('pt-BR');
  const lines = [
    '# Time: ' + teamName,
    '# Salvo em: ' + stamp,
    '# Gerado pelo Montador de Time (Cobbleverse) — PokeAPI + Smogon',
    '',
  ];

  state.team.forEach((s, i) => {
    lines.push('## ' + (i + 1) + '. ' + s.name + ' [' + s.api + ']');
    lines.push('Tipos: ' + s.types.map(prettyWords).join(' / '));
    if (s.evolution) lines.push('Linha evolutiva: ' + s.evolution);
    lines.push('Stats: ' + statsLine(s.stats));
    const g = groupMatchups(s.matchups);
    const chips = (list) => list.map(([t, m]) => prettyWords(t) + ' ' + multLabel(m)).join(', ');
    if (g.weak.length) lines.push('Fraco a: ' + chips(g.weak));
    if (g.resist.length) lines.push('Resiste a: ' + chips(g.resist));
    if (g.immune.length) lines.push('Imune a: ' + chips(g.immune));
    lines.push('Nature: ' + (s.nature || '—'));
    lines.push('Habilidade: ' + (s.ability || '—') + (s.abilityNote ? ' | ' + s.abilityNote : ''));
    lines.push('Item: ' + (s.item || '—') + (s.itemNote ? ' | ' + s.itemNote : ''));
    lines.push('EVs: ' + evsText(s.evs));
    lines.push('Golpes:');
    s.moves.forEach((m) => {
      if (!m) return;
      lines.push('- ' + m.name + ' | ' + (m.type || '-') + ' | ' + (m.power || '-') + ' | ' + (m.category || '-'));
    });
    if (s.setSource) lines.push('Set base: ' + s.setSource);
    if (s.role) lines.push('Papel: ' + s.role);
    if (s.swaps) lines.push('Trocas: ' + s.swaps);
    lines.push('');
  });

  return lines.join('\n');
}

// rotulos reconhecidos na leitura do .txt (os derivados da API sao ignorados e recalculados)
const KNOWN_LABELS = ['Tipos', 'Linha evolutiva', 'Stats', 'Fraco a', 'Resiste a', 'Imune a',
  'Nature', 'Habilidade', 'Item', 'EVs', 'Set base', 'Papel', 'Trocas'];

// le o .txt de volta para o estado (refaz o fetch do PokeAPI para sprite/tipos/movepool)
async function parseTeam(text) {
  const blocks = text.split(/\n(?=## )/).slice(1);
  const slots = [];

  for (const block of blocks) {
    const lines = block.split('\n');
    const head = lines[0].match(/^##\s*\d+\.\s*(.+?)\s*\[([^\]]+)\]/);
    if (!head) continue;
    const apiName = head[2].trim();

    let slot;
    try {
      slot = await fetchPokemon(apiName);
    } catch {
      toast('Não consegui recarregar ' + apiName + ' do PokeAPI.', 'err');
      continue;
    }

    let field = null;
    const moves = [];
    for (const raw of lines.slice(1)) {
      const line = raw.trim();
      const m = line.match(/^([A-Za-zÀ-ú. ]+?):\s*(.*)$/);
      const isLabel = !!m && KNOWN_LABELS.includes(m[1].trim());

      if (line === 'Golpes:') { field = 'moves'; continue; }
      if (field === 'moves' && line.startsWith('- ')) {
        const [name, type, power, category] = line.slice(2).split('|').map((p) => p.trim());
        moves.push({ name, type: type === '-' ? '' : type, power: power === '-' ? null : Number(power), category: category === '-' ? '' : category });
        continue;
      }

      if (isLabel) {
        const key = m[1].trim();
        const val = m[2].trim();
        field = null;
        if (key === 'Nature') slot.nature = val === '—' ? '' : val;
        else if (key === 'Habilidade') {
          const [a, note] = val.split('|').map((p) => p.trim());
          slot.ability = a === '—' ? '' : a;
          slot.abilityNote = note || '';
        } else if (key === 'Item') {
          const [it, note] = val.split('|').map((p) => p.trim());
          slot.item = it === '—' ? '' : it;
          slot.itemNote = note || '';
        } else if (key === 'EVs') {
          EV_KEYS.forEach((k) => { slot.evs[k] = 0; });
          if (val !== '—') {
            val.split('/').forEach((part) => {
              const mm = part.trim().match(/^(\d+)\s+(\w+)$/);
              if (!mm) return;
              const key2 = EV_KEYS.find((k) => EV_LABELS[k].toLowerCase() === mm[2].toLowerCase());
              if (key2) slot.evs[key2] = Number(mm[1]);
            });
          }
        } else if (key === 'Set base') slot.setSource = val;
        else if (key === 'Papel') { slot.role = val; field = 'role'; }
        else if (key === 'Trocas') { slot.swaps = val; field = 'swaps'; }
        continue;
      }

      // continuacao de texto livre (Papel / Trocas em varias linhas)
      if ((field === 'role' || field === 'swaps') && line) {
        slot[field] += '\n' + raw;
      }
    }

    slot.moves = [moves[0] || null, moves[1] || null, moves[2] || null, moves[3] || null];
    slots.push(slot);
  }

  return slots;
}

/* ---------------- API local (times/) ---------------- */

async function apiListTeams() {
  const data = await getJson('/api/teams');
  return data.teams;
}

async function apiSaveTeam(name, content) {
  const res = await fetch('/api/teams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, content }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'erro ao salvar');
  return data;
}

async function apiLoadTeam(name) {
  const data = await getJson('/api/teams/' + encodeURIComponent(name));
  return data.content;
}

async function apiDeleteTeam(name) {
  const res = await fetch('/api/teams/' + encodeURIComponent(name), { method: 'DELETE' });
  if (!res.ok) throw new Error('erro ao excluir');
}

/* ---------------- historico (modal) ---------------- */

async function openHistory() {
  const modal = $('#modal');
  const body = $('#modalBody');
  modal.hidden = false;
  body.innerHTML = '<div class="none">carregando...</div>';

  try {
    const teams = await apiListTeams();
    if (!teams.length) { body.innerHTML = '<div class="none">Nenhum time salvo ainda.</div>'; return; }
    body.innerHTML = teams.map((t) => `
      <div class="team-row">
        <span class="name">${esc(t.name)}</span>
        <span class="date">${new Date(t.savedAt).toLocaleString('pt-BR')}</span>
        <button class="btn btn-sm" data-load="${esc(t.name)}">Carregar</button>
        <button class="btn btn-sm btn-ghost btn-danger" data-del="${esc(t.name)}">Excluir</button>
      </div>`).join('');
  } catch (err) {
    body.innerHTML = '<div class="none">Erro ao listar: ' + esc(err.message) + '</div>';
  }
}

$('#modalBody').addEventListener('click', async (e) => {
  const loadBtn = e.target.closest('[data-load]');
  const delBtn = e.target.closest('[data-del]');

  if (loadBtn) {
    const name = loadBtn.dataset.load;
    loadBtn.textContent = 'carregando...';
    loadBtn.disabled = true;
    try {
      const text = await apiLoadTeam(name);
      state.team = await parseTeam(text);
      $('#teamName').value = name;
      renderTeam();
      $('#modal').hidden = true;
      toast('Time "' + name + '" carregado.', 'ok');
    } catch (err) {
      toast('Erro ao carregar: ' + err.message, 'err');
      loadBtn.textContent = 'Carregar';
      loadBtn.disabled = false;
    }
  }

  if (delBtn) {
    const name = delBtn.dataset.del;
    if (!confirm('Excluir o time "' + name + '"? O arquivo .txt será apagado.')) return;
    try {
      await apiDeleteTeam(name);
      toast('Time excluído.', 'ok');
      openHistory();
    } catch (err) {
      toast('Erro ao excluir: ' + err.message, 'err');
    }
  }
});

/* ---------------- boot ---------------- */

async function addPokemon(apiName) {
  if (state.team.length >= MAX_TEAM) { toast('O time já tem 6 Pokémon.', 'err'); return; }
  const btn = $('#add');
  btn.disabled = true;
  btn.textContent = 'carregando...';
  try {
    const slot = await fetchPokemon(apiName);
    state.team.push(slot);
    renderTeam();
    $('#search').value = '';
    delete $('#search').dataset.pick;
    toast(slot.name + ' adicionado.', 'ok');
  } catch (err) {
    toast('Não achei "' + apiName + '" no PokeAPI.', 'err');
  } finally {
    btn.textContent = 'Adicionar ao time';
    btn.disabled = state.team.length >= MAX_TEAM || !$('#search').dataset.pick;
  }
}

async function init() {
  const search = $('#search');
  search.disabled = true;
  search.placeholder = 'carregando lista de Pokémon...';

  try {
    await loadDex();
    search.placeholder = 'Buscar Pokémon (ex: gengar, sylveon, ninetales-alola)';
  } catch (err) {
    search.placeholder = 'falha ao carregar a Pokédex — recarregue a página';
    toast('Erro ao carregar a lista do PokeAPI: ' + err.message, 'err');
  }
  search.disabled = false;

  attachAutocomplete(search, $('#results'),
    (q) => filterNames(state.dex, q),
    (item) => { search.value = item.label; search.dataset.pick = item.value; $('#add').disabled = state.team.length >= MAX_TEAM; });

  search.addEventListener('input', () => {
    delete search.dataset.pick;
    $('#add').disabled = true;
  });

  $('#add').addEventListener('click', () => {
    const pick = search.dataset.pick || norm(search.value);
    if (pick) addPokemon(pick);
  });

  $('#save').addEventListener('click', async () => {
    const name = $('#teamName').value.trim();
    if (!name) { toast('Dê um nome ao time antes de salvar.', 'err'); $('#teamName').focus(); return; }
    if (!state.team.length) { toast('Time vazio.', 'err'); return; }
    try {
      const res = await apiSaveTeam(name, serializeTeam(name));
      toast('Salvo em ' + res.file, 'ok');
    } catch (err) {
      toast('Erro ao salvar: ' + err.message, 'err');
    }
  });

  $('#history').addEventListener('click', openHistory);
  $('#modalClose').addEventListener('click', () => { $('#modal').hidden = true; });
  $('#modal').addEventListener('click', (e) => { if (e.target === $('#modal')) $('#modal').hidden = true; });

  $('#clear').addEventListener('click', () => {
    if (!state.team.length) return;
    if (!confirm('Limpar o time atual? (nada é apagado dos arquivos salvos)')) return;
    state.team = [];
    $('#teamName').value = '';
    renderTeam();
  });

  renderTeam();
}

init();
