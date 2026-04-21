# Chimie Academy · Reactor Quest · Easy Access

Versiune refăcută ca să fie cât mai ușor de deschis și de arătat bine pe calculator, telefon și la publicare online.

## Ce s-a schimbat în varianta asta

- **nu mai trebuie să instalezi separat Flask** sau alte librării pentru rularea locală; sunt incluse în folderul `_vendor`
- **ai pornire cu un click** pentru calculator și variantă separată pentru telefon
- **lab-ul, timerul și leaderboard-ul sunt publice**, fără login
- **demo instant** din homepage, fără formulare
- **fișiere pregătite pentru publicare**: `Procfile`, `render.yaml`, `wsgi.py`
- backend-ul rămâne pe **Flask + SQLite**

## Cea mai ușoară pornire

### Windows

Deschide direct:

- `PORNESTE_PE_CALCULATOR.bat` → pentru calculator
- `PORNESTE_PENTRU_TELEFON.bat` → pentru calculator + telefon pe același Wi‑Fi

### Linux / macOS

Rulează:

```bash
./porneste_pe_calculator.sh
```

sau pentru telefon:

```bash
./porneste_pentru_telefon.sh
```

## Variantă simplă din terminal

```bash
python launch_local.py
```

Pentru telefon și calculator în aceeași rețea:

```bash
python launch_network.py
```

## Singurul lucru necesar local

Ai nevoie doar de **Python 3** instalat pe calculator.
Nu mai trebuie să rulezi `pip install -r requirements.txt` pentru varianta locală.

## Ce poți deschide fără cont

- laboratorul
- timerul de prezentare
- leaderboard-ul
- homepage-ul cu demo instant

## Conturi demo

Profesor:
- utilizator: `profesor_demo`
- parolă: `1234`

Elev:
- utilizator: `elev_demo`
- parolă: `1234`

## Publicare rapidă pe net

Cea mai simplă variantă este:

1. urci proiectul pe GitHub
2. conectezi repo-ul la Render
3. Render citește automat `render.yaml`
4. aplicația pornește cu:

```bash
gunicorn --bind 0.0.0.0:$PORT wsgi:app
```

Dacă nu folosești Render, poți folosi orice hosting Python care acceptă Flask / Gunicorn.

## Fișiere importante

- `app.py` - backend Flask și logica principală
- `launch.py` - pornire locală inteligentă
- `launch_local.py` - start pe calculator
- `launch_network.py` - start pentru telefon + calculator
- `PORNESTE_PE_CALCULATOR.bat` - start rapid Windows
- `PORNESTE_PENTRU_TELEFON.bat` - start rapid Windows pentru rețea
- `templates/` - paginile site-ului
- `static/` - design, manifest PWA, JS, laborator
- `instance/chimie_reactor_quest.db` - baza de date SQLite
- `render.yaml` / `Procfile` - fișiere pentru deploy

## Observație

Dacă vrei **zero instalare locală**, soluția reală este să îl publici online și apoi îl deschizi direct din browser. Varianta din folder este deja pregătită pentru pasul ăsta.
