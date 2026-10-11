# Sistema de reservas · puesta en marcha

Cómo levantar el sistema (API + panel `/admin`) en desarrollo y en producción.
La landing sigue siendo estática y no se ve afectada: `/admin` es una aplicación de
cliente que habla con la API.

## Piezas

| Pieza | Dónde corre | Qué hace |
| --- | --- | --- |
| Landing, panel `/admin` y portal `/cuenta` | Vercel | Sitio estático. Panel y portal piden todo a la API |
| API | Railway | Clientes, abonos, agenda, cobros, emails |
| Postgres | Railway | Única fuente de datos |
| Mercado Pago | Externo | Checkout Pro y webhook de confirmación |

## Desarrollo local

```bash
# 1. API (puerto 3000). Sin DATABASE_URL usa una base embebida en api/.data
cd api
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # pegar en APP_ENCRYPTION_KEY
SEED_ADMIN_EMAIL=vos@ejemplo.com SEED_ADMIN_PASSWORD=una-clave-larga npm run seed:admin
npm run dev

# 2. Landing y panel (puerto 4321), desde la raíz
npm run dev
```

Entrá a http://localhost:4321/admin/. En `.env` de la raíz tiene que estar
`PUBLIC_API_URL=http://localhost:3000`.

## Producción

### 1. Base de datos y API en Railway

1. Nuevo proyecto → **Add Postgres**. Railway genera `DATABASE_URL`.
2. **Add Service → GitHub repo**, con **Root Directory** en `api/`.
3. Variables del servicio:

   | Variable | Valor |
   | --- | --- |
   | `DATABASE_URL` | la que generó Railway (referencia al servicio de Postgres) |
   | `APP_ENCRYPTION_KEY` | 32 bytes en base64, generados con el comando de arriba |
   | `PUBLIC_SITE_URL` | `https://studio124.com.ar` |
   | `PUBLIC_API_URL` | `https://api.studio124.com.ar` |
   | `NODE_ENV` | `production` |
   | `CRON_SECRET` | cadena aleatoria larga, para las tareas diarias |

4. Dominio: en Railway, **Settings → Networking → Custom Domain** → `api.studio124.com.ar`,
   y el CNAME que indique, cargado en el DNS del dominio.
5. Primer despliegue: las migraciones se aplican solas al arrancar. Después, una sola vez:

   ```bash
   SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... npm run seed:admin
   ```

   Conviene correrlo desde la consola del servicio en Railway, nunca con la contraseña
   escrita en el repositorio.

### 2. Panel en Vercel

En el proyecto existente, agregá `PUBLIC_API_URL=https://api.studio124.com.ar` y
volvé a desplegar. El panel queda en `https://studio124.com.ar/admin/`.

`/admin` lleva `noindex, nofollow`, así que no se indexa.

### 3. Mercado Pago

1. En la cuenta del estudio: **Tus integraciones → Crear aplicación** (Checkout Pro).
2. Copiá el **Access Token de producción** y configurá el webhook apuntando a
   `https://api.studio124.com.ar/api/payments/webhook`, con el evento **Pagos**.
   Mercado Pago muestra una **clave secreta**: también hace falta.
3. Cargá las dos en el panel: **Configuración → Credenciales**. Quedan cifradas en la base
   y no se pueden volver a ver. No hace falta ponerlas en variables de entorno.
4. Probá primero con credenciales y usuarios de prueba, y recién después con las de producción.

Un aviso de pago con firma inválida se descarta y queda en los registros. Sin la clave
secreta cargada, el webhook ignora todo: es a propósito.

### 4. Ingreso de clientes con Google

1. En Google Cloud Console: **APIs y servicios → Credenciales → Crear credenciales → ID de
   cliente de OAuth**, tipo *Aplicación web*.
2. En **URI de redireccionamiento autorizados**, cargá exactamente:
   `https://api.studio124.com.ar/api/auth/google/callback`
3. Cargá `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en las variables de Railway.

Sin estas variables, el portal no ofrece el botón y avisa que todavía no está habilitado.

Quién puede entrar lo decide **Configuración → Permitir que se registren solos**:

- Apagado (por defecto): sólo entran las personas ya cargadas como clientes. Se las reconoce
  por su email y se les asocia la cuenta de Google.
- Encendido: cualquiera con cuenta de Google puede crearse la suya.

### 5. Emails (opcional)

Cargá en **Credenciales** la API key de Resend y el remitente verificado
(`Studio124 <hola@studio124.com.ar>`). Sin eso, el sistema funciona pero no envía avisos.

### 6. Tarea diaria

Marca abonos vencidos, manda los avisos y limpia sesiones. Es idempotente.

```http
POST https://api.studio124.com.ar/api/tasks/daily
Authorization: Bearer <CRON_SECRET>
```

Se programa con el cron de Railway o el de Vercel, una vez por día.

## Primeros pasos en el panel

1. **Catálogo** → cargar profesionales, categorías de pago y feriados.
2. **Agenda modelo** → cargar la semana tipo (días, horarios y cupos).
3. **Agenda modelo → Generar mes** → crear los turnos del mes. Se puede repetir sin riesgo:
   sólo crea lo que falta y nunca pisa un cambio hecho a mano.
4. **Clientes** → dar de alta y asignar turnos fijos.
5. **Cliente → Registrar un pago** y después **Cargar turnos**, revisando la propuesta.
6. **Configuración** → plazos para cambiar y cancelar, y qué ve el cliente.

## Copias de seguridad

Verificá que el plan de Postgres elegido incluya copias automáticas y probá una
restauración antes de pasar datos reales. Una copia que nunca se restauró es una suposición.

## El portal del cliente

En `/cuenta/` el cliente ve su abono y sus clases, reserva y cancela, y compra paquetes con
Mercado Pago. Qué secciones aparecen se controla desde **Configuración → Qué ve y qué puede
hacer el cliente**.

Al volver de Mercado Pago cae en `/cuenta/pago/ok`, `/pendiente` o `/error`. Ninguna de esas
páginas acredita nada: la acreditación la hace el webhook, que es la única fuente confiable.

## Qué falta

- Importar clientes y abonos vigentes desde SigueFit.
- Cambiar de turno desde el portal (hoy el cliente cancela y vuelve a reservar; la API ya
  soporta el cambio en un paso).
- Recordatorio por email el día anterior a la clase.
