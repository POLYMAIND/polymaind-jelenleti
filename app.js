/* global Naptar, PDFLib, fontkit, JELENLETI_ASSETS */
(function () {
  const TAROLO_KULCS = 'jelenleti-v1';

  // ---------- Állapot ----------
  // beosztas: napi óraszám a hét napjai szerint, Date.getDay() sorrendben (0 = vasárnap).
  function ujDolgozo() {
    return {
      id: ujId(), nev: '', munkakor: '', adoazonosito: '', belepes: '', kilepes: '', megjegyzes: '',
      kezdes: '09:00', beosztas: [0, 8, 8, 8, 8, 8, 0],
    };
  }
  function alapAllapot() {
    return {
      ceg: 'Polymaind Kft.',
      dolgozok: [
        Object.assign(ujDolgozo(), { nev: 'Horváth Hella', beosztas: [0, 6, 6, 6, 6, 6, 0] }),
        Object.assign(ujDolgozo(), { nev: 'Tőke-Andor Mária' }),
      ],
      szabadnapok: {}, // { 'ÉÉÉÉ-HH': { dolgozoId: [napok] } }
      cegszintu: {}, // { 'ÉÉÉÉ-HH': { pihenonap: '1, 2', munkanap: '' } }
    };
  }
  function ujId() { return Math.random().toString(36).slice(2, 10); }

  // Régebbi mentések (egyetlen napi óraszám) átalakítása.
  function normalizal(s) {
    const a = Object.assign(alapAllapot(), s);
    a.dolgozok = a.dolgozok.map((d) => {
      const u = Object.assign(ujDolgozo(), d);
      if (!Array.isArray(d.beosztas) && d.orak) u.beosztas = [0, d.orak, d.orak, d.orak, d.orak, d.orak, 0];
      delete u.orak;
      return u;
    });
    return a;
  }

  function betolt() {
    try {
      const s = JSON.parse(localStorage.getItem(TAROLO_KULCS));
      if (s && Array.isArray(s.dolgozok)) return normalizal(s);
    } catch (e) { /* üres vagy sérült tároló */ }
    return alapAllapot();
  }
  function ment() {
    try { localStorage.setItem(TAROLO_KULCS, JSON.stringify(allapot)); } catch (e) { /* nem kritikus */ }
  }

  let allapot = betolt();
  const $ = (id) => document.getElementById(id);

  function aktualisHonap() {
    const [ev, honap] = $('honap').value.split('-').map(Number);
    return { ev, honap, kulcs: $('honap').value };
  }

  function cegszintuEltereses() {
    const { ev, honap, kulcs } = aktualisHonap();
    const c = allapot.cegszintu[kulcs] || {};
    const max = Naptar.napokSzama(ev, honap);
    const p = Naptar.napListaErtelmez(c.pihenonap, max);
    const m = Naptar.napListaErtelmez(c.munkanap, max);
    return { pihenonap: p.napok, munkanap: m.napok, hibak: [...p.hibak, ...m.hibak] };
  }

  function honapNapjai() {
    const { ev, honap } = aktualisHonap();
    return Naptar.honapNapjai(ev, honap, cegszintuEltereses());
  }

  function szabadnapjai(dolgozoId) {
    const h = allapot.szabadnapok[aktualisHonap().kulcs] || {};
    return new Set(h[dolgozoId] || []);
  }

  function szabadnapValt(dolgozoId, nap) {
    const kulcs = aktualisHonap().kulcs;
    const h = (allapot.szabadnapok[kulcs] = allapot.szabadnapok[kulcs] || {});
    const s = new Set(h[dolgozoId] || []);
    s.has(nap) ? s.delete(nap) : s.add(nap);
    h[dolgozoId] = [...s].sort((a, b) => a - b);
    ment();
    rajzol();
  }

  const pad = (n) => String(n).padStart(2, '0');
  function datumKulcs(ev, honap, nap) { return `${ev}-${pad(honap)}-${pad(nap)}`; }

  // Az adott hónapban van-e jogviszonya (belépés/kilépés alapján).
  function aktivAHonapban(d) {
    const { ev, honap } = aktualisHonap();
    const eleje = datumKulcs(ev, honap, 1), vege = datumKulcs(ev, honap, Naptar.napokSzama(ev, honap));
    return (!d.belepes || d.belepes <= vege) && (!d.kilepes || d.kilepes >= eleje);
  }

  // Egy dolgozó napjai a hónapban: { nap, beosztva, dolgozik, szabad, ok, tervOra, erkezett, tavozott, orak }
  function dolgozoNapjai(dolgozo) {
    const { ev, honap } = aktualisHonap();
    const szabad = szabadnapjai(dolgozo.id);
    return honapNapjai().map((n) => {
      const datum = datumKulcs(ev, honap, n.nap);
      const orak = Number(dolgozo.beosztas[n.oraNapja]) || 0;
      let ok = '';
      if (dolgozo.belepes && datum < dolgozo.belepes) ok = 'belépés előtt';
      else if (dolgozo.kilepes && datum > dolgozo.kilepes) ok = 'kilépés után';
      else if (n.tipus === 'unnep' || n.tipus === 'pihenonap') ok = n.ok;
      else if (!orak) ok = n.munkanap ? 'nem dolgozik ezen a napon' : n.ok || 'nem dolgozik ezen a napon';
      const beosztva = !ok;
      const dolgozik = beosztva && !szabad.has(n.nap);
      return {
        nap: n.nap,
        hetNapja: n.hetNapja,
        beosztva,
        dolgozik,
        szabad: beosztva && szabad.has(n.nap),
        ok,
        tervOra: orak,
        erkezett: dolgozik ? dolgozo.kezdes : null,
        tavozott: dolgozik ? Naptar.idoHozzaad(dolgozo.kezdes, orak) : null,
        orak: dolgozik ? orak : null,
      };
    });
  }

  // Rövid üzenet a lap tetején (az alert() nem minden környezetben jelenik meg).
  function uzen(szoveg) {
    const el = $('uzenet');
    el.textContent = szoveg;
    el.hidden = !szoveg;
  }

  // ---------- Felület ----------
  const HET_NAPJAI = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'];
  const HET_SORREND = [1, 2, 3, 4, 5, 6, 0]; // hétfőtől vasárnapig
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const oraSzoveg = (o) => String(o).replace('.', ',');

  function beosztasSzoveg(d) {
    const napok = HET_SORREND.filter((i) => Number(d.beosztas[i]) > 0);
    if (!napok.length) return 'nincs beosztás';
    return napok.map((i) => `${HET_NAPJAI[i]} ${oraSzoveg(d.beosztas[i])}`).join(', ');
  }

  function rajzol() {
    $('ceg').value = allapot.ceg;
    rajzolHavi();
    rajzolMunkavallalok();
  }

  function rajzolHavi() {
    const napok = honapNapjai();
    const elteres = cegszintuEltereses();
    const { kulcs } = aktualisHonap();
    const c = allapot.cegszintu[kulcs] || {};
    $('ceg-pihenonap').value = c.pihenonap || '';
    $('ceg-munkanap').value = c.munkanap || '';
    $('ceg-hiba').textContent = elteres.hibak.length ? 'Nem értelmezhető: ' + elteres.hibak.join(', ') : '';

    const munkanapDb = napok.filter((n) => n.munkanap).length;
    $('honap-info').textContent = `${munkanapDb} munkanap ebben a hónapban (H–P munkarend szerint)`;

    const lista = $('dolgozok');
    lista.innerHTML = '';
    const aktivak = allapot.dolgozok.filter(aktivAHonapban);
    if (!aktivak.length) {
      lista.innerHTML = `<p class="ures">${allapot.dolgozok.length
        ? 'Ebben a hónapban nincs aktív munkavállaló.'
        : 'Még nincs munkavállaló. Vedd fel őket a <a href="#" data-ful-link="munkavallalok">Munkavállalók</a> fülön.'}</p>`;
      const link = lista.querySelector('[data-ful-link]');
      if (link) link.addEventListener('click', (e) => { e.preventDefault(); fulValt('munkavallalok'); });
      return;
    }
    aktivak.forEach((d) => {
      const napjai = dolgozoNapjai(d);
      const ledolgozott = napjai.filter((n) => n.dolgozik);
      const oraOssz = ledolgozott.reduce((s, n) => s + n.orak, 0);
      const szabadDb = napjai.filter((n) => n.szabad).length;

      const kartya = document.createElement('div');
      kartya.className = 'dolgozo';
      kartya.innerHTML = `
        <div class="dolgozo-cim"><strong>${esc(d.nev || 'Névtelen')}</strong>
          <span>${esc(d.munkakor)}${d.munkakor ? ' · ' : ''}${esc(d.kezdes)}-tól · ${esc(beosztasSzoveg(d))}</span></div>
        <div class="naptar"></div>
        <div class="osszesito">${ledolgozott.length} nap · ${oraSzoveg(oraOssz)} óra${szabadDb ? ` · ${szabadDb} szabadnap` : ''}</div>`;

      const naptar = kartya.querySelector('.naptar');
      napjai.forEach((n) => {
        const cella = document.createElement('button');
        cella.type = 'button';
        cella.className = 'nap';
        cella.innerHTML = `<small>${HET_NAPJAI[n.hetNapja]}</small>${n.nap}`;
        if (!n.beosztva) {
          cella.classList.add('pihen');
          cella.disabled = true;
          cella.title = n.ok;
        } else if (n.szabad) {
          cella.classList.add('szabad');
          cella.title = 'Szabadnap – kattints a visszavonáshoz';
        } else {
          cella.title = `Munkanap (${oraSzoveg(n.tervOra)} óra) – kattints, ha szabadnap`;
        }
        cella.addEventListener('click', () => szabadnapValt(d.id, n.nap));
        naptar.appendChild(cella);
      });
      lista.appendChild(kartya);
    });
  }

  function rajzolMunkavallalok() {
    const lista = $('munkavallalok-lista');
    lista.innerHTML = '';
    if (!allapot.dolgozok.length) lista.innerHTML = '<p class="ures">Még nincs munkavállaló.</p>';
    allapot.dolgozok.forEach((d) => {
      const kartya = document.createElement('div');
      kartya.className = 'dolgozo';
      kartya.innerHTML = `
        <div class="racs">
          <label class="mezo szeles"><span>Név</span><input type="text" data-mezo="nev" placeholder="Munkavállaló neve"></label>
          <label class="mezo"><span>Munkakör</span><input type="text" data-mezo="munkakor"></label>
          <label class="mezo"><span>Adóazonosító jel</span><input type="text" data-mezo="adoazonosito" inputmode="numeric"></label>
          <label class="mezo"><span>Belépés</span><input type="date" data-mezo="belepes"></label>
          <label class="mezo"><span>Kilépés</span><input type="date" data-mezo="kilepes"></label>
          <label class="mezo"><span>Munkakezdés</span><input type="time" data-mezo="kezdes" step="900"></label>
        </div>
        <div class="mezo beosztas-cim"><span>Beosztás – napi óraszám (üres vagy 0 = nem dolgozik azon a napon)</span></div>
        <div class="beosztas">
          ${HET_SORREND.map((i) => `<label><span>${HET_NAPJAI[i]}</span><input type="number" min="0" max="24" step="0.5" data-nap="${i}"></label>`).join('')}
          <span class="heti"></span>
        </div>
        <label class="mezo"><span>Megjegyzés</span><input type="text" data-mezo="megjegyzes"></label>
        <div class="kartya-lab"><button class="torol">Munkavállaló törlése</button></div>`;

      const hetiFrissit = () => {
        const ossz = d.beosztas.reduce((s, o) => s + (Number(o) || 0), 0);
        kartya.querySelector('.heti').textContent = `heti ${oraSzoveg(ossz)} óra`;
      };
      hetiFrissit();

      kartya.querySelectorAll('input[data-mezo]').forEach((inp) => {
        const mezo = inp.dataset.mezo;
        inp.value = d[mezo] || '';
        inp.addEventListener('change', () => {
          if (mezo === 'kezdes' && !/^\d{2}:\d{2}$/.test(inp.value)) { inp.value = d.kezdes; return; }
          d[mezo] = inp.value.trim();
          ment();
          rajzolHavi();
        });
      });
      kartya.querySelectorAll('input[data-nap]').forEach((inp) => {
        const i = +inp.dataset.nap;
        inp.value = Number(d.beosztas[i]) || '';
        inp.addEventListener('change', () => {
          const v = inp.value === '' ? 0 : parseFloat(inp.value);
          if (!(v >= 0 && v <= 24)) { inp.value = Number(d.beosztas[i]) || ''; return; }
          d.beosztas[i] = v;
          hetiFrissit();
          ment();
          rajzolHavi();
        });
      });
      const torol = kartya.querySelector('.torol');
      torol.addEventListener('click', () => {
        if (!torol.dataset.megerosit) {
          torol.dataset.megerosit = '1';
          torol.textContent = `Biztosan törlöd? Kattints újra`;
          setTimeout(() => { if (torol.isConnected) { delete torol.dataset.megerosit; torol.textContent = 'Munkavállaló törlése'; } }, 4000);
          return;
        }
        allapot.dolgozok = allapot.dolgozok.filter((x) => x.id !== d.id);
        ment();
        rajzol();
      });
      lista.appendChild(kartya);
    });
  }

  function fulValt(ful) {
    document.querySelectorAll('[data-ful]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.ful === ful)));
    document.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== ful; });
    try { localStorage.setItem(TAROLO_KULCS + '-ful', ful); } catch (e) { /* nem kritikus */ }
  }

  // ---------- PDF ----------
  function base64Bajtok(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // A lap elrendezése pontban (A4), a lap tetejétől mérve.
  const LAP = { w: 595.28, h: 841.89, margo: 36 };
  const FEJ_TETO = 72, FEJ_SOR = 34;          // fejléc-dobozok
  const TABLA_TETO = 156, TABLA_FEJ = 22;     // táblázat fejléce
  const BLOKK = 34;                           // egy nap magassága (két sor)
  const OSZLOP_KOZ = 16;
  const OSZL = { nap: 40, cimke: 54, ido: 46, alairas: 0, ora: 42 };
  OSZL.alairas = (LAP.w - 2 * LAP.margo - OSZLOP_KOZ) / 2 - OSZL.nap - OSZL.cimke - OSZL.ido - OSZL.ora;

  const OK_FELIRAT = {
    'hétvége': 'hétvége',
    'ünnepnap': 'munkaszüneti nap',
    'áthelyezett pihenőnap': 'pihenőnap',
    'cégszintű pihenőnap': 'pihenőnap',
    'nem dolgozik ezen a napon': 'nem munkanap',
    'belépés előtt': 'belépés előtt',
    'kilépés után': 'kilépés után',
  };

  async function pdfGeneral() {
    uzen('');
    const dolgozok = allapot.dolgozok.filter((d) => d.nev && aktivAHonapban(d));
    if (!dolgozok.length) { uzen('Ebben a hónapban nincs aktív, névvel megadott munkavállaló.'); return; }
    const { ev, honap, kulcs } = aktualisHonap();

    const { PDFDocument, rgb } = PDFLib;
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const normal = await doc.embedFont(base64Bajtok(JELENLETI_ASSETS.font), { subset: true });
    const felkover = await doc.embedFont(base64Bajtok(JELENLETI_ASSETS.fontBold), { subset: true });
    doc.setTitle(`Jelenléti ív – ${ev}. ${Naptar.HONAPOK[honap - 1].toLowerCase()}`);
    doc.setAuthor(allapot.ceg);

    const SZIN = {
      tinta: rgb(0.1, 0.1, 0.12),
      halvany: rgb(0.42, 0.42, 0.45),
      vonal: rgb(0.2, 0.2, 0.22),
      belso: rgb(0.62, 0.62, 0.65),
      fejHatter: rgb(0.91, 0.92, 0.94),
      pihenHatter: rgb(0.955, 0.955, 0.96),
    };

    dolgozok.forEach((d) => {
      const lap = doc.addPage([LAP.w, LAP.h]);
      const Y = (teto) => LAP.h - teto;

      // Szöveg: x a vízszintes horgony, yKozep a sor függőleges közepe.
      const ir = (szoveg, x, yKozep, meret, o = {}) => {
        const font = o.felkover ? felkover : normal;
        const w = font.widthOfTextAtSize(szoveg, meret);
        const igazit = o.igazit || 'bal';
        lap.drawText(szoveg, {
          x: igazit === 'kozep' ? x - w / 2 : igazit === 'jobb' ? x - w : x,
          y: Y(yKozep) - meret * 0.34,
          size: meret, font, color: o.szin || SZIN.tinta,
        });
      };
      const vonal = (x1, y1, x2, y2, vastag = 0.5, szin = SZIN.belso) =>
        lap.drawLine({ start: { x: x1, y: Y(y1) }, end: { x: x2, y: Y(y2) }, thickness: vastag, color: szin });
      const teglalap = (x, teto, w, h, o = {}) => lap.drawRectangle({
        x, y: Y(teto + h), width: w, height: h,
        color: o.kitoltes, borderColor: o.keret, borderWidth: o.keret ? (o.vastag || 0.9) : 0,
      });

      // ---- Cím ----
      ir('JELENLÉTI ÍV', LAP.margo, 44, 18, { felkover: true });
      vonal(LAP.margo, 58, LAP.w - LAP.margo, 58, 1.2, SZIN.vonal);

      // ---- Fejléc-dobozok ----
      const tartW = LAP.w - 2 * LAP.margo;
      const balW = tartW * 0.62;
      const mezo = (cimke, ertek, x, teto, w, o = {}) => {
        ir(cimke.toUpperCase(), x + 7, teto + 9, 6.5, { felkover: true, szin: SZIN.halvany });
        ir(ertek || '', x + 7, teto + 23, 11.5, { felkover: o.felkover });
        if (o.jobbra) ir(o.jobbra, x + w - 7, teto + 23, 8.5, { igazit: 'jobb', szin: SZIN.halvany });
      };
      teglalap(LAP.margo, FEJ_TETO, tartW, FEJ_SOR * 2, { keret: SZIN.vonal });
      vonal(LAP.margo, FEJ_TETO + FEJ_SOR, LAP.w - LAP.margo, FEJ_TETO + FEJ_SOR);
      vonal(LAP.margo + balW, FEJ_TETO, LAP.margo + balW, FEJ_TETO + 2 * FEJ_SOR);
      mezo('Munkáltató', allapot.ceg, LAP.margo, FEJ_TETO, balW);
      mezo('Időszak', `${ev}. ${Naptar.HONAPOK[honap - 1].toLowerCase()}`, LAP.margo + balW, FEJ_TETO, tartW - balW);
      mezo('Munkavállaló neve', d.nev, LAP.margo, FEJ_TETO + FEJ_SOR, balW,
        { felkover: true, jobbra: d.adoazonosito ? `Adóazonosító: ${d.adoazonosito}` : '' });
      mezo('Munkakör', d.munkakor, LAP.margo + balW, FEJ_TETO + FEJ_SOR, tartW - balW);

      // ---- Táblázat ----
      const napjai = dolgozoNapjai(d);
      const oszlopW = (tartW - OSZLOP_KOZ) / 2;
      const oszlopok = [
        { x: LAP.margo, napok: napjai.slice(0, 15) },
        { x: LAP.margo + oszlopW + OSZLOP_KOZ, napok: napjai.slice(15) },
      ];
      const ledolgozott = napjai.filter((n) => n.dolgozik);
      const oraOssz = ledolgozott.reduce((s, n) => s + n.orak, 0);
      const szabadDb = napjai.filter((n) => n.szabad).length;

      oszlopok.forEach(({ x, napok }, oi) => {
        const xCimke = x + OSZL.nap, xIdo = xCimke + OSZL.cimke, xAla = xIdo + OSZL.ido, xOra = xAla + OSZL.alairas;
        const blokkDb = napok.length + (oi === 0 ? 1 : 0); // bal oldalon a 16. hely az összesítő
        const also = TABLA_TETO + TABLA_FEJ + blokkDb * BLOKK;

        // fejléc
        teglalap(x, TABLA_TETO, oszlopW, TABLA_FEJ, { kitoltes: SZIN.fejHatter });
        const fk = TABLA_TETO + TABLA_FEJ / 2;
        ir('NAP', x + (OSZL.nap + OSZL.cimke) / 2, fk, 7.5, { felkover: true, igazit: 'kozep' });
        ir('IDŐPONT', xIdo + OSZL.ido / 2, fk, 7.5, { felkover: true, igazit: 'kozep' });
        ir('ALÁÍRÁS', xAla + OSZL.alairas / 2, fk, 7.5, { felkover: true, igazit: 'kozep' });
        ir('ÓRA', xOra + OSZL.ora / 2, fk, 7.5, { felkover: true, igazit: 'kozep' });

        napok.forEach((n, i) => {
          const t = TABLA_TETO + TABLA_FEJ + i * BLOKK;
          const k = t + BLOKK / 2;
          if (!n.dolgozik) teglalap(x, t, oszlopW, BLOKK, { kitoltes: SZIN.pihenHatter });
          if (i > 0) vonal(x, t, x + oszlopW, t, 0.7, SZIN.vonal);

          ir(String(n.nap), x + OSZL.nap / 2, k - 4, 12, { felkover: true, igazit: 'kozep' });
          ir(HET_NAPJAI[n.hetNapja].toLowerCase(), x + OSZL.nap / 2, k + 8, 7, { igazit: 'kozep', szin: SZIN.halvany });

          vonal(xCimke, k, n.dolgozik ? xOra : xIdo, k);
          ir('Érkezett', xCimke + 5, t + BLOKK / 4, 8, { szin: SZIN.halvany });
          ir('Távozott', xCimke + 5, t + (3 * BLOKK) / 4, 8, { szin: SZIN.halvany });

          if (n.dolgozik) {
            ir(n.erkezett, xIdo + OSZL.ido / 2, t + BLOKK / 4, 10, { igazit: 'kozep' });
            ir(n.tavozott, xIdo + OSZL.ido / 2, t + (3 * BLOKK) / 4, 10, { igazit: 'kozep' });
            ir(oraSzoveg(n.orak), xOra + OSZL.ora / 2, k, 12, { felkover: true, igazit: 'kozep' });
          } else {
            const felirat = n.szabad ? 'szabadság' : OK_FELIRAT[n.ok] || n.ok;
            ir(felirat, xIdo + (OSZL.ido + OSZL.alairas) / 2, k, 8.5, { igazit: 'kozep', szin: SZIN.halvany });
            ir('–', xOra + OSZL.ora / 2, k, 10, { igazit: 'kozep', szin: SZIN.halvany });
          }
        });

        // függőleges vonalak: a fejlécben a csoportok között, a napoknál cellánként
        // (nem munkanapon az időpont és az aláírás egy cella)
        const napAlja = TABLA_TETO + TABLA_FEJ + napok.length * BLOKK;
        [xIdo, xAla, xOra].forEach((vx) => vonal(vx, TABLA_TETO, vx, TABLA_TETO + TABLA_FEJ, 0.5, SZIN.belso));
        napok.forEach((n, i) => {
          const t = TABLA_TETO + TABLA_FEJ + i * BLOKK;
          vonal(xCimke, t, xCimke, t + BLOKK, 0.7, SZIN.vonal);
          vonal(xIdo, t, xIdo, t + BLOKK);
          if (n.dolgozik) vonal(xAla, t, xAla, t + BLOKK);
          vonal(xOra, t, xOra, t + BLOKK, 0.7, SZIN.vonal);
        });
        vonal(x, TABLA_TETO + TABLA_FEJ, x + oszlopW, TABLA_TETO + TABLA_FEJ, 0.9, SZIN.vonal);

        if (oi === 0) {
          const t = napAlja;
          teglalap(x, t, oszlopW, BLOKK, { kitoltes: SZIN.fejHatter });
          vonal(x, t, x + oszlopW, t, 0.9, SZIN.vonal);
          ir('ÖSSZESEN', x + 8, t + BLOKK / 2, 7.5, { felkover: true });
          const reszletek = `${ledolgozott.length} nap${szabadDb ? ` · ${szabadDb} nap szabadság` : ''}`;
          ir(reszletek, xIdo + (OSZL.ido + OSZL.alairas) / 2, t + BLOKK / 2, 9, { igazit: 'kozep', szin: SZIN.halvany });
          ir(oraSzoveg(oraOssz), xOra + OSZL.ora / 2, t + BLOKK / 2, 12, { felkover: true, igazit: 'kozep' });
          vonal(xOra, t, xOra, t + BLOKK, 0.7, SZIN.vonal);
        }
        teglalap(x, TABLA_TETO, oszlopW, also - TABLA_TETO, { keret: SZIN.vonal });
      });

      // ---- Aláírások ----
      const tablaAlja = TABLA_TETO + TABLA_FEJ + 16 * BLOKK;
      const alairasY = LAP.h - LAP.margo - 16;
      ir('Kelt: ....................................................', LAP.margo, tablaAlja + 24, 9, { szin: SZIN.halvany });
      const sorW = 190;
      [[LAP.margo, 'munkavállaló aláírása'], [LAP.w - LAP.margo - sorW, 'munkáltató aláírása']].forEach(([sx, cimke]) => {
        vonal(sx, alairasY, sx + sorW, alairasY, 0.7, SZIN.vonal);
        ir(cimke, sx + sorW / 2, alairasY + 10, 7.5, { igazit: 'kozep', szin: SZIN.halvany });
      });
    });

    const bajtok = await doc.save();
    await letolt(`jelenleti_iv_${kulcs}.pdf`, bajtok, 'application/pdf');
  }

  // Fájl felajánlása letöltésre. Claude artifactként a platform letöltés-képességén át,
  // sima böngészőben egy ideiglenes letöltési linkkel.
  const LETOLTES_TILTVA = 'Ebben a nézetben a letöltés nem engedélyezett (a claude.ai linken csak bejelentkezve működik). '
    + 'Jelentkezz be, vagy használd az offline változatot: jelenleti-offline.html.';

  async function letolt(fajlnev, adat, tipus) {
    const blob = new Blob([adat], { type: tipus });
    // Claude artifactként a keretben csak a platform letöltés-képessége működik.
    if (window.claude && typeof window.claude.use === 'function') {
      const dl = await window.claude.use('downloads');
      if (!dl) { uzen(LETOLTES_TILTVA); return; }
      try { await dl.save({ filename: fajlnev, data: blob }); } catch (e) {
        const code = e && e.code;
        if (code === 'declined') return;
        uzen(code === 'rate_limited' ? 'Már nyitva van egy letöltési ablak – próbáld újra pár másodperc múlva.'
          : ['unavailable', 'not_granted', 'capability_disabled', 'capability_removed'].includes(code) || !code ? LETOLTES_TILTVA
            : 'A fájlt nem sikerült letölteni: ' + (e.message || code));
      }
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fajlnev;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }

  // ---------- Mentés / betöltés fájlba ----------
  function exportal() {
    letolt('jelenleti_adatok.json', JSON.stringify(allapot, null, 2), 'application/json');
  }

  function importal(fajl) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const s = JSON.parse(r.result);
        if (!Array.isArray(s.dolgozok)) throw new Error('hiányzó dolgozólista');
        allapot = normalizal(s);
        ment();
        rajzol();
      } catch (e) {
        uzen('Nem sikerült betölteni a fájlt: ' + e.message);
      }
    };
    r.readAsText(fajl);
  }

  // ---------- Indítás ----------
  const most = new Date();
  $('honap').value = `${most.getFullYear()}-${String(most.getMonth() + 1).padStart(2, '0')}`;
  $('honap').addEventListener('change', rajzol);
  $('ceg').addEventListener('change', () => { allapot.ceg = $('ceg').value.trim(); ment(); });
  ['pihenonap', 'munkanap'].forEach((tipus) => {
    $('ceg-' + tipus).addEventListener('change', (e) => {
      const kulcs = aktualisHonap().kulcs;
      allapot.cegszintu[kulcs] = Object.assign({}, allapot.cegszintu[kulcs], { [tipus]: e.target.value });
      ment();
      rajzol();
    });
  });
  $('uj-dolgozo').addEventListener('click', () => {
    allapot.dolgozok.push(ujDolgozo());
    ment();
    rajzol();
    const nevek = document.querySelectorAll('#munkavallalok-lista input[data-mezo=nev]');
    if (nevek.length) nevek[nevek.length - 1].focus();
  });
  document.querySelectorAll('[data-ful]').forEach((b) => b.addEventListener('click', () => fulValt(b.dataset.ful)));
  $('general').addEventListener('click', () => {
    pdfGeneral().catch((e) => { console.error(e); uzen('Hiba a PDF készítésekor: ' + e.message); });
  });
  $('export').addEventListener('click', exportal);
  $('import').addEventListener('change', (e) => { if (e.target.files[0]) importal(e.target.files[0]); e.target.value = ''; });

  let mentettFul = null;
  try { mentettFul = localStorage.getItem(TAROLO_KULCS + '-ful'); } catch (e) { /* nem kritikus */ }
  fulValt(mentettFul || (allapot.dolgozok.length ? 'havi' : 'munkavallalok'));
  rajzol();
})();
