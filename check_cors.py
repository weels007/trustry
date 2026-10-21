"""Check that the studio RPC allows a browser on any origin, and that a real
gen_call works from one."""

import json
import urllib.request

RPC = "https://studio.genlayer.com/api"
CONTRACT = "0xd71227403E81BcDC4f0Fa657661687D2773333B0"

ORIGINS = [
    "https://trustry.vercel.app",
    "https://trustry-git-main-weels007.vercel.app",
    "https://some-random-unrelated-site.example",
    "http://localhost:3000",
]


UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/140.0 Safari/537.36"
)


def post(origin, payload):
    request = urllib.request.Request(
        RPC,
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            "Origin": origin,
            "User-Agent": UA,
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.headers, json.loads(response.read().decode())


def preflight(origin):
    request = urllib.request.Request(
        RPC,
        method="OPTIONS",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
            "User-Agent": UA,
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.headers


print("=== preflight ===")
for origin in ORIGINS:
    headers = preflight(origin)
    allowed = headers.get("Access-Control-Allow-Origin", "(none)")
    ok = allowed == origin or allowed == "*"
    print(f"  {'OK  ' if ok else 'FAIL'} {origin:52} -> {allowed}")

print("\n=== real gen_call ===")
payload = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "gen_call",
    "params": [
        {
            "type": "read",
            "to": CONTRACT,
            "from": "0x0000000000000000000000000000000000000000",
            "data": "0xde9c0e066d6574686f6494016765745f616c6c5f7265636f72645f69647300",
            "transaction_hash_variant": "latest-final",
        }
    ],
}
for origin in ORIGINS:
    headers, body = post(origin, payload)
    allowed = headers.get("Access-Control-Allow-Origin", "(none)")
    has_result = "result" in body
    ok = (allowed == origin or allowed == "*") and has_result
    print(f"  {'OK  ' if ok else 'FAIL'} {origin:52} -> origin {allowed}, result {has_result}")
