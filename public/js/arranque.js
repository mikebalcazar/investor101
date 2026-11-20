/* patron101 — el arranque: quién soy aquí, en qué empresa, y qué vista toca.
 *
 * 20-nov-2026 · PATRON101 ES SÓLO DE QUIEN PRESTA. Lo de quien dirige
 * —rondas, ofertas, préstamos, directorio, ajustes— vive en dash101, en el
 * menú «Préstamos» (Mike: «hay que meter patron101 a dash también. Igual que
 * bill101»; y con botones: «Mandarlo a dash101»). Quien dirige y abre esta
 * dirección llega solo allá, y cada liga vieja a su pantalla
 * (`I101.rutaEnDash`). A dónde queda dash101 lo sabe el Worker (`/a-dash`),
 * no esta página.
 *
 * Lo único que se busca aquí es CUÁL empresa: quien presta trae las suyas en
 * `/yo.inversion`. Se preguntan a la vez y la primera que abre COMO
 * INVERSIONISTA es la que se usa; si hay más de una, se cambia desde el menú
 * de la cuenta. Si ninguna abre así y la persona dirige alguna empresa, se
 * va a dash101.
 */
'use strict';
(() => {
  const { h } = I101;
  const RECORDADA = 'investor101:empresa';
  I101.sesion = { papel: null, empresa: null, hoy: null, resumen: null, yo: null, candidatas: [], dirige: false };

  /** Quien presta no tiene secciones: su cuenta es una sola pantalla con
   *  ligas. Aquí sólo se dice con qué empresa es la cuenta. */
  I101.pintarMenu = () => {
    document.getElementById('empresa').textContent = I101.sesion.empresa?.nombre || '';
    document.getElementById('menu').innerHTML = '';
    document.getElementById('pestanas').hidden = true;
    document.body.classList.remove('con-pestanas');
  };

  /* ─────────────── a dónde quedó cada pantalla de quien dirige ─────────────── */

  /** De la ruta vieja de patron101 (`#/ronda/ID`) a la de dash101
   *  (`/inversion/rondas/ID`). Lo que no se reconoce va al inicio de
   *  Préstamos. `consulta` es lo que venía después de `?` en el hash. */
  I101.rutaEnDash = (partes, consulta = '') => {
    const [a = '', b, c] = partes;
    const id = (x) => (/^[A-Za-z0-9_-]+$/.test(x || '') ? x : '');
    const P = '/inversion';
    if (a === 'rondas') return `${P}/rondas`;
    if (a === 'ronda' && b === 'nueva') return `${P}/rondas/nueva`;
    if (a === 'ronda' && id(b)) return `${P}/rondas/${b}${c === 'editar' ? '/editar' : ''}`;
    if (a === 'prestamos') return `${P}/prestamos`;
    if (a === 'prestamo' && b === 'nuevo') {
      const de = new URLSearchParams(consulta).get('de');
      return `${P}/prestamos/nuevo${id(de) ? `?de=${de}` : ''}`;
    }
    if (a === 'prestamo' && id(b)) return `${P}/prestamos/${b}`;
    if (a === 'inversionistas') return `${P}/inversionistas`;
    if (a === 'inversionista' && id(b)) return `${P}/inversionistas/${b}`;
    if (a === 'ajustes') return `${P}/ajustes`;
    return P;
  };
  /** La liga a dash101: el Worker sabe dónde vive (`URL_DASH`). */
  I101.ligaADash = (ruta = '/inversion') => `/a-dash?ruta=${encodeURIComponent(ruta)}`;

  function pintarCuenta() {
    const s = I101.sesion;
    const b = document.getElementById('b-cuenta'), m = document.getElementById('cuenta-menu');
    const correo = s.yo?.usuario?.correo || '';
    b.textContent = s.yo?.usuario?.nombre || correo.split('@')[0] || 'Cuenta';
    const otras = s.candidatas.filter((c) => c.id !== I101.org);
    m.innerHTML = `<p>${h(correo)}<br>Le prestas a ${h(s.empresa?.nombre || '')}</p>
      ${otras.map((c) => `<button data-empresa="${h(c.id)}">Cambiar a ${h(c.nombre)}</button>`).join('')}
      ${s.dirige ? `<a class="b" data-a-dash href="${h(I101.ligaADash())}">Lo de tu empresa, en dash101</a>` : ''}
      <button data-salir>Salir</button>`;
    b.onclick = () => { m.hidden = !m.hidden; b.setAttribute('aria-expanded', String(!m.hidden)); };
    m.querySelector('[data-salir]').onclick = async () => { try { await I101.api('/auth/salir', { metodo: 'POST' }); } catch { /* da igual */ } location.replace('/entrar.html'); };
    m.querySelectorAll('[data-empresa]').forEach((x) => { x.onclick = () => { try { localStorage.setItem(RECORDADA, x.dataset.empresa); } catch { /* sin almacén */ } location.hash = '#/'; location.reload(); }; });
    document.addEventListener('click', (ev) => { if (!ev.target.closest('.cuenta')) { m.hidden = true; b.setAttribute('aria-expanded', 'false'); } });
  }

  /* ─────────────── qué vista toca ─────────────── */

  I101.pintar = async () => {
    const [a = '', b] = I101.ruta();
    const vista = document.getElementById('vista');
    I101.pintarMenu();
    window.scrollTo(0, 0);
    // `data-lista` dice que la vista ya terminó de pintarse (lo leen las pruebas).
    vista.removeAttribute('data-lista');
    try {
      const V = I101.inversionista;
      if (a === 'ronda' && b) await V.ronda(b);
      else if (a === 'prestamo' && b) await V.prestamo(b);
      else if (a === '') await V.inicio();
      else return I101.ir('#/');
    } catch (e) {
      vista.innerHTML = `<section class="tarjeta"><h2>${e.cual === 'no_encontrado' ? 'Eso no está aquí' : 'No se pudo abrir'}</h2><p style="margin:0 0 12px">${h(e.cual === 'no_encontrado' ? 'Puede que la liga sea de otra cuenta, o que ya no exista.' : e.message)}</p><a class="b" href="#/">Ir al inicio</a></section>`;
    }
    vista.setAttribute('data-lista', '1');
    vista.focus({ preventScroll: true });
  };

  /* ─────────────── arranque ─────────────── */

  /** Cuáles de las empresas abren patron101 PARA QUIEN PRESTA, en el orden
   *  dado (la recordada primero), con lo que contestó cada una. `sirve(d)`
   *  dice si esa respuesta cuenta (20-nov-2026: sólo las que contestan con
   *  papel de inversionista; la que la persona dirige se lleva en dash101).
   *  Si son pocas se preguntan TODAS A LA VEZ (16-oct-2026: antes una tras
   *  otra, ~250 ms cada una); si son muchas, una por una hasta la primera
   *  que sirve, y las demás se ponen sin preguntar (sin respuesta: `d` nulo). */
  async function cualesAbren(orden, pregunta, sirve = () => true) {
    if (orden.length <= 6) {
      const r = await Promise.all(orden.map((c) => pregunta(c.id).then((d) => (sirve(d) ? { cand: c, d } : null), () => null)));
      return r.filter(Boolean);
    }
    const abren = [];
    for (const cand of orden) {
      if (abren.length) { abren.push({ cand, d: null }); continue; }
      try { const d = await pregunta(cand.id); if (sirve(d)) abren.push({ cand, d }); } catch { /* esa empresa no trae patron101, o no le toca */ }
    }
    return abren;
  }

  async function arrancar() {
    const vista = document.getElementById('vista');
    let yo;
    try { yo = await I101.api('/yo'); } catch (e) { vista.innerHTML = `<p class="aviso mal">${h(e.message)}</p>`; return; }
    I101.sesion.yo = yo;

    /* Las empresas a las que les presta, la recordada primero. Las que
     * dirige ya no se preguntan aquí: eso vive en dash101. */
    const lista = new Map();
    for (const p of yo.inversion || []) lista.set(p.org_id, { id: p.org_id, nombre: p.nombre });
    const dirige = !!yo.superadmin || (yo.orgs || []).some((x) => x.rol === 'owner' || x.rol === 'admin');
    let orden = [...lista.values()];
    let recordada = null;
    try { recordada = localStorage.getItem(RECORDADA); } catch { /* sin almacén */ }
    if (recordada && lista.has(recordada)) orden = [lista.get(recordada), ...orden.filter((x) => x.id !== recordada)];

    const respuestas = await cualesAbren(orden, (id) => I101.api(`/orgs/${encodeURIComponent(id)}/inversion`), (d) => d?.papel === 'inversionista');
    const abren = respuestas.map(({ cand, d }) => ({ id: cand.id, nombre: d?.empresa?.nombre ?? cand.nombre }));
    const portada = respuestas[0]?.d || null;
    if (portada) I101.org = respuestas[0].cand.id;
    if (!portada && dirige) {
      /* Quien dirige: a dash101, a la pantalla que corresponde a la liga con
       * la que llegó. Se deja una liga a la vista por si el navegador no
       * sigue la redirección. */
      const destino = I101.ligaADash(I101.rutaEnDash(I101.ruta(), location.hash.split('?')[1] || ''));
      document.getElementById('b-cuenta').hidden = true;
      vista.innerHTML = `<section class="tarjeta" data-a-dash><h2>Los préstamos de la empresa ya se llevan en dash101</h2>
        <p style="margin:0 0 12px">Las rondas, las ofertas, los préstamos y el directorio están en dash101, en el menú «Préstamos». Te llevamos…</p>
        <a class="b pri" href="${h(destino)}">Ir a dash101</a></section>`;
      vista.setAttribute('data-lista', '1');
      location.replace(destino);
      return;
    }
    if (!portada) {
      vista.innerHTML = `<section class="tarjeta"><h2>Todavía no hay nada que ver</h2>
        <p style="margin:0 0 12px">Entraste como ${h(yo.usuario?.correo || '')}, pero ese correo no está dado de alta como inversionista. Si te llegó una invitación, revisa que sea este mismo correo.</p>
        <button class="b" id="b-salir-vacio">Usar otro correo</button></section>`;
      document.getElementById('b-salir-vacio').onclick = async () => { try { await I101.api('/auth/salir', { metodo: 'POST' }); } catch { /* da igual */ } location.replace('/entrar.html'); };
      document.getElementById('b-cuenta').hidden = true;
      return;
    }
    Object.assign(I101.sesion, { papel: portada.papel, empresa: portada.empresa, hoy: portada.hoy, resumen: portada.resumen || null, candidatas: abren, dirige });
    document.title = `patron101 · ${portada.empresa.nombre}`;
    pintarCuenta();
    window.addEventListener('hashchange', I101.pintar);
    I101.pintar();
  }

  arrancar();
})();
