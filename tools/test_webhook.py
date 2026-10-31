"""Send a signed fake WhatsApp message to Unsilo, exactly like Meta would.

Run from the unsilo folder (uvicorn must be running):
    python tools/test_webhook.py                      # tests http://localhost:8000
    python tools/test_webhook.py https://xxx.trycloudflare.com   # tests the tunnel too
"""
import hashlib
import hmac
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
env = dotenv_values(ROOT / ".env")


def show(label: str, ok: bool, detail: str = "") -> None:
    print(f"{'OK  ' if ok else 'FAIL'} {label}" + (f"  ->  {detail}" if detail else ""))


print(f".env file: {ROOT / '.env'}")
secret = (env.get("META_APP_SECRET") or "").strip()
show("META_APP_SECRET is set", bool(secret), "copy it from Meta: App settings > Basic > App secret")
show("WHATSAPP_VERIFY_TOKEN is set", bool((env.get("WHATSAPP_VERIFY_TOKEN") or "").strip()))
direct = (env.get("WHATSAPP_ALLOW_DIRECT") or "").strip().lower() == "true"
show("WHATSAPP_ALLOW_DIRECT=true", direct, "without it 1:1 test messages are dropped")
show("REFERENCE_DATE is set", bool((env.get("REFERENCE_DATE") or "").strip()), "e.g. 2026-10-31")

base = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000").rstrip("/")
url = f"{base}/api/webhooks/whatsapp"
stamp = str(int(time.time()))
payload = {"object": "whatsapp_business_account", "entry": [{"id": "TEST", "changes": [{"field": "messages", "value": {
    "messaging_product": "whatsapp", "metadata": {"display_phone_number": "15550000000", "phone_number_id": "TEST"},
    "contacts": [{"profile": {"name": "Unsilo self-test"}, "wa_id": "910000000000"}],
    "messages": [{"from": "910000000000", "id": f"wamid.selftest.{stamp}", "timestamp": stamp, "type": "text",
                  "text": {"body": "Self-test: site team agreed to dispatch the excavator on Monday."}}]}}]}]}
body = json.dumps(payload).encode()
sig = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()

# 1) verification handshake (what "Verify and save" in Meta does)
token = (env.get("WHATSAPP_VERIFY_TOKEN") or "").strip()
try:
    with urllib.request.urlopen(f"{url}?hub.mode=subscribe&hub.verify_token={token}&hub.challenge=12345", timeout=15) as r:
        show(f"GET verify on {base}", r.read() == b"12345")
except urllib.error.HTTPError as e:
    show(f"GET verify on {base}", False, f"HTTP {e.code}: verify token in .env differs from the server's (restart uvicorn?)")
except Exception as e:
    show(f"GET verify on {base}", False, f"{e}  (is uvicorn running? is the tunnel URL right?)")
    sys.exit(1)

# 2) a signed message, like Meta's Test button
req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json", "X-Hub-Signature-256": sig})
try:
    with urllib.request.urlopen(req, timeout=15) as r:
        show(f"POST signed message to {base}", r.status == 200)
except urllib.error.HTTPError as e:
    show(f"POST signed message to {base}", False,
         "401 bad signature: server has a different META_APP_SECRET, restart uvicorn" if e.code == 401 else f"HTTP {e.code}")
    sys.exit(1)

# 3) did it get stored?
with urllib.request.urlopen(f"{base}/api/health", timeout=15) as r:
    n = json.loads(r.read())["counts"]["whatsapp_messages"]
show("message stored", n > 0, f"{n} WhatsApp messages in the database" if n else
     "dropped: set WHATSAPP_ALLOW_DIRECT=true in .env and restart uvicorn")
