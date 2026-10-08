/* investor101 manejado con un navegador, contra la API de verdad.
 *
 * Lo que se mide es el camino completo que pidió Mike (8-oct-2026): quien
 * dirige da de alta a su gente, abre una ronda y avisa; quien presta entra
 * con su correo, dice con cuánto le entra, deposita y ve su estado de
 * cuenta; quien dirige acepta, marca el depósito, edita la tabla; se paga, y
 * el préstamo se liquida.
 *
 * Son DOS personas en dos navegadores —escritorio y celular—, y lo que una
 * hace lo tiene que ver la otra. Cada paso se comprueba dos veces: en la
 * pantalla y preguntándole a la API por su cuenta. Que la pantalla diga
 * «guardado» no es prueba de nada.
 *
 *   BASE   dónde está investor101 (por omisión el servidor local de pruebas)
 *   API    la suite101-api a la que le habla (sólo para preguntarle directo)
 *
 * Sólo corre contra una API que no sea producción: crea una empresa de
 * prueba (`i101-…`) y al final la borra.
 */
import { chromium } from 'playwright';

const BASE = (process.env.BASE || 'http://127.0.0.1:8797').replace(/\/$/, '');
const API = (process.env.API || 'http://127.0.0.1:8787').replace(/\/$/, '');
const CORREO = process.env.CORREO_SUPERADMIN || 'mike@forespot.com';
const ORG = `i101-${process.env.GITHUB_RUN_ID || Date.now()}${Number(process.env.GITHUB_RUN_ATTEMPT || 1) > 1 ? '-' + process.env.GITHUB_RUN_ATTEMPT : ''}`.slice(0, 40);
const ANA = `ana-${ORG}@ejemplo.mx`;

let fallas = 0, revisadas = 0;
const dice = (ok, que, dato = '') => { revisadas++; if (!ok) fallas++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${que}${dato !== '' ? '  →  ' + dato : ''}`); };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── la API, preguntada directo (sin pasar por investor101) ── */
let galleta = '';
async function api(ruta, { method = 'GET', body, app = 'investor101' } = {}) {
  const h = { 'Content-Type': 'application/json' };
  if (app) h['X-App'] = app;
  if (galleta) h.Cookie = galleta;
  const r = await fetch(API + ruta, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const puesta = r.headers.get('set-cookie');
  if (puesta) galleta = puesta.split(';')[0];
  let d = {}; try { d = await r.json(); } catch { /* sin JSON */ }
  return { estado: r.status, ...d };
}
const inv = (ruta, o) => api(`/orgs/${ORG}/inversion${ruta}`, o);

let cuenta = '', hoy = '';

async function preparar() {
  const salud = await api('/salud', { app: '' });
  if (salud.data?.entorno === 'produccion') { console.log('Esta prueba no corre contra producción.'); process.exit(1); }
  const cod = await api('/auth/codigo', { method: 'POST', body: { correo: CORREO }, app: '' });
  if (!cod.data?.codigo_prueba) { console.log('La API no devuelve el código de prueba: ' + JSON.stringify(cod)); process.exit(1); }
  await api('/auth/entrar', { method: 'POST', body: { correo: CORREO, codigo: cod.data.codigo_prueba }, app: '' });
  const alta = await api('/admin/orgs', { method: 'POST', body: { id: ORG, nombre: 'Taller de prueba', apps: { investor: true, dash: true } }, app: '' });
  dice(alta.estado === 201, 'empresa de prueba con investor101 prendido', `${ORG} · ${alta.estado}`);
  const cta = await api(`/orgs/${ORG}/cuentas`, { method: 'POST', app: 'dash101', body: { nombre: 'Banco de prueba', tipo: 'banco', moneda: 'MXN', saldo_inicial: 0 } });
  dice(cta.estado === 201, 'una cuenta de banco, creada desde dash101', String(cta.estado));
  cuenta = cta.data?.id;
  hoy = (await inv('')).data?.hoy;
}

/** Entra por la pantalla de entrada, como una persona: correo, «no tengo
 *  contraseña», el código (fuera de producción la API lo devuelve en la
 *  respuesta) y la contraseña nueva si la pide. `destino` es la liga de un
 *  correo: tiene que sobrevivir a la entrada. */
async function entrarPorPantalla(p, correo, destino = '') {
  await p.goto(BASE + '/' + destino, { waitUntil: 'load' });
  await p.waitForURL(/entrar\.html/);
  await p.fill('#correo', correo);
  await p.click('#b-correo');
  const respuesta = p.waitForResponse((r) => r.url().includes('/s101/auth/codigo'));
  await p.click('#b-olvide');
  const codigo = (await (await respuesta).json()).data?.codigo_prueba;
  await p.fill('#codigo', String(codigo));
  await p.click('#b-codigo');
  await Promise.race([p.waitForURL((u) => new URL(u).pathname === '/', { timeout: 20000 }), p.locator('#nueva').waitFor({ state: 'visible', timeout: 20000 })]);
  if (await p.locator('#nueva').isVisible().catch(() => false)) {
    const clave = 'Ronda-de-prueba-' + ORG;
    await p.fill('#nueva', clave); await p.fill('#nueva2', clave);
    await p.click('#b-nueva');
    await p.waitForURL((u) => new URL(u).pathname === '/', { timeout: 20000 });
  }
  await p.locator('main h1').first().waitFor({ timeout: 30000 });
}

const titulo = (p) => p.locator('main h1').first().innerText();
const desborde = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const cifra = (p, etiqueta) => p.locator('.cifra', { hasText: etiqueta }).locator('.v').innerText();
/** Va a una ruta de la app y espera a que la vista cambie. */
async function ir(p, ruta, h1) {
  await p.evaluate((r) => { document.getElementById('vista').removeAttribute('data-lista'); if (location.hash === r) window.I101.pintar(); else location.hash = r; }, ruta);
  await p.locator('#vista[data-lista]').waitFor({ timeout: 20000 });
  await p.locator('main h1', { hasText: h1 }).first().waitFor({ timeout: 20000 });
}

const nav = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
function vigilar(p, errores, ajenos, rotos) {
  p.on('pageerror', (e) => errores.push(String(e.message).slice(0, 200)));
  // Un 403/404/409 que la app provoca a propósito sale en consola como
  // «Failed to load resource»: no es falla. Lo propio que falte lo cuenta `rotos`.
  p.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/Failed to load resource/.test(t)) errores.push(t.slice(0, 200)); });
  p.on('request', (r) => { const u = new URL(r.url()); if (u.origin !== new URL(BASE).origin && !/^(data|blob|about)/.test(u.protocol)) ajenos.push(u.host); });
  p.on('response', (r) => { const u = new URL(r.url()); if (r.status() >= 400 && u.origin === new URL(BASE).origin && !u.pathname.startsWith('/s101/')) rotos.push(r.status() + ' ' + u.pathname); });
}

try {
  await preparar();

  /* ══════════ sin sesión no se entrega nada ══════════ */
  console.log('\n== La puerta ==');
  {
    const r = await fetch(BASE + '/', { redirect: 'manual' });
    dice(r.status === 302 && (r.headers.get('location') || '').endsWith('/entrar.html'), 'sin sesión, la app manda a entrar', `${r.status} → ${r.headers.get('location')}`);
    for (const f of ['/js/admin.js', '/js/nucleo.js', '/app.css', '/vendor/jspdf.js']) {
      const x = await fetch(BASE + f, { redirect: 'manual' });
      dice(x.status === 401, `sin sesión, ${f} no se entrega`, String(x.status));
    }
    const e = await fetch(BASE + '/entrar.html');
    dice(e.status === 200 && (await e.text()).includes('patron<span'), 'la pantalla de entrada sí es pública y dice patron101');
    const s = await fetch(BASE + `/s101/orgs/${ORG}/inversion`);
    dice(s.status === 401, 'sin sesión, nada se abre por el puente', String(s.status));
  }

  /* ══════════ escritorio: quien dirige ══════════ */
  console.log('\n== Escritorio 1440×900, quien dirige ==');
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errores = [], ajenos = [], rotos = [];
  vigilar(p, errores, ajenos, rotos);
  await entrarPorPantalla(p, CORREO);
  // El dueño de la suite trae todas las empresas: se le fija la de prueba.
  await p.evaluate((o) => { localStorage.setItem('investor101:empresa', o); }, ORG);
  await p.reload({ waitUntil: 'load' });
  await p.locator('main h1', { hasText: 'Inicio' }).waitFor({ timeout: 30000 });
  dice((await p.locator('#empresa').innerText()) === 'Taller de prueba', 'abre la empresa de prueba, como quien dirige');
  dice((await p.locator('header nav.menu a').count()) === 5, 'el menú trae sus cinco secciones', (await p.locator('header nav.menu a').allInnerTexts()).join(' · '));
  dice((await cifra(p, 'Capital que se debe')) === '$0', 'arranca sin deber nada');

  // — el directorio —
  await ir(p, '#/inversionistas', 'Inversionistas');
  await p.getByRole('button', { name: 'Dar de alta' }).click();
  await p.fill('#alta [name=nombre]', 'Ana Robles');
  await p.fill('#alta [name=correo]', ANA);
  await p.fill('#alta [name=telefono]', '55 1234 5678');
  await p.fill('#alta [name=clabe]', '002180012345678901');
  await p.locator('#alta button.pri').click();
  await p.locator('main .lista li', { hasText: 'Ana Robles' }).waitFor();
  await p.getByRole('button', { name: 'Pegar una lista' }).click();
  await p.fill('#alta [name=lista]', `Beto Cruz, beto-${ORG}@ejemplo.mx, 81 5555 0000\nCaro Díaz\tcaro-${ORG}@ejemplo.mx\nSin Arroba, esto-no-es-correo.mx`);
  await p.locator('#alta button.pri').click();
  await p.locator('#alta [data-resultado] .aviso').waitFor();
  dice((await p.locator('#alta [data-resultado]').innerText()).includes('Entraron 2'), 'de una lista pegada entran los buenos y se dice cuál no', (await p.locator('#alta [data-resultado] .pre').innerText()).slice(0, 80));
  let dir = (await inv('/inversionistas')).data.filas;
  dice(dir.length === 3 && dir.every((f) => f.es_prospecto), 'los tres quedaron en el directorio, como prospectos (API)', dir.map((f) => f.nombre).join(', '));
  const ana = dir.find((f) => f.nombre === 'Ana Robles');
  dice(ana?.correo === ANA && ana?.telefono === '5512345678' && !!ana?.usuario_id, 'Ana quedó con correo, teléfono y cuenta para entrar (API)');

  // — los ajustes —
  await ir(p, '#/ajustes', 'Ajustes');
  await p.fill('[name=instrucciones]', 'BBVA · CLABE 012180001234567895 · Taller de prueba SA de CV');
  await p.fill('[name=representante]', 'Mike Balcázar');
  await p.fill('[name=lugar]', 'Ciudad de México');
  await p.locator('#f-ajustes button.pri').click();
  await p.locator('#avisos div', { hasText: 'Ajustes guardados' }).waitFor();

  // — la ronda —
  await ir(p, '#/ronda/nueva', 'Nueva ronda');
  dice((await p.inputValue('[name=instrucciones]')).includes('CLABE 012180001234567895'), 'la ronda nueva ya trae a dónde depositar, de los ajustes');
  await p.fill('[name=nombre]', 'Puente de prueba');
  await p.fill('[name=descripcion]', 'Tres semanas de nómina mientras se cobra la obra.');
  await p.fill('[name=meta]', '90,000');
  await p.fill('[name=tasa]', '3');
  const inicio = await p.inputValue('[name=fecha_inicio]');
  const vence = await p.inputValue('[name=fecha_vencimiento]');
  const sim = (await api(`/orgs/${ORG}/inversion/simular`, { method: 'POST', body: { monto: 1000000, tipo_tasa: 'mensual', tasa_pb: 300, esquema: 'unico', fecha_inicio: inicio, fecha_vencimiento: vence } })).data;
  const esperado = '$' + (sim.totales.total / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 });
  await p.locator('[data-simulacion] tfoot td', { hasText: esperado }).waitFor({ timeout: 15000 }).catch(() => {});
  const pintado = await p.locator('[data-simulacion] tfoot td').last().innerText();
  dice(pintado === esperado && sim.totales.interes > 0, 'la tabla que se ve al teclear es la de la API, al centavo', `${pintado} = ${esperado}`);
  // En parcialidades el formulario cambia de campos y la tabla crece.
  await p.locator('label.opcion', { hasText: 'En parcialidades' }).click();
  await p.fill('[name=num_pagos]', '4');
  await p.waitForFunction(() => document.querySelectorAll('[data-simulacion] tbody tr').length === 4, null, { timeout: 15000 });
  dice(await p.locator('[name=fecha_vencimiento]').isHidden(), 'en parcialidades se esconde «se paga todo el» y la tabla trae 4 pagos');
  await p.locator('label.opcion', { hasText: 'Un solo pago' }).click();
  await p.locator('#b-guardar-ronda').click();
  await p.locator('main h1', { hasText: 'Puente de prueba' }).waitFor({ timeout: 20000 });
  dice((await titulo(p)).includes('Borrador'), 'la ronda nace en borrador');
  let rondas = (await inv('/rondas')).data.filas;
  const ronda = rondas[0];
  dice(rondas.length === 1 && ronda.monto_meta === 9000000 && ronda.tasa_pb === 300 && ronda.esquema === 'unico' && ronda.estado === 'borrador', 'quedó en la base con su meta en centavos y su tasa en puntos base (API)', `${ronda.monto_meta} · ${ronda.tasa_pb}`);

  await p.getByRole('button', { name: 'Abrir la ronda' }).click();
  await p.locator('#panel-avisar .tarjeta').waitFor({ timeout: 20000 });
  dice((await titulo(p)).includes('Abierta'), 'se abre, y enseguida ofrece avisar');
  dice((await p.locator('#panel-avisar .lista li').count()) === 3, 'el aviso lista a los tres del directorio');
  const wa = await p.locator('#panel-avisar .lista li', { hasText: 'Ana Robles' }).locator('a.wa').getAttribute('href');
  dice(/^https:\/\/wa\.me\/525512345678\?text=/.test(wa || '') && decodeURIComponent(wa).includes('Puente de prueba') && decodeURIComponent(wa).includes('$90,000.00'), 'la liga de WhatsApp de Ana lleva su número con lada y el mensaje ya escrito');
  dice((await p.locator('#panel-avisar .lista li', { hasText: 'Caro Díaz' }).locator('a.wa').count()) === 0, 'quien no tiene teléfono no trae botón de WhatsApp');
  await p.locator('#b-enviar-aviso').click();
  await p.locator('#panel-avisar [data-resultado]', { hasText: 'No salió' }).first().waitFor({ timeout: 20000 });
  dice((await p.locator('#panel-avisar [data-resultado]', { hasText: /No salió: (en este entorno de pruebas el correo no sale|el correo no está configurado)/ }).count()) === 3, 'fuera de producción el correo no sale, y la pantalla lo dice en vez de fingir');

  /* ══════════ celular: quien presta ══════════ */
  console.log('\n== Celular 390×844, quien presta ==');
  const ctx2 = await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const m = await ctx2.newPage();
  const errores2 = [], ajenos2 = [], rotos2 = [];
  vigilar(m, errores2, ajenos2, rotos2);
  // Entra por la liga del correo: tiene que caer en la ronda, no en la portada.
  await entrarPorPantalla(m, ANA, `#/ronda/${ronda.id}`);
  await m.locator('main h1', { hasText: 'Puente de prueba' }).waitFor({ timeout: 20000 });
  dice(true, 'la liga del correo sobrevive a la entrada: cae directo en la ronda');
  dice(await m.locator('#pestanas').isHidden() && (await m.locator('header nav.menu a').count()) === 0, 'a quien presta no se le pinta el menú de quien dirige');
  dice((await m.locator('main').innerText()).includes('Faltan $90,000.00'), 've el avance total de la ronda');
  dice(!(await m.locator('main').innerText()).includes('CLABE'), 'todavía no ve a dónde depositar');
  await m.fill('#f-oferta [name=monto]', '50000');
  await m.locator('[data-mi-tabla] h3', { hasText: 'Con $50,000.00' }).waitFor({ timeout: 15000 });
  const mia = (await api(`/orgs/${ORG}/inversion/simular`, { method: 'POST', body: { monto: 5000000, tipo_tasa: 'mensual', tasa_pb: 300, esquema: 'unico', fecha_inicio: inicio, fecha_vencimiento: vence } })).data;
  const promesa = await m.locator('[data-mi-tabla] h3').innerText();
  dice(promesa.includes('$' + (mia.totales.total / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 })), 'le dice cuánto le regresan con su monto, con la cuenta de la API', promesa);
  await m.locator('#f-oferta button.acc').click();
  await m.locator('#f-oferta h2', { hasText: 'en revisión' }).waitFor({ timeout: 20000 });
  let vista = (await inv(`/rondas/${ronda.id}`)).data;
  dice(vista.ofertas.length === 1 && vista.ofertas[0].monto === 5000000 && vista.ofertas[0].estado === 'pendiente' && vista.ofertas[0].inversionista_nombre === 'Ana Robles', '«le entro» dejó su oferta pendiente por $50,000 (API)');
  dice((await desborde(m)) <= 1, 'la ronda no se desborda a lo ancho en el celular', (await desborde(m)) + ' px');
  // Lo de quien dirige no se le abre aunque teclee la dirección.
  await m.evaluate(() => { location.hash = '#/inversionistas'; });
  await m.locator('main h1', { hasText: 'Hola, Ana' }).waitFor({ timeout: 20000 });
  const negado = await m.evaluate(async (o) => (await fetch(`/s101/orgs/${o}/inversion/inversionistas`)).status, ORG);
  const negado2 = await m.evaluate(async (o) => (await fetch(`/s101/orgs/${o}/movimientos`)).status, ORG);
  dice(negado === 403 && negado2 === 403, 'el directorio y los movimientos de la empresa le contestan 403', `${negado} · ${negado2}`);

  /* ══════════ quien dirige acepta ══════════ */
  console.log('\n== Aceptar, depositar, pagar ==');
  await ir(p, `#/ronda/${ronda.id}`, 'Puente de prueba');
  await p.locator('[data-oferta]', { hasText: 'Ana Robles' }).getByRole('button', { name: 'Aceptar' }).click();
  await p.locator('[data-panel-oferta] [data-simulacion] table').waitFor({ timeout: 15000 });
  dice(await p.locator('[data-panel-oferta] [data-campos]').isHidden(), 'al aceptar se ve la tabla que resulta; las condiciones sólo si se piden distintas');
  await p.locator('[data-panel-oferta] button.pri').click();
  await p.locator('[data-oferta]', { hasText: 'Aceptada' }).waitFor({ timeout: 20000 });
  let prestamos = (await inv('/prestamos')).data.filas;
  const pr = prestamos[0];
  dice(prestamos.length === 1 && pr.estado === 'por_depositar' && pr.monto === 5000000 && pr.tasa_pb === 300, 'la oferta aceptada es un préstamo por depositar (API)', pr.folio);
  dice((await p.locator('main').innerText()).includes('$50,000.00 aceptado de $90,000.00'), 'la ronda ya cuenta lo aceptado');

  // Ana lo ve, deposita y sube su comprobante.
  await ir(m, '#/', 'Hola, Ana');
  dice((await m.locator('.tarjeta.realce').innerText()).includes('Te aceptaron $50,000.00'), 'a Ana le aparece que la aceptaron y qué sigue');
  await m.locator('.tarjeta.realce').click();
  await m.locator('main h1', { hasText: '$50,000' }).waitFor({ timeout: 20000 });
  dice((await m.locator('.tarjeta.realce .pre').innerText()).includes('CLABE 012180001234567895'), 'ya aceptada, ve a dónde depositar');
  await m.locator('.tarjeta.realce [data-subir] input[type=file]').setInputFiles({ name: 'comprobante.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 prueba') });
  await m.locator('.tarjeta.realce .aviso.bien').waitFor({ timeout: 20000 });
  let detalle = (await inv(`/prestamos/${pr.id}`)).data;
  dice(detalle.archivos.length === 1 && detalle.archivos[0].clase === 'comprobante_deposito', 'su comprobante quedó en el préstamo (API)');
  // El pagaré: se arma con lo que dio la API, y dice BORRADOR mientras no llega el dinero.
  const pdf = await m.evaluate(async (id) => {
    const pp = await window.I101.inv(`/prestamos/${id}`);
    const doc = await window.I101.armarPagare(pp);
    return { paginas: doc.getNumberOfPages(), bytes: doc.output('arraybuffer').byteLength, letra: window.I101.montoConLetra(pp.monto), otros: [100, 2100000, 100000000, 3141592, 150075].map(window.I101.montoConLetra) };
  }, pr.id);
  dice(pdf.paginas === 1 && pdf.bytes > 3000 && pdf.letra === 'CINCUENTA MIL PESOS 00/100 M.N.', 'el pagaré se arma en PDF, con el monto en letra', `${pdf.paginas} página · ${pdf.bytes} bytes · ${pdf.letra}`);
  dice(JSON.stringify(pdf.otros) === JSON.stringify(['UN PESO 00/100 M.N.', 'VEINTIÚN MIL PESOS 00/100 M.N.', 'UN MILLÓN DE PESOS 00/100 M.N.', 'TREINTA Y UN MIL CUATROCIENTOS QUINCE PESOS 92/100 M.N.', 'MIL QUINIENTOS PESOS 75/100 M.N.']), 'el monto en letra sale bien en los casos que suelen fallar', pdf.otros.join(' | '));
  dice((await desborde(m)) <= 1, 'el préstamo no se desborda a lo ancho en el celular', (await desborde(m)) + ' px');

  // Quien dirige ve el comprobante y marca recibido.
  await ir(p, `#/prestamo/${pr.id}`, '$50,000');
  dice((await p.locator('.tarjeta.realce').innerText()).includes('ya subió su comprobante'), 'quien dirige ve que Ana ya subió su comprobante');
  await p.getByRole('button', { name: 'Marcar recibido' }).click();
  await p.locator('#panel form').waitFor();
  await p.locator('#panel button.acc').click();
  await p.locator('main h1 .et', { hasText: 'Activo' }).waitFor({ timeout: 20000 });
  detalle = (await inv(`/prestamos/${pr.id}`)).data;
  const movs = (await api(`/orgs/${ORG}/movimientos?limite=100`, { app: 'dash101' })).data.filas;
  dice(detalle.estado === 'activo' && detalle.fecha_inicio === hoy && movs.length === 1 && movs[0].tipo === 'ingreso' && movs[0].monto === 5000000 && movs[0].categoria === 'prestamo_recibido' && movs[0].cuenta_id === cuenta, 'marcar recibido arrancó el préstamo hoy y dejó el ingreso en dash101 (API)', `${detalle.estado} · ${movs[0]?.categoria}`);
  const interesReal = detalle.pagos[0].interes;
  dice((await p.locator('#tabla tbody tr').count()) === 1 && (await p.locator('#tabla tbody tr td').nth(3).innerText()) === '$' + (interesReal / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 }), 'la tabla se rehízo con la fecha de verdad', `interés ${interesReal}`);

  // Editar la tabla: partirla en dos pagos, con motivo.
  await p.locator('[data-editar-tabla]').click();
  await p.locator('#editor-tabla form').waitFor();
  await p.locator('#editor-tabla tbody tr').first().locator('[name=capital]').fill('20000');
  dice((await p.locator('#editor-tabla [data-suma]').innerText()).includes('faltan $30,000.00'), 'el editor dice cuánto capital falta para cuadrar');
  await p.locator('#editor-tabla [data-otra-fila]').click();
  const segunda = p.locator('#editor-tabla tbody tr').nth(1);
  const despues = new Date(Date.parse(vence) + 14 * 86400000).toISOString().slice(0, 10);
  await segunda.locator('[name=fecha]').fill(despues);
  await segunda.locator('[name=capital]').fill('30000');
  await segunda.locator('[name=interes]').fill('900');
  dice((await p.locator('#editor-tabla [data-suma] .et').innerText()) === 'cuadra', 'con los dos pagos el capital cuadra');
  await p.locator('#editor-tabla button.pri').click();
  await p.locator('#editor-tabla .err', { hasText: 'por qué' }).waitFor({ timeout: 10000 });
  dice(true, 'sin motivo no se guarda: lo dice la API');
  await p.fill('#editor-tabla [name=motivo]', 'Se recorrió el cobro de la obra dos semanas');
  await p.locator('#editor-tabla button.pri').click();
  await p.locator('.cab .et', { hasText: 'Tabla editada a mano' }).waitFor({ timeout: 20000 });
  detalle = (await inv(`/prestamos/${pr.id}`)).data;
  dice(detalle.pagos.length === 2 && detalle.pagos[0].capital === 2000000 && detalle.pagos[1].capital === 3000000 && detalle.pagos[1].interes === 90000 && detalle.pagos[1].fecha === despues, 'la tabla nueva quedó en la base, en centavos (API)');

  // Ana ve la tabla nueva, y por qué cambió.
  await ir(m, `#/prestamo/${pr.id}`, '$50,000');
  const loDeAna = await m.locator('main').innerText();
  dice((await m.locator('main table tbody tr').count()) === 2 && loDeAna.includes('Se recorrió el cobro de la obra dos semanas') && loDeAna.includes('Antes:'), 'Ana ve la tabla nueva, el motivo y cómo estaba antes');
  dice(!loDeAna.includes(CORREO), 'y no ve quién de la empresa hizo cada cosa');

  // Se paga (desde dash101, que es donde sale el dinero) y aquí se refleja.
  const pago1 = await inv(`/pagos/${detalle.pagos[0].id}/pagar`, { method: 'POST', app: 'dash101', body: { cuenta_id: cuenta } });
  dice(pago1.estado === 200 && pago1.data.movimientos.length === 2, 'el primer pago, registrado desde dash101, deja capital e interés (API)', String(pago1.estado));
  await ir(p, `#/prestamo/${pr.id}`, '$50,000');
  dice((await p.locator('#tabla tbody tr').first().innerText()).includes('Pagado') && (await cifra(p, 'Capital que se debe')) === '$30,000', 'quien dirige lo ve pagado y el capital bajó a $30,000');
  await p.locator('#tabla tbody tr').first().locator('[data-subir] input[type=file]').setInputFiles({ name: 'spei.png', mimeType: 'image/png', buffer: Buffer.from([137, 80, 78, 71]) });
  await p.locator('#tabla tbody tr').first().locator('a', { hasText: 'Comprobante' }).waitFor({ timeout: 20000 });
  await ir(m, `#/prestamo/${pr.id}`, '$50,000');
  const liga = await m.locator('main table tbody tr').first().locator('a', { hasText: 'Comprobante' }).getAttribute('href');
  const baja = await m.evaluate(async (u) => { const r = await fetch(u); return { estado: r.status, tipo: r.headers.get('content-type') }; }, liga);
  dice(baja.estado === 200 && baja.tipo === 'image/png', 'Ana ve el pago hecho y baja su comprobante', `${baja.estado} ${baja.tipo}`);

  const pago2 = await inv(`/pagos/${detalle.pagos[1].id}/pagar`, { method: 'POST', app: 'dash101', body: { cuenta_id: cuenta } });
  dice(pago2.data?.liquidado === true, 'con el último pago el préstamo se liquida (API)');
  await ir(m, '#/', 'Hola, Ana');
  const ganado = detalle.pagos[0].interes + 90000;
  dice((await cifra(m, 'Tienes invertido')) === '$0' && (await cifra(m, 'Interés ya ganado')) === '$' + (ganado / 100).toLocaleString('es-MX', ganado % 100 ? { minimumFractionDigits: 2 } : {}), 'el estado de cuenta de Ana: ya no tiene nada invertido y dice cuánto ganó', await cifra(m, 'Interés ya ganado'));
  dice((await m.locator('main').innerText()).includes('Liquidado'), 'su préstamo aparece liquidado');
  dice((await desborde(m)) <= 1, 'su cuenta no se desborda a lo ancho en el celular', (await desborde(m)) + ' px');

  await ir(p, '#/', 'Inicio');
  dice((await cifra(p, 'Capital que se debe')) === '$0', 'y a quien dirige el inicio le dice que ya no debe nada');
  for (const [ruta, h1] of [['#/rondas', 'Rondas'], ['#/prestamos', 'Préstamos'], ['#/inversionistas', 'Inversionistas'], ['#/ajustes', 'Ajustes'], ['#/prestamo/nuevo', 'Préstamo directo']]) {
    await ir(p, ruta, h1);
    dice((await desborde(p)) <= 1, `abre ${h1} sin desbordar a lo ancho`, (await desborde(p)) + ' px');
  }
  dir = (await inv('/inversionistas')).data.filas;
  dice(dir.find((f) => f.nombre === 'Ana Robles')?.es_prospecto === false, 'Ana dejó de ser prospecto (API)');

  dice([...new Set(ajenos)].length === 0 && rotos.length === 0 && errores.length === 0, 'escritorio: sin peticiones ajenas, sin archivos faltantes, sin errores', [...new Set(ajenos), ...rotos, ...errores].join(' | ') || 'limpio');
  dice([...new Set(ajenos2)].length === 0 && rotos2.length === 0 && errores2.length === 0, 'celular: sin peticiones ajenas, sin archivos faltantes, sin errores', [...new Set(ajenos2), ...rotos2, ...errores2].join(' | ') || 'limpio');
  await ctx.close();
  await ctx2.close();
} catch (e) {
  fallas++;
  console.log('FALLA se rompió a medias: ' + (e?.stack || e).toString().slice(0, 900));
} finally {
  await nav.close();
  const b = await api(`/admin/orgs/${ORG}`, { method: 'DELETE', app: '' });
  console.log(`(empresa de prueba ${ORG} borrada: ${b.estado})`);
}
console.log(fallas ? `\n${fallas} FALLA(S) de ${revisadas}` : `\nTODO BIEN: ${revisadas} comprobaciones`);
process.exit(fallas ? 1 : 0);
