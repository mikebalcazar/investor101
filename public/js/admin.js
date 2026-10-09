/* patron101 — lo que ve quien dirige la empresa: rondas, ofertas,
 * préstamos y el directorio de inversionistas.
 *
 * Los PAGOS no se registran aquí sino en dash101 (decisión de Mike con
 * botones: «un solo lugar de captura»); aquí se ven y se manda para allá.
 * Lo que sí se hace aquí: abrir rondas, avisar, aprobar ofertas, marcar el
 * depósito recibido, editar la tabla y guardar los papeles.
 */
'use strict';
(() => {
  const { h, pesos, pesosCorto, dia } = I101;
  const A = {};
  I101.admin = A;

  const pinta = (html) => { const v = document.getElementById('vista'); v.innerHTML = html; return v; };
  const q = (raiz, s) => raiz.querySelector(s);
  const valor = (raiz, n) => (raiz.querySelector(`[name="${n}"]`)?.value ?? '').trim();

  /** dash101 vive en el mismo dominio con otro nombre: patron101.x → dash101.x
   *  (en staging el Worker conserva su nombre interno: investor101-staging). */
  I101.urlDash = (ruta = '') => `${location.protocol}//${location.host.replace(/^(patron101|investor101)/, 'dash101')}${ruta}`;

  /* ═══════════════ inicio ═══════════════ */

  A.inicio = async () => {
    const d = await I101.inv('');
    I101.sesion.resumen = d.resumen;
    I101.pintarMenu();
    const r = d.resumen;
    const [rondas, porDepositar] = await Promise.all([I101.inv('/rondas'), I101.inv('/prestamos?estado=por_depositar')]);
    const abiertas = rondas.filas.filter((x) => x.estado === 'abierta' || (x.estado === 'cerrada' && x.avance.ofertas_pendientes));
    const borradores = rondas.filas.filter((x) => x.estado === 'borrador');

    const pendientes = [];
    if (r.vencidos.cuantos) pendientes.push(`<li><a class="ren" href="${h(I101.urlDash('/inversion'))}"><div class="p"><b>${r.vencidos.cuantos} pago${r.vencidos.cuantos > 1 ? 's' : ''} vencido${r.vencidos.cuantos > 1 ? 's' : ''}</b><span>Se registran en dash101</span></div><div class="m"><b style="color:var(--mal)">${pesos(r.vencidos.monto)}</b></div></a></li>`);
    for (const x of abiertas.filter((x) => x.avance.ofertas_pendientes)) pendientes.push(`<li><a class="ren" href="#/ronda/${h(x.id)}"><div class="p"><b>${x.avance.ofertas_pendientes} oferta${x.avance.ofertas_pendientes > 1 ? 's' : ''} por revisar</b><span>${h(x.nombre)}</span></div><div class="m"><b>${pesos(x.avance.por_aprobar)}</b></div></a></li>`);
    for (const p of porDepositar.filas) pendientes.push(`<li><a class="ren" href="#/prestamo/${h(p.id)}"><div class="p"><b>Depósito por confirmar</b><span>${h(p.inversionista_nombre)} · ${h(p.folio)}</span></div><div class="m"><b>${pesos(p.monto)}</b></div></a></li>`);
    for (const x of borradores) pendientes.push(`<li><a class="ren" href="#/ronda/${h(x.id)}"><div class="p"><b>Ronda en borrador${x.origen?.app === 'dash101' ? ' · vino de dash101' : ''}</b><span>${h(x.nombre)}</span></div><div class="m"><b>${pesos(x.monto_meta)}</b></div></a></li>`);

    pinta(`
      <div class="cab"><div class="t"><h1>Inicio</h1><p class="sub">Lo que ${h(d.empresa.nombre)} debe a quienes le prestaron.</p></div>
        <div class="acc"><a class="b acc" href="#/ronda/nueva">Nueva ronda</a></div></div>
      <div class="cifras">
        <div class="cifra principal"><div class="e">Capital que se debe</div><div class="v">${pesosCorto(r.capital_vigente)}</div><div class="d">${r.prestamos_activos} préstamo${r.prestamos_activos === 1 ? '' : 's'} activo${r.prestamos_activos === 1 ? '' : 's'}</div></div>
        <div class="cifra"><div class="e">Interés por pagar</div><div class="v">${pesosCorto(r.interes_por_pagar)}</div><div class="d">de lo activo</div></div>
        <div class="cifra"><div class="e">Sale en 30 días</div><div class="v">${pesosCorto(r.proximos_30.monto)}</div><div class="d">${r.proximos_30.cuantos} pago${r.proximos_30.cuantos === 1 ? '' : 's'}</div></div>
        <div class="cifra"><div class="e">Por recibir</div><div class="v">${pesosCorto(r.por_depositar.monto)}</div><div class="d">${r.por_depositar.cuantos} depósito${r.por_depositar.cuantos === 1 ? '' : 's'}</div></div>
      </div>
      ${pendientes.length ? `<section class="tarjeta realce"><h2>Te toca</h2><ul class="lista">${pendientes.join('')}</ul></section>` : ''}
      <section class="tarjeta"><h2>Rondas abiertas <a class="der" href="#/rondas">Todas</a></h2>
        ${abiertas.length ? `<ul class="lista">${abiertas.map(renglonRonda).join('')}</ul>` : '<p class="vacio">No hay ninguna ronda abierta.</p>'}</section>
      <section class="tarjeta"><h2>Próximos pagos <a class="der" href="${h(I101.urlDash('/inversion'))}">Pagar en dash101</a></h2>
        ${r.proximos.length ? `<ul class="lista">${r.proximos.map((g) => `<li><a class="ren" href="#/prestamo/${h(g.prestamo_id)}">
          <div class="p"><b>${h(g.inversionista_nombre)}</b><span>${h(g.folio)} · pago ${g.numero} de ${g.de}</span></div>
          <div class="m"><b>${pesos(g.total)}</b><span${g.vencido ? ' style="color:var(--mal);font-weight:600"' : ''}>${h(I101.diaConSemana(g.fecha))} · ${h(I101.falta(g.fecha, d.hoy))}</span></div></a></li>`).join('')}</ul>` : '<p class="vacio">Nada por pagar.</p>'}</section>`);
  };

  const renglonRonda = (x) => `<li><a class="ren" href="#/ronda/${h(x.id)}">
    <div class="p"><b>${h(x.nombre)} ${I101.etiqueta(I101.ESTADO_RONDA, x.estado)}${x.avance.ofertas_pendientes ? ` <span class="globo">${x.avance.ofertas_pendientes}</span>` : ''}</b>
      <span>${h(I101.tasa(x.tipo_tasa, x.tasa_pb))} · ${h(I101.comoSePaga(x))}</span>
      <div class="avance"><i style="width:${x.avance.porcentaje}%"></i></div></div>
    <div class="m"><b>${pesosCorto(x.avance.juntado)}</b><span>de ${pesosCorto(x.monto_meta)}</span></div></a></li>`;

  /* ═══════════════ rondas ═══════════════ */

  A.rondas = async () => {
    const { filas } = await I101.inv('/rondas');
    pinta(`
      <div class="cab"><div class="t"><h1>Rondas</h1><p class="sub">Cada ronda es un «necesito juntar tanto, para tal fecha, en estas condiciones».</p></div>
        <div class="acc"><a class="b acc" href="#/ronda/nueva">Nueva ronda</a></div></div>
      <section class="tarjeta">${filas.length ? `<ul class="lista">${filas.map(renglonRonda).join('')}</ul>` : '<p class="vacio">Todavía no hay rondas. Empieza con «Nueva ronda», o genera una desde el flujo proyectado de dash101.</p>'}</section>`);
  };

  /** El formulario de una ronda: nueva (`ronda` nulo) o existente. */
  A.rondaForm = async (id) => {
    const ronda = id ? await I101.inv(`/rondas/${id}`) : null;
    const ajustes = ronda ? null : await I101.inv('/ajustes');
    const hoy = I101.sesion.hoy;
    const v = ronda || { tipo_tasa: 'mensual', esquema: 'unico', fecha_inicio: I101.sumarDias(hoy, 3), fecha_vencimiento: I101.sumarDias(hoy, 33), instrucciones: ajustes.instrucciones };
    const raiz = pinta(`
      <p class="migas"><a href="${ronda ? `#/ronda/${h(id)}` : '#/rondas'}">← ${ronda ? h(ronda.nombre) : 'Rondas'}</a></p>
      <div class="cab"><div class="t"><h1>${ronda ? 'Editar la ronda' : 'Nueva ronda'}</h1></div></div>
      <form class="tarjeta form" id="f-ronda" novalidate>
        <label class="campo"><span>Nombre</span><input name="nombre" value="${h(v.nombre || '')}" maxlength="120" placeholder="Puente de octubre"></label>
        <label class="campo"><span>Para qué es <small>(lo lee quien invierte)</small></span><textarea name="descripcion" maxlength="2000" placeholder="Tres semanas de nómina y materiales mientras se cobra la obra…">${h(v.descripcion || '')}</textarea></label>
        <div class="fila tres">
          <label class="campo"><span>Cuánto se quiere juntar</span><div class="con-signo"><i>$</i><input name="meta" inputmode="decimal" autocomplete="off" value="${h(I101.enPesos(v.monto_meta))}" placeholder="90,000"></div></label>
          <label class="campo"><span>Mínimo para entrar <small>(opcional)</small></span><div class="con-signo"><i>$</i><input name="minimo" inputmode="decimal" autocomplete="off" value="${h(I101.enPesos(v.monto_minimo))}"></div></label>
          <label class="campo"><span>Se puede entrar hasta <small>(opcional)</small></span><input type="date" name="fecha_limite" value="${h(v.fecha_limite || '')}"></label>
        </div>
        <h2>Lo que se ofrece</h2>
        <p class="nota" style="margin-top:-6px">Es la oferta de la ronda. Al aceptar a cada quien puedes darle condiciones distintas.</p>
        ${I101.formCondiciones(v, { sinMonto: true })}
        <label class="campo"><span>A dónde depositar <small>(se le enseña a quien se le acepta la oferta)</small></span><textarea name="instrucciones" maxlength="2000" placeholder="Banco · CLABE · A nombre de…">${h(v.instrucciones || '')}</textarea></label>
        <p class="err" id="err-ronda"></p>
        <div class="pie-form"><a class="b" href="${ronda ? `#/ronda/${h(id)}` : '#/rondas'}">Cancelar</a><button class="b pri" id="b-guardar-ronda">${ronda ? 'Guardar' : 'Guardar borrador'}</button></div>
      </form>`);
    I101.enlazarCondiciones(raiz, { monto: () => 1000000, ejemplo: 'por cada $10,000' });
    q(raiz, '#f-ronda').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const meta = I101.aCentavos(valor(raiz, 'meta'));
      const minimo = valor(raiz, 'minimo') ? I101.aCentavos(valor(raiz, 'minimo')) : null;
      const err = q(raiz, '#err-ronda');
      if (valor(raiz, 'minimo') && minimo === null) { err.textContent = 'El mínimo no se entiende como una cantidad.'; return; }
      const cuerpo = {
        nombre: valor(raiz, 'nombre'), descripcion: valor(raiz, 'descripcion'), monto_meta: meta ?? 0, monto_minimo: minimo,
        fecha_limite: valor(raiz, 'fecha_limite') || null, instrucciones: valor(raiz, 'instrucciones'), ...I101.leerCondiciones(raiz),
      };
      const r = await I101.hacer(q(raiz, '#b-guardar-ronda'), () => (ronda ? I101.inv(`/rondas/${id}`, { metodo: 'PATCH', cuerpo }) : I101.inv('/rondas', { cuerpo })), err);
      if (r) { I101.avisa('Ronda guardada.'); I101.ir(`#/ronda/${r.id}`); }
    });
  };

  A.ronda = async (id, sub) => {
    if (sub === 'editar') return A.rondaForm(id);
    const r = await I101.inv(`/rondas/${id}`);
    const a = r.avance;
    const acc = [];
    if (r.estado === 'borrador') acc.push(`<a class="b" href="#/ronda/${h(id)}/editar">Editar</a>`, '<button class="b acc" data-hacer="abrir">Abrir la ronda</button>', '<button class="b mal" data-hacer="borrar">Borrar</button>');
    if (r.estado === 'abierta') acc.push('<button class="b acc" data-abrir-panel="avisar">Avisar</button>', `<a class="b" href="#/ronda/${h(id)}/editar">Editar</a>`, '<button class="b" data-hacer="cerrar">Cerrar</button>', '<button class="b mal" data-hacer="cancelar">Cancelar</button>');
    if (r.estado === 'cerrada') acc.push('<button class="b" data-hacer="reabrir">Reabrir</button>');
    const origen = r.origen?.app === 'dash101'
      ? `<p class="aviso azul">Nació del flujo proyectado de dash101${r.origen.deficit ? `: faltaban ${pesos(r.origen.deficit)}` : ''}${r.origen.desde ? ` entre el ${dia(r.origen.desde)} y el ${dia(r.origen.hasta)}` : ''}.</p>` : '';

    const filaOferta = (o) => {
      const pend = o.estado === 'pendiente';
      const monto = o.estado === 'aprobada' && o.monto_aprobado !== o.monto ? `${pesos(o.monto_aprobado)}<span>ofreció ${pesos(o.monto)}</span>` : pesos(o.monto);
      return `<li data-oferta="${h(o.id)}"><div class="ren">
        <div class="p"><b>${h(o.inversionista_nombre)} ${I101.etiqueta(I101.ESTADO_OFERTA, o.estado)}</b><span>${h(I101.momento(o.creado_at))}${o.nota ? ` · «${h(o.nota)}»` : ''}${o.motivo ? ` · ${h(o.motivo)}` : ''}</span>
          <span data-riesgos="${o.riesgos_aceptados_at ? 'si' : 'no'}">${o.riesgos_aceptados_at ? `Aceptó los riesgos · ${h(I101.momento(o.riesgos_aceptados_at))}` : 'La capturaste tú: no aceptó los riesgos en pantalla (van en el pagaré)'}</span></div>
        <div class="m"><b>${monto}</b></div>
        ${pend ? '<div class="acc"><button class="b chico pri" data-oferta-hacer="aprobar">Aceptar</button><button class="b chico" data-oferta-hacer="rechazar">Rechazar</button></div>' : o.prestamo_id ? `<div class="acc"><a class="b chico" href="#/prestamo/${h(o.prestamo_id)}">Préstamo</a></div>` : ''}
        </div><div data-panel-oferta></div></li>`;
    };

    const raiz = pinta(`
      <p class="migas"><a href="#/rondas">← Rondas</a></p>
      <div class="cab"><div class="t"><span class="folio">${h(r.folio)}</span><h1>${h(r.nombre)} ${I101.etiqueta(I101.ESTADO_RONDA, r.estado)}</h1>${r.descripcion ? `<p class="sub">${h(r.descripcion)}</p>` : ''}</div>
        <div class="acc">${acc.join('')}</div></div>
      ${origen}
      ${r.estado === 'borrador' ? '<p class="aviso ojo">Es un borrador: nadie de afuera lo ve. Revisa las condiciones y ábrela para poder avisar.</p>' : ''}
      <p class="err" id="err-accion"></p>
      <div id="panel-avisar"></div>
      <section class="tarjeta"><h2>Avance <span class="der">${a.porcentaje} %</span></h2>
        <div class="avance"><i style="width:${a.porcentaje}%"></i></div>
        <div class="avance-pie"><span><b>${pesos(a.juntado)}</b> aceptado de ${pesos(r.monto_meta)}</span><span>Faltan <b>${pesos(a.falta)}</b></span></div>
        <dl class="datos" style="margin-top:12px">
          <div><dt>Ya recibido en la cuenta</dt><dd>${pesos(a.recibido)}</dd></div>
          <div><dt>Ofertas por revisar</dt><dd>${a.ofertas_pendientes} · ${pesos(a.por_aprobar)}</dd></div>
        </dl></section>
      <section class="tarjeta"><h2>Lo que se ofrece</h2>
        ${I101.datosCondiciones(r, `
          <div><dt>El dinero se necesita el</dt><dd>${h(dia(r.fecha_inicio))}</dd></div>
          <div><dt>Mínimo para entrar</dt><dd>${r.monto_minimo ? pesos(r.monto_minimo) : 'Sin mínimo'}</dd></div>
          <div><dt>Se puede entrar hasta</dt><dd>${r.fecha_limite ? h(dia(r.fecha_limite)) : 'Sin fecha límite'}</dd></div>
          ${r.ejemplo ? `<div><dt>Por cada $10,000 regresan</dt><dd>${pesos(r.ejemplo.totales.total)}</dd></div>` : ''}`)}
        ${r.instrucciones ? `<p class="nota">A dónde depositar:</p><p class="pre">${h(r.instrucciones)}</p>` : '<p class="nota">Falta decir a dónde depositar (Editar).</p>'}
      </section>
      <section class="tarjeta"><h2>Ofertas ${r.estado === 'abierta' ? '<button class="b chico der" data-abrir-panel="capturar">Capturar una oferta</button>' : ''}</h2>
        <div id="panel-capturar"></div>
        ${r.ofertas.length ? `<ul class="lista">${r.ofertas.map(filaOferta).join('')}</ul>` : `<p class="vacio">${r.estado === 'borrador' ? 'Las ofertas llegan cuando la ronda esté abierta.' : 'Todavía nadie ha dicho que le entra.'}</p>`}</section>
      <section class="tarjeta"><h2>Préstamos de esta ronda</h2>
        ${r.prestamos.length ? `<ul class="lista">${r.prestamos.map(renglonPrestamo).join('')}</ul>` : '<p class="vacio">Cada oferta aceptada se vuelve un préstamo.</p>'}</section>`);

    const err = q(raiz, '#err-accion');
    const PREGUNTA = { abrir: null, cerrar: '¿Cerrar la ronda? Ya no entrarán ofertas nuevas; lo aceptado sigue igual.', cancelar: '¿Cancelar la ronda? Las ofertas por revisar se rechazan. Los préstamos ya aceptados no se tocan.', borrar: '¿Borrar este borrador?', reabrir: null };
    raiz.querySelectorAll('[data-hacer]').forEach((b) => b.addEventListener('click', async () => {
      const que = b.dataset.hacer;
      if (PREGUNTA[que] && !confirm(PREGUNTA[que])) return;
      const hecho = await I101.hacer(b, () => (que === 'borrar' ? I101.inv(`/rondas/${id}`, { metodo: 'DELETE' }) : I101.inv(`/rondas/${id}/${que}`, { metodo: 'POST' })), err);
      if (!hecho) return;
      if (que === 'borrar') return I101.ir('#/rondas');
      if (que === 'abrir') { I101.avisa('Ronda abierta. Ahora avisa a tu gente.'); await A.ronda(id); return document.querySelector('[data-abrir-panel="avisar"]')?.click(); }
      A.ronda(id);
    }));

    /* — avisar — */
    q(raiz, '[data-abrir-panel="avisar"]')?.addEventListener('click', async (ev) => {
      const caja = q(raiz, '#panel-avisar');
      if (caja.innerHTML) { caja.innerHTML = ''; return; }
      const lista = await I101.hacer(ev.currentTarget, () => I101.inv(`/rondas/${id}/aviso`), err);
      if (!lista) return;
      const filas = lista.filas;
      caja.innerHTML = `<section class="tarjeta azul"><h2>Avisar de la ronda</h2>
        ${filas.length ? `<p class="nota" style="margin:-4px 0 10px">El correo sale a quien marques. WhatsApp lo mandas tú: el botón abre el mensaje ya escrito.</p>
        <ul class="lista">${filas.map((f) => `<li><div class="ren">
          <input type="checkbox" data-avisar="${h(f.id)}" ${f.correo && f.recibe_avisos && !f.ya_ofrecio ? 'checked' : ''} ${f.correo ? '' : 'disabled'} aria-label="Correo a ${h(f.nombre)}">
          <div class="p"><b>${h(f.nombre)} ${f.es_prospecto ? '<span class="et">Prospecto</span>' : ''}${f.ya_ofrecio ? ' <span class="et bien">Ya ofreció</span>' : ''}</b><span data-resultado>${f.correo ? h(f.correo) : 'Sin correo'}</span></div>
          <div class="acc">${f.whatsapp ? `<a class="b chico wa" href="${h(f.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}</div></div></li>`).join('')}</ul>
        <p class="err" id="err-avisar"></p>
        <div class="pie-form"><button class="b" data-copiar>Copiar el mensaje</button><button class="b pri" id="b-enviar-aviso">Enviar correo</button></div>`
    : '<p class="vacio">El directorio está vacío. Da de alta a tu gente en «Inversionistas».</p>'}</section>`;
      q(caja, '[data-copiar]')?.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(filas[0].mensaje.replace(/^Hola, [^.]+\. /, 'Hola. ')); I101.avisa('Mensaje copiado.'); } catch { I101.avisa('El navegador no dejó copiar.', true); }
      });
      q(caja, '#b-enviar-aviso')?.addEventListener('click', async (e2) => {
        const escogidos = [...caja.querySelectorAll('[data-avisar]:checked')].map((c) => c.dataset.avisar);
        if (!escogidos.length) { q(caja, '#err-avisar').textContent = 'Marca al menos a una persona.'; return; }
        const res = await I101.hacer(e2.currentTarget, () => I101.inv(`/rondas/${id}/avisar`, { cuerpo: { a: escogidos } }), q(caja, '#err-avisar'));
        if (!res) return;
        for (const f of res.filas) {
          const donde = caja.querySelector(`[data-avisar="${CSS.escape(f.id)}"]`)?.closest('.ren')?.querySelector('[data-resultado]');
          if (donde) donde.innerHTML = f.correo_enviado.enviado ? '<span style="color:var(--bien);font-weight:600">Correo enviado</span>' : `No salió: ${h(MOTIVO[f.correo_enviado.motivo] || f.correo_enviado.motivo)}`;
        }
        I101.avisa(res.enviados ? `${res.enviados} correo${res.enviados > 1 ? 's' : ''} enviado${res.enviados > 1 ? 's' : ''}.` : 'No salió ningún correo.', !res.enviados);
      });
    });

    /* — capturar la oferta de alguien que avisó por otro lado — */
    q(raiz, '[data-abrir-panel="capturar"]')?.addEventListener('click', async (ev) => {
      const caja = q(raiz, '#panel-capturar');
      if (caja.innerHTML) { caja.innerHTML = ''; return; }
      const dir = await I101.hacer(ev.currentTarget, () => I101.inv('/inversionistas'), err);
      if (!dir) return;
      const activos = dir.filas.filter((f) => f.activo);
      caja.innerHTML = `<form class="panel form"><h3>Capturar una oferta</h3>
        <div class="fila dos">
          <label class="campo"><span>De quién</span><select name="inversionista_id"><option value="">Escoge…</option>${activos.map((f) => `<option value="${h(f.id)}">${h(f.nombre)}</option>`).join('')}</select></label>
          <label class="campo"><span>Con cuánto</span><div class="con-signo"><i>$</i><input name="monto" inputmode="decimal" autocomplete="off"></div></label>
        </div><p class="err"></p>
        <div class="pie-form"><a class="b chico" href="#/inversionistas">Dar de alta a alguien</a><button class="b pri">Guardar la oferta</button></div></form>`;
      q(caja, 'form').addEventListener('submit', async (e2) => {
        e2.preventDefault();
        const cuerpo = { inversionista_id: valor(caja, 'inversionista_id'), monto: I101.aCentavos(valor(caja, 'monto')) ?? 0 };
        const res = await I101.hacer(q(caja, 'button.pri'), () => I101.inv(`/rondas/${id}/ofertas`, { cuerpo }), q(caja, '.err'));
        if (res) A.ronda(id);
      });
    });

    /* — aceptar o rechazar una oferta — */
    raiz.querySelectorAll('[data-oferta-hacer]').forEach((b) => b.addEventListener('click', () => {
      const li = b.closest('[data-oferta]');
      const oferta = r.ofertas.find((o) => o.id === li.dataset.oferta);
      const caja = q(li, '[data-panel-oferta]');
      const que = b.dataset.ofertaHacer;
      if (caja.dataset.abierto === que) { caja.innerHTML = ''; caja.dataset.abierto = ''; return; }
      caja.dataset.abierto = que;
      if (que === 'rechazar') {
        caja.innerHTML = `<form class="panel form"><h3>Rechazar la oferta de ${h(oferta.inversionista_nombre)}</h3>
          <label class="campo"><span>Motivo <small>(se le manda por correo)</small></span><textarea name="motivo" maxlength="500" placeholder="Ya se juntó lo que hacía falta."></textarea></label>
          <p class="err"></p><div class="pie-form"><button class="b mal">Rechazar</button></div></form>`;
        q(caja, 'form').addEventListener('submit', async (e2) => {
          e2.preventDefault();
          const res = await I101.hacer(q(caja, 'button'), () => I101.inv(`/ofertas/${oferta.id}/rechazar`, { cuerpo: { motivo: valor(caja, 'motivo') } }), q(caja, '.err'));
          if (res) A.ronda(id);
        });
        return;
      }
      caja.innerHTML = `<form class="panel form"><h3>Aceptar a ${h(oferta.inversionista_nombre)}</h3>
        <label class="campo"><span>Monto que se le acepta</span><div class="con-signo"><i>$</i><input name="monto_aprobado" inputmode="decimal" autocomplete="off" value="${h(I101.enPesos(oferta.monto))}"></div>
          <small>Ofreció ${pesos(oferta.monto)}. Faltan ${pesos(a.falta)} para la meta.</small></label>
        <label class="marca-fila"><input type="checkbox" name="otras"> Darle condiciones distintas a las de la ronda</label>
        ${I101.formCondiciones(r, { sinMonto: true })}
        <p class="err"></p>
        <div class="pie-form"><button class="b pri">Aceptar y crear el préstamo</button></div></form>`;
      const entradaMonto = q(caja, '[name="monto_aprobado"]');
      const otras = q(caja, '[name="otras"]');
      const montoActual = () => I101.aCentavos(entradaMonto.value) || 0;
      I101.enlazarCondiciones(caja, { monto: montoActual, vigilar: [entradaMonto] });
      // Los campos se esconden; la tabla que resulta se queda a la vista.
      const campos = q(caja, '[data-campos]');
      campos.hidden = true;
      otras.addEventListener('change', () => { campos.hidden = !otras.checked; });
      q(caja, 'form').addEventListener('submit', async (e2) => {
        e2.preventDefault();
        const cuerpo = { monto_aprobado: I101.aCentavos(entradaMonto.value) ?? 0 };
        if (otras.checked) cuerpo.condiciones = I101.leerCondiciones(caja);
        const res = await I101.hacer(q(caja, 'button.pri'), () => I101.inv(`/ofertas/${oferta.id}/aprobar`, { cuerpo }), q(caja, '.err'));
        if (res) { I101.avisa(`Aceptada. Nació el préstamo ${res.prestamo.folio}.`); A.ronda(id); }
      });
    }));
  };

  const MOTIVO = { sin_correo: 'no tiene correo', correo_apagado_fuera_de_produccion: 'en este entorno de pruebas el correo no sale', correo_no_configurado: 'el correo no está configurado', correo_no_salio: 'el servicio de correo falló' };

  /* ═══════════════ préstamos ═══════════════ */

  const renglonPrestamo = (p) => {
    const s = p.resumen;
    const pie = p.estado === 'activo' && s.proximo ? `Próximo: ${pesos(s.proximo.total)} el ${dia(s.proximo.fecha)}` : p.estado === 'por_depositar' ? 'Esperando el depósito' : p.estado === 'liquidado' ? `Pagó ${pesos(s.interes_pagado)} de interés` : '';
    return `<li><a class="ren" href="#/prestamo/${h(p.id)}">
      <div class="p"><b>${h(p.inversionista_nombre || p.inversionista?.nombre || '')} ${I101.etiqueta(I101.ESTADO_PRESTAMO, p.estado)}${s.vencidos ? ` <span class="et mal">${s.vencidos} vencido${s.vencidos > 1 ? 's' : ''}</span>` : ''}</b>
        <span>${h(p.folio)} · ${h(I101.tasa(p.tipo_tasa, p.tasa_pb))} · ${h(pie)}</span></div>
      <div class="m"><b>${pesosCorto(p.estado === 'activo' ? s.capital_pendiente : p.monto)}</b><span>${p.estado === 'activo' ? `de ${pesosCorto(p.monto)}` : ''}</span></div></a></li>`;
  };

  A.prestamos = async () => {
    const { filas } = await I101.inv('/prestamos');
    const grupos = [['por_depositar', 'Esperando depósito'], ['activo', 'Activos'], ['liquidado', 'Liquidados'], ['cancelado', 'Cancelados']];
    pinta(`
      <div class="cab"><div class="t"><h1>Préstamos</h1><p class="sub">Cada oferta aceptada es un préstamo con su propia tabla de pagos.</p></div>
        <div class="acc"><a class="b" href="#/prestamo/nuevo">Préstamo directo</a></div></div>
      ${filas.length ? grupos.map(([estado, titulo]) => {
    const suyos = filas.filter((p) => p.estado === estado);
    return suyos.length ? `<section class="tarjeta"><h2>${titulo} <span class="der">${suyos.length}</span></h2><ul class="lista">${suyos.map(renglonPrestamo).join('')}</ul></section>` : '';
  }).join('') : '<section class="tarjeta"><p class="vacio">Todavía no hay préstamos. Nacen al aceptar una oferta de una ronda, o como «Préstamo directo».</p></section>'}`);
  };

  /** Un préstamo sin ronda: alguien presta y ya. */
  A.prestamoNuevo = async () => {
    const [dir, ajustes] = await Promise.all([I101.inv('/inversionistas'), I101.inv('/ajustes')]);
    const hoy = I101.sesion.hoy;
    const previo = new URLSearchParams(location.hash.split('?')[1] || '').get('de') || '';
    const raiz = pinta(`
      <p class="migas"><a href="#/prestamos">← Préstamos</a></p>
      <div class="cab"><div class="t"><h1>Préstamo directo</h1><p class="sub">Sin ronda: alguien presta, se acuerda cómo se paga, y listo.</p></div></div>
      <form class="tarjeta form" id="f-prestamo" novalidate>
        <label class="campo"><span>Quién presta</span><select name="inversionista_id"><option value="">Escoge…</option>${dir.filas.filter((f) => f.activo).map((f) => `<option value="${h(f.id)}"${f.id === previo ? ' selected' : ''}>${h(f.nombre)}</option>`).join('')}</select>
          <small>¿No está? <a href="#/inversionistas">Dalo de alta</a> primero.</small></label>
        ${I101.formCondiciones({ tipo_tasa: 'mensual', esquema: 'parcialidades', frecuencia: 'mensual', fecha_inicio: hoy })}
        <label class="campo"><span>A dónde deposita</span><textarea name="instrucciones" maxlength="2000">${h(ajustes.instrucciones || '')}</textarea></label>
        <label class="campo"><span>Notas internas <small>(quien presta no las ve)</small></span><textarea name="notas" maxlength="2000"></textarea></label>
        <p class="err" id="err-prestamo"></p>
        <div class="pie-form"><a class="b" href="#/prestamos">Cancelar</a><button class="b pri" id="b-crear-prestamo">Crear el préstamo</button></div>
      </form>`);
    I101.enlazarCondiciones(raiz);
    q(raiz, '#f-prestamo').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const cuerpo = { inversionista_id: valor(raiz, 'inversionista_id'), instrucciones: valor(raiz, 'instrucciones'), notas: valor(raiz, 'notas'), ...I101.leerCondiciones(raiz) };
      cuerpo.monto = cuerpo.monto ?? 0;
      const r = await I101.hacer(q(raiz, '#b-crear-prestamo'), () => I101.inv('/prestamos', { cuerpo }), q(raiz, '#err-prestamo'));
      if (r) { I101.avisa(`Préstamo ${r.folio} creado.`); I101.ir(`#/prestamo/${r.id}`); }
    });
  };

  A.prestamo = async (id) => {
    const p = await I101.inv(`/prestamos/${id}`);
    const hoy = I101.sesion.hoy;
    const s = p.resumen;
    const inv = p.inversionista;
    const porDepositar = p.estado === 'por_depositar';
    const vivo = porDepositar || p.estado === 'activo';
    const comprobante = (p.archivos || []).find((a) => a.clase === 'comprobante_deposito');

    const raiz = pinta(`
      <p class="migas"><a href="#/prestamos">← Préstamos</a>${p.ronda ? ` · <a href="#/ronda/${h(p.ronda.id)}">${h(p.ronda.nombre)}</a>` : ''}</p>
      <div class="cab"><div class="t"><span class="folio">${h(p.folio)}</span><h1>${pesosCorto(p.monto)} · <a href="#/inversionista/${h(inv.id)}">${h(inv.nombre)}</a> ${I101.etiqueta(I101.ESTADO_PRESTAMO, p.estado)}</h1>
        <p class="sub">${h(I101.tasa(p.tipo_tasa, p.tasa_pb))} · ${h(I101.comoSePaga({ ...p, num_pagos: s.pagos_total }))}${p.tabla_editada ? ' · <span class="et ojo">Tabla editada a mano</span>' : ''}</p></div>
        <div class="acc"><button class="b" data-pagare>Pagaré en PDF</button></div></div>
      <p class="err" id="err-accion"></p>

      ${porDepositar ? `<section class="tarjeta realce"><h2>Esperando el depósito</h2>
        <p style="margin:0 0 10px">${comprobante ? `${h(inv.nombre)} ya subió su comprobante: <a href="${h(I101.ligaArchivo(comprobante.id))}" target="_blank" rel="noopener">verlo</a>. Revisa que el dinero esté en la cuenta y márcalo.` : 'Cuando el dinero esté en la cuenta, márcalo recibido: ese día arranca el préstamo y sus intereses, y entra el ingreso a dash101.'}</p>
        <div class="acc" style="display:flex;gap:8px;flex-wrap:wrap"><button class="b acc" data-panel="recibido">Marcar recibido</button><button class="b" data-panel="condiciones">Cambiar condiciones</button><button class="b mal" data-panel="cancelar">Cancelar el préstamo</button></div>
        <div id="panel"></div></section>` : ''}

      ${p.estado !== 'cancelado' ? `<div class="cifras">
        <div class="cifra principal"><div class="e">Capital que se debe</div><div class="v">${pesosCorto(s.capital_pendiente)}</div><div class="d">de ${pesosCorto(p.monto)}</div></div>
        <div class="cifra"><div class="e">Interés por pagar</div><div class="v">${pesosCorto(s.interes_pendiente)}</div><div class="d">de ${pesosCorto(s.interes_total)}</div></div>
        <div class="cifra"><div class="e">Ya pagado</div><div class="v">${pesosCorto(s.capital_pagado + s.interes_pagado)}</div><div class="d">${s.pagos_hechos} de ${s.pagos_total} pagos</div></div>
        <div class="cifra${s.vencidos ? ' ojo' : ''}"><div class="e">Próximo pago</div><div class="v">${s.proximo ? pesosCorto(s.proximo.total) : '—'}</div><div class="d">${s.proximo ? `${h(dia(s.proximo.fecha))}${p.estado === 'activo' ? ` · ${h(I101.falta(s.proximo.fecha, hoy))}` : ''}` : ''}</div></div>
      </div>` : ''}

      <section class="tarjeta"><h2>Tabla de pagos ${vivo ? '<button class="b chico der" data-editar-tabla>Editar la tabla</button>' : ''}</h2>
        <div id="editor-tabla"></div>
        <div id="tabla">${I101.tablaDePagos(p, { hoy, accion: (g) => (g.estado === 'pagado' ? I101.botonSubir('+ Comprobante', { prestamo_id: p.id, pago_id: g.id, clase: 'comprobante_pago' }, 'b chico') : '') })}</div>
        ${p.estado === 'activo' ? `<p class="nota">Los pagos se registran en dash101, donde sale el dinero: <a href="${h(I101.urlDash('/inversion'))}">abrir dash101</a>. Aquí se refleja solo.</p>` : ''}
        ${porDepositar ? '<p class="nota">Las fechas son estimadas: se ajustan solas al día en que marques el depósito recibido.</p>' : ''}
      </section>

      <div class="dos-col">
        <section class="tarjeta"><h2>Papeles</h2>
          ${I101.listaDePapeles(p, { puedeQuitar: () => true })}
          <div class="pie-form" style="justify-content:flex-start;margin-top:12px">
            ${I101.botonSubir('Subir pagaré firmado', { prestamo_id: p.id, clase: 'contrato_firmado' })}
            ${I101.botonSubir('Subir comprobante del depósito', { prestamo_id: p.id, clase: 'comprobante_deposito' })}
          </div>
          <p class="nota">El pagaré en PDF es un texto base: que lo revise tu abogado antes de usarlo. Se firma a mano y se sube aquí.</p>
        </section>
        <section class="tarjeta"><h2>Para pagarle</h2>
          <dl class="datos" style="grid-template-columns:1fr">
            <div><dt>Banco</dt><dd>${h(inv.banco || '—')}</dd></div>
            <div><dt>CLABE</dt><dd>${h(inv.clabe ? inv.clabe.replace(/^(\d{3})(\d{3})(\d{11})(\d)$/, '$1 $2 $3 $4') : '—')}${inv.clabe ? ' <button class="liga" data-copiar-clabe>Copiar</button>' : ''}</dd></div>
            <div><dt>A nombre de</dt><dd>${h(inv.beneficiario || inv.nombre)}</dd></div>
            <div><dt>Contacto</dt><dd>${h([inv.correo, inv.telefono].filter(Boolean).join(' · ') || '—')}</dd></div>
          </dl>
          <p class="nota"><a href="#/inversionista/${h(inv.id)}">Editar sus datos</a></p>
        </section>
      </div>

      <section class="tarjeta"><h2>Notas internas</h2>
        <form class="form" id="f-notas"><textarea name="notas" maxlength="2000" placeholder="Sólo las ve quien dirige.">${h(p.notas || '')}</textarea>
        <div class="pie-form"><button class="b chico">Guardar notas</button></div></form></section>
      <section class="tarjeta"><h2>Historia</h2>${I101.bitacora(p.eventos, true)}</section>`);

    const err = q(raiz, '#err-accion');
    const otraVez = () => A.prestamo(id);
    I101.enlazarSubidas(raiz, otraVez);
    I101.enlazarQuitarArchivos(raiz, otraVez);
    q(raiz, '[data-pagare]').addEventListener('click', (ev) => I101.hacer(ev.currentTarget, () => I101.descargarPagare(p), err));
    q(raiz, '[data-copiar-clabe]')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(inv.clabe); I101.avisa('CLABE copiada.'); } catch { I101.avisa('El navegador no dejó copiar.', true); } });
    q(raiz, '#f-notas').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const r = await I101.hacer(q(raiz, '#f-notas button'), () => I101.inv(`/prestamos/${id}`, { metodo: 'PATCH', cuerpo: { notas: valor(raiz, 'notas') } }));
      if (r) I101.avisa('Notas guardadas.');
    });

    /* — los tres paneles de «por depositar» — */
    raiz.querySelectorAll('[data-panel]').forEach((b) => b.addEventListener('click', async () => {
      const caja = q(raiz, '#panel');
      const que = b.dataset.panel;
      if (caja.dataset.abierto === que) { caja.innerHTML = ''; caja.dataset.abierto = ''; return; }
      caja.dataset.abierto = que;
      if (que === 'recibido') {
        const cuentas = await I101.hacer(b, () => I101.api(`/orgs/${encodeURIComponent(I101.org)}/cuentas`), err);
        if (!cuentas) return;
        caja.innerHTML = `<form class="panel form"><h3>El depósito de ${pesos(p.monto)} llegó</h3>
          ${cuentas.filas.length ? `<div class="fila dos">
            <label class="campo"><span>A qué cuenta</span><select name="cuenta_id">${cuentas.filas.length > 1 ? '<option value="">Escoge…</option>' : ''}${cuentas.filas.map((c) => `<option value="${h(c.id)}">${h(c.nombre)}</option>`).join('')}</select></label>
            <label class="campo"><span>Qué día</span><input type="date" name="fecha" value="${h(hoy)}" max="${h(hoy)}"></label>
          </div>
          <p class="nota">Con esto nace el ingreso en dash101, el interés empieza a correr ese día y la tabla se rehace con la fecha de verdad.</p>
          <p class="err"></p><div class="pie-form"><button class="b acc">Confirmar que llegó</button></div>` : `<p class="aviso ojo">La empresa no tiene cuentas dadas de alta. Créala en <a href="${h(I101.urlDash('/cuentas'))}">dash101</a> y vuelve.</p>`}</form>`;
        q(caja, 'form').addEventListener('submit', async (ev) => {
          ev.preventDefault();
          const r = await I101.hacer(q(caja, 'button'), () => I101.inv(`/prestamos/${id}/recibido`, { cuerpo: { cuenta_id: valor(caja, 'cuenta_id'), fecha: valor(caja, 'fecha') } }), q(caja, '.err'));
          if (r) { I101.avisa('Depósito recibido. El préstamo ya arrancó.'); otraVez(); }
        });
      } else if (que === 'condiciones') {
        caja.innerHTML = `<form class="panel form"><h3>Cambiar lo acordado</h3>${I101.formCondiciones(p)}<p class="err"></p><div class="pie-form"><button class="b pri">Guardar y rehacer la tabla</button></div></form>`;
        I101.enlazarCondiciones(caja);
        q(caja, 'form').addEventListener('submit', async (ev) => {
          ev.preventDefault();
          const cuerpo = I101.leerCondiciones(caja);
          cuerpo.monto = cuerpo.monto ?? 0;
          const r = await I101.hacer(q(caja, 'button'), () => I101.inv(`/prestamos/${id}`, { metodo: 'PATCH', cuerpo }), q(caja, '.err'));
          if (r) { I101.avisa('Condiciones guardadas.'); otraVez(); }
        });
      } else {
        caja.innerHTML = `<form class="panel form"><h3>Cancelar el préstamo</h3>
          <label class="campo"><span>Por qué</span><textarea name="motivo" maxlength="500"></textarea></label>
          <p class="err"></p><div class="pie-form"><button class="b mal">Cancelar el préstamo</button></div></form>`;
        q(caja, 'form').addEventListener('submit', async (ev) => {
          ev.preventDefault();
          const r = await I101.hacer(q(caja, 'button'), () => I101.inv(`/prestamos/${id}/cancelar`, { cuerpo: { motivo: valor(caja, 'motivo') } }), q(caja, '.err'));
          if (r) otraVez();
        });
      }
    }));

    /* — editar la tabla a mano — */
    q(raiz, '[data-editar-tabla]')?.addEventListener('click', () => {
      const caja = q(raiz, '#editor-tabla');
      if (caja.innerHTML) { caja.innerHTML = ''; q(raiz, '#tabla').hidden = false; return; }
      q(raiz, '#tabla').hidden = true;
      const pendientes = p.pagos.filter((g) => g.estado === 'pendiente');
      const debe = s.capital_pendiente;
      const filaEd = (g = {}) => `<tr>
        <td><input type="date" name="fecha" value="${h(g.fecha || '')}" aria-label="Fecha"></td>
        <td><input name="capital" inputmode="decimal" value="${h(I101.enPesos(g.capital ?? ''))}" aria-label="Capital" style="min-width:104px"></td>
        <td><input name="interes" inputmode="decimal" value="${h(I101.enPesos(g.interes ?? ''))}" aria-label="Interés" style="min-width:104px"></td>
        <td><button type="button" class="b chico mal" data-quitar-fila aria-label="Quitar este pago">×</button></td></tr>`;
      caja.innerHTML = `<form class="panel form"><h3>Editar lo que falta por pagar</h3>
        <p class="nota" style="margin:-4px 0 4px">Lo ya pagado no se toca. El capital tiene que seguir sumando <b>${pesos(debe)}</b>; el interés lo decides tú. ${h(inv.nombre)} verá la tabla nueva, el motivo y cómo estaba antes.</p>
        <div class="tabla-caja"><table><thead><tr><th>Fecha</th><th>Capital</th><th>Interés</th><th></th></tr></thead><tbody>${pendientes.map(filaEd).join('')}</tbody></table></div>
        <p class="nota" data-suma></p>
        <div><button type="button" class="b chico" data-otra-fila>+ Agregar un pago</button></div>
        <label class="campo"><span>Motivo del cambio</span><textarea name="motivo" maxlength="500" placeholder="Se recorrió el cobro de la obra dos semanas."></textarea></label>
        <p class="err"></p><div class="pie-form"><button type="button" class="b" data-cerrar-editor>Cancelar</button><button class="b pri">Guardar la tabla nueva</button></div></form>`;
      const cuerpoT = q(caja, 'tbody');
      const leer = () => [...cuerpoT.querySelectorAll('tr')].map((tr) => ({
        fecha: tr.querySelector('[name=fecha]').value, capital: I101.aCentavos(tr.querySelector('[name=capital]').value || '0'), interes: I101.aCentavos(tr.querySelector('[name=interes]').value || '0'),
      }));
      const sumar = () => {
        const filas = leer();
        const cap = filas.reduce((t, f) => t + (f.capital || 0), 0), int = filas.reduce((t, f) => t + (f.interes || 0), 0);
        const dif = debe - cap;
        q(caja, '[data-suma]').innerHTML = `Capital: <b>${pesos(cap)}</b> ${dif === 0 ? '<span class="et bien">cuadra</span>' : `<span class="et mal">${dif > 0 ? `faltan ${pesos(dif)}` : `sobran ${pesos(-dif)}`}</span>`} · Interés: <b>${pesos(int)}</b> · Total: <b>${pesos(cap + int)}</b>`;
      };
      caja.addEventListener('input', sumar);
      caja.addEventListener('click', (ev) => {
        if (ev.target.closest('[data-quitar-fila]')) { ev.target.closest('tr').remove(); sumar(); }
        if (ev.target.closest('[data-otra-fila]')) { cuerpoT.insertAdjacentHTML('beforeend', filaEd()); sumar(); }
        if (ev.target.closest('[data-cerrar-editor]')) { caja.innerHTML = ''; q(raiz, '#tabla').hidden = false; }
      });
      sumar();
      q(caja, 'form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const filas = leer();
        if (filas.some((f) => f.capital === null || f.interes === null)) { q(caja, '.err').textContent = 'Hay una cantidad que no se entiende.'; return; }
        const r = await I101.hacer(q(caja, 'button.pri'), () => I101.inv(`/prestamos/${id}/tabla`, { metodo: 'PUT', cuerpo: { pagos: filas, motivo: valor(caja, 'motivo') } }), q(caja, '.err'));
        if (r) { I101.avisa('Tabla guardada.'); otraVez(); }
      });
    });
  };

  /* ═══════════════ el directorio ═══════════════ */

  const camposPersona = (v = {}) => `
    <div class="fila dos">
      <label class="campo"><span>Nombre</span><input name="nombre" value="${h(v.nombre || '')}" maxlength="120" autocomplete="off"></label>
      <label class="campo"><span>Correo <small>(con él entra y le llegan los avisos)</small></span><input name="correo" type="email" value="${h(v.correo || '')}" autocomplete="off" autocapitalize="off" inputmode="email"></label>
    </div>
    <div class="fila dos">
      <label class="campo"><span>Teléfono <small>(para WhatsApp)</small></span><input name="telefono" value="${h(v.telefono || '')}" inputmode="tel" autocomplete="off"></label>
      <label class="campo"><span>Banco</span><input name="banco" value="${h(v.banco || '')}" maxlength="120" autocomplete="off"></label>
    </div>
    <div class="fila dos">
      <label class="campo"><span>CLABE <small>(a dónde se le paga)</small></span><input name="clabe" value="${h(v.clabe || '')}" inputmode="numeric" autocomplete="off"></label>
      <label class="campo"><span>A nombre de</span><input name="beneficiario" value="${h(v.beneficiario || '')}" maxlength="120" autocomplete="off"></label>
    </div>
    <label class="campo"><span>Notas internas</span><textarea name="notas" maxlength="2000">${h(v.notas || '')}</textarea></label>
    <label class="marca-fila"><input type="checkbox" name="recibe_avisos" ${v.recibe_avisos === false ? '' : 'checked'}> Avisarle cuando se abra una ronda</label>`;
  const leerPersona = (raiz) => ({
    nombre: valor(raiz, 'nombre'), correo: valor(raiz, 'correo'), telefono: valor(raiz, 'telefono'), banco: valor(raiz, 'banco'),
    clabe: valor(raiz, 'clabe'), beneficiario: valor(raiz, 'beneficiario'), notas: valor(raiz, 'notas'), recibe_avisos: q(raiz, '[name="recibe_avisos"]').checked,
  });

  A.inversionistas = async () => {
    const { filas } = await I101.inv('/inversionistas');
    const fila = (f) => `<li><a class="ren" href="#/inversionista/${h(f.id)}">
      <div class="p"><b>${h(f.nombre)} ${f.activo ? (f.es_prospecto ? '<span class="et">Prospecto</span>' : '<span class="et bien">Inversionista</span>') : '<span class="et mal">Inactivo</span>'}</b>
        <span>${h([f.correo, f.telefono].filter(Boolean).join(' · ') || 'Sin contacto')}</span></div>
      <div class="m"><b>${f.capital_vigente ? pesosCorto(f.capital_vigente) : ''}</b><span>${f.prestamos ? `${f.prestamos} préstamo${f.prestamos > 1 ? 's' : ''}` : ''}</span></div></a></li>`;
    const raiz = pinta(`
      <div class="cab"><div class="t"><h1>Inversionistas</h1><p class="sub">Quien ya prestó y quien podría. A todos les llega el aviso de una ronda nueva.</p></div>
        <div class="acc"><button class="b" data-ver="varios">Pegar una lista</button><button class="b acc" data-ver="uno">Dar de alta</button></div></div>
      <div id="alta"></div>
      <section class="tarjeta">${filas.length ? `<ul class="lista">${filas.map(fila).join('')}</ul>` : '<p class="vacio">El directorio está vacío. Da de alta a la primera persona, o pega una lista de nombres, correos y teléfonos.</p>'}</section>`);
    const caja = q(raiz, '#alta');
    raiz.querySelectorAll('[data-ver]').forEach((b) => b.addEventListener('click', () => {
      const que = b.dataset.ver;
      if (caja.dataset.abierto === que) { caja.innerHTML = ''; caja.dataset.abierto = ''; return; }
      caja.dataset.abierto = que;
      if (que === 'uno') {
        caja.innerHTML = `<form class="tarjeta form"><h2>Dar de alta</h2>${camposPersona()}<p class="err"></p><div class="pie-form"><button class="b pri">Guardar</button></div></form>`;
        q(caja, '[name=nombre]').focus();
        q(caja, 'form').addEventListener('submit', async (ev) => {
          ev.preventDefault();
          const r = await I101.hacer(q(caja, 'button'), () => I101.inv('/inversionistas', { cuerpo: leerPersona(caja) }), q(caja, '.err'));
          if (r) { I101.avisa(`${r.nombre} quedó en el directorio.`); A.inversionistas(); }
        });
      } else {
        caja.innerHTML = `<form class="tarjeta form"><h2>Pegar una lista</h2>
          <label class="campo"><span>Una persona por renglón: nombre, correo, teléfono</span>
            <textarea name="lista" style="min-height:150px" placeholder="Ana Robles, ana@correo.com, 55 1234 5678&#10;Beto Cruz, beto@correo.com"></textarea>
            <small>Separados por coma o tabulador (se puede pegar directo de una hoja de cálculo). El correo y el teléfono son opcionales.</small></label>
          <p class="err"></p><div data-resultado></div><div class="pie-form"><button class="b pri">Dar de alta a todos</button></div></form>`;
        q(caja, 'form').addEventListener('submit', async (ev) => {
          ev.preventDefault();
          const renglones = valor(caja, 'lista').split('\n').map((l) => l.trim()).filter(Boolean);
          if (!renglones.length) { q(caja, '.err').textContent = 'Pega al menos un renglón.'; return; }
          const boton = q(caja, 'button');
          boton.disabled = true;
          const malos = [];
          let buenos = 0;
          for (const l of renglones) {
            // El nombre va primero. De lo demás, lo que parece teléfono es el
            // teléfono y lo otro se manda como correo: si no lo es, la API lo
            // dice, en vez de que aquí se tire un dato en silencio.
            const [nombre = '', ...resto] = l.split(/\t|,|;/).map((x) => x.trim()).filter(Boolean);
            const esTelefono = (x) => !/[a-záéíóúñ@]/i.test(x) && x.replace(/\D/g, '').length >= 7;
            const telefono = resto.find(esTelefono) || '';
            const correo = resto.find((x) => !esTelefono(x)) || '';
            try { await I101.inv('/inversionistas', { cuerpo: { nombre, correo, telefono } }); buenos += 1; } catch (e) { malos.push(`${l} → ${e.message}`); }
          }
          boton.disabled = false;
          if (!malos.length) { I101.avisa(`${buenos} persona${buenos === 1 ? '' : 's'} en el directorio.`); return A.inversionistas(); }
          q(caja, '[data-resultado]').innerHTML = `<p class="aviso ojo">Entraron ${buenos}. Estos ${malos.length} no:</p><p class="pre">${h(malos.join('\n'))}</p>`;
          q(caja, '[name=lista]').value = malos.map((m) => m.split(' → ')[0]).join('\n');
        });
      }
    }));
  };

  A.inversionista = async (id) => {
    const d = await I101.inv(`/inversionistas/${id}`);
    const f = d.inversionista, r = d.resumen;
    const raiz = pinta(`
      <p class="migas"><a href="#/inversionistas">← Inversionistas</a></p>
      <div class="cab"><div class="t"><h1>${h(f.nombre)} ${f.activo ? '' : '<span class="et mal">Inactivo</span>'}</h1><p class="sub">${h([f.correo, f.telefono].filter(Boolean).join(' · ') || 'Sin contacto')}</p></div>
        <div class="acc"><a class="b" href="#/prestamo/nuevo?de=${h(f.id)}">Préstamo directo</a></div></div>
      <div class="cifras">
        <div class="cifra principal"><div class="e">Tiene prestado</div><div class="v">${pesosCorto(r.invertido)}</div><div class="d">${r.prestamos_activos} activo${r.prestamos_activos === 1 ? '' : 's'}</div></div>
        <div class="cifra"><div class="e">Se le va a pagar</div><div class="v">${pesosCorto(r.por_recibir)}</div><div class="d">capital más interés</div></div>
        <div class="cifra"><div class="e">Interés ya pagado</div><div class="v">${pesosCorto(r.interes_ganado)}</div></div>
        <div class="cifra"><div class="e">Próximo pago</div><div class="v">${r.proximo ? pesosCorto(r.proximo.total) : '—'}</div><div class="d">${r.proximo ? h(dia(r.proximo.fecha)) : ''}</div></div>
      </div>
      <section class="tarjeta"><h2>Sus préstamos</h2>${d.prestamos.length ? `<ul class="lista">${d.prestamos.map((p) => renglonPrestamo({ ...p, inversionista_nombre: p.ronda_nombre || 'Préstamo directo' })).join('')}</ul>` : '<p class="vacio">Todavía no ha prestado: es prospecto.</p>'}</section>
      <form class="tarjeta form" id="f-persona"><h2>Sus datos</h2>${camposPersona(f)}
        <label class="marca-fila"><input type="checkbox" name="activo" ${f.activo ? 'checked' : ''}> Activo <small style="color:var(--tenue)">(si se apaga, ya no entra ni recibe avisos)</small></label>
        <p class="nota">${f.correo ? `Entra en esta misma dirección con ${h(f.correo)}. La primera vez escoge «No tengo contraseña o la olvidé» y le llega un código.` : 'Sin correo no puede entrar a ver su estado de cuenta.'}</p>
        <p class="err"></p><div class="pie-form"><button type="button" class="b mal" data-borrar>Borrar</button><button class="b pri">Guardar</button></div></form>`);
    q(raiz, '#f-persona').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const cuerpo = { ...leerPersona(raiz), activo: q(raiz, '[name="activo"]').checked };
      const res = await I101.hacer(q(raiz, '#f-persona button.pri'), () => I101.inv(`/inversionistas/${id}`, { metodo: 'PATCH', cuerpo }), q(raiz, '#f-persona .err'));
      if (res) { I101.avisa('Datos guardados.'); A.inversionista(id); }
    });
    q(raiz, '[data-borrar]').addEventListener('click', async (ev) => {
      if (!confirm(`¿Borrar a ${f.nombre} del directorio?`)) return;
      const res = await I101.hacer(ev.currentTarget, () => I101.inv(`/inversionistas/${id}`, { metodo: 'DELETE' }), q(raiz, '#f-persona .err'));
      if (res) I101.ir('#/inversionistas');
    });
  };

  /* ═══════════════ ajustes ═══════════════ */

  A.ajustes = async () => {
    const a = await I101.inv('/ajustes');
    const raiz = pinta(`
      <div class="cab"><div class="t"><h1>Ajustes</h1><p class="sub">Lo que se repite en cada ronda y en cada pagaré.</p></div></div>
      <form class="tarjeta form" id="f-ajustes">
        <label class="campo"><span>A dónde se deposita</span><textarea name="instrucciones" maxlength="2000" placeholder="Banco · CLABE · A nombre de…">${h(a.instrucciones)}</textarea>
          <small>Se copia a cada ronda nueva. Se le enseña sólo a quien ya se le aceptó una oferta.</small></label>
        <div class="fila dos">
          <label class="campo"><span>Quién firma por la empresa</span><input name="representante" value="${h(a.representante)}" maxlength="160"></label>
          <label class="campo"><span>Lugar de firma y de pago</span><input name="lugar" value="${h(a.lugar)}" maxlength="160" placeholder="Ciudad de México"></label>
        </div>
        <label class="campo"><span>Aviso de riesgos <small>${a.riesgos_propio ? '(texto de tu empresa)' : '(texto base)'}</small></span><textarea name="riesgos" rows="13" maxlength="6000">${h(a.riesgos)}</textarea>
          <small>Quien presta lo lee en cada ronda y tiene que aceptarlo para ofrecer; queda guardado qué texto aceptó y cuándo. También va impreso en el pagaré. Pídele a tu abogado que lo revise. Cambiarlo no toca lo que ya se aceptó.</small></label>
        <p class="err"></p><div class="pie-form">${a.riesgos_propio ? '<button type="button" class="b" data-riesgos-base>Volver al texto base</button>' : ''}<button class="b pri">Guardar</button></div>
      </form>
      <section class="tarjeta"><h2>Cómo se hace la cuenta</h2>
        <ul style="margin:0;padding-left:20px;display:grid;gap:6px">
          <li><b>Mensual:</b> la tasa es por mes. Un mes entero (del 8 al 8) cuenta como uno, tenga 28 o 31 días; los días sueltos se prorratean entre 30.</li>
          <li><b>Anual:</b> días reales entre 365.</li>
          <li><b>Fija:</b> la tasa es por todo el plazo, sin importar cuántos días sean.</li>
          <li><b>Parcialidades:</b> el capital en partes iguales y el interés sobre lo que se sigue debiendo.</li>
          <li>El préstamo arranca el día que marcas el depósito recibido. El plazo no pasa de 24 meses.</li>
        </ul></section>`);
    q(raiz, '#f-ajustes').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const r = await I101.hacer(q(raiz, '#f-ajustes button.pri'), () => I101.inv('/ajustes', { metodo: 'PUT', cuerpo: { instrucciones: valor(raiz, 'instrucciones'), representante: valor(raiz, 'representante'), lugar: valor(raiz, 'lugar'), riesgos: valor(raiz, 'riesgos') } }), q(raiz, '#f-ajustes .err'));
      if (r) { I101.avisa('Ajustes guardados.'); A.ajustes(); }
    });
    q(raiz, '[data-riesgos-base]')?.addEventListener('click', async (ev) => {
      if (!confirm('¿Volver al texto base del aviso de riesgos? Se pierde el texto de tu empresa.')) return;
      const r = await I101.hacer(ev.currentTarget, () => I101.inv('/ajustes', { metodo: 'PUT', cuerpo: { riesgos: '' } }), q(raiz, '#f-ajustes .err'));
      if (r) { I101.avisa('Aviso de riesgos: texto base.'); A.ajustes(); }
    });
  };
})();
