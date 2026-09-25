# Entornos, guardia de producción, CI y rotación de claves

Guía práctica. Explica qué entornos existen, cómo se protegen entre sí y cómo se rotan las claves.

## 1. Entornos

| Entorno | Base de datos | Backend | Frontend |
|---|---|---|---|
| **production** | Supabase actual (no se movió) | Railway | Vercel |
| **development** | Otro proyecto de Supabase, gratuito | Tu PC (`npm run dev`) | Tu PC (Vite, puerto 5175) |

**Staging no existe todavía**, porque un tercer proyecto de Supabase y un entorno extra de Railway pueden costar dinero. Para añadirlo más adelante:

1. Crea otro proyecto de Supabase (probablemente de pago).
2. En un `.env` aparte pon `APP_ENV=staging` y ejecuta `node scripts/setup-db.mjs` desde `backend/`.
3. En Railway crea un entorno `staging` con sus propias variables y `APP_ENV=staging`.
4. En Vercel, la variable `VITE_API_URL` del entorno *Preview* debe apuntar a ese backend, y su origen se añade a `ALLOWED_ORIGINS`.

## 2. Variables por entorno

| Variable | Producción (Railway) | Desarrollo (`backend/.env`) |
|---|---|---|
| `APP_ENV` | `production` | `development` |
| `DATABASE_URL` | Supabase producción (pooler) | Supabase desarrollo (pooler) |
| `DIRECT_URL` | Supabase producción (directa) | Supabase desarrollo (directa) |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Valores propios de producción | Valores distintos, solo para desarrollo |
| `FRONTEND_URL` | `https://fleet-guardian-tms.vercel.app` | `http://localhost:5175` |
| `ALLOWED_ORIGINS` | `https://fleet-guardian-tms.vercel.app` | `http://localhost:5175,http://localhost:5173` |
| `ORS_API_KEY`, `GEMINI_API_KEY` | Claves de producción | Pueden ser las mismas mientras no haya cuota propia |
| `PORT` | (lo pone Railway) | `3000` |

Reglas:
- Un JWT de desarrollo nunca debe valer en producción, por eso son valores distintos.
- El archivo `.env` está ignorado por git. Solo se sube `.env.example`.

## 3. Crear la base de datos de desarrollo

1. En Supabase crea un proyecto nuevo llamado `fleet-guardian-dev` (plan gratuito).
2. Copia la cadena de conexión con pooler (`DATABASE_URL`) y la directa (`DIRECT_URL`).
3. Rellena `backend/.env` según la tabla anterior. Genera los secretos JWT con:
   `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
4. Desde `backend/` ejecuta `node scripts/setup-db.mjs`. Hace esto, en orden:
   - Comprueba que la base no sea producción ni tenga datos sin marca.
   - Crea las tablas (`prisma db push`) y aplica los SQL de `migrations/manual/`.
   - Marca la base como `development`.
   - Carga datos de demostración. Usuario: `admin@demo.com`, contraseña: `demo1234` (solo desarrollo).
5. Arranca con `npm run dev` y comprueba en el log la línea `[env] APP_ENV=development, the database marker matches`.

## 4. La guardia: cómo te protege

Cada base de datos guarda una **marca** (tabla `AppEnvironment`, una sola fila) con su entorno. Al arrancar, el servidor compara esa marca con su `APP_ENV` y **no arranca si no coinciden**. Falla cerrado: si no hay marca, tampoco arranca.

| Mensaje | Qué significa | Qué hacer |
|---|---|---|
| `APP_ENV is "development" but this database is marked "production"` | Tu `.env` apunta a producción | Corrige `DATABASE_URL` y `DIRECT_URL` para que apunten a la base de desarrollo |
| `This database has no environment marker` | La base no tiene marca | Si es la base correcta: `node scripts/mark-environment.mjs <entorno>` |
| `Missing required environment variables: APP_ENV` | Falta la variable | Añádela al `.env` (o a Railway) |
| `This database has data but no environment marker, so it could be production` | `setup-db` o `seed` en una base con datos sin marca | No sigas: revisa a qué base apunta tu `.env` |

Marcar una base que ya tiene datos como no-producción exige `--force`. Es a propósito: es la forma en que una base de producción quedaría sin protección.

**Límite conocido:** la guardia no puede detectar que copies la cadena de producción y además escribas `APP_ENV=production` en tu `.env`. Nunca lo hagas: producción vive solo en Railway.

## 5. Scripts peligrosos

- `npm run seed` **borra todas las tablas** y carga datos de demostración. Ahora solo corre con una marca `development` o `staging` que coincida con `APP_ENV`, y nunca con `production`.
- `scripts/setup-db.mjs` no acepta `APP_ENV=production` ni bases con datos y sin marca.
- Los scripts temporales que empiezan por `backend/_` están ignorados por git. Bórralos al terminar.

## 6. CI (GitHub Actions)

Se ejecuta en cada push y pull request (`.github/workflows/ci.yml`):

| Trabajo | Bloquea | Notas |
|---|---|---|
| Tests del backend | Sí | No necesitan base de datos |
| Tests del frontend | Sí | |
| Build del frontend | Sí | |
| Lint del frontend | No, solo avisa | Tiene errores que se arreglan el día 12 |
| `npm audit` | No, solo avisa | |

Dependabot abre pull requests semanales agrupados (`.github/dependabot.yml`).

Dos ajustes que haces tú, porque están en los paneles:
- **GitHub:** Settings, Branches, regla para `master`: exigir que pasen los checks *backend* y *frontend* antes de fusionar.
- **Railway:** en el servicio del backend, activa *Wait for CI* para que no despliegue un commit con tests rojos.

## 7. Rotación de claves (procedimiento)

Hazla en una ventana corta. Al final todos los usuarios tendrán que iniciar sesión otra vez.

1. **JWT:** genera dos valores nuevos en tu terminal. Ponlos en Railway como `JWT_SECRET` y `JWT_REFRESH_SECRET`. Espera el redeploy.
2. **Gemini:** en Google AI Studio crea una clave nueva, ponla en Railway y en tu `.env`, y borra la vieja.
3. **OpenRouteService:** crea un token nuevo en su panel, cámbialo en Railway y en tu `.env`, y revoca el viejo.
4. **Contraseña de Supabase (producción):** en Settings, Database, resetéala y actualiza enseguida `DATABASE_URL` y `DIRECT_URL` en Railway. Puede haber unos 10 minutos de caída. Tu `.env` local apunta a desarrollo y no se ve afectado.
5. **Tu contraseña de admin:** cámbiala desde la app.

Después de cada paso comprueba:
- `https://fleetguardian-tms-production.up.railway.app/api/health` responde `{"status":"ok"}`.
- Un login con datos falsos responde `Invalid credentials` (eso prueba que la base de datos responde).

Nunca pegues claves en chats, tickets ni archivos que se suban a git. Si una clave se filtró, se rota aunque no se haya visto usar.

## 8. Vulnerabilidades pendientes

Estado tras `npm audit fix` sin `--force` (21 de septiembre de 2026):

- **Frontend:** 0.
- **Backend:** 4 de gravedad alta, todas en el CLI de `prisma` (`@prisma/config` que usa `deepmerge-ts`, y `mysql2`). La app solo usa PostgreSQL y no carga `mysql2` en ejecución. Arreglarlas exige `npm audit fix --force`, que cambia Prisma a otra versión mayor. Se revisa cuando Prisma publique la corrección; mientras tanto el CI las muestra como aviso.

## 9. Mapa de migraciones manuales

| Archivo | Contenido |
|---|---|
| `001_ors_mileage.sql` | Millas calculadas con OpenRouteService |
| `002_trailers.sql` | Trailers |
| `003_unit_number.sql` | Número de unidad |
| `005_sessions.sql` | Tabla `Sesion` (sesiones con rotación) |
| `006_environment_marker.sql` | Tabla `AppEnvironment` (marca del entorno) |
| `007_tenant_trip_codes.sql` | Tabla `ContadorVuelta` y código de viaje único por empresa |

No existe la 004. La siguiente libre es la `008`, reservada para "olvidé mi contraseña".

## 10. Scripts para cualquier entorno (`backend/scripts/`)

Sirven igual para desarrollo y para producción. Todos exigen `--env <nombre>`, leen la conexión de la variable `DATABASE_URL` y **se niegan a continuar si la marca de la base de datos no coincide** con ese nombre. Imprimen solo números, nunca datos, ids ni credenciales.

| Script | Para qué sirve |
|---|---|
| `apply-sql.mjs migrations/manual/<archivo>.sql --env <nombre>` | Aplica una migración manual (todas son idempotentes) |
| `audit-tenancy.mjs --env <nombre>` | Solo lectura. Cuenta datos que mezclan empresas y códigos que bloquearían la migración 007 |
| `cleanup-test-data.mjs --env <nombre>` | Borra las empresas de prueba `Prueba Dia4 (borrar)` cuyos usuarios sean `prueba.dia4.*@example.com` |
| `mark-environment.mjs <nombre>` | Marca una base de datos con su entorno |
| `setup-db.mjs` | Monta una base de desarrollo nueva |

**Cómo ejecutarlos en producción** sin dejar la conexión en ningún archivo ni en el historial. En PowerShell:

```powershell
cd backend
$env:DATABASE_URL = Read-Host "Cadena de conexión de producción"
node scripts/audit-tenancy.mjs --env production
Remove-Item Env:DATABASE_URL
```

- `Read-Host` te pide la cadena en pantalla: no queda en el historial de comandos.
- El valor escrito en la sesión tiene prioridad sobre el `.env`, que solo tiene la base de desarrollo.
- La última línea borra la variable. También desaparece al cerrar la terminal.
- Si te equivocas y pegas la cadena de desarrollo, el script responde `Refusing: this database is marked "development"...` y no hace nada.
- La cadena de producción es la de Railway (`DATABASE_URL`) o la de Supabase, la de pooler.

## 11. Pruebas de integración

`npm run test:integration` (desde `backend/`) crea dos empresas reales en la base de **desarrollo** y comprueba que una no puede referenciar, leer, editar ni borrar los datos de la otra, y que los códigos de viaje son por empresa. Se niega a correr si la marca de la base no es `development`. No forma parte de `npm test` ni del CI, porque necesita una base de datos.
