(function(){
  if(window.__chemLabEnhanceReady) return;
  window.__chemLabEnhanceReady = true;

  const SUB_MAP = {"0":"₀","1":"₁","2":"₂","3":"₃","4":"₄","5":"₅","6":"₆","7":"₇","8":"₈","9":"₉"};
  const SUB_REVERSE = {"₀":"0","₁":"1","₂":"2","₃":"3","₄":"4","₅":"5","₆":"6","₇":"7","₈":"8","₉":"9"};

  const ELEMENTS = (typeof elemente !== 'undefined' ? elemente : (window.elemente || {}));
  const entries = Object.entries(ELEMENTS);
  if(!entries.length) return;

  const PARSE_FORMULA = (typeof __parseFormula !== 'undefined' ? __parseFormula : (window.__parseFormula || (typeof parseFormula !== 'undefined' ? parseFormula : window.parseFormula)));

  function readCurrentEq(){
    try { return typeof currentEqPlain !== 'undefined' ? currentEqPlain : (window.currentEqPlain || ''); }
    catch(err){ return window.currentEqPlain || ''; }
  }

  function readCurrentType(){
    try { return typeof currentType !== 'undefined' ? currentType : (window.currentType || ''); }
    catch(err){ return window.currentType || ''; }
  }

  const symbolIndex = {};
  const numberIndex = {};
  const normalizedNameIndex = {};
  entries.forEach(([key, info]) => {
    if(!info || !info.simbol) return;
    symbolIndex[info.simbol] = { key, info };
    numberIndex[String(info.numar)] = { key, info };
    normalizedNameIndex[normalizeSimple(key)] = { key, info };
  });

  const searchState = {
    lastQuery: '',
    lastFormula: null
  };

  const SIM_PREF_KEY = 'chemlab.simulatorPrefs.v3';
  const SIM_PRESETS = [
    { a: 'HCl', b: 'NaOH' },
    { a: 'Na2CO3', b: 'HCl' },
    { a: 'CuSO4', b: 'NaOH' },
    { a: 'CH4', b: 'O2' },
    { a: 'Zn', b: 'HCl' },
    { a: 'Na', b: 'H2O' },
    { a: 'CaCO3', b: '' }
  ];

  function readSimPrefs(){
    try {
      const parsed = JSON.parse(localStorage.getItem(SIM_PREF_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch(err) {
      return {};
    }
  }

  function writeSimPrefs(patch){
    try {
      const next = Object.assign({}, readSimPrefs(), patch || {});
      localStorage.setItem(SIM_PREF_KEY, JSON.stringify(next));
      return next;
    } catch(err) {
      return Object.assign({}, patch || {});
    }
  }

  function persistSimulatorState(extra){
    const left = document.getElementById('react1');
    const right = document.getElementById('react2');
    const intensity = document.getElementById('simIntensity');
    return writeSimPrefs(Object.assign({
      r1: left ? normalizeDigits(left.value || '').trim() : '',
      r2: right ? normalizeDigits(right.value || '').trim() : '',
      intensity: intensity ? Math.max(35, Math.min(100, Number(intensity.value || 72))) : 72
    }, extra || {}));
  }

  function normalizeSimple(value){
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function normalizeDigits(value){
    return String(value || '').replace(/[₀₁₂₃₄₅₆₇₈₉]/g, ch => SUB_REVERSE[ch] || ch);
  }

  function cap(value){
    const s = String(value || '');
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  function prettyDigits(value){
    return String(value || '').replace(/[0-9]/g, ch => SUB_MAP[ch] || ch);
  }

  function prettyFormula(value){
    if(value == null) return '';
    let text = normalizeDigits(String(value));
    return text.replace(/(\d+)?([A-Z][A-Za-z0-9()\[\]·⋅]+|[A-Z][a-z]?)(?=(?:\b|[^a-z]))/g, (match, lead, body) => {
      if(!/[A-Z]/.test(body)) return match;
      let formatted = body.replace(/\d+/g, digits => prettyDigits(digits));
      return (lead || '') + formatted;
    });
  }

  function isChemicalLikeToken(token){
    if(!token) return false;
    const cleaned = normalizeDigits(String(token).replace(/^[^A-Za-z0-9(]+|[^A-Za-z0-9)↓↑]+$/g, '')).replace(/[↓↑]/g, '');
    if(!/[A-Z]/.test(cleaned)) return false;
    if(/^[A-Z][a-z]?$/.test(cleaned) && symbolIndex[cleaned]) return true;
    const bare = cleaned.replace(/^(\d+)(?=[A-Z(])/, '').replace(/\((aq|s|l|g)\)$/i, '');
    if(!bare) return false;
    if(typeof PARSE_FORMULA === 'function'){
      try {
        PARSE_FORMULA(bare);
        return true;
      } catch(err) {}
    }
    return /^\d*(?:[A-Z][a-z]?\d*|\([^)]*\)\d*)+$/.test(cleaned);
  }

  function prettifyTextContent(text){
    const tokenRegex = /[A-Za-z0-9₀₁₂₃₄₅₆₇₈₉()\[\]·⋅↓↑]+/g;
    return String(text || '').replace(tokenRegex, token => {
      if(!isChemicalLikeToken(token)) return token;
      return prettyFormula(token);
    });
  }

  function prettifyElement(root){
    if(!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node){
        if(!node.parentNode) return NodeFilter.FILTER_REJECT;
        const tag = node.parentNode.nodeName;
        if(/^(SCRIPT|STYLE|TEXTAREA|INPUT)$/i.test(tag)) return NodeFilter.FILTER_REJECT;
        if(!node.nodeValue || !/[A-Z]/.test(normalizeDigits(node.nodeValue))) return NodeFilter.FILTER_SKIP;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const nodes = [];
    while(walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach(node => {
      const nextValue = prettifyTextContent(node.nodeValue);
      if(nextValue !== node.nodeValue) node.nodeValue = nextValue;
    });
  }

  let prettyScheduled = false;
  let prettyBusy = false;
  function schedulePretty(){
    if(prettyScheduled) return;
    prettyScheduled = true;
    requestAnimationFrame(() => {
      prettyScheduled = false;
      if(prettyBusy) return;
      prettyBusy = true;
      try {
        [
          document.getElementById('rezultat'),
          document.getElementById('reactResult'),
          document.getElementById('hist'),
          document.getElementById('favList'),
          document.getElementById('quizBox'),
          document.getElementById('molarOut'),
          document.getElementById('compoundExplorer'),
          document.getElementById('searchPreview'),
          document.getElementById('simulatorNarration'),
          document.getElementById('simReactionEq')
        ].filter(Boolean).forEach(prettifyElement);

        document.querySelectorAll('.chip, .hint, .formula-preview-chip, .compound-card, .search-pill').forEach(prettifyElement);
      } finally {
        prettyBusy = false;
      }
    });
  }

  new MutationObserver(() => schedulePretty()).observe(document.body, { childList: true, subtree: true, characterData: true });

  function findElement(query){
    const raw = normalizeDigits(String(query || '')).trim();
    if(!raw) return null;
    const nameNormalized = normalizeSimple(raw);
    if(normalizedNameIndex[nameNormalized]) return normalizedNameIndex[nameNormalized];

    if(symbolIndex[raw]) return symbolIndex[raw];
    const symbolNormalized = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    if(symbolIndex[symbolNormalized]) return symbolIndex[symbolNormalized];
    if(numberIndex[raw]) return numberIndex[raw];

    const fuzzy = entries.find(([key, info]) => {
      return normalizeSimple(key).includes(nameNormalized) || info.simbol.toLowerCase() === raw.toLowerCase();
    });
    return fuzzy ? { key: fuzzy[0], info: fuzzy[1] } : null;
  }

  function parseCompound(raw){
    const input = normalizeDigits(String(raw || '')).trim();
    if(!input) return null;
    let formula = input.replace(/\s+/g, '').replace(/\((aq|s|l|g)\)/gi, '');
    let coefficient = 1;
    const coefficientMatch = formula.match(/^(\d+)(?=[A-Z(])/);
    if(coefficientMatch){
      coefficient = Number(coefficientMatch[1]);
      formula = formula.slice(coefficientMatch[1].length);
    }

    if(!formula) return null;

    try {
      const atoms = typeof PARSE_FORMULA === 'function' ? PARSE_FORMULA(formula) : null;
      if(!atoms || typeof atoms !== 'object') return null;

      const list = Object.keys(atoms).map(symbol => {
        const entry = symbolIndex[symbol];
        return entry ? {
          key: entry.key,
          info: entry.info,
          symbol,
          count: Number(atoms[symbol]) * coefficient,
          mass: parseMass(entry.info.masa)
        } : null;
      }).filter(Boolean);

      if(!list.length) return null;
      const totalAtoms = list.reduce((sum, item) => sum + item.count, 0);
      const estimatedMass = list.reduce((sum, item) => sum + (item.mass || 0) * item.count, 0);

      return {
        input,
        formula,
        coefficient,
        parts: list,
        totalAtoms,
        estimatedMass
      };
    } catch(err) {
      return null;
    }
  }

  function parseMass(massValue){
    const value = parseFloat(String(massValue || '').replace(',', '.'));
    return Number.isFinite(value) ? value : null;
  }

  function getPalette(key, info){
    const cat = typeof window.getElementCategory === 'function' ? window.getElementCategory(info) : 'necunoscut';
    const paletteMap = {
      'nemetal': ['#2563eb', '#22d3ee', '#60a5fa'],
      'gaz-nobil': ['#8b5cf6', '#c084fc', '#6366f1'],
      'metal-alcalin': ['#f97316', '#fb7185', '#f59e0b'],
      'metal-alcalino-pamantos': ['#14b8a6', '#2dd4bf', '#0ea5e9'],
      'metaloid': ['#06b6d4', '#38bdf8', '#818cf8'],
      'halogen': ['#22c55e', '#a3e635', '#10b981'],
      'metal-post-tranzitie': ['#f59e0b', '#fbbf24', '#fb923c'],
      'metal-tranzitie': ['#334155', '#64748b', '#94a3b8'],
      'lantanid': ['#ec4899', '#f472b6', '#f9a8d4'],
      'actinid': ['#ef4444', '#fb7185', '#f97316'],
      'necunoscut': ['#475569', '#0f172a', '#94a3b8']
    };
    const palette = paletteMap[cat] || paletteMap['necunoscut'];
    const state = String(info.stare_de_agregare || '').toLowerCase();
    return { cat, colors: palette, state };
  }

  function makeElementArt(key, info){
    const name = cap(key);
    const { colors, state, cat } = getPalette(key, info);
    const symbol = info.simbol;
    const c1 = colors[0], c2 = colors[1], c3 = colors[2] || colors[1];

    const motif = state === 'gas'
      ? `
        <g opacity="0.95">
          <circle cx="440" cy="182" r="82" fill="url(#orb1)"/>
          <circle cx="510" cy="200" r="58" fill="url(#orb2)" opacity="0.9"/>
          <circle cx="394" cy="232" r="48" fill="url(#orb3)" opacity="0.8"/>
          <circle cx="472" cy="262" r="28" fill="rgba(255,255,255,.34)" opacity="0.55"/>
        </g>`
      : state === 'liquid'
        ? `
        <g opacity="0.98">
          <path d="M445 98 C520 180 560 228 560 278 C560 340 513 382 452 382 C390 382 342 340 342 278 C342 225 386 169 445 98 Z" fill="url(#orb1)"/>
          <path d="M404 228 C448 190 505 214 518 248 C531 282 506 325 455 330 C404 335 368 276 404 228 Z" fill="rgba(255,255,255,.2)"/>
        </g>`
        : `
        <g opacity="0.98">
          <polygon points="352,168 446,116 540,168 500,310 402,332" fill="url(#orb1)"/>
          <polygon points="446,116 540,168 490,196 402,150" fill="rgba(255,255,255,.22)"/>
          <polygon points="402,150 490,196 454,340 370,286" fill="rgba(255,255,255,.12)"/>
          <circle cx="502" cy="140" r="12" fill="rgba(255,255,255,.52)"/>
        </g>`;

    const sparkDots = Array.from({ length: 11 }).map((_, index) => {
      const x = 80 + index * 42;
      const y = 120 + (index % 3) * 26;
      const r = 3 + (index % 4);
      return `<circle cx="${x}" cy="${y}" r="${r}" fill="rgba(255,255,255,.72)" opacity="${0.22 + (index % 5) * 0.11}"/>`;
    }).join('');

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420" role="img" aria-label="Ilustrație pentru ${name}">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${c1}"/>
            <stop offset="52%" stop-color="${c2}"/>
            <stop offset="100%" stop-color="${c3}"/>
          </linearGradient>
          <radialGradient id="orb1" cx="50%" cy="45%" r="58%">
            <stop offset="0%" stop-color="rgba(255,255,255,.95)"/>
            <stop offset="34%" stop-color="rgba(255,255,255,.22)"/>
            <stop offset="100%" stop-color="${c1}"/>
          </radialGradient>
          <radialGradient id="orb2" cx="48%" cy="42%" r="62%">
            <stop offset="0%" stop-color="rgba(255,255,255,.84)"/>
            <stop offset="100%" stop-color="${c2}"/>
          </radialGradient>
          <radialGradient id="orb3" cx="48%" cy="42%" r="62%">
            <stop offset="0%" stop-color="rgba(255,255,255,.76)"/>
            <stop offset="100%" stop-color="${c3}"/>
          </radialGradient>
          <filter id="blur"><feGaussianBlur stdDeviation="18"/></filter>
        </defs>
        <rect x="0" y="0" width="640" height="420" rx="34" fill="url(#bg)"/>
        <circle cx="556" cy="64" r="96" fill="rgba(255,255,255,.22)" filter="url(#blur)"/>
        <circle cx="84" cy="360" r="108" fill="rgba(255,255,255,.16)" filter="url(#blur)"/>
        <g opacity="0.48" stroke="rgba(255,255,255,.42)" stroke-width="2.2" fill="none">
          <ellipse cx="455" cy="228" rx="148" ry="54"/>
          <ellipse cx="455" cy="228" rx="148" ry="54" transform="rotate(60 455 228)"/>
          <ellipse cx="455" cy="228" rx="148" ry="54" transform="rotate(120 455 228)"/>
        </g>
        ${motif}
        <g>${sparkDots}</g>
        <text x="42" y="84" font-size="82" font-family="Arial, sans-serif" font-weight="800" fill="rgba(255,255,255,.98)">${symbol}</text>
        <text x="42" y="132" font-size="26" font-family="Arial, sans-serif" font-weight="700" fill="rgba(255,255,255,.92)">${name}</text>
        <text x="42" y="170" font-size="20" font-family="Arial, sans-serif" fill="rgba(255,255,255,.86)">${info.numar}. ${categoryLabelSafe(cat)}</text>
        <text x="42" y="352" font-size="24" font-family="Arial, sans-serif" font-weight="700" fill="rgba(255,255,255,.94)">Stare: ${state === 'gas' ? 'gaz' : state === 'liquid' ? 'lichid' : 'solid'}</text>
        <text x="42" y="384" font-size="20" font-family="Arial, sans-serif" fill="rgba(255,255,255,.86)">Masă atomică: ${info.masa}</text>
      </svg>`;

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function categoryLabelSafe(cat){
    return typeof window.categoryLabel === 'function' ? window.categoryLabel(cat) : cat;
  }

  function getScrollTarget(targetId){
    if(!targetId) return null;
    if(targetId === 'simulator-wrap') return document.querySelector('.simulator-wrap');
    return document.getElementById(targetId);
  }

  function bindScrollButtons(root){
    if(!root) return;
    root.querySelectorAll('[data-scroll-target]').forEach(button => {
      if(button.dataset.scrollBound === 'true') return;
      button.dataset.scrollBound = 'true';
      button.addEventListener('click', () => {
        const target = getScrollTarget(button.getAttribute('data-scroll-target'));
        if(target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function buildLaunchPad(){
    const container = document.querySelector('.container');
    const author = document.querySelector('.author');
    if(!container || document.getElementById('labLaunchpad')) return;

    const hero = document.createElement('section');
    hero.id = 'labLaunchpad';
    hero.className = 'lab-launchpad';
    hero.innerHTML = `
      <div class="lab-launch-grid">
        <div class="lab-launch-copy">
          <span class="kicker-badge">⚗️ Laborator nou • vizual • interactiv</span>
          <h2>ChemLab Simulator: experimente animate + tabel periodic cu ilustrații pentru fiecare element</h2>
          <p>Scrii formulele normal, de tip <strong>O2</strong> sau <strong>H2SO4</strong>, iar aplicația le recunoaște și le afișează frumos, cu indici mici. Poți explora compuși, poți deschide elementele din formulă și poți vedea reacțiile ca într-un mini laborator digital.</p>
          <div class="lab-launch-bullets">
            <div class="lab-bullet"><strong>118 elemente vizuale</strong><span>fiecare are card, ilustrație generată și detalii rapide</span></div>
            <div class="lab-bullet"><strong>Simulator de reacții</strong><span>bule, precipitat, fum, lumină și schimbări de culoare</span></div>
            <div class="lab-bullet"><strong>Căutare inteligentă</strong><span>merge cu simbol, nume, număr atomic sau formulă chimică</span></div>
          </div>
          <div class="lab-launch-actions">
            <button class="rx-mini-btn secondary" type="button" data-scroll-target="periodic-search">🔎 Caută un element</button>
            <button class="rx-mini-btn ghost" type="button" data-scroll-target="simulator-wrap">🧪 Vezi simulatorul</button>
          </div>
        </div>
        <div class="lab-preview-stack">
          <div class="lab-preview-card">
            <div class="lab-preview-meta">
              <span class="lab-preview-pill">✨ Vizual nou</span>
              <span class="lab-preview-small">Formule afișate automat cu indici</span>
            </div>
            <div class="lab-preview-reaction">
              <div class="lab-vial" style="--vial-color:#38bdf8">
                <div class="lab-vial-liquid"></div>
                <div class="lab-vial-label">H₂SO₄</div>
              </div>
              <div class="lab-preview-arrow">→</div>
              <div class="lab-vial" style="--vial-color:#22c55e">
                <div class="lab-vial-liquid"></div>
                <div class="lab-vial-label">NaOH</div>
              </div>
            </div>
          </div>
          <div class="lab-preview-card">
            <div class="lab-preview-meta">
              <span class="lab-preview-pill">🧬 Compound explorer</span>
              <span class="lab-preview-small">H₂SO₄ deschide instant H, S și O</span>
            </div>
            <div class="lab-preview-reaction">
              <div class="lab-vial" style="--vial-color:#6366f1">
                <div class="lab-vial-liquid" style="height:74%"></div>
                <div class="lab-vial-label">O₂</div>
              </div>
              <div class="lab-preview-arrow">+</div>
              <div class="lab-vial" style="--vial-color:#fb923c">
                <div class="lab-vial-liquid" style="height:64%"></div>
                <div class="lab-vial-label">Mg</div>
              </div>
            </div>
          </div>
        </div>
      </div>`;

    if(author && author.parentNode === container){
      author.insertAdjacentElement('afterend', hero);
    } else {
      container.insertBefore(hero, container.firstChild);
    }

    bindScrollButtons(hero);
  }

  function buildSearchTools(){
    const periodicWrap = document.querySelector('.periodic-wrap');
    if(!periodicWrap || document.getElementById('periodic-search')) return;

    const block = document.createElement('div');
    block.id = 'periodic-search';
    block.className = 'lab-search-block';
    block.innerHTML = `
      <div class="lab-search-row">
        <input id="elementSearchField" type="text" placeholder="Caută nume, simbol, nr. atomic sau formulă: O2, Na, 8, H2SO4" autocomplete="off" />
        <button id="elementSearchBtn" class="rx-mini-btn secondary" type="button">🔎 Caută</button>
        <button id="elementSearchClear" class="rx-mini-btn ghost" type="button">🧹 Resetează</button>
      </div>
      <div id="searchPreview" class="search-preview">Exemplu: scrii <strong>O2</strong> și aplicația înțelege <strong>O₂</strong>.</div>
      <div class="search-support-row">
        <button class="search-pill" type="button" data-search-value="O2">O₂</button>
        <button class="search-pill" type="button" data-search-value="H2SO4">H₂SO₄</button>
        <button class="search-pill" type="button" data-search-value="Na">Na</button>
        <button class="search-pill" type="button" data-search-value="Fe">Fe</button>
        <button class="search-pill" type="button" data-search-value="aur">Aur</button>
        <button class="search-pill" type="button" data-search-value="17">Cl</button>
      </div>
      <div id="compoundExplorer" class="compound-board" hidden></div>`;

    const h1 = periodicWrap.querySelector('h1');
    if(h1) h1.insertAdjacentElement('afterend', block); else periodicWrap.prepend(block);

    const field = block.querySelector('#elementSearchField');
    const preview = block.querySelector('#searchPreview');
    const btn = block.querySelector('#elementSearchBtn');
    const clearBtn = block.querySelector('#elementSearchClear');
    const compoundBox = block.querySelector('#compoundExplorer');

    function syncPreview(){
      const raw = normalizeDigits(field.value || '').trim();
      if(!raw){
        preview.innerHTML = 'Exemplu: scrii <strong>O2</strong> și aplicația înțelege <strong>O₂</strong>.';
        schedulePretty();
        return;
      }
      const parsed = parseCompound(raw);
      if(parsed){
        preview.innerHTML = `Căutare detectată: <strong>${prettyFormula(raw)}</strong> · elemente găsite: <strong>${parsed.parts.map(item => item.info.simbol).join(', ')}</strong>`;
      } else {
        preview.innerHTML = `Căutare detectată: <strong>${prettyFormula(raw)}</strong>`;
      }
      schedulePretty();
    }

    function clearCompoundExplorer(){
      compoundBox.hidden = true;
      compoundBox.innerHTML = '';
      document.querySelectorAll('.element-cell').forEach(cell => cell.classList.remove('composition-hit'));
    }

    function highlightComposition(symbols){
      const symbolSet = new Set(symbols || []);
      document.querySelectorAll('.element-cell').forEach(cell => {
        const key = cell.getAttribute('data-key');
        const info = ELEMENTS && key ? ELEMENTS[key] : null;
        const on = info && symbolSet.has(info.simbol);
        cell.classList.toggle('composition-hit', !!on);
      });
    }

    function renderCompoundExplorer(parsed, originalQuery){
      if(!parsed) return clearCompoundExplorer();
      const formulaDisplay = prettyFormula(originalQuery || parsed.input || parsed.formula);
      const distinctCount = parsed.parts.length;
      compoundBox.hidden = false;
      compoundBox.innerHTML = `
        <div class="compound-summary">
          <div>
            <h3>Compus detectat: ${formulaDisplay}</h3>
            <p>Am descompus formula în elementele din tabelul periodic. Apasă pe orice card ca să vezi imaginea și proprietățile elementului.</p>
          </div>
          <div class="compound-metrics">
            <div class="compound-metric">${distinctCount} elemente distincte</div>
            <div class="compound-metric">${parsed.totalAtoms} atomi în total</div>
            <div class="compound-metric">M ≈ ${Math.round(parsed.estimatedMass)} g/mol</div>
          </div>
        </div>
        <div class="compound-grid">
          ${parsed.parts.map(item => `
            <button type="button" class="compound-card" data-open-element="${item.key}">
              <img class="compound-thumb" src="${makeElementArt(item.key, item.info)}" alt="${cap(item.key)}" />
              <h4>${cap(item.key)} (${item.info.simbol})</h4>
              <p>În formula ${formulaDisplay} apare de <strong>${item.count}</strong> ori.</p>
              <div class="meta-row">
                <span class="pill">Z = ${item.info.numar}</span>
                <span class="pill">Masă: ${item.info.masa}</span>
              </div>
            </button>
          `).join('')}
        </div>`;

      compoundBox.querySelectorAll('[data-open-element]').forEach(button => {
        button.addEventListener('click', () => {
          const key = button.getAttribute('data-open-element');
          if(key && typeof window.renderElementDetails === 'function') window.renderElementDetails(key);
        });
      });

      highlightComposition(parsed.parts.map(item => item.info.simbol));
      schedulePretty();
    }

    function performSearch(rawValue){
      const raw = normalizeDigits(String(rawValue || '').trim());
      searchState.lastQuery = raw;
      syncPreview();
      if(!raw){
        clearCompoundExplorer();
        if(typeof window.clearSearch === 'function') window.clearSearch();
        return;
      }

      const direct = findElement(raw);
      if(direct){
        clearCompoundExplorer();
        if(typeof window.renderElementDetails === 'function') window.renderElementDetails(direct.key);
        return;
      }

      const parsed = parseCompound(raw);
      if(parsed){
        searchState.lastFormula = parsed;
        renderCompoundExplorer(parsed, raw);
        if(parsed.parts[0] && typeof window.renderElementDetails === 'function') window.renderElementDetails(parsed.parts[0].key);
        return;
      }

      const fallback = findElement(raw);
      if(fallback && typeof window.renderElementDetails === 'function'){
        clearCompoundExplorer();
        window.renderElementDetails(fallback.key);
        return;
      }

      clearCompoundExplorer();
      const rezultat = document.getElementById('rezultat');
      if(rezultat){
        rezultat.innerHTML = `<div class="periodic-empty">Nu am găsit <strong>${raw}</strong>. Încearcă nume, simbol, nr. atomic sau formulă, de exemplu O2, Fe sau H2SO4.</div>`;
      }
      schedulePretty();
    }

    field.addEventListener('input', syncPreview);
    field.addEventListener('keydown', ev => {
      if(ev.key === 'Enter') performSearch(field.value);
    });
    btn.addEventListener('click', () => performSearch(field.value));
    clearBtn.addEventListener('click', () => {
      field.value = '';
      syncPreview();
      clearCompoundExplorer();
      if(typeof window.clearSearch === 'function') window.clearSearch();
    });
    block.querySelectorAll('[data-search-value]').forEach(button => {
      button.addEventListener('click', () => {
        field.value = button.getAttribute('data-search-value') || '';
        performSearch(field.value);
      });
    });

    syncPreview();
  }

  function augmentElementCard(key){
    const container = document.getElementById('rezultat');
    const info = ELEMENTS && key ? ELEMENTS[key] : null;
    const card = container ? container.querySelector('.element-card') : null;
    if(!card || !info) return;

    card.classList.add('element-card--visual');
    if(!card.querySelector('.element-visual-card')){
      const factValues = [
        { label: 'Simbol', value: info.simbol },
        { label: 'Categorie', value: categoryLabelSafe(typeof window.getElementCategory === 'function' ? window.getElementCategory(info) : 'necunoscut') },
        { label: 'Valență', value: info.valente },
        { label: 'Stare', value: typeof window.tradStare === 'function' ? window.tradStare(info.stare_de_agregare) : info.stare_de_agregare }
      ];

      const media = document.createElement('div');
      media.className = 'element-visual-card';
      media.innerHTML = `
        <div class="element-art-wrap">
          <img class="element-art" src="${makeElementArt(key, info)}" alt="Ilustrație ${cap(key)}" />
        </div>
        <div class="element-facts">
          ${factValues.map(item => `<div class="element-fact"><strong>${item.label}</strong>${item.value}</div>`).join('')}
        </div>`;

      const meta = card.querySelector('.element-meta');
      if(meta) card.insertBefore(media, meta);
      else card.appendChild(media);
    }

    const hero = card.querySelector('.element-hero');
    if(hero && !hero.querySelector('.element-hero-note')){
      const note = document.createElement('div');
      note.className = 'element-hero-note';
      note.innerHTML = `
        <span>🖼️ imagine generată</span>
        <span>🔎 căutare cu ${info.simbol} / ${info.numar}</span>
        <span>⚛️ exemple: ${info.exemple || '—'}</span>`;
      hero.appendChild(note);
    }

    schedulePretty();
  }

  function buildSimulator(){
    const reactionPanel = Array.from(document.querySelectorAll('.panel')).find(panel => panel.querySelector('#react1') && panel.querySelector('#react2'));
    if(!reactionPanel || reactionPanel.querySelector('.simulator-wrap')) return;

    const savedPrefs = readSimPrefs();
    const initialIntensity = Math.max(35, Math.min(100, Number(savedPrefs.intensity || 72)));

    const simulator = document.createElement('section');
    simulator.className = 'simulator-wrap';
    simulator.innerHTML = `
      <div class="sim-head">
        <div>
          <span class="sim-badge">🧪 ChemLab Simulator Realistic</span>
          <h2>Două borcane care toarnă într-un vas real de experiment sau un singur vas pentru descompuneri</h2>
          <p>Am refăcut scena ca să semene mai mult cu un laborator real: două borcane cu reactanți, un vas central în care se face experimentul, turnare vizibilă, vapori care ies pe gâtul vasului, particule solide care cad, spumă, lumină și mod automat cu un singur vas când lași al doilea reactant gol.</p>
        </div>
        <div class="sim-tools">
          <div class="sim-slider">
            <label for="simIntensity">Intensitate efecte <strong id="simIntensityValue">${initialIntensity}%</strong></label>
            <input id="simIntensity" type="range" min="35" max="100" value="${initialIntensity}" />
          </div>
          <div class="sim-presets">
            <button type="button" data-sim-preset="HCl|NaOH">HCl + NaOH</button>
            <button type="button" data-sim-preset="Na2CO3|HCl">Na₂CO₃ + HCl</button>
            <button type="button" data-sim-preset="CuSO4|NaOH">CuSO₄ + NaOH</button>
            <button type="button" data-sim-preset="Zn|HCl">Zn + HCl</button>
            <button type="button" data-sim-preset="CH4|O2">CH₄ + O₂</button>
            <button type="button" data-sim-preset="CaCO3|">CaCO₃</button>
          </div>
          <div class="sim-mini-actions">
            <button type="button" id="simSwapBtn">⇄ Inversează</button>
            <button type="button" id="simReplayBtn">🔁 Replay</button>
            <button type="button" id="simRandomBtn">🎲 Demo</button>
            <button type="button" id="simClearBtn">🧹 Reset</button>
          </div>
        </div>
      </div>
      <div id="simulatorScene" class="sim-scene" data-effect="idle" data-layout="double" data-has-gas="false" data-has-solid="false" data-heating="false">
        <div class="sim-lab-backdrop" aria-hidden="true"><span></span><span></span><span></span></div>
        <div class="sim-pour-layer" aria-hidden="true">
          <div class="sim-pour sim-pour-left"><span></span></div>
          <div class="sim-pour sim-pour-right"><span></span></div>
        </div>
        <div class="sim-bench" aria-hidden="true"></div>
        <div class="sim-beaker sim-source-vessel sim-source-left">
          <div class="sim-vessel-role">Borcan reactiv A</div>
          <div class="sim-beaker-shell">
            <div class="sim-vessel-cap"></div>
            <div class="sim-vessel-mouth"></div>
            <div class="sim-scale-lines"></div>
            <div id="simLeftLiquid" class="sim-liquid" style="--liquid-color:#60a5fa; --liquid-height:63%"></div>
            <div class="sim-liquid-sheen"></div>
            <div class="sim-beaker-label">
              <strong id="simLeftLabel">Substanța 1</strong>
              <span id="simLeftHint">Introdu prima substanță</span>
            </div>
          </div>
        </div>
        <div class="sim-flow sim-flow-left" aria-hidden="true"></div>
        <div class="sim-reactor">
          <div class="sim-reactor-rig" aria-hidden="true"></div>
          <div class="sim-vessel-role sim-vessel-role--reactor">Vasul în care faci experimentul</div>
          <div id="simVapor" class="sim-vapor"></div>
          <div id="simGasTag" class="sim-gas-tag" hidden>Gaz degajat</div>
          <div id="simSolidTag" class="sim-solid-tag" hidden>Precipitat</div>
          <div class="sim-reactor-shell">
            <div class="sim-neck"></div>
            <div class="sim-reactor-mouth"></div>
            <div class="sim-scale-lines sim-scale-lines--reactor"></div>
            <div id="simResultLiquid" class="sim-result-liquid" style="--liquid-color:#5b7cff; --liquid-height:58%"></div>
            <div class="sim-liquid-sheen sim-liquid-sheen--reactor"></div>
            <div id="simGlow" class="sim-glow"></div>
            <div id="simFlash" class="sim-flash"></div>
            <div id="simBubbles" class="sim-bubbles"></div>
            <div id="simSmoke" class="sim-smoke"></div>
            <div id="simFoam" class="sim-foam"></div>
            <div id="simFallout" class="sim-fallout"></div>
            <div id="simSparks" class="sim-sparks"></div>
            <div id="simPrecipitate" class="sim-precipitate"></div>
            <div class="sim-result-label">
              <strong id="simResultLabel">Vas de reacție</strong>
              <span id="simResultHint">Aștept reacția</span>
            </div>
            <div id="simReactionEq" class="sim-reaction-eq">Scrie substanțele și apasă „Simulează reacția”.</div>
          </div>
          <div class="sim-heater" aria-hidden="true">
            <div class="sim-heater-top"></div>
            <div class="sim-flame"></div>
          </div>
        </div>
        <div class="sim-flow sim-flow-right" aria-hidden="true"></div>
        <div class="sim-beaker sim-source-vessel sim-source-right">
          <div class="sim-vessel-role">Borcan reactiv B</div>
          <div class="sim-beaker-shell">
            <div class="sim-vessel-cap"></div>
            <div class="sim-vessel-mouth"></div>
            <div class="sim-scale-lines"></div>
            <div id="simRightLiquid" class="sim-liquid" style="--liquid-color:#34d399; --liquid-height:63%"></div>
            <div class="sim-liquid-sheen"></div>
            <div class="sim-beaker-label">
              <strong id="simRightLabel">Substanța 2</strong>
              <span id="simRightHint">Introdu a doua substanță</span>
            </div>
          </div>
        </div>
      </div>
      <div class="formula-preview-wrap">
        <span id="simPreview1" class="formula-preview-chip">R1: —</span>
        <span id="simPreview2" class="formula-preview-chip">R2: —</span>
      </div>
      <div id="simTelemetry" class="sim-telemetry">
        <div class="sim-energy-card">
          <span class="sim-telemetry-label">Realism vizual</span>
          <div class="sim-energy-meter"><span id="simEnergyMeter"></span></div>
          <small id="simEnergyHint">Când rulezi reacția, simulatorul estimează cât de intens și cât de vizibil trebuie să fie montajul.</small>
        </div>
        <div class="sim-product-card">
          <span class="sim-telemetry-label">Ce se formează / ce se degajă</span>
          <div id="simProductChips" class="sim-product-chips">
            <span class="sim-product-empty">Produșii apar după simulare.</span>
          </div>
        </div>
      </div>
      <div id="simStatusBoard" class="sim-status-board" data-effect="idle">
        <article class="sim-status-card">
          <span class="sim-status-label">Tip reacție</span>
          <strong id="simTypeBadge">—</strong>
          <small id="simTypeHint">Motorul clasifică reacția automat.</small>
        </article>
        <article class="sim-status-card">
          <span class="sim-status-label">Efect vizual</span>
          <strong id="simEffectBadge">Stand-by</strong>
          <small id="simEffectHint">Apar după ce rulezi simularea.</small>
        </article>
        <article class="sim-status-card">
          <span class="sim-status-label">Montaj</span>
          <strong id="simStatusBadge">Două borcane + vas</strong>
          <small id="simStatusHint">Dacă lași al doilea reactant gol, simulatorul trece automat pe un singur vas.</small>
        </article>
      </div>
      <div id="simReactionSteps" class="sim-steps">
        <article class="sim-step-card"><span class="sim-step-index">1</span><div><strong>Alege montajul</strong><span>Două borcane pentru amestec sau un singur vas pentru descompunere.</span></div></article>
        <article class="sim-step-card"><span class="sim-step-index">2</span><div><strong>Rulează reacția</strong><span>Simulatorul echilibrează ecuația și pornește turnarea sau încălzirea.</span></div></article>
        <article class="sim-step-card"><span class="sim-step-index">3</span><div><strong>Privește detaliile</strong><span>Gazul, precipitatul și schimbările de nivel devin vizibile în vas.</span></div></article>
      </div>
      <div class="sim-legend">
        <span>🫙 două borcane laterale sau mod cu un singur vas</span>
        <span>💨 gazul iese vizibil pe gâtul vasului</span>
        <span>🧂 solidul cade și se depune la bază</span>
        <span>🔥 încălzirea apare la reacțiile energice</span>
      </div>
      <div id="simulatorNarration" class="sim-narration">Alege două substanțe și apasă butonul de reacție. Simulatorul va descrie vizual ce se întâmplă.</div>`;

    reactionPanel.insertBefore(simulator, reactionPanel.firstChild);

    const reactButton = Array.from(reactionPanel.querySelectorAll('button')).find(button => /Reacționează|React/i.test(button.textContent));
    if(reactButton){
      reactButton.textContent = '🧪 Simulează reacția';
      reactButton.classList.add('sim-primary-trigger');
    }

    const r1 = document.getElementById('react1');
    const r2 = document.getElementById('react2');
    if(r1){
      r1.placeholder = 'Substanța 1 / borcan A (ex: NaCl)';
      r1.autocomplete = 'off';
    }
    if(r2){
      r2.placeholder = 'Substanța 2 / borcan B (ex: AgNO3)';
      r2.autocomplete = 'off';
    }

    if(r1 && r2 && !normalizeDigits(r1.value || '').trim() && !normalizeDigits(r2.value || '').trim() && (savedPrefs.r1 || savedPrefs.r2)){
      r1.value = savedPrefs.r1 || '';
      r2.value = savedPrefs.r2 || '';
    }

    function updateIntensityLabel(){
      const input = document.getElementById('simIntensity');
      const value = document.getElementById('simIntensityValue');
      const numeric = Math.max(35, Math.min(100, Number(input ? input.value : initialIntensity)));
      if(value) value.textContent = `${numeric}%`;
      return numeric;
    }

    function clearStaleReactionResult(){
      const resultBox = document.getElementById('reactResult');
      if(resultBox && resultBox.textContent.trim()) resultBox.innerHTML = '';
      const actions = document.getElementById('rxActions');
      if(actions) actions.style.display = 'none';
    }

    function triggerReaction(){
      if(typeof window.reaction === 'function') window.reaction();
      else syncSimulator();
    }

    function updateFormulaPreview(options = {}){
      const left = r1 ? normalizeDigits(r1.value || '').trim() : '';
      const right = r2 ? normalizeDigits(r2.value || '').trim() : '';
      const p1 = document.getElementById('simPreview1');
      const p2 = document.getElementById('simPreview2');
      if(p1) p1.textContent = `R1: ${left ? prettyFormula(left) : '—'}`;
      if(p2) p2.textContent = `R2: ${right ? prettyFormula(right) : '—'}`;
      const leftLabel = document.getElementById('simLeftLabel');
      const rightLabel = document.getElementById('simRightLabel');
      const leftHint = document.getElementById('simLeftHint');
      const rightHint = document.getElementById('simRightHint');
      if(leftLabel) leftLabel.textContent = left ? prettyFormula(left) : 'Borcan A';
      if(rightLabel) rightLabel.textContent = right ? prettyFormula(right) : 'Borcan B';
      if(leftHint) leftHint.textContent = left ? describeFormula(left) : 'Introdu prima substanță';
      if(rightHint) rightHint.textContent = right ? describeFormula(right) : (left ? 'Lasă gol pentru experiment într-un singur vas' : 'Introdu a doua substanță');
      if(options.clearResult !== false) clearStaleReactionResult();
      if(typeof window.setCurrentReaction === 'function') window.setCurrentReaction('', '');
      persistSimulatorState({ intensity: updateIntensityLabel() });
      syncSimulator();
      schedulePretty();
    }

    if(r1 && !r1.dataset.simBound){
      r1.addEventListener('input', () => updateFormulaPreview());
      r1.addEventListener('keydown', event => {
        if(event.key === 'Enter'){
          event.preventDefault();
          triggerReaction();
        }
      });
      r1.dataset.simBound = 'true';
    }
    if(r2 && !r2.dataset.simBound){
      r2.addEventListener('input', () => updateFormulaPreview());
      r2.addEventListener('keydown', event => {
        if(event.key === 'Enter'){
          event.preventDefault();
          triggerReaction();
        }
      });
      r2.dataset.simBound = 'true';
    }

    const intensityInput = document.getElementById('simIntensity');
    if(intensityInput && !intensityInput.dataset.simBound){
      const syncIntensity = () => {
        persistSimulatorState({ intensity: updateIntensityLabel() });
        syncSimulator();
      };
      intensityInput.addEventListener('input', syncIntensity);
      intensityInput.addEventListener('change', syncIntensity);
      intensityInput.dataset.simBound = 'true';
    }

    simulator.querySelectorAll('[data-sim-preset]').forEach(button => {
      button.addEventListener('click', () => {
        const [a, b] = String(button.getAttribute('data-sim-preset') || '').split('|');
        if(r1) r1.value = a || '';
        if(r2) r2.value = b || '';
        updateFormulaPreview({ clearResult: true });
        triggerReaction();
      });
    });

    const swapBtn = document.getElementById('simSwapBtn');
    if(swapBtn){
      swapBtn.addEventListener('click', () => {
        if(!r1 || !r2) return;
        const left = r1.value;
        r1.value = r2.value;
        r2.value = left;
        updateFormulaPreview({ clearResult: true });
        if((r1.value || r2.value).trim()) triggerReaction();
      });
    }

    const replayBtn = document.getElementById('simReplayBtn');
    if(replayBtn){
      replayBtn.addEventListener('click', () => {
        const currentEq = readCurrentEq();
        if(currentEq) syncSimulator();
        else if((r1 && r1.value.trim()) || (r2 && r2.value.trim())) triggerReaction();
      });
    }

    const randomBtn = document.getElementById('simRandomBtn');
    if(randomBtn){
      randomBtn.addEventListener('click', () => {
        const pick = SIM_PRESETS[Math.floor(Math.random() * SIM_PRESETS.length)] || SIM_PRESETS[0];
        if(r1) r1.value = pick.a || '';
        if(r2) r2.value = pick.b || '';
        updateFormulaPreview({ clearResult: true });
        triggerReaction();
      });
    }

    const clearBtn = document.getElementById('simClearBtn');
    if(clearBtn){
      clearBtn.addEventListener('click', () => {
        if(typeof window.clearReactants === 'function') window.clearReactants();
        else {
          if(r1) r1.value = '';
          if(r2) r2.value = '';
          clearStaleReactionResult();
        }
        persistSimulatorState({ r1: '', r2: '' });
        updateFormulaPreview({ clearResult: false });
      });
    }

    updateFormulaPreview({ clearResult: false });
  }


function describeFormula(formula){
    const clean = normalizeDigits(String(formula || '').trim());
    if(!clean) return 'Introdu prima substanță';
    const compound = parseCompound(clean);
    if(compound){
      if(compound.parts.length === 1){
        const item = compound.parts[0];
        return `${cap(item.key)} · ${item.count} atom${item.count === 1 ? '' : 'i'}`;
      }
      return `${compound.parts.length} elemente în formulă`;
    }
    return 'Substanță introdusă';
  }

  function inferFormulaFamily(formula){
    const f = normalizeDigits(String(formula || '').trim());
    if(!f) return { family: 'generic', color: '#64748b' };
    if(/^H2O$/i.test(f)) return { family: 'water', color: '#38bdf8' };
    if(/^(O2|CO2|SO2|H2S|NH3|H2|N2|CH4)$/i.test(f)) return { family: 'gas', color: '#7dd3fc' };
    if(/^Cl2$/i.test(f)) return { family: 'gas', color: '#84cc16' };
    if(/OH/i.test(f)) return { family: 'base', color: '#22c55e' };
    if(/^H[A-Z0-9(]/.test(f) && !/^H2O$/i.test(f)) return { family: 'acid', color: '#f97316' };
    if(/CO3|HCO3/.test(f)) return { family: 'carbonate', color: '#fbbf24' };
    if(/SO4|NO3|Cl/.test(f) && !/^Cl2$/.test(f)) return { family: 'salt', color: '#a78bfa' };
    if(symbolIndex[f]){
      const info = symbolIndex[f].info;
      const state = String(info.stare_de_agregare || '').toLowerCase();
      if(state === 'gas') return { family: 'gas', color: '#7dd3fc' };
      return { family: 'element', color: '#94a3b8' };
    }
    return { family: 'generic', color: '#64748b' };
  }

  function buildParticles(target, kind, count){
    if(!target) return;
    target.innerHTML = '';
    Array.from({ length: count }).forEach(() => {
      const span = document.createElement('span');
      if(kind === 'bubble'){
        span.style.left = `${10 + Math.random() * 78}%`;
        span.style.width = `${8 + Math.random() * 16}px`;
        span.style.height = span.style.width;
        span.style.setProperty('--delay', `${Math.random() * 1.4}s`);
      }
      if(kind === 'smoke'){
        span.style.left = `${18 + Math.random() * 64}%`;
        span.style.width = `${38 + Math.random() * 48}px`;
        span.style.height = span.style.width;
        span.style.setProperty('--delay', `${Math.random() * 2.2}s`);
      }
      if(kind === 'spark'){
        span.style.left = `${18 + Math.random() * 64}%`;
        span.style.bottom = `${42 + Math.random() * 20}px`;
        span.style.setProperty('--delay', `${Math.random() * .7}s`);
        span.style.setProperty('--rot', `${-60 + Math.random() * 120}deg`);
      }
      if(kind === 'vapor'){
        span.style.left = `${36 + Math.random() * 28}%`;
        span.style.width = `${42 + Math.random() * 46}px`;
        span.style.height = `${26 + Math.random() * 28}px`;
        span.style.setProperty('--delay', `${Math.random() * 1.5}s`);
        span.style.setProperty('--drift', `${-18 + Math.random() * 36}px`);
      }
      if(kind === 'foam'){
        span.style.left = `${16 + Math.random() * 68}%`;
        span.style.bottom = `${92 + Math.random() * 10}px`;
        span.style.width = `${14 + Math.random() * 18}px`;
        span.style.height = `${8 + Math.random() * 8}px`;
        span.style.setProperty('--delay', `${Math.random() * 1.2}s`);
      }
      if(kind === 'fallout'){
        span.style.left = `${18 + Math.random() * 64}%`;
        span.style.top = `${34 + Math.random() * 24}px`;
        span.style.width = `${7 + Math.random() * 8}px`;
        span.style.height = `${9 + Math.random() * 12}px`;
        span.style.setProperty('--delay', `${Math.random() * 1.5}s`);
        span.style.setProperty('--drift', `${-18 + Math.random() * 36}px`);
      }
      target.appendChild(span);
    });
  }

function cleanSpeciesToken(token){
    return normalizeDigits(String(token || ''))
      .replace(/[↓↑]/g, '')
      .trim()
      .replace(/^\d+\s*/, '')
      .replace(/\s+/g, '');
  }

  function extractEqSpecies(eq, index){
    const side = normalizeDigits(String(eq || '')).split('→')[index] || '';
    return side.split('+').map(cleanSpeciesToken).filter(Boolean);
  }

  function isAcidLike(formula){
    const f = normalizeDigits(String(formula || '')).trim();
    return /^H[A-Z0-9(]/.test(f) && !/^H2O$/i.test(f);
  }

  function isBaseLike(formula){
    return /OH/i.test(normalizeDigits(String(formula || '')));
  }

  function isLikelyCombustionPair(left, right){
    const list = [left, right].map(item => normalizeDigits(String(item || '')).trim()).filter(Boolean);
    return list.includes('O2') && list.some(item => item !== 'O2');
  }

  function isLikelyNeutralizationPair(left, right, products){
    const hasAcidBase = (isAcidLike(left) && isBaseLike(right)) || (isAcidLike(right) && isBaseLike(left));
    return hasAcidBase && products.includes('H2O');
  }

  function isLikelyPrecipitateFormula(formula){
    const f = cleanSpeciesToken(formula);
    return /^(AgCl|BaSO4|Cu\(OH\)2|Fe\(OH\)3|Al\(OH\)3|PbCl2|CaCO3|Mg\(OH\)2)$/i.test(f);
  }

  function detectVisualEffect(type, eq, r1, r2){
    const t = String(type || '').toLowerCase();
    const equation = normalizeDigits(String(eq || ''));
    const left = normalizeDigits(String(r1 || '')).trim();
    const right = normalizeDigits(String(r2 || '')).trim();
    const products = extractEqSpecies(equation, 1);

    if(t.includes('descomp')) return 'decomposition';
    if(isLikelyNeutralizationPair(left, right, products)) return 'neutralization';
    if(t.includes('combust') || isLikelyCombustionPair(left, right)) return 'combustion';
    if(/↓/.test(equation) || products.some(isLikelyPrecipitateFormula)) return 'precipitate';
    if(/↑/.test(equation) || products.some(product => ['CO2', 'H2', 'SO2', 'H2S', 'NH3'].includes(product))) return 'gas';
    if(t.includes('substit')) return 'substitution';
    if(t.includes('dubl')) return products.includes('H2O') ? 'neutralization' : 'precipitate';
    return 'unknown';
  }

function extractEqSpeciesRaw(eq, index){
    const side = normalizeDigits(String(eq || '')).split('→')[index] || '';
    return side.split('+').map(item => String(item || '').trim()).filter(Boolean);
  }

  function inferProductState(raw){
    const rawText = normalizeDigits(String(raw || '').trim());
    const formula = cleanSpeciesToken(rawText);
    if(!formula) return null;

    let state = 'aqueous';
    if(/↑/.test(rawText) || ['CO2','H2','SO2','H2S','NH3','O2','Cl2','N2'].includes(formula)) state = 'gas';
    else if(/↓/.test(rawText) || isLikelyPrecipitateFormula(formula)) state = 'solid';
    else if(/^H2O$/i.test(formula)) state = 'liquid';

    const iconMap = {
      gas: '💨',
      solid: '🧂',
      liquid: '💧',
      aqueous: '🧪',
      unknown: '✨'
    };
    const labelMap = {
      gas: 'gaz degajat',
      solid: 'precipitat',
      liquid: 'lichid format',
      aqueous: 'rămâne în soluție',
      unknown: 'produs'
    };
    const fallbackColor = {
      gas: '#7dd3fc',
      solid: '#f8fafc',
      liquid: '#34d399',
      aqueous: '#c4b5fd',
      unknown: '#94a3b8'
    };
    const family = inferFormulaFamily(formula);
    return {
      raw: rawText,
      formula,
      pretty: prettyFormula(formula),
      state,
      icon: iconMap[state] || iconMap.unknown,
      label: labelMap[state] || labelMap.unknown,
      color: (family && family.color) || fallbackColor[state] || fallbackColor.unknown
    };
  }

  function analyzeProducts(eq){
    const list = extractEqSpeciesRaw(eq, 1).map(inferProductState).filter(Boolean);
    return {
      list,
      gases: list.filter(item => item.state === 'gas'),
      solids: list.filter(item => item.state === 'solid'),
      liquids: list.filter(item => item.state === 'liquid'),
      aqueous: list.filter(item => item.state === 'aqueous')
    };
  }

  function describeProductMix(analysis){
    if(!analysis || !analysis.list.length) return 'Produșii apar după simulare.';
    return analysis.list.map(item => `${item.icon} ${item.pretty} (${item.label})`).join(' • ');
  }

  function buildProductChipMarkup(item){
    return `<span class="sim-product-chip state-${item.state}" style="--product-color:${item.color}"><span class="sim-product-chip-icon">${item.icon}</span><span class="sim-product-chip-copy"><strong>${item.pretty}</strong><small>${item.label}</small></span></span>`;
  }

  function effectEnergyScore(effect, analysis, intensity){
    const base = {
      idle: 0,
      neutralization: 38,
      gas: 72,
      precipitate: 66,
      combustion: 96,
      decomposition: 78,
      substitution: 70,
      unknown: 52
    }[effect] || 50;
    const bonus = Math.min(18, (analysis.gases.length * 5) + (analysis.solids.length * 4) + (analysis.liquids.length * 2));
    const scaled = Math.round((base + bonus) * (0.72 + Math.min(1.15, intensity / 100 * 0.48)));
    return Math.max(0, Math.min(100, scaled));
  }

  function renderProductTelemetry(effect, analysis, intensity){
    const chips = document.getElementById('simProductChips');
    if(chips){
      chips.innerHTML = analysis && analysis.list.length
        ? analysis.list.map(buildProductChipMarkup).join('')
        : '<span class="sim-product-empty">Produșii apar după simulare.</span>';
    }

    const energyMeter = document.getElementById('simEnergyMeter');
    const energyHint = document.getElementById('simEnergyHint');
    const score = analysis && analysis.list.length ? effectEnergyScore(effect, analysis, intensity) : 0;
    if(energyMeter) energyMeter.style.width = `${score}%`;
    if(energyHint) energyHint.textContent = !analysis || !analysis.list.length
      ? 'Când rulezi reacția, simulatorul estimează intensitatea scenei.'
      : score >= 90
        ? 'Reacție intensă: lumina, vaporii și particulele sunt la maximum.'
        : score >= 70
          ? 'Reacție clar vizibilă: degajarea și amestecul sunt accentuate.'
          : score >= 50
            ? 'Reacție moderată: se vede bine ce se formează.'
            : 'Reacție blândă: accentul cade pe schimbarea de compoziție.';
  }

  function resultHintFromProducts(effect, analysis){
    if(!analysis || !analysis.list.length) return 'Aștept reacția';
    if(effect === 'gas' && analysis.gases[0]){
      const others = analysis.list.filter(item => item.state !== 'gas').map(item => item.pretty).join(' + ');
      return others ? `Se degajă ${analysis.gases[0].pretty}; în vas rămân ${others}.` : `Se degajă ${analysis.gases[0].pretty}.`;
    }
    if((effect === 'precipitate' || effect === 'substitution') && analysis.solids[0]){
      const others = analysis.list.filter(item => item.state !== 'solid').map(item => item.pretty).join(' + ');
      return others ? `${analysis.solids[0].pretty} precipită, iar ${others} rămâne în soluție.` : `${analysis.solids[0].pretty} precipită vizibil.`;
    }
    if(effect === 'combustion'){
      return analysis.gases.length ? `Rezultă ${analysis.gases.map(item => item.pretty).join(' + ')} și lumină intensă.` : 'Reacție intensă, cu lumină și produse fierbinți.';
    }
    if(effect === 'decomposition'){
      return analysis.gases[0] ? `${analysis.gases[0].pretty} iese din reactor pe măsură ce substanța se descompune.` : 'Substanța se rupe în produse mai simple.';
    }
    if(effect === 'neutralization') return `Se formează ${analysis.list.map(item => item.pretty).join(' + ')}; amestecul se stabilizează.`;
    return describeProductMix(analysis);
  }

  function releaseTagText(analysis, state){
    const item = state === 'gas' ? analysis.gases[0] : analysis.solids[0];
    if(!item) return '';
    return state === 'gas' ? `${item.pretty} se degajă ↑` : `${item.pretty} precipită ↓`;
  }

  function labelForEffect(effect){
    return ({
      idle: 'Stand-by',
      neutralization: 'Neutralizare',
      gas: 'Degajare de gaz',
      precipitate: 'Precipitat',
      combustion: 'Combustie',
      decomposition: 'Descompunere',
      substitution: 'Substituție',
      unknown: 'Mix generic'
    })[effect] || cap(effect || 'rezultat');
  }

  function describeEffectHint(effect){
    switch(effect){
      case 'neutralization':
        return 'Valul de suprafață și schimbarea de culoare arată o neutralizare curată.';
      case 'gas':
        return 'Bulele, spuma și eticheta fac clar vizibil gazul degajat.';
      case 'precipitate':
        return 'Particulele solide coboară și se depun vizibil la baza reactorului.';
      case 'combustion':
        return 'Scântei, flash și nor fierbinte pentru o reacție energică.';
      case 'decomposition':
        return 'Se vede evacuarea produselor și agitarea internă a vasului.';
      case 'substitution':
        return 'Amestec turbulent, cu transformare de specie și particule în suspensie.';
      case 'unknown':
        return 'Am păstrat o animație neutră fiindcă nu există un efect dedicat.';
      default:
        return 'Apar după ce rulezi simularea.';
    }
  }

function renderSimulatorStatus(effect, type, eq, r1, r2, analysis){
    const board = document.getElementById('simStatusBoard');
    if(board) board.dataset.effect = effect;

    const typeBadge = document.getElementById('simTypeBadge');
    const typeHint = document.getElementById('simTypeHint');
    const effectBadge = document.getElementById('simEffectBadge');
    const effectHint = document.getElementById('simEffectHint');
    const statusBadge = document.getElementById('simStatusBadge');
    const statusHint = document.getElementById('simStatusHint');
    const layout = ((!!r1 && !r2) || effect === 'decomposition') ? 'single' : 'double';

    if(typeBadge) typeBadge.textContent = type || (eq ? 'Detectat automat' : '—');
    if(typeHint) typeHint.textContent = type
      ? 'Tipul reacției a fost recunoscut de motorul de reguli.'
      : eq
        ? 'Tip estimat din ecuația generată.'
        : 'Motorul clasifică reacția după produse și reactanți.';

    if(effectBadge) effectBadge.textContent = labelForEffect(effect);
    if(effectHint) effectHint.textContent = analysis && analysis.list.length
      ? resultHintFromProducts(effect, analysis)
      : describeEffectHint(effect);

    const hasInput = !!(r1 || r2);
    const layoutLabel = layout === 'single' ? '1 vas activ' : '2 borcane + vas';
    if(statusBadge) statusBadge.textContent = !eq
      ? (hasInput ? layoutLabel : 'Montaj gol')
      : (layout === 'single' ? '1 vas · simulat' : '2 borcane · simulat');
    if(statusHint) statusHint.textContent = !eq
      ? hasInput
        ? (layout === 'single'
            ? 'Ai un singur reactant, deci scena arată un vas unic de experiment. Apasă butonul principal ca să pornești simularea.'
            : 'Reactanții sunt plasați în borcanele laterale și sunt gata să fie turnați în vasul central.')
        : 'Poți folosi un preset rapid sau poți scrie formule manual.'
      : analysis && analysis.list.length
        ? `Montajul este sincronizat cu produșii marcați în scenă: ${describeProductMix(analysis)}`
        : 'Ecuația este echilibrată, iar animația este sincronizată cu rezultatul.';
  }


function renderReactionSteps(effect, type, eq, r1, r2){
    const box = document.getElementById('simReactionSteps');
    if(!box) return;

    const reactantsText = r1 && r2
      ? `${prettyFormula(r1)} + ${prettyFormula(r2)}`
      : r1
        ? prettyFormula(r1)
        : 'Alege reactanții';

    const analysis = eq ? analyzeProducts(eq) : { list: [], gases: [], solids: [], liquids: [], aqueous: [] };
    const products = analysis.list.length
      ? analysis.list.map(item => `${item.pretty} (${item.label})`).join(' + ')
      : 'Produșii apar după simulare';
    const visualFocus = analysis.gases.length
      ? `Se degajă ${analysis.gases.map(item => item.pretty).join(' + ')}.`
      : analysis.solids.length
        ? `Precipită ${analysis.solids.map(item => item.pretty).join(' + ')}.`
        : analysis.liquids.length
          ? `Se evidențiază ${analysis.liquids.map(item => item.pretty).join(' + ')}.`
          : 'Produșii rămân în soluție.';

    const steps = !eq
      ? [
          {
            title: 'Pregătire',
            text: r1
              ? (r2 ? `Reactanții selectați sunt ${reactantsText}.` : `${prettyFormula(r1)} este pregătit; poți testa și o descompunere.`)
              : 'Introdu formulele sau alege un preset demo.'
          },
          {
            title: 'Calcul reacție',
            text: 'Butonul principal generează ecuația și o echilibrează automat.'
          },
          {
            title: 'Feedback vizual',
            text: 'După simulare vezi imediat produșii, etichetele de degajare și efectele grafice.'
          }
        ]
      : [
          {
            title: 'Reactanți',
            text: r1 && r2 ? reactantsText : `${prettyFormula(r1)} intră într-o reacție de descompunere.`
          },
          {
            title: 'Clasificare',
            text: type ? `Reacția a fost încadrată la ${type.toLowerCase()}.` : `Efectul dominant este ${labelForEffect(effect).toLowerCase()}.`
          },
          {
            title: 'Produși / efect',
            text: `${products}. Vizual: ${visualFocus}`
          }
        ];

    box.innerHTML = steps.map((step, index) => `
      <article class="sim-step-card">
        <span class="sim-step-index">${index + 1}</span>
        <div>
          <strong>${step.title}</strong>
          <span>${step.text}</span>
        </div>
      </article>`).join('');
  }

function sceneNarration(effect, type, eq, r1, r2){
    const prettyEq = eq ? prettyFormula(eq) : '—';
    const analysis = eq ? analyzeProducts(eq) : { list: [], gases: [], solids: [], liquids: [], aqueous: [] };
    const gasText = analysis.gases.map(item => item.pretty).join(' + ');
    const solidText = analysis.solids.map(item => item.pretty).join(' + ');
    const singleMode = !!(r1 && !r2) || effect === 'decomposition';

    if(!eq){
      if(r1 && r2) return `Borcanele laterale sunt pregătite cu ${prettyFormula(r1)} și ${prettyFormula(r2)}. Apasă „Simulează reacția” ca să vezi turnarea în vasul central și efectele vizuale.`;
      if(r1) return `Ai introdus ${prettyFormula(r1)}. Simulatorul trece pe un singur vas, ca la un experiment real de descompunere sau încălzire.`;
      return 'Alege două substanțe și apasă butonul de reacție. Simulatorul folosește două borcane laterale sau un singur vas, în funcție de reacție.';
    }

    switch(effect){
      case 'neutralization':
        return `Cele două borcane toarnă controlat în vasul central, iar amestecul se liniștește pe măsură ce se formează ${describeProductMix(analysis)}. Ecuația este ${prettyEq}.`;
      case 'gas':
        return `Din vasul central se vede clar cum ${gasText || 'gazul rezultat'} se degajă: apar bule, spumă și vapori care ies pe gâtul vasului. Ecuația obținută este ${prettyEq}.`;
      case 'precipitate':
        return `După ce reactanții se varsă în vas, ${solidText || 'un precipitat'} începe să cadă și se depune vizibil la bază, exact ca într-un borcan real de laborator. Rezultatul calculat: ${prettyEq}.`;
      case 'combustion':
        return `Montajul se aprinde vizual: vasul central luminează, apar scântei și un nor fierbinte, iar simulatorul marchează produșii ${describeProductMix(analysis)}. Ecuația: ${prettyEq}.`;
      case 'decomposition':
        return `${singleMode ? 'În modul cu un singur vas' : 'În vasul central'}, ${prettyFormula(r1)} se descompune, iar ${gasText ? gasText + ' se degajă vizibil prin gâtul vasului' : 'produșii ies treptat din substanța inițială'}. Rezultatul: ${prettyEq}.`;
      case 'substitution':
        return `Borcanele laterale alimentează vasul de reacție, unde amestecul devine agitat și apar particule în suspensie. Produșii evidențiați sunt ${describeProductMix(analysis)}. Ecuația: ${prettyEq}.`;
      default:
        return type
          ? `Am recunoscut reacția ca ${type.toLowerCase()}, iar simulatorul o arată într-un vas central realist. Produșii marcați sunt ${describeProductMix(analysis)}. Ecuația afișată este ${prettyEq}.`
          : `Simulatorul a generat ecuația ${prettyEq}, dar folosește o animație neutră.`;
    }
  }


function syncSimulator(){
    const scene = document.getElementById('simulatorScene');
    if(!scene) return;

    const intensityInput = document.getElementById('simIntensity');
    const r1 = normalizeDigits((document.getElementById('react1') || {}).value || '').trim();
    const r2 = normalizeDigits((document.getElementById('react2') || {}).value || '').trim();
    const eq = String(readCurrentEq() || '');
    const type = String(readCurrentType() || '');

    const leftFamily = inferFormulaFamily(r1);
    const rightFamily = inferFormulaFamily(r2);
    const intensity = Math.max(35, Math.min(100, Number(intensityInput ? intensityInput.value : 72)));
    const speed = (0.85 + intensity / 88).toFixed(2);
    const analysis = eq ? analyzeProducts(eq) : { list: [], gases: [], solids: [], liquids: [], aqueous: [] };

    const effect = eq ? detectVisualEffect(type, eq, r1, r2) : 'idle';
    const layout = ((!!r1 && !r2) || effect === 'decomposition') ? 'single' : 'double';
    const dominantProduct = analysis.gases[0] || analysis.solids[0] || analysis.liquids[0] || analysis.aqueous[0] || null;
    const mixColor = dominantProduct && dominantProduct.color
      ? dominantProduct.color
      : effect === 'combustion'
        ? '#fb923c'
        : effect === 'precipitate'
          ? '#f8fafc'
          : effect === 'gas'
            ? '#7dd3fc'
            : effect === 'neutralization'
              ? '#34d399'
              : effect === 'substitution'
                ? '#f472b6'
                : '#94a3b8';

    scene.style.setProperty('--sim-speed', speed);
    scene.style.setProperty('--mix-color', mixColor);
    scene.style.setProperty('--left-color', leftFamily.color || '#60a5fa');
    scene.style.setProperty('--right-color', rightFamily.color || '#34d399');
    scene.style.setProperty('--vapor-color', (analysis.gases[0] && analysis.gases[0].color) || '#e0f2fe');
    scene.style.setProperty('--solid-color', (analysis.solids[0] && analysis.solids[0].color) || '#f8fafc');
    scene.dataset.effect = effect;
    scene.dataset.layout = layout;
    scene.dataset.heating = (effect === 'combustion' || effect === 'decomposition') ? 'true' : 'false';
    scene.dataset.hasGas = analysis.gases.length ? 'true' : 'false';
    scene.dataset.hasSolid = analysis.solids.length ? 'true' : 'false';

    const wrap = scene.closest('.simulator-wrap');
    if(wrap) wrap.style.setProperty('--sim-accent', mixColor);

    const leftLiquid = document.getElementById('simLeftLiquid');
    const rightLiquid = document.getElementById('simRightLiquid');
    const resultLiquid = document.getElementById('simResultLiquid');
    if(leftLiquid){
      leftLiquid.style.setProperty('--liquid-color', leftFamily.color);
      leftLiquid.style.setProperty('--liquid-height', layout === 'single' ? '0%' : '63%');
    }
    if(rightLiquid){
      rightLiquid.style.setProperty('--liquid-color', rightFamily.color);
      rightLiquid.style.setProperty('--liquid-height', layout === 'single' ? '0%' : '63%');
    }
    if(resultLiquid){
      const previewHeight = layout === 'single' ? '54%' : (r1 || r2 ? '24%' : '12%');
      resultLiquid.style.setProperty('--liquid-color', mixColor);
      resultLiquid.style.setProperty('--liquid-height', eq
        ? (effect === 'combustion' ? '74%' : analysis.gases.length ? '66%' : analysis.solids.length ? '61%' : layout === 'single' ? '64%' : '59%')
        : previewHeight);
    }

    const reactorRole = document.querySelector('.sim-vessel-role--reactor');
    if(reactorRole) reactorRole.textContent = layout === 'single' ? 'Experiment într-un singur vas' : 'Vasul în care faci experimentul';

    const intensityFactor = intensity / 100;
    const bubbleCount = effect === 'gas'
      ? Math.round(16 + intensityFactor * 20)
      : effect === 'neutralization'
        ? Math.round(8 + intensityFactor * 12)
        : effect === 'decomposition'
          ? Math.round(11 + intensityFactor * 14)
          : 0;
    const smokeCount = effect === 'combustion'
      ? Math.round(8 + intensityFactor * 10)
      : effect === 'decomposition'
        ? Math.round(6 + intensityFactor * 7)
        : effect === 'substitution'
          ? Math.round(5 + intensityFactor * 6)
          : effect === 'precipitate'
            ? Math.round(4 + intensityFactor * 4)
            : 0;
    const sparkCount = effect === 'combustion' ? Math.round(10 + intensityFactor * 12) : 0;
    const vaporCount = (analysis.gases.length || effect === 'combustion' || effect === 'decomposition') ? Math.round(8 + intensityFactor * 14) : 0;
    const foamCount = (analysis.gases.length || effect === 'neutralization') ? Math.round(5 + intensityFactor * 8) : 0;
    const falloutCount = analysis.solids.length ? Math.round(10 + intensityFactor * 14) : effect === 'precipitate' ? Math.round(7 + intensityFactor * 10) : 0;

    buildParticles(document.getElementById('simBubbles'), 'bubble', bubbleCount);
    buildParticles(document.getElementById('simSmoke'), 'smoke', smokeCount);
    buildParticles(document.getElementById('simSparks'), 'spark', sparkCount);
    buildParticles(document.getElementById('simVapor'), 'vapor', vaporCount);
    buildParticles(document.getElementById('simFoam'), 'foam', foamCount);
    buildParticles(document.getElementById('simFallout'), 'fallout', falloutCount);

    const resultLabel = document.getElementById('simResultLabel');
    const resultHint = document.getElementById('simResultHint');
    const eqBox = document.getElementById('simReactionEq');
    const narration = document.getElementById('simulatorNarration');
    const gasTag = document.getElementById('simGasTag');
    const solidTag = document.getElementById('simSolidTag');

    if(resultLabel) resultLabel.textContent = eq ? labelForEffect(effect) : (layout === 'single' ? 'Vas unic' : 'Vas de reacție');
    if(resultHint) resultHint.textContent = !eq
      ? (r1 ? (layout === 'single' ? 'Poți simula reacția într-un singur vas' : (r2 ? 'Apasă Simulează pentru turnare și ecuație' : 'Aștept al doilea reactant')) : 'Aștept reacția')
      : resultHintFromProducts(effect, analysis);
    if(eqBox) eqBox.textContent = eq ? prettyFormula(eq) : 'Scrie substanțele și apasă „Simulează reacția”.';
    if(narration) narration.textContent = sceneNarration(effect, type, eq, r1, r2);

    if(gasTag){
      const label = eq ? releaseTagText(analysis, 'gas') : '';
      gasTag.textContent = label || 'Gaz degajat';
      gasTag.hidden = !label;
    }
    if(solidTag){
      const label = eq ? releaseTagText(analysis, 'solid') : '';
      solidTag.textContent = label || 'Precipitat';
      solidTag.hidden = !label;
    }

    renderProductTelemetry(effect, analysis, intensity);
    renderSimulatorStatus(effect, type, eq, r1, r2, analysis);
    renderReactionSteps(effect, type, eq, r1, r2);
    persistSimulatorState({ intensity });

    scene.classList.remove('is-playing');
    if(effect !== 'idle'){
      requestAnimationFrame(() => {
        requestAnimationFrame(() => scene.classList.add('is-playing'));
      });
    }

    schedulePretty();
  }


function resetSimulatorState(){
    if(typeof window.setCurrentReaction === 'function') window.setCurrentReaction('', '');
    const scene = document.getElementById('simulatorScene');
    if(scene){
      scene.dataset.effect = 'idle';
      scene.classList.remove('is-playing');
    }
    syncSimulator();
  }

  function ensureSectionHeader(target, title, description, icon){
    if(!target || target.dataset.labSectionReady === 'true') return;
    target.dataset.labSectionReady = 'true';
    target.classList.add('lab-mini-section');
    const header = document.createElement('div');
    header.className = 'lab-mini-section-header';
    header.innerHTML = `
      <div class="lab-mini-section-title">${icon || '✨'} <span>${title}</span></div>
      ${description ? `<div class="lab-mini-section-copy">${description}</div>` : ''}`;
    target.insertBefore(header, target.firstChild);
  }

  function organizeLaboratory(){
    const headings = Array.from(document.querySelectorAll('h1'));
    const periodicHeading = headings.find(item => /Tabel periodic/i.test(item.textContent));
    const reactionHeading = headings.find(item => /Reacții chimice/i.test(item.textContent));
    const periodicPanel = Array.from(document.querySelectorAll('.panel')).find(panel => panel.querySelector('#periodicTable'));
    const reactionPanel = Array.from(document.querySelectorAll('.panel')).find(panel => panel.querySelector('#react1') && panel.querySelector('#react2'));
    const calcWrap = document.querySelector('.calc-wrap');
    const favWrap = reactionPanel ? reactionPanel.querySelector('.fav-wrap') : null;
    const quizWrap = reactionPanel ? reactionPanel.querySelector('.quiz-wrap') : null;

    if(periodicHeading){
      periodicHeading.id = periodicHeading.id || 'lab-periodic';
      periodicHeading.classList.add('lab-anchor-target');
    }
    if(periodicPanel){
      periodicPanel.id = periodicPanel.id || 'lab-periodic-panel';
    }
    if(reactionHeading){
      reactionHeading.id = reactionHeading.id || 'lab-simulator';
      reactionHeading.classList.add('lab-anchor-target');
    }
    if(reactionPanel){
      reactionPanel.id = reactionPanel.id || 'lab-simulator-panel';
    }
    if(calcWrap){
      calcWrap.id = calcWrap.id || 'lab-molar';
      calcWrap.classList.add('lab-side-card', 'lab-anchor-target');
      ensureSectionHeader(calcWrap, 'Calculator de masă molară', 'Verifici rapid masa molară pentru formule simple și compuse.', '🧮');
    }
    if(favWrap){
      favWrap.id = favWrap.id || 'lab-favorites';
      ensureSectionHeader(favWrap, 'Favorite', 'Păstrezi reacțiile utile pentru recapitulare rapidă.', '⭐');
    }
    if(quizWrap){
      quizWrap.id = quizWrap.id || 'lab-quiz';
      ensureSectionHeader(quizWrap, 'Quiz rapid', 'Generezi 10 reacții și verifici instant răspunsurile.', '🎯');
    }

    if(reactionPanel && calcWrap && !document.getElementById('labPracticeGrid')){
      const grid = document.createElement('section');
      grid.id = 'labPracticeGrid';
      grid.className = 'lab-practice-grid';
      reactionPanel.parentNode.insertBefore(grid, reactionPanel);
      grid.appendChild(reactionPanel);
      grid.appendChild(calcWrap);
    }

    if(!document.getElementById('labQuickNav')){
      const nav = document.createElement('section');
      nav.id = 'labQuickNav';
      nav.className = 'lab-quick-nav';
      nav.innerHTML = `
        <span class="lab-quick-nav-label">🧭 Navigare rapidă</span>
        <button type="button" class="lab-quick-link" data-scroll-target="periodic-search">Căutare</button>
        <button type="button" class="lab-quick-link" data-scroll-target="lab-periodic">Tabel periodic</button>
        <button type="button" class="lab-quick-link" data-scroll-target="lab-simulator">Simulator</button>
        <button type="button" class="lab-quick-link" data-scroll-target="lab-favorites">Favorite</button>
        <button type="button" class="lab-quick-link" data-scroll-target="lab-quiz">Quiz</button>
        <button type="button" class="lab-quick-link" data-scroll-target="lab-molar">Masă molară</button>`;
      const anchor = document.getElementById('labLaunchpad') || document.querySelector('.topbar');
      if(anchor){
        anchor.insertAdjacentElement('afterend', nav);
        bindScrollButtons(nav);
      }
    }
  }

  function patchFunctions(){
    if(typeof window.renderElementDetails === 'function' && !window.renderElementDetails.__chemPatched){
      const originalRender = window.renderElementDetails;
      window.renderElementDetails = function(key){
        const result = originalRender.apply(this, arguments);
        augmentElementCard(key);
        schedulePretty();
        return result;
      };
      window.renderElementDetails.__chemPatched = true;
    }

    if(typeof window.reaction === 'function' && !window.reaction.__chemPatched){
      const originalReaction = window.reaction;
      window.reaction = function(){
        const result = originalReaction.apply(this, arguments);
        syncSimulator();
        schedulePretty();
        return result;
      };
      window.reaction.__chemPatched = true;
    }

    if(typeof window.renderFavorites === 'function' && !window.renderFavorites.__chemPatched){
      const original = window.renderFavorites;
      window.renderFavorites = function(){
        const out = original.apply(this, arguments);
        schedulePretty();
        return out;
      };
      window.renderFavorites.__chemPatched = true;
    }

    if(typeof window.renderQuiz === 'function' && !window.renderQuiz.__chemPatched){
      const original = window.renderQuiz;
      window.renderQuiz = function(){
        const out = original.apply(this, arguments);
        schedulePretty();
        return out;
      };
      window.renderQuiz.__chemPatched = true;
    }

    if(typeof window.calcMolarMass === 'function' && !window.calcMolarMass.__chemPatched){
      const original = window.calcMolarMass;
      window.calcMolarMass = function(){
        const out = original.apply(this, arguments);
        schedulePretty();
        return out;
      };
      window.calcMolarMass.__chemPatched = true;
    }

    if(typeof window.setRx === 'function' && !window.setRx.__chemPatched){
      const original = window.setRx;
      window.setRx = function(){
        const out = original.apply(this, arguments);
        ['react1', 'react2'].forEach(id => {
          const input = document.getElementById(id);
          if(input) input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        if(typeof window.reaction === 'function') window.reaction();
        return out;
      };
      window.setRx.__chemPatched = true;
    }

    if(typeof window.clearReactants === 'function' && !window.clearReactants.__chemPatched){
      const original = window.clearReactants;
      window.clearReactants = function(){
        const out = original.apply(this, arguments);
        resetSimulatorState();
        return out;
      };
      window.clearReactants.__chemPatched = true;
    }

    if(typeof window.clearReactant === 'function' && !window.clearReactant.__chemPatched){
      const original = window.clearReactant;
      window.clearReactant = function(){
        const out = original.apply(this, arguments);
        resetSimulatorState();
        return out;
      };
      window.clearReactant.__chemPatched = true;
    }

    if(typeof window.clearSearch === 'function' && !window.clearSearch.__chemPatched){
      const original = window.clearSearch;
      window.clearSearch = function(){
        const out = original.apply(this, arguments);
        const compound = document.getElementById('compoundExplorer');
        if(compound){ compound.hidden = true; compound.innerHTML = ''; }
        document.querySelectorAll('.element-cell').forEach(cell => cell.classList.remove('composition-hit'));
        schedulePretty();
        return out;
      };
      window.clearSearch.__chemPatched = true;
    }
  }

  function refreshHeaders(){
    const title = document.querySelector('.brand-title');
    const subtitle = document.querySelector('.brand-subtitle');
    if(title) title.textContent = 'ChemLab Simulator';
    if(subtitle) subtitle.textContent = 'tabel periodic vizual + experimente animate';
    if(document.title) document.title = 'ChemLab Simulator – Chimie Academy Pro';
  }

  function init(){
    refreshHeaders();
    buildLaunchPad();
    buildSearchTools();
    buildSimulator();
    organizeLaboratory();
    patchFunctions();
    augmentElementCard('hidrogen');
    syncSimulator();
    schedulePretty();
  }

  init();
})();
