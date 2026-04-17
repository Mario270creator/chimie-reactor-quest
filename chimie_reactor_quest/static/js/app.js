
(function () {
  const html = document.documentElement;
  const body = document.body;
  const themeButtons = document.querySelectorAll('[data-theme-toggle]');
  const savedTheme = localStorage.getItem('reactorQuest.theme');
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  const initialTheme = savedTheme || (prefersLight ? 'light' : 'dark');
  body.setAttribute('data-theme', initialTheme);

  themeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const current = body.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      body.setAttribute('data-theme', current);
      localStorage.setItem('reactorQuest.theme', current);
    });
  });

  const navToggle = document.querySelector('[data-nav-toggle]');
  const navMenu = document.querySelector('[data-nav-menu]');
  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      navMenu.classList.toggle('open');
    });
  }

  document.querySelectorAll('[data-copy-text]').forEach((button) => {
    button.addEventListener('click', async () => {
      const text = button.getAttribute('data-copy-text') || '';
      try {
        await navigator.clipboard.writeText(text);
        const old = button.textContent;
        button.textContent = 'Copiat';
        setTimeout(() => { button.textContent = old; }, 1200);
      } catch (err) {
        alert('Nu am reușit să copiez textul.');
      }
    });
  });

  const announceForm = document.querySelector('[data-announce-form]');
  const announceSelect = document.querySelector('[data-announce-select]');
  if (announceForm && announceSelect) {
    const syncAnnounceAction = () => {
      const option = announceSelect.options[announceSelect.selectedIndex];
      if (option && option.dataset.action) {
        announceForm.action = option.dataset.action;
      }
    };
    announceSelect.addEventListener('change', syncAnnounceAction);
    syncAnnounceAction();
  }

  // -------- quiz builder --------
  const builder = document.getElementById('questionBuilder');
  const addQuestionBtn = document.getElementById('addQuestionBtn');
  const questionsPayload = document.getElementById('questionsPayload');
  const quizForm = document.getElementById('quizBuilderForm');

  function questionTemplate(index) {
    return `
      <div class="builder-item" data-question-item>
        <div class="builder-head">
          <h4>Întrebarea ${index + 1}</h4>
          <button class="btn ghost small" type="button" data-remove-question>Șterge</button>
        </div>
        <div class="stack-form">
          <label><span>Enunț</span><input type="text" data-q-text placeholder="Scrie întrebarea" required></label>
          <div class="builder-options">
            <label><span>Opțiunea 1</span><input type="text" data-q-option="0" required></label>
            <label><span>Opțiunea 2</span><input type="text" data-q-option="1" required></label>
            <label><span>Opțiunea 3</span><input type="text" data-q-option="2" required></label>
            <label><span>Opțiunea 4</span><input type="text" data-q-option="3" required></label>
          </div>
          <label>
            <span>Răspuns corect</span>
            <select data-q-correct>
              <option value="0">Opțiunea 1</option>
              <option value="1">Opțiunea 2</option>
              <option value="2">Opțiunea 3</option>
              <option value="3">Opțiunea 4</option>
            </select>
          </label>
          <label><span>Explicație</span><textarea rows="3" data-q-explanation placeholder="De ce acesta este răspunsul corect?"></textarea></label>
        </div>
      </div>
    `;
  }

  function refreshQuestionTitles() {
    if (!builder) return;
    builder.querySelectorAll('[data-question-item]').forEach((item, idx) => {
      const heading = item.querySelector('h4');
      if (heading) heading.textContent = `Întrebarea ${idx + 1}`;
    });
  }

  function addQuestion() {
    if (!builder) return;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = questionTemplate(builder.querySelectorAll('[data-question-item]').length);
    const item = wrapper.firstElementChild;
    builder.appendChild(item);
    item.querySelector('[data-remove-question]').addEventListener('click', () => {
      item.remove();
      refreshQuestionTitles();
    });
    refreshQuestionTitles();
  }

  if (builder && addQuestionBtn) {
    addQuestionBtn.addEventListener('click', addQuestion);
    if (!builder.querySelector('[data-question-item]')) {
      addQuestion();
      addQuestion();
    }
  }

  function serializeQuestions() {
    if (!builder || !questionsPayload) return true;
    const items = [...builder.querySelectorAll('[data-question-item]')];
    if (!items.length) {
      alert('Adaugă cel puțin o întrebare.');
      return false;
    }
    const data = items.map((item) => ({
      text: item.querySelector('[data-q-text]').value.trim(),
      options: [0, 1, 2, 3].map((idx) => item.querySelector(`[data-q-option="${idx}"]`).value.trim()),
      correct: Number(item.querySelector('[data-q-correct]').value),
      explanation: item.querySelector('[data-q-explanation]').value.trim(),
    }));
    if (data.some((q) => !q.text || q.options.some((opt) => !opt))) {
      alert('Completează toate întrebările și toate opțiunile.');
      return false;
    }
    questionsPayload.value = JSON.stringify(data);
    return true;
  }

  if (quizForm) {
    quizForm.addEventListener('submit', (event) => {
      if (!serializeQuestions()) {
        event.preventDefault();
      }
    });
  }

  // -------- navigator --------
  const navGoal = document.querySelector('[data-nav-goal]');
  const navMethod = document.querySelector('[data-nav-method]');
  const navImpact = document.querySelector('[data-nav-impact]');
  const navResult = document.querySelector('[data-nav-result]');

  function updateNavigator() {
    if (!navGoal || !navMethod || !navImpact || !navResult) return;
    const votes = [navGoal.value, navMethod.value, navImpact.value];
    const counts = votes.reduce((acc, vote) => {
      acc[vote] = (acc[vote] || 0) + 1;
      return acc;
    }, {});
    let best = 'A';
    ['A', 'B', 'C'].forEach((key) => {
      if ((counts[key] || 0) > (counts[best] || 0)) best = key;
    });
    const messages = {
      A: 'Recomandare: Secțiunea A · proiect orientat spre cunoaștere teoretică, modelare, analiză și rigoare științifică.',
      B: 'Recomandare: Secțiunea B · proiect orientat spre prototip, soluție practică, testare și impact real.',
      C: 'Recomandare: Secțiunea C · proiect orientat spre software, algoritmi, AI și demonstrație digitală funcțională.',
    };
    navResult.innerHTML = `<strong>${messages[best]}</strong>`;
  }
  [navGoal, navMethod, navImpact].forEach((node) => {
    if (node) node.addEventListener('change', updateNavigator);
  });
  updateNavigator();

  // -------- rubric --------
  const rubricInputs = document.querySelectorAll('[data-rubric-input]');
  const rubricTotal = document.querySelector('[data-rubric-total]');
  function updateRubric() {
    if (!rubricInputs.length || !rubricTotal) return;
    const sum = [...rubricInputs].reduce((total, input) => total + Number(input.value || 0), 0);
    rubricTotal.textContent = String(sum);
  }
  rubricInputs.forEach((input) => input.addEventListener('input', updateRubric));
  updateRubric();

  // -------- pitch timer --------
  const timerDisplay = document.querySelector('[data-timer-display]');
  const timerLabel = document.querySelector('[data-timer-label]');
  const timerMinutes = document.querySelector('[data-timer-minutes]');
  const timerSeconds = document.querySelector('[data-timer-seconds]');
  const startBtn = document.querySelector('[data-timer-start]');
  const pauseBtn = document.querySelector('[data-timer-pause]');
  const resetBtn = document.querySelector('[data-timer-reset]');
  const modeButtons = document.querySelectorAll('[data-timer-mode]');
  let timerHandle = null;
  let remainingSeconds = 600;
  let activeMode = 'presentation';

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function syncTimerInputs() {
    if (!timerMinutes || !timerSeconds) return;
    timerMinutes.value = Math.floor(remainingSeconds / 60);
    timerSeconds.value = remainingSeconds % 60;
  }

  function renderTimer() {
    if (!timerDisplay) return;
    timerDisplay.textContent = formatTime(remainingSeconds);
    if (timerLabel) {
      const labels = {
        presentation: 'Mod: Prezentare ONCS',
        qa: 'Mod: Întrebări și răspunsuri',
        custom: 'Mod: Timp personalizat',
      };
      timerLabel.textContent = labels[activeMode] || labels.custom;
    }
  }

  function setMode(mode) {
    activeMode = mode;
    const presets = { presentation: 600, qa: 300 };
    if (mode !== 'custom') {
      remainingSeconds = presets[mode];
      syncTimerInputs();
      renderTimer();
    } else {
      remainingSeconds = (Number(timerMinutes?.value || 10) * 60) + Number(timerSeconds?.value || 0);
      renderTimer();
    }
    modeButtons.forEach((btn) => {
      btn.classList.toggle('primary', btn.getAttribute('data-timer-mode') === mode);
      btn.classList.toggle('ghost', btn.getAttribute('data-timer-mode') !== mode);
    });
  }

  function stopTimer() {
    if (timerHandle) clearInterval(timerHandle);
    timerHandle = null;
  }

  function startTimer() {
    if (!timerDisplay || timerHandle) return;
    stopTimer();
    timerHandle = setInterval(() => {
      remainingSeconds -= 1;
      if (remainingSeconds <= 0) {
        remainingSeconds = 0;
        stopTimer();
        if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
      }
      renderTimer();
      syncTimerInputs();
    }, 1000);
  }

  if (timerDisplay) {
    renderTimer();
    syncTimerInputs();
    modeButtons.forEach((btn) => btn.addEventListener('click', () => setMode(btn.getAttribute('data-timer-mode'))));
    startBtn?.addEventListener('click', () => {
      if (activeMode === 'custom') {
        remainingSeconds = (Number(timerMinutes?.value || 0) * 60) + Number(timerSeconds?.value || 0);
        renderTimer();
      }
      startTimer();
    });
    pauseBtn?.addEventListener('click', stopTimer);
    resetBtn?.addEventListener('click', () => {
      stopTimer();
      setMode(activeMode);
      if (activeMode === 'custom') {
        remainingSeconds = (Number(timerMinutes?.value || 10) * 60) + Number(timerSeconds?.value || 0);
        renderTimer();
      }
    });
    timerMinutes?.addEventListener('change', () => {
      if (activeMode === 'custom') {
        remainingSeconds = (Number(timerMinutes.value || 0) * 60) + Number(timerSeconds?.value || 0);
        renderTimer();
      }
    });
    timerSeconds?.addEventListener('change', () => {
      if (activeMode === 'custom') {
        remainingSeconds = (Number(timerMinutes?.value || 0) * 60) + Number(timerSeconds.value || 0);
        renderTimer();
      }
    });
  }

  // PWA install hint
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
})();
