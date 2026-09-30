/* global Naptar, PDFLib, fontkit, JELENLETI_ASSETS */
(function () {
  const TAROLO_KULCS = 'jelenleti-v1';

  // ---------- Állapot ----------
  function alapAllapot() {
    return {
      ceg: 'Polymaind Kft.',
      dolgozok: [{ id: ujId(), nev: '', orak: 8, kezdes: '09:00' }],
      szabadnapok: {}, // { 'ÉÉÉÉ-HH': { dolgozoId: [napok] } }
      cegszintu: {}, // { 'ÉÉÉÉ-HH': { pihenonap: '1, 2', munkanap: '' } }
    };
  }
  function ujId() { return Math.random().toString(36).slice(2, 10); }

  function betolt() {
    try {
      const s = JSON.parse(localStorage.getItem(TAROLO_KULCS));
      if (s && Array.isArray(s.dolgozok)) return Object.assign(alapAllapot(), s);
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

  // Egy dolgozó napjai a hónapban: { nap, dolgozik, erkezett, tavozott, orak }
  function dolgozoNapjai(dolgozo) {
    const szabad = szabadnapjai(dolgozo.id);
    return honapNapjai().map((n) => {
      const dolgozik = n.munkanap && !szabad.has(n.nap);
      return {
        nap: n.nap,
        dolgozik,
        erkezett: dolgozik ? dolgozo.kezdes : null,
        tavozott: dolgozik ? Naptar.idoHozzaad(dolgozo.kezdes, dolgozo.orak) : null,
        orak: dolgozik ? dolgozo.orak : null,
      };
    });
  }

  // ---------- Felület ----------
  const HET_NAPJAI = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'];

  function rajzol() {
    $('ceg').value = allapot.ceg;
    const napok = honapNapjai();
    const elteres = cegszintuEltereses();
    const { kulcs } = aktualisHonap();
    const c = allapot.cegszintu[kulcs] || {};
    $('ceg-pihenonap').value = c.pihenonap || '';
    $('ceg-munkanap').value = c.munkanap || '';
    $('ceg-hiba').textContent = elteres.hibak.length ? 'Nem értelmezhető: ' + elteres.hibak.join(', ') : '';

    const munkanapDb = napok.filter((n) => n.munkanap).length;
    $('honap-info').textContent = `${munkanapDb} munkanap ebben a hónapban`;

    const lista = $('dolgozok');
    lista.innerHTML = '';
    allapot.dolgozok.forEach((d) => {
      const napjai = dolgozoNapjai(d);
      const ledolgozott = napjai.filter((n) => n.dolgozik);
      const szabad = szabadnapjai(d.id);

      const kartya = document.createElement('div');
      kartya.className = 'dolgozo';
      kartya.innerHTML = `
        <div class="dolgozo-fej">
          <label class="mezo nev"><span>Név</span><input type="text" data-mezo="nev" placeholder="Dolgozó neve"></label>
          <label class="mezo"><span>Napi óra</span><input type="number" data-mezo="orak" min="1" max="12" step="0.5"></label>
          <label class="mezo"><span>Kezdés</span><input type="time" data-mezo="kezdes" step="900"></label>
          <button class="torol" title="Dolgozó törlése" aria-label="Dolgozó törlése">✕</button>
        </div>
        <div class="naptar"></div>
        <div class="osszesito">${ledolgozott.length} nap · ${ledolgozott.length * d.orak} óra${szabad.size ? ` · ${szabad.size} szabadnap` : ''}</div>`;

      kartya.querySelectorAll('input[data-mezo]').forEach((inp) => {
        const mezo = inp.dataset.mezo;
        inp.value = d[mezo];
        inp.addEventListener('change', () => {
          if (mezo === 'orak') {
            const v = parseFloat(inp.value);
            if (!(v > 0 && v <= 24)) { inp.value = d.orak; return; }
            d.orak = v;
          } else if (mezo === 'kezdes') {
            if (!/^\d{2}:\d{2}$/.test(inp.value)) { inp.value = d.kezdes; return; }
            d.kezdes = inp.value;
          } else {
            d[mezo] = inp.value.trim();
          }
          ment();
          rajzol();
        });
      });
      kartya.querySelector('.torol').addEventListener('click', () => {
        if (!confirm(`Biztosan törlöd: ${d.nev || 'névtelen dolgozó'}?`)) return;
        allapot.dolgozok = allapot.dolgozok.filter((x) => x.id !== d.id);
        ment();
        rajzol();
      });

      const naptar = kartya.querySelector('.naptar');
      napok.forEach((n) => {
        const cella = document.createElement('button');
        cella.type = 'button';
        cella.className = 'nap';
        cella.innerHTML = `<small>${HET_NAPJAI[n.hetNapja]}</small>${n.nap}`;
        if (!n.munkanap) {
          cella.classList.add('pihen');
          cella.disabled = true;
          cella.title = n.ok;
        } else if (szabad.has(n.nap)) {
          cella.classList.add('szabad');
          cella.title = 'Szabadnap – kattints a visszavonáshoz';
        } else {
          cella.title = 'Munkanap – kattints, ha szabadnap';
        }
        cella.addEventListener('click', () => szabadnapValt(d.id, n.nap));
        naptar.appendChild(cella);
      });

      lista.appendChild(kartya);
    });
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
    const dolgozok = allapot.dolgozok.filter((d) => d.nev);
    if (!dolgozok.length) { alert('Adj meg legalább egy dolgozót névvel.'); return; }
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
    const blob = new Blob([bajtok], { type: 'application/pdf' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `jelenleti_iv_${kulcs}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }

  // ---------- Mentés / betöltés fájlba ----------
  function exportal() {
    const blob = new Blob([JSON.stringify(allapot, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'jelenleti_adatok.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }

  function importal(fajl) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const s = JSON.parse(r.result);
        if (!Array.isArray(s.dolgozok)) throw new Error('hiányzó dolgozólista');
        allapot = Object.assign(alapAllapot(), s);
        ment();
        rajzol();
      } catch (e) {
        alert('Nem sikerült betölteni a fájlt: ' + e.message);
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
    allapot.dolgozok.push({ id: ujId(), nev: '', orak: 8, kezdes: '09:00' });
    ment();
    rajzol();
  });
  $('general').addEventListener('click', () => {
    pdfGeneral().catch((e) => { console.error(e); alert('Hiba a PDF készítésekor: ' + e.message); });
  });
  $('export').addEventListener('click', exportal);
  $('import').addEventListener('change', (e) => { if (e.target.files[0]) importal(e.target.files[0]); e.target.value = ''; });

  rajzol();
})();
