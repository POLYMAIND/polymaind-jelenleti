# Jelenléti ív generátor

Egyszerű, böngészőben futó mini app, ami havonta legenerálja a jelenléti íveket PDF-ben
(dolgozónként egy oldal, az eredeti nyomtatvány-sablonra írva).

## Használat

1. Nyisd meg az `index.html`-t böngészőben (dupla kattintás elég, nem kell szerver, internet sem).
2. Add meg a munkáltatót és a dolgozókat (név, napi óraszám, kezdés – alapból 8 óra, 09:00-tól).
3. Válaszd ki a hónapot, és a dolgozó naptárában kattints azokra a napokra, amikor szabadságon volt (piros).
4. **PDF generálása** → letölti a `jelenleti_iv_ÉÉÉÉ-HH.pdf` fájlt.

Az adatokat a böngésző megjegyzi. Az **Adatok mentése fájlba** / **Adatok betöltése** gombokkal
JSON fájlba menthető, illetve másik gépen visszatölthető.

## Szabályok

- Munkanap: hétfő–péntek, kivéve a munkaszüneti napokat (jan. 1., márc. 15., nagypéntek,
  húsvéthétfő, máj. 1., pünkösdhétfő, aug. 20., okt. 23., nov. 1., dec. 25–26.).
- Az áthelyezett munkanapok (ledolgozós szombatok, hídnapok) 2025-re és 2026-ra be vannak építve
  (`naptar.js`, `ATHELYEZESEK`). Új évnél ide kell felvenni őket, vagy az appban a
  „Cégszintű eltérések” résznél megadni.
- Munkanapon: érkezés = kezdés, távozás = kezdés + napi óraszám, ledolgozott óra = napi óraszám.
- Nem munkanapon és szabadnapon: `--------`.

## Fájlok

- `index.html`, `app.js` – felület és PDF-készítés
- `naptar.js` – munkanaptár-logika
- `lib/` – [pdf-lib](https://pdf-lib.js.org/) és fontkit (MIT), valamint `assets.js`: a sablon
  háttérképe és az Amiko betűtípus (SIL OFL) base64-ben
