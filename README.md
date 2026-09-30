# Jelenléti ív generátor

Egyszerű, böngészőben futó mini app, ami havonta legenerálja a jelenléti íveket PDF-ben
(munkavállalónként egy A4-es oldal, vektorosan rajzolt táblázattal, összesítővel és aláírás-sorokkal).

## Használat

1. Nyisd meg az `index.html`-t böngészőben (dupla kattintás elég, nem kell szerver, internet sem).
2. **Munkavállalók** fül: vedd fel a munkavállalókat – név, munkakör, adóazonosító jel, belépés/kilépés,
   munkakezdés és heti beosztás (hétfőtől vasárnapig a napi óraszám; üres = nem dolgozik azon a napon).
3. **Havi jelenléti ív** fül: add meg a munkáltatót, válaszd ki a hónapot, és a munkavállaló naptárában
   kattints azokra a napokra, amikor szabadságon volt (piros).
4. **PDF generálása** → letölti a `jelenleti_iv_ÉÉÉÉ-HH.pdf` fájlt (az adott hónapban aktív munkavállalók, egy-egy oldal).

Az adatokat a böngésző megjegyzi. Az **Adatok mentése fájlba** / **Adatok betöltése** gombokkal
JSON fájlba menthető, illetve másik gépen visszatölthető.

## Offline, egyfájlos változat

A `jelenleti-offline.html` egyetlen fájlban tartalmaz mindent: elküldhető bárkinek, letöltés után
dupla kattintással megnyitható, internet nélkül is működik, és a PDF letöltése mindenkinél megy.
Módosítás után újragenerálás: `python3 tools/offline_build.py`.

(A claude.ai-os artifact linken a PDF letöltése csak bejelentkezett felhasználóknak működik.)

## Szabályok

- Munkanap: hétfő–péntek, kivéve a munkaszüneti napokat (jan. 1., márc. 15., nagypéntek,
  húsvéthétfő, máj. 1., pünkösdhétfő, aug. 20., okt. 23., nov. 1., dec. 25–26.).
- Az áthelyezett munkanapok (ledolgozós szombatok, hídnapok) 2025-re és 2026-ra be vannak építve
  (`naptar.js`, `ATHELYEZESEK`). Új évnél ide kell felvenni őket, vagy az appban a
  „Cégszintű eltérések” résznél megadni.
- Egy munkavállaló egy napon dolgozik, ha a beosztása szerint aznap van óraszáma, nem ünnepnap vagy
  áthelyezett pihenőnap, jogviszonyban áll (belépés és kilépés között), és nincs szabadnapnak jelölve.
  Áthelyezett munkanapon (pl. ledolgozós szombat) a helyettesített nap (pl. a pénteki hídnap) beosztása érvényes.
- Munkanapon: érkezés = kezdés, távozás = kezdés + aznapi óraszám, ledolgozott óra = aznapi óraszám.
- Minden más napon az ok látszik (hétvége, munkaszüneti nap, pihenőnap, szabadság, nem munkanap), halványan kiemelve.

## Fájlok

- `index.html`, `app.js` – felület és PDF-készítés
- `naptar.js` – munkanaptár-logika
- `lib/` – [pdf-lib](https://pdf-lib.js.org/) és fontkit (MIT), valamint `assets.js`: az Amiko betűtípus
  (SIL OFL) normál és félkövér változata base64-ben
