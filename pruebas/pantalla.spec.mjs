/* patron101 (investor101) manejado con un navegador, contra la API de verdad.
 *
 * Lo que se mide es el camino completo que pidió Mike (8-oct-2026): quien
 * dirige da de alta a su gente, abre una ronda y avisa; quien presta entra
 * con su correo, dice con cuánto le entra, deposita y ve su estado de
 * cuenta; quien dirige acepta, marca el depósito, edita la tabla; se paga, y
 * el préstamo se liquida.
 *
 * 20-nov-2026 · QUIEN DIRIGE YA NO VIVE AQUÍ. Sus pantallas están en dash101,
 * en «Préstamos» (Mike: «hay que meter patron101 a dash también»; y con
 * botones: «Mandarlo a dash101»). Así que en esta prueba:
 *   · lo de quien PRESTA se sigue haciendo con el navegador, en el celular;
 *   · lo de quien DIRIGE se hace por la API diciendo `X-App: dash101`, que
 *     es como lo hace dash101 (sus pantallas se miden allá);
 *   · y se mide lo nuevo: quien dirige y abre patron101 llega a dash101, a
 *     la pantalla que corresponde a su liga, y aquí no se le entrega nada
 *     de lo que era suyo.
 *
 * Cada paso se comprueba dos veces: en la pantalla y preguntándole a la API
 * por su cuenta. Que la pantalla diga «guardado» no es prueba de nada.
 *
 *   BASE   dónde está investor101 (por omisión el servidor local de pruebas)
 *   API    la suite101-api a la que le habla (sólo para preguntarle directo)
 *
 * Sólo corre contra una API que no sea producción: crea una empresa de
 * prueba (`i101-…`) y al final la borra.
 */
import http from 'node:http';
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
/** Lo de quien dirige, dicho como lo dice dash101. */
const adm = (ruta, o = {}) => inv(ruta, { ...o, app: 'dash101' });
/** Un papel subido por quien dirige (multipart), como lo sube dash101. */
async function subir(datos, nombre, tipo, bytes) {
  const forma = new FormData();
  forma.set('archivo', new Blob([bytes], { type: tipo }), nombre);
  for (const [k, v] of Object.entries(datos)) forma.set(k, v);
  const r = await fetch(`${API}/orgs/${ORG}/inversion/archivos`, { method: 'POST', headers: { 'X-App': 'dash101', Cookie: galleta }, body: forma });
  let d = {}; try { d = await r.json(); } catch { /* sin JSON */ }
  return { estado: r.status, ...d };
}

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
async function entrarPorPantalla(p, correo, destino = '', llegaA = '') {
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
  // Quien dirige no se queda: se le manda a dash101 (`llegaA`).
  if (llegaA) return llegoA(p, llegaA);
  await p.locator('main h1').first().waitFor({ timeout: 30000 });
  return p.url();
}

/** Espera a que la página se vaya a `base` y dice la PRIMERA dirección a la
 *  que llegó ahí: dash101 de verdad (staging) manda después a su entrada a
 *  quien no trae su sesión, y lo que aquí se mide es a dónde manda patron101. */
async function llegoA(p, base) {
  let primera = '';
  await p.waitForURL((u) => { const t = String(u); if (!t.startsWith(base)) return false; primera ||= t; return true; }, { timeout: 30000, waitUntil: 'commit' });
  await p.goto('about:blank');
  return primera;
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

let dashFalso = null;
const nav = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
function vigilar(p, errores, ajenos, rotos) {
  const aqui = () => { try { return new URL(p.url()).origin === new URL(BASE).origin; } catch { return false; } };
  p.on('pageerror', (e) => { if (aqui()) errores.push(String(e.message).slice(0, 200)); });
  // Un 403/404/409 que la app provoca a propósito sale en consola como
  // «Failed to load resource»: no es falla. Lo propio que falte lo cuenta `rotos`.
  p.on('console', (m) => { const t = m.text(); if (aqui() && m.type() === 'error' && !/Failed to load resource/.test(t)) errores.push(t.slice(0, 200)); });
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
    for (const f of ['/js/inversionista.js', '/js/nucleo.js', '/app.css', '/vendor/jspdf.js']) {
      const x = await fetch(BASE + f, { redirect: 'manual' });
      dice(x.status === 401, `sin sesión, ${f} no se entrega`, String(x.status));
    }
    const e = await fetch(BASE + '/entrar.html');
    dice(e.status === 200 && (await e.text()).includes('patron<span'), 'la pantalla de entrada sí es pública y dice patron101');
    for (const f of ['/favicon.ico', '/icono.svg', '/apple-touch-icon.png']) {
      const i = await fetch(BASE + f, { redirect: 'manual' });
      dice(i.status === 200 && (await i.arrayBuffer()).byteLength > 500, `el ícono ${f} se entrega sin sesión`, String(i.status));
    }
    const s = await fetch(BASE + `/s101/orgs/${ORG}/inversion`);
    dice(s.status === 401, 'sin sesión, nada se abre por el puente', String(s.status));
  }

  /* ══════════ quien dirige: aquí ya no; a dash101 ══════════ */
  console.log('\n== Quien dirige llega a dash101 ==');
  const aDash = await fetch(BASE + '/a-dash?ruta=' + encodeURIComponent('/inversion'), { redirect: 'manual' });
  const DASH = (aDash.headers.get('location') || '').replace(/\/inversion$/, '');
  dice(aDash.status === 302 && /^https?:\/\/[^/]+$/.test(DASH) && DASH !== BASE, 'la puerta sabe dónde vive dash101 en este ambiente', `${aDash.status} → ${aDash.headers.get('location')}`);
  /* dash101 se mide en su repositorio: aquí sólo importa A DÓNDE se manda.
   * En local nadie escucha en esa dirección, así que se pone un dash101 de
   * mentiras que contesta cualquier ruta; en staging contesta el de verdad. */
  if (new URL(DASH).hostname === '127.0.0.1') {
    dashFalso = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end('<!doctype html><title>dash101</title><h1>dash101 de mentiras</h1>'); });
    await new Promise((ok) => dashFalso.listen(Number(new URL(DASH).port), '127.0.0.1', ok));
  }
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errores = [], ajenos = [], rotos = [];
  vigilar(p, errores, ajenos, rotos);
  const llego = await entrarPorPantalla(p, CORREO, '', DASH);
  dice(llego === `${DASH}/inversion`, 'quien dirige entra y llega a «Préstamos» de dash101', llego);
  {
    // Con su sesión, lo que era de quien dirige ya no existe aquí.
    const r = await ctx.request.get(BASE + '/js/admin.js');
    dice(r.status() === 404, 'con sesión, las pantallas de quien dirige ya no se sirven', String(r.status()));
  }

  /* Lo de quien dirige, por la API, como dash101. */
  console.log('\n== Lo de quien dirige, por la API como dash101 ==');
  // — el directorio —
  const altaAna = await adm('/inversionistas', { method: 'POST', body: { nombre: 'Ana Robles', correo: ANA, telefono: '55 1234 5678', clabe: '002180012345678901' } });
  await adm('/inversionistas', { method: 'POST', body: { nombre: 'Beto Cruz', correo: `beto-${ORG}@ejemplo.mx`, telefono: '81 5555 0000' } });
  await adm('/inversionistas', { method: 'POST', body: { nombre: 'Caro Díaz', correo: `caro-${ORG}@ejemplo.mx` } });
  const mala = await adm('/inversionistas', { method: 'POST', body: { nombre: 'Sin Arroba', correo: 'esto-no-es-correo.mx' } });
  dice(altaAna.estado < 300 && mala.estado >= 400, 'el directorio recibe a los buenos y rechaza un correo que no lo es', `${altaAna.estado} · ${mala.estado}`);
  let dir = (await inv('/inversionistas')).data.filas;
  dice(dir.length === 3 && dir.every((f) => f.es_prospecto), 'los tres quedaron en el directorio, como prospectos (API)', dir.map((f) => f.nombre).join(', '));
  const ana = dir.find((f) => f.nombre === 'Ana Robles');
  dice(ana?.correo === ANA && ana?.telefono === '5512345678' && !!ana?.usuario_id, 'Ana quedó con correo, teléfono y cuenta para entrar (API)');

  // — los ajustes —
  const puestos = await adm('/ajustes', { method: 'PUT', body: { instrucciones: 'BBVA · CLABE 012180001234567895 · Taller de prueba SA de CV', representante: 'Quien Firma', lugar: 'Ciudad de México' } });
  const ajustes = await adm('/ajustes');
  dice(puestos.estado < 300 && ajustes.data?.lugar === 'Ciudad de México' && String(ajustes.data?.riesgos).includes('No lo protege el IPAB') && ajustes.data?.riesgos_propio === false, 'los ajustes guardan a dónde depositar y traen el aviso de riesgos base');

  // — la ronda —
  const mas = (n) => new Date(Date.parse(hoy) + n * 86400000).toISOString().slice(0, 10);
  const inicio = mas(3), vence = mas(33);
  const nueva = await adm('/rondas', { method: 'POST', body: {
    nombre: 'Puente de prueba', descripcion: 'Tres semanas de nómina mientras se cobra la obra.', monto_meta: 9000000, monto_minimo: null, fecha_limite: null,
    instrucciones: ajustes.data.instrucciones, tipo_tasa: 'mensual', tasa_pb: 300, esquema: 'unico', fecha_inicio: inicio, fecha_vencimiento: vence,
    frecuencia: null, num_pagos: null, fecha_primer_pago: null,
  } });
  let rondas = (await inv('/rondas')).data.filas;
  const ronda = rondas[0];
  dice(nueva.estado < 300 && rondas.length === 1 && ronda.monto_meta === 9000000 && ronda.tasa_pb === 300 && ronda.esquema === 'unico' && ronda.estado === 'borrador', 'la ronda nace en borrador, con su meta en centavos y su tasa en puntos base (API)', `${nueva.estado} · ${ronda?.monto_meta} · ${ronda?.tasa_pb}`);
  const abierta = await adm(`/rondas/${ronda.id}/abrir`, { method: 'POST' });
  dice(abierta.estado < 300 && (await inv(`/rondas/${ronda.id}`)).data.estado === 'abierta', 'se abre', String(abierta.estado));
  const aviso0 = (await adm(`/rondas/${ronda.id}/aviso`)).data.filas;
  const wa = aviso0.find((f) => f.nombre === 'Ana Robles')?.whatsapp;
  dice(aviso0.length === 3, 'el aviso lista a los tres del directorio');
  dice(/^https:\/\/wa\.me\/525512345678\?text=/.test(wa || '') && decodeURIComponent(wa).includes('Puente de prueba') && decodeURIComponent(wa).includes('$90,000.00'), 'la liga de WhatsApp de Ana lleva su número con lada y el mensaje ya escrito');
  dice(!aviso0.find((f) => f.nombre === 'Caro Díaz')?.whatsapp, 'quien no tiene teléfono no trae liga de WhatsApp');
  const avisados = await adm(`/rondas/${ronda.id}/avisar`, { method: 'POST', body: { a: aviso0.map((f) => f.id) } });
  dice(avisados.data?.enviados === 0 && avisados.data?.filas.every((f) => f.correo_enviado.enviado === false && /correo_apagado_fuera_de_produccion|correo_no_configurado/.test(f.correo_enviado.motivo)), 'fuera de producción el correo no sale, y la API lo dice en vez de fingir');

  // La liga que le llega por correo a quien dirige (una ronda) abre esa ronda… en dash101.
  await p.goto(`${BASE}/#/ronda/${ronda.id}`, { waitUntil: 'commit' });
  const aLaRonda = await llegoA(p, DASH);
  dice(aLaRonda === `${DASH}/inversion/rondas/${ronda.id}`, 'la liga vieja de una ronda abre esa ronda en dash101', aLaRonda);

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
  // Mike, 9-oct: la ronda dice a cuánto equivale en tasa anual, para comparar. 3 % mensual = 36 % anual.
  dice((await m.locator('[data-tasa-anual]').innerText()).replace(/\s+/g, ' ').includes('36 % anual'), 'la ronda dice a cuánto equivale en tasa anual (3 % mensual = 36 % anual)', (await m.locator('[data-tasa-anual]').innerText()).replace(/\s+/g, ' '));
  await m.fill('#f-oferta [name=monto]', '50000');
  await m.locator('[data-mi-tabla] h3', { hasText: 'Con $50,000.00' }).waitFor({ timeout: 15000 });
  const mia = (await api(`/orgs/${ORG}/inversion/simular`, { method: 'POST', body: { monto: 5000000, tipo_tasa: 'mensual', tasa_pb: 300, esquema: 'unico', fecha_inicio: inicio, fecha_vencimiento: vence } })).data;
  const promesa = await m.locator('[data-mi-tabla] h3').innerText();
  dice(promesa.includes('$' + (mia.totales.total / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 })), 'le dice cuánto le regresan con su monto, con la cuenta de la API', promesa);
  /* El aviso de riesgos (0.2.0; Mike, 8-oct: «sobre todo riesgos de no pago
   * del cliente», y con botones: aceptación obligatoria). */
  const aviso = await m.locator('#riesgos').innerText();
  dice(aviso.includes('Si un cliente se atrasa o no paga') && aviso.includes('Puedes perder dinero'), 'la ronda le enseña el aviso de riesgos, con el de no pago del cliente');
  await m.locator('#f-oferta button.acc').click();
  await m.locator('#f-oferta .err', { hasText: 'aceptas los riesgos' }).waitFor({ timeout: 10000 });
  dice(((await inv(`/rondas/${ronda.id}`)).data.ofertas || []).length === 0, 'sin marcar que acepta los riesgos, no se manda la oferta (API: cero ofertas)');
  const directo = await m.evaluate(async ([o, r]) => { const x = await fetch(`/s101/orgs/${o}/inversion/rondas/${r}/ofertas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ monto: 5000000 }) }); return [x.status, (await x.json()).error]; }, [ORG, ronda.id]);
  dice(directo[0] === 400 && directo[1] === 'riesgos_sin_aceptar', 'y saltándose la pantalla, la API tampoco la recibe', directo.join(' '));
  await m.locator('#f-oferta [name=acepta_riesgos]').check();
  await m.locator('#f-oferta button.acc').click();
  await m.locator('#f-oferta h2', { hasText: 'en revisión' }).waitFor({ timeout: 20000 });
  let vista = (await inv(`/rondas/${ronda.id}`)).data;
  dice(/^\d{4}-\d{2}-\d{2}T/.test(vista.ofertas[0]?.riesgos_aceptados_at || ''), 'aceptarlos deja guardado cuándo (API)', String(vista.ofertas[0]?.riesgos_aceptados_at));
  dice((await m.locator('#f-oferta').innerText()).includes('Aceptaste los riesgos el'), 'y a Ana le dice cuándo los aceptó');
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
  const aceptada = await adm(`/ofertas/${vista.ofertas[0].id}/aprobar`, { method: 'POST', body: { monto_aprobado: 5000000 } });
  let prestamos = (await inv('/prestamos')).data.filas;
  const pr = prestamos[0];
  dice(aceptada.estado < 300 && prestamos.length === 1 && pr.estado === 'por_depositar' && pr.monto === 5000000 && pr.tasa_pb === 300, 'la oferta aceptada es un préstamo por depositar (API)', `${aceptada.estado} · ${pr?.folio}`);
  const yaCuenta = (await inv(`/rondas/${ronda.id}`)).data.avance;
  dice(yaCuenta.juntado === 5000000 && yaCuenta.falta === 4000000, 'la ronda ya cuenta lo aceptado');

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
    return { paginas: doc.getNumberOfPages(), bytes: doc.output('arraybuffer').byteLength, riesgos: pp.riesgos, crudo: doc.output(), letra: window.I101.montoConLetra(pp.monto), otros: [100, 2100000, 100000000, 3141592, 150075].map(window.I101.montoConLetra) };
  }, pr.id);
  dice(pdf.paginas >= 1 && pdf.paginas <= 2 && pdf.bytes > 3000 && pdf.letra === 'CINCUENTA MIL PESOS 00/100 M.N.', 'el pagaré se arma en PDF, con el monto en letra', `${pdf.paginas} página(s) · ${pdf.bytes} bytes · ${pdf.letra}`);
  dice(!!pdf.riesgos?.aceptados_at && pdf.riesgos.texto.includes('Si un cliente se atrasa o no paga'), 'el préstamo carga el aviso que Ana aceptó, con su hora (API)');
  dice(pdf.crudo.includes('RIESGOS QUE EL BENEFICIARIO DECLARA CONOCER') && pdf.crudo.includes('y lo ratifica con su firma'), 'el pagaré imprime los riesgos antes de las firmas');
  dice((await m.locator('details.riesgos').innerText()).includes('Los aceptaste el'), 'en su préstamo, Ana puede releer los riesgos que aceptó');
  dice(JSON.stringify(pdf.otros) === JSON.stringify(['UN PESO 00/100 M.N.', 'VEINTIÚN MIL PESOS 00/100 M.N.', 'UN MILLÓN DE PESOS 00/100 M.N.', 'TREINTA Y UN MIL CUATROCIENTOS QUINCE PESOS 92/100 M.N.', 'MIL QUINIENTOS PESOS 75/100 M.N.']), 'el monto en letra sale bien en los casos que suelen fallar', pdf.otros.join(' | '));
  dice((await desborde(m)) <= 1, 'el préstamo no se desborda a lo ancho en el celular', (await desborde(m)) + ' px');

  // Quien dirige marca recibido (dash101).
  const recibido = await adm(`/prestamos/${pr.id}/recibido`, { method: 'POST', body: { cuenta_id: cuenta, fecha: hoy } });
  detalle = (await inv(`/prestamos/${pr.id}`)).data;
  const movs = (await api(`/orgs/${ORG}/movimientos?limite=100`, { app: 'dash101' })).data.filas;
  dice(recibido.estado < 300 && detalle.estado === 'activo' && detalle.fecha_inicio === hoy && movs.length === 1 && movs[0].tipo === 'ingreso' && movs[0].monto === 5000000 && movs[0].categoria === 'prestamo_recibido' && movs[0].cuenta_id === cuenta, 'marcar recibido arrancó el préstamo hoy y dejó el ingreso en dash101 (API)', `${detalle.estado} · ${movs.length} movimiento(s)`);
  const interesReal = detalle.pagos[0].interes;
  dice(detalle.pagos.length === 1 && detalle.pagos[0].capital === 5000000 && interesReal > 0, 'la tabla se rehízo con la fecha de verdad', `interés ${interesReal}`);

  // Editar la tabla: partirla en dos pagos, con motivo.
  const despues = new Date(Date.parse(vence) + 14 * 86400000).toISOString().slice(0, 10);
  const dosPagos = [{ fecha: detalle.pagos[0].fecha, capital: 2000000, interes: interesReal }, { fecha: despues, capital: 3000000, interes: 90000 }];
  const noCuadra = await adm(`/prestamos/${pr.id}/tabla`, { method: 'PUT', body: { pagos: [dosPagos[0]], motivo: 'No cuadra' } });
  dice(noCuadra.estado >= 400 && noCuadra.error === 'capital_no_cuadra', 'una tabla cuyo capital no suma lo que se debe no se guarda', `${noCuadra.estado} ${noCuadra.error}`);
  const sinMotivo = await adm(`/prestamos/${pr.id}/tabla`, { method: 'PUT', body: { pagos: dosPagos, motivo: '' } });
  dice(sinMotivo.estado >= 400, 'sin motivo no se guarda: lo dice la API', `${sinMotivo.estado} ${JSON.stringify(sinMotivo.detalle ?? '').slice(0, 80)}`);
  const conMotivo = await adm(`/prestamos/${pr.id}/tabla`, { method: 'PUT', body: { pagos: dosPagos, motivo: 'Se recorrió el cobro de la obra dos semanas' } });
  detalle = (await inv(`/prestamos/${pr.id}`)).data;
  dice(conMotivo.estado < 300 && detalle.tabla_editada && detalle.pagos.length === 2 && detalle.pagos[0].capital === 2000000 && detalle.pagos[1].capital === 3000000 && detalle.pagos[1].interes === 90000 && detalle.pagos[1].fecha === despues, 'la tabla nueva quedó en la base, en centavos (API)');

  // Ana ve la tabla nueva, y por qué cambió.
  await ir(m, `#/prestamo/${pr.id}`, '$50,000');
  const loDeAna = await m.locator('main').innerText();
  dice((await m.locator('main table tbody tr').count()) === 2 && loDeAna.includes('Se recorrió el cobro de la obra dos semanas') && loDeAna.includes('Antes:'), 'Ana ve la tabla nueva, el motivo y cómo estaba antes');
  dice(!loDeAna.includes(CORREO), 'y no ve quién de la empresa hizo cada cosa');

  // Se paga (desde dash101, que es donde sale el dinero) y aquí se refleja.
  const pago1 = await inv(`/pagos/${detalle.pagos[0].id}/pagar`, { method: 'POST', app: 'dash101', body: { cuenta_id: cuenta } });
  dice(pago1.estado === 200 && pago1.data.movimientos.length === 2, 'el primer pago, registrado desde dash101, deja capital e interés (API)', String(pago1.estado));
  detalle = (await inv(`/prestamos/${pr.id}`)).data;
  dice(detalle.pagos[0].estado === 'pagado' && detalle.resumen.capital_pendiente === 3000000, 'el pago quedó pagado y el capital bajó a $30,000 (API)');
  const spei = await subir({ prestamo_id: pr.id, pago_id: detalle.pagos[0].id, clase: 'comprobante_pago' }, 'spei.png', 'image/png', Buffer.from([137, 80, 78, 71]));
  dice(spei.estado < 300, 'quien dirige le cuelga su comprobante al pago (dash101)', String(spei.estado));
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

  dice((await adm('')).data.resumen.capital_vigente === 0, 'y a quien dirige la API le dice que ya no debe nada');
  dice((await m.locator('#cuenta-menu [data-a-dash]').count()) === 0, 'a quien sólo presta no se le ofrece dash101');

  // Las ligas viejas de quien dirige abren su pantalla en dash101.
  for (const [vieja, enDash] of [[`#/prestamo/${pr.id}`, `/inversion/prestamos/${pr.id}`], ['#/inversionistas', '/inversion/inversionistas'], [`#/inversionista/${ana.id}`, `/inversion/inversionistas/${ana.id}`], ['#/ajustes', '/inversion/ajustes'], [`#/prestamo/nuevo?de=${ana.id}`, `/inversion/prestamos/nuevo?de=${ana.id}`], ['#/no-existe', '/inversion']]) {
    await p.goto(`${BASE}/${vieja}`, { waitUntil: 'commit' });
    const fue = await llegoA(p, DASH);
    dice(fue === DASH + enDash, `«${vieja.replace(/01[0-9A-Z]{20,}/, '…')}» abre ${enDash.replace(/01[0-9A-Z]{20,}/, '…')} en dash101`, fue.replace(DASH, ''));
  }
  dir = (await inv('/inversionistas')).data.filas;
  dice(dir.find((f) => f.nombre === 'Ana Robles')?.es_prospecto === false, 'Ana dejó de ser prospecto (API)');

  const ajenosDeVerdad = [...new Set(ajenos)].filter((x) => x !== new URL(DASH).host);
  dice(ajenosDeVerdad.length === 0 && rotos.length === 0 && errores.length === 0, 'quien dirige: sólo va a dash101; sin otras peticiones ajenas, sin archivos faltantes, sin errores', [...ajenosDeVerdad, ...rotos, ...errores].join(' | ') || 'limpio');
  dice([...new Set(ajenos2)].length === 0 && rotos2.length === 0 && errores2.length === 0, 'celular: sin peticiones ajenas, sin archivos faltantes, sin errores', [...new Set(ajenos2), ...rotos2, ...errores2].join(' | ') || 'limpio');
  await ctx.close();
  await ctx2.close();
} catch (e) {
  fallas++;
  console.log('FALLA se rompió a medias: ' + (e?.stack || e).toString().slice(0, 900));
} finally {
  await nav.close();
  dashFalso?.close();
  const b = await api(`/admin/orgs/${ORG}`, { method: 'DELETE', app: '' });
  console.log(`(empresa de prueba ${ORG} borrada: ${b.estado})`);
}
console.log(fallas ? `\n${fallas} FALLA(S) de ${revisadas}` : `\nTODO BIEN: ${revisadas} comprobaciones`);
process.exit(fallas ? 1 : 0);
