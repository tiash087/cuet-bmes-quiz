"""
Verification Test Script for CUET BMES Quiz Competition APIs
"""
import sys
import os

# Set UTF-8 stdout encoding for Windows console compatibility
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from backend.app import app
from backend.database import init_db

def run_tests():
    print("[*] Initializing Database...")
    init_db()

    client = TestClient(app)

    print("\n--- 1. Testing Config Endpoint ---")
    res = client.get("/api/config")
    assert res.status_code == 200, f"Config failed: {res.text}"
    config = res.json()
    print("[PASS] Config:", config)
    assert config["quiz_duration"] == 60
    assert config["positive_points"] == 4

    print("\n--- 2. Testing Participant Registration & Quiz Start ---")
    import time
    test_id = f"1908{int(time.time()) % 1000:03d}"
    reg_payload = {
        "name": "Nafis Fuad",
        "student_id": test_id,
        "department": "BME",
        "batch": "'19",
        "email": f"u{test_id}@student.cuet.ac.bd",
        "phone": "01711223344"
    }
    res = client.post("/api/quiz/start", json=reg_payload)
    assert res.status_code == 200, f"Start failed: {res.text}"
    session_data = res.json()
    session_id = session_data["session_id"]
    print("[PASS] Quiz Session Created:", session_id)
    assert session_data["participant_name"] == "Nafis Fuad"
    assert session_data["total_available_questions"] >= 20

    print("\n--- 3. Testing Randomized Question Fetching ---")
    res = client.get(f"/api/quiz/questions/{session_id}")
    assert res.status_code == 200, f"Get questions failed: {res.text}"
    questions = res.json()
    print(f"[PASS] Fetched {len(questions)} randomized questions.")
    first_q = questions[0]
    print("Sample Q:", first_q["question_text"])
    assert "option_a" in first_q
    assert "correct_option" not in first_q # Verify answers are NOT leaked to client!

    print("\n--- 4. Testing Answer Submission & Real-time Scoring ---")
    # Submit Answer 1
    sub1 = {
        "session_id": session_id,
        "question_id": first_q["id"],
        "selected_option": "A",
        "time_spent_on_question": 2.5
    }
    res = client.post("/api/quiz/submit-answer", json=sub1)
    assert res.status_code == 200, f"Submit answer failed: {res.text}"
    ans_res = res.json()
    print("[PASS] Answer submitted. Score:", ans_res["current_score"], "| Correct:", ans_res["is_correct"])

    # Submit Answer 2
    if len(questions) > 1:
        second_q = questions[1]
        sub2 = {
            "session_id": session_id,
            "question_id": second_q["id"],
            "selected_option": "B",
            "time_spent_on_question": 1.8
        }
        res = client.post("/api/quiz/submit-answer", json=sub2)
        assert res.status_code == 200
        print("[PASS] Second answer submitted. Total Answered:", res.json()["total_answered"])

    print("\n--- 5. Testing Quiz Completion & Final Ranking ---")
    fin_req = {
        "session_id": session_id,
        "time_used_seconds": 58.4
    }
    res = client.post("/api/quiz/finish", json=fin_req)
    assert res.status_code == 200, f"Finish failed: {res.text}"
    fin_res = res.json()
    print("[PASS] Quiz Finished! Rank:", fin_res["current_rank"], "| Score:", fin_res["score"], "| Accuracy:", fin_res["accuracy_percentage"], "%")

    print("\n--- 6. Testing Leaderboard Retrieval ---")
    res = client.get("/api/leaderboard")
    assert res.status_code == 200, f"Leaderboard failed: {res.text}"
    board = res.json()
    print(f"[PASS] Leaderboard fetched. Top count: {len(board)}")
    assert len(board) >= 1
    top_entry = board[0]
    print(f"[PASS] Rank #1: {top_entry['name']} ({top_entry['student_id']}) - {top_entry['score']} pts")

    print("\n--- 7. Testing Admin Authentication & CRUD ---")
    # Login
    res = client.post("/api/admin/login", json={"password": "admin"})
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    admin_token = res.json()["token"]
    print("[PASS] Admin authenticated.")

    # Add Question
    new_q = {
        "question_text": "What is the primary frequency of human alpha brain waves in EEG?",
        "option_a": "0.5 - 4 Hz (Delta)",
        "option_b": "4 - 8 Hz (Theta)",
        "option_c": "8 - 13 Hz (Alpha)",
        "option_d": "14 - 30 Hz (Beta)",
        "correct_option": "C",
        "category": "Biomedical Signals",
        "difficulty": "Medium",
        "explanation": "Alpha waves range from 8 to 13 Hz and dominate in relaxed, eyes-closed states."
    }
    res = client.post("/api/admin/questions", json=new_q, headers={"X-Admin-Token": admin_token})
    assert res.status_code == 200, f"Add question failed: {res.text}"
    created_q_id = res.json()["id"]
    print(f"[PASS] Admin added new question with ID #{created_q_id}")

    # Delete Question
    res = client.delete(f"/api/admin/questions/{created_q_id}", headers={"X-Admin-Token": admin_token})
    assert res.status_code == 200
    print("[PASS] Admin deleted question successfully.")

    # Export CSV
    res = client.get("/api/admin/export-csv", headers={"X-Admin-Token": admin_token})
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    print("[PASS] Export CSV generated successfully. Size:", len(res.content), "bytes.")

    print("\n========================================================")
    print("ALL TESTS PASSED SUCCESSFULLY! The CUET BMES Quiz app is fully functional.")
    print("========================================================")

if __name__ == "__main__":
    run_tests()
