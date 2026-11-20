/* Quien dirige se manda a dash101 (20-nov-2026).
 *
 * Mike: «hay que meter patron101 a dash también. Igual que bill101»; y con
 * botones, sobre patron.suite101.app: «Mandarlo a dash101». Dos piezas, y
 * las dos se miden aquí sin red:
 *
 *   · `I101.rutaEnDash` (public/js/arranque.js): de la ruta vieja de
 *     patron101 a la pantalla de dash101. Se toma del archivo que se publica.
 *   · `aDash` (worker/index.js): sabe dónde vive dash101 en cada ambiente, y
 *     NO es una redirección abierta.
 *
 *   node pruebas/a-dash.spec.mjs
 */
import { readFileSync } from 'node:fs';
import worker, { aDash } from '../worker/index.js';

let fallas = 0, revisadas = 0;
const dice = (ok, que, dato = '') => { revisadas++; if (!ok) fallas++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${que}${dato !== '' ? '  →  ' + dato : ''}`); };

/* ── la ruta ── */
const fuente = readFileSync(new URL('../public/js/arranque.js', import.meta.url), 'utf8');
const ini = fuente.indexOf('I101.rutaEnDash = ');
const fin = fuente.indexOf('\n  };\n', ini) + 5;
dice(ini > 0 && fin > ini, 'arranque.js tiene rutaEnDash');
const I101 = {};
new Function('I101', fuente.slice(ini, fin))(I101);
const partes = (hash) => hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean).map(decodeURIComponent);
const de = (hash) => I101.rutaEnDash(partes(hash), hash.split('?')[1] || '');

for (const [hash, espera] of [
  ['', '/inversion'],
  ['#/', '/inversion'],
  ['#/rondas', '/inversion/rondas'],
  ['#/ronda/nueva', '/inversion/rondas/nueva'],
  ['#/ronda/01M7V8C8YNNFQE4R4NNKHN5F5V', '/inversion/rondas/01M7V8C8YNNFQE4R4NNKHN5F5V'],
  ['#/ronda/01M7V8C8YNNFQE4R4NNKHN5F5V/editar', '/inversion/rondas/01M7V8C8YNNFQE4R4NNKHN5F5V/editar'],
  ['#/prestamos', '/inversion/prestamos'],
  ['#/prestamo/nuevo', '/inversion/prestamos/nuevo'],
  ['#/prestamo/nuevo?de=01ABC', '/inversion/prestamos/nuevo?de=01ABC'],
  ['#/prestamo/01XYZ', '/inversion/prestamos/01XYZ'],
  ['#/inversionistas', '/inversion/inversionistas'],
  ['#/inversionista/01QRS', '/inversion/inversionistas/01QRS'],
  ['#/ajustes', '/inversion/ajustes'],
]) dice(de(hash) === espera, `«${hash || '(sin ruta)'}» abre ${espera}`, de(hash));

// Lo que no se reconoce, o trae algo que no es un identificador, va al inicio.
for (const hash of ['#/otra-cosa', '#/ronda', '#/ronda/..%2F..%2Fs101', '#/prestamo/a b', '#/inversionista/<script>'])
  dice(de(hash) === '/inversion', `«${hash}» va al inicio de Préstamos`, de(hash));
dice(de('#/prestamo/nuevo?de=..%2Fmalo') === '/inversion/prestamos/nuevo', 'un «de» que no es un identificador se tira', de('#/prestamo/nuevo?de=..%2Fmalo'));

/* ── la puerta ── */
const PROD = { URL_DASH: 'https://dash.suite101.app' };
const ida = (ruta, env = PROD) => {
  const u = new URL('https://patron.suite101.app/a-dash' + (ruta === null ? '' : '?ruta=' + encodeURIComponent(ruta)));
  const r = aDash(u, env);
  return r ? `${r.status} ${r.headers.get('location') ?? ''}`.trim() : 'pasa';
};
dice(ida('/inversion') === '302 https://dash.suite101.app/inversion', 'la puerta manda al inicio de Préstamos', ida('/inversion'));
dice(ida('/inversion/rondas/01ABC/editar') === '302 https://dash.suite101.app/inversion/rondas/01ABC/editar', 'y a la pantalla pedida', ida('/inversion/rondas/01ABC/editar'));
dice(ida('/inversion/prestamos/nuevo?de=01ABC') === '302 https://dash.suite101.app/inversion/prestamos/nuevo?de=01ABC', 'con su «de»', ida('/inversion/prestamos/nuevo?de=01ABC'));
dice(ida(null) === '302 https://dash.suite101.app/inversion', 'sin ruta, al inicio', ida(null));
for (const mala of ['https://malo.example/x', '//malo.example/inversion', '/inversion/../s101/yo', '/inversion?x=1', '/inversion/a b', '/otra', '/inversionX', '/inversion/rondas?de=1&otra=2', '/inversion\n/x'])
  dice(ida(mala) === '302 https://dash.suite101.app/inversion', `no es redirección abierta: ${JSON.stringify(mala)} va al inicio`, ida(mala));
dice(ida('/inversion', { URL_DASH: 'https://dash101-staging.mike-929.workers.dev/' }) === '302 https://dash101-staging.mike-929.workers.dev/inversion', 'en staging manda a dash101 de staging (sin doble diagonal)');
dice(ida('/inversion', {}).startsWith('404'), 'sin URL_DASH no adivina: 404', ida('/inversion', {}));
dice(aDash(new URL('https://patron.suite101.app/'), PROD) === null && aDash(new URL('https://patron.suite101.app/a-dash/otra'), PROD) === null, 'sólo atiende /a-dash');

// Por el Worker entero, sin sesión: /a-dash contesta (no entrega nada de la app).
{
  let preguntas = 0;
  const env = { ...PROD, API: { fetch: async () => { preguntas++; return new Response('{}', { status: 401 }); } }, ASSETS: { fetch: async () => new Response('x') } };
  const r = await worker.fetch(new Request('https://patron.suite101.app/a-dash?ruta=%2Finversion%2Frondas'), env);
  dice(r.status === 302 && r.headers.get('location') === 'https://dash.suite101.app/inversion/rondas' && preguntas === 0, 'por el Worker: 302 a dash101 sin preguntarle nada a la suite', `${r.status} ${r.headers.get('location')} · ${preguntas} preguntas`);
}

// Y lo que se publica dice lo mismo que aquí se midió.
const toml = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
dice(/^URL_DASH = "https:\/\/dash\.suite101\.app"$/m.test(toml.split(/^\[env\.staging\]/m)[0]), 'producción: URL_DASH es dash.suite101.app');
dice(/^URL_DASH = "https:\/\/dash101-staging\.[a-z0-9-]+\.workers\.dev"$/m.test(toml.split(/^\[env\.staging\.vars\]/m)[1] || ''), 'staging: URL_DASH es dash101-staging');
dice(!readFileSync(new URL('../public/index.html', import.meta.url), 'utf8').includes('admin.js'), 'la portada ya no carga las pantallas de quien dirige');

console.log(`\n${revisadas - fallas} de ${revisadas} bien`);
process.exit(fallas ? 1 : 0);
