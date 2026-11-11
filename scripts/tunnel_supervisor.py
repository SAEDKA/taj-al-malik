import subprocess
import time
import sys
import re
import os

print("Starting Taj Al Malik Tunnel Supervisor (Serveo)...")

cmd = [
    "ssh",
    "-o", "StrictHostKeyChecking=no",
    "-o", "ServerAliveInterval=15",
    "-o", "ServerAliveCountMax=3",
    "-R", "80:127.0.0.1:8000",
    "serveo.net"
]

project_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
url_file = os.path.join(project_dir, "tunnel_url.txt")

while True:
    try:
        print("[Supervisor] Launching SSH tunnel to serveo.net...")
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )
        for line in proc.stdout:
            sys.stdout.write(line)
            sys.stdout.flush()
            m = re.search(r'https?://[^\s]+', line)
            if m:
                live_url = m.group(0).rstrip('.')
                print(f"\n[Supervisor] >>> ACTIVE TUNNEL URL: {live_url} <<<\n")
                try:
                    with open(url_file, "w", encoding="utf-8") as f:
                        f.write(live_url.strip())
                except Exception:
                    pass
        proc.wait()
        print(f"[Supervisor] Tunnel process ended with code {proc.returncode}. Reconnecting in 3s...")
    except Exception as e:
        print(f"[Supervisor] Error: {e}. Retrying in 5s...")
        time.sleep(5)
    time.sleep(3)

