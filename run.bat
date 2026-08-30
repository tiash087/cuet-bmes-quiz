@echo off
title CUET BMES Quiz Competition Server
echo ===================================================
echo     CUET BMES 1-Minute Blitz Quiz Competition
echo ===================================================
echo.
echo Starting FastAPI Server on http://localhost:8000 ...
echo - Participant App:  http://localhost:8000
echo - Admin Portal:     http://localhost:8000/admin (Default password: admin)
echo.

py -m uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
pause
