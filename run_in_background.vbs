Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\hp\.gemini\antigravity\scratch\cuet_bmes_quiz"
WshShell.Run """C:\Users\hp\AppData\Local\Programs\Python\Python313\python.exe"" server_manager.py", 0, False
