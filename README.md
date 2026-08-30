# ⚡ CUET BMES 1-Minute Blitz Quiz Competition

A high-performance, full-stack web application developed for the **CUET Biomedical Engineering Society (BMES) 1-Minute Blitz Quiz Challenge**.

Participants test their rapid-fire knowledge within a strict **60-second synchronized timer**, answering as many Biomedical Engineering & general science questions as possible with real-time scoring, sound effects, streak multipliers, and a live podium leaderboard.

---

## 🚀 Quick Start (Windows)

Simply double-click `run.bat` or run in terminal:

```bash
# In project folder:
py -m uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
```

Then open:
- 🎮 **Participant Quiz App**: [http://localhost:8000](http://localhost:8000)
- 🛡️ **Admin Dashboard**: [http://localhost:8000/admin](http://localhost:8000/admin) *(Default Admin Password: `admin`)*
- 📑 **Interactive API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🌟 Key Features

### 1. 🎮 60-Second Blitz Game Engine
- **Precise Timer Countdown**: Circular SVG progress bar with color-coded alerts (Cyan &rarr; Amber &rarr; Urgent Red with audio pulse under 10s).
- **Fast-Paced Answering**: Immediate option feedback, keyboard shortcuts (`A`, `B`, `C`, `D`, `Space` for Skip).
- **Procedural Sound Synthesizer**: Web Audio API generated real-time sound effects (Tick, Chimes, Buzzers, Combo fanfare).
- **Streak Combo Multiplier**: Visual fire multiplier indicator for continuous correct streaks.
- **Confetti Celebration**: Victorious particle burst for high scores.

### 2. 🏆 Live Leaderboard & Podium
- **Hall of Champions**: Top 3 Podium (🥇 1st Gold, 🥈 2nd Silver, 🥉 3rd Bronze).
- **Comprehensive Rankings**: Rank, Name, Student ID, Department, Score, Correct/Total, Accuracy %, Time Used.
- **Real-time Live Sync**: Automatic periodic leaderboard polling.
- **Instant Search**: Search participants by Student ID, Name, or Department.

### 3. 🛡️ Admin & Question Bank Portal (`/admin`)
- **Question Management**: Add, Edit, and Delete questions with category (Biomedical Signals, Imaging, Biomaterials, Biosensors, CUET Campus) and difficulty.
- **Bulk Import**: Paste or upload JSON arrays of questions in seconds.
- **Competition Settings**:
  - Customize Timer (e.g. 60s, 90s, 120s).
  - Configure Points per Correct (+4) and Negative Marking (-1).
  - Toggle single/multiple attempt policies.
  - Change Admin Password.
- **Data Export & Control**: Download full participant results as a CSV spreadsheet with 1-click; reset leaderboard for fresh competition rounds.

---

## 📁 Project Architecture

```
cuet_bmes_quiz/
├── backend/
│   ├── app.py                # FastAPI endpoints & static routing
│   ├── database.py           # SQLite DB connection & schema seeder
│   ├── models.py             # Pydantic schemas for data validation
│   └── sample_questions.py   # Preloaded Biomedical Engineering question bank
├── frontend/
│   ├── index.html            # Main Player SPA
│   ├── admin.html            # Admin Management Dashboard
│   ├── css/
│   │   └── style.css         # Glassmorphism, animations & custom styling
│   └── js/
│       ├── app.js            # Game state machine & UI controller
│       ├── admin.js          # Admin dashboard API integration
│       └── sfx.js            # Web Audio API procedural sound engine
├── quiz.db                   # SQLite database (auto-created on startup)
├── run.bat                   # 1-click Windows launcher
├── requirements.txt          # Python dependencies
└── README.md                 # Documentation
```

---

&copy; 2026 CUET Biomedical Engineering Society (BMES). All rights reserved.
