/* Al arrancar, patron101 pregunta a la vez qué empresas abren la app.
 *
 * Antes era una tras otra (~250 ms cada una en staging) y el dueño de la
 * suite trae todas las empresas. Corre la función de verdad (se toma de
 * public/js/arranque.js) con una API de mentiras que cuenta cuántas
 * preguntas hubo al mismo tiempo.
 *
 *   node pruebas/las-empresas-a-la-vez.mjs
 */
import { readFileSync } from 'node:fs';

let fallas = 0, revisadas = 0;
const dice = (ok, que, dato = '') => { revisadas++; if (!ok) fallas++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${que}${dato !== '' ? '  →  ' + dato : ''}`); };

const fuente = readFileSync(new URL('../public/js/arranque.js', import.meta.url), 'utf8');
const ini = fuente.indexOf('async function cualesAbren');
dice(ini > 0, 'arranque.js tiene cualesAbren');
if (ini < 0) { console.log(`\n${revisadas - fallas} de ${revisadas} bien`); process.exit(1); }
const fin = fuente.indexOf('\n  }\n', ini) + 4;
const cualesAbren = new Function(`${fuente.slice(ini, fin)}\nreturn cualesAbren;`)();

const empresas = (n) => Array.from({ length: n }, (_, i) => ({ id: `e${i}` }));
const api = (abren) => {
  let enVuelo = 0, maximo = 0, total = 0;
  const pregunta = (id) => { total++; enVuelo++; maximo = Math.max(maximo, enVuelo);
    return new Promise((ok, no) => setTimeout(() => { enVuelo--; abren.includes(id) ? ok({ empresa: { nombre: id.toUpperCase() } }) : no(new Error('403')); }, 20)); };
  return { pregunta, cuenta: () => ({ maximo, total }) };
};

{
  const a = api(['e1', 'e2']);
  const r = await cualesAbren(empresas(3), a.pregunta);
  dice(r.map((x) => x.cand.id).join() === 'e1,e2', 'con tres empresas, abren las que abren y en su orden', r.map((x) => x.cand.id).join());
  dice(r[0].d?.empresa?.nombre === 'E1', 'y cada una trae lo que contestó');
  dice(a.cuenta().maximo === 3, 'las tres se preguntan a la vez', `${a.cuenta().maximo} a la vez`);
}
{
  const a = api(['e0']);
  const r = await cualesAbren(empresas(3), a.pregunta);
  dice(r[0]?.cand.id === 'e0', 'la recordada (la primera) gana si abre');
}
{
  const a = api([]);
  const r = await cualesAbren(empresas(2), a.pregunta);
  dice(r.length === 0, 'si ninguna abre, no hay empresa');
}
{
  const a = api(['e3']);
  const r = await cualesAbren(empresas(10), a.pregunta);
  dice(r[0]?.cand.id === 'e3' && a.cuenta().total === 4 && a.cuenta().maximo === 1, 'con muchas, una por una hasta la primera que abre', `${a.cuenta().total} preguntas`);
}

console.log(`\n${revisadas - fallas} de ${revisadas} bien`);
process.exit(fallas ? 1 : 0);
