import subprocess
import time
import sys

print("Starting Taj Al Malik Tunnel Supervisor (Serveo)...")

cmd = [
    "ssh",
    "-o", "StrictHostKeyChecking=no",
    "-o", "ServerAliveInterval=30",
    "-o", "ServerAliveCountMax=5",
    "-R", "80:127.0.0.1:8000",
    "serveo.net"
]

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
        proc.wait()
        print(f"[Supervisor] Tunnel process ended with code {proc.returncode}. Reconnecting in 3s...")
    except Exception as e:
        print(f"[Supervisor] Error: {e}. Retrying in 5s...")
        time.sleep(5)
    time.sleep(3)
