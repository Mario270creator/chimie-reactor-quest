
from __future__ import annotations

import csv
import io
import json
import os
import random
import secrets
import sqlite3
import string
import sys
from contextlib import closing
from datetime import date, datetime, timedelta, timezone
from functools import wraps
from pathlib import Path
from typing import Any

BOOT_DIR = Path(__file__).resolve().parent
VENDOR_DIR = BOOT_DIR / "_vendor"


def ensure_local_vendor_packages() -> None:
    if VENDOR_DIR.exists() and str(VENDOR_DIR) not in sys.path:
        sys.path.insert(0, str(VENDOR_DIR))


try:
    import flask  # noqa: F401
    import werkzeug  # noqa: F401
except Exception:
    ensure_local_vendor_packages()

from flask import (
    Flask,
    Response,
    flash,
    g,
    jsonify,
    redirect,
    render_template,
    request,
    send_from_directory,
    session,
    url_for,
)
from werkzeug.security import check_password_hash, generate_password_hash

BASE_DIR = Path(__file__).resolve().parent
INSTANCE_DIR = BASE_DIR / "instance"
DEFAULT_RENDER_DISK_DIR = Path("/opt/render/project/src/render_disk")
PERSISTENT_DATA_DIR = DEFAULT_RENDER_DISK_DIR if os.environ.get("RENDER") and DEFAULT_RENDER_DISK_DIR.exists() else INSTANCE_DIR
DB_PATH = Path(os.environ.get("APP_DB_PATH", PERSISTENT_DATA_DIR / "chimie_reactor_quest.db"))
SECRET_FILE = Path(os.environ.get("APP_SECRET_FILE", PERSISTENT_DATA_DIR / ".secret_key"))
LEGACY_IMPORT_FILE = Path(os.environ.get("APP_LEGACY_IMPORT_FILE", PERSISTENT_DATA_DIR / "legacy_bridge_last_import.json"))

INSTANCE_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH.parent.mkdir(parents=True, exist_ok=True)
SECRET_FILE.parent.mkdir(parents=True, exist_ok=True)
LEGACY_IMPORT_FILE.parent.mkdir(parents=True, exist_ok=True)


def load_secret_key() -> str:
    env_secret = os.environ.get("SECRET_KEY")
    if env_secret:
        return env_secret
    if SECRET_FILE.exists():
        return SECRET_FILE.read_text(encoding="utf-8").strip()
    secret = secrets.token_urlsafe(32)
    SECRET_FILE.write_text(secret, encoding="utf-8")
    return secret


app = Flask(__name__)
app.config.update(
    SECRET_KEY=load_secret_key(),
    JSON_AS_ASCII=False,
    TEMPLATES_AUTO_RELOAD=True,
)


# ---------------------------- database helpers ---------------------------- #

SCHEMA_SQL = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('profesor', 'elev')),
    bio TEXT DEFAULT '',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    section TEXT NOT NULL,
    description TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    teacher_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at TEXT NOT NULL,
    UNIQUE(class_id, user_id),
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    teacher_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    content TEXT NOT NULL,
    xp INTEGER NOT NULL DEFAULT 40,
    difficulty TEXT NOT NULL DEFAULT 'Mediu',
    created_at TEXT NOT NULL,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    completed_at TEXT NOT NULL,
    UNIQUE(lesson_id, user_id),
    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    xp INTEGER NOT NULL DEFAULT 120,
    difficulty TEXT NOT NULL DEFAULT 'Standard',
    questions_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    score_percent REAL NOT NULL,
    correct_count INTEGER NOT NULL,
    total_count INTEGER NOT NULL,
    answers_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL,
    class_id INTEGER,
    title TEXT NOT NULL,
    acronym TEXT NOT NULL,
    team_category TEXT NOT NULL CHECK(team_category IN ('Juniori', 'Seniori')),
    section TEXT NOT NULL CHECK(section IN ('A', 'B', 'C')),
    mentor_name TEXT NOT NULL,
    school_name TEXT NOT NULL,
    member_one TEXT NOT NULL,
    member_one_role TEXT NOT NULL,
    member_two TEXT NOT NULL,
    member_two_role TEXT NOT NULL,
    problem TEXT NOT NULL,
    objectives TEXT NOT NULL,
    methods TEXT NOT NULL,
    novelty TEXT NOT NULL,
    results TEXT NOT NULL,
    next_steps TEXT NOT NULL,
    started_on TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL
);
"""


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        g.db = conn
    return g.db


@app.teardown_appcontext
def close_db(exc: Exception | None) -> None:
    db = g.pop("db", None)
    if db is not None:
        db.close()


def execute_db(sql: str, params: tuple[Any, ...] = ()) -> sqlite3.Cursor:
    db = get_db()
    cur = db.execute(sql, params)
    db.commit()
    return cur


def query_all(sql: str, params: tuple[Any, ...] = ()) -> list[sqlite3.Row]:
    return get_db().execute(sql, params).fetchall()


def query_one(sql: str, params: tuple[Any, ...] = ()) -> sqlite3.Row | None:
    return get_db().execute(sql, params).fetchone()


def init_db() -> None:
    with closing(sqlite3.connect(DB_PATH)) as conn:
        conn.executescript(SCHEMA_SQL)
        conn.commit()


def make_class_code(name: str, section: str) -> str:
    base = "".join(ch for ch in (name + section).upper() if ch.isalnum())[:6] or "CLASA"
    while True:
        suffix = "".join(random.choice(string.digits) for _ in range(3))
        code = f"{base}{suffix}"
        if query_one("SELECT id FROM classes WHERE code = ?", (code,)) is None:
            return code


def seed_demo_data() -> None:
    if query_one("SELECT id FROM users LIMIT 1"):
        return

    now = utcnow_iso()
    teacher_password = generate_password_hash("1234")
    student_password = generate_password_hash("1234")

    teacher_id = execute_db(
        "INSERT INTO users(full_name, username, password_hash, role, bio, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (
            "Profesor Demo",
            "profesor_demo",
            teacher_password,
            "profesor",
            "Coordonatorul clasei demonstrative și al laboratorului interactiv.",
            now,
        ),
    ).lastrowid

    student_id = execute_db(
        "INSERT INTO users(full_name, username, password_hash, role, bio, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (
            "Elev Demo",
            "elev_demo",
            student_password,
            "elev",
            "Elev demo care își urmărește progresul și acumulează puncte.",
            now,
        ),
    ).lastrowid

    class_one = execute_db(
        "INSERT INTO classes(name, section, description, code, teacher_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (
            "Clasa VII",
            "A",
            "Atomii, moleculele, reacțiile de bază și laboratorul vizual.",
            "CHIM7A",
            teacher_id,
            now,
        ),
    ).lastrowid

    class_two = execute_db(
        "INSERT INTO classes(name, section, description, code, teacher_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (
            "Clasa VIII",
            "B",
            "Acizi, baze, săruri, neutralizare și pregătirea pentru prezentări.",
            "CHIM8B",
            teacher_id,
            now,
        ),
    ).lastrowid

    execute_db(
        "INSERT INTO enrollments(class_id, user_id, joined_at) VALUES (?, ?, ?)",
        (class_one, student_id, now),
    )
    execute_db(
        "INSERT INTO enrollments(class_id, user_id, joined_at) VALUES (?, ?, ?)",
        (class_two, student_id, now),
    )

    execute_db(
        "INSERT INTO announcements(class_id, teacher_id, title, content, created_at) VALUES (?, ?, ?, ?, ?)",
        (
            class_one,
            teacher_id,
            "Bun venit la Chimie Academy",
            "Primele lecții sunt active. Explorează laboratorul, parcurge lecțiile și rezolvă testele.",
            now,
        ),
    )
    execute_db(
        "INSERT INTO announcements(class_id, teacher_id, title, content, created_at) VALUES (?, ?, ?, ?, ?)",
        (
            class_two,
            teacher_id,
            "Laboratorul este gata",
            "Am inclus simulatorul, exercițiile și timerul de prezentare pentru antrenament rapid.",
            now,
        ),
    )

    lessons = [
        (
            class_one,
            "Lecția 1 · Atomul și identitatea elementelor",
            "Noțiunile de bază: protoni, neutroni, electroni și număr atomic.",
            "Atomul este unitatea de bază a materiei. În această lecție înveți cum diferențiezi protonii, neutronii și electronii, ce înseamnă numărul atomic și cum identifici un element în tabelul periodic.",
            40,
            "Introductiv",
        ),
        (
            class_one,
            "Lecția 2 · Molecule și formule",
            "De la simboluri la compuși: H2O, CO2, NaCl și reguli de citire.",
            "Formulele chimice arată ce atomi conține un compus și în ce raport. Învață să citești simbolurile și să legi formula de substanța reală.",
            55,
            "Mediu",
        ),
        (
            class_two,
            "Lecția 3 · Acizi, baze și săruri",
            "Recunoaște familiile de compuși și relațiile dintre ele.",
            "Acizii au, de regulă, hidrogen ionizabil, bazele includ grupa hidroxil, iar sărurile apar frecvent în reacții de neutralizare. Notează exemple, proprietăți și cazuri uzuale.",
            65,
            "Mediu",
        ),
        (
            class_two,
            "Lecția 4 · Neutralizare și aplicații",
            "Cum transformi teoria în experiment și prezentare clară.",
            "Neutralizarea este una dintre reacțiile-cheie. Urmărește transformarea acid + bază în sare + apă și pregătește modul de explicare orală a rezultatului.",
            75,
            "Avansat",
        ),
    ]
    for lesson in lessons:
        execute_db(
            "INSERT INTO lessons(class_id, title, summary, content, xp, difficulty, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (*lesson, now),
        )

    quiz_one_questions = [
        {
            "text": "Care este simbolul oxigenului?",
            "options": ["O", "Ox", "Og", "Om"],
            "correct": 0,
            "explanation": "Simbolul chimic al oxigenului este O.",
        },
        {
            "text": "Numărul atomic este egal cu numărul de...",
            "options": ["neutroni", "protoni", "molecule", "orbitali"],
            "correct": 1,
            "explanation": "Numărul atomic reprezintă numărul de protoni din nucleu.",
        },
        {
            "text": "Gazele nobile se află în grupa...",
            "options": ["1", "2", "17", "18"],
            "correct": 3,
            "explanation": "Gazele nobile se află în grupa 18.",
        },
    ]

    quiz_two_questions = [
        {
            "text": "Ce se obține, de regulă, în reacția acid + bază?",
            "options": ["metal și oxid", "gaz inert", "sare și apă", "numai apă"],
            "correct": 2,
            "explanation": "Neutralizarea produce de obicei sare și apă.",
        },
        {
            "text": "Care dintre următoarele este o bază?",
            "options": ["NaOH", "HCl", "CO2", "SO2"],
            "correct": 0,
            "explanation": "NaOH este hidroxid de sodiu, deci o bază.",
        },
        {
            "text": "Ce suport te ajută să explici clar un proiect experimental?",
            "options": ["Poster și/sau exponat", "Doar eseu", "Doar video", "Doar model 3D online"],
            "correct": 0,
            "explanation": "Un poster și/sau un exponat pot susține clar explicația unui proiect experimental.",
        },
    ]

    execute_db(
        "INSERT INTO quizzes(class_id, title, description, xp, difficulty, questions_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (
            class_one,
            "Test 1 · Tabel periodic",
            "Trei întrebări rapide pentru verificarea noțiunilor de bază.",
            120,
            "Standard",
            json.dumps(quiz_one_questions, ensure_ascii=False),
            now,
        ),
    )
    quiz_two_id = execute_db(
        "INSERT INTO quizzes(class_id, title, description, xp, difficulty, questions_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (
            class_two,
            "Test 2 · Acizi și baze",
            "Testează reacțiile esențiale și modul de explicare a rezultatului.",
            150,
            "Standard",
            json.dumps(quiz_two_questions, ensure_ascii=False),
            now,
        ),
    ).lastrowid

    # Contul demo de elev pornește fără lecții sau teste deja completate.
    # Astfel, utilizatorul poate verifica fluxul integral de la zero.


def reset_demo_student_progress(user_id: int) -> None:
    execute_db("DELETE FROM completions WHERE user_id = ?", (user_id,))
    execute_db("DELETE FROM attempts WHERE user_id = ?", (user_id,))


init_db()
with app.app_context():
    seed_demo_data()


# ---------------------------- auth / permissions ---------------------------- #

def current_user() -> sqlite3.Row | None:
    user_id = session.get("user_id")
    if not user_id:
        return None
    return query_one("SELECT * FROM users WHERE id = ?", (user_id,))


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if current_user() is None:
            flash("Intră în cont ca să accesezi platforma.", "warning")
            return redirect(url_for("login"))
        return view(*args, **kwargs)

    return wrapped


def teacher_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        user = current_user()
        if user is None:
            flash("Intră în cont ca să continui.", "warning")
            return redirect(url_for("login"))
        if user["role"] != "profesor":
            flash("Această zonă este rezervată profesorului/mentorului.", "danger")
            return redirect(url_for("dashboard"))
        return view(*args, **kwargs)

    return wrapped


@app.context_processor
def inject_globals() -> dict[str, Any]:
    user = current_user()
    return {
        "current_user": user,
        "user_level": compute_level(user["id"]) if user else None,
        "site_name": "Chimie Academy · Clasele VII-VIII",
        "footer_credits": "Platformă educațională pregătită pentru lucru clar, rapid și organizat.",
        "today_iso": date.today().isoformat(),
    }


# ---------------------------- app-specific helpers ---------------------------- #

def classes_for_user(user: sqlite3.Row) -> list[sqlite3.Row]:
    if user["role"] == "profesor":
        return query_all(
            """SELECT c.*, COUNT(DISTINCT e.user_id) AS student_count,
                      COUNT(DISTINCT l.id) AS lesson_count,
                      COUNT(DISTINCT q.id) AS quiz_count
               FROM classes c
               LEFT JOIN enrollments e ON e.class_id = c.id
               LEFT JOIN lessons l ON l.class_id = c.id
               LEFT JOIN quizzes q ON q.class_id = c.id
               WHERE c.teacher_id = ?
               GROUP BY c.id
               ORDER BY c.created_at DESC""",
            (user["id"],),
        )
    return query_all(
        """SELECT c.*, u.full_name AS teacher_name,
                  COUNT(DISTINCT l.id) AS lesson_count,
                  COUNT(DISTINCT q.id) AS quiz_count
           FROM classes c
           JOIN enrollments e ON e.class_id = c.id
           JOIN users u ON u.id = c.teacher_id
           LEFT JOIN lessons l ON l.class_id = c.id
           LEFT JOIN quizzes q ON q.class_id = c.id
           WHERE e.user_id = ?
           GROUP BY c.id
           ORDER BY c.created_at DESC""",
        (user["id"],),
    )


def lessons_for_user(user: sqlite3.Row) -> list[sqlite3.Row]:
    if user["role"] == "profesor":
        return query_all(
            """SELECT l.*, c.name AS class_name, c.section AS class_section,
                      COUNT(DISTINCT cp.user_id) AS completion_count
               FROM lessons l
               JOIN classes c ON c.id = l.class_id
               LEFT JOIN completions cp ON cp.lesson_id = l.id
               WHERE c.teacher_id = ?
               GROUP BY l.id
               ORDER BY l.created_at DESC""",
            (user["id"],),
        )
    return query_all(
        """SELECT l.*, c.name AS class_name, c.section AS class_section,
                  cp.id AS completion_id, cp.completed_at,
                  CASE WHEN cp.id IS NULL THEN 0 ELSE 1 END AS is_completed
           FROM lessons l
           JOIN classes c ON c.id = l.class_id
           JOIN enrollments e ON e.class_id = c.id
           LEFT JOIN completions cp ON cp.lesson_id = l.id AND cp.user_id = ?
           WHERE e.user_id = ?
           ORDER BY l.created_at DESC""",
        (user["id"], user["id"]),
    )


def quizzes_for_user(user: sqlite3.Row) -> list[sqlite3.Row]:
    if user["role"] == "profesor":
        return query_all(
            """SELECT q.*, c.name AS class_name, c.section AS class_section,
                      COUNT(DISTINCT a.user_id) AS participant_count
               FROM quizzes q
               JOIN classes c ON c.id = q.class_id
               LEFT JOIN attempts a ON a.quiz_id = q.id
               WHERE c.teacher_id = ?
               GROUP BY q.id
               ORDER BY q.created_at DESC""",
            (user["id"],),
        )
    return query_all(
        """SELECT q.*, c.name AS class_name, c.section AS class_section,
                  COALESCE(MAX(a.score_percent), 0) AS best_score,
                  COUNT(a.id) AS attempt_count
           FROM quizzes q
           JOIN classes c ON c.id = q.class_id
           JOIN enrollments e ON e.class_id = c.id
           LEFT JOIN attempts a ON a.quiz_id = q.id AND a.user_id = ?
           WHERE e.user_id = ?
           GROUP BY q.id
           ORDER BY q.created_at DESC""",
        (user["id"], user["id"]),
    )


def announcements_for_user(user: sqlite3.Row, limit: int = 6) -> list[sqlite3.Row]:
    if user["role"] == "profesor":
        return query_all(
            """SELECT a.*, c.name AS class_name, c.section AS class_section
               FROM announcements a
               JOIN classes c ON c.id = a.class_id
               WHERE c.teacher_id = ?
               ORDER BY a.created_at DESC LIMIT ?""",
            (user["id"], limit),
        )
    return query_all(
        """SELECT a.*, c.name AS class_name, c.section AS class_section, u.full_name AS teacher_name
           FROM announcements a
           JOIN classes c ON c.id = a.class_id
           JOIN users u ON u.id = a.teacher_id
           JOIN enrollments e ON e.class_id = c.id
           WHERE e.user_id = ?
           ORDER BY a.created_at DESC LIMIT ?""",
        (user["id"], limit),
    )


def projects_for_user(user: sqlite3.Row) -> list[sqlite3.Row]:
    if user["role"] == "profesor":
        return query_all(
            """SELECT p.*, c.name AS class_name, c.section AS class_section
               FROM projects p
               LEFT JOIN classes c ON c.id = p.class_id
               WHERE p.owner_id = ?
               ORDER BY p.updated_at DESC""",
            (user["id"],),
        )
    return query_all(
        """SELECT p.*, c.name AS class_name, c.section AS class_section
           FROM projects p
           LEFT JOIN classes c ON c.id = p.class_id
           WHERE p.owner_id = ? OR p.member_one = ? OR p.member_two = ?
           ORDER BY p.updated_at DESC""",
        (user["id"], user["full_name"], user["full_name"]),
    )


def project_compliance(project: sqlite3.Row | dict[str, Any]) -> dict[str, Any]:
    started_on = str(project.get("started_on", "") if isinstance(project, dict) else project["started_on"]).strip()
    updated_at = str(project.get("updated_at", "") if isinstance(project, dict) else project["updated_at"])
    checks = [
        ("Acronim", bool((project.get("acronym") if isinstance(project, dict) else project["acronym"]).strip())),
        ("Secțiune", bool((project.get("section") if isinstance(project, dict) else project["section"]).strip())),
        ("Categorie", bool((project.get("team_category") if isinstance(project, dict) else project["team_category"]).strip())),
        ("2 membri în echipă", bool((project.get("member_one") if isinstance(project, dict) else project["member_one"]).strip()) and bool((project.get("member_two") if isinstance(project, dict) else project["member_two"]).strip())),
        ("Mentor", bool((project.get("mentor_name") if isinstance(project, dict) else project["mentor_name"]).strip())),
        ("Problema", bool((project.get("problem") if isinstance(project, dict) else project["problem"]).strip())),
        ("Obiective", bool((project.get("objectives") if isinstance(project, dict) else project["objectives"]).strip())),
        ("Metode", bool((project.get("methods") if isinstance(project, dict) else project["methods"]).strip())),
        ("Rezultate", bool((project.get("results") if isinstance(project, dict) else project["results"]).strip())),
    ]
    warnings: list[str] = []
    if started_on:
        try:
            start_date = date.fromisoformat(started_on)
            if start_date < date.today() - timedelta(days=366):
                warnings.append("Data de început depășește intervalul recomandat de 12 luni pentru etapa națională.")
        except ValueError:
            warnings.append("Data de început nu este validă.")
    else:
        warnings.append("Lipsește data de început a studiului/proiectului.")
    if not bool((project.get("member_two_role") if isinstance(project, dict) else project["member_two_role"]).strip()):
        warnings.append("Rolul celui de-al doilea membru este incomplet.")
    if not bool((project.get("next_steps") if isinstance(project, dict) else project["next_steps"]).strip()):
        warnings.append("Adaugă pașii următori ca să susții dezvoltarea ulterioară.")
    done = sum(1 for _, ok in checks if ok)
    total = len(checks)
    return {
        "checks": checks,
        "done": done,
        "total": total,
        "percent": round(done / total * 100) if total else 0,
        "warnings": warnings,
        "updated_at": updated_at,
    }


def badge_list_for_user(user: sqlite3.Row) -> list[dict[str, str]]:
    user_id = user["id"]
    lesson_count = query_one("SELECT COUNT(*) AS c FROM completions WHERE user_id = ?", (user_id,))["c"]
    quiz_best = query_one("SELECT COALESCE(MAX(score_percent), 0) AS best FROM attempts WHERE user_id = ?", (user_id,))["best"]
    xp = compute_total_xp(user_id)
    badges: list[dict[str, str]] = []
    if lesson_count >= 1:
        badges.append({"icon": "⚛️", "title": "Primii pași", "desc": "Prima lecție parcursă."})
    if lesson_count >= 3:
        badges.append({"icon": "🧬", "title": "Formule și molecule", "desc": "Trei lecții parcurse."})
    if quiz_best >= 80:
        badges.append({"icon": "🏆", "title": "Rezultate bune la teste", "desc": "Ai depășit 80% la un test."})
    if lesson_count >= 5 or quiz_best >= 90:
        badges.append({"icon": "🔬", "title": "Laborator activ", "desc": "Lucrezi sigur cu reacții și formule."})
    if xp >= 250:
        badges.append({"icon": "🚀", "title": "Progres constant", "desc": "Ai depășit 250 de puncte."})
    if not badges:
        badges.append({"icon": "✨", "title": "Început bun", "desc": "Primele realizări apar după prima lecție."})
    return badges[:4]


def compute_total_xp(user_id: int) -> int:
    lesson_xp_row = query_one(
        """SELECT COALESCE(SUM(l.xp), 0) AS xp
           FROM completions c
           JOIN lessons l ON l.id = c.lesson_id
           WHERE c.user_id = ?""",
        (user_id,),
    )
    lesson_xp = int(round(lesson_xp_row["xp"])) if lesson_xp_row else 0
    quiz_rows = query_all(
        """SELECT q.id, q.xp, COALESCE(MAX(a.score_percent), 0) AS best_score
           FROM quizzes q
           LEFT JOIN attempts a ON a.quiz_id = q.id AND a.user_id = ?
           GROUP BY q.id""",
        (user_id,),
    )
    quiz_xp = 0
    for row in quiz_rows:
        quiz_xp += round(float(row["xp"]) * (float(row["best_score"]) / 100.0))
    return lesson_xp + quiz_xp


def compute_level(user_id: int) -> dict[str, Any]:
    xp = compute_total_xp(user_id)
    tiers = [
        (0, "Începător", "🌱"),
        (120, "În formare", "⚗️"),
        (260, "Aplicat", "🧪"),
        (420, "Avansat", "📘"),
        (620, "Excelent", "🏅"),
    ]
    current = tiers[0]
    next_tier = None
    for idx, tier in enumerate(tiers):
        if xp >= tier[0]:
            current = tier
            next_tier = tiers[idx + 1] if idx + 1 < len(tiers) else None
    if next_tier:
        progress = max(0, min(100, round((xp - current[0]) / (next_tier[0] - current[0]) * 100)))
        remaining = next_tier[0] - xp
    else:
        progress = 100
        remaining = 0
    return {
        "xp": xp,
        "title": current[1],
        "icon": current[2],
        "progress": progress,
        "next_title": next_tier[1] if next_tier else "Maxim",
        "remaining": remaining,
    }


def dashboard_stats(user: sqlite3.Row) -> dict[str, Any]:
    cls = classes_for_user(user)
    lessons = lessons_for_user(user)
    quizzes = quizzes_for_user(user)
    projects = projects_for_user(user)
    announcements = announcements_for_user(user, 4)

    if user["role"] == "elev":
        completed = sum(1 for item in lessons if item["is_completed"])
        attempt_rows = query_all(
            "SELECT score_percent FROM attempts WHERE user_id = ? ORDER BY created_at DESC",
            (user["id"],),
        )
        avg_score = round(sum(float(row["score_percent"]) for row in attempt_rows) / len(attempt_rows), 1) if attempt_rows else 0
    else:
        completed = query_one("SELECT COUNT(*) AS c FROM completions")["c"]
        attempt_rows = query_all(
            """SELECT score_percent FROM attempts a
               JOIN quizzes q ON q.id = a.quiz_id
               JOIN classes c ON c.id = q.class_id
               WHERE c.teacher_id = ?""",
            (user["id"],),
        )
        avg_score = round(sum(float(row["score_percent"]) for row in attempt_rows) / len(attempt_rows), 1) if attempt_rows else 0

    project_focus = project_compliance(projects[0]) if projects else {"percent": 0, "warnings": ["Creează primul proiect ONCS."]}
    return {
        "class_count": len(cls),
        "lesson_count": len(lessons),
        "quiz_count": len(quizzes),
        "completed_count": completed,
        "avg_score": avg_score,
        "project_focus": project_focus,
        "announcements": announcements,
    }


def leaderboard(limit: int = 20) -> list[dict[str, Any]]:
    users = query_all("SELECT * FROM users ORDER BY role = 'profesor', created_at ASC")
    rows = []
    for user in users:
        level = compute_level(user["id"])
        rows.append(
            {
                "id": user["id"],
                "full_name": user["full_name"],
                "role": user["role"],
                "xp": level["xp"],
                "title": level["title"],
                "icon": level["icon"],
            }
        )
    rows.sort(key=lambda item: (-item["xp"], item["full_name"].lower()))
    return rows[:limit]


def parse_questions_payload(raw_json: str) -> list[dict[str, Any]]:
    try:
        payload = json.loads(raw_json)
    except json.JSONDecodeError as exc:
        raise ValueError("Structura întrebărilor nu este JSON valid.") from exc
    if not isinstance(payload, list) or len(payload) < 1:
        raise ValueError("Adaugă cel puțin o întrebare.")
    cleaned = []
    for item in payload:
        if not isinstance(item, dict):
            raise ValueError("Fiecare întrebare trebuie să fie un obiect.")
        text = str(item.get("text", "")).strip()
        options = item.get("options", [])
        correct = item.get("correct")
        explanation = str(item.get("explanation", "")).strip()
        if not text:
            raise ValueError("Există o întrebare fără enunț.")
        if not isinstance(options, list) or len(options) != 4:
            raise ValueError("Fiecare întrebare trebuie să aibă exact 4 opțiuni.")
        options = [str(opt).strip() for opt in options]
        if any(not opt for opt in options):
            raise ValueError("Toate opțiunile trebuie completate.")
        if not isinstance(correct, int) or correct not in {0, 1, 2, 3}:
            raise ValueError("Indicele răspunsului corect este invalid.")
        cleaned.append(
            {
                "text": text,
                "options": options,
                "correct": correct,
                "explanation": explanation or "Explicația nu a fost completată.",
            }
        )
    return cleaned


def export_snapshot() -> dict[str, Any]:
    users = [dict(row) for row in query_all("SELECT id, full_name, username, role, created_at FROM users ORDER BY id")]
    classes = [dict(row) for row in query_all("SELECT * FROM classes ORDER BY id")]
    lessons = []
    for row in query_all("SELECT * FROM lessons ORDER BY id"):
        item = dict(row)
        lessons.append(item)
    quizzes = []
    for row in query_all("SELECT * FROM quizzes ORDER BY id"):
        item = dict(row)
        item["questions"] = json.loads(item.pop("questions_json"))
        quizzes.append(item)
    attempts = [dict(row) for row in query_all("SELECT * FROM attempts ORDER BY id")]
    projects = [dict(row) for row in query_all("SELECT * FROM projects ORDER BY id")]
    announcements = [dict(row) for row in query_all("SELECT * FROM announcements ORDER BY id")]
    return {
        "meta": {
            "app": "Chimie Academy · Clasele VII-VIII",
            "generatedAt": utcnow_iso(),
            "engine": "sqlite+flask",
        },
        "users": users,
        "classes": classes,
        "lessons": lessons,
        "quizzes": quizzes,
        "attempts": attempts,
        "projects": projects,
        "announcements": announcements,
    }


def allowed_class_ids_for_user(user: sqlite3.Row) -> set[int]:
    return {row["id"] for row in classes_for_user(user)}


# ---------------------------- routes: public ---------------------------- #

@app.route("/")
def home():
    counts = {
        "users": query_one("SELECT COUNT(*) AS c FROM users")["c"],
        "classes": query_one("SELECT COUNT(*) AS c FROM classes")["c"],
        "lessons": query_one("SELECT COUNT(*) AS c FROM lessons")["c"],
        "quizzes": query_one("SELECT COUNT(*) AS c FROM quizzes")["c"],
        "projects": query_one("SELECT COUNT(*) AS c FROM projects")["c"],
    }
    top_players = leaderboard(5)
    return render_template("home.html", counts=counts, top_players=top_players)


@app.route("/login", methods=["GET", "POST"])
def login():
    if current_user():
        return redirect(url_for("dashboard"))
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        role = request.form.get("role", "").strip()
        user = query_one("SELECT * FROM users WHERE username = ?", (username,))
        if user is None or not check_password_hash(user["password_hash"], password):
            flash("Utilizator sau parolă incorectă.", "danger")
        elif role and user["role"] != role:
            flash("Ai ales un rol diferit față de contul existent.", "warning")
        else:
            session.clear()
            session["user_id"] = user["id"]
            flash(f"Bine ai revenit, {user['full_name']}!", "success")
            return redirect(url_for("dashboard"))
    return render_template("login.html")


@app.route("/register", methods=["GET", "POST"])
def register():
    if current_user():
        return redirect(url_for("dashboard"))
    if request.method == "POST":
        full_name = request.form.get("full_name", "").strip()
        username = request.form.get("username", "").strip().lower()
        password = request.form.get("password", "")
        role = request.form.get("role", "").strip()
        bio = request.form.get("bio", "").strip()
        if len(full_name) < 3:
            flash("Numele trebuie să aibă cel puțin 3 caractere.", "warning")
        elif len(username) < 3:
            flash("Utilizatorul trebuie să aibă cel puțin 3 caractere.", "warning")
        elif len(password) < 4:
            flash("Parola trebuie să aibă cel puțin 4 caractere.", "warning")
        elif role not in {"profesor", "elev"}:
            flash("Alege un rol valid.", "warning")
        elif query_one("SELECT id FROM users WHERE username = ?", (username,)):
            flash("Există deja un cont cu acest utilizator.", "danger")
        else:
            user_id = execute_db(
                "INSERT INTO users(full_name, username, password_hash, role, bio, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (
                    full_name,
                    username,
                    generate_password_hash(password),
                    role,
                    bio,
                    utcnow_iso(),
                ),
            ).lastrowid
            session.clear()
            session["user_id"] = user_id
            flash("Cont creat. Bun venit la Chimie Academy!", "success")
            return redirect(url_for("dashboard"))
    return render_template("register.html")


@app.route("/demo/<role>")
def demo_login(role: str):
    role = role.strip().lower()
    username = "profesor_demo" if role == "profesor" else "elev_demo"
    user = query_one("SELECT * FROM users WHERE username = ?", (username,))
    if user is None:
        flash("Contul demo nu este disponibil.", "danger")
        return redirect(url_for("home"))
    if username == "elev_demo":
        reset_demo_student_progress(user["id"])
        user = query_one("SELECT * FROM users WHERE id = ?", (user["id"],))
    session.clear()
    session["user_id"] = user["id"]
    flash(f"Ai intrat în modul demo: {user['full_name']}.", "success")
    return redirect(url_for("dashboard"))


@app.route("/logout")
def logout():
    session.clear()
    flash("Ai ieșit din cont.", "success")
    return redirect(url_for("home"))


# ---------------------------- routes: private pages ---------------------------- #

@app.route("/dashboard")
@login_required
def dashboard():
    user = current_user()
    stats = dashboard_stats(user)
    quests = lessons_for_user(user)[:4]
    arenas = quizzes_for_user(user)[:4]
    boards = leaderboard(8)
    projects = projects_for_user(user)
    badges = badge_list_for_user(user)
    return render_template(
        "dashboard.html",
        stats=stats,
        quests=quests,
        arenas=arenas,
        board=boards,
        projects=projects,
        badges=badges,
    )


@app.route("/classes")
@login_required
def classes_page():
    user = current_user()
    classes = classes_for_user(user)
    announcements = announcements_for_user(user, 12)
    return render_template("classes.html", classes=classes, announcements=announcements)


@app.route("/quests")
@login_required
def quests_page():
    user = current_user()
    lessons = lessons_for_user(user)
    return render_template("quests.html", lessons=lessons, classes=classes_for_user(user))


@app.route("/arena")
@login_required
def arena_page():
    user = current_user()
    quizzes = quizzes_for_user(user)
    return render_template("arena.html", quizzes=quizzes, classes=classes_for_user(user))


@app.route("/leaderboard")
def leaderboard_page():
    board = leaderboard(30)
    return render_template("leaderboard.html", board=board)


@app.route("/oncs")
@login_required
def oncs_page():
    flash("Secțiunea de proiecte a fost scoasă din interfață.", "info")
    return redirect(url_for("dashboard"))


@app.route("/lab")
def lab_page():
    return render_template("lab.html")


@app.route("/pitch-timer")
def pitch_timer():
    return render_template("pitch_timer.html")


@app.route("/vault")
@login_required
def vault_page():
    user = current_user()
    snapshot = export_snapshot()
    user_project_count = len(projects_for_user(user))
    return render_template("vault.html", snapshot=snapshot, user_project_count=user_project_count)


# ---------------------------- routes: actions ---------------------------- #

@app.post("/classes/create")
@teacher_required
def create_class():
    name = request.form.get("name", "").strip()
    section = request.form.get("section", "").strip()
    description = request.form.get("description", "").strip()
    if len(name) < 3 or len(section) < 1 or len(description) < 12:
        flash("Completează corect numele, secțiunea și descrierea clasei.", "warning")
        return redirect(url_for("classes_page"))
    code = make_class_code(name, section)
    execute_db(
        "INSERT INTO classes(name, section, description, code, teacher_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (name, section, description, code, current_user()["id"], utcnow_iso()),
    )
    flash(f"Clasa a fost creată. Codul de acces este {code}.", "success")
    return redirect(url_for("classes_page"))


@app.post("/classes/join")
@login_required
def join_class():
    user = current_user()
    if user["role"] != "elev":
        flash("Doar elevii folosesc codul de înscriere în clasă.", "warning")
        return redirect(url_for("classes_page"))
    code = request.form.get("code", "").strip().upper()
    found = query_one("SELECT * FROM classes WHERE code = ?", (code,))
    if found is None:
        flash("Codul de clasă nu a fost găsit.", "danger")
    else:
        try:
            execute_db(
                "INSERT INTO enrollments(class_id, user_id, joined_at) VALUES (?, ?, ?)",
                (found["id"], user["id"], utcnow_iso()),
            )
            flash(f"Ai intrat în {found['name']} {found['section']}.", "success")
        except sqlite3.IntegrityError:
            flash("Ești deja înscris în această clasă.", "warning")
    return redirect(url_for("classes_page"))


@app.post("/classes/<int:class_id>/announce")
@teacher_required
def create_announcement(class_id: int):
    user = current_user()
    owns_class = query_one("SELECT id FROM classes WHERE id = ? AND teacher_id = ?", (class_id, user["id"]))
    if owns_class is None:
        flash("Nu poți publica anunț în această clasă.", "danger")
        return redirect(url_for("classes_page"))
    title = request.form.get("title", "").strip()
    content = request.form.get("content", "").strip()
    if len(title) < 3 or len(content) < 8:
        flash("Completează titlul și mesajul anunțului.", "warning")
    else:
        execute_db(
            "INSERT INTO announcements(class_id, teacher_id, title, content, created_at) VALUES (?, ?, ?, ?, ?)",
            (class_id, user["id"], title, content, utcnow_iso()),
        )
        flash("Anunț publicat.", "success")
    return redirect(url_for("classes_page"))


@app.post("/lessons/create")
@teacher_required
def create_lesson():
    user = current_user()
    class_id = request.form.get("class_id", "").strip()
    title = request.form.get("title", "").strip()
    summary = request.form.get("summary", "").strip()
    content = request.form.get("content", "").strip()
    xp = request.form.get("xp", "40").strip()
    difficulty = request.form.get("difficulty", "Mediu").strip()
    if not class_id.isdigit():
        flash("Alege o clasă validă.", "warning")
        return redirect(url_for("quests_page"))
    cls = query_one("SELECT * FROM classes WHERE id = ? AND teacher_id = ?", (int(class_id), user["id"]))
    if cls is None:
        flash("Nu poți adăuga lecții într-o clasă care nu îți aparține.", "danger")
        return redirect(url_for("quests_page"))
    try:
        xp_value = max(10, min(200, int(xp)))
    except ValueError:
        xp_value = 40
    if len(title) < 4 or len(summary) < 8 or len(content) < 20:
        flash("Lecția este prea scurtă. Detaliază conținutul.", "warning")
        return redirect(url_for("quests_page"))
    execute_db(
        "INSERT INTO lessons(class_id, title, summary, content, xp, difficulty, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (int(class_id), title, summary, content, xp_value, difficulty, utcnow_iso()),
    )
    flash("Lecția a fost adăugată.", "success")
    return redirect(url_for("quests_page"))


@app.post("/lessons/<int:lesson_id>/complete")
@login_required
def complete_lesson(lesson_id: int):
    user = current_user()
    lesson = query_one(
        """SELECT l.*, c.id AS class_id
           FROM lessons l
           JOIN classes c ON c.id = l.class_id
           WHERE l.id = ?""",
        (lesson_id,),
    )
    if lesson is None or lesson["class_id"] not in allowed_class_ids_for_user(user):
        flash("Lecția nu este disponibilă pentru contul tău.", "danger")
        return redirect(url_for("quests_page"))
    try:
        execute_db(
            "INSERT INTO completions(lesson_id, user_id, completed_at) VALUES (?, ?, ?)",
            (lesson_id, user["id"], utcnow_iso()),
        )
        flash(f"Lecție parcursă. +{lesson['xp']} puncte", "success")
    except sqlite3.IntegrityError:
        flash("Această lecție era deja marcată ca parcursă.", "warning")
    return redirect(url_for("quests_page"))


@app.post("/quizzes/create")
@teacher_required
def create_quiz():
    user = current_user()
    class_id = request.form.get("class_id", "").strip()
    title = request.form.get("title", "").strip()
    description = request.form.get("description", "").strip()
    difficulty = request.form.get("difficulty", "Standard").strip()
    xp = request.form.get("xp", "120").strip()
    questions_payload = request.form.get("questions_payload", "")
    if not class_id.isdigit():
        flash("Alege o clasă validă.", "warning")
        return redirect(url_for("arena_page"))
    cls = query_one("SELECT * FROM classes WHERE id = ? AND teacher_id = ?", (int(class_id), user["id"]))
    if cls is None:
        flash("Testul poate fi creat doar în clasele tale.", "danger")
        return redirect(url_for("arena_page"))
    try:
        xp_value = max(20, min(300, int(xp)))
        questions = parse_questions_payload(questions_payload)
    except (ValueError, TypeError) as exc:
        flash(str(exc), "danger")
        return redirect(url_for("arena_page"))
    execute_db(
        "INSERT INTO quizzes(class_id, title, description, xp, difficulty, questions_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (
            int(class_id),
            title,
            description or "Test nou",
            xp_value,
            difficulty,
            json.dumps(questions, ensure_ascii=False),
            utcnow_iso(),
        ),
    )
    flash("Test creat.", "success")
    return redirect(url_for("arena_page"))


@app.route("/quizzes/<int:quiz_id>/play", methods=["GET", "POST"])
@login_required
def play_quiz(quiz_id: int):
    user = current_user()
    quiz = query_one(
        """SELECT q.*, c.name AS class_name, c.section AS class_section
           FROM quizzes q
           JOIN classes c ON c.id = q.class_id
           WHERE q.id = ?""",
        (quiz_id,),
    )
    if quiz is None or quiz["class_id"] not in allowed_class_ids_for_user(user):
        flash("Testul nu este disponibil pentru contul tău.", "danger")
        return redirect(url_for("arena_page"))

    questions = json.loads(quiz["questions_json"])
    result = None

    if request.method == "POST":
        answers: dict[str, int | None] = {}
        correct_count = 0
        for idx, question in enumerate(questions):
            raw = request.form.get(f"q_{idx}")
            choice = int(raw) if raw is not None and raw.isdigit() else None
            answers[str(idx)] = choice
            if choice == question["correct"]:
                correct_count += 1
        total_count = len(questions)
        score_percent = round((correct_count / total_count) * 100, 2) if total_count else 0
        execute_db(
            "INSERT INTO attempts(quiz_id, user_id, score_percent, correct_count, total_count, answers_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                quiz_id,
                user["id"],
                score_percent,
                correct_count,
                total_count,
                json.dumps(answers, ensure_ascii=False),
                utcnow_iso(),
            ),
        )
        result = {
            "answers": answers,
            "correct_count": correct_count,
            "total_count": total_count,
            "score_percent": score_percent,
            "xp_reward": round(float(quiz["xp"]) * (score_percent / 100.0)),
        }
        flash(f"Test încheiat: {score_percent}% și +{result['xp_reward']} puncte potențiale.", "success")

    attempts = query_all(
        "SELECT * FROM attempts WHERE quiz_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 5",
        (quiz_id, user["id"]),
    )
    return render_template("quiz_take.html", quiz=quiz, questions=questions, result=result, attempts=attempts)


@app.post("/projects/create")
@login_required
def create_project():
    user = current_user()
    title = request.form.get("title", "").strip()
    acronym = request.form.get("acronym", "").strip().upper()
    team_category = request.form.get("team_category", "").strip()
    section = request.form.get("section", "").strip()
    mentor_name = request.form.get("mentor_name", "").strip()
    school_name = request.form.get("school_name", "").strip()
    member_one = request.form.get("member_one", "").strip()
    member_one_role = request.form.get("member_one_role", "").strip()
    member_two = request.form.get("member_two", "").strip()
    member_two_role = request.form.get("member_two_role", "").strip()
    problem = request.form.get("problem", "").strip()
    objectives = request.form.get("objectives", "").strip()
    methods = request.form.get("methods", "").strip()
    novelty = request.form.get("novelty", "").strip()
    results = request.form.get("results", "").strip()
    next_steps = request.form.get("next_steps", "").strip()
    started_on = request.form.get("started_on", "").strip() or date.today().isoformat()
    class_id = request.form.get("class_id", "").strip()
    class_value = int(class_id) if class_id.isdigit() else None

    if len(title) < 4 or len(acronym) < 2:
        flash("Titlul și acronimul proiectului sunt obligatorii.", "danger")
        return redirect(url_for("oncs_page"))
    if team_category not in {"Juniori", "Seniori"} or section not in {"A", "B", "C"}:
        flash("Alege categorie și secțiune valide.", "danger")
        return redirect(url_for("oncs_page"))

    execute_db(
        """INSERT INTO projects(
            owner_id, class_id, title, acronym, team_category, section, mentor_name, school_name,
            member_one, member_one_role, member_two, member_two_role, problem, objectives,
            methods, novelty, results, next_steps, started_on, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            user["id"],
            class_value,
            title,
            acronym,
            team_category,
            section,
            mentor_name,
            school_name,
            member_one,
            member_one_role,
            member_two,
            member_two_role,
            problem,
            objectives,
            methods,
            novelty,
            results,
            next_steps,
            started_on,
            utcnow_iso(),
        ),
    )
    flash("Proiectul ONCS a fost creat.", "success")
    return redirect(url_for("oncs_page"))


@app.post("/projects/<int:project_id>/update")
@login_required
def update_project(project_id: int):
    user = current_user()
    project = query_one("SELECT * FROM projects WHERE id = ?", (project_id,))
    if project is None:
        flash("Proiectul nu există.", "danger")
        return redirect(url_for("oncs_page"))
    if user["role"] == "profesor":
        allowed = project["owner_id"] == user["id"]
    else:
        allowed = project["owner_id"] == user["id"] or project["member_one"] == user["full_name"] or project["member_two"] == user["full_name"]
    if not allowed:
        flash("Nu poți modifica acest proiect.", "danger")
        return redirect(url_for("oncs_page"))

    payload = {
        "title": request.form.get("title", "").strip(),
        "acronym": request.form.get("acronym", "").strip().upper(),
        "team_category": request.form.get("team_category", "").strip(),
        "section": request.form.get("section", "").strip(),
        "mentor_name": request.form.get("mentor_name", "").strip(),
        "school_name": request.form.get("school_name", "").strip(),
        "member_one": request.form.get("member_one", "").strip(),
        "member_one_role": request.form.get("member_one_role", "").strip(),
        "member_two": request.form.get("member_two", "").strip(),
        "member_two_role": request.form.get("member_two_role", "").strip(),
        "problem": request.form.get("problem", "").strip(),
        "objectives": request.form.get("objectives", "").strip(),
        "methods": request.form.get("methods", "").strip(),
        "novelty": request.form.get("novelty", "").strip(),
        "results": request.form.get("results", "").strip(),
        "next_steps": request.form.get("next_steps", "").strip(),
        "started_on": request.form.get("started_on", "").strip() or project["started_on"],
    }
    if len(payload["title"]) < 4 or len(payload["acronym"]) < 2:
        flash("Titlul și acronimul trebuie completate.", "danger")
        return redirect(url_for("oncs_page", project=project_id))
    class_id = request.form.get("class_id", "").strip()
    class_value = int(class_id) if class_id.isdigit() else None
    execute_db(
        """UPDATE projects SET
            class_id = ?, title = ?, acronym = ?, team_category = ?, section = ?, mentor_name = ?,
            school_name = ?, member_one = ?, member_one_role = ?, member_two = ?, member_two_role = ?,
            problem = ?, objectives = ?, methods = ?, novelty = ?, results = ?, next_steps = ?,
            started_on = ?, updated_at = ?
           WHERE id = ?""",
        (
            class_value,
            payload["title"],
            payload["acronym"],
            payload["team_category"],
            payload["section"],
            payload["mentor_name"],
            payload["school_name"],
            payload["member_one"],
            payload["member_one_role"],
            payload["member_two"],
            payload["member_two_role"],
            payload["problem"],
            payload["objectives"],
            payload["methods"],
            payload["novelty"],
            payload["results"],
            payload["next_steps"],
            payload["started_on"],
            utcnow_iso(),
            project_id,
        ),
    )
    flash("Proiectul a fost actualizat.", "success")
    return redirect(url_for("oncs_page", project=project_id))


@app.route("/projects/<int:project_id>/export")
@login_required
def export_project(project_id: int):
    user = current_user()
    project = query_one(
        """SELECT p.*, c.name AS class_name, c.section AS class_section
           FROM projects p
           LEFT JOIN classes c ON c.id = p.class_id
           WHERE p.id = ?""",
        (project_id,),
    )
    if project is None:
        flash("Proiectul nu a fost găsit.", "danger")
        return redirect(url_for("oncs_page"))
    if user["role"] == "profesor":
        allowed = project["owner_id"] == user["id"]
    else:
        allowed = project["owner_id"] == user["id"] or project["member_one"] == user["full_name"] or project["member_two"] == user["full_name"]
    if not allowed:
        flash("Nu poți exporta acest proiect.", "danger")
        return redirect(url_for("oncs_page"))
    compliance = project_compliance(project)
    return render_template("project_export.html", project=project, compliance=compliance)


# ---------------------------- exports / API ---------------------------- #

@app.route("/export/json")
@login_required
def export_json():
    payload = export_snapshot()
    return Response(
        json.dumps(payload, ensure_ascii=False, indent=2),
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": 'attachment; filename="chimie-academy-clasele-vii-viii-backup.json"',
        },
    )


@app.route("/export/results.csv")
@login_required
def export_results_csv():
    user = current_user()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["quiz_id", "quiz", "student", "score_percent", "correct", "total", "created_at"])
    if user["role"] == "profesor":
        rows = query_all(
            """SELECT q.id AS quiz_id, q.title, u.full_name, a.score_percent, a.correct_count, a.total_count, a.created_at
               FROM attempts a
               JOIN quizzes q ON q.id = a.quiz_id
               JOIN users u ON u.id = a.user_id
               JOIN classes c ON c.id = q.class_id
               WHERE c.teacher_id = ?
               ORDER BY a.created_at DESC""",
            (user["id"],),
        )
    else:
        rows = query_all(
            """SELECT q.id AS quiz_id, q.title, ? AS full_name, a.score_percent, a.correct_count, a.total_count, a.created_at
               FROM attempts a
               JOIN quizzes q ON q.id = a.quiz_id
               WHERE a.user_id = ?
               ORDER BY a.created_at DESC""",
            (user["full_name"], user["id"]),
        )
    for row in rows:
        writer.writerow(
            [
                row["quiz_id"],
                row["title"],
                row["full_name"],
                row["score_percent"],
                row["correct_count"],
                row["total_count"],
                row["created_at"],
            ]
        )
    return Response(
        output.getvalue(),
        headers={
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="chimie-academy-clasele-vii-viii-results.csv"',
        },
    )


@app.route("/api/db.php", methods=["GET", "POST"])
def legacy_bridge():
    action = request.args.get("action", "").strip().lower()
    if action == "ping":
        return jsonify(
            {
                "ok": True,
                "mode": "server",
                "message": "Legacy bridge activ. Backend-ul Chimie Academy răspunde.",
                "storageWritable": True,
            }
        )
    if request.method == "GET" and action in {"", "load"}:
        return jsonify({"ok": True, "mode": "server", "db": export_snapshot()})
    if request.method == "POST" and action in {"", "save"}:
        payload = request.get_json(silent=True)
        LEGACY_IMPORT_FILE.write_text(
            json.dumps(payload or {}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return jsonify(
            {
                "ok": True,
                "mode": "server",
                "message": "Datele primite prin bridge au fost salvate ca backup JSON în instance/.",
            }
        )
    return jsonify({"ok": False, "message": "Acțiune necunoscută. Folosește ping, load sau save."}), 404


@app.route("/manifest.webmanifest")
def manifest():
    return send_from_directory(BASE_DIR / "static", "manifest.webmanifest")


@app.route("/sw.js")
def service_worker():
    return send_from_directory(BASE_DIR / "static", "sw.js")


@app.route("/healthz")
def healthz():
    return jsonify({"ok": True, "app": "Chimie Academy · Clasele VII-VIII", "db": str(DB_PATH)})


if __name__ == "__main__":
    default_host = "0.0.0.0" if os.environ.get("RENDER") else "127.0.0.1"
    default_port = "10000" if os.environ.get("RENDER") else "8000"
    host = os.environ.get("HOST", default_host)
    port = int(os.environ.get("PORT", default_port))
    app.run(host=host, port=port, debug=False)
