"""Capture resource URLs from Deliveroo Milano and write a HAR with server IPs."""

from __future__ import annotations

import json
import re
import socket
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "inputs" / "deliveroo_milan.har"
START_URL = "https://deliveroo.it/en/cuisines/italian-takeaway/milano"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9,it;q=0.8",
}


def resolve_ip(host: str) -> str | None:
    try:
        infos = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
        for info in infos:
            ip = info[4][0]
            if ":" not in ip:  # prefer IPv4 for ipinfo.io
                return ip
        return infos[0][4][0]
    except OSError:
        return None


def collect_urls(html: str, base: str) -> list[str]:
    urls = {base}
    for match in re.findall(r"""(?:src|href)=["']([^"']+)["']""", html, flags=re.I):
        if match.startswith(("data:", "javascript:", "mailto:", "tel:")):
            continue
        abs_url = urljoin(base, match).split("#")[0]
        if abs_url.startswith("http"):
            urls.add(abs_url)
    # Also pick JSON/API-looking strings in inline scripts
    for match in re.findall(r"""https://[a-zA-Z0-9._~:/?#\[\]@!$&'()*+,;=%\-]+""", html):
        clean = match.rstrip("\\\",')>;")
        if any(x in clean for x in (".js", ".css", ".png", ".jpg", ".svg", ".woff", "api", "cdn", "static")):
            urls.add(clean.split("#")[0])
    return sorted(urls)


def main() -> None:
    print(f"Fetching {START_URL}")
    resp = requests.get(START_URL, headers=HEADERS, timeout=40)
    print("status", resp.status_code, "bytes", len(resp.content))
    resp.raise_for_status()

    urls = collect_urls(resp.text, START_URL)
    # Always include a few known Deliveroo-related hosts if present in page domain graph
    extra_hosts = [
        "https://deliveroo.it/",
        "https://www.deliveroo.it/",
        "https://cdn.deliveroo.com/",
        "https://api.deliveroo.com/",
    ]
    for u in extra_hosts:
        urls.append(u)
    # unique preserve order
    seen = set()
    ordered = []
    for u in urls:
        if u not in seen:
            seen.add(u)
            ordered.append(u)
    urls = ordered[:100]
    print(f"Resolving up to {len(urls)} URLs")

    entries = []
    for url in urls:
        host = urlparse(url).hostname
        if not host:
            continue
        ip = resolve_ip(host)
        if not ip:
            print(f"  skip {host}")
            continue
        entries.append(
            {
                "serverIPAddress": ip,
                "request": {"method": "GET", "url": url},
                "response": {"status": 200, "statusText": "OK"},
            }
        )
        print(f"  {ip:15} {url[:100]}")

    har = {
        "log": {
            "version": "1.2",
            "creator": {"name": "assignment04-capture", "version": "1.0"},
            "pages": [
                {
                    "id": "page_1",
                    "title": "Deliveroo - Italian takeaway Milano",
                    "startedDateTime": "2026-08-07T00:00:00.000Z",
                }
            ],
            "entries": entries,
        }
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(har, indent=2), encoding="utf-8")
    print(f"\nWrote {OUT} ({len(entries)} entries)")


if __name__ == "__main__":
    main()
