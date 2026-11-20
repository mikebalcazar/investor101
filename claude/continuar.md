# Continuar — patron101 (por dentro, investor101)

**El nombre (Mike, 8-oct, 14:43):** «esta plataforma se va a llamar
patron101». Marca y dominio: patron101. Repo, Worker, `X-App` y llave
`investor`: se quedan como nacieron (OPERAR.md §8). El dominio viejo,
investor101.taller101.com, redirige al nuevo.

## 0.3.0 (20-nov) — quien dirige, a dash101

Mike: «hay que meter patron101 a dash también. Igual que bill101». Lo de
quien dirige se rehízo en dash101 (menú «Préstamos», dash101 #190). Sobre
esta dirección, con botones: **«Mandarlo a dash101»** (las otras: dejar las
dos unos días con un aviso, o dejar las dos).

- `arranque.js` ya sólo pregunta por las empresas a las que la persona LE
  PRESTA, y sólo cuentan las que contestan con papel de inversionista. Si
  ninguna y la persona dirige alguna empresa: a dash101, a la pantalla que
  corresponde a su liga (`I101.rutaEnDash`: `#/ronda/ID` →
  `/inversion/rondas/ID`, etc.). Quien presta Y dirige otra empresa se queda
  aquí con su cuenta, y en el menú de la cuenta tiene «Lo de tu empresa, en
  dash101».
- `worker/index.js`: `/a-dash?ruta=/inversion/…` contesta 302 a
  `URL_DASH` (producción: dash.suite101.app; staging: dash101-staging). Sólo
  acepta rutas de `/inversion` hechas de letras, números y guiones: no es
  una redirección abierta. No pide sesión (no entrega nada).
- Fuera `public/js/admin.js` y el menú de secciones. `piezas.js`,
  `pagare.js`, `nucleo.js` e `inversionista.js` se quedan: los usa quien
  presta.
- Los correos que la API le manda a quien dirige («hay una oferta nueva»)
  siguen trayendo la liga de aquí; al abrirla llega a esa ronda en dash101.
- La primera publicación se detuvo en «Medir staging» sin tocar producción:
  el borde aún contestaba con el Worker anterior. `medir.mjs` ahora vuelve
  a pedir `/a-dash` hasta que conteste el nuevo.
- Medido: `a-dash.spec.mjs` 40 de 40; `las-empresas-a-la-vez.mjs` 10;
  `dominio` 30; `la-puerta-recuerda` 16; y `pantalla.spec.mjs` 77 de 77
  contra la API levantada en local (quien presta, en el celular, igual que
  antes; lo de quien dirige, por la API diciendo `X-App: dash101`).

Estado al **8-oct-2026**. Lo escribe el chat de Cowork que construyó la app
el mismo día en que Mike la pidió.

## 0.2.0 (8-oct) — el aviso de riesgos

Mike: «Necesito agregar un disclaimer de los riesgos de la inversión, sobre
todo riesgos de no pago del cliente». Con botones: **aceptación obligatoria**.

- Quien presta lee el aviso en la ronda y marca la casilla para ofrecer; la
  API (0.84.0) guarda la hora y el texto aceptado. Sin casilla no hay oferta,
  tampoco saltándose la pantalla.
- El texto base vive en `suite101-api/src/inversion.ts` (`RIESGOS_BASE`); cada
  empresa lo edita en Ajustes. Lo ya aceptado no cambia.
- El pagaré lo imprime antes de las firmas, y las firmas nunca quedan solas
  en una hoja.
- Una oferta capturada por quien dirige no trae aceptación: la da la firma.
- Mismo día, defecto de la API: quien ya era cliente o personal de la
  empresa y se daba de alta como inversionista no entraba. Arreglado allá.

## Qué es

Rondas de inversión y préstamos a la empresa. Mike, 8-oct: «taller tiene un
periodo de falta de flujo (necesita pagar 30k durante las siguientes 3
semanas (90k total)) y esto sea una herramienta para pedir prestado a uno o
varios inversionistas y que les genere un rendimiento durante ese periodo».

## Las decisiones de Mike (8-oct, una por una, con botones)

1. **Interés:** libre por préstamo — mensual, anual o fija por el plazo.
2. **Ofertas:** quedan pendientes; él aprueba, ajusta o rechaza.
3. **Entrada del inversionista:** correo + contraseña, como el resto de la suite.
4. **Privacidad:** el inversionista ve sólo el avance total de la ronda.
5. **Aviso de ronda:** correo automático + botón de WhatsApp manual.
6. **Pagos:** se registran en dash101; investor101 los refleja.
7. **Arranque:** el préstamo y sus intereses arrancan cuando él marca el
   depósito recibido; ahí entra el ingreso a dash101.
8. **Contrato:** pagaré en PDF automático; se firma a mano y se sube.
9. **Pagar antes o atrasarse:** se edita la tabla a mano, con historial; sin
   penalizaciones automáticas.
10. **Quién construye:** este chat, todo (como draw101).

## Decisiones de este chat (no de Mike), por si hay que cambiarlas

- **Mensual** prorratea a 30 días; **anual** va por días reales entre 365;
  **fija** se reparte pareja entre los pagos.
- **Quincenal** es cada 15 días naturales, no «el 15 y el último».
- **Plazo máximo: 24 meses** (Mike dijo «semanas o meses, pero no más»).
- Administra **dueño o administración**; un socio o alguien de oficina, no.
- La sesión de quien sólo es inversionista dura **12 horas**, como la de un
  cliente de peek101.
- Pagar deja **dos egresos** (`prestamo_capital`, `prestamo_interes`): el
  capital que se devuelve no es gasto; el interés sí.
- En el flujo de dash101 entran también los pagos de préstamos **por
  depositar** (si el dinero va a entrar, también va a salir).

## Dónde vive cada cosa

- La cuenta, las tablas, las rutas y los correos: `suite101-api`
  (`src/inversion.ts`, `src/inversion-db.ts`, `src/rutas/inversion.ts`,
  `src/inversion-correo.ts`, `migrations/org/0042`, `migrations/d1/0025`).
- La pantalla: este repositorio.
- Pagos, depósitos y el flujo: `dash101` (`/inversion`, `/flujo`,
  `lib/inversion.ts`, `lib/proyeccion.ts`).

## Pendiente

- **El texto del pagaré lo tiene que revisar un abogado.** Es una base.
- **Ojo legal, para Mike:** avisar de una ronda a una lista de prospectos
  puede acercarse a «captación de recursos del público», que en México está
  regulada. Entre conocidos y con pagaré suele ser un préstamo entre
  particulares, pero lo confirma el abogado.
- dash101 todavía no separa `prestamo_recibido` / `prestamo_capital` en sus
  reportes de utilidad: son dinero que entra y sale, no venta ni gasto.
- Un movimiento de préstamo borrado a mano en dash101 no regresa el pago a
  pendiente: para eso está «deshacer» (`POST /inversion/pagos/:id/deshacer`),
  que hoy no tiene botón.
- master101 y workshop101 traen la lista de apps escrita a mano: falta
  `['investor', 'investor101']`. Mientras, la licencia se prendió por
  migración en `forespot` y `demo`.
- `investor101` en APPS_DOMINIO y en la puerta de empresas (dominio propio).
- El sitio (descargas): ficha y logotipo.
