/* patron101 — las piezas que comparten quien dirige y quien presta: el
 * formulario de condiciones (con la tabla que resulta, en vivo), la tabla de
 * pagos, los papeles y la bitácora. */
'use strict';
(() => {
  const { h, pesos, dia } = I101;

  /* ─────────────── las condiciones de un préstamo ───────────────
   * El mismo formulario para una ronda, un préstamo directo y «aceptar con
   * otras condiciones». La tabla de abajo la calcula la API mientras se
   * teclea: aquí no hay ninguna cuenta. */

  I101.formCondiciones = (v = {}, o = {}) => {
    const esquema = v.esquema === 'parcialidades' ? 'parcialidades' : 'unico';
    const sel = (a, b) => (a === b ? ' selected' : '');
    return `
    <div class="condiciones form" data-condiciones>
      <div class="form" data-campos>
      ${o.sinMonto ? '' : `
      <label class="campo"><span>${h(o.etiquetaMonto || 'Monto')}</span>
        <div class="con-signo"><i>$</i><input name="monto" inputmode="decimal" autocomplete="off" value="${h(I101.enPesos(v.monto))}" placeholder="0.00"></div>
      </label>`}
      <div class="fila dos">
        <label class="campo"><span>Tipo de tasa</span>
          <select name="tipo_tasa">
            <option value="mensual"${sel(v.tipo_tasa || 'mensual', 'mensual')}>Mensual (se prorratea por días)</option>
            <option value="anual"${sel(v.tipo_tasa, 'anual')}>Anual (días reales entre 365)</option>
            <option value="fija"${sel(v.tipo_tasa, 'fija')}>Fija por todo el plazo</option>
          </select>
        </label>
        <label class="campo"><span>Tasa</span>
          <div class="con-signo der"><i>%</i><input name="tasa" inputmode="decimal" autocomplete="off" value="${h(I101.enPorciento(v.tasa_pb ?? ''))}" placeholder="0"></div>
        </label>
      </div>
      <div class="campo"><span>Cómo se paga de regreso</span>
        <div class="opciones">
          <label class="opcion"><input type="radio" name="esquema" value="unico"${esquema === 'unico' ? ' checked' : ''}> Un solo pago</label>
          <label class="opcion"><input type="radio" name="esquema" value="parcialidades"${esquema === 'parcialidades' ? ' checked' : ''}> En parcialidades</label>
        </div>
      </div>
      <div class="fila dos">
        <label class="campo"><span>${h(o.etiquetaInicio || 'El dinero se recibe el')}</span>
          <input type="date" name="fecha_inicio" value="${h(v.fecha_inicio || '')}">
          <small>Desde ese día corre el interés. Se corrige sola al marcar el depósito recibido.</small>
        </label>
        <label class="campo" data-de="unico"><span>Se paga todo el</span>
          <input type="date" name="fecha_vencimiento" value="${h(v.fecha_vencimiento || '')}">
        </label>
      </div>
      <div class="fila tres" data-de="parcialidades">
        <label class="campo"><span>Cada cuánto</span>
          <select name="frecuencia">
            <option value="semanal"${sel(v.frecuencia, 'semanal')}>Cada semana</option>
            <option value="quincenal"${sel(v.frecuencia, 'quincenal')}>Cada 15 días</option>
            <option value="mensual"${sel(v.frecuencia || 'mensual', 'mensual')}>Cada mes</option>
          </select>
        </label>
        <label class="campo"><span>Cuántos pagos</span>
          <input name="num_pagos" inputmode="numeric" autocomplete="off" value="${h(v.num_pagos ?? '')}" placeholder="10">
        </label>
        <label class="campo"><span>Primer pago <small>(opcional)</small></span>
          <input type="date" name="fecha_primer_pago" value="${h(v.fecha_primer_pago || '')}">
        </label>
      </div>
      </div>
      <div class="simulacion" data-simulacion aria-live="polite"></div>
    </div>`;
  };

  /** Lo tecleado, dicho como lo espera la API. Lo que no se pudo leer queda
   *  en `null` y la API lo rechaza con sus palabras. */
  I101.leerCondiciones = (raiz, montoFijo) => {
    const c = raiz.querySelector('[data-condiciones]') || raiz;
    const v = (n) => c.querySelector(`[name="${n}"]`)?.value ?? '';
    const esquema = c.querySelector('[name="esquema"]:checked')?.value || 'unico';
    const out = {
      tipo_tasa: v('tipo_tasa'), tasa_pb: I101.aPuntos(v('tasa') || '0'), esquema, fecha_inicio: v('fecha_inicio') || null,
      frecuencia: esquema === 'parcialidades' ? v('frecuencia') : null,
      num_pagos: esquema === 'parcialidades' ? (/^\d+$/.test(v('num_pagos').trim()) ? Number(v('num_pagos')) : null) : null,
      fecha_primer_pago: esquema === 'parcialidades' ? (v('fecha_primer_pago') || null) : null,
      fecha_vencimiento: esquema === 'unico' ? (v('fecha_vencimiento') || null) : null,
    };
    if (montoFijo !== undefined) out.monto = montoFijo;
    else if (c.querySelector('[name="monto"]')) out.monto = I101.aCentavos(v('monto'));
    return out;
  };

  /** Prende el formulario: enseña lo del esquema escogido y pide la tabla a
   *  la API cada vez que algo cambia. `monto()` da el monto cuando el
   *  formulario no lo trae (una ronda simula con su meta). */
  I101.enlazarCondiciones = (raiz, o = {}) => {
    const c = raiz.querySelector('[data-condiciones]');
    if (!c) return;
    const sim = c.querySelector('[data-simulacion]');
    let turno = 0, reloj = null;
    const acomodar = () => {
      const esquema = c.querySelector('[name="esquema"]:checked')?.value || 'unico';
      c.querySelectorAll('[data-de]').forEach((e) => { e.hidden = e.dataset.de !== esquema; });
    };
    const simular = async () => {
      const yo = ++turno;
      const cond = I101.leerCondiciones(c, o.monto ? o.monto() : undefined);
      // Mientras falte lo básico no se le pregunta nada a la API ni se regaña.
      if (!cond.monto || !cond.fecha_inicio || cond.tasa_pb === null || (cond.esquema === 'unico' ? !cond.fecha_vencimiento : !cond.num_pagos)) { sim.innerHTML = ''; return; }
      try {
        const r = await I101.inv('/simular', { cuerpo: cond });
        if (yo !== turno) return;
        sim.innerHTML = `<div class="panel"><h3>Así queda${o.ejemplo ? ` <small>(${h(o.ejemplo)})</small>` : ''}</h3>${I101.tablaSimulada(r.tabla, r.totales)}</div>`;
      } catch (e) {
        if (yo !== turno) return;
        sim.innerHTML = `<p class="aviso ojo">${h(e.message)}</p>`;
      }
    };
    const pronto = () => { clearTimeout(reloj); reloj = setTimeout(simular, 350); };
    c.addEventListener('input', pronto);
    c.addEventListener('change', () => { acomodar(); pronto(); });
    if (o.vigilar) o.vigilar.forEach((e) => e && e.addEventListener('input', pronto));
    acomodar();
    simular();
  };

  /* En el teléfono no caben cinco columnas de dinero: capital e interés
   * (`.ancho`) se esconden y van, chicos, debajo del pago (`.angosto`). */
  const desglose = (capital, interes) => `<small class="angosto">${pesos(capital)} + ${pesos(interes)}</small>`;

  I101.tablaSimulada = (tabla, totales) => `
    <div class="tabla-caja"><table>
      <thead><tr><th>#</th><th>Fecha</th><th class="n ancho">Capital</th><th class="n ancho">Interés</th><th class="n">Pago</th></tr></thead>
      <tbody>${tabla.map((r) => `<tr><td>${r.numero}</td><td>${h(dia(r.fecha))}</td><td class="n ancho">${pesos(r.capital)}</td><td class="n ancho">${pesos(r.interes)}</td><td class="n">${pesos(r.total)}${desglose(r.capital, r.interes)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="2">Total</td><td class="n ancho">${pesos(totales.capital)}</td><td class="n ancho">${pesos(totales.interes)}</td><td class="n">${pesos(totales.total)}${desglose(totales.capital, totales.interes)}</td></tr></tfoot>
    </table></div>`;

  /** Las condiciones ya acordadas, en pares dato-valor. */
  I101.datosCondiciones = (c, extra = '') => `
    <dl class="datos">
      <div><dt>Rendimiento</dt><dd>${h(I101.tasa(c.tipo_tasa, c.tasa_pb))}</dd></div>
      <div><dt>Cómo se paga</dt><dd>${h(I101.comoSePaga(c))}</dd></div>
      ${extra}
    </dl>`;

  /* ─────────────── la tabla de pagos de un préstamo ─────────────── */

  /** `o.hoy` marca lo vencido; `o.archivos` cuelga los comprobantes en su
   *  pago; `o.accion(pago)` deja a cada vista poner su botón. */
  I101.tablaDePagos = (prestamo, o = {}) => {
    const pagos = prestamo.pagos || [];
    if (!pagos.length) return '<p class="vacio">Sin pagos.</p>';
    const comprobantes = (id) => (prestamo.archivos || []).filter((a) => a.pago_id === id && a.clase === 'comprobante_pago');
    const activo = prestamo.estado === 'activo';
    const fila = (g) => {
      const hecho = g.estado === 'pagado';
      const vencido = !hecho && activo && o.hoy && g.fecha < o.hoy;
      const estado = hecho ? `<span class="et bien">Pagado ${h(dia(g.pagado_fecha))}</span>`
        : vencido ? '<span class="et mal">Vencido</span>'
          : activo ? `<span class="et">${h(I101.falta(g.fecha, o.hoy))}</span>` : '<span class="et">Pendiente</span>';
      const papeles = comprobantes(g.id).map((a) => `<a class="b chico" href="${h(I101.ligaArchivo(a.id))}" target="_blank" rel="noopener">Comprobante</a>`).join(' ');
      return `<tr class="${hecho ? 'hecho' : vencido ? 'vencido' : ''}" data-pago="${h(g.id)}">
        <td>${g.numero}</td><td class="f">${h(dia(g.fecha))}</td>
        <td class="n ancho">${pesos(g.capital)}</td><td class="n ancho">${pesos(g.interes)}</td><td class="n"><b>${pesos(g.total)}</b>${desglose(g.capital, g.interes)}</td>
        <td>${estado}</td><td>${papeles}${o.accion ? ` ${o.accion(g)}` : ''}</td></tr>`;
    };
    const suma = (k) => pagos.reduce((s, g) => s + Number(g[k]), 0);
    return `<div class="tabla-caja"><table>
      <thead><tr><th>#</th><th>Fecha</th><th class="n ancho">Capital</th><th class="n ancho">Interés</th><th class="n">Pago</th><th>Estado</th><th></th></tr></thead>
      <tbody>${pagos.map(fila).join('')}</tbody>
      <tfoot><tr><td colspan="2">Total</td><td class="n ancho">${pesos(suma('capital'))}</td><td class="n ancho">${pesos(suma('interes'))}</td><td class="n">${pesos(suma('total'))}${desglose(suma('capital'), suma('interes'))}</td><td colspan="2"></td></tr></tfoot>
    </table></div>`;
  };

  /* ─────────────── papeles ─────────────── */

  const CLASES = { comprobante_deposito: 'Comprobante del depósito', contrato_firmado: 'Pagaré firmado', comprobante_pago: 'Comprobante de pago', otro: 'Otro' };
  I101.nombreDeClase = (c) => CLASES[c] || c;

  I101.subirArchivo = async (archivo, datos) => {
    const forma = new FormData();
    forma.set('archivo', archivo);
    for (const [k, v] of Object.entries(datos)) if (v) forma.set(k, v);
    return I101.inv('/archivos', { forma });
  };

  /** Un botón que abre el selector de archivos y sube lo escogido. */
  I101.botonSubir = (texto, datos, clase = 'b') =>
    `<label class="${clase}" data-subir='${h(JSON.stringify(datos))}'>${h(texto)}<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/heic" hidden></label>`;

  /** Prende todos los `botonSubir` de una vista. Al terminar, `listo()`. */
  I101.enlazarSubidas = (raiz, listo) => {
    raiz.querySelectorAll('[data-subir] input[type=file]').forEach((entrada) => {
      entrada.addEventListener('change', async () => {
        const archivo = entrada.files?.[0];
        if (!archivo) return;
        const etiqueta = entrada.closest('[data-subir]');
        const antes = etiqueta.firstChild.textContent;
        etiqueta.firstChild.textContent = 'Subiendo…';
        try {
          await I101.subirArchivo(archivo, JSON.parse(etiqueta.dataset.subir));
          I101.avisa('Archivo guardado.');
          listo();
        } catch (e) {
          I101.avisa(e.message, true);
          etiqueta.firstChild.textContent = antes;
          entrada.value = '';
        }
      });
    });
  };

  /** Los papeles de un préstamo que no son comprobantes de un pago. */
  I101.listaDePapeles = (prestamo, o = {}) => {
    const sueltos = (prestamo.archivos || []).filter((a) => a.clase !== 'comprobante_pago');
    if (!sueltos.length) return '<p class="vacio">Todavía no hay papeles.</p>';
    return `<ul class="lista">${sueltos.map((a) => `<li><div class="ren">
      <div class="p"><b>${h(I101.nombreDeClase(a.clase))}</b><span>${h(a.nombre)} · ${h(I101.momento(a.creado_at))}</span></div>
      <div class="acc"><a class="b chico" href="${h(I101.ligaArchivo(a.id))}" target="_blank" rel="noopener">Ver</a>
      ${o.puedeQuitar && o.puedeQuitar(a) ? `<button class="b chico mal" data-quitar-archivo="${h(a.id)}">Quitar</button>` : ''}</div></div></li>`).join('')}</ul>`;
  };

  I101.enlazarQuitarArchivos = (raiz, listo) => {
    raiz.querySelectorAll('[data-quitar-archivo]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('¿Quitar este archivo?')) return;
      const r = await I101.hacer(b, () => I101.inv(`/archivos/${b.dataset.quitarArchivo}`, { metodo: 'DELETE' }));
      if (r) listo();
    }));
  };

  /* ─────────────── la bitácora de un préstamo ─────────────── */

  const QUE = {
    prestamo_creado: 'Se acordó el préstamo', condiciones_cambiadas: 'Cambiaron las condiciones', recibido: 'Se recibió el depósito',
    tabla_editada: 'Cambió la tabla de pagos', pago: 'Se registró un pago', pago_deshecho: 'Se deshizo un pago', prestamo_cancelado: 'Se canceló',
  };
  I101.bitacora = (eventos, conQuien) => {
    if (!eventos?.length) return '<p class="vacio">Sin movimientos.</p>';
    const detalle = (e) => {
      const d = e.datos || {};
      if (e.que === 'pago') return ` · pago ${d.numero}: ${pesos(Number(d.capital) + Number(d.interes))}${d.liquidado ? ' · liquidado' : ''}`;
      if (e.que === 'recibido') return ` · ${pesos(d.monto)} el ${dia(d.fecha)}`;
      if (e.que === 'pago_deshecho') return ` · pago ${d.numero}`;
      return '';
    };
    const antesDespues = (e) => {
      if (e.que !== 'tabla_editada' || !e.datos) return '';
      const linea = (l) => (l || []).map((r) => `${dia(r.fecha)}: ${pesos(Number(r.capital) + Number(r.interes))}`).join(' · ');
      return `<span class="nota">Antes: ${h(linea(e.datos.antes))}<br>Ahora: ${h(linea(e.datos.despues))}</span>`;
    };
    return `<ul class="bitacora">${[...eventos].reverse().map((e) => `<li>
      <b>${h(QUE[e.que] || e.que)}</b>${h(detalle(e))}
      <time>${h(I101.momento(e.ts))}${conQuien && e.quien_nombre ? ` · ${h(e.quien_nombre)}` : ''}</time>
      ${e.nota ? `<q>${h(e.nota)}</q>` : ''}${antesDespues(e)}</li>`).join('')}</ul>`;
  };
})();
