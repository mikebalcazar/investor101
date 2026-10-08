/* patron101 — el núcleo: hablarle a la API, el dinero, las fechas y las rutas.
 *
 * Sin armazón ni compilación: archivos sueltos que comparten `I101`. Todo le
 * habla a `/s101/*`, que el Worker reenvía a suite101-api con la cookie de
 * este mismo origen. Aquí NO se hace ninguna cuenta de intereses: la única
 * cuenta es la de la API (`/inversion/simular`), para que la pantalla y el
 * estado de cuenta no puedan decir cosas distintas.
 */
'use strict';
const I101 = {};

/* ─────────────── texto seguro ─────────────── */

/** Todo lo que viene de una persona pasa por aquí antes de volverse HTML. */
I101.h = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/* ─────────────── dinero: centavos adentro, pesos afuera ─────────────── */

I101.pesos = (centavos) => {
  const n = Math.round(Number(centavos) || 0);
  return `${n < 0 ? '−' : ''}$${(Math.abs(n) / 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
/** Sin centavos cuando son cerrados: para cifras grandes de un vistazo. */
I101.pesosCorto = (centavos) => {
  const n = Math.round(Number(centavos) || 0);
  return n % 100 === 0 ? `$${(n / 100).toLocaleString('es-MX')}` : I101.pesos(n);
};
/** «50,000.50» → 5000050. Vacío o basura → null. */
I101.aCentavos = (texto) => {
  const limpio = String(texto ?? '').replace(/[$,\s]/g, '');
  if (!limpio || !/^\d+(\.\d{0,2})?$/.test(limpio)) return null;
  return Math.round(Number(limpio) * 100);
};
I101.enPesos = (centavos) => (centavos === null || centavos === undefined || centavos === '' ? '' : String(Number(centavos) / 100));

/* ─────────────── la tasa: puntos base adentro, por ciento afuera ─────────────── */

I101.aPuntos = (texto) => {
  const limpio = String(texto ?? '').replace(/[%\s]/g, '');
  if (!limpio || !/^\d+(\.\d{0,2})?$/.test(limpio)) return null;
  return Math.round(Number(limpio) * 100);
};
I101.enPorciento = (pb) => (pb === null || pb === undefined ? '' : String(Number(pb) / 100));
I101.tasa = (tipo, pb) => {
  const n = (Number(pb) / 100).toFixed(2).replace(/\.?0+$/, '');
  return `${n} % ${tipo === 'mensual' ? 'mensual' : tipo === 'anual' ? 'anual' : 'por todo el plazo'}`;
};

/* ─────────────── fechas: AAAA-MM-DD, leídas como día y no como instante ─────────────── */

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
I101.dia = (d) => {
  if (!d) return '';
  const [a, m, x] = String(d).slice(0, 10).split('-').map(Number);
  return `${x} ${MESES[m - 1]} ${a}`;
};
I101.diaLargo = (d) => {
  if (!d) return '';
  const [a, m, x] = String(d).slice(0, 10).split('-').map(Number);
  return `${x} de ${MESES_LARGOS[m - 1]} de ${a}`;
};
I101.diaConSemana = (d) => {
  if (!d) return '';
  const [a, m, x] = String(d).slice(0, 10).split('-').map(Number);
  return `${DIAS[new Date(Date.UTC(a, m - 1, x)).getUTCDay()]} ${x} ${MESES[m - 1]}`;
};
I101.diasEntre = (desde, hasta) => {
  const u = (d) => { const [a, m, x] = d.split('-').map(Number); return Date.UTC(a, m - 1, x); };
  return Math.round((u(hasta) - u(desde)) / 86400000);
};
I101.sumarDias = (d, n) => {
  const [a, m, x] = d.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, x) + n * 86400000).toISOString().slice(0, 10);
};
/** «en 5 días», «mañana», «hoy», «hace 3 días». `hoy` viene de la API. */
I101.falta = (d, hoy) => {
  const n = I101.diasEntre(hoy, d);
  if (n === 0) return 'hoy';
  if (n === 1) return 'mañana';
  if (n === -1) return 'ayer';
  return n > 0 ? `en ${n} días` : `hace ${-n} días`;
};
/** Una marca de tiempo ISO, dicha en la hora de quien mira. */
I101.momento = (iso) => {
  if (!iso) return '';
  const f = new Date(iso);
  return `${f.getDate()} ${MESES[f.getMonth()]} ${f.getFullYear()}, ${String(f.getHours()).padStart(2, '0')}:${String(f.getMinutes()).padStart(2, '0')}`;
};

/* ─────────────── la API ─────────────── */

const ERRORES = {
  sin_respuesta: 'No hubo forma de llegar al servidor. Revisa tu señal.',
  sin_permiso: 'No tienes permiso para eso.',
  no_encontrado: 'Eso ya no existe.',
  correo_repetido: 'Ese correo ya es de otra persona del directorio.',
  en_uso: 'Ya tiene préstamos u ofertas: se desactiva, no se borra.',
  ronda_no_esta_abierta: 'La ronda no está abierta.',
  ronda_vencida: 'La fecha límite de la ronda ya pasó.',
  ronda_cerrada: 'La ronda ya está cerrada.',
  ronda_no_es_borrador: 'La ronda ya no es un borrador.',
  oferta_ya_resuelta: 'Esa oferta ya se resolvió.',
  prestamo_ya_arranco: 'El préstamo ya arrancó: eso ya no se puede cambiar así.',
  prestamo_cerrado: 'El préstamo ya está cerrado.',
  prestamo_no_activo: 'El préstamo no está activo.',
  pago_ya_hecho: 'Ese pago ya estaba registrado.',
  capital_no_cuadra: 'El capital de los pagos pendientes tiene que sumar exactamente lo que se debe.',
  fechas_no_cuadran: 'Con el dinero llegando ese día, las fechas de pago acordadas ya no caben.',
  archivo_no_aceptado: 'Ese tipo de archivo no se acepta: sube un PDF o una foto (JPG, PNG).',
  archivo_muy_grande: 'El archivo pasa de 10 MB.',
  cuenta_desconocida: 'Esa cuenta ya no existe.',
  app_inactiva: 'patron101 no está prendida para esta empresa.',
  org_sin_pago: 'La suscripción de la empresa venció.',
};

/** Las palabras de un rechazo. La API las manda por campo (`errores`) o en
 *  `mensaje`; se enseñan tal cual, que para eso las escribió. */
function palabras(cual, detalle) {
  if (detalle && typeof detalle === 'object') {
    if (detalle.errores && typeof detalle.errores === 'object') return Object.values(detalle.errores).join(' ');
    if (typeof detalle.mensaje === 'string') return detalle.mensaje;
  }
  return ERRORES[cual] || `Algo no salió bien (${cual}). Vuelve a intentar.`;
}

/** `ruta` es relativa a la API. `cuerpo` va como JSON; `forma`, como archivo. */
I101.api = async (ruta, { metodo, cuerpo, forma } = {}) => {
  let r;
  try {
    r = await fetch('/s101' + ruta, {
      method: metodo || (cuerpo || forma ? 'POST' : 'GET'),
      headers: cuerpo ? { 'Content-Type': 'application/json' } : undefined,
      body: forma || (cuerpo ? JSON.stringify(cuerpo) : undefined),
      credentials: 'same-origin',
    });
  } catch { throw Object.assign(new Error(ERRORES.sin_respuesta), { cual: 'sin_respuesta' }); }
  // La sesión se acabó: a entrar, y de regreso a donde estaba.
  if (r.status === 401) { location.replace('/entrar.html' + location.hash); return new Promise(() => {}); }
  let d = null;
  try { d = await r.json(); } catch { /* no vino JSON */ }
  if (!r.ok || !d?.ok) {
    const cual = d?.error ?? 'sin_respuesta';
    throw Object.assign(new Error(palabras(cual, d?.detalle)), { cual, detalle: d?.detalle, estado: r.status });
  }
  return d.data;
};

/** Lo de la empresa en la que se está: `/orgs/:o/inversion…`. */
I101.inv = (ruta = '', opciones) => I101.api(`/orgs/${encodeURIComponent(I101.org)}/inversion${ruta}`, opciones);
I101.ligaArchivo = (id) => `/s101/orgs/${encodeURIComponent(I101.org)}/inversion/archivos/${encodeURIComponent(id)}`;

/* ─────────────── avisos que flotan ─────────────── */

I101.avisa = (texto, mal = false) => {
  const caja = document.getElementById('avisos');
  const d = document.createElement('div');
  d.textContent = texto;
  if (mal) d.className = 'mal';
  caja.appendChild(d);
  setTimeout(() => d.remove(), mal ? 6500 : 3200);
};

/** Corre algo que habla con la API desde un botón: lo apaga mientras, y si
 *  truena lo dice. Devuelve lo que devolvió, o `undefined` si falló. */
I101.hacer = async (boton, fn, donde) => {
  if (boton) boton.disabled = true;
  if (donde) donde.textContent = '';
  try { return await fn(); } catch (e) {
    if (donde) donde.textContent = e.message; else I101.avisa(e.message, true);
    return undefined;
  } finally { if (boton && boton.isConnected) boton.disabled = false; }
};

/* ─────────────── rutas (#/…) ─────────────── */

I101.ruta = () => {
  const partes = location.hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean).map(decodeURIComponent);
  return partes;
};
I101.ir = (a) => { if (location.hash === a) I101.pintar(); else location.hash = a; };

/** Los nombres de las cosas, dichos igual en toda la app. */
I101.ESTADO_RONDA = { borrador: ['Borrador', ''], abierta: ['Abierta', 'bien'], cerrada: ['Cerrada', 'azul'], cancelada: ['Cancelada', 'mal'] };
I101.ESTADO_PRESTAMO = { por_depositar: ['Por depositar', 'ojo'], activo: ['Activo', 'bien'], liquidado: ['Liquidado', 'azul'], cancelado: ['Cancelado', 'mal'] };
I101.ESTADO_OFERTA = { pendiente: ['Por revisar', 'ojo'], aprobada: ['Aceptada', 'bien'], rechazada: ['No entró', 'mal'], retirada: ['Retirada', ''] };
I101.etiqueta = (mapa, estado) => {
  const [nombre, clase] = mapa[estado] || [estado, ''];
  return `<span class="et ${clase}">${I101.h(nombre)}</span>`;
};
I101.CADA = { semanal: 'cada semana', quincenal: 'cada 15 días', mensual: 'cada mes' };
/** Cómo se paga, en una frase. */
I101.comoSePaga = (c) => (c.esquema === 'unico'
  ? `Un solo pago el ${I101.dia(c.fecha_vencimiento)}`
  : `${c.num_pagos} pagos, ${I101.CADA[c.frecuencia] || ''}`);

window.I101 = I101;
