# Chimie Academy · Reactor Quest

Versiune refăcută ca joc educațional de chimie, cu backend Flask + SQLite, compatibilă cu telefonul și calculatorul.

## Ce include

- autentificare profesor / elev
- dashboard gamificat cu XP, niveluri, badges și leaderboard
- clase, anunțuri, lecții (misiuni), quiz-uri (boss fights)
- laborator integrat: tabel periodic, reacții, calculator de masă molară
- ONCS Studio:
  - proiecte pentru echipe de 2 elevi
  - secțiuni A / B / C
  - categorii Juniori / Seniori
  - checklist de conformitate
  - navigator de secțiune
  - timer 10 + 5 pentru prezentare
  - export de proiect printabil
- export JSON și CSV
- compatibilitate cu endpoint-ul vechi `/api/db.php`

## Pornire rapidă

```bash
pip install -r requirements.txt
python app.py
```

Deschide:

```bash
http://127.0.0.1:8000
```

Pentru telefon:
- conectează telefonul la aceeași rețea cu calculatorul
- pornește aplicația
- deschide în browser `http://IP_CALCULATOR:8000`

## Conturi demo

Profesor:
- utilizator: `profesor_demo`
- parolă: `1234`

Elev:
- utilizator: `elev_demo`
- parolă: `1234`

## Fișiere importante

- `app.py` - aplicația Flask și backend-ul SQLite
- `templates/` - paginile
- `static/css/style.css` - designul
- `static/js/app.js` - interacțiuni, theme, quiz builder, timer
- `static/legacy_lab/` - laboratorul vizual păstrat și integrat
- `instance/chimie_reactor_quest.db` - baza de date
- `wsgi.py` - entrypoint pentru deploy

## Publicare

Poți publica aplicația pe o platformă care rulează Python și Flask.
La deploy, setează:
- `PORT` dacă platforma îl cere
- opțional `SECRET_KEY`

## Observații

- footerul nu are autori fixați; îl poți personaliza ușor dacă vrei
- laboratorul vechi a fost curățat de creditul cerut și integrat în noua platformă
- endpoint-ul vechi `/api/db.php` este păstrat ca bridge pentru compatibilitate și backup
