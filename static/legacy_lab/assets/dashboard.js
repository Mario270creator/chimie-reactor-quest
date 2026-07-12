(function(){
  const store = window.ChemStore;
  if(!store) return;

  const state = {
    view: 'overview',
    quizDraft: [],
    quizMeta: {
      classId: '',
      title: '',
      instructions: ''
    },
    activeQuizId: null,
    activeSubmission: null
  };

  const els = {
    body: document.body,
    pageTitle: document.getElementById('pageTitle'),
    userFullName: document.getElementById('userFullName'),
    userRole: document.getElementById('userRole'),
    userInitials: document.getElementById('userInitials'),
    navButtons: Array.from(document.querySelectorAll('[data-view-target]')),
    views: Array.from(document.querySelectorAll('.view')),
    statsWrap: document.getElementById('overviewStats'),
    overviewLeft: document.getElementById('overviewLeft'),
    overviewRight: document.getElementById('overviewRight'),
    announcementFormWrap: document.getElementById('announcementFormWrap'),
    announcementList: document.getElementById('announcementList'),
    classActions: document.getElementById('classActions'),
    classList: document.getElementById('classList'),
    lessonActions: document.getElementById('lessonActions'),
    lessonFilters: document.getElementById('lessonFilters'),
    lessonList: document.getElementById('lessonList'),
    quizActions: document.getElementById('quizActions'),
    quizList: document.getElementById('quizList'),
    quizRunner: document.getElementById('quizRunner'),
    resultsSummary: document.getElementById('resultsSummary'),
    resultsTable: document.getElementById('resultsTable'),
    leaderboardWrap: document.getElementById('leaderboardWrap'),
    dataPanel: document.getElementById('dataPanel'),
    modal: document.getElementById('modal'),
    modalTitle: document.getElementById('modalTitle'),
    modalContent: document.getElementById('modalContent'),
    toast: document.getElementById('toast'),
    importInput: document.getElementById('importInput'),
    themeToggle: document.getElementById('themeToggleApp'),
    sidebar: document.getElementById('sidebar'),
    mobileMenuBtn: document.getElementById('mobileMenuBtn'),
    mobileSidebarClose: document.getElementById('mobileSidebarClose'),
    mobileOverlay: document.getElementById('mobileOverlay')
  };

  let db = store.load();
  let currentUser = store.getCurrentUser(db);

  if(!currentUser){
    window.location.href = 'index.html';
    return;
  }

  function escapeHtml(value){
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function classesForCurrentUser(){
    return store.classesForUser(db, currentUser);
  }

  function classMap(){
    const map = {};
    db.classes.forEach(item => { map[item.id] = item; });
    return map;
  }

  function userMap(){
    const map = {};
    db.users.forEach(item => { map[item.id] = item; });
    return map;
  }

  function isTeacher(){
    return currentUser.role === 'profesor';
  }

  function showToast(text, type){
    els.toast.textContent = text;
    els.toast.className = `toast show ${type || ''}`.trim();
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      els.toast.className = 'toast';
    }, 2600);
  }

  async function copyText(text){
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){
        await navigator.clipboard.writeText(text);
        return true;
      }
    }catch(err){}
    try{
      const input = document.createElement('textarea');
      input.value = text;
      document.body.appendChild(input);
      input.select();
      const ok = document.execCommand('copy');
      input.remove();
      return ok;
    }catch(err){
      return false;
    }
  }

  function applyTheme(){
    const theme = store.applyThemeToDocument ? store.applyThemeToDocument(document) : store.getTheme();
    if(!store.applyThemeToDocument){
      document.body.classList.toggle('dark', theme === 'dark');
      document.body.classList.toggle('neon', theme === 'neon');
    }
    if(els.themeToggle){
      const labels = {
        light: '🌤️ Luminoasă',
        dark: '🌙 Dark',
        neon: '⚡ Neon'
      };
      const names = { light: 'Luminoasă', dark: 'Dark', neon: 'Neon' };
      els.themeToggle.textContent = labels[theme] || labels.light;
      els.themeToggle.setAttribute('title', 'Schimbă tema: Luminoasă → Dark → Neon');
      els.themeToggle.setAttribute('aria-label', `Tema curentă: ${names[theme] || names.light}`);
    }
    const labFrame = document.querySelector('#view-laboratory iframe');
    try{
      if(labFrame && labFrame.contentWindow && typeof labFrame.contentWindow.applySharedTheme === 'function'){
        labFrame.contentWindow.applySharedTheme(theme);
      }
    }catch(err){}
  }

  function refresh(){
    db = store.load();
    currentUser = store.getCurrentUser(db);
    if(!currentUser){
      window.location.href = 'index.html';
      return;
    }
    hydrateHeader();
    renderOverview();
    renderClasses();
    renderLessons();
    renderQuizzes();
    renderResults();
    renderDataTools();
    renderLabNotice();
    updateView(state.view);
  }

  function hydrateHeader(){
    els.pageTitle.textContent = isTeacher() ? 'Panou profesor' : 'Panou elev';
    els.userFullName.textContent = currentUser.fullName;
    els.userRole.textContent = currentUser.role === 'profesor' ? 'Profesor' : 'Elev';
    els.userInitials.textContent = store.initials(currentUser.fullName);
  }

  function updateView(viewName){
    state.view = viewName;
    els.navButtons.forEach(button => {
      button.classList.toggle('active', button.dataset.viewTarget === viewName);
    });
    els.views.forEach(view => {
      view.classList.toggle('active', view.id === `view-${viewName}`);
    });
    closeMobileNav();
  }

  function isCompactLayout(){
    return window.matchMedia('(max-width: 1080px)').matches;
  }

  function setMobileNav(open){
    document.body.classList.toggle('nav-open', !!open);
    if(els.mobileMenuBtn){
      els.mobileMenuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    if(els.sidebar){
      els.sidebar.setAttribute('aria-hidden', open ? 'false' : String(isCompactLayout()));
    }
  }

  function openMobileNav(){
    if(isCompactLayout()) setMobileNav(true);
  }

  function closeMobileNav(){
    setMobileNav(false);
  }

  function getAnnouncementsForUser(){
    const allowedClassIds = new Set(classesForCurrentUser().map(item => item.id));
    return db.announcements
      .filter(item => allowedClassIds.has(item.classId))
      .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function getLessonsForUser(){
    const allowedClassIds = new Set(classesForCurrentUser().map(item => item.id));
    return db.lessons
      .filter(item => allowedClassIds.has(item.classId))
      .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function getQuizzesForUser(){
    const allowedClassIds = new Set(classesForCurrentUser().map(item => item.id));
    return db.quizzes
      .filter(item => allowedClassIds.has(item.classId))
      .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function getSubmissionsForCurrentContext(){
    if(isTeacher()){
      const ownQuizIds = new Set(db.quizzes.filter(item => item.teacherId === currentUser.id).map(item => item.id));
      return db.submissions
        .filter(item => ownQuizIds.has(item.quizId))
        .sort((a,b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    }
    return db.submissions
      .filter(item => item.studentId === currentUser.id)
      .sort((a,b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  }

  function bestSubmissionByQuiz(submissions){
    const map = {};
    submissions.forEach(item => {
      const existing = map[item.quizId];
      if(!existing || Number(item.percent) > Number(existing.percent)){
        map[item.quizId] = item;
      }
    });
    return map;
  }

  function renderOverview(){
    const myClasses = classesForCurrentUser();
    const myLessons = getLessonsForUser();
    const myQuizzes = getQuizzesForUser();
    const myAnnouncements = getAnnouncementsForUser();
    const mySubmissions = getSubmissionsForCurrentContext();

    let statsHtml = '';

    if(isTeacher()){
      const studentsInMyClasses = new Set(
        db.enrollments
          .filter(item => myClasses.some(cls => cls.id === item.classId))
          .map(item => item.userId)
      );
      const avg = mySubmissions.length
        ? Math.round(mySubmissions.reduce((sum, item) => sum + Number(item.percent || 0), 0) / mySubmissions.length)
        : 0;
      statsHtml = `
        <div class="card stat"><span class="badge">Clase</span><h3>${myClasses.length}</h3><p>grupe create de tine</p></div>
        <div class="card stat"><span class="badge success">Elevi</span><h3>${studentsInMyClasses.size}</h3><p>înscriși în clasele tale</p></div>
        <div class="card stat"><span class="badge purple">Lecții & teste</span><h3>${myLessons.length + myQuizzes.length}</h3><p>resurse publicate</p></div>
        <div class="card stat"><span class="badge warning">Scor mediu</span><h3>${avg}%</h3><p>din încercările elevilor</p></div>
      `;
    }else{
      const bestMap = Object.values(bestSubmissionByQuiz(mySubmissions));
      const avg = bestMap.length
        ? Math.round(bestMap.reduce((sum, item) => sum + Number(item.percent || 0), 0) / bestMap.length)
        : 0;
      statsHtml = `
        <div class="card stat"><span class="badge">Clase înscrise</span><h3>${myClasses.length}</h3><p>ai acces la aceste grupe</p></div>
        <div class="card stat"><span class="badge success">Lecții</span><h3>${myLessons.length}</h3><p>materiale disponibile</p></div>
        <div class="card stat"><span class="badge purple">Teste</span><h3>${myQuizzes.length}</h3><p>poți rezolva oricând</p></div>
        <div class="card stat"><span class="badge warning">Progres</span><h3>${avg}%</h3><p>media celor mai bune rezultate</p></div>
      `;
    }

    els.statsWrap.innerHTML = `<div class="grid-4">${statsHtml}</div>`;

    const recentTimeline = [];
    myAnnouncements.slice(0,4).forEach(item => recentTimeline.push({
      type: 'Anunț',
      title: item.title,
      body: item.content,
      date: item.createdAt
    }));
    myLessons.slice(0,3).forEach(item => recentTimeline.push({
      type: 'Lecție',
      title: item.title,
      body: item.summary || item.content.slice(0, 120),
      date: item.createdAt
    }));
    myQuizzes.slice(0,3).forEach(item => recentTimeline.push({
      type: 'Test',
      title: item.title,
      body: item.instructions || `${item.questions.length} întrebări`,
      date: item.createdAt
    }));
    recentTimeline.sort((a,b) => new Date(b.date) - new Date(a.date));

    els.overviewLeft.innerHTML = `
      <div class="section-title">
        <h2>Activitate recentă</h2>
        <span class="pill">${recentTimeline.length} evenimente</span>
      </div>
      ${
        recentTimeline.length
        ? `<div class="timeline">${recentTimeline.map(item => `
            <div class="timeline-item">
              <div class="badge">${escapeHtml(item.type)}</div>
              <h3 style="margin:8px 0 4px 0">${escapeHtml(item.title)}</h3>
              <div class="muted">${escapeHtml(item.body)}</div>
              <div class="small muted" style="margin-top:8px">${store.formatDate(item.date)}</div>
            </div>
          `).join('')}</div>`
        : `<div class="empty">Nu există încă activitate.</div>`
      }
    `;

    const topClassesHtml = myClasses.length
      ? myClasses.slice(0,4).map(cls => {
          const lessonsCount = db.lessons.filter(item => item.classId === cls.id).length;
          const quizzesCount = db.quizzes.filter(item => item.classId === cls.id).length;
          const studentCount = db.enrollments.filter(item => item.classId === cls.id).length;
          return `
            <div class="list-clean">
              <div>
                <strong>${escapeHtml(cls.name)} ${escapeHtml(cls.section)}</strong><br>
                <span class="muted">${escapeHtml(cls.description || 'Fără descriere')}</span>
                <div class="meta-row">
                  <span class="pill">Cod: ${escapeHtml(cls.code)}</span>
                  <span class="pill">${lessonsCount} lecții</span>
                  <span class="pill">${quizzesCount} teste</span>
                  <span class="pill">${studentCount} elevi</span>
                </div>
              </div>
            </div>
          `;
        }).join('')
      : `<div class="empty">Nu ai nicio clasă încă.</div>`;

    let sideHtml = `
      <div class="section-title">
        <h2>${isTeacher() ? 'Clasele tale' : 'Clasele în care ești înscris'}</h2>
        <span class="pill">${myClasses.length} total</span>
      </div>
      ${topClassesHtml}
    `;

    if(!isTeacher()){
      const pending = myQuizzes.length - Object.keys(bestSubmissionByQuiz(mySubmissions)).length;
      sideHtml += `
        <div style="height:16px"></div>
        <div class="notice ${pending > 0 ? 'warning' : 'success'}">
          <strong>Recomandare:</strong>
          ${pending > 0
            ? `mai ai ${pending} test${pending === 1 ? '' : 'e'} pe care nu le-ai încercat încă.`
            : 'ai rezolvat cel puțin o dată toate testele disponibile.'}
        </div>
      `;
    }else{
      sideHtml += `
        <div style="height:16px"></div>
        <div class="notice">
          <strong>Scurtătură utilă:</strong> deschide secțiunea <em>Laborator</em> pentru tabelul periodic și simulatorul de reacții din site-ul tău original.
        </div>
      `;
    }

    els.overviewRight.innerHTML = sideHtml;
    renderAnnouncements();
  }

  function renderAnnouncements(){
    const announcements = getAnnouncementsForUser();
    const myClasses = classesForCurrentUser();
    const classById = classMap();

    const formHtml = isTeacher() && myClasses.length
      ? `
        <div class="section-title"><h3>Anunț nou</h3></div>
        <form id="announcementForm" class="auth-form">
          <select id="announcementClassId">
            ${myClasses.map(cls => `<option value="${cls.id}">${escapeHtml(cls.name)} ${escapeHtml(cls.section)} · cod ${escapeHtml(cls.code)}</option>`).join('')}
          </select>
          <input id="announcementTitle" placeholder="Titlu anunț" />
          <textarea id="announcementContent" placeholder="Mesaj pentru elevi"></textarea>
          <button class="btn btn-primary" type="submit">Publică anunț</button>
        </form>
      `
      : `
        <div class="notice">
          <strong>Anunțuri:</strong> aici apar mesajele publicate de profesor pentru clasele tale.
        </div>
      `;

    els.announcementFormWrap.innerHTML = formHtml;

    if(isTeacher() && myClasses.length){
      const form = document.getElementById('announcementForm');
      form.addEventListener('submit', function(event){
        event.preventDefault();
        try{
          store.createAnnouncement({
            classId: document.getElementById('announcementClassId').value,
            title: document.getElementById('announcementTitle').value,
            content: document.getElementById('announcementContent').value,
            teacherId: currentUser.id
          });
          showToast('Anunț publicat.', 'success');
          refresh();
        }catch(err){
          showToast(err.message, 'warning');
        }
      });
    }

    els.announcementList.innerHTML = `
      <div class="section-title" style="margin-top:16px">
        <h3>Flux de anunțuri</h3>
        <span class="pill">${announcements.length}</span>
      </div>
      ${
        announcements.length
        ? `<div class="cards-list">${announcements.slice(0,8).map(item => `
            <div class="card-solid item-card">
              <div class="item-header">
                <div>
                  <h4>${escapeHtml(item.title)}</h4>
                  <div class="muted">${escapeHtml(classById[item.classId] ? `${classById[item.classId].name} ${classById[item.classId].section}` : 'Clasă')}</div>
                </div>
                <span class="pill">${store.formatDate(item.createdAt)}</span>
              </div>
              <div class="muted">${escapeHtml(item.content)}</div>
              ${isTeacher() ? `
                <div class="item-actions">
                  <button class="btn btn-danger btn-sm" data-action="delete-announcement" data-id="${item.id}">Șterge</button>
                </div>
              ` : ''}
            </div>
          `).join('')}</div>`
        : `<div class="empty">Nu există anunțuri încă.</div>`
      }
    `;
  }

  function renderClasses(){
    const myClasses = classesForCurrentUser();
    const uMap = userMap();

    if(isTeacher()){
      els.classActions.innerHTML = `
        <div class="section-title"><h2>Creează o clasă nouă</h2></div>
        <form id="classForm" class="auth-form">
          <div class="form-grid">
            <input id="className" placeholder="Ex: Clasa VII" />
            <input id="classSection" placeholder="Ex: A" />
          </div>
          <textarea id="classDescription" placeholder="Descriere scurtă a clasei"></textarea>
          <button class="btn btn-success" type="submit">Creează clasa</button>
        </form>
      `;

      document.getElementById('classForm').addEventListener('submit', function(event){
        event.preventDefault();
        try{
          const classroom = store.createClass({
            name: document.getElementById('className').value,
            section: document.getElementById('classSection').value,
            description: document.getElementById('classDescription').value,
            teacherId: currentUser.id
          });
          showToast(`Clasa a fost creată. Cod: ${classroom.code}`, 'success');
          refresh();
        }catch(err){
          showToast(err.message, 'warning');
        }
      });

      els.classList.innerHTML = myClasses.length ? `
        <div class="cards-list">${myClasses.map(cls => {
          const students = db.enrollments.filter(item => item.classId === cls.id).map(item => uMap[item.userId]).filter(Boolean);
          const lessonsCount = db.lessons.filter(item => item.classId === cls.id).length;
          const quizzesCount = db.quizzes.filter(item => item.classId === cls.id).length;
          return `
            <div class="card item-card">
              <div class="item-header">
                <div>
                  <h3>${escapeHtml(cls.name)} ${escapeHtml(cls.section)}</h3>
                  <div class="muted">${escapeHtml(cls.description || 'Fără descriere')}</div>
                </div>
                <span class="badge">Cod clasă: ${escapeHtml(cls.code)}</span>
              </div>
              <div class="meta-row">
                <span class="pill">${students.length} elevi</span>
                <span class="pill">${lessonsCount} lecții</span>
                <span class="pill">${quizzesCount} teste</span>
                <span class="pill">Creată: ${store.formatDate(cls.createdAt)}</span>
              </div>
              <div style="margin-top:14px">
                <strong>Elevi înscriși:</strong>
                ${
                  students.length
                  ? `<div class="meta-row" style="margin-top:10px">${students.map(student => `<span class="pill">${escapeHtml(student.fullName)}</span>`).join('')}</div>`
                  : `<div class="muted" style="margin-top:8px">Nu există elevi înscriși încă.</div>`
                }
              </div>
              <div class="item-actions">
                <button class="btn btn-secondary btn-sm" data-action="copy-code" data-code="${cls.code}">Copiază codul</button>
                <button class="btn btn-danger btn-sm" data-action="delete-class" data-id="${cls.id}">Șterge clasa</button>
              </div>
            </div>
          `;
        }).join('')}</div>
      ` : `<div class="empty">Nu ai creat nicio clasă încă.</div>`;
    }else{
      const storageInfo = store.getStorageInfo();
      els.classActions.innerHTML = `
        <div class="section-title"><h2>Înscrie-te într-o clasă</h2></div>
        <form id="joinClassForm" class="auth-form">
          <input id="joinClassCode" placeholder="Introdu codul clasei, ex: VIIA24" />
          <button class="btn btn-primary" type="submit">Înscrie-mă</button>
        </form>
        <div class="notice" style="margin-top:14px">
          ${storageInfo.isShared
            ? 'Profesorul îți dă un cod de clasă. Tu îl introduci aici și primești acces la lecții, teste și anunțuri din baza comună a site-ului.'
            : 'Profesorul îți dă un cod de clasă. În modul local, codul merge doar în același browser sau după transfer de date prin Export/Import JSON.'}
        </div>
      `;
      document.getElementById('joinClassForm').addEventListener('submit', function(event){
        event.preventDefault();
        try{
          const classroom = store.joinClass({
            userId: currentUser.id,
            code: document.getElementById('joinClassCode').value
          });
          showToast(`Te-ai înscris în ${classroom.name} ${classroom.section}.`, 'success');
          refresh();
        }catch(err){
          showToast(err.message, 'warning');
        }
      });

      els.classList.innerHTML = myClasses.length ? `
        <div class="cards-list">${myClasses.map(cls => {
          const teacher = uMap[cls.teacherId];
          const lessonsCount = db.lessons.filter(item => item.classId === cls.id).length;
          const quizzesCount = db.quizzes.filter(item => item.classId === cls.id).length;
          return `
            <div class="card item-card">
              <div class="item-header">
                <div>
                  <h3>${escapeHtml(cls.name)} ${escapeHtml(cls.section)}</h3>
                  <div class="muted">${escapeHtml(cls.description || 'Fără descriere')}</div>
                </div>
                <span class="badge success">Cod: ${escapeHtml(cls.code)}</span>
              </div>
              <div class="meta-row">
                <span class="pill">Profesor: ${escapeHtml(teacher ? teacher.fullName : '—')}</span>
                <span class="pill">${lessonsCount} lecții</span>
                <span class="pill">${quizzesCount} teste</span>
              </div>
            </div>
          `;
        }).join('')}</div>
      ` : `<div class="empty">Nu ești înscris în nicio clasă.</div>`;
    }
  }

  function renderLessons(){
    const myClasses = classesForCurrentUser();
    const classById = classMap();
    const lessons = getLessonsForUser();

    if(isTeacher() && myClasses.length){
      els.lessonActions.innerHTML = `
        <div class="section-title"><h2>Publică o lecție</h2></div>
        <form id="lessonForm" class="auth-form">
          <div class="form-grid">
            <select id="lessonClassId">
              ${myClasses.map(cls => `<option value="${cls.id}">${escapeHtml(cls.name)} ${escapeHtml(cls.section)}</option>`).join('')}
            </select>
            <input id="lessonTitle" placeholder="Titlul lecției" />
          </div>
          <div class="form-grid">
            <input id="lessonSummary" placeholder="Rezumat scurt" />
            <input id="lessonMinutes" type="number" min="5" value="20" placeholder="Minute estimate" />
          </div>
          <input id="lessonTags" placeholder="Etichete separate prin virgulă" />
          <textarea id="lessonContent" placeholder="Conținutul lecției"></textarea>
          <button class="btn btn-success" type="submit">Salvează lecția</button>
        </form>
      `;

      document.getElementById('lessonForm').addEventListener('submit', function(event){
        event.preventDefault();
        try{
          store.createLesson({
            classId: document.getElementById('lessonClassId').value,
            title: document.getElementById('lessonTitle').value,
            summary: document.getElementById('lessonSummary').value,
            estimatedMinutes: document.getElementById('lessonMinutes').value,
            tags: document.getElementById('lessonTags').value,
            content: document.getElementById('lessonContent').value,
            teacherId: currentUser.id
          });
          showToast('Lecția a fost publicată.', 'success');
          refresh();
        }catch(err){
          showToast(err.message, 'warning');
        }
      });
    }else if(isTeacher()){
      els.lessonActions.innerHTML = `<div class="empty">Creează mai întâi o clasă ca să poți publica lecții.</div>`;
    }else{
      els.lessonActions.innerHTML = `
        <div class="notice">
          <strong>Cum folosești lecțiile:</strong> deschide o lecție, citește rezumatul și urmărește etichetele. Profesorul poate actualiza conținutul prin ștergere și republicare.
        </div>
      `;
    }

    els.lessonFilters.innerHTML = lessons.length ? `
      <div class="section-title">
        <h2>Lecții disponibile</h2>
        <span class="pill">${lessons.length}</span>
      </div>
    ` : '';

    els.lessonList.innerHTML = lessons.length ? `
      <div class="cards-list">${lessons.map(lesson => `
        <div class="card item-card">
          <div class="item-header">
            <div>
              <h3>${escapeHtml(lesson.title)}</h3>
              <div class="muted">${escapeHtml(lesson.summary || 'Fără rezumat')}</div>
            </div>
            <span class="badge">${escapeHtml(classById[lesson.classId] ? `${classById[lesson.classId].name} ${classById[lesson.classId].section}` : 'Clasă')}</span>
          </div>
          <div class="meta-row">
            <span class="pill">${lesson.estimatedMinutes || 15} min</span>
            <span class="pill">${store.formatDate(lesson.createdAt)}</span>
            ${(lesson.tags || []).slice(0,4).map(tag => `<span class="pill">${escapeHtml(tag)}</span>`).join('')}
          </div>
          <div class="item-actions">
            <button class="btn btn-primary btn-sm" data-action="open-lesson" data-id="${lesson.id}">Deschide lecția</button>
            ${isTeacher() ? `<button class="btn btn-danger btn-sm" data-action="delete-lesson" data-id="${lesson.id}">Șterge</button>` : ''}
          </div>
        </div>
      `).join('')}</div>
    ` : `<div class="empty">Nu există lecții încă pentru contul tău.</div>`;
  }

  function renderQuizDraft(){
    const draftWrap = document.getElementById('quizDraftPreview');
    if(!draftWrap) return;
    draftWrap.innerHTML = state.quizDraft.length ? `
      <div class="cards-list">${state.quizDraft.map((question, index) => `
        <div class="card-solid item-card">
          <div class="item-header">
            <div>
              <h4>${index + 1}. ${escapeHtml(question.text)}</h4>
              <div class="muted">${escapeHtml(question.explanation || 'Fără explicație')}</div>
            </div>
            <span class="pill">Corect: ${String.fromCharCode(65 + Number(question.correctIndex))}</span>
          </div>
          <div class="list-clean">
            ${question.options.map((option, idx) => `
              <div>${idx === question.correctIndex ? '✅' : '•'} ${escapeHtml(option)}</div>
            `).join('')}
          </div>
          <div class="item-actions">
            <button class="btn btn-danger btn-sm" data-action="remove-draft-question" data-index="${index}">Elimină</button>
          </div>
        </div>
      `).join('')}</div>
    ` : `<div class="empty">Adaugă întrebări în ciornă. Testul se poate salva după ce ai cel puțin o întrebare.</div>`;
  }

  function renderQuizzes(){
    const myClasses = classesForCurrentUser();
    const quizzes = getQuizzesForUser();
    const classById = classMap();

    if(isTeacher() && myClasses.length){
      els.quizActions.innerHTML = `
        <div class="section-title"><h2>Construiește un test</h2></div>
        <div class="grid-2">
          <div class="card panel">
            <form id="quizForm" class="auth-form">
              <div class="form-grid">
                <select id="quizClassId">
                  ${myClasses.map(cls => `<option value="${cls.id}" ${state.quizMeta.classId === cls.id ? 'selected' : ''}>${escapeHtml(cls.name)} ${escapeHtml(cls.section)}</option>`).join('')}
                </select>
                <input id="quizTitle" placeholder="Titlul testului" value="${escapeHtml(state.quizMeta.title)}" />
              </div>
              <textarea id="quizInstructions" placeholder="Instrucțiuni pentru elevi">${escapeHtml(state.quizMeta.instructions)}</textarea>
              <hr style="border:none;border-top:1px solid var(--line)">
              <strong>Adaugă o întrebare în ciornă</strong>
              <textarea id="questionText" placeholder="Textul întrebării"></textarea>
              <div class="form-grid-3">
                <input id="optionA" placeholder="Varianta A" />
                <input id="optionB" placeholder="Varianta B" />
                <input id="optionC" placeholder="Varianta C" />
              </div>
              <div class="form-grid">
                <input id="optionD" placeholder="Varianta D" />
                <select id="correctIndex">
                  <option value="0">Răspuns corect: A</option>
                  <option value="1">Răspuns corect: B</option>
                  <option value="2">Răspuns corect: C</option>
                  <option value="3">Răspuns corect: D</option>
                </select>
              </div>
              <textarea id="questionExplanation" placeholder="Explicație (opțional)"></textarea>
              <div class="top-actions">
                <button class="btn btn-secondary" id="addQuestionBtn" type="button">Adaugă întrebarea în ciornă</button>
                <button class="btn btn-success" type="submit">Salvează testul complet</button>
              </div>
            </form>
          </div>
          <div class="card panel">
            <div class="section-title">
              <h3>Ciornă test</h3>
              <span class="pill">${state.quizDraft.length} întrebări</span>
            </div>
            <div id="quizDraftPreview"></div>
          </div>
        </div>
      `;

      document.getElementById('addQuestionBtn').addEventListener('click', function(){
        state.quizMeta.classId = document.getElementById('quizClassId').value;
        state.quizMeta.title = document.getElementById('quizTitle').value;
        state.quizMeta.instructions = document.getElementById('quizInstructions').value;

        const text = document.getElementById('questionText').value.trim();
        const options = [
          document.getElementById('optionA').value.trim(),
          document.getElementById('optionB').value.trim(),
          document.getElementById('optionC').value.trim(),
          document.getElementById('optionD').value.trim()
        ];
        const correctIndex = Number(document.getElementById('correctIndex').value);
        const explanation = document.getElementById('questionExplanation').value.trim();

        if(text.length < 5){
          showToast('Întrebarea este prea scurtă.', 'warning');
          return;
        }
        if(options.some(option => option.length < 1)){
          showToast('Completează toate cele 4 variante.', 'warning');
          return;
        }

        state.quizDraft.push({ text, options, correctIndex, explanation });
        document.getElementById('questionText').value = '';
        document.getElementById('optionA').value = '';
        document.getElementById('optionB').value = '';
        document.getElementById('optionC').value = '';
        document.getElementById('optionD').value = '';
        document.getElementById('questionExplanation').value = '';
        document.getElementById('correctIndex').value = '0';
        renderQuizzes();
        showToast('Întrebarea a fost adăugată în ciornă.', 'success');
      });

      document.getElementById('quizForm').addEventListener('submit', function(event){
        event.preventDefault();
        try{
          store.createQuiz({
            classId: document.getElementById('quizClassId').value,
            title: document.getElementById('quizTitle').value,
            instructions: document.getElementById('quizInstructions').value,
            questions: state.quizDraft,
            teacherId: currentUser.id
          });
          state.quizDraft = [];
          state.quizMeta = { classId: '', title: '', instructions: '' };
          showToast('Testul a fost salvat.', 'success');
          refresh();
        }catch(err){
          showToast(err.message, 'warning');
        }
      });

      renderQuizDraft();
    }else if(isTeacher()){
      els.quizActions.innerHTML = `<div class="empty">Ai nevoie de cel puțin o clasă înainte să poți crea teste.</div>`;
    }else{
      els.quizActions.innerHTML = `
        <div class="notice">
          <strong>Cum se corectează:</strong> după ce trimiți testul, primești imediat scorul și explicațiile pentru răspunsurile greșite.
        </div>
      `;
    }

    els.quizList.innerHTML = quizzes.length ? `
      <div class="cards-list">${quizzes.map(quiz => {
        const totalQuestions = quiz.questions.length;
        const myBest = !isTeacher()
          ? db.submissions
              .filter(item => item.quizId === quiz.id && item.studentId === currentUser.id)
              .sort((a,b) => Number(b.percent) - Number(a.percent))[0]
          : null;
        return `
          <div class="card item-card">
            <div class="item-header">
              <div>
                <h3>${escapeHtml(quiz.title)}</h3>
                <div class="muted">${escapeHtml(quiz.instructions || 'Fără instrucțiuni speciale')}</div>
              </div>
              <span class="badge purple">${escapeHtml(classById[quiz.classId] ? `${classById[quiz.classId].name} ${classById[quiz.classId].section}` : 'Clasă')}</span>
            </div>
            <div class="meta-row">
              <span class="pill">${totalQuestions} întrebări</span>
              <span class="pill">Publicat: ${store.formatDate(quiz.createdAt)}</span>
              ${!isTeacher() && myBest ? `<span class="pill">Cel mai bun scor: ${myBest.percent}%</span>` : ''}
            </div>
            <div class="item-actions">
              ${isTeacher()
                ? `<button class="btn btn-primary btn-sm" data-action="preview-quiz" data-id="${quiz.id}">Previzualizează</button>
                   <button class="btn btn-danger btn-sm" data-action="delete-quiz" data-id="${quiz.id}">Șterge</button>`
                : `<button class="btn btn-success btn-sm" data-action="start-quiz" data-id="${quiz.id}">Începe testul</button>`
              }
            </div>
          </div>
        `;
      }).join('')}</div>
    ` : `<div class="empty">Nu există teste încă.</div>`;

    if(isTeacher()){
      els.quizRunner.innerHTML = `
        <div class="card panel">
          <div class="section-title"><h2>Previzualizare test</h2></div>
          <div class="muted">Alege „Previzualizează” la un test pentru a vedea întrebările.</div>
        </div>
      `;
    }else{
      renderStudentQuizRunner();
    }
  }

  function renderStudentQuizRunner(){
    const quizzes = getQuizzesForUser();
    const quiz = quizzes.find(item => item.id === state.activeQuizId);
    if(!quiz){
      els.quizRunner.innerHTML = `
        <div class="card panel">
          <div class="section-title"><h2>Panou test</h2></div>
          <div class="muted">Alege un test din lista de mai sus ca să începi.</div>
        </div>
      `;
      return;
    }

    els.quizRunner.innerHTML = `
      <div class="card panel">
        <div class="section-title">
          <h2>${escapeHtml(quiz.title)}</h2>
          <span class="pill">${quiz.questions.length} întrebări</span>
        </div>
        <div class="muted">${escapeHtml(quiz.instructions || '')}</div>
        <form id="studentQuizForm" class="auth-form" style="margin-top:16px">
          ${quiz.questions.map((question, index) => `
            <div class="quiz-question">
              <strong>${index + 1}. ${escapeHtml(question.text)}</strong>
              <div class="quiz-options">
                ${question.options.map((option, optIndex) => `
                  <label class="quiz-option">
                    <input type="radio" name="question_${index}" value="${optIndex}" ${optIndex === 0 ? '' : ''}>
                    <div><strong>${String.fromCharCode(65 + optIndex)}.</strong> ${escapeHtml(option)}</div>
                  </label>
                `).join('')}
              </div>
            </div>
          `).join('')}
          <button class="btn btn-success" type="submit">Trimite testul</button>
        </form>
      </div>
    `;

    document.getElementById('studentQuizForm').addEventListener('submit', function(event){
      event.preventDefault();
      const answers = quiz.questions.map((question, index) => {
        const checked = document.querySelector(`input[name="question_${index}"]:checked`);
        return checked ? Number(checked.value) : -1;
      });

      try{
        const submission = store.submitQuiz({
          quizId: quiz.id,
          studentId: currentUser.id,
          answers
        });
        state.activeSubmission = submission.id;
        showToast(`Test trimis. Scor: ${submission.score}/${submission.total}.`, 'success');
        refresh();
        openQuizResultModal(quiz, submission.id);
      }catch(err){
        showToast(err.message, 'warning');
      }
    });
  }

  function openQuizResultModal(quiz, submissionId){
    const submission = db.submissions.find(item => item.id === submissionId);
    if(!quiz || !submission) return;

    const resultHtml = `
      <div class="notice ${submission.percent >= 70 ? 'success' : 'warning'}">
        <strong>Scor final:</strong> ${submission.score} / ${submission.total} (${submission.percent}%)
      </div>
      <div style="height:14px"></div>
      ${quiz.questions.map((question, index) => {
        const chosen = Number(submission.answers[index]);
        const correct = Number(question.correctIndex);
        const isCorrect = chosen === correct;
        return `
          <div class="quiz-question" style="margin-bottom:14px">
            <strong>${index + 1}. ${escapeHtml(question.text)}</strong>
            <div class="quiz-options">
              ${question.options.map((option, optIndex) => `
                <div class="quiz-option ${optIndex === correct ? 'correct' : (optIndex === chosen && chosen !== correct ? 'wrong' : '')}">
                  <div><strong>${String.fromCharCode(65 + optIndex)}.</strong> ${escapeHtml(option)}</div>
                </div>
              `).join('')}
            </div>
            <div class="muted" style="margin-top:10px">
              <strong>${isCorrect ? 'Corect.' : 'Greșit.'}</strong>
              ${escapeHtml(question.explanation || 'Nu există explicație suplimentară.')}
            </div>
          </div>
        `;
      }).join('')}
    `;

    openModal(`Rezultate – ${quiz.title}`, resultHtml);
  }

  function renderResults(){
    const submissions = getSubmissionsForCurrentContext();
    const qMap = {};
    db.quizzes.forEach(item => { qMap[item.id] = item; });
    const cMap = classMap();
    const uMap = userMap();

    if(isTeacher()){
      const quizIds = new Set(db.quizzes.filter(item => item.teacherId === currentUser.id).map(item => item.id));
      const teacherSubmissions = db.submissions.filter(item => quizIds.has(item.quizId));
      const avg = teacherSubmissions.length
        ? Math.round(teacherSubmissions.reduce((sum, item) => sum + Number(item.percent), 0) / teacherSubmissions.length)
        : 0;
      els.resultsSummary.innerHTML = `
        <div class="grid-3">
          <div class="card stat"><span class="badge">Încercări</span><h3>${teacherSubmissions.length}</h3><p>trimiteri totale ale elevilor</p></div>
          <div class="card stat"><span class="badge success">Scor mediu</span><h3>${avg}%</h3><p>pe toate testele tale</p></div>
          <div class="card stat"><span class="badge purple">Teste active</span><h3>${db.quizzes.filter(item => item.teacherId === currentUser.id).length}</h3><p>publicate în clase</p></div>
        </div>
      `;
      els.resultsTable.innerHTML = teacherSubmissions.length ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Elev</th>
                <th>Clasă</th>
                <th>Test</th>
                <th>Scor</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              ${teacherSubmissions.map(item => `
                <tr>
                  <td>${escapeHtml(uMap[item.studentId] ? uMap[item.studentId].fullName : 'Elev')}</td>
                  <td>${escapeHtml(qMap[item.quizId] && cMap[qMap[item.quizId].classId] ? `${cMap[qMap[item.quizId].classId].name} ${cMap[qMap[item.quizId].classId].section}` : '—')}</td>
                  <td class="wrap">${escapeHtml(qMap[item.quizId] ? qMap[item.quizId].title : 'Test')}</td>
                  <td>${item.score}/${item.total} (${item.percent}%)</td>
                  <td>${store.formatDate(item.submittedAt)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : `<div class="empty">Nu există rezultate încă.</div>`;

      const scoreboard = buildLeaderboard();
      els.leaderboardWrap.innerHTML = renderLeaderboardHtml(scoreboard, true);
    }else{
      const bestMap = bestSubmissionByQuiz(submissions);
      const bestList = Object.values(bestMap).sort((a,b) => Number(b.percent) - Number(a.percent));
      const avg = bestList.length
        ? Math.round(bestList.reduce((sum, item) => sum + Number(item.percent), 0) / bestList.length)
        : 0;

      els.resultsSummary.innerHTML = `
        <div class="grid-3">
          <div class="card stat"><span class="badge">Încercări</span><h3>${submissions.length}</h3><p>trimiteri totale</p></div>
          <div class="card stat"><span class="badge success">Cea mai bună medie</span><h3>${avg}%</h3><p>din cele mai bune rezultate</p></div>
          <div class="card stat"><span class="badge purple">Cel mai bun scor</span><h3>${bestList[0] ? `${bestList[0].percent}%` : '—'}</h3><p>la testele tale</p></div>
        </div>
      `;

      els.resultsTable.innerHTML = submissions.length ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Test</th>
                <th>Clasă</th>
                <th>Scor</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              ${submissions.map(item => `
                <tr>
                  <td class="wrap">${escapeHtml(qMap[item.quizId] ? qMap[item.quizId].title : 'Test')}</td>
                  <td>${escapeHtml(qMap[item.quizId] && cMap[qMap[item.quizId].classId] ? `${cMap[qMap[item.quizId].classId].name} ${cMap[qMap[item.quizId].classId].section}` : '—')}</td>
                  <td>${item.score}/${item.total} (${item.percent}%)</td>
                  <td>${store.formatDate(item.submittedAt)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : `<div class="empty">Nu ai trimis încă niciun test.</div>`;

      const scoreboard = buildLeaderboard();
      els.leaderboardWrap.innerHTML = renderLeaderboardHtml(scoreboard, false);
    }
  }

  function buildLeaderboard(){
    const qMap = {};
    db.quizzes.forEach(item => { qMap[item.id] = item; });

    const relevantClassIds = new Set(classesForCurrentUser().map(item => item.id));
    const relevantQuizIds = new Set(
      db.quizzes
        .filter(item => relevantClassIds.has(item.classId))
        .map(item => item.id)
    );

    const grouped = {};
    db.submissions
      .filter(item => relevantQuizIds.has(item.quizId))
      .forEach(item => {
        if(!grouped[item.studentId]){
          grouped[item.studentId] = {};
        }
        const existing = grouped[item.studentId][item.quizId];
        if(!existing || Number(item.percent) > Number(existing.percent)){
          grouped[item.studentId][item.quizId] = item;
        }
      });

    const leaderboard = Object.keys(grouped).map(studentId => {
      const bestResults = Object.values(grouped[studentId]);
      const avg = bestResults.length
        ? Math.round(bestResults.reduce((sum, item) => sum + Number(item.percent), 0) / bestResults.length)
        : 0;
      return {
        studentId,
        fullName: (userMap()[studentId] || {}).fullName || 'Elev',
        average: avg,
        attempts: bestResults.length
      };
    }).sort((a,b) => b.average - a.average || a.fullName.localeCompare(b.fullName, 'ro'));

    return leaderboard;
  }

  function renderLeaderboardHtml(scoreboard, teacherView){
    if(!scoreboard.length){
      return `<div class="empty">Clasamentul va apărea după ce elevii rezolvă teste.</div>`;
    }
    return `
      <div class="section-title">
        <h2>${teacherView ? 'Clasament elevi' : 'Clasament clasă'}</h2>
        <span class="pill">${scoreboard.length} elevi</span>
      </div>
      <div class="cards-list">
        ${scoreboard.slice(0,8).map((item, index) => `
          <div class="card-solid item-card">
            <div class="item-header">
              <div>
                <h3 style="margin-bottom:4px">${index + 1}. ${escapeHtml(item.fullName)}</h3>
                <div class="muted">${item.attempts} test${item.attempts === 1 ? '' : 'e'} contabilizate</div>
              </div>
              <span class="badge success">${item.average}%</span>
            </div>
            <div class="progress"><span style="width:${Math.min(100, item.average)}%"></span></div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderDataTools(){
    const myClasses = classesForCurrentUser();
    const myLessons = getLessonsForUser();
    const myQuizzes = getQuizzesForUser();
    const mySubmissions = getSubmissionsForCurrentContext();
    const storageInfo = store.getStorageInfo();

    els.dataPanel.innerHTML = `
      <div class="grid-2">
        <div class="card panel">
          <div class="section-title"><h2>Backup & restaurare</h2></div>
          <div class="kv">
            <div class="kv-row"><span>Cont curent</span><strong>${escapeHtml(currentUser.fullName)}</strong></div>
            <div class="kv-row"><span>Rol</span><strong>${escapeHtml(currentUser.role)}</strong></div>
            <div class="kv-row"><span>Mod stocare</span><strong>${storageInfo.isShared ? 'Server comun' : 'Browser local'}</strong></div>
            <div class="kv-row"><span>Clase vizibile</span><strong>${myClasses.length}</strong></div>
            <div class="kv-row"><span>Lecții vizibile</span><strong>${myLessons.length}</strong></div>
            <div class="kv-row"><span>Teste vizibile</span><strong>${myQuizzes.length}</strong></div>
            <div class="kv-row"><span>Rezultate</span><strong>${mySubmissions.length}</strong></div>
          </div>
          <div class="top-actions" style="margin-top:16px">
            ${storageInfo.isShared ? '<button class="btn btn-success" data-action="sync-now">Sincronizează acum</button>' : ''}
            <button class="btn btn-primary" data-action="export-json">Export JSON</button>
            <button class="btn btn-secondary" data-action="import-json">Import JSON</button>
            <button class="btn btn-danger" data-action="reset-demo">Reset la datele demo</button>
          </div>
        </div>
        <div class="card panel">
          <div class="section-title"><h2>Explicație tehnică</h2></div>
          <div class="list-clean">
            <div><strong>1. Mod activ: ${storageInfo.isShared ? 'bază comună pe server' : 'bază locală în browser'}.</strong><br><span class="muted">${storageInfo.isShared ? 'Profesorul și elevii care intră pe același site pot vedea aceleași clase și înscrieri.' : 'Datele se păstrează doar în browserul curent. Pe alt dispozitiv sau alt browser ai altă bază.'}</span></div>
            <div><strong>2. Profesor și elev au interfețe diferite.</strong><br><span class="muted">Rolul determină ce secțiuni și acțiuni vezi.</span></div>
            <div><strong>3. Poți muta datele cu backup JSON.</strong><br><span class="muted">Exportă pe un calculator și importă pe altul.</span></div>
            <div><strong>4. Backend-ul comun este opțional.</strong><br><span class="muted">Dacă serverul găsește api/db.php, aplicația îl folosește automat. Altfel rămâne pe localStorage.</span></div>
          </div>
        </div>
      </div>
      <div style="height:18px"></div>
      <div class="card panel">
        <div class="section-title"><h2>Recomandări</h2></div>
        <div class="notice ${storageInfo.isShared ? 'success' : 'warning'}">
          ${storageInfo.isShared
            ? 'Site-ul rulează acum în mod partajat. Dacă profesorul creează o clasă, elevii o pot găsi de pe alte dispozitive, atâta timp cât intră pe același site.'
            : 'Site-ul rulează acum în mod local. Pentru profesori și elevi pe dispozitive diferite, urcă proiectul pe un hosting cu PHP sau folosește Export/Import JSON.'}
        </div>
      </div>
    `;
  }

  function renderLabNotice(){
    const note = document.getElementById('labRoleNote');
    if(note){
      note.innerHTML = isTeacher()
        ? 'Ai integrat aici și laboratorul tău original: tabel periodic, căutare elemente, reacții, quiz de reacții și favorite.'
        : 'Poți folosi laboratorul pentru a exersa: tabel periodic, reacții, quiz-uri și căutare rapidă.';
    }
  }

  function openModal(title, html){
    els.modalTitle.textContent = title;
    els.modalContent.innerHTML = html;
    els.modal.classList.add('open');
  }

  function closeModal(){
    els.modal.classList.remove('open');
  }

  function exportResultsCsv(){
    const submissions = getSubmissionsForCurrentContext();
    const qMap = {};
    db.quizzes.forEach(item => { qMap[item.id] = item; });
    const cMap = classMap();
    const uMap = userMap();

    const rows = [['Elev', 'Clasa', 'Test', 'Scor', 'Procent', 'Data']];
    submissions.forEach(item => {
      const quiz = qMap[item.quizId];
      const classroom = quiz ? cMap[quiz.classId] : null;
      const student = uMap[item.studentId] || currentUser;
      rows.push([
        student.fullName,
        classroom ? `${classroom.name} ${classroom.section}` : '',
        quiz ? quiz.title : '',
        `${item.score}/${item.total}`,
        `${item.percent}%`,
        store.formatDate(item.submittedAt)
      ]);
    });
    downloadFile('rezultate_chimie.csv', rows.map(row => row.map(csvEscape).join(',')).join('\n'), 'text/csv;charset=utf-8');
  }

  function csvEscape(value){
    const text = String(value == null ? '' : value).replace(/"/g, '""');
    return `"${text}"`;
  }

  function downloadFile(name, content, type){
    if(window.AndroidBridge && typeof window.AndroidBridge.saveTextFile === 'function'){
      try{
        const base64 = btoa(unescape(encodeURIComponent(String(content || ''))));
        const saved = window.AndroidBridge.saveTextFile(String(name || 'fisier.txt'), String(type || 'text/plain;charset=utf-8'), base64);
        if(saved){
          showToast('Fișier salvat pe telefon.', 'success');
          return;
        }
      }catch(err){}
    }
    const blob = new Blob([content], { type });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(link.href);
      link.remove();
    }, 0);
  }

  document.addEventListener('click', function(event){
    const target = event.target.closest('[data-view-target],[data-action]');
    if(!target) return;

    if(target.dataset.viewTarget){
      updateView(target.dataset.viewTarget);
      return;
    }

    const action = target.dataset.action;
    const id = target.dataset.id;

    try{
      switch(action){
        case 'logout':
          store.clearSession();
          window.location.href = 'index.html';
          break;
        case 'toggle-theme':
          store.setTheme(store.nextTheme ? store.nextTheme(store.getTheme()) : (store.getTheme() === 'dark' ? 'light' : 'dark'));
          applyTheme();
          break;
        case 'copy-code': {
          copyText(target.dataset.code || '').then(ok => {
            showToast(ok ? 'Codul clasei a fost copiat.' : 'Nu am putut copia automat codul.', ok ? 'success' : 'warning');
          });
          break;
        }
        case 'delete-class':
          if(confirm('Sigur vrei să ștergi această clasă și toate resursele ei?')){
            store.deleteClass(id, currentUser.id);
            showToast('Clasa a fost ștearsă.', 'success');
            refresh();
          }
          break;
        case 'delete-announcement':
          if(confirm('Ștergi anunțul?')){
            store.deleteAnnouncement(id, currentUser.id);
            showToast('Anunț șters.', 'success');
            refresh();
          }
          break;
        case 'open-lesson': {
          const lesson = db.lessons.find(item => item.id === id);
          if(!lesson) return;
          const classroom = classMap()[lesson.classId];
          openModal(lesson.title, `
            <div class="meta-row">
              <span class="pill">${classroom ? `${escapeHtml(classroom.name)} ${escapeHtml(classroom.section)}` : 'Clasă'}</span>
              <span class="pill">${lesson.estimatedMinutes || 15} min</span>
              <span class="pill">${store.formatDate(lesson.createdAt)}</span>
            </div>
            <div style="height:16px"></div>
            <div class="notice"><strong>Rezumat:</strong> ${escapeHtml(lesson.summary || 'Fără rezumat')}</div>
            <div style="height:16px"></div>
            <div style="white-space:pre-line;line-height:1.65">${escapeHtml(lesson.content)}</div>
            ${
              lesson.tags && lesson.tags.length
                ? `<div class="meta-row" style="margin-top:16px">${lesson.tags.map(tag => `<span class="pill">${escapeHtml(tag)}</span>`).join('')}</div>`
                : ''
            }
          `);
          break;
        }
        case 'delete-lesson':
          if(confirm('Ștergi lecția?')){
            store.deleteLesson(id, currentUser.id);
            showToast('Lecția a fost ștearsă.', 'success');
            refresh();
          }
          break;
        case 'remove-draft-question':
          state.quizDraft.splice(Number(target.dataset.index), 1);
          renderQuizzes();
          break;
        case 'preview-quiz': {
          const quiz = db.quizzes.find(item => item.id === id);
          if(!quiz) return;
          els.quizRunner.innerHTML = `
            <div class="card panel">
              <div class="section-title">
                <h2>${escapeHtml(quiz.title)}</h2>
                <span class="pill">${quiz.questions.length} întrebări</span>
              </div>
              <div class="muted">${escapeHtml(quiz.instructions || '')}</div>
              <div style="height:16px"></div>
              ${quiz.questions.map((question, index) => `
                <div class="quiz-question" style="margin-bottom:14px">
                  <strong>${index + 1}. ${escapeHtml(question.text)}</strong>
                  <div class="quiz-options">
                    ${question.options.map((option, optIndex) => `
                      <div class="quiz-option ${optIndex === question.correctIndex ? 'correct' : ''}">
                        <div><strong>${String.fromCharCode(65 + optIndex)}.</strong> ${escapeHtml(option)}</div>
                      </div>
                    `).join('')}
                  </div>
                  ${question.explanation ? `<div class="muted" style="margin-top:10px">${escapeHtml(question.explanation)}</div>` : ''}
                </div>
              `).join('')}
            </div>
          `;
          break;
        }
        case 'delete-quiz':
          if(confirm('Ștergi testul și toate rezultatele lui?')){
            store.deleteQuiz(id, currentUser.id);
            showToast('Testul a fost șters.', 'success');
            refresh();
          }
          break;
        case 'start-quiz':
          state.activeQuizId = id;
          renderStudentQuizRunner();
          updateView('quizzes');
          break;
        case 'sync-now':
          store.syncNow();
          refresh();
          showToast('Datele au fost sincronizate din sursa activă.', 'success');
          break;
        case 'export-json':
          downloadFile('chimie_academy_backup.json', store.exportJSON(), 'application/json;charset=utf-8');
          showToast('Backup JSON exportat.', 'success');
          break;
        case 'import-json':
          els.importInput.click();
          break;
        case 'reset-demo':
          if(confirm('Sigur vrei reset la datele demo? Se pierd datele locale actuale.')){
            store.resetDemo();
            showToast('Datele demo au fost restaurate.', 'success');
            setTimeout(() => window.location.href = 'index.html', 300);
          }
          break;
        case 'export-csv':
          exportResultsCsv();
          showToast('Raport CSV exportat.', 'success');
          break;
        default:
          break;
      }
    }catch(err){
      showToast(err.message || 'A apărut o eroare.', 'warning');
    }
  });

  els.importInput.addEventListener('change', function(event){
    const file = event.target.files && event.target.files[0];
    if(!file) return;

    const reader = new FileReader();
    reader.onload = function(){
      try{
        store.importJSON(String(reader.result || ''));
        showToast('Backup importat cu succes.', 'success');
        refresh();
      }catch(err){
        showToast(err.message, 'warning');
      }finally{
        els.importInput.value = '';
      }
    };
    reader.readAsText(file, 'utf-8');
  });

  document.getElementById('closeModalBtn').addEventListener('click', closeModal);
  els.modal.addEventListener('click', function(event){
    if(event.target === els.modal) closeModal();
  });

  els.themeToggle.addEventListener('click', function(){
    store.setTheme(store.nextTheme ? store.nextTheme(store.getTheme()) : (store.getTheme() === 'dark' ? 'light' : 'dark'));
    applyTheme();
  });

  if(els.mobileMenuBtn){
    els.mobileMenuBtn.addEventListener('click', openMobileNav);
  }

  if(els.mobileSidebarClose){
    els.mobileSidebarClose.addEventListener('click', closeMobileNav);
  }

  if(els.mobileOverlay){
    els.mobileOverlay.addEventListener('click', closeMobileNav);
  }

  window.addEventListener('resize', function(){
    if(!isCompactLayout()) closeMobileNav();
  });

  document.getElementById('exportCsvBtn').addEventListener('click', function(){
    exportResultsCsv();
    showToast('Raportul a fost exportat.', 'success');
  });

  document.addEventListener('keydown', function(event){
    if(event.key === 'Escape'){
      closeModal();
      closeMobileNav();
    }
  });

  if(window.ChemFormat){
    window.ChemFormat.observe(document.body);
  }

  const labFrame = document.querySelector('#view-laboratory iframe');
  if(labFrame){
    labFrame.addEventListener('load', applyTheme);
  }

  window.addEventListener('storage', applyTheme);

  setMobileNav(false);
  applyTheme();
  hydrateHeader();
  refresh();
  if(window.ChemFormat){
    window.ChemFormat.formatTextNodes(document.body);
  }
})();
