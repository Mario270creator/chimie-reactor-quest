(function(){
  const STORAGE_KEY = 'chimieAcademyPro.v4';
  const SESSION_KEY = 'chimieAcademyPro.session';
  const THEME_KEY = 'chimieAcademyPro.theme';
  const BACKEND_ENDPOINT = 'api/db.php';

  let storageModeCache = null;

  function safeParse(raw, fallback){
    try{
      return raw ? JSON.parse(raw) : fallback;
    }catch(err){
      return fallback;
    }
  }

  function uid(prefix){
    const rand = Math.random().toString(36).slice(2, 9);
    return `${prefix}_${rand}_${Date.now().toString(36)}`;
  }

  function nowIso(){
    return new Date().toISOString();
  }

  function formatDate(iso){
    try{
      return new Date(iso).toLocaleString('ro-RO', {
        year: 'numeric', month: 'short', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
    }catch(err){
      return iso || '';
    }
  }

  function initials(name){
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if(!parts.length) return 'CH';
    return parts.slice(0,2).map(p => p[0].toUpperCase()).join('');
  }

  function percent(score, total){
    if(!total) return 0;
    return Math.round((Number(score || 0) / Number(total || 1)) * 100);
  }

  function generateClassCode(name, section){
    const base = `${name || ''}${section || ''}`
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 6) || 'CLASA';
    return `${base}${Math.floor(100 + Math.random() * 900)}`;
  }

  function buildDemoDB(){
    const teacherId = 'usr_demo_teacher';
    const studentId = 'usr_demo_student';
    const classA = 'cls_demo_7a';
    const classB = 'cls_demo_8b';
    const quiz1 = 'quiz_demo_1';
    const quiz2 = 'quiz_demo_2';
    const submission1 = 'sub_demo_1';

    return {
      meta: {
        app: 'Chimie Academy Pro',
        version: 4,
        createdAt: nowIso()
      },
      users: [
        {
          id: teacherId,
          fullName: 'Profesor Demo',
          username: 'profesor_demo',
          password: '1234',
          role: 'profesor',
          createdAt: nowIso(),
          isDemo: true
        },
        {
          id: studentId,
          fullName: 'Elev Demo',
          username: 'elev_demo',
          password: '1234',
          role: 'elev',
          createdAt: nowIso(),
          isDemo: true
        }
      ],
      classes: [
        {
          id: classA,
          name: 'Clasa VII',
          section: 'A',
          description: 'Noțiuni introductive de chimie, atomi, molecule și reacții simple.',
          code: 'VIIA24',
          teacherId,
          createdAt: nowIso()
        },
        {
          id: classB,
          name: 'Clasa VIII',
          section: 'B',
          description: 'Acizi, baze, săruri și tipuri de reacții chimice.',
          code: 'VIIIB8',
          teacherId,
          createdAt: nowIso()
        }
      ],
      enrollments: [
        { id: uid('enr'), classId: classA, userId: studentId, joinedAt: nowIso() },
        { id: uid('enr'), classId: classB, userId: studentId, joinedAt: nowIso() }
      ],
      announcements: [
        {
          id: uid('ann'),
          classId: classA,
          teacherId,
          title: 'Bine ați venit în laboratorul digital',
          content: 'Folosiți secțiunea Laborator pentru tabelul periodic, reacții și exerciții rapide.',
          createdAt: nowIso()
        },
        {
          id: uid('ann'),
          classId: classB,
          teacherId,
          title: 'Test nou disponibil',
          content: 'În secțiunea Teste găsiți un test demonstrativ despre acizi și baze.',
          createdAt: nowIso()
        }
      ],
      lessons: [
        {
          id: uid('les'),
          classId: classA,
          teacherId,
          title: 'Atomul și molecula',
          summary: 'Diferența dintre atomi, ioni și molecule.',
          content: 'Atomul este cea mai mică particulă a unui element chimic. Molecula este formată din doi sau mai mulți atomi legați între ei. Exemple: O₂, H₂O, CO₂.',
          estimatedMinutes: 20,
          tags: ['introducere', 'atom', 'moleculă'],
          createdAt: nowIso()
        },
        {
          id: uid('les'),
          classId: classA,
          teacherId,
          title: 'Tabelul periodic',
          summary: 'Cum citim simbolul, numărul atomic și grupa.',
          content: 'Tabelul periodic grupează elementele în perioade și grupe. Elementele din aceeași grupă au proprietăți chimice asemănătoare.',
          estimatedMinutes: 18,
          tags: ['tabel periodic', 'simbol', 'număr atomic'],
          createdAt: nowIso()
        },
        {
          id: uid('les'),
          classId: classB,
          teacherId,
          title: 'Acizi, baze și săruri',
          summary: 'Recunoașterea compușilor de bază din reacții.',
          content: 'Acizii conțin în general hidrogen ionizabil, bazele conțin grupa hidroxil, iar sărurile rezultă frecvent din reacția acid + bază.',
          estimatedMinutes: 25,
          tags: ['acizi', 'baze', 'săruri'],
          createdAt: nowIso()
        }
      ],
      quizzes: [
        {
          id: quiz1,
          classId: classA,
          teacherId,
          title: 'Quiz demonstrativ – Tabel periodic',
          instructions: 'Alege varianta corectă pentru fiecare întrebare.',
          createdAt: nowIso(),
          questions: [
            {
              id: uid('q'),
              text: 'Care este simbolul chimic al oxigenului?',
              options: ['O', 'Ox', 'Og', 'Om'],
              correctIndex: 0,
              explanation: 'Simbolul chimic al oxigenului este O.'
            },
            {
              id: uid('q'),
              text: 'Ce reprezintă numărul atomic?',
              options: ['Numărul de neutroni', 'Numărul de protoni', 'Numărul de molecule', 'Numărul de electroni de valență'],
              correctIndex: 1,
              explanation: 'Numărul atomic este egal cu numărul de protoni din nucleu.'
            },
            {
              id: uid('q'),
              text: 'În ce grupă se află gazele nobile?',
              options: ['Grupa 1', 'Grupa 7', 'Grupa 18', 'Grupa 2'],
              correctIndex: 2,
              explanation: 'Gazele nobile sunt elementele din grupa 18.'
            }
          ]
        },
        {
          id: quiz2,
          classId: classB,
          teacherId,
          title: 'Quiz demonstrativ – Acizi și baze',
          instructions: 'Rezolvă testul și verifică explicațiile la final.',
          createdAt: nowIso(),
          questions: [
            {
              id: uid('q'),
              text: 'Ce se formează în reacția acid + bază?',
              options: ['Metal și oxid', 'Sare și apă', 'Doar apă', 'Gaz inert'],
              correctIndex: 1,
              explanation: 'Neutralizarea produce de regulă o sare și apă.'
            },
            {
              id: uid('q'),
              text: 'Care dintre următoarele este o bază?',
              options: ['HCl', 'NaOH', 'CO₂', 'SO₂'],
              correctIndex: 1,
              explanation: 'NaOH este hidroxid de sodiu, o bază puternică.'
            },
            {
              id: uid('q'),
              text: 'Ce culoare are de obicei turnesolul în mediu acid?',
              options: ['Roșu', 'Verde', 'Galben', 'Negru'],
              correctIndex: 0,
              explanation: 'Turnesolul devine roșu în mediu acid.'
            }
          ]
        }
      ],
      submissions: [
        {
          id: submission1,
          quizId: quiz1,
          studentId,
          answers: [0,1,2],
          score: 3,
          total: 3,
          percent: 100,
          submittedAt: nowIso()
        }
      ]
    };
  }

  function normalize(db){
    const demo = buildDemoDB();
    const normalized = Object.assign({}, demo, db || {});
    normalized.meta = Object.assign({}, demo.meta, db && db.meta ? db.meta : {});
    normalized.users = Array.isArray(db && db.users) ? db.users : demo.users;
    normalized.classes = Array.isArray(db && db.classes) ? db.classes : demo.classes;
    normalized.enrollments = Array.isArray(db && db.enrollments) ? db.enrollments : demo.enrollments;
    normalized.announcements = Array.isArray(db && db.announcements) ? db.announcements : demo.announcements;
    normalized.lessons = Array.isArray(db && db.lessons) ? db.lessons : demo.lessons;
    normalized.quizzes = Array.isArray(db && db.quizzes) ? db.quizzes : demo.quizzes;
    normalized.submissions = Array.isArray(db && db.submissions) ? db.submissions : demo.submissions;
    return normalized;
  }

  function canUseSharedBackend(){
    return typeof window !== 'undefined' && /^https?:$/i.test(window.location.protocol || '');
  }

  function backendErrorMessage(fallback){
    return fallback || 'Nu am putut comunica cu baza comună de pe server.';
  }

  function requestBackend(method, action, payload){
    const xhr = new XMLHttpRequest();
    const url = `${BACKEND_ENDPOINT}?action=${encodeURIComponent(action)}&_=${Date.now()}`;

    xhr.open(method, url, false);
    xhr.setRequestHeader('Accept', 'application/json');
    if(method === 'POST'){
      xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
    }

    try{
      xhr.send(payload ? JSON.stringify(payload) : null);
    }catch(err){
      throw new Error(backendErrorMessage('Nu am putut contacta backend-ul comun. Verifică dacă api/db.php există și serverul rulează prin HTTP/PHP.'));
    }

    const response = safeParse(xhr.responseText, null);
    if(xhr.status < 200 || xhr.status >= 300){
      const message = response && response.message ? response.message : backendErrorMessage();
      throw new Error(message);
    }

    if(response && response.ok === false){
      throw new Error(response.message || backendErrorMessage());
    }

    return response || { ok: true };
  }

  function detectStorageMode(force){
    if(storageModeCache && !force){
      return storageModeCache;
    }

    if(!canUseSharedBackend()){
      storageModeCache = 'local';
      return storageModeCache;
    }

    try{
      const response = requestBackend('GET', 'ping');
      storageModeCache = response && response.ok ? 'server' : 'local';
    }catch(err){
      storageModeCache = 'local';
    }

    return storageModeCache;
  }

  function getStorageInfo(){
    const mode = detectStorageMode();
    return {
      mode,
      isShared: mode === 'server',
      label: mode === 'server' ? 'bază comună pe server' : 'bază locală în browser',
      endpoint: mode === 'server' ? BACKEND_ENDPOINT : null
    };
  }

  function saveLocal(db){
    const normalized = normalize(db);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function loadLocal(){
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw){
      return saveLocal(buildDemoDB());
    }
    const parsed = safeParse(raw, null);
    if(!parsed){
      return saveLocal(buildDemoDB());
    }
    return saveLocal(parsed);
  }

  function loadShared(){
    const response = requestBackend('GET', 'load');
    const normalized = normalize(response && response.db ? response.db : null);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function saveShared(db){
    const normalized = normalize(db);
    const response = requestBackend('POST', 'save', { db: normalized });
    const finalDb = normalize(response && response.db ? response.db : normalized);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(finalDb));
    return finalDb;
  }

  function save(db){
    return detectStorageMode() === 'server' ? saveShared(db) : saveLocal(db);
  }

  function load(){
    return detectStorageMode() === 'server' ? loadShared() : loadLocal();
  }

  function syncNow(){
    return load();
  }

  function resetDemo(){
    clearSession();
    return save(buildDemoDB());
  }

  function getCurrentUser(db){
    const database = db || load();
    const id = localStorage.getItem(SESSION_KEY);
    if(!id) return null;
    return database.users.find(user => user.id === id) || null;
  }

  function setSession(userId){
    localStorage.setItem(SESSION_KEY, userId);
  }

  function clearSession(){
    localStorage.removeItem(SESSION_KEY);
  }

  function register(payload){
    const db = load();
    const fullName = String(payload.fullName || '').trim();
    const username = String(payload.username || '').trim().toLowerCase();
    const password = String(payload.password || '').trim();
    const role = payload.role === 'profesor' ? 'profesor' : 'elev';

    if(fullName.length < 3) throw new Error('Numele complet trebuie să aibă minim 3 caractere.');
    if(username.length < 3) throw new Error('Utilizatorul trebuie să aibă minim 3 caractere.');
    if(password.length < 4) throw new Error('Parola trebuie să aibă minim 4 caractere.');

    const exists = db.users.some(user => user.username.toLowerCase() === username);
    if(exists) throw new Error('Există deja un cont cu acest utilizator.');

    const user = {
      id: uid('usr'),
      fullName,
      username,
      password,
      role,
      createdAt: nowIso(),
      isDemo: false
    };

    db.users.push(user);
    save(db);
    return user;
  }

  function authenticate(payload){
    const db = load();
    const username = String(payload.username || '').trim().toLowerCase();
    const password = String(payload.password || '').trim();
    const role = payload.role === 'profesor' ? 'profesor' : 'elev';

    const user = db.users.find(entry =>
      entry.username.toLowerCase() === username &&
      entry.password === password &&
      entry.role === role
    );

    if(!user) throw new Error('Datele de autentificare nu sunt corecte.');
    setSession(user.id);
    return user;
  }

  function loginAsDemo(role){
    const db = load();
    const user = db.users.find(entry => entry.isDemo && entry.role === role);
    if(!user) throw new Error('Contul demo nu a fost găsit.');
    setSession(user.id);
    return user;
  }

  function classesForUser(db, user){
    if(!user) return [];
    if(user.role === 'profesor'){
      return db.classes.filter(item => item.teacherId === user.id);
    }
    const classIds = new Set(
      db.enrollments
        .filter(item => item.userId === user.id)
        .map(item => item.classId)
    );
    return db.classes.filter(item => classIds.has(item.id));
  }

  function createClass(payload){
    const db = load();
    const teacherId = payload.teacherId;
    const teacher = db.users.find(user => user.id === teacherId && user.role === 'profesor');
    if(!teacher) throw new Error('Doar profesorii pot crea clase.');

    const name = String(payload.name || '').trim();
    const section = String(payload.section || '').trim();
    const description = String(payload.description || '').trim();

    if(name.length < 2) throw new Error('Numele clasei este prea scurt.');
    if(section.length < 1) throw new Error('Completează secțiunea sau litera clasei.');

    let code = generateClassCode(name, section);
    while(db.classes.some(item => item.code === code)){
      code = generateClassCode(name, section);
    }

    const classroom = {
      id: uid('cls'),
      name,
      section,
      description,
      code,
      teacherId,
      createdAt: nowIso()
    };

    db.classes.push(classroom);
    save(db);
    return classroom;
  }

  function deleteClass(classId, teacherId){
    const db = load();
    const classroom = db.classes.find(item => item.id === classId);
    if(!classroom) throw new Error('Clasa nu există.');
    if(classroom.teacherId !== teacherId) throw new Error('Nu poți șterge această clasă.');

    const quizIds = db.quizzes.filter(quiz => quiz.classId === classId).map(quiz => quiz.id);

    db.classes = db.classes.filter(item => item.id !== classId);
    db.enrollments = db.enrollments.filter(item => item.classId !== classId);
    db.announcements = db.announcements.filter(item => item.classId !== classId);
    db.lessons = db.lessons.filter(item => item.classId !== classId);
    db.quizzes = db.quizzes.filter(item => item.classId !== classId);
    db.submissions = db.submissions.filter(item => !quizIds.includes(item.quizId));

    save(db);
    return true;
  }

  function joinClass(payload){
    const db = load();
    const userId = payload.userId;
    const code = String(payload.code || '').trim().toUpperCase();
    if(!code) throw new Error('Introdu codul clasei.');

    const student = db.users.find(user => user.id === userId && user.role === 'elev');
    if(!student) throw new Error('Doar elevii se pot înscrie într-o clasă.');

    const classroom = db.classes.find(item => item.code.toUpperCase() === code);
    if(!classroom){
      const storageInfo = getStorageInfo();
      if(storageInfo.mode === 'local'){
        throw new Error('Nu am găsit nicio clasă cu acest cod în baza locală a acestui browser. Pentru profesori și elevi pe dispozitive diferite, pornește site-ul prin HTTP/PHP ca să folosească baza comună de pe server.');
      }
      throw new Error('Nu am găsit nicio clasă cu acest cod. Verifică dacă profesorul ți-a trimis codul corect.');
    }

    const already = db.enrollments.some(item => item.classId === classroom.id && item.userId === userId);
    if(already) throw new Error('Ești deja înscris în această clasă.');

    db.enrollments.push({
      id: uid('enr'),
      classId: classroom.id,
      userId,
      joinedAt: nowIso()
    });

    save(db);
    return classroom;
  }

  function createLesson(payload){
    const db = load();
    const classroom = db.classes.find(item => item.id === payload.classId);
    if(!classroom) throw new Error('Clasa selectată nu există.');
    if(classroom.teacherId !== payload.teacherId) throw new Error('Nu poți adăuga lecții în această clasă.');

    const title = String(payload.title || '').trim();
    const summary = String(payload.summary || '').trim();
    const content = String(payload.content || '').trim();
    const estimatedMinutes = Math.max(5, Number(payload.estimatedMinutes || 15));
    const tags = Array.isArray(payload.tags)
      ? payload.tags.map(tag => String(tag).trim()).filter(Boolean)
      : String(payload.tags || '').split(',').map(tag => tag.trim()).filter(Boolean);

    if(title.length < 3) throw new Error('Titlul lecției este prea scurt.');
    if(content.length < 10) throw new Error('Conținutul lecției este prea scurt.');

    const lesson = {
      id: uid('les'),
      classId: payload.classId,
      teacherId: payload.teacherId,
      title,
      summary,
      content,
      estimatedMinutes,
      tags,
      createdAt: nowIso()
    };

    db.lessons.unshift(lesson);
    save(db);
    return lesson;
  }

  function deleteLesson(lessonId, teacherId){
    const db = load();
    const lesson = db.lessons.find(item => item.id === lessonId);
    if(!lesson) throw new Error('Lecția nu există.');
    if(lesson.teacherId !== teacherId) throw new Error('Nu poți șterge această lecție.');
    db.lessons = db.lessons.filter(item => item.id !== lessonId);
    save(db);
    return true;
  }

  function createAnnouncement(payload){
    const db = load();
    const classroom = db.classes.find(item => item.id === payload.classId);
    if(!classroom) throw new Error('Clasa selectată nu există.');
    if(classroom.teacherId !== payload.teacherId) throw new Error('Nu poți adăuga anunțuri în această clasă.');

    const title = String(payload.title || '').trim();
    const content = String(payload.content || '').trim();
    if(title.length < 3) throw new Error('Titlul anunțului este prea scurt.');
    if(content.length < 5) throw new Error('Mesajul anunțului este prea scurt.');

    const item = {
      id: uid('ann'),
      classId: payload.classId,
      teacherId: payload.teacherId,
      title,
      content,
      createdAt: nowIso()
    };

    db.announcements.unshift(item);
    save(db);
    return item;
  }

  function deleteAnnouncement(id, teacherId){
    const db = load();
    const item = db.announcements.find(entry => entry.id === id);
    if(!item) throw new Error('Anunțul nu există.');
    if(item.teacherId !== teacherId) throw new Error('Nu poți șterge acest anunț.');
    db.announcements = db.announcements.filter(entry => entry.id !== id);
    save(db);
    return true;
  }

  function createQuiz(payload){
    const db = load();
    const classroom = db.classes.find(item => item.id === payload.classId);
    if(!classroom) throw new Error('Clasa selectată nu există.');
    if(classroom.teacherId !== payload.teacherId) throw new Error('Nu poți adăuga teste în această clasă.');

    const title = String(payload.title || '').trim();
    const instructions = String(payload.instructions || '').trim();
    const questions = Array.isArray(payload.questions) ? payload.questions : [];

    if(title.length < 3) throw new Error('Titlul testului este prea scurt.');
    if(!questions.length) throw new Error('Adaugă cel puțin o întrebare în test.');

    questions.forEach((question, index) => {
      if(String(question.text || '').trim().length < 5){
        throw new Error(`Întrebarea ${index + 1} este prea scurtă.`);
      }
      if(!Array.isArray(question.options) || question.options.length !== 4){
        throw new Error(`Întrebarea ${index + 1} trebuie să aibă exact 4 variante.`);
      }
      if(typeof question.correctIndex !== 'number' || question.correctIndex < 0 || question.correctIndex > 3){
        throw new Error(`Alege varianta corectă la întrebarea ${index + 1}.`);
      }
    });

    const quiz = {
      id: uid('quiz'),
      classId: payload.classId,
      teacherId: payload.teacherId,
      title,
      instructions,
      createdAt: nowIso(),
      questions: questions.map(question => ({
        id: uid('q'),
        text: String(question.text || '').trim(),
        options: question.options.map(option => String(option || '').trim()),
        correctIndex: Number(question.correctIndex),
        explanation: String(question.explanation || '').trim()
      }))
    };

    db.quizzes.unshift(quiz);
    save(db);
    return quiz;
  }

  function deleteQuiz(quizId, teacherId){
    const db = load();
    const quiz = db.quizzes.find(item => item.id === quizId);
    if(!quiz) throw new Error('Testul nu există.');
    if(quiz.teacherId !== teacherId) throw new Error('Nu poți șterge acest test.');

    db.quizzes = db.quizzes.filter(item => item.id !== quizId);
    db.submissions = db.submissions.filter(item => item.quizId !== quizId);
    save(db);
    return true;
  }

  function submitQuiz(payload){
    const db = load();
    const quiz = db.quizzes.find(item => item.id === payload.quizId);
    if(!quiz) throw new Error('Testul nu există.');

    const student = db.users.find(user => user.id === payload.studentId && user.role === 'elev');
    if(!student) throw new Error('Doar elevii pot trimite teste.');

    const answers = Array.isArray(payload.answers) ? payload.answers : [];
    const score = quiz.questions.reduce((sum, question, index) => {
      return sum + (Number(answers[index]) === Number(question.correctIndex) ? 1 : 0);
    }, 0);

    const item = {
      id: uid('sub'),
      quizId: quiz.id,
      studentId: student.id,
      answers,
      score,
      total: quiz.questions.length,
      percent: percent(score, quiz.questions.length),
      submittedAt: nowIso()
    };

    db.submissions.unshift(item);
    save(db);
    return item;
  }

  function exportJSON(){
    return JSON.stringify(load(), null, 2);
  }

  function importJSON(text){
    const parsed = safeParse(text, null);
    if(!parsed || typeof parsed !== 'object'){
      throw new Error('Fișierul JSON nu este valid.');
    }
    clearSession();
    return save(normalize(parsed));
  }

  function normalizeTheme(theme){
    return ['light', 'dark', 'neon'].includes(theme) ? theme : 'light';
  }

  function setTheme(theme){
    const next = normalizeTheme(theme);
    localStorage.setItem(THEME_KEY, next);
    try{
      localStorage.setItem('theme', next);
    }catch(err){}
  }

  function getTheme(){
    return normalizeTheme(localStorage.getItem(THEME_KEY) || localStorage.getItem('theme'));
  }

  function nextTheme(currentTheme){
    const themes = ['light', 'dark', 'neon'];
    const current = normalizeTheme(currentTheme || getTheme());
    const index = themes.indexOf(current);
    return themes[(index + 1) % themes.length];
  }

  function applyThemeToDocument(doc){
    const targetDoc = doc || document;
    const theme = getTheme();
    if(targetDoc && targetDoc.body){
      targetDoc.body.classList.toggle('dark', theme === 'dark');
      targetDoc.body.classList.toggle('neon', theme === 'neon');
    }
    if(targetDoc && targetDoc.documentElement){
      targetDoc.documentElement.dataset.theme = theme;
    }
    const meta = targetDoc && targetDoc.querySelector ? targetDoc.querySelector('meta[name="theme-color"]') : null;
    if(meta){
      meta.setAttribute('content', theme === 'dark' ? '#09111f' : theme === 'neon' ? '#070b1b' : '#2563eb');
    }
    return theme;
  }

  window.ChemStore = {
    uid,
    nowIso,
    formatDate,
    initials,
    percent,
    load,
    save,
    syncNow,
    getStorageInfo,
    resetDemo,
    getCurrentUser,
    setSession,
    clearSession,
    register,
    authenticate,
    loginAsDemo,
    classesForUser,
    createClass,
    deleteClass,
    joinClass,
    createLesson,
    deleteLesson,
    createAnnouncement,
    deleteAnnouncement,
    createQuiz,
    deleteQuiz,
    submitQuiz,
    exportJSON,
    importJSON,
    setTheme,
    getTheme,
    nextTheme,
    applyThemeToDocument
  };
})();
