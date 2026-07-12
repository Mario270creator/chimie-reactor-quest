# 🚀 Ghid: cum pui și modifici site-ul pe GitHub

Ghid pas cu pas, fără cunoștințe tehnice necesare. Totul se face din browser.

---

## Pasul 1 · Creezi contul și repository-ul

1. Intră pe **github.com** și fă-ți cont (gratuit), dacă nu ai deja.
2. Apasă butonul verde **New** (sau `+` din dreapta sus → **New repository**).
3. Nume: `chimie-academy` (sau ce vrei tu).
4. Alege **Public** (necesar pentru hosting gratuit) și apasă **Create repository**.

## Pasul 2 · Urci fișierele (din browser, fără comenzi)

1. În pagina noului repository, apasă **uploading an existing file** (linkul din mijlocul paginii).
2. Dezarhivează ZIP-ul pe calculator, apoi **trage toate fișierele și folderele** din folderul proiectului direct în pagina GitHub.
   - Atenție: trage **conținutul** folderului, nu folderul în sine, ca `app.py` să fie în rădăcina repository-ului.
3. Jos, la "Commit changes", scrie un mesaj scurt (ex: `prima versiune`) și apasă **Commit changes**.

> 💡 Dacă browserul nu te lasă să tragi foldere, folosește GitHub Desktop (aplicație gratuită): o instalezi, faci "Clone" la repository, copiezi fișierele în folderul clonat și apeși "Commit" + "Push".

## Pasul 3 · Publici site-ul online (Render, gratuit)

Site-ul are backend Python (Flask), deci NU merge pe GitHub Pages — dar merge perfect pe **Render**:

1. Intră pe **render.com** și fă-ți cont cu butonul **Sign in with GitHub**.
2. Apasă **New → Web Service**.
3. Alege repository-ul `chimie-academy` din listă.
4. Render detectează automat fișierul `render.yaml` din proiect — apasă **Deploy**.
5. În 2-3 minute primești un link de forma `https://chimie-academy.onrender.com`.

⚠️ **Important despre date pe Render (planul gratuit):** baza de date SQLite se resetează la fiecare re-deploy și după perioade de inactivitate. Pentru școală/prezentări e OK. Dacă vrei date permanente, adaugă un "Persistent Disk" din setările Render (plan plătit) sau exportă periodic datele din pagina **Export** a site-ului.

## Pasul 4 · Cum modifici site-ul direct pe GitHub

Orice fișier poate fi editat din browser:

1. Intră în repository și dă click pe fișierul dorit (ex: `templates/home.html` pentru pagina principală).
2. Apasă iconița **creion ✏️** (Edit this file) din dreapta sus.
3. Modifici textul, apoi apeși **Commit changes**.
4. Dacă ai legat Render, site-ul se **actualizează automat** în câteva minute după fiecare commit.

### Unde găsești ce vrei să schimbi

| Vrei să schimbi… | Fișierul |
|---|---|
| Textele de pe pagina principală | `templates/home.html` |
| Meniul, titlul site-ului, footer | `templates/base.html` |
| Culorile și designul | `static/css/style.css` (variabilele de la început: `--primary`, `--accent` etc.) |
| Logica site-ului (rute, reguli) | `app.py` |
| Editorul chimic (butoane, formule rapide) | `static/js/chem-editor.js` |
| Panoul de administrare | `templates/admin.html` |

### Conținutul (lecții, teste, conturi) NU se editează din fișiere!

Pentru lecții, teste, clase, conturi și parole folosești **panoul de administrare** direct din site:
- Loghează-te ca profesor administrator → apare **⚙️ Admin** în meniu.

## Pasul 5 · Actualizări viitoare

Când vrei să schimbi mai multe fișiere deodată:
1. În repository apasă **Add file → Upload files**.
2. Tragi fișierele noi peste cele vechi — GitHub le înlocuiește automat.
3. **Commit changes** → Render re-publică singur.

---

## Conturi și securitate — de făcut imediat după publicare

1. Loghează-te cu `profesor_demo` / `1234`.
2. Din **Panou principal → Contul meu → Schimbă parola**, pune o parolă serioasă.
3. Din **⚙️ Admin → Conturi & parole**: redenumește contul demo sau creează-ți contul tău de administrator și șterge-l pe cel demo.
4. Resetează sau șterge contul `elev_demo` dacă nu îl mai vrei.
