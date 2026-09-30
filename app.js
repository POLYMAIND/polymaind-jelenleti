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

  // Az eredeti jelenléti ív koordinátái (pontban, a lap tetejétől mérve).
  const LAP = { w: 595.5, h: 842.25 };
  const HATTER = { x: -8.7725, y: 0, w: 631.738, h: 842.5675 };
  const ASC = 0.928; // Amiko ascender / em
  const FEJLEC = { ceg: [123.3, 80.9], nev: [125.8, 121.9], ev: [313.4, 121.9], honap: [410.6, 121.9] };
  // Az „Érkezett” sor teteje napokra (1–31); a „Távozott” 18 ponttal lejjebb.
  const SOR_TETO = [
    180.6, 216.8, 252.9, 287.1, 323.0, 358.9, 394.8, 431.1, 465.4, 501.5, 538.2, 574.1, 610.0, 644.1, 678.1,
    180.6, 214.6, 251.6, 287.5, 322.6, 358.7, 394.8, 430.9, 465.4, 501.3, 538.0, 574.6, 608.7, 644.9, 681.0, 717.1,
  ];
  const OSZLOP = [{ ido: 163.8, ora: 270.1 }, { ido: 436.2, ora: 542.3 }]; // középpontok

  async function pdfGeneral() {
    uzen('');
    const dolgozok = allapot.dolgozok.filter((d) => d.nev && aktivAHonapban(d));
    if (!dolgozok.length) { uzen('Ebben a hónapban nincs aktív, névvel megadott munkavállaló.'); return; }
    const { ev, honap, kulcs } = aktualisHonap();

    const { PDFDocument, rgb } = PDFLib;
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const font = await doc.embedFont(base64Bajtok(JELENLETI_ASSETS.font), { subset: true });
    const hatter = await doc.embedJpg(base64Bajtok(JELENLETI_ASSETS.background));
    const fekete = rgb(0, 0, 0);

    const ir = (lap, szoveg, x, teto, meret, kozepre) => {
      const w = font.widthOfTextAtSize(szoveg, meret);
      lap.drawText(szoveg, {
        x: kozepre ? x - w / 2 : x,
        y: LAP.h - (teto + ASC * meret),
        size: meret, font, color: fekete,
      });
    };

    dolgozok.forEach((d) => {
      const lap = doc.addPage([LAP.w, LAP.h]);
      lap.drawImage(hatter, { x: HATTER.x, y: LAP.h - HATTER.y - HATTER.h, width: HATTER.w, height: HATTER.h });
      ir(lap, allapot.ceg, ...FEJLEC.ceg, 14);
      ir(lap, d.nev, ...FEJLEC.nev, 14);
      ir(lap, String(ev), ...FEJLEC.ev, 14);
      ir(lap, Naptar.HONAPOK[honap - 1], ...FEJLEC.honap, 14);

      dolgozoNapjai(d).forEach((n) => {
        const oszlop = OSZLOP[n.nap <= 15 ? 0 : 1];
        const teto = SOR_TETO[n.nap - 1];
        if (n.dolgozik) {
          ir(lap, n.erkezett, oszlop.ido, teto, 11, true);
          ir(lap, n.tavozott, oszlop.ido, teto + 18, 11, true);
          ir(lap, String(n.orak).replace('.', ','), oszlop.ora, teto + 7.7, 11, true);
        } else {
          ir(lap, '--------', oszlop.ido, teto, 11, true);
          ir(lap, '--------', oszlop.ido, teto + 18, 11, true);
        }
      });
    });

    const bajtok = await doc.save();
    await letolt(`jelenleti_iv_${kulcs}.pdf`, bajtok, 'application/pdf');
  }

  // Fájl felajánlása letöltésre. Claude artifactként a platform letöltés-képességén át,
  // sima böngészőben egy ideiglenes letöltési linkkel.
  async function letolt(fajlnev, adat, tipus) {
    const blob = new Blob([adat], { type: tipus });
    const dl = window.claude && typeof window.claude.use === 'function' ? await window.claude.use('downloads') : null;
    if (dl) {
      try { await dl.save({ filename: fajlnev, data: blob }); } catch (e) {
        if (e && e.code !== 'declined') uzen('A fájlt nem sikerült letölteni: ' + (e.message || e.code));
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
