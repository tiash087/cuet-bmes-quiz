import subprocess
import time
import re
import sys
import os
import ctypes
import urllib.request
from pathlib import Path

# Force UTF-8 on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    try:
        ES_CONTINUOUS = 0x80000000
        ES_SYSTEM_REQUIRED = 0x00000001
        ES_AWAYMODE_REQUIRED = 0x00000040
        ctypes.windll.kernel32.SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_AWAYMODE_REQUIRED)
    except:
        pass

BASE_DIR = Path(__file__).parent.resolve()
CLOUDFLARED = BASE_DIR / "cloudflared.exe"
PYTHON_EXE = sys.executable
URL_FILE = BASE_DIR / "active_tunnel_url.txt"
LOG_FILE = BASE_DIR / "tunnel.log"

def log(msg):
    timestamp = time.strftime("[%Y-%m-%d %H:%M:%S]")
    line = f"{timestamp} {msg}"
    print(line, flush=True)

def update_frontend_files(new_url):
    try:
        # Update index.html
        index_file = BASE_DIR / "frontend" / "index.html"
        if index_file.exists():
            content = index_file.read_text(encoding="utf-8")
            content = re.sub(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com', new_url, content)
            index_file.write_text(content, encoding="utf-8")

        # Update admin.html
        admin_file = BASE_DIR / "frontend" / "admin.html"
        if admin_file.exists():
            content = admin_file.read_text(encoding="utf-8")
            content = re.sub(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com', new_url, content)
            admin_file.write_text(content, encoding="utf-8")

        # Regenerate QR Codes
        try:
            import qrcode
            qr_p = qrcode.QRCode(version=1, box_size=10, border=2)
            qr_p.add_data(new_url)
            qr_p.make(fit=True)
            img_p = qr_p.make_image(fill_color='#070d19', back_color='white')
            img_p.save(str(BASE_DIR / "frontend" / "assets" / "qr_player_quiz_standard.png"))
            img_p.save(str(BASE_DIR / "frontend" / "assets" / "qr_player_quiz.png"))

            qr_a = qrcode.QRCode(version=1, box_size=10, border=2)
            qr_a.add_data(f"{new_url}/admin")
            qr_a.make(fit=True)
            img_a = qr_a.make_image(fill_color='#070d19', back_color='white')
            img_a.save(str(BASE_DIR / "frontend" / "assets" / "qr_admin_portal_standard.png"))
            img_a.save(str(BASE_DIR / "frontend" / "assets" / "qr_admin_portal.png"))
        except:
            pass

        log("[SYSTEM] Frontend OpenGraph tags & QR codes updated successfully!")
    except Exception as e:
        log(f"[WARN] Could not update frontend files: {e}")

def start_backend():
    log("[SERVER] Launching FastAPI Backend on 0.0.0.0:8000 (72-Hour Mode)...")
    proc = subprocess.Popen(
        [PYTHON_EXE, "-m", "uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000"],
        cwd=str(BASE_DIR),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    return proc

def start_tunnel():
    log("[TUNNEL] Launching Cloudflare Tunnel (HTTP/2 Protocol with Keep-Alive)...")
    tunnel_log = open(LOG_FILE, "w", encoding="utf-8", errors="ignore")
    proc = subprocess.Popen(
        [str(CLOUDFLARED), "tunnel", "--protocol", "http2", "--url", "http://127.0.0.1:8000"],
        cwd=str(BASE_DIR),
        stdout=tunnel_log,
        stderr=subprocess.STDOUT
    )
    
    tunnel_url = None
    for _ in range(25):
        time.sleep(0.5)
        try:
            with open(LOG_FILE, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            match = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", content)
            if match:
                tunnel_url = match.group(0)
                break
        except:
            pass
            
    if tunnel_url:
        update_frontend_files(tunnel_url)
        log("=======================================================================")
        log(f">> LIVE PUBLIC QUIZ URL : {tunnel_url}")
        log(f">> ADMIN CONTROL PORTAL : {tunnel_url}/admin (Password: BME_2122)")
        log(">> 72-HOUR NON-STOP MODE : ACTIVE & MONITORED")
        log("=======================================================================")
        with open(URL_FILE, "w", encoding="utf-8") as f:
            f.write(tunnel_url)
    return proc, tunnel_url

def main():
    backend_proc = start_backend()
    time.sleep(2)
    tunnel_proc, current_url = start_tunnel()

    consecutive_fails = 0

    while True:
        try:
            time.sleep(10)
            
            # Check backend process health
            if backend_proc.poll() is not None:
                log("[WARN] Backend stopped. Auto-restarting backend...")
                backend_proc = start_backend()
                time.sleep(2)

            # Check tunnel process health
            if tunnel_proc.poll() is not None:
                log("[WARN] Tunnel disconnected. Auto-reconnecting tunnel...")
                tunnel_proc, current_url = start_tunnel()
                consecutive_fails = 0
                continue

            # Heartbeat ping every 15s to keep backend warm & connection alive
            if current_url:
                try:
                    req = urllib.request.Request(f"{current_url}/api/config", headers={"User-Agent": "BMES-72H-Heartbeat"})
                    with urllib.request.urlopen(req, timeout=10) as resp:
                        pass
                except Exception as e:
                    # Do NOT kill the tunnel; cloudflared handles connection recovery internally
                    pass

        except KeyboardInterrupt:
            log("[STOP] Exiting...")
            if backend_proc: backend_proc.terminate()
            if tunnel_proc: tunnel_proc.terminate()
            break
        except Exception as err:
            log(f"[LOOP ERROR] {err}")
            time.sleep(5)

if __name__ == "__main__":
    main()
