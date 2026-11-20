# patron101

> **El nombre.** Nació el 8-oct-2026 como «investor101»; Mike le puso
> **patron101** ese mismo día. La marca y el dominio dicen patron101. El
> repositorio, el Worker, `X-App: investor101` y la llave `investor` conservan
> el nombre con el que nacieron (como quell101 en `bitacora-obra`): los
> nombres de infraestructura no se renombran (OPERAR.md §8).

La cuenta de quien le presta a la empresa, de la suite 101. Quien presta
entra con su correo y ve su estado de cuenta: las rondas abiertas, con cuánto
le entra, cuánto tiene invertido, qué día le pagan y los comprobantes de lo
ya pagado.

> **20-nov-2026 · lo de quien dirige vive en dash101.** Mike: «hay que meter
> patron101 a dash también. Igual que bill101»; y con botones, sobre esta
> dirección: «Mandarlo a dash101». Las rondas, las ofertas, los préstamos, el
> directorio y los ajustes se llevan en dash101, en el menú «Préstamos»
> (`dash101/app/(app)/inversion`). Quien dirige y abre patron101 llega solo
> allá, y cada liga vieja a su pantalla (`#/ronda/ID` →
> `/inversion/rondas/ID`). Aquí ya no hay pantallas de administración.

- Producción: https://patron.suite101.app (Worker `investor101`; patron101.taller101.com e investor101.taller101.com mandan ahí)
- Staging: Worker `investor101-staging` (workers.dev)

## Estado (20-nov-2026) — versión 0.3.0

Lo pidió Mike el 8-oct-2026. Es una app de la suite: se entra con la cuenta
de la suite 101 (`entrar.html`) y los datos viven en la base de la empresa,
en `suite101-api` (contrato 0.82.0, `/orgs/:o/inversion/*`). Nada se guarda en
el navegador, salvo qué empresa se abrió la última vez.

**Dos papeles, y los decide la API; aquí sólo vive uno:**

- **Quien presta** (inversionista): sólo lo suyo. De una ronda ve las
  condiciones y el avance total; nunca quién más entró ni con cuánto.
- **Quien dirige** (dueño o administración): en dash101 → Préstamos. Esta
  app lo manda para allá (`/a-dash`, que sabe dónde vive dash101 en cada
  ambiente por `URL_DASH`; no es una redirección abierta).

**Decisiones de Mike (8-oct, con botones):**

| Tema | Decisión |
|---|---|
| Tasa | Libre por préstamo: mensual, anual o fija por el plazo |
| Ofertas | Quedan pendientes; él aprueba, ajusta o rechaza cada una |
| Entrada | Correo y contraseña, como el resto de la suite |
| Privacidad | El inversionista ve sólo el avance total |
| Aviso de ronda | Correo automático + WhatsApp a mano (la liga trae el mensaje) |
| Pagos | Se registran en dash101; aquí se reflejan |
| Arranque | El préstamo arranca al confirmar el depósito recibido |
| Contrato | Pagaré en PDF; se firma a mano y se sube firmado |
| Cambios | La tabla se edita a mano, con motivo e historial |

**Lo que NO hace esta pantalla:** ninguna cuenta de intereses. La tabla que
se ve mientras se teclea la calcula la API (`POST /inversion/simular`), para
que la pantalla, el estado de cuenta y el flujo de dash101 no puedan decir
cosas distintas. La cuenta vive en `suite101-api/src/inversion.ts`.

**El pagaré** (`public/js/pagare.js`) es un texto base, no asesoría legal:
lo revisa un abogado antes de usarse de verdad.

## Cómo está hecho

Sin armazón ni compilación: archivos sueltos en `public/js/` que comparten
`I101`.

| Archivo | Qué trae |
|---|---|
| `nucleo.js` | la API, el dinero (centavos ↔ pesos), la tasa (puntos base ↔ %), fechas y rutas |
| `piezas.js` | el formulario de condiciones con su tabla en vivo, la tabla de pagos, papeles, bitácora |
| `pagare.js` | el pagaré en PDF (jsPDF, del propio origen) y el monto con letra |
| `inversionista.js` | lo de quien presta |
| `arranque.js` | quién soy, en qué empresa, y qué vista toca; a quien dirige, a dónde quedó su pantalla en dash101 (`rutaEnDash`) |

`worker/index.js` es la puerta: sin sesión sólo entrega la pantalla de
entrada; `/s101/*` va a la API por un service binding con `X-App:
investor101`. Deja pasar a quien trae `inversion` en `/yo` y a quien dirige
(a éste la página lo manda a dash101 por `/a-dash`).

## Cómo se prueba

La pantalla se prueba contra una **suite101-api de verdad**:

```
# en una terminal, dentro de un clon de suite101-api:
npx wrangler d1 migrations apply suite101-master-staging --local --env staging
npx wrangler dev --env staging --local --port 8787

# en otra, aquí:
npm ci
node pruebas/servidor.mjs 8797 http://127.0.0.1:8787 &
node pruebas/pantalla.spec.mjs      # 77 comprobaciones: quien presta en el celular; quien dirige, por la API y hacia dash101
node pruebas/a-dash.spec.mjs        # sin red: a qué pantalla de dash101 va cada liga vieja
```

Publicar: push a `main`. El flujo `Publicar investor101` levanta la API,
prueba, publica staging, mide y prueba contra staging, publica producción,
mide, y deja los números como comentario del commit.

Antes de tocar nada: `OPERAR.md`.
