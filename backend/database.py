import sqlite3
import json
import os
import random
from pathlib import Path
from backend.sample_questions import SAMPLE_QUESTIONS

DB_PATH = Path(__file__).parent.parent / "quiz.db"

def get_db_connection():
    db_url = os.environ.get("DATABASE_URL")
    if db_url and ("postgres://" in db_url or "postgresql://" in db_url):
        import psycopg2
        from psycopg2.extras import RealDictCursor
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql://", 1)
        conn = psycopg2.connect(db_url, sslmode="require")
        return conn
    else:
        conn = sqlite3.connect(DB_PATH, timeout=15.0, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        conn.execute("PRAGMA cache_size=10000;")
        conn.execute("PRAGMA busy_timeout=5000;")
        return conn

def init_db(force_reseed: bool = False):
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Questions Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question_text TEXT NOT NULL,
        option_a TEXT NOT NULL,
        option_b TEXT NOT NULL,
        option_c TEXT NOT NULL,
        option_d TEXT NOT NULL,
        correct_option TEXT NOT NULL, -- 'A', 'B', 'C', or 'D'
        category TEXT DEFAULT 'General BMES',
        difficulty TEXT DEFAULT 'Medium',
        explanation TEXT DEFAULT '',
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_questions_active ON questions(is_active, difficulty)")

    # 2. Participants Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        student_id TEXT UNIQUE NOT NULL,
        department TEXT DEFAULT 'BME',
        batch TEXT DEFAULT '',
        email TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_participants_student_id ON participants(student_id)")

    # 3. Quiz Sessions Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS quiz_sessions (
        id TEXT PRIMARY KEY,
        participant_id INTEGER NOT NULL,
        score INTEGER DEFAULT 0,
        total_answered INTEGER DEFAULT 0,
        correct_count INTEGER DEFAULT 0,
        incorrect_count INTEGER DEFAULT 0,
        max_streak INTEGER DEFAULT 0,
        current_streak INTEGER DEFAULT 0,
        time_limit_seconds INTEGER DEFAULT 120,
        time_used_seconds REAL DEFAULT 0,
        is_completed INTEGER DEFAULT 0,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        answers_log TEXT DEFAULT '[]',
        FOREIGN KEY(participant_id) REFERENCES participants(id)
    )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_completed_score ON quiz_sessions(is_completed, score DESC, correct_count DESC, time_used_seconds ASC)")

    # 3b. Quiz Sessions Archive Table (For Safe Wipe & Undo / Restore)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS quiz_sessions_archive (
        id TEXT,
        participant_id INTEGER,
        score INTEGER,
        total_answered INTEGER,
        correct_count INTEGER,
        incorrect_count INTEGER,
        max_streak INTEGER,
        current_streak INTEGER,
        time_limit_seconds INTEGER,
        time_used_seconds REAL,
        is_completed INTEGER,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        answers_log TEXT,
        archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        backup_batch_id TEXT
    )
    """)

    # 4. Settings Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )
    """)

    # Seed default settings if not present
    default_settings = {
        "admin_password": "BME_2122",
        "quiz_duration": "150",
        "positive_points": "4",
        "negative_points": "1",
        "allow_negative": "true",
        "competition_title": "CUET BMES 2.5-Minute Blitz Quiz",
        "allow_retakes": "false"
    }

    for key, value in default_settings.items():
        cursor.execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", (key, value))

    if force_reseed:
        cursor.execute("DELETE FROM questions")

    # Seed or synchronize questions
    cursor.execute("SELECT COUNT(*) as count FROM questions")
    count = cursor.fetchone()["count"]
    
    if count == 0 or force_reseed:
        for q in SAMPLE_QUESTIONS:
            # Randomize option placement for natural A, B, C, D spread
            opts = [
                ("A", q["option_a"]),
                ("B", q["option_b"]),
                ("C", q["option_c"]),
                ("D", q["option_d"])
            ]
            correct_val = dict(opts)[q["correct_option"]]
            
            # Shuffle options
            val_list = [opt[1] for opt in opts]
            random.shuffle(val_list)
            
            new_correct_opt = "A"
            for idx, key in enumerate(["A", "B", "C", "D"]):
                if val_list[idx] == correct_val:
                    new_correct_opt = key
                    break
            
            cursor.execute("""
            INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_option, category, difficulty, explanation)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                q["question_text"],
                val_list[0],
                val_list[1],
                val_list[2],
                val_list[3],
                new_correct_opt,
                q.get("category", "General BMES"),
                q.get("difficulty", "Medium"),
                q.get("explanation", "")
            ))

    conn.commit()
    conn.close()

def get_setting(key: str, default: str = "") -> str:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM settings WHERE key = ?", (key,))
    row = cursor.fetchone()
    conn.close()
    return row["value"] if row else default

def set_setting(key: str, value: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, str(value)))
    conn.commit()
    conn.close()

def get_all_settings() -> dict:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM settings")
    rows = cursor.fetchall()
    conn.close()
    return {row["key"]: row["value"] for row in rows}
