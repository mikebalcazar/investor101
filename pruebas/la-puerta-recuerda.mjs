/* La puerta recuerda la sesión que ya pasó (16-oct-2026).
 *
 * Antes cada archivo de la app (la página, cada .js, cada .css) preguntaba
 * `/yo` a la suite: una vez por archivo, ~0.7 s cada una. Ahora el sí se
 * recuerda 5 min por sesión. Esto corre el Worker de verdad con una suite y
 * unos archivos de mentiras, y cuenta cuántas veces se preguntó.
 *
 *   node pruebas/la-puerta-recuerda.mjs
 */
import worker, { olvidaSesiones } from '../worker/index.js';

let fallas = 0, revisadas = 0;
const dice = (ok, que, dato = '') => { revisadas++; if (!ok) fallas++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${que}${dato !== '' ? '  →  ' + dato : ''}`); };

// La suite de mentiras: `s101=bueno*` es de la empresa con patron101; `s101=sinapp`
// es de una empresa sin la app; lo demás no tiene sesión.
let preguntas = 0;
let bueno = new Set(['s101=bueno1', 's101=bueno2']);
const API = {
  async fetch(req) {
    const u = new URL(req.url);
    const s = (req.headers.get('cookie') || '').split(';').map((x) => x.trim()).find((x) => x.startsWith('s101=')) || '';
    if (u.pathname === '/yo') {
      preguntas++;
      if (bueno.has(s)) return Response.json({ data: { superadmin: false, orgs: [{ slug: 'demo', apps: ['investor'] }] } });
      if (s === 's101=presta') return Response.json({ data: { superadmin: false, orgs: [], inversion: [{ org: 'demo' }] } });
      if (s === 's101=sinapp') return Response.json({ data: { superadmin: false, orgs: [{ slug: 'demo', apps: ['dash'] }] } });
      return Response.json({ error: 'sin sesión' }, { status: 401 });
    }
    if (u.pathname === '/auth/salir') { bueno.delete(s); return Response.json({ ok: true }); }
    return bueno.has(s) ? Response.json({ data: [] }) : Response.json({ error: 'sin sesión' }, { status: 401 });
  },
};
const ASSETS = { fetch: async () => new Response('archivo', { status: 200 }) };
const env = { API, ASSETS };

const pide = (ruta, galleta, extra = {}) => worker.fetch(new Request(`https://patron.ejemplo/${ruta.replace(/^\//, '')}`,
  { headers: { ...(galleta ? { cookie: galleta } : {}), ...extra } }), env);
const carga = async (galleta) => {
  const rutas = ['/', '/app.css', '/js/nucleo.js', '/js/arranque.js', '/js/inversiones.js', '/js/ui.js'];
  const r = [];
  for (const x of rutas) r.push((await pide(x, galleta, x === '/' ? { accept: 'text/html' } : {})).status);
  return r;
};

olvidaSesiones();

// 1. La primera carga pregunta una vez, no nueve.
preguntas = 0;
let st = await carga('otra=1; s101=bueno1');
dice(st.every((x) => x === 200), 'con sesión, la app se entrega entera', st.join(','));
dice(preguntas === 1, 'la primera carga pregunta /yo una sola vez', preguntas);

// 2. La segunda carga no pregunta.
preguntas = 0;
st = await carga('s101=bueno1; otra=2');
dice(st.every((x) => x === 200) && preguntas === 0, 'la segunda carga no pregunta (otras galletas no cambian la llave)', preguntas);

// 3. Otra sesión no hereda.
preguntas = 0;
st = await carga('s101=bueno2');
dice(preguntas === 1, 'otra sesión pregunta por su cuenta', preguntas);

// 4. Sin sesión, o con una inventada: no pasa, y se vuelve a preguntar cada vez.
preguntas = 0;
let r = await pide('/', null, { accept: 'text/html' });
dice(r.status === 302 && r.headers.get('location').endsWith('/entrar.html'), 'sin galleta, la página manda a entrar', r.status);
dice(preguntas === 0, 'sin galleta no se pregunta', preguntas);
r = await pide('/js/nucleo.js', 's101=inventada');
dice(r.status === 401, 'una galleta inventada no recibe archivos', r.status);
r = await pide('/js/nucleo.js', 's101=inventada');
dice(r.status === 401 && preguntas === 2, 'el no no se recuerda: se pregunta cada vez', preguntas);

// 5. Quien es de una empresa sin patron101 no pasa.
r = await pide('/js/nucleo.js', 's101=sinapp');
dice(r.status === 401, 'sin la app entre sus apps, no pasa', r.status);

// 5b. Quien sólo le presta a una empresa sí pasa, y se recuerda.
preguntas = 0;
r = await pide('/js/nucleo.js', 's101=presta');
const r2 = await pide('/app.css', 's101=presta');
dice(r.status === 200 && r2.status === 200 && preguntas === 1, 'quien presta pasa, y la segunda vez no pregunta', `${r.status} · ${preguntas}`);

// 6. Salir olvida la sesión.
r = await worker.fetch(new Request('https://patron.ejemplo/s101/auth/salir', { method: 'POST', headers: { cookie: 's101=bueno1' } }), env);
dice(r.status === 200, 'salir pasa a la suite', r.status);
preguntas = 0;
r = await pide('/js/nucleo.js', 's101=bueno1');
dice(r.status === 401 && preguntas === 1, 'después de salir, la misma galleta vuelve a preguntar y no pasa', `${r.status} · ${preguntas}`);

// 7. Un 401 de la API olvida la sesión (la cerraron en otro lado).
preguntas = 0;
await pide('/js/nucleo.js', 's101=bueno2');
dice(preguntas === 0, 'bueno2 sigue recordada', preguntas);
bueno.delete('s101=bueno2');
r = await worker.fetch(new Request('https://patron.ejemplo/s101/orgs/demo/inversiones', { headers: { cookie: 's101=bueno2' } }), env);
dice(r.status === 401, 'la API ya no la reconoce', r.status);
r = await pide('/js/nucleo.js', 's101=bueno2');
dice(r.status === 401 && preguntas === 1, 'tras el 401 de la API, la puerta vuelve a preguntar', `${r.status} · ${preguntas}`);

// 8. Lo abierto sigue abierto y no pregunta.
preguntas = 0;
r = await pide('/entrar.html', null);
dice(r.status === 200 && preguntas === 0, 'entrar.html se entrega sin sesión ni pregunta', r.status);

console.log(`\n${revisadas - fallas} de ${revisadas} bien`);
process.exit(fallas ? 1 : 0);
