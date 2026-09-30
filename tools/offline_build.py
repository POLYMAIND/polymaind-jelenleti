#!/usr/bin/env python3
"""Egyetlen, önálló HTML fájlt készít (jelenleti-offline.html), amiben minden szkript benne van.

Bárkinek elküldhető: letöltés után dupla kattintással megnyitható, internet nélkül is működik.
Futtatás a repó gyökeréből: python3 tools/offline_build.py
"""
import pathlib
import re

gyoker = pathlib.Path(__file__).resolve().parent.parent
html = (gyoker / 'index.html').read_text(encoding='utf-8')


def beagyaz(m):
    kod = (gyoker / m.group(1)).read_text(encoding='utf-8').replace('</script', '<\\/script')
    return '<script>\n' + kod + '\n</script>'


html = re.sub(r'<script src="([^"]+)"></script>', beagyaz, html)
(gyoker / 'jelenleti-offline.html').write_text(html, encoding='utf-8')
print('kész: jelenleti-offline.html', len(html) // 1024, 'KB')
