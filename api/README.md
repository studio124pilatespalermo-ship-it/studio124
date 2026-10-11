# Studio124 · API del sistema de reservas

Servicio HTTP (Hono + Drizzle + Postgres) que concentra clientes, abonos, agenda y cobros.
Pensado para correr en Railway; la landing y el panel viven en Vercel.

## Correrlo

```bash
npm install
cp .env.example .env     # completá APP_ENCRYPTION_KEY
npm run db:migrate
SEED_ADMIN_EMAIL=vos@ejemplo.com SEED_ADMIN_PASSWORD=una-clave-larga npm run seed:admin
npm run dev
```

Sin `DATABASE_URL` usa una base Postgres embebida en `./.data`: no hace falta instalar nada.

> **Importante con la base embebida:** PGlite abre el directorio en exclusiva. Si corrés un
> seed con el servidor levantado, cada proceso trabaja sobre su propia copia y los cambios se
> pisan. **Parar el servidor antes de cualquier seed**, o usar un Postgres real con
> `DATABASE_URL` (ahí no pasa).

`npm run seed:demo` carga datos de prueba: profesional, categorías, agenda modelo de lunes a
sábado, dos meses de turnos y tres clientas con su abono y sus turnos fijos.

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor con recarga |
| `npm run typecheck` | TypeScript estricto |
| `npm run test` | Tests sobre Postgres real en memoria |
| `npm run db:generate` | Genera la migración SQL tras cambiar el esquema |
| `npm run db:migrate` | Aplica migraciones |
| `npm run seed:admin` | Crea el admin y los medios de pago base |
| `npm run seed:demo` | Datos de prueba (no corre en producción) |

## Credenciales

Las de Mercado Pago y las de email **no** son variables de entorno: se cargan desde
`/admin → Configuración → Credenciales`, se guardan cifradas con AES-256-GCM y la API nunca
las devuelve (sólo informa si están cargadas y su pista `••••1234`).

La única clave que sí va en el entorno es `APP_ENCRYPTION_KEY`, con la que se cifran las demás.

## Reglas principales

- Un pago crea el abono y carga sus créditos. **No genera turnos solos**: la administradora
  usa "Cargar turnos", revisa la vista previa y confirma.
- El saldo de un abono es la suma de su libro de movimientos, nunca un número suelto.
- Cancelar a tiempo devuelve la clase; fuera de plazo o ausente, se pierde. El panel puede
  devolverla igual, con motivo.
- "Generar mes" sólo crea los turnos que faltan: nunca pisa un cambio hecho a mano.

## Tareas diarias

`POST /api/tasks/daily` con `Authorization: Bearer <CRON_SECRET>` marca abonos vencidos,
envía los avisos y limpia sesiones. Es idempotente.
