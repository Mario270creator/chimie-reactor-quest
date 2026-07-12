(function(global){
  const DIGIT_TO_SUB = {"0":"₀","1":"₁","2":"₂","3":"₃","4":"₄","5":"₅","6":"₆","7":"₇","8":"₈","9":"₉"};
  const SUB_TO_DIGIT = {"₀":"0","₁":"1","₂":"2","₃":"3","₄":"4","₅":"5","₆":"6","₇":"7","₈":"8","₉":"9"};
  const ELEMENT_SYMBOLS = new Set([
    "H","He","Li","Be","B","C","N","O","F","Ne",
    "Na","Mg","Al","Si","P","S","Cl","Ar","K","Ca",
    "Sc","Ti","V","Cr","Mn","Fe","Co","Ni","Cu","Zn",
    "Ga","Ge","As","Se","Br","Kr","Rb","Sr","Y","Zr",
    "Nb","Mo","Tc","Ru","Rh","Pd","Ag","Cd","In","Sn",
    "Sb","Te","I","Xe","Cs","Ba","La","Ce","Pr","Nd",
    "Pm","Sm","Eu","Gd","Tb","Dy","Ho","Er","Tm","Yb",
    "Lu","Hf","Ta","W","Re","Os","Ir","Pt","Au","Hg",
    "Tl","Pb","Bi","Po","At","Rn","Fr","Ra","Ac","Th",
    "Pa","U","Np","Pu","Am","Cm","Bk","Cf","Es","Fm",
    "Md","No","Lr","Rf","Db","Sg","Bh","Hs","Mt","Ds",
    "Rg","Cn","Nh","Fl","Mc","Lv","Ts","Og"
  ]);
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA"]);
  const OBSERVED_ROOTS = new WeakSet();

  function normalizeSubscripts(value){
    return String(value == null ? "" : value).replace(/[₀₁₂₃₄₅₆₇₈₉]/g, function(ch){
      return SUB_TO_DIGIT[ch] || ch;
    });
  }

  function escapeHtml(value){
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function isChemicalToken(token){
    if(!token) return false;
    let s = normalizeSubscripts(String(token));
    s = s.replace(/^\(?\d+(?:\/\d+)?\)?/, "");
    if(!s || !/[A-Z]/.test(s)) return false;

    let i = 0;
    let foundElement = false;
    while(i < s.length){
      const ch = s[i];
      if(/[0-9]/.test(ch)){
        while(i < s.length && /[0-9]/.test(s[i])) i += 1;
        continue;
      }
      if(ch === "(" || ch === ")" || ch === "[" || ch === "]" || ch === "{" || ch === "}" || ch === "·" || ch === "⋅" || ch === "↓" || ch === "↑" || ch === "+" || ch === "-" || ch === "→" || ch === "="){
        i += 1;
        continue;
      }
      if(/[A-Z]/.test(ch)){
        let symbol = ch;
        if(i + 1 < s.length && /[a-z]/.test(s[i + 1])){
          symbol += s[i + 1];
          i += 1;
        }
        if(!ELEMENT_SYMBOLS.has(symbol)) return false;
        foundElement = true;
        i += 1;
        continue;
      }
      return false;
    }
    return foundElement;
  }

  function formatToken(token){
    const normalized = normalizeSubscripts(token);
    if(!isChemicalToken(normalized)) return token;

    let out = "";
    for(let i = 0; i < normalized.length; i += 1){
      const ch = normalized[i];
      if(/[0-9]/.test(ch)){
        const prev = out[out.length - 1] || "";
        if(/[A-Za-z₀₁₂₃₄₅₆₇₈₉\)\]]/.test(prev)){
          out += DIGIT_TO_SUB[ch];
        }else{
          out += ch;
        }
      }else{
        out += ch;
      }
    }
    return out;
  }

  function formatText(value){
    if(value == null) return "";
    return String(value).replace(/[A-Za-z0-9()\[\]{}·⋅↓↑+\-=]+/g, function(match){
      return isChemicalToken(match) ? formatToken(match) : match;
    });
  }

  function escapeAndFormat(value){
    return escapeHtml(formatText(value));
  }

  function shouldSkipTextNode(node){
    if(!node || node.nodeType !== 3) return true;
    const parent = node.parentElement;
    if(!parent) return false;
    if(parent.closest && parent.closest('.no-chem-format,[data-no-chem-format="1"]')) return true;
    let el = parent;
    while(el){
      if(SKIP_TAGS.has(el.tagName) || el.isContentEditable) return true;
      el = el.parentElement;
    }
    return false;
  }

  function formatTextNode(node){
    if(shouldSkipTextNode(node)) return;
    const formatted = formatText(node.nodeValue);
    if(formatted !== node.nodeValue){
      node.nodeValue = formatted;
    }
  }

  function formatTextNodes(root){
    if(!root || typeof document === 'undefined') return;

    if(root.nodeType === 3){
      formatTextNode(root);
      return;
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node){
        if(!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        return shouldSkipTextNode(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });

    const nodes = [];
    while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(formatTextNode);
  }

  function syncInput(input){
    if(!input || typeof input.value !== 'string') return;
    const start = typeof input.selectionStart === 'number' ? input.selectionStart : null;
    const end = typeof input.selectionEnd === 'number' ? input.selectionEnd : null;
    const formatted = formatText(input.value);
    if(formatted !== input.value){
      input.value = formatted;
      if(start != null && end != null && typeof input.setSelectionRange === 'function'){
        try{ input.setSelectionRange(start, end); }catch(err){}
      }
    }
  }

  function syncPlaceholder(input){
    if(input && typeof input.placeholder === 'string' && input.placeholder){
      input.placeholder = formatText(input.placeholder);
    }
  }

  function attachInput(input){
    if(!input || input.dataset.chemFormatAttached === '1') return input;
    input.dataset.chemFormatAttached = '1';
    syncPlaceholder(input);
    syncInput(input);
    input.addEventListener('input', function(){ syncInput(input); });
    input.addEventListener('blur', function(){ syncInput(input); });
    return input;
  }

  function observe(root){
    if(!root || typeof MutationObserver === 'undefined' || OBSERVED_ROOTS.has(root)) return null;
    const observer = new MutationObserver(function(mutations){
      mutations.forEach(function(mutation){
        if(mutation.type === 'characterData'){
          formatTextNode(mutation.target);
          return;
        }
        mutation.addedNodes.forEach(function(node){
          if(node.nodeType === 3){
            formatTextNode(node);
            return;
          }
          if(node.nodeType !== 1) return;
          formatTextNodes(node);
          if(node.matches && node.matches('input[data-chem-input], textarea[data-chem-input]')){
            attachInput(node);
          }
          if(node.querySelectorAll){
            node.querySelectorAll('input[data-chem-input], textarea[data-chem-input]').forEach(attachInput);
          }
        });
      });
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    OBSERVED_ROOTS.add(root);
    return observer;
  }

  global.ChemFormat = {
    normalizeSubscripts,
    isChemicalToken,
    formatToken,
    formatText,
    escapeHtml,
    escapeAndFormat,
    formatTextNodes,
    syncInput,
    syncPlaceholder,
    attachInput,
    observe
  };
})(window);