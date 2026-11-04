#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""局域网候选 B 机探测：对给定网段做 TCP 连接探测（不依赖管理员权限、不做漏洞利用）。"""
import socket, sys, json
from concurrent.futures import ThreadPoolExecutor

SUBNETS = sys.argv[1].split(",") if len(sys.argv) > 1 else ["172.16.184"]
PORTS = [3389, 445, 5985, 1334, 22, 80, 443]
TIMEOUT = 0.7

def probe(host, port):
    try:
        with socket.create_connection((host, port), TIMEOUT):
            return (host, port)
    except Exception:
        return None

targets = [(f"{s}.{i}", p) for s in SUBNETS for i in range(1, 255) for p in PORTS]
hits = []
with ThreadPoolExecutor(max_workers=256) as ex:
    for res in ex.map(lambda t: probe(*t), targets):
        if res:
            hits.append(res)
    # keep as list of tuples
hosts = {}
for h, p in hits:
    hosts.setdefault(h, []).append(p)
print(json.dumps({h: sorted(v) for h, v in sorted(hosts.items())}, indent=1, ensure_ascii=False))
print(f"hosts_with_hits={len(hosts)} total_open={len(hits)}")
