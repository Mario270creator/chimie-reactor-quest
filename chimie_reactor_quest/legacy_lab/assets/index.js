(function(){
  const store = window.ChemStore;
  if(!store) return;

  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const tabButtons = Array.from(document.querySelectorAll('[data-auth-tab]'));
  const panels = Array.from(document.querySelectorAll('[data-auth-panel]'));
  const msg = document.getElementById('authMessage');
  const storageNotice = document.getElementById('storageNotice');

  function setTheme(){
    const theme = store.applyThemeToDocument ? store.applyThemeToDocument(document) : store.getTheme();
    if(!store.applyThemeToDocument){
      document.body.classList.toggle('dark', theme === 'dark');
      document.body.classList.toggle('neon', theme === 'neon');
    }
    const button = document.getElementById('themeToggle');
    if(button){
      const labels = {
        light: '🌤️ Luminoasă',
        dark: '🌙 Dark',
        neon: '⚡ Neon'
      };
      const names = { light: 'Luminoasă', dark: 'Dark', neon: 'Neon' };
      button.textContent = labels[theme] || labels.light;
      button.setAttribute('title', 'Schimbă tema: Luminoasă → Dark → Neon');
      button.setAttribute('aria-label', `Tema curentă: ${names[theme] || names.light}`);
    }
  }

  function showMessage(text, type){
    msg.textContent = text;
    msg.className = `notice ${type || ''}`.trim();
    msg.classList.remove('hidden');
  }

  function switchTab(tabName){
    tabButtons.forEach(button => {
      button.classList.toggle('btn-primary', button.dataset.authTab === tabName);
      button.classList.toggle('btn-secondary', button.dataset.authTab !== tabName);
    });
    panels.forEach(panel => {
      panel.classList.toggle('hidden', panel.dataset.authPanel !== tabName);
    });
    msg.classList.add('hidden');
  }

  function goToDashboard(){
    window.location.href = 'dashboard.html';
  }

  document.getElementById('themeToggle').addEventListener('click', function(){
    store.setTheme(store.nextTheme ? store.nextTheme(store.getTheme()) : (store.getTheme() === 'dark' ? 'light' : 'dark'));
    setTheme();
  });

  window.addEventListener('storage', setTheme);

  tabButtons.forEach(button => {
    button.addEventListener('click', function(){
      switchTab(button.dataset.authTab);
    });
  });

  loginForm.addEventListener('submit', function(event){
    event.preventDefault();
    const payload = {
      username: document.getElementById('loginUsername').value,
      password: document.getElementById('loginPassword').value,
      role: document.getElementById('loginRole').value
    };
    try{
      store.authenticate(payload);
      showMessage('Autentificare reușită. Te redirecționez...', 'success');
      setTimeout(goToDashboard, 350);
    }catch(err){
      showMessage(err.message, 'warning');
    }
  });

  registerForm.addEventListener('submit', function(event){
    event.preventDefault();
    const payload = {
      fullName: document.getElementById('registerName').value,
      username: document.getElementById('registerUsername').value,
      password: document.getElementById('registerPassword').value,
      role: document.getElementById('registerRole').value
    };
    try{
      store.register(payload);
      showMessage('Cont creat cu succes. Acum te poți loga.', 'success');
      registerForm.reset();
      document.getElementById('loginUsername').value = String(payload.username || '').trim().toLowerCase();
      document.getElementById('loginRole').value = payload.role;
      switchTab('login');
    }catch(err){
      showMessage(err.message, 'warning');
    }
  });

  document.querySelectorAll('[data-demo-role]').forEach(button => {
    button.addEventListener('click', function(){
      try{
        store.loginAsDemo(button.dataset.demoRole);
        goToDashboard();
      }catch(err){
        showMessage(err.message, 'warning');
      }
    });
  });

  store.load();
  setTheme();
  switchTab('login');

  if(storageNotice && store.getStorageInfo){
    const info = store.getStorageInfo();
    storageNotice.className = `notice ${info.isShared ? 'success' : ''}`.trim();
    storageNotice.innerHTML = info.isShared
      ? '<strong>Mod activ:</strong> bază comună pe server. Profesorul și elevii care intră pe același site pot vedea aceleași clase și înscrieri.'
      : '<strong>Mod activ:</strong> bază locală în browser. Pentru profesori și elevi pe dispozitive diferite, pornește site-ul prin HTTP/PHP sau folosește Export/Import JSON.';
  }

  const user = store.getCurrentUser();
  if(user){
    goToDashboard();
  }
})();
