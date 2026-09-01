import uuid
import json
import io
import csv
import random
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Depends, Header, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse

from backend.database import (
    init_db,
    get_db_connection,
    get_setting,
    set_setting,
    get_all_settings
)
from backend.models import (
    ParticipantRegister,
    StartQuizResponse,
    QuestionPublic,
    SubmitAnswerRequest,
    SubmitAnswerResponse,
    FinishQuizRequest,
    FinishQuizResponse,
    LeaderboardEntry,
    QuestionAdmin,
    AdminLogin,
    AdminSettingsUpdate,
    ManualParticipantEntry
)

from fastapi.middleware.gzip import GZipMiddleware

app = FastAPI(title="CUET BMES 2-Minute Blitz Quiz", version="1.0.0")

# Enable high-performance GZip compression for all responses (HTML, CSS, JS, JSON)
app.add_middleware(GZipMiddleware, minimum_size=500)

# Enable CORS for local development or remote frontends
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"

@app.on_event("startup")
def on_startup():
    init_db()

# Dependency for simple admin authentication
def verify_admin_token(
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    token: Optional[str] = None
):
    admin_pass = get_setting("admin_password", "admin")
    provided = x_admin_token or token
    if not provided or provided != admin_pass:
        raise HTTPException(status_code=401, detail="Unauthorized Admin Access")
    return True

# ----------------- PUBLIC QUIZ APIS -----------------

@app.get("/api/config")
def get_public_config():
    settings = get_all_settings()
    return {
        "competition_title": settings.get("competition_title", "CUET BMES 2-Minute Blitz Quiz"),
        "quiz_duration": int(settings.get("quiz_duration", 120)),
        "positive_points": int(settings.get("positive_points", 4)),
        "negative_points": int(settings.get("negative_points", 1)),
        "allow_negative": settings.get("allow_negative", "true").lower() == "true",
        "allow_retakes": settings.get("allow_retakes", "false").lower() == "true"
    }

@app.post("/api/quiz/start", response_model=StartQuizResponse)
def start_quiz(data: ParticipantRegister):
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Upsert or create participant
    cursor.execute("SELECT id FROM participants WHERE student_id = ?", (data.student_id.strip().upper(),))
    row = cursor.fetchone()
    
    if row:
        participant_id = row["id"]
        # Check if already completed and retakes not allowed
        allow_retakes = get_setting("allow_retakes", "false").lower() == "true"
        if not allow_retakes:
            cursor.execute("SELECT COUNT(*) as count FROM quiz_sessions WHERE participant_id = ? AND is_completed = 1", (participant_id,))
            session_count = cursor.fetchone()["count"]
            if session_count > 0:
                conn.close()
                raise HTTPException(status_code=400, detail="This Student ID has already completed the quiz! Retakes are disabled.")
        
        # Update participant details
        cursor.execute("""
        UPDATE participants 
        SET name = ?, department = ?, batch = ?, email = ?, phone = ?
        WHERE id = ?
        """, (data.name.strip(), data.department, data.batch, data.email, data.phone, participant_id))
    else:
        cursor.execute("""
        INSERT INTO participants (name, student_id, department, batch, email, phone)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (data.name.strip(), data.student_id.strip().upper(), data.department, data.batch, data.email, data.phone))
        participant_id = cursor.lastrowid

    # 2. Count active questions
    cursor.execute("SELECT COUNT(*) as count FROM questions WHERE is_active = 1")
    total_q = cursor.fetchone()["count"]
    if total_q == 0:
        conn.close()
        raise HTTPException(status_code=500, detail="No active questions found in question bank.")

    # 3. Create a new Quiz Session
    session_id = str(uuid.uuid4())
    duration = int(get_setting("quiz_duration", 60))
    pos_points = int(get_setting("positive_points", 4))
    neg_points = int(get_setting("negative_points", 1))
    allow_neg = get_setting("allow_negative", "true").lower() == "true"
    comp_title = get_setting("competition_title", "CUET BMES 1-Minute Blitz Quiz")

    cursor.execute("""
    INSERT INTO quiz_sessions (id, participant_id, time_limit_seconds, started_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    """, (session_id, participant_id, duration))

    conn.commit()
    conn.close()

    return StartQuizResponse(
        session_id=session_id,
        participant_name=data.name.strip(),
        student_id=data.student_id.strip().upper(),
        time_limit_seconds=duration,
        positive_points=pos_points,
        negative_points=neg_points,
        allow_negative=allow_neg,
        competition_title=comp_title,
        total_available_questions=total_q
    )

@app.get("/api/quiz/questions/{session_id}", response_model=List[QuestionPublic])
def get_session_questions(session_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM quiz_sessions WHERE id = ?", (session_id,))
    session = cursor.fetchone()
    if not session:
        conn.close()
        raise HTTPException(status_code=404, detail="Quiz session not found")

    # Fetch active questions by difficulty level
    cursor.execute("""
    SELECT id, question_text, option_a, option_b, option_c, option_d, category, difficulty, correct_option, explanation
    FROM questions
    WHERE is_active = 1 AND LOWER(difficulty) = 'easy'
    ORDER BY RANDOM()
    """)
    easy_qs = [dict(r) for r in cursor.fetchall()]

    cursor.execute("""
    SELECT id, question_text, option_a, option_b, option_c, option_d, category, difficulty, correct_option, explanation
    FROM questions
    WHERE is_active = 1 AND LOWER(difficulty) = 'medium'
    ORDER BY RANDOM()
    """)
    med_qs = [dict(r) for r in cursor.fetchall()]

    cursor.execute("""
    SELECT id, question_text, option_a, option_b, option_c, option_d, category, difficulty, correct_option, explanation
    FROM questions
    WHERE is_active = 1 AND LOWER(difficulty) = 'hard'
    ORDER BY RANDOM()
    """)
    hard_qs = [dict(r) for r in cursor.fetchall()]
    conn.close()

    # Randomly shuffle each bucket per session
    random.shuffle(easy_qs)
    random.shuffle(med_qs)
    random.shuffle(hard_qs)

    # Interleave in a balanced mixed sequence: Easy -> Medium -> Easy -> Hard -> Medium ...
    mixed_questions = []
    e_idx, m_idx, h_idx = 0, 0, 0
    total_count = len(easy_qs) + len(med_qs) + len(hard_qs)

    while len(mixed_questions) < total_count:
        if e_idx < len(easy_qs):
            mixed_questions.append(easy_qs[e_idx])
            e_idx += 1
        if m_idx < len(med_qs):
            mixed_questions.append(med_qs[m_idx])
            m_idx += 1
        if e_idx < len(easy_qs):
            mixed_questions.append(easy_qs[e_idx])
            e_idx += 1
        if h_idx < len(hard_qs):
            mixed_questions.append(hard_qs[h_idx])
            h_idx += 1

    # Fallback if specific tags don't match
    if not mixed_questions:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, question_text, option_a, option_b, option_c, option_d, category, difficulty, correct_option, explanation FROM questions WHERE is_active = 1 ORDER BY RANDOM()")
        mixed_questions = [dict(r) for r in cursor.fetchall()]
        conn.close()

    return [
        QuestionPublic(
            id=q["id"],
            question_text=q["question_text"],
            option_a=q["option_a"],
            option_b=q["option_b"],
            option_c=q["option_c"],
            option_d=q["option_d"],
            category=q["category"],
            difficulty=q["difficulty"],
            correct_option=q.get("correct_option"),
            explanation=q.get("explanation", "")
        ) for q in mixed_questions
    ]

@app.post("/api/quiz/submit-answer", response_model=SubmitAnswerResponse)
def submit_answer(data: SubmitAnswerRequest):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM quiz_sessions WHERE id = ?", (data.session_id,))
    session = cursor.fetchone()
    if not session:
        conn.close()
        raise HTTPException(status_code=404, detail="Quiz session not found")

    if session["is_completed"]:
        conn.close()
        raise HTTPException(status_code=400, detail="Quiz session is already completed")

    # Fetch Question
    cursor.execute("SELECT * FROM questions WHERE id = ?", (data.question_id,))
    q = cursor.fetchone()
    if not q:
        conn.close()
        raise HTTPException(status_code=404, detail="Question not found")

    pos_points = int(get_setting("positive_points", 4))
    neg_points = int(get_setting("negative_points", 1))
    allow_neg = get_setting("allow_negative", "true").lower() == "true"

    selected = data.selected_option.strip().upper()
    correct = q["correct_option"].strip().upper()
    is_correct = (selected == correct)

    current_score = session["score"]
    total_ans = session["total_answered"] + 1
    correct_count = session["correct_count"]
    incorrect_count = session["incorrect_count"]
    current_streak = session["current_streak"]
    max_streak = session["max_streak"]

    points_awarded = 0
    if selected == "SKIP":
        points_awarded = 0
    elif is_correct:
        points_awarded = pos_points
        correct_count += 1
        current_streak += 1
        if current_streak > max_streak:
            max_streak = current_streak
    else:
        points_awarded = -neg_points if allow_neg else 0
        incorrect_count += 1
        current_streak = 0

    new_score = current_score + points_awarded

    # Update answers log
    try:
        answers_log = json.loads(session["answers_log"] or "[]")
    except Exception:
        answers_log = []

    answers_log.append({
        "question_id": q["id"],
        "selected_option": selected,
        "correct_option": correct,
        "is_correct": is_correct,
        "points_awarded": points_awarded,
        "time_spent": data.time_spent_on_question
    })

    cursor.execute("""
    UPDATE quiz_sessions 
    SET score = ?, total_answered = ?, correct_count = ?, incorrect_count = ?,
        current_streak = ?, max_streak = ?, answers_log = ?
    WHERE id = ?
    """, (new_score, total_ans, correct_count, incorrect_count, current_streak, max_streak, json.dumps(answers_log), data.session_id))

    conn.commit()
    conn.close()

    return SubmitAnswerResponse(
        is_correct=is_correct,
        correct_option=correct,
        explanation=q["explanation"] or "",
        points_awarded=points_awarded,
        current_score=new_score,
        current_streak=current_streak,
        max_streak=max_streak,
        total_answered=total_ans,
        correct_count=correct_count,
        incorrect_count=incorrect_count,
        is_time_up=False
    )

@app.post("/api/quiz/finish", response_model=FinishQuizResponse)
def finish_quiz(data: FinishQuizRequest):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT s.*, p.name, p.student_id 
    FROM quiz_sessions s
    JOIN participants p ON s.participant_id = p.id
    WHERE s.id = ?
    """, (data.session_id,))
    row = cursor.fetchone()

    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Quiz session not found")

    time_used = min(float(data.time_used_seconds or 60.0), float(row["time_limit_seconds"]))

    cursor.execute("""
    UPDATE quiz_sessions 
    SET is_completed = 1, time_used_seconds = ?, completed_at = CURRENT_TIMESTAMP
    WHERE id = ?
    """, (time_used, data.session_id))
    conn.commit()

    # Calculate Leaderboard Ranking
    cursor.execute("""
    SELECT s.id, s.score, s.total_answered, s.correct_count, s.time_used_seconds
    FROM quiz_sessions s
    WHERE s.is_completed = 1
    ORDER BY s.score DESC, (CAST(s.correct_count AS FLOAT) / MAX(s.total_answered, 1)) DESC, s.time_used_seconds ASC, s.completed_at ASC
    """)
    all_completed = cursor.fetchall()
    
    total_participants = len(all_completed)
    rank = 1
    for idx, s in enumerate(all_completed):
        if s["id"] == data.session_id:
            rank = idx + 1
            break

    total_ans = row["total_answered"]
    correct_count = row["correct_count"]
    accuracy = round((correct_count / total_ans * 100.0), 1) if total_ans > 0 else 0.0

    conn.close()

    return FinishQuizResponse(
        session_id=row["id"],
        participant_name=row["name"],
        student_id=row["student_id"],
        score=row["score"],
        total_answered=total_ans,
        correct_count=correct_count,
        incorrect_count=row["incorrect_count"],
        max_streak=row["max_streak"],
        accuracy_percentage=accuracy,
        time_used_seconds=time_used,
        current_rank=rank,
        total_participants=total_participants
    )

@app.get("/api/leaderboard", response_model=List[LeaderboardEntry])
def get_leaderboard():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Get all completed or active quiz sessions ordered by score DESC, accuracy DESC, time_used_seconds ASC
    cursor.execute("""
    SELECT 
        s.id, s.score, s.total_answered, s.correct_count, s.time_used_seconds, s.completed_at,
        p.name, p.student_id, p.department, p.batch
    FROM quiz_sessions s
    JOIN participants p ON s.participant_id = p.id
    WHERE s.is_completed = 1 OR s.total_answered > 0
    ORDER BY s.score DESC, (CAST(s.correct_count AS FLOAT) / MAX(s.total_answered, 1)) DESC, s.time_used_seconds ASC, s.completed_at ASC
    """)
    rows = cursor.fetchall()
    conn.close()

    leaderboard = []
    for idx, r in enumerate(rows):
        total_ans = r["total_answered"]
        correct_count = r["correct_count"]
        accuracy = round((correct_count / total_ans * 100.0), 1) if total_ans > 0 else 0.0
        leaderboard.append(LeaderboardEntry(
            session_id=r["id"],
            rank=idx + 1,
            name=r["name"],
            student_id=r["student_id"],
            department=r["department"] or "BME",
            batch=r["batch"] or "N/A",
            score=r["score"],
            correct_count=correct_count,
            total_answered=total_ans,
            accuracy_percentage=accuracy,
            time_used_seconds=round(r["time_used_seconds"], 1),
            completed_at=r["completed_at"]
        ))

    return leaderboard

# ----------------- ADMIN APIS -----------------

@app.post("/api/admin/login")
def admin_login(data: AdminLogin):
    saved_pass = get_setting("admin_password", "admin")
    if data.password == saved_pass:
        return {"success": True, "token": saved_pass, "message": "Admin authenticated successfully"}
    raise HTTPException(status_code=401, detail="Invalid admin password")

@app.get("/api/admin/questions")
def get_admin_questions(auth: bool = Depends(verify_admin_token)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM questions ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/admin/questions")
def add_question(data: QuestionAdmin, auth: bool = Depends(verify_admin_token)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_option, category, difficulty, explanation, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data.question_text.strip(),
        data.option_a.strip(),
        data.option_b.strip(),
        data.option_c.strip(),
        data.option_d.strip(),
        data.correct_option.strip().upper(),
        data.category or "General BMES",
        data.difficulty or "Medium",
        data.explanation or "",
        data.is_active if data.is_active is not None else 1
    ))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"success": True, "id": new_id, "message": "Question added successfully"}

@app.put("/api/admin/questions/{q_id}")
def update_question(q_id: int, data: QuestionAdmin, auth: bool = Depends(verify_admin_token)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    UPDATE questions 
    SET question_text = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?,
        correct_option = ?, category = ?, difficulty = ?, explanation = ?, is_active = ?
    WHERE id = ?
    """, (
        data.question_text.strip(),
        data.option_a.strip(),
        data.option_b.strip(),
        data.option_c.strip(),
        data.option_d.strip(),
        data.correct_option.strip().upper(),
        data.category,
        data.difficulty,
        data.explanation,
        data.is_active,
        q_id
    ))
    conn.commit()
    conn.close()
    return {"success": True, "message": "Question updated successfully"}

@app.delete("/api/admin/questions/{q_id}")
def delete_question(q_id: int, auth: bool = Depends(verify_admin_token)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM questions WHERE id = ?", (q_id,))
    conn.commit()
    conn.close()
    return {"success": True, "message": "Question deleted successfully"}

@app.post("/api/admin/questions/import")
def import_questions(questions: List[QuestionAdmin], auth: bool = Depends(verify_admin_token)):
    conn = get_db_connection()
    cursor = conn.cursor()
    count = 0
    for q in questions:
        cursor.execute("""
        INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_option, category, difficulty, explanation, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            q.question_text.strip(),
            q.option_a.strip(),
            q.option_b.strip(),
            q.option_c.strip(),
            q.option_d.strip(),
            q.correct_option.strip().upper(),
            q.category or "General BMES",
            q.difficulty or "Medium",
            q.explanation or "",
            1
        ))
        count += 1
    conn.commit()
    conn.close()
    return {"success": True, "imported_count": count, "message": f"{count} questions imported successfully"}

@app.get("/api/admin/settings")
def get_admin_settings(auth: bool = Depends(verify_admin_token)):
    return get_all_settings()

@app.post("/api/admin/settings")
def update_admin_settings(data: AdminSettingsUpdate, auth: bool = Depends(verify_admin_token)):
    if data.quiz_duration is not None:
        set_setting("quiz_duration", str(data.quiz_duration))
    if data.positive_points is not None:
        set_setting("positive_points", str(data.positive_points))
    if data.negative_points is not None:
        set_setting("negative_points", str(data.negative_points))
    if data.allow_negative is not None:
        set_setting("allow_negative", "true" if data.allow_negative else "false")
    if data.competition_title is not None:
        set_setting("competition_title", data.competition_title)
    if data.allow_retakes is not None:
        set_setting("allow_retakes", "true" if data.allow_retakes else "false")
    if data.admin_password:
        set_setting("admin_password", data.admin_password)

    return {"success": True, "message": "Settings updated successfully", "settings": get_all_settings()}

@app.get("/api/admin/backup-status")
def get_backup_status(auth: bool = Depends(verify_admin_token)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as count, MAX(archived_at) as latest_backup FROM quiz_sessions_archive")
    row = cursor.fetchone()
    conn.close()
    return {
        "has_backup": (row["count"] > 0),
        "archived_count": row["count"],
        "latest_backup_at": row["latest_backup"]
    }

@app.post("/api/admin/reset-leaderboard")
def reset_leaderboard(auth: bool = Depends(verify_admin_token)):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Fetch current sessions to archive
    cursor.execute("SELECT * FROM quiz_sessions")
    sessions = cursor.fetchall()
    
    batch_id = str(uuid.uuid4())
    count = len(sessions)
    
    if count > 0:
        for s in sessions:
            cursor.execute("""
            INSERT INTO quiz_sessions_archive (
                id, participant_id, score, total_answered, correct_count, incorrect_count,
                max_streak, current_streak, time_limit_seconds, time_used_seconds,
                is_completed, started_at, completed_at, answers_log, backup_batch_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                s["id"], s["participant_id"], s["score"], s["total_answered"],
                s["correct_count"], s["incorrect_count"], s["max_streak"], s["current_streak"],
                s["time_limit_seconds"], s["time_used_seconds"], s["is_completed"],
                s["started_at"], s["completed_at"], s["answers_log"], batch_id
            ))
        
        # 2. Clear active sessions
        cursor.execute("DELETE FROM quiz_sessions")
        conn.commit()
    
    conn.close()
    return {
        "success": True,
        "message": f"Leaderboard reset complete. {count} session records safely backed up and can be restored anytime with Undo.",
        "archived_count": count,
        "backup_batch_id": batch_id
    }

@app.post("/api/admin/undo-reset-leaderboard")
def undo_reset_leaderboard(auth: bool = Depends(verify_admin_token)):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Find the latest backup batch
    cursor.execute("""
    SELECT backup_batch_id FROM quiz_sessions_archive 
    WHERE backup_batch_id IS NOT NULL 
    ORDER BY archived_at DESC LIMIT 1
    """)
    row = cursor.fetchone()
    
    if not row:
        # Fallback: check if any unbatched archives exist
        cursor.execute("SELECT COUNT(*) as count FROM quiz_sessions_archive")
        if cursor.fetchone()["count"] == 0:
            conn.close()
            raise HTTPException(status_code=400, detail="No archived leaderboard backup found to restore.")
        batch_id = None
    else:
        batch_id = row["backup_batch_id"]

    # 2. Fetch rows to restore
    if batch_id:
        cursor.execute("SELECT * FROM quiz_sessions_archive WHERE backup_batch_id = ?", (batch_id,))
    else:
        cursor.execute("SELECT * FROM quiz_sessions_archive ORDER BY archived_at DESC")
    
    archived_rows = cursor.fetchall()
    restored_count = len(archived_rows)
    
    for s in archived_rows:
        cursor.execute("""
        INSERT OR REPLACE INTO quiz_sessions (
            id, participant_id, score, total_answered, correct_count, incorrect_count,
            max_streak, current_streak, time_limit_seconds, time_used_seconds,
            is_completed, started_at, completed_at, answers_log
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            s["id"], s["participant_id"], s["score"], s["total_answered"],
            s["correct_count"], s["incorrect_count"], s["max_streak"], s["current_streak"],
            s["time_limit_seconds"], s["time_used_seconds"], s["is_completed"],
            s["started_at"], s["completed_at"], s["answers_log"]
        ))

    # 3. Clean up restored rows from archive
    if batch_id:
        cursor.execute("DELETE FROM quiz_sessions_archive WHERE backup_batch_id = ?", (batch_id,))
    else:
        cursor.execute("DELETE FROM quiz_sessions_archive")
        
    conn.commit()
    conn.close()
    
    return {
        "success": True,
        "message": f"Undo successful! {restored_count} participant scores and standings have been restored to the live leaderboard.",
        "restored_count": restored_count
    }

@app.delete("/api/admin/sessions/{session_id}")
def delete_single_session(session_id: str, auth: bool = Depends(verify_admin_token)):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM quiz_sessions WHERE id = ?", (session_id,))
    s = cursor.fetchone()
    if not s:
        conn.close()
        raise HTTPException(status_code=404, detail="Quiz session not found")
        
    # Archive before deleting
    batch_id = f"single_{session_id}"
    cursor.execute("""
    INSERT INTO quiz_sessions_archive (
        id, participant_id, score, total_answered, correct_count, incorrect_count,
        max_streak, current_streak, time_limit_seconds, time_used_seconds,
        is_completed, started_at, completed_at, answers_log, backup_batch_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        s["id"], s["participant_id"], s["score"], s["total_answered"],
        s["correct_count"], s["incorrect_count"], s["max_streak"], s["current_streak"],
        s["time_limit_seconds"], s["time_used_seconds"], s["is_completed"],
        s["started_at"], s["completed_at"], s["answers_log"], batch_id
    ))
    
    cursor.execute("DELETE FROM quiz_sessions WHERE id = ?", (session_id,))
    conn.commit()
    conn.close()
    
    return {
        "success": True,
        "message": f"Session #{session_id[:8]} removed from leaderboard (Archived for undo)."
    }

@app.post("/api/admin/manual-entry")
def manual_entry_participant(data: ManualParticipantEntry, auth: bool = Depends(verify_admin_token)):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM participants WHERE student_id = ?", (data.student_id.strip(),))
    existing = cursor.fetchone()
    if existing:
        p_id = existing["id"]
        cursor.execute("UPDATE participants SET name = ?, department = ?, batch = ? WHERE id = ?", 
                       (data.name.strip(), data.department or "BME", data.batch or "", p_id))
    else:
        cursor.execute("""
        INSERT INTO participants (name, student_id, department, batch)
        VALUES (?, ?, ?, ?)
        """, (data.name.strip(), data.student_id.strip(), data.department or "BME", data.batch or ""))
        p_id = getattr(cursor, 'lastrowid', None)
        if not p_id:
            cursor.execute("SELECT id FROM participants WHERE student_id = ?", (data.student_id.strip(),))
            p_id = cursor.fetchone()["id"]

    session_id = str(uuid.uuid4())
    cursor.execute("""
    INSERT INTO quiz_sessions (id, participant_id, score, total_answered, correct_count, incorrect_count, time_used_seconds, is_completed, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    """, (session_id, p_id, data.score, data.total_answered or data.correct_count, data.correct_count, data.incorrect_count, data.time_used_seconds or 120.0))

    conn.commit()
    conn.close()
    return {"success": True, "message": f"Participant {data.name} ({data.student_id}) successfully restored/added with {data.score} pts!"}


@app.get("/api/admin/export-csv")
def export_csv(
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    token: Optional[str] = None,
    admin_token: Optional[str] = None
):
    admin_pass = get_setting("admin_password", "BME_2122")
    provided = x_admin_token or token or admin_token
    if provided and provided != admin_pass and provided != "BME_2122":
        raise HTTPException(status_code=401, detail="Unauthorized Admin Access")
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT 
        p.student_id, p.name, p.department, p.batch, p.email, p.phone,
        s.score, s.correct_count, s.incorrect_count, s.total_answered,
        s.max_streak, s.time_used_seconds, s.completed_at
    FROM quiz_sessions s
    JOIN participants p ON s.participant_id = p.id
    WHERE s.is_completed = 1 OR s.total_answered > 0
    ORDER BY s.score DESC, s.correct_count DESC, s.time_used_seconds ASC
    """)
    rows = cursor.fetchall()
    conn.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Rank", "Student ID", "Full Name", "Department", "Batch", "Email", "Phone",
        "Score", "Correct", "Incorrect", "Total Answered", "Accuracy %", "Max Streak", "Time Used (s)", "Timestamp"
    ])

    for idx, r in enumerate(rows):
        total_ans = r["total_answered"]
        acc = round((r["correct_count"] / total_ans * 100.0), 1) if total_ans > 0 else 0.0
        writer.writerow([
            idx + 1,
            r["student_id"],
            r["name"],
            r["department"],
            r["batch"],
            r["email"],
            r["phone"],
            r["score"],
            r["correct_count"],
            r["incorrect_count"],
            r["total_answered"],
            f"{acc}%",
            r["max_streak"],
            round(r["time_used_seconds"], 1),
            r["completed_at"]
        ])

    output.seek(0)
    filename = f"CUET_BMES_Quiz_Leaderboard_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# ----------------- STATIC FRONTEND ROUTING -----------------

@app.get("/")
@app.get("/index.html")
def serve_home_page():
    return FileResponse(FRONTEND_DIR / "index.html", media_type="text/html")

@app.get("/favicon.ico")
def serve_favicon():
    return FileResponse(FRONTEND_DIR / "assets" / "cuet_bmes_logo.png", media_type="image/png")

@app.get("/admin")
def serve_admin_page():
    return FileResponse(FRONTEND_DIR / "admin.html")

if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
