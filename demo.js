// Demó: bejelentkezési képernyő és lépésenkénti bemutató az app fölött.
// A bejelentkezés csak látszat: semmit nem ellenőriz és semmit nem küld el.
(function () {
  const BELEPES_KULCS = 'jelenleti-demo-belepve';
  const TURA_LATTA_KULCS = 'jelenleti-demo-tura-latta';
  const $ = (id) => document.getElementById(id);

  const tarolo = {
    olvas(kulcs) { try { return sessionStorage.getItem(kulcs); } catch (e) { return null; } },
    ir(kulcs, ertek) { try { ertek == null ? sessionStorage.removeItem(kulcs) : sessionStorage.setItem(kulcs, ertek); } catch (e) { /* nem kritikus */ } },
  };

  // ---------- Bejelentkezés ----------
  function belep(email) {
    tarolo.ir(BELEPES_KULCS, email);
    $('felhasznalo-email').textContent = email;
    $('belepes').hidden = true;
    $('alkalmazas').hidden = false;
    window.scrollTo(0, 0);
    if (!tarolo.olvas(TURA_LATTA_KULCS)) turaIndit();
  }

  function kilep() {
    turaBezar();
    tarolo.ir(BELEPES_KULCS, null);
    $('alkalmazas').hidden = true;
    $('belepes').hidden = false;
    $('belepes-urlap').querySelector('button[type=submit]').focus();
  }

  $('belepes-urlap').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = $('belepes-email').value.trim();
    const hiba = $('belepes-hiba');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      hiba.textContent = 'Adj meg egy érvényes e-mail címet, például nev@ceg.hu.';
    } else if (!$('belepes-jelszo').value) {
      hiba.textContent = 'Add meg a jelszót. A demóban bármilyen jelszó jó.';
    } else {
      hiba.hidden = true;
      belep(email);
      return;
    }
    hiba.hidden = false;
  });

  $('kijelentkezes').addEventListener('click', kilep);

  $('demo-visszaallitas').addEventListener('click', () => {
    try { localStorage.removeItem('jelenleti-demo-v1'); } catch (e) { /* nem kritikus */ }
    location.reload();
  });

  // ---------- Bemutató ----------
  const LEPESEK = [
    {
      ful: 'havi', cel: '.fulek',
      cim: 'Üdv a demóban!',
      szoveg: 'Az app két fülből áll. A Munkavállalók fülön adod meg az embereket és a beosztásukat, a Havi jelenléti ív fülön pedig elkészül a PDF.',
    },
    {
      ful: 'munkavallalok', cel: '#munkavallalok-lista .dolgozo:nth-child(1) .racs',
      cim: 'Munkavállalói adatok',
      szoveg: 'Név, munkakör, adóazonosító jel, belépés és kilépés dátuma, munkakezdés. Mindez egyszer kell, utána minden hónapban ebből dolgozik.',
    },
    {
      ful: 'munkavallalok', cel: '#munkavallalok-lista .dolgozo:nth-child(2) .beosztas',
      cim: 'Heti beosztás',
      szoveg: 'A hét minden napjára megadható a napi óraszám. Mária részmunkaidős: hétfőn és szerdán dolgozik 4-4 órát. Az üres nap azt jelenti, hogy aznap nem dolgozik.',
    },
    {
      ful: 'havi', cel: '#honap',
      cim: 'Hónap kiválasztása',
      szoveg: 'Az ünnepnapokat, a hídnapokat és a ledolgozós szombatokat az app magától tudja, ezekkel nincs teendő.',
    },
    {
      ful: 'havi', cel: '#dolgozok .dolgozo:nth-child(1)',
      cim: 'Szabadság jelölése',
      szoveg: 'Fanninak ebben a hónapban két nap szabadsága van (piros). Kattints bármelyik fehér napra, és az is szabadnap lesz; az összesítő azonnal frissül.',
    },
    {
      ful: 'havi', cel: '#dolgozok .dolgozo:nth-child(3)',
      cim: 'Belépés hónap közben',
      szoveg: 'Bence a hónap közben lépett be, ezért az előtte lévő napok szürkék. Az ő ívére csak a belépése utáni munkanapok kerülnek.',
    },
    {
      ful: 'havi', cel: '#general',
      cim: 'Kész a PDF',
      szoveg: 'Egy kattintás, és letöltődik a hónap jelenléti íve: munkavállalónként egy A4-es oldal, összesítővel és aláírás-sorokkal. Próbáld ki!',
    },
  ];

  let aktualis = -1;
  let kiemelt = null;

  function kiemelesTorol() {
    if (kiemelt) kiemelt.classList.remove('kiemelt');
    kiemelt = null;
  }

  function lepesMutat(i) {
    aktualis = i;
    const lepes = LEPESEK[i];
    const ful = document.querySelector(`[data-ful="${lepes.ful}"]`);
    if (ful && ful.getAttribute('aria-selected') !== 'true') ful.click();

    kiemelesTorol();
    const el = document.querySelector(lepes.cel);
    if (el) {
      el.classList.add('kiemelt');
      kiemelt = el;
      const halk = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ block: 'start', behavior: halk ? 'auto' : 'smooth' });
    }

    $('tura-lepes').textContent = `${i + 1} / ${LEPESEK.length}`;
    $('tura-cim').textContent = lepes.cim;
    $('tura-szoveg').textContent = lepes.szoveg;
    $('tura-vissza').disabled = i === 0;
    $('tura-tovabb').textContent = i === LEPESEK.length - 1 ? 'Befejezés' : 'Tovább';
    $('tura').hidden = false;
  }

  // Ha az app újrarajzolja a kiemelt részt (pl. kattintás után), a kiemelés kerüljön vissza.
  new MutationObserver(() => {
    if (aktualis < 0 || (kiemelt && kiemelt.isConnected)) return;
    const el = document.querySelector(LEPESEK[aktualis].cel);
    if (el) { el.classList.add('kiemelt'); kiemelt = el; }
  }).observe($('alkalmazas'), { childList: true, subtree: true });

  function turaIndit() {
    lepesMutat(0);
    $('tura-tovabb').focus();
  }

  function turaBezar() {
    kiemelesTorol();
    $('tura').hidden = true;
    aktualis = -1;
    tarolo.ir(TURA_LATTA_KULCS, '1');
  }

  $('tura-inditas').addEventListener('click', turaIndit);
  $('tura-kihagy').addEventListener('click', turaBezar);
  $('tura-vissza').addEventListener('click', () => { if (aktualis > 0) lepesMutat(aktualis - 1); });
  $('tura-tovabb').addEventListener('click', () => {
    if (aktualis < LEPESEK.length - 1) lepesMutat(aktualis + 1);
    else turaBezar();
  });
  document.addEventListener('keydown', (e) => {
    if ($('tura').hidden) return;
    if (e.key === 'Escape') turaBezar();
  });

  // ---------- Indítás ----------
  const mentettEmail = tarolo.olvas(BELEPES_KULCS);
  if (!mentettEmail) $('belepes-urlap').querySelector('button[type=submit]').focus();
  if (mentettEmail) {
    $('felhasznalo-email').textContent = mentettEmail;
    $('belepes').hidden = true;
    $('alkalmazas').hidden = false;
  }
})();
