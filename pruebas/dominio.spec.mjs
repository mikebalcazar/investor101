/* Las direcciones viejas mandan a la nueva (11-oct-2026: la suite se mudó a
 * suite101.app y patron101 vive en patron.suite101.app).
 *
 * Corre el Worker de verdad con las variables de producción tal como están en
 * `wrangler.toml`: si alguien cambia el dominio ahí, esto lo mide. No necesita
 * red ni API: el puente a la suite es de mentiras y sólo cuenta si lo usaron.
 *
 *   node pruebas/dominio.spec.mjs
 */
import { readFile } from 'node:fs/promises';
import worker, { aDominioPropio } from '../worker/index.js';

const toml = await readFile(new URL('../wrangler.toml', import.meta.url), 'utf8');
const vars = {};
const bloque = toml.split(/^\[vars\]\s*$/m)[1]?.split(/^\[/m)[0] || '';
for (const [, k, v] of bloque.matchAll(/^([A-Z_]+)\s*=\s*"([^"]*)"/gm)) vars[k] = v;

let fallas = 0, revisadas = 0;
const dice = (ok, que, dato = '') => { revisadas++; if (!ok) fallas++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${que}${dato !== '' ? '  →  ' + dato : ''}`); };

const NUEVO = 'patron.suite101.app';
dice(vars.DOMINIO_PROPIO === NUEVO, 'el dominio propio de producción es el nuevo', vars.DOMINIO_PROPIO);
dice(vars.DOMINIO_ANTERIOR === 'patron101.taller101.com,investor101.taller101.com', 'las dos de taller101.com están en DOMINIO_ANTERIOR', vars.DOMINIO_ANTERIOR);
dice(toml.includes(`{ pattern = "${NUEVO}", custom_domain = true }`), 'el dominio nuevo está colgado en producción');

const ida = (url, metodo = 'GET', env = vars) => {
  const u = new URL(url);
  const r = aDominioPropio(new Request(u, { method: metodo }), env, u);
  return r ? `${r.status} ${r.headers.get('location')}` : 'pasa';
};

// Cada vieja manda con 301 a la nueva, con todo y ruta y consulta.
for (const vieja of ['patron101.taller101.com', 'investor101.taller101.com', 'investor101.mike-929.workers.dev']) {
  for (const esquema of ['https', 'http']) {
    const r = ida(`${esquema}://${vieja}/entrar.html?de=correo&x=1`);
    dice(r === `301 https://${NUEVO}/entrar.html?de=correo&x=1`, `${esquema}://${vieja} manda a la nueva con ruta y consulta`, r);
  }
  const h = ida(`https://${vieja}/#/ronda`, 'HEAD');
  dice(h === `301 https://${NUEVO}/`, `HEAD a ${vieja} también`, h);
  const p = ida(`https://${vieja}/algo`, 'POST');
  dice(p === 'pasa', `un POST a ${vieja} no se convierte en GET`, p);
}

// `/s101/*` desde la vieja no se redirige: viene de una página que ya se va.
for (const vieja of ['patron101.taller101.com', 'investor101.mike-929.workers.dev']) {
  for (const ruta of ['/s101', '/s101/yo?x=1']) {
    const r = ida(`https://${vieja}${ruta}`);
    dice(r === 'pasa', `${vieja}${ruta} no se redirige`, r);
  }
}
// La de antes de patron101 conserva lo suyo: manda todo, con todo y `/s101`
// (nadie llegó a usarla), pero ahora acaba en la nueva.
const nacio = ida('https://investor101.taller101.com/s101/yo?x=1');
dice(nacio === `301 https://${NUEVO}/s101/yo?x=1`, 'investor101.taller101.com/s101 sigue mandando todo, ahora a la nueva', nacio);

// La nueva, por https, se sirve; por http sube a https.
dice(ida(`https://${NUEVO}/entrar.html`) === 'pasa', 'la nueva por https se sirve tal cual');
const http = ida(`http://${NUEVO}/entrar.html?a=1`);
dice(http === `301 https://${NUEVO}/entrar.html?a=1`, 'la nueva por http sube a https', http);

// Un dominio de empresa (o cualquiera que no sea viejo) no se toca.
for (const otro of ['patron.acme.com', 'patron101.acme.com', 'taller101.com', 'dash.suite101.app']) {
  const r = ida(`https://${otro}/entrar.html`);
  dice(r === 'pasa', `${otro} no se redirige`, r);
}

// Staging no tiene dominio propio: nada redirige, ni con DOMINIO_ANTERIOR.
const stg = ida('https://investor101-staging.mike-929.workers.dev/entrar.html', 'GET', {});
dice(stg === 'pasa', 'staging no redirige', stg);
const sinPropio = ida('https://patron101.taller101.com/', 'GET', { DOMINIO_ANTERIOR: vars.DOMINIO_ANTERIOR });
dice(sinPropio === 'pasa', 'sin DOMINIO_PROPIO, DOMINIO_ANTERIOR no basta para redirigir', sinPropio);

// Y por el Worker entero: `/s101` desde la vieja llega a la API.
let llego = '';
const env = { ...vars, API: { fetch: async (r) => { llego = new URL(r.url).pathname + ' · ' + r.headers.get('X-App'); return new Response('{}'); } }, ASSETS: { fetch: async () => new Response('archivo') } };
const r = await worker.fetch(new Request('https://patron101.taller101.com/s101/salud'), env);
dice(r.status === 200 && llego === '/salud · investor101', 'patron101.taller101.com/s101/salud llega a la API', `${r.status} · ${llego}`);
const w = await worker.fetch(new Request('https://patron101.taller101.com/entrar.html?x=1'), env);
dice(w.status === 301 && w.headers.get('location') === `https://${NUEVO}/entrar.html?x=1`, 'y la pantalla de entrada desde la vieja manda a la nueva', `${w.status} ${w.headers.get('location')}`);

console.log(fallas ? `${fallas} FALLA(S) de ${revisadas}` : `TODO BIEN · ${revisadas} revisadas`);
process.exit(fallas ? 1 : 0);
