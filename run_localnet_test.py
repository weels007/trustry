"""Run the whole local integration cycle.

A local GenLayer node is started fresh, the contract is deployed to it, and
the interface drives the whole flow against it. Nothing is sent to the studio
network.

The node caches the contract class per process, so a fresh node is needed
whenever the contract source changes.

    python run_localnet_test.py
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FRONTEND = ROOT / "frontend"
LOG = ROOT / "glsim.log"


def start_node(port: int = 4000) -> subprocess.Popen:
    # Any node from a previous run has to go, it holds the old contract class.
    subprocess.run(
        ["powershell", "-NoProfile", "-Command",
         "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | "
         "Where-Object { $_.CommandLine -match 'glsim' } | "
         "ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"],
        capture_output=True,
    )
    time.sleep(2)
    for stale in Path(tempfile.gettempdir()).glob("glsim_contract_*.py"):
        stale.unlink(missing_ok=True)

    with LOG.open("w", encoding="utf-8") as log:
        process = subprocess.Popen(
            ["glsim", "--port", str(port), "--validators", "5", "--no-browser"],
            stdout=log,
            stderr=subprocess.STDOUT,
        )

    for _ in range(60):
        time.sleep(1)
        try:
            request = urllib.request.Request(
                f"http://127.0.0.1:{port}/api",
                data=json.dumps({"jsonrpc": "2.0", "id": 1, "method": "eth_chainId", "params": []}).encode(),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(request, timeout=5) as response:
                body = json.loads(response.read().decode())
            if body.get("result"):
                print(f"node is up, chain {body['result']}")
                return process
        except Exception:
            continue
    raise SystemExit("the local node did not come up")


def main() -> int:
    print("=== starting a fresh local node ===")
    process = start_node()

    try:
        print("\n=== deploying the contract to it ===")
        deploy = subprocess.run(
            [sys.executable, str(ROOT / "deploy_localnet.py")],
            capture_output=True,
            text=True,
        )
        print(deploy.stdout.strip() or deploy.stderr.strip()[-800:])
        if deploy.returncode != 0:
            return deploy.returncode

        print("\n=== driving it through the interface ===")
        npx = shutil.which("npx") or shutil.which("npx.cmd")
        if not npx:
            raise SystemExit("npx was not found on the path")
        verify = subprocess.run(
            [npx, "tsx", "scripts/verify-integration.ts"],
            cwd=FRONTEND,
        )
        return verify.returncode
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except Exception:
            process.kill()


if __name__ == "__main__":
    sys.exit(main())
