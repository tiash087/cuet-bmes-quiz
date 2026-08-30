from pydantic import BaseModel, Field
from typing import Optional, List, Any

class ParticipantRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    student_id: str = Field(..., min_length=3, max_length=50)
    department: Optional[str] = "BME"
    batch: Optional[str] = ""
    email: Optional[str] = ""
    phone: Optional[str] = ""

class QuestionPublic(BaseModel):
    id: int
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    category: str
    difficulty: str
    correct_option: Optional[str] = None
    explanation: Optional[str] = ""

class StartQuizResponse(BaseModel):
    session_id: str
    participant_name: str
    student_id: str
    time_limit_seconds: int
    positive_points: int
    negative_points: int
    allow_negative: bool
    competition_title: str
    total_available_questions: int

class SubmitAnswerRequest(BaseModel):
    session_id: str
    question_id: int
    selected_option: str # 'A', 'B', 'C', 'D', 'SKIP'
    time_spent_on_question: Optional[float] = 0.0

class SubmitAnswerResponse(BaseModel):
    is_correct: bool
    correct_option: str
    explanation: str
    points_awarded: int
    current_score: int
    current_streak: int
    max_streak: int
    total_answered: int
    correct_count: int
    incorrect_count: int
    is_time_up: bool

class FinishQuizRequest(BaseModel):
    session_id: str
    time_used_seconds: Optional[float] = 60.0

class FinishQuizResponse(BaseModel):
    session_id: str
    participant_name: str
    student_id: str
    score: int
    total_answered: int
    correct_count: int
    incorrect_count: int
    max_streak: int
    accuracy_percentage: float
    time_used_seconds: float
    current_rank: int
    total_participants: int

class LeaderboardEntry(BaseModel):
    session_id: Optional[str] = None
    rank: int
    name: str
    student_id: str
    department: str
    batch: str
    score: int
    correct_count: int
    total_answered: int
    accuracy_percentage: float
    time_used_seconds: float
    completed_at: Optional[str] = None

class QuestionAdmin(BaseModel):
    id: Optional[int] = None
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: str
    category: Optional[str] = "General BMES"
    difficulty: Optional[str] = "Medium"
    explanation: Optional[str] = ""
    is_active: Optional[int] = 1

class AdminLogin(BaseModel):
    password: str

class AdminSettingsUpdate(BaseModel):
    quiz_duration: Optional[int] = 120
    positive_points: Optional[int] = 4
    negative_points: Optional[int] = 1
    allow_negative: Optional[bool] = True
    competition_title: Optional[str] = "CUET BMES 2-Minute Blitz Quiz"
    admin_password: Optional[str] = None
    allow_retakes: Optional[bool] = False
