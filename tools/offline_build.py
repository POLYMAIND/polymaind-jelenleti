#!/usr/bin/env python3
"""Önálló, egyfájlos HTML-eket készít (jelenleti-offline.html, demo-offline.html), amikben minden benne van.

Bárkinek elküldhető: letöltés után dupla kattintással megnyitható, internet nélkül is működik.
Futtatás a repó gyökeréből: python3 tools/offline_build.py
"""
import pathlib
import re

gyoker = pathlib.Path(__file__).resolve().parent.parent
CELOK = {'index.html': 'jelenleti-offline.html', 'demo.html': 'demo-offline.html'}


def beagyaz(m):
    kod = (gyoker / m.group(1)).read_text(encoding='utf-8').replace('</script', '<\\/script')
    return '<script>\n' + kod + '\n</script>'


def stilus(m):
    return '<style>\n' + (gyoker / m.group(1)).read_text(encoding='utf-8') + '</style>'


for forras, cel in CELOK.items():
    html = (gyoker / forras).read_text(encoding='utf-8')
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', stilus, html)
    html = re.sub(r'<script src="([^"]+)"></script>', beagyaz, html)
    (gyoker / cel).write_text(html, encoding='utf-8')
    print('kész:', cel, len(html) // 1024, 'KB')
