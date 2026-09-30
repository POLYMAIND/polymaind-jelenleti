// Magyar munkanaptár: ünnepnapok, áthelyezett munkanapok, szabadnap-lista értelmezése.
(function (global) {
  const HONAPOK = [
    'Január', 'Február', 'Március', 'Április', 'Május', 'Június',
    'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December',
  ];

  // Munkaszüneti napok miatti munkarend-változások (NGM rendeletek).
  // pihenonap: hétköznap, amikor nem dolgozunk; munkanap: szombat, amikor dolgozunk.
  // Új évnél ide kell felvenni a rendelet szerinti napokat (vagy az appban cégszinten megadni).
  const ATHELYEZESEK = {
    2025: { pihenonap: ['05-02', '10-24', '12-24'], munkanap: ['05-17', '10-18', '12-13'] },
    2026: { pihenonap: ['01-02', '08-21', '12-24'], munkanap: ['01-10', '08-08', '12-12'] },
  };

  const pad = (n) => String(n).padStart(2, '0');
  const mmdd = (d) => pad(d.getMonth() + 1) + '-' + pad(d.getDate());

  // Húsvétvasárnap (anonim gregorián algoritmus)
  function husvet(ev) {
    const a = ev % 19, b = Math.floor(ev / 100), c = ev % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const honap = Math.floor((h + l - 7 * m + 114) / 31);
    const nap = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(ev, honap - 1, nap);
  }

  function unnepnapok(ev) {
    const fix = ['01-01', '03-15', '05-01', '08-20', '10-23', '11-01', '12-25', '12-26'];
    const h = husvet(ev);
    const eltolt = (napok) => mmdd(new Date(ev, h.getMonth(), h.getDate() + napok));
    return new Set([...fix, eltolt(-2), eltolt(1), eltolt(50)]); // nagypéntek, húsvéthétfő, pünkösdhétfő
  }

  // "3, 4, 10-12" -> Set{3,4,10,11,12}
  function napListaErtelmez(szoveg, maxNap) {
    const eredmeny = new Set();
    const hibak = [];
    (szoveg || '').split(/[,;\s]+/).filter(Boolean).forEach((resz) => {
      const m = resz.match(/^(\d{1,2})(?:-(\d{1,2}))?$/);
      if (!m) { hibak.push(resz); return; }
      const tol = +m[1], ig = m[2] ? +m[2] : tol;
      if (tol < 1 || ig > maxNap || tol > ig) { hibak.push(resz); return; }
      for (let n = tol; n <= ig; n++) eredmeny.add(n);
    });
    return { napok: eredmeny, hibak };
  }

  function napokSzama(ev, honap) { // honap: 1-12
    return new Date(ev, honap, 0).getDate();
  }

  // A hónap napjai: { nap, munkanap, ok } ahol ok a nem munkanap oka.
  // extra: { pihenonap: Set, munkanap: Set } cégszintű eltérések az adott hónapra.
  function honapNapjai(ev, honap, extra) {
    const unnep = unnepnapok(ev);
    const ath = ATHELYEZESEK[ev] || { pihenonap: [], munkanap: [] };
    const napok = [];
    for (let n = 1; n <= napokSzama(ev, honap); n++) {
      const d = new Date(ev, honap - 1, n);
      const kulcs = mmdd(d);
      const hetvege = d.getDay() === 0 || d.getDay() === 6;
      let munkanap = !hetvege, ok = hetvege ? 'hétvége' : '';
      if (ath.munkanap.includes(kulcs)) { munkanap = true; ok = ''; }
      if (ath.pihenonap.includes(kulcs)) { munkanap = false; ok = 'áthelyezett pihenőnap'; }
      if (unnep.has(kulcs)) { munkanap = false; ok = 'ünnepnap'; }
      if (extra && extra.munkanap && extra.munkanap.has(n)) { munkanap = true; ok = ''; }
      if (extra && extra.pihenonap && extra.pihenonap.has(n)) { munkanap = false; ok = 'cégszintű pihenőnap'; }
      napok.push({ nap: n, munkanap, ok, hetNapja: d.getDay() });
    }
    return napok;
  }

  // "09:00" + 8 óra -> "17:00"
  function idoHozzaad(kezdes, orak) {
    const [h, m] = kezdes.split(':').map(Number);
    const perc = h * 60 + m + Math.round(orak * 60);
    return pad(Math.floor(perc / 60) % 24) + ':' + pad(perc % 60);
  }

  const api = { HONAPOK, ATHELYEZESEK, husvet, unnepnapok, napListaErtelmez, napokSzama, honapNapjai, idoHozzaad };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.Naptar = api;
})(typeof window !== 'undefined' ? window : globalThis);
