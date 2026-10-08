/* investor101 — el pagaré en PDF.
 *
 * Mike, con botones: «PDF automático: la plataforma genera el pagaré con
 * monto, tasa, fechas y tabla de pagos. Se firma fuera (a mano) y se sube
 * firmado. El texto base lo valida tu abogado».
 *
 * Se arma en el navegador con jsPDF (del propio origen, y sólo se descarga
 * al pedir el PDF): la API ya dio el préstamo y su tabla, aquí nada más se
 * acomoda en una hoja. NINGUNA cifra se calcula aquí.
 *
 * EL TEXTO ES UNA BASE, no asesoría legal: los elementos de un pagaré
 * (artículo 170 de la Ley General de Títulos y Operaciones de Crédito) y una
 * tabla de pagos anexa. Antes de usarlo de verdad lo revisa un abogado; la
 * pantalla lo dice junto al botón.
 */
'use strict';
(() => {
  /* ─────────────── el monto con letra ─────────────── */

  const UNIDADES = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince',
    'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiún', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
  const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  const CIENTOS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

  /** 0–999, en la forma que va antes de «mil», «millones» o «pesos»
   *  («veintiún mil», «un millón», «treinta y un pesos»). */
  function hastaMil(n) {
    if (n === 0) return '';
    if (n === 100) return 'cien';
    const c = Math.floor(n / 100), r = n % 100;
    let t = '';
    if (r < 30) t = UNIDADES[r];
    else t = DECENAS[Math.floor(r / 10)] + (r % 10 ? ` y ${UNIDADES[r % 10]}` : '');
    return [CIENTOS[c], t].filter(Boolean).join(' ');
  }

  function enteroConLetra(n) {
    if (n === 0) return 'cero';
    const millones = Math.floor(n / 1_000_000), miles = Math.floor((n % 1_000_000) / 1000), resto = n % 1000;
    const partes = [];
    if (millones) partes.push(millones === 1 ? 'un millón' : `${enteroConLetra(millones)} millones`);
    if (miles) partes.push(miles === 1 ? 'mil' : `${hastaMil(miles)} mil`);
    if (resto) partes.push(hastaMil(resto));
    return partes.join(' ');
  }

  /** 5000050 → «CINCUENTA MIL PESOS 50/100 M.N.» */
  I101.montoConLetra = (centavos) => {
    const n = Math.round(Number(centavos) || 0);
    const pesos = Math.floor(n / 100), cent = n % 100;
    const letra = enteroConLetra(pesos);
    // «un millón DE pesos», «dos millones DE pesos»: cuando termina en millón.
    const de = pesos >= 1_000_000 && pesos % 1_000_000 === 0 ? ' de' : '';
    return `${letra}${de} ${pesos === 1 ? 'peso' : 'pesos'} ${String(cent).padStart(2, '0')}/100 M.N.`.toUpperCase();
  };

  /* ─────────────── el PDF ─────────────── */

  let cargando = null;
  const traerJsPDF = () => {
    if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    if (!cargando) {
      cargando = new Promise((ok, mal) => {
        const s = document.createElement('script');
        s.src = 'vendor/jspdf.js';
        s.onload = () => (window.jspdf?.jsPDF ? ok(window.jspdf.jsPDF) : mal(new Error('No se pudo preparar el PDF.')));
        s.onerror = () => { cargando = null; mal(new Error('No se pudo preparar el PDF. Revisa tu señal.')); };
        document.head.appendChild(s);
      });
    }
    return cargando;
  };

  const AZUL = [0, 128, 193], TINTA = [10, 24, 40], TENUE = [91, 107, 122], LINEA = [217, 225, 232];

  /** Arma el documento. Se exporta aparte de la descarga para poder medirlo
   *  (páginas, texto) sin que el navegador guarde nada. */
  I101.armarPagare = async (p) => {
    const JsPDF = await traerJsPDF();
    const doc = new JsPDF({ unit: 'pt', format: 'letter' });
    const ANCHO = doc.internal.pageSize.getWidth(), ALTO = doc.internal.pageSize.getHeight();
    const M = 54, UTIL = ANCHO - M * 2;
    const borrador = p.estado === 'por_depositar';
    const empresa = p.empresa?.nombre || 'La empresa';
    const lugar = p.ajustes?.lugar || '';
    const representante = p.ajustes?.representante || '';
    const pagos = p.pagos || [];
    const ultima = pagos.length ? pagos[pagos.length - 1].fecha : p.fecha_vencimiento;
    const total = pagos.reduce((s, g) => s + Number(g.capital) + Number(g.interes), 0);
    const interes = pagos.reduce((s, g) => s + Number(g.interes), 0);
    let y = M;

    const pie = () => {
      const n = doc.getNumberOfPages();
      for (let i = 1; i <= n; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...TENUE);
        doc.text(`Pagaré ${p.folio} · ${empresa} · página ${i} de ${n}`, M, ALTO - 30);
        if (borrador) {
          doc.setFont('helvetica', 'bold').setFontSize(46).setTextColor(235, 238, 241);
          doc.text('BORRADOR', ANCHO / 2, ALTO / 2, { align: 'center', angle: 35 });
        }
      }
    };
    const cabe = (alto) => { if (y + alto > ALTO - 56) { doc.addPage(); y = M; } };
    const parrafo = (texto, o = {}) => {
      doc.setFont('helvetica', o.negrita ? 'bold' : 'normal').setFontSize(o.tam || 10.5).setTextColor(...(o.color || TINTA));
      const lineas = doc.splitTextToSize(texto, UTIL);
      const alto = lineas.length * (o.tam || 10.5) * 1.45;
      cabe(alto);
      doc.text(lineas, M, y + (o.tam || 10.5), { align: o.justo ? 'justify' : 'left', maxWidth: UTIL, lineHeightFactor: 1.45 });
      y += alto + (o.despues ?? 10);
    };

    /* — encabezado — */
    doc.setFillColor(...AZUL).rect(0, 0, ANCHO, 8, 'F');
    y = 46;
    doc.setFont('helvetica', 'bold').setFontSize(22).setTextColor(...TINTA).text('PAGARÉ', M, y + 16);
    doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...TENUE).text(`Folio ${p.folio}`, M, y + 32);
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...TENUE).text('BUENO POR', ANCHO - M, y + 4, { align: 'right' });
    doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(...TINTA).text(I101.pesos(p.monto), ANCHO - M, y + 24, { align: 'right' });
    y += 52;
    doc.setDrawColor(...LINEA).setLineWidth(0.8).line(M, y, ANCHO - M, y);
    y += 16;

    /* — el cuerpo — */
    const donde = lugar ? `En ${lugar}, a ${I101.diaLargo(p.fecha_inicio)}.` : `A ${I101.diaLargo(p.fecha_inicio)}.`;
    parrafo(donde, { despues: 8 });
    parrafo(
      `Por este pagaré, ${empresa}${p.empresa?.rfc ? ` (RFC ${p.empresa.rfc})` : ''}, en adelante «el suscriptor», promete incondicionalmente pagar a la orden de `
      + `${p.inversionista.nombre}, en adelante «el beneficiario», la cantidad de ${I101.pesos(p.monto)} (${I101.montoConLetra(p.monto)}), `
      + 'que el suscriptor recibió a su entera satisfacción en calidad de préstamo.',
      { justo: true },
    );
    const comoPaga = p.esquema === 'unico'
      ? `en una sola exhibición el ${I101.diaLargo(ultima)}`
      : `en ${pagos.length} pagos conforme a la tabla de pagos que forma parte de este documento, el último de ellos el ${I101.diaLargo(ultima)}`;
    parrafo(`La suma principal se pagará ${comoPaga}${lugar ? `, en ${lugar}` : ''}, mediante transferencia a la cuenta que el beneficiario indique.`, { justo: true });
    const comoCausa = p.tipo_tasa === 'fija'
      ? `una tasa fija de ${I101.tasa('fija', p.tasa_pb).replace(' por todo el plazo', '')} sobre la suma principal por todo el plazo`
      : p.tipo_tasa === 'mensual'
        ? `una tasa de ${I101.tasa('mensual', p.tasa_pb)} sobre saldos insolutos, calculada por meses completos y, por los días restantes, a razón de treinta días por mes`
        : `una tasa de ${I101.tasa('anual', p.tasa_pb)} sobre saldos insolutos, calculada por los días efectivamente transcurridos sobre la base de un año de 365 días`;
    parrafo(
      Number(p.tasa_pb) > 0
        ? `La suma principal causará intereses ordinarios a ${comoCausa}, a partir del ${I101.diaLargo(p.fecha_inicio)}. Los intereses de todo el plazo ascienden a ${I101.pesos(interes)}, por lo que el total a pagar es de ${I101.pesos(total)} (${I101.montoConLetra(total)}).`
        : `La suma principal no causará intereses ordinarios. El total a pagar es de ${I101.pesos(total)} (${I101.montoConLetra(total)}).`,
      { justo: true },
    );
    parrafo('El suscriptor podrá pagar anticipadamente, total o parcialmente, sin penalización. Cualquier cambio a la tabla de pagos deberá constar por escrito y ser aceptado por ambas partes.', { justo: true, despues: 16 });

    /* — la tabla de pagos — */
    cabe(60);
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...TINTA).text('Tabla de pagos', M, y + 10);
    y += 22;
    const col = [M, M + 44, M + 190, M + 300, M + 410];
    const der = [null, null, M + 290, M + 400, ANCHO - M];
    const encabezado = () => {
      doc.setFillColor(245, 247, 249).rect(M, y, UTIL, 20, 'F');
      doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(...TENUE);
      doc.text('N.º', col[0] + 6, y + 13); doc.text('FECHA', col[1], y + 13);
      doc.text('CAPITAL', der[2], y + 13, { align: 'right' }); doc.text('INTERÉS', der[3], y + 13, { align: 'right' }); doc.text('PAGO', der[4] - 6, y + 13, { align: 'right' });
      y += 20;
    };
    encabezado();
    doc.setFontSize(10);
    for (const g of pagos) {
      if (y + 20 > ALTO - 56) { doc.addPage(); y = M; encabezado(); doc.setFontSize(10); }
      doc.setFont('helvetica', 'normal').setTextColor(...TINTA);
      doc.text(String(g.numero), col[0] + 6, y + 14);
      doc.text(I101.diaLargo(g.fecha), col[1], y + 14);
      doc.text(I101.pesos(g.capital), der[2], y + 14, { align: 'right' });
      doc.text(I101.pesos(g.interes), der[3], y + 14, { align: 'right' });
      doc.setFont('helvetica', 'bold').text(I101.pesos(Number(g.capital) + Number(g.interes)), der[4] - 6, y + 14, { align: 'right' });
      doc.setDrawColor(...LINEA).setLineWidth(0.5).line(M, y + 20, ANCHO - M, y + 20);
      y += 20;
    }
    cabe(26);
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...TINTA);
    doc.text('Total', col[1], y + 15);
    doc.text(I101.pesos(Number(p.monto)), der[2], y + 15, { align: 'right' });
    doc.text(I101.pesos(interes), der[3], y + 15, { align: 'right' });
    doc.text(I101.pesos(total), der[4] - 6, y + 15, { align: 'right' });
    y += 34;

    /* — las firmas — */
    cabe(150);
    y += 54;
    const mitad = UTIL / 2 - 14;
    doc.setDrawColor(...TINTA).setLineWidth(0.8);
    doc.line(M, y, M + mitad, y); doc.line(ANCHO - M - mitad, y, ANCHO - M, y);
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...TINTA);
    doc.text(doc.splitTextToSize(empresa, mitad), M, y + 14);
    doc.text(doc.splitTextToSize(p.inversionista.nombre, mitad), ANCHO - M - mitad, y + 14);
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...TENUE);
    doc.text(`El suscriptor${representante ? ` · representado por ${representante}` : ''}`, M, y + 40, { maxWidth: mitad });
    doc.text('El beneficiario', ANCHO - M - mitad, y + 40);

    pie();
    return doc;
  };

  I101.descargarPagare = async (prestamo) => {
    const doc = await I101.armarPagare(prestamo);
    doc.save(`Pagaré ${prestamo.folio}${prestamo.estado === 'por_depositar' ? ' (borrador)' : ''}.pdf`);
  };
})();
