import subprocess
import time
import sys

print("Starting Taj Al Malik Tunnel Supervisor...")

cmd = [
    "ssh",
    "-o", "StrictHostKeyChecking=no",
    "-o", "ServerAliveInterval=30",
    "-o", "ServerAliveCountMax=5",
    "-p", "443",
    "-R0:localhost:8000",
    "a.pinggy.io"
]

while True:
    try:
        print("[Supervisor] Launching SSH tunnel to a.pinggy.io...")
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
