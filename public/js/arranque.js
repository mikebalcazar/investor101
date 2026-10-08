/* patron101 — el arranque: quién soy aquí, en qué empresa, y qué vista toca.
 *
 * La API dice el papel (`admin` o `inversionista`) al pedir la portada de una
 * empresa; aquí no se adivina. Lo único que se busca es CUÁL empresa: quien
 * presta trae la suya en `/yo.inversion`; quien dirige, en `/yo.orgs`. Se
 * prueba en ese orden y la primera que abre es la que se usa; si hay más de
 * una, se cambia desde el menú de la cuenta.
 */
'use strict';
(() => {
  const { h } = I101;
  const RECORDADA = 'investor101:empresa';
  I101.sesion = { papel: null, empresa: null, hoy: null, resumen: null, yo: null, candidatas: [] };

  const ICONOS = {
    inicio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/></svg>',
    rondas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    prestamos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg>',
    inversionistas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.900 2.100 6.500 5.500"/><path d="M16 4.800a3.500 3.500 0 0 1 0 6.400M18.500 14.900c1.600.800 2.700 2.500 3 5.100"/></svg>',
    ajustes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>',
  };
  const SECCIONES = [['inicio', 'Inicio', '#/'], ['rondas', 'Rondas', '#/rondas'], ['prestamos', 'Préstamos', '#/prestamos'], ['inversionistas', 'Inversionistas', '#/inversionistas'], ['ajustes', 'Ajustes', '#/ajustes']];
  /** A qué sección pertenece cada ruta, para marcarla en el menú. */
  const SECCION_DE = { '': 'inicio', rondas: 'rondas', ronda: 'rondas', prestamos: 'prestamos', prestamo: 'prestamos', inversionistas: 'inversionistas', inversionista: 'inversionistas', ajustes: 'ajustes' };

  I101.pintarMenu = () => {
    const s = I101.sesion;
    const menu = document.getElementById('menu'), pest = document.getElementById('pestanas');
    document.getElementById('empresa').textContent = s.empresa?.nombre || '';
    if (s.papel !== 'admin') { menu.innerHTML = ''; pest.hidden = true; document.body.classList.remove('con-pestanas'); return; }
    const actual = SECCION_DE[I101.ruta()[0] || ''] || '';
    const globo = (id) => (id === 'rondas' && s.resumen?.ofertas_pendientes ? `<span class="globo">${s.resumen.ofertas_pendientes}</span>` : '');
    menu.innerHTML = SECCIONES.map(([id, nombre, liga]) => `<a href="${liga}"${id === actual ? ' aria-current="page"' : ''}>${nombre} ${globo(id)}</a>`).join('');
    pest.innerHTML = SECCIONES.map(([id, nombre, liga]) => `<a href="${liga}"${id === actual ? ' aria-current="page"' : ''}>${ICONOS[id]}${globo(id)}<span>${nombre}</span></a>`).join('');
    pest.hidden = false;
    document.body.classList.add('con-pestanas');
  };

  function pintarCuenta() {
    const s = I101.sesion;
    const b = document.getElementById('b-cuenta'), m = document.getElementById('cuenta-menu');
    const correo = s.yo?.usuario?.correo || '';
    b.textContent = s.yo?.usuario?.nombre || correo.split('@')[0] || 'Cuenta';
    const otras = s.candidatas.filter((c) => c.id !== I101.org);
    m.innerHTML = `<p>${h(correo)}<br>${s.papel === 'admin' ? 'Diriges' : 'Le prestas a'} ${h(s.empresa?.nombre || '')}</p>
      ${otras.map((c) => `<button data-empresa="${h(c.id)}">Cambiar a ${h(c.nombre)}</button>`).join('')}
      <button data-salir>Salir</button>`;
    b.onclick = () => { m.hidden = !m.hidden; b.setAttribute('aria-expanded', String(!m.hidden)); };
    m.querySelector('[data-salir]').onclick = async () => { try { await I101.api('/auth/salir', { metodo: 'POST' }); } catch { /* da igual */ } location.replace('/entrar.html'); };
    m.querySelectorAll('[data-empresa]').forEach((x) => { x.onclick = () => { try { localStorage.setItem(RECORDADA, x.dataset.empresa); } catch { /* sin almacén */ } location.hash = '#/'; location.reload(); }; });
    document.addEventListener('click', (ev) => { if (!ev.target.closest('.cuenta')) { m.hidden = true; b.setAttribute('aria-expanded', 'false'); } });
  }

  /* ─────────────── qué vista toca ─────────────── */

  I101.pintar = async () => {
    const [a = '', b, c] = I101.ruta();
    const vista = document.getElementById('vista');
    const esAdmin = I101.sesion.papel === 'admin';
    I101.pintarMenu();
    window.scrollTo(0, 0);
    // `data-lista` dice que la vista ya terminó de pintarse (lo leen las pruebas).
    vista.removeAttribute('data-lista');
    try {
      if (esAdmin) {
        const A = I101.admin;
        if (a === '') await A.inicio();
        else if (a === 'rondas') await A.rondas();
        else if (a === 'ronda' && b === 'nueva') await A.rondaForm(null);
        else if (a === 'ronda' && b) await A.ronda(b, c);
        else if (a === 'prestamos') await A.prestamos();
        else if (a === 'prestamo' && b === 'nuevo') await A.prestamoNuevo();
        else if (a === 'prestamo' && b) await A.prestamo(b);
        else if (a === 'inversionistas') await A.inversionistas();
        else if (a === 'inversionista' && b) await A.inversionista(b);
        else if (a === 'ajustes') await A.ajustes();
        else return I101.ir('#/');
      } else {
        const V = I101.inversionista;
        if (a === 'ronda' && b) await V.ronda(b);
        else if (a === 'prestamo' && b) await V.prestamo(b);
        else if (a === '') await V.inicio();
        else return I101.ir('#/');
      }
    } catch (e) {
      vista.innerHTML = `<section class="tarjeta"><h2>${e.cual === 'no_encontrado' ? 'Eso no está aquí' : 'No se pudo abrir'}</h2><p style="margin:0 0 12px">${h(e.cual === 'no_encontrado' ? 'Puede que la liga sea de otra cuenta, o que ya no exista.' : e.message)}</p><a class="b" href="#/">Ir al inicio</a></section>`;
    }
    vista.setAttribute('data-lista', '1');
    vista.focus({ preventScroll: true });
  };

  /* ─────────────── arranque ─────────────── */

  async function arrancar() {
    const vista = document.getElementById('vista');
    let yo;
    try { yo = await I101.api('/yo'); } catch (e) { vista.innerHTML = `<p class="aviso mal">${h(e.message)}</p>`; return; }
    I101.sesion.yo = yo;

    /* Las empresas en las que podría tener algo que ver, en orden: la
     * recordada, las que le presta, y las que dirige (primero donde es
     * miembro de verdad: el dueño de la suite las trae todas). */
    const lista = new Map();
    for (const p of yo.inversion || []) lista.set(p.org_id, { id: p.org_id, nombre: p.nombre });
    for (const o of (yo.orgs || []).filter((x) => yo.superadmin || x.rol === 'owner' || x.rol === 'admin')) if (!lista.has(o.id)) lista.set(o.id, { id: o.id, nombre: o.nombre });
    let orden = [...lista.values()];
    let recordada = null;
    try { recordada = localStorage.getItem(RECORDADA); } catch { /* sin almacén */ }
    if (recordada && lista.has(recordada)) orden = [lista.get(recordada), ...orden.filter((x) => x.id !== recordada)];

    let portada = null;
    const abren = [];
    for (const cand of orden) {
      // Con la primera que abre basta para pintar; de las demás sólo hace
      // falta saber si abren, y eso se pregunta sólo si son pocas.
      if (portada && orden.length > 6) { abren.push(cand); continue; }
      try {
        const d = await I101.api(`/orgs/${encodeURIComponent(cand.id)}/inversion`);
        abren.push({ id: cand.id, nombre: d.empresa.nombre });
        if (!portada) { portada = d; I101.org = cand.id; }
      } catch { /* esa empresa no trae patron101, o no le toca */ }
    }
    if (!portada) {
      vista.innerHTML = `<section class="tarjeta"><h2>Todavía no hay nada que ver</h2>
        <p style="margin:0 0 12px">Entraste como ${h(yo.usuario?.correo || '')}, pero ese correo no está dado de alta como inversionista ni dirige una empresa con patron101. Si te llegó una invitación, revisa que sea este mismo correo.</p>
        <button class="b" id="b-salir-vacio">Usar otro correo</button></section>`;
      document.getElementById('b-salir-vacio').onclick = async () => { try { await I101.api('/auth/salir', { metodo: 'POST' }); } catch { /* da igual */ } location.replace('/entrar.html'); };
      document.getElementById('b-cuenta').hidden = true;
      return;
    }
    Object.assign(I101.sesion, { papel: portada.papel, empresa: portada.empresa, hoy: portada.hoy, resumen: portada.resumen || null, candidatas: abren });
    document.title = `patron101 · ${portada.empresa.nombre}`;
    pintarCuenta();
    window.addEventListener('hashchange', I101.pintar);
    I101.pintar();
  }

  arrancar();
})();
