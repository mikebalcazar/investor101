/* patron101 — lo que ve quien presta: su estado de cuenta, las rondas
 * abiertas y cada uno de sus préstamos con su tabla y sus comprobantes.
 *
 * Mike, 8-oct: «que ellos puedan ver cuánto tienen invertido en taller101 y
 * durante cuánto tiempo y sepan qué día se les paga de regreso el préstamo
 * con sus intereses (…) y que en su estado de cuenta vaya viendo los pagos
 * que le van a llegar y los comprobantes de pago que ya se hicieron».
 *
 * De una ronda ve las condiciones y el avance TOTAL; nunca quién más entró
 * ni con cuánto. Eso lo decide la API, no esta pantalla.
 */
'use strict';
(() => {
  const { h, pesos, pesosCorto, dia } = I101;
  const V = {};
  I101.inversionista = V;

  const pinta = (html) => { const v = document.getElementById('vista'); v.innerHTML = html; return v; };
  const q = (raiz, s) => raiz.querySelector(s);

  const tarjetaRonda = (r) => {
    const mia = [...r.mis_ofertas].reverse().find((o) => o.estado !== 'retirada') || null;
    const abierta = r.estado === 'abierta';
    return `<li><a class="ren" href="#/ronda/${h(r.id)}">
      <div class="p"><b>${h(r.nombre)} ${abierta ? '' : I101.etiqueta(I101.ESTADO_RONDA, r.estado)}${mia ? ` ${I101.etiqueta(I101.ESTADO_OFERTA, mia.estado)}` : ''}</b>
        <span>${h(I101.tasa(r.tipo_tasa, r.tasa_pb))} · ${h(I101.comoSePaga(r))}</span>
        <div class="avance"><i style="width:${r.avance.porcentaje}%"></i></div></div>
      <div class="m"><b>${pesosCorto(r.monto_meta)}</b><span>${abierta ? `faltan ${pesosCorto(r.avance.falta)}` : `${r.avance.porcentaje} %`}</span></div></a></li>`;
  };

  const renglonPrestamo = (p) => {
    const s = p.resumen;
    const pie = p.estado === 'activo' && s.proximo ? `Próximo pago: ${pesos(s.proximo.total)} el ${dia(s.proximo.fecha)}`
      : p.estado === 'por_depositar' ? 'Falta tu depósito' : p.estado === 'liquidado' ? `Liquidado · ganaste ${pesos(s.interes_pagado)}` : '';
    return `<li><a class="ren" href="#/prestamo/${h(p.id)}">
      <div class="p"><b>${h(p.ronda_nombre || 'Préstamo')} ${I101.etiqueta(I101.ESTADO_PRESTAMO, p.estado)}</b><span>${h(p.folio)} · ${h(I101.tasa(p.tipo_tasa, p.tasa_pb))} · ${h(pie)}</span></div>
      <div class="m"><b>${pesosCorto(p.estado === 'activo' ? s.capital_pendiente : p.monto)}</b><span>${p.estado === 'activo' ? `de ${pesosCorto(p.monto)}` : ''}</span></div></a></li>`;
  };

  /* ═══════════════ mi cuenta ═══════════════ */

  V.inicio = async () => {
    const d = await I101.inv('');
    const r = d.resumen;
    const abiertas = d.rondas.filter((x) => x.estado === 'abierta');
    const pasadas = d.rondas.filter((x) => x.estado !== 'abierta');
    const porDepositar = d.prestamos.filter((p) => p.estado === 'por_depositar');
    const nombre = String(d.inversionista.nombre).split(/\s+/)[0];
    pinta(`
      <div class="cab"><div class="t"><h1>Hola, ${h(nombre)}</h1><p class="sub">Tu cuenta con ${h(d.empresa.nombre)}.</p></div></div>
      ${porDepositar.map((p) => `<a class="tarjeta realce" href="#/prestamo/${h(p.id)}" style="display:block;text-decoration:none;color:inherit">
        <h2>Te aceptaron ${pesos(p.monto)} <span class="der">${h(p.folio)}</span></h2>
        <p style="margin:0">Falta tu depósito. Aquí están los datos para hacerlo y dónde subir tu comprobante →</p></a>`).join('')}
      <div class="cifras">
        <div class="cifra principal"><div class="e">Tienes invertido</div><div class="v">${pesosCorto(r.invertido)}</div><div class="d">${r.prestamos_activos} préstamo${r.prestamos_activos === 1 ? '' : 's'} activo${r.prestamos_activos === 1 ? '' : 's'}</div></div>
        <div class="cifra"><div class="e">Te van a pagar</div><div class="v">${pesosCorto(r.por_recibir)}</div><div class="d">capital más interés</div></div>
        <div class="cifra"><div class="e">Interés ya ganado</div><div class="v">${pesosCorto(r.interes_ganado)}</div><div class="d">${r.interes_por_ganar ? `faltan ${pesosCorto(r.interes_por_ganar)}` : ''}</div></div>
        <div class="cifra"><div class="e">Tu próximo pago</div><div class="v">${r.proximo ? pesosCorto(r.proximo.total) : '—'}</div><div class="d">${r.proximo ? `${h(dia(r.proximo.fecha))} · ${h(I101.falta(r.proximo.fecha, d.hoy))}` : 'Nada programado'}</div></div>
      </div>
      ${abiertas.length ? `<section class="tarjeta azul"><h2>Rondas abiertas</h2><ul class="lista">${abiertas.map(tarjetaRonda).join('')}</ul></section>` : ''}
      <section class="tarjeta"><h2>Lo que te van a pagar</h2>
        ${d.proximos.length ? `<ul class="lista">${d.proximos.map((g) => `<li><a class="ren" href="#/prestamo/${h(g.prestamo_id)}">
          <div class="p"><b>${h(I101.diaConSemana(g.fecha))} <span class="et${g.vencido ? ' mal' : ''}">${g.vencido ? 'Atrasado' : h(I101.falta(g.fecha, d.hoy))}</span></b><span>${h(g.folio)} · pago ${g.numero} de ${g.de}</span></div>
          <div class="m"><b>${pesos(g.total)}</b><span>${pesos(g.capital)} + ${pesos(g.interes)}</span></div></a></li>`).join('')}</ul>` : '<p class="vacio">No tienes pagos programados.</p>'}</section>
      <section class="tarjeta"><h2>Tus préstamos</h2>
        ${d.prestamos.length ? `<ul class="lista">${d.prestamos.map(renglonPrestamo).join('')}</ul>` : `<p class="vacio">Todavía no tienes préstamos con ${h(d.empresa.nombre)}.${abiertas.length ? ' Arriba hay una ronda abierta.' : ' Cuando abran una ronda te llega un correo y aparece aquí.'}</p>`}</section>
      ${pasadas.length ? `<section class="tarjeta"><h2>Rondas anteriores</h2><ul class="lista">${pasadas.map(tarjetaRonda).join('')}</ul></section>` : ''}`);
  };

  /* ═══════════════ una ronda ═══════════════ */

  V.ronda = async (id) => {
    const r = await I101.inv(`/rondas/${id}`);
    const hoy = I101.sesion.hoy;
    const abierta = r.estado === 'abierta' && !(r.fecha_limite && hoy > r.fecha_limite);
    const pendiente = r.mis_ofertas.find((o) => o.estado === 'pendiente') || null;
    const resueltas = r.mis_ofertas.filter((o) => o.estado !== 'pendiente');
    const sugerido = pendiente?.monto ?? Math.max(r.monto_minimo || 0, Math.min(r.avance.falta || r.monto_meta, 1000000));

    const raiz = pinta(`
      <p class="migas"><a href="#/">← Mi cuenta</a></p>
      <div class="cab"><div class="t"><span class="folio">${h(r.folio)}</span><h1>${h(r.nombre)} ${I101.etiqueta(I101.ESTADO_RONDA, r.estado)}</h1>${r.descripcion ? `<p class="sub">${h(r.descripcion)}</p>` : ''}</div></div>
      <section class="tarjeta"><h2>Avance <span class="der">${r.avance.porcentaje} %</span></h2>
        <div class="avance"><i style="width:${r.avance.porcentaje}%"></i></div>
        <div class="avance-pie"><span><b>${pesos(r.avance.juntado)}</b> de ${pesos(r.monto_meta)}</span><span>Faltan <b>${pesos(r.avance.falta)}</b></span></div></section>
      <section class="tarjeta"><h2>Las condiciones</h2>
        ${I101.datosCondiciones(r, `
          <div><dt>El dinero se necesita el</dt><dd>${h(dia(r.fecha_inicio))}</dd></div>
          ${r.monto_minimo ? `<div><dt>Se entra desde</dt><dd>${pesos(r.monto_minimo)}</dd></div>` : ''}
          ${r.fecha_limite ? `<div><dt>Se puede entrar hasta</dt><dd>${h(dia(r.fecha_limite))}</dd></div>` : ''}
          ${r.ejemplo ? `<div><dt>Por cada $10,000 regresan</dt><dd>${pesos(r.ejemplo.totales.total)}</dd></div>` : ''}`)}
        <p class="nota">El interés corre desde el día en que se confirma tu depósito.</p></section>

      ${resueltas.map((o) => `<section class="tarjeta${o.estado === 'aprobada' ? ' realce' : ''}"><h2>Tu oferta ${I101.etiqueta(I101.ESTADO_OFERTA, o.estado)} <span class="der">${h(I101.momento(o.creado_at))}</span></h2>
        ${o.estado === 'aprobada' ? `<p style="margin:0 0 10px">Te aceptaron <b>${pesos(o.monto_aprobado)}</b>${o.monto_aprobado !== o.monto ? ` (ofreciste ${pesos(o.monto)})` : ''}. Lo que sigue es tu depósito.</p><a class="b acc" href="#/prestamo/${h(o.prestamo_id)}">Ver mi préstamo y cómo depositar</a>`
    : o.estado === 'rechazada' ? `<p style="margin:0">Tu oferta de ${pesos(o.monto)} no entró esta vez.${o.motivo ? ` Motivo: ${h(o.motivo)}` : ''}</p>` : `<p style="margin:0">Retiraste tu oferta de ${pesos(o.monto)}.</p>`}</section>`).join('')}

      ${abierta ? `<form class="tarjeta azul form" id="f-oferta"><h2>${pendiente ? 'Tu oferta está en revisión' : '¿Le entras?'}</h2>
        ${pendiente ? `<p style="margin:-4px 0 0">Ofreciste <b>${pesos(pendiente.monto)}</b>. ${h(I101.sesion.empresa.nombre)} la revisa y te avisa por correo. Mientras, la puedes cambiar o retirar.</p>` : '<p style="margin:-4px 0 0">Di con cuánto. No te compromete todavía: revisan tu oferta y te confirman por correo.</p>'}
        <label class="campo"><span>Con cuánto</span><div class="con-signo"><i>$</i><input name="monto" inputmode="decimal" autocomplete="off" value="${h(I101.enPesos(sugerido))}"></div></label>
        <div data-mi-tabla aria-live="polite"></div>
        <label class="campo"><span>Algo que quieras decir <small>(opcional)</small></span><input name="nota" maxlength="500" value="${h(pendiente?.nota || '')}"></label>
        <p class="err"></p>
        <div class="pie-form">${pendiente ? '<button type="button" class="b mal" data-retirar>Retirar mi oferta</button>' : ''}<button class="b acc">${pendiente ? 'Cambiar mi oferta' : 'Le entro'}</button></div>
      </form>` : (r.estado === 'abierta' ? '<p class="aviso ojo">La fecha para entrar a esta ronda ya pasó.</p>' : '')}`);

    const f = q(raiz, '#f-oferta');
    if (!f) return;
    /* Lo que le regresaría su monto, calculado por la API con las
     * condiciones de la ronda. */
    const entrada = q(f, '[name="monto"]');
    const donde = q(f, '[data-mi-tabla]');
    let turno = 0, reloj = null;
    const simular = async () => {
      const yo = ++turno;
      const monto = I101.aCentavos(entrada.value);
      if (!monto) { donde.innerHTML = ''; return; }
      try {
        const s = await I101.inv('/simular', { cuerpo: { monto, tipo_tasa: r.tipo_tasa, tasa_pb: r.tasa_pb, esquema: r.esquema, frecuencia: r.frecuencia, num_pagos: r.num_pagos, fecha_inicio: r.fecha_inicio < hoy ? hoy : r.fecha_inicio, fecha_primer_pago: r.fecha_primer_pago, fecha_vencimiento: r.fecha_vencimiento } });
        if (yo !== turno) return;
        donde.innerHTML = `<div class="panel"><h3>Con ${pesos(monto)} te regresan ${pesos(s.totales.total)} <small>· ganas ${pesos(s.totales.interes)}</small></h3>${I101.tablaSimulada(s.tabla, s.totales)}<p class="nota">Estimado con el dinero llegando el ${h(dia(r.fecha_inicio < hoy ? hoy : r.fecha_inicio))}. Las fechas exactas se fijan al confirmar tu depósito.</p></div>`;
      } catch { if (yo === turno) donde.innerHTML = ''; }
    };
    entrada.addEventListener('input', () => { clearTimeout(reloj); reloj = setTimeout(simular, 350); });
    simular();
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const monto = I101.aCentavos(entrada.value);
      if (!monto) { q(f, '.err').textContent = 'Escribe con cuánto, en pesos.'; return; }
      const res = await I101.hacer(q(f, 'button.acc'), () => I101.inv(`/rondas/${id}/ofertas`, { cuerpo: { monto, nota: q(f, '[name="nota"]').value } }), q(f, '.err'));
      if (res) { I101.avisa('Listo: tu oferta quedó en revisión.'); V.ronda(id); }
    });
    q(f, '[data-retirar]')?.addEventListener('click', async (ev) => {
      if (!confirm('¿Retirar tu oferta?')) return;
      const res = await I101.hacer(ev.currentTarget, () => I101.inv(`/ofertas/${pendiente.id}/retirar`, { metodo: 'POST' }), q(f, '.err'));
      if (res) V.ronda(id);
    });
  };

  /* ═══════════════ un préstamo ═══════════════ */

  V.prestamo = async (id) => {
    const p = await I101.inv(`/prestamos/${id}`);
    const hoy = I101.sesion.hoy;
    const s = p.resumen;
    const porDepositar = p.estado === 'por_depositar';
    const comprobante = (p.archivos || []).find((a) => a.clase === 'comprobante_deposito');
    const cambios = (p.eventos || []).filter((e) => e.que === 'tabla_editada').length;

    const raiz = pinta(`
      <p class="migas"><a href="#/">← Mi cuenta</a></p>
      <div class="cab"><div class="t"><span class="folio">${h(p.folio)}</span><h1>${pesosCorto(p.monto)}${p.ronda ? ` · ${h(p.ronda.nombre)}` : ''} ${I101.etiqueta(I101.ESTADO_PRESTAMO, p.estado)}</h1>
        <p class="sub">${h(I101.tasa(p.tipo_tasa, p.tasa_pb))} · ${h(I101.comoSePaga({ ...p, num_pagos: s.pagos_total }))}</p></div>
        <div class="acc"><button class="b" data-pagare>Pagaré en PDF</button></div></div>
      <p class="err" id="err-accion"></p>

      ${porDepositar ? `<section class="tarjeta realce"><h2>Lo que sigue: tu depósito</h2>
        <ol style="margin:0 0 10px;padding-left:20px;display:grid;gap:6px">
          <li>Deposita <b>${pesos(p.monto)}</b> a esta cuenta:${p.instrucciones ? `<p class="pre">${h(p.instrucciones)}</p>` : ` <i>pídele los datos a ${h(p.empresa.nombre)}.</i>`}</li>
          <li>Sube aquí tu comprobante.</li>
          <li>${h(p.empresa.nombre)} confirma que llegó. Ese día arranca tu préstamo y empieza a correr tu interés.</li>
        </ol>
        ${comprobante ? `<p class="aviso bien" style="margin:0 0 10px">Ya subiste tu comprobante. Falta que ${h(p.empresa.nombre)} lo confirme.</p>` : ''}
        ${I101.botonSubir(comprobante ? 'Subir otro comprobante' : 'Subir mi comprobante', { prestamo_id: p.id, clase: 'comprobante_deposito' }, comprobante ? 'b' : 'b acc')}
      </section>` : ''}

      ${p.estado !== 'cancelado' && !porDepositar ? `<div class="cifras">
        <div class="cifra principal"><div class="e">Te deben de capital</div><div class="v">${pesosCorto(s.capital_pendiente)}</div><div class="d">de ${pesosCorto(p.monto)}</div></div>
        <div class="cifra"><div class="e">Interés por recibir</div><div class="v">${pesosCorto(s.interes_pendiente)}</div><div class="d">de ${pesosCorto(s.interes_total)}</div></div>
        <div class="cifra"><div class="e">Ya te pagaron</div><div class="v">${pesosCorto(s.capital_pagado + s.interes_pagado)}</div><div class="d">${s.pagos_hechos} de ${s.pagos_total} pagos</div></div>
        <div class="cifra"><div class="e">Tu próximo pago</div><div class="v">${s.proximo ? pesosCorto(s.proximo.total) : '—'}</div><div class="d">${s.proximo ? `${h(dia(s.proximo.fecha))} · ${h(I101.falta(s.proximo.fecha, hoy))}` : ''}</div></div>
      </div>` : ''}

      <section class="tarjeta"><h2>Tu tabla de pagos</h2>
        ${cambios ? `<p class="aviso ojo">Esta tabla se cambió ${cambios === 1 ? 'una vez' : `${cambios} veces`}. Abajo, en «Historia», está el motivo y cómo estaba antes.</p>` : ''}
        ${I101.tablaDePagos(p, { hoy })}
        ${porDepositar ? '<p class="nota">Las fechas son estimadas: se fijan el día en que se confirma tu depósito.</p>' : p.estado === 'activo' ? `<p class="nota">Tu préstamo arrancó el ${h(dia(p.fecha_inicio))}. Cada pago que te hagan aparece aquí con su comprobante.</p>` : ''}
      </section>

      <section class="tarjeta"><h2>Papeles</h2>
        ${I101.listaDePapeles(p, { puedeQuitar: (a) => porDepositar && a.clase === 'comprobante_deposito' })}
        <div class="pie-form" style="justify-content:flex-start;margin-top:12px">${p.estado !== 'cancelado' ? I101.botonSubir('Subir el pagaré firmado', { prestamo_id: p.id, clase: 'contrato_firmado' }) : ''}</div>
      </section>
      <section class="tarjeta"><h2>Historia</h2>${I101.bitacora(p.eventos, false)}</section>`);

    const otraVez = () => V.prestamo(id);
    I101.enlazarSubidas(raiz, otraVez);
    I101.enlazarQuitarArchivos(raiz, otraVez);
    q(raiz, '[data-pagare]').addEventListener('click', (ev) => I101.hacer(ev.currentTarget, () => I101.descargarPagare(p), q(raiz, '#err-accion')));
  };
})();
