/*
 * Chem Editor · Chimie Academy
 * Toolbar reutilizabil pentru indici chimici (H₂O), exponenți (Ca²⁺),
 * săgeți de reacție și simboluri uzuale.
 *
 * Folosire: adaugă atributul data-chem-editor pe orice <input> sau <textarea>.
 * Editorul folosește caractere Unicode reale, deci textul rămâne text simplu:
 * merge peste tot (teste, export, căutare) fără HTML special.
 */
(function () {
  'use strict';

  const SUB_MAP = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
    '+': '₊', '-': '₋', '(': '₍', ')': '₎',
  };
  const SUP_MAP = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻', '(': '⁽', ')': '⁾', 'n': 'ⁿ',
  };

  function mapChars(text, map) {
    return [...text].map((ch) => map[ch] || ch).join('');
  }

  // Formatare automată: „2H2O + CO2 -> H2CO3” devine „2H₂O + CO₂ → H₂CO₃”
  function autoFormat(text) {
    let out = text;
    out = out.replace(/<->|<=>/g, '⇌');
    out = out.replace(/-->|->/g, '→');
    // exponenți scriși cu ^ : Ca^2+  SO4^2-  Al^3+
    out = out.replace(/\^([0-9+\-()n]+)/g, (m, seq) => mapChars(seq, SUP_MAP));
    // cifre imediat după literă sau paranteză închisă → indici: H2O, Fe2(SO4)3
    out = out.replace(/([A-Za-zăâîșțĂÂÎȘȚ)\]])(\d+)/g, (m, prev, digits) => prev + mapChars(digits, SUB_MAP));
    return out;
  }

  function replaceSelection(field, transform) {
    const start = field.selectionStart;
    const end = field.selectionEnd;
    if (start === end) return false;
    const selected = field.value.slice(start, end);
    const replaced = transform(selected);
    field.setRangeText(replaced, start, end, 'end');
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.focus();
    return true;
  }

  function insertAtCursor(field, text) {
    const start = field.selectionStart ?? field.value.length;
    const end = field.selectionEnd ?? field.value.length;
    field.setRangeText(text, start, end, 'end');
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.focus();
  }

  function makeButton(label, title, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chem-btn';
    btn.innerHTML = label;
    btn.title = title;
    btn.setAttribute('aria-label', title);
    btn.addEventListener('mousedown', (e) => e.preventDefault()); // păstrează selecția
    btn.addEventListener('click', onClick);
    return btn;
  }

  function buildToolbar(field) {
    const bar = document.createElement('div');
    bar.className = 'chem-toolbar';

    const hint = () => alert('Selectează mai întâi cifrele sau semnele pe care vrei să le transformi.\nExemplu: în „H2O” selectezi „2”, apoi apeși X₂.');

    bar.appendChild(makeButton('X<sub>2</sub>', 'Indice (subscript) · selectează cifrele, apoi apasă', () => {
      if (!replaceSelection(field, (s) => mapChars(s, SUB_MAP))) hint();
    }));
    bar.appendChild(makeButton('X<sup>2</sup>', 'Exponent (superscript) · selectează cifrele/semnul, apoi apasă', () => {
      if (!replaceSelection(field, (s) => mapChars(s, SUP_MAP))) hint();
    }));

    bar.appendChild(makeButton('✨', 'Formatare automată · transformă tot textul (H2O → H₂O, -> → →, ^2+ → ²⁺)', () => {
      const start = field.selectionStart;
      const end = field.selectionEnd;
      if (start !== end) {
        replaceSelection(field, autoFormat);
      } else {
        field.value = autoFormat(field.value);
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.focus();
      }
    }));

    const symbols = [
      ['→', 'Săgeată de reacție'],
      ['⇌', 'Echilibru chimic'],
      ['↑', 'Degajare de gaz'],
      ['↓', 'Precipitat'],
      ['Δ', 'Încălzire (delta)'],
      ['°', 'Grad (°C)'],
      ['·', 'Punct de hidratare (CuSO₄·5H₂O)'],
    ];
    symbols.forEach(([sym, title]) => {
      bar.appendChild(makeButton(sym, `Inserează ${title}`, () => insertAtCursor(field, sym)));
    });

    // Formule rapide, frecvente la clasele VII-VIII
    const quick = document.createElement('select');
    quick.className = 'chem-quick';
    quick.title = 'Inserează rapid o formulă uzuală';
    const formulas = [
      'Formule rapide…', 'H₂O', 'CO₂', 'O₂', 'H₂', 'N₂', 'NaCl', 'HCl', 'H₂SO₄',
      'HNO₃', 'NaOH', 'Ca(OH)₂', 'CaCO₃', 'NH₃', 'CH₄', 'CuSO₄·5H₂O',
      'Fe₂O₃', 'Al₂(SO₄)₃', 'Na⁺', 'Cl⁻', 'Ca²⁺', 'SO₄²⁻', 'NO₃⁻', 'CO₃²⁻',
    ];
    formulas.forEach((f, i) => {
      const opt = document.createElement('option');
      opt.value = i === 0 ? '' : f;
      opt.textContent = f;
      quick.appendChild(opt);
    });
    quick.addEventListener('change', () => {
      if (quick.value) insertAtCursor(field, quick.value);
      quick.selectedIndex = 0;
    });
    bar.appendChild(quick);

    return bar;
  }

  function attach(field) {
    if (!field || field.dataset.chemEditorAttached === '1') return;
    field.dataset.chemEditorAttached = '1';
    const bar = buildToolbar(field);
    field.parentNode.insertBefore(bar, field);
    field.classList.add('chem-field');

    // Scurtături: Ctrl+Shift+ArrowDown = indice, Ctrl+Shift+ArrowUp = exponent
    field.addEventListener('keydown', (e) => {
      if (!e.ctrlKey || !e.shiftKey) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        replaceSelection(field, (s) => mapChars(s, SUB_MAP));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        replaceSelection(field, (s) => mapChars(s, SUP_MAP));
      }
    });
  }

  function scan(root) {
    (root || document).querySelectorAll('textarea[data-chem-editor], input[data-chem-editor]').forEach(attach);
  }

  // Atașare inițială + observare pentru elemente adăugate dinamic (constructorul de teste)
  document.addEventListener('DOMContentLoaded', () => scan(document));
  if (document.readyState !== 'loading') scan(document);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      m.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (node.matches && node.matches('textarea[data-chem-editor], input[data-chem-editor]')) attach(node);
        if (node.querySelectorAll) scan(node);
      });
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Expunem utilitarele pentru alte scripturi
  window.ChemEditor = { autoFormat, attach, scan };
})();
