/* patron101 como Worker de Cloudflare — la puerta.
 *
 * EL NOMBRE. La app nació el 8-oct-2026 como «investor101» y Mike le puso
 * «patron101» ese mismo día. Lo que la gente ve —la marca, el dominio
 * patron101.taller101.com— dice patron101. Lo de adentro —este Worker, el
 * repositorio, `X-App: investor101`, la llave `investor`— conserva el nombre
 * con el que nació, igual que quell101 vive en el Worker `bitacora-obra`:
 * renombrar infraestructura viva desliga cosas (OPERAR.md §8).
 *
 * Igual que cost101, quote101 y las demás apps de la suite (decisión D1): la
 * app vive en su propio Worker y le habla a `suite101-api` desde su mismo
 * origen, por `/s101/*`, con un service binding. La sesión es la cookie
 * `s101` de la suite; servida desde el mismo origen es cookie propia (Safari
 * no la bloquea) y no hay CORS que configurar.
 *
 * **La app no se entrega sin sesión.** La única página pública es
 * `entrar.html`. El candado vive aquí y no dentro de la app: el Worker se
 * niega a entregarla, en vez de entregarla y pedirle a su JavaScript que se
 * esconda solo.
 *
 * LO QUE ESTA PUERTA TIENE DE DISTINTO: aquí entra gente que NO es de la
 * empresa. A investor101 llega quien la dirige y, sobre todo, quien le presta
 * dinero —el inversionista—, que no es miembro de nada. Por eso `/yo` trae
 * `inversion` (a qué empresas les presta) y esta puerta lo deja pasar con
 * eso. Qué ve cada quien lo decide la API renglón por renglón, no este
 * archivo: aquí sólo se decide si se entrega la pantalla.
 *
 * El Worker pone `X-App: investor101` y lo sobrescribe si la interfaz manda
 * otro: la app no decide quién dice ser.
 */

const PREFIJO = '/s101';
const APP = 'investor101';
/** La llave corta con la que la suite guarda la lista de apps por persona
 *  (`LLAVE_APP` en schema/tipos.ts de suite101-api). */
const LLAVE = 'investor';

/** Lo que se entrega sin sesión: la pantalla de entrada y lo que ella pide. */
const ABIERTO = new Set(['/entrar.html', '/entrar.js', '/404.html', '/huella.txt', '/marca.svg']);
const esAbierto = (ruta) => ABIERTO.has(ruta) || ruta.startsWith('/fonts/');

const archivo = (u) => {
  const p = u.pathname;
  if (p === '/' || p === '/index.html') return '/index.html';
  if (p === '/entrar') return '/entrar.html';
  return p;
};
const pedirArchivo = (req, u, env) => {
  const destino = new URL(req.url);
  destino.pathname = archivo(u);
  return env.ASSETS.fetch(new Request(destino, req));
};

/** ¿Quién viene, según la suite? Lo que contesta `/yo`, o null. */
async function laSuiteDiceQuien(req, env) {
  const galleta = req.headers.get('cookie');
  if (!galleta || !galleta.includes('s101=')) return null;
  const r = await env.API.fetch(new Request('https://suite101-api/yo', { headers: { cookie: galleta, 'X-App': APP } }));
  if (!r.ok) return null;
  const cuerpo = await r.json().catch(() => null);
  return cuerpo?.data || null;
}

/** Pasa el dueño de la suite, quien le presta a alguna empresa, y quien es
 *  de una empresa y trae investor101 entre sus apps (vacía quiere decir
 *  todas). Pasar esta puerta no abre ningún dato: eso lo decide la API. */
export const laSuiteLeAbre = (yo) =>
  !!yo && (yo.superadmin === true ||
    (yo.inversion || []).length > 0 ||
    (yo.orgs || []).some((o) => !o.apps?.length || o.apps.includes(LLAVE) || o.apps.includes(APP)));

/* workers.dev redirige al dominio propio y http sube a https; sólo lecturas y
 * nunca la puerta a la suite. Staging no tiene DOMINIO_PROPIO y no redirige. */
export function aDominioPropio(req, env, u) {
  const d = env.DOMINIO_PROPIO;
  const lectura = req.method === 'GET' || req.method === 'HEAD';
  // El dominio con el que nació (investor101.taller101.com) manda al de
  // ahora, con todo y `/s101`: nadie llegó a usarlo, y dos direcciones para
  // la misma cuenta son dos sesiones distintas.
  const viejo = env.DOMINIO_VIEJO;
  if (d && viejo && u.hostname === viejo && lectura) return Response.redirect(`https://${d}${u.pathname}${u.search}`, 301);
  if (d && u.protocol === 'http:' && u.hostname === d && lectura) {
    return Response.redirect(`https://${d}${u.pathname}${u.search}`, 301);
  }
  if (!d || u.hostname === d || !u.hostname.endsWith('.workers.dev')) return null;
  if (!lectura) return null;
  if (u.pathname === PREFIJO || u.pathname.startsWith(PREFIJO + '/')) return null;
  return Response.redirect(`https://${d}${u.pathname}${u.search}`, 301);
}

export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    const ida = aDominioPropio(req, env, u);
    if (ida) return ida;

    if (u.pathname === PREFIJO || u.pathname.startsWith(PREFIJO + '/')) {
      u.pathname = u.pathname.slice(PREFIJO.length) || '/';
      const r = new Request(u, req);
      r.headers.set('X-App', APP);
      return env.API.fetch(r);
    }

    if (esAbierto(archivo(u))) return pedirArchivo(req, u, env);

    // Todo lo demás —empezando por la app— pide sesión.
    const yo = await laSuiteDiceQuien(req, env);
    if (!laSuiteLeAbre(yo)) {
      // Una página se manda a entrar; un archivo suelto (un .js) contesta
      // 401, que es lo que un `fetch` sabe leer.
      const esPagina = archivo(u) === '/index.html' || (req.headers.get('accept') || '').includes('text/html');
      if (!esPagina) return new Response('sin sesión', { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8' } });
      return Response.redirect(new URL('/entrar.html', u.origin).toString(), 302);
    }
    return pedirArchivo(req, u, env);
  },
};
