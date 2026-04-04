# La Nube - Sistema de Gestión de Coworking

Sistema completo de gestión para el espacio de coworking La Nube, desarrollado con Next.js, TypeScript, TailwindCSS y PostgreSQL. Interfaz completamente en español (Latinoamérica).

## Características

### Para Usuarios

- ✅ Registro con información personal (nombre, apellido, DNI, institución, motivo)
- ✅ Dashboard con estadísticas personales
- ✅ Reservas para Coworking, Laboratorio y Auditorio
- ✅ Gestión de reservas existentes
- ✅ Configuración de perfil personal

### Para Administradores

- 🔄 Panel de control administrativo
- 🔄 Gestión de reservas (aprobar/rechazar)
- 🔄 Sistema de check-in/check-out
- 🔄 Estadísticas de uso
- 🔄 Reporte de incidentes
- 🔄 Seguimiento de usuarios actuales

## Tecnologías Utilizadas

- **Frontend**: Next.js 15, TypeScript, TailwindCSS, Radix UI/Shadcn UI
- **Backend**: Next.js API Routes
- **Base de datos**: PostgreSQL con Prisma ORM
- **Autenticación**: NextAuth.js con Credentials
- **Deploy**: Vercel (configurado)

## Instalación y Configuración

### 1. Clonar el repositorio

```bash
git clone <repository-url>
cd la-nube-coworking
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Copia el archivo `env.example` a `.env` y completá los valores:

```bash
cp env.example .env
```

El archivo `env.example` ya incluye los valores por defecto para desarrollo local, por lo que en la mayoría de los casos no hace falta modificar nada.

### 4. Levantar el stack con Docker Compose

El proyecto incluye `docker/docker-compose.yml` con todo lo necesario para desarrollo local: base de datos, migraciones, correo de prueba y (opcionalmente) la aplicación Next.js dentro de un contenedor.

| Servicio | Descripción |
|----------|-------------|
| **postgres** | PostgreSQL 17.2; imagen basada en la oficial con soporte opcional de **libfaketime** (reloj simulado) |
| **migrate** | Una sola ejecución al subir el stack: aplica migraciones Prisma y seed |
| **mailpit** | SMTP de prueba y UI web para ver los emails |
| **app** | Next.js en modo `next dev`, escuchando en `0.0.0.0:3000` y con inspector Node en el puerto **9229** |

#### Prerrequisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (o Docker Engine + Compose v2) en ejecución.
- Archivo `.env` en la raíz del repo (por ejemplo copiando `env.example`), porque el servicio `app` lo monta con `env_file`.

#### Dependencias de Node en el volumen del `app`

El código se monta desde el host, pero `node_modules` vive en un volumen nombrado (`app_node_modules`). Ese volumen arranca vacío: si no hay `node_modules/.bin/next`, el **entrypoint del contenedor** ejecuta `npm ci` antes de `next dev` (la primera subida puede tardar unos minutos).

Si preferís instalar antes y evitar la espera al primer `up`:

```bash
docker compose -f docker/docker-compose.yml run --rm app npm ci
```

(Equivalente desde `docker/`: `docker compose run --rm app npm ci`.)

#### Iniciar todo el stack (Postgres + migrate + Mailpit + app)

Desde la **raíz del repositorio**:

```bash
docker compose -f docker/docker-compose.yml up --build
```

En segundo plano:

```bash
docker compose -f docker/docker-compose.yml up --build -d
```

Flujo al arrancar:

1. **postgres** espera a estar saludable (`pg_isready`).
2. **migrate** corre `docker/migrate-entry.sh` (migraciones + seed). No hace falta ejecutar Prisma a mano en un flujo normal.
3. **mailpit** queda listo para SMTP (`mailpit:1025` desde la red interna) y la UI en [http://localhost:8025](http://localhost:8025).
4. **app** asegura dependencias (`npm ci` si hace falta), luego `npm run dev -- -H 0.0.0.0`, y publica **http://localhost:3000** en el host.

Compose fuerza `DATABASE_URL` hacia el servicio `postgres` y `SMTP_SERVER_HOST=mailpit` para que el contenedor de la app no use `localhost` del host al enviar correo.

#### Solo infraestructura (sin app en Docker)

Si preferís correr Next en la máquina con `npm run dev` y usar Docker solo para DB y correo, podés comentar o no usar el servicio `app` (por ejemplo levantando servicios concretos):

```bash
docker compose -f docker/docker-compose.yml up postgres mailpit migrate
```

En `.env`, `DATABASE_URL` debe apuntar a `localhost:5432` y `SMTP_SERVER_HOST` a `localhost` (puerto 1025), como en desarrollo clásico.

#### Detener los servicios

```bash
docker compose -f docker/docker-compose.yml down
```

Borrar también volúmenes (incluye datos de Postgres y los `node_modules` en volumen):

```bash
docker compose -f docker/docker-compose.yml down -v
```

### Reloj simulado (fines de mes / año y pruebas de fecha)

Para probar reglas que dependen de “hoy” o de `now()` en SQL sin cambiar la hora del sistema, el stack puede arrancar con **libfaketime** en **postgres** y **app**. Eso hace que `SELECT now()` en Postgres y `Date` / `Date.now()` en Node vean el mismo tiempo ficticio.

Se usa un segundo archivo Compose que solo añade la variable de entorno `FAKETIME`:

```bash
docker compose -f docker/docker-compose.yml -f docker/docker-compose.timemock.yml up --build
```

Por defecto el overlay define algo equivalente a `@2025-12-31 23:59:59` (instante fijo). Podés cambiarlo al vuelo:

```bash
FAKETIME='@2026-01-01 00:00:00' docker compose -f docker/docker-compose.yml -f docker/docker-compose.timemock.yml up --build
```

Más sintaxis y opciones: [especificación de libfaketime](https://github.com/wolfcw/libfaketime/wiki/Specification).

**Cómo encaja con el código del repo**

- **Servidor (API, Prisma, auth, etc.)**: el tiempo de pared pasa por `@/lib/clock` (`now()` / `nowMs()`), que en el proceso Node ya está bajo faketime cuando usás el overlay.
- **Navegador**: el reloj del cliente sigue siendo el real; para alinear la UI con el servidor, el layout envía un `serverNowMs` y el cliente usa `ServerTimeProvider` + `useServerTime()` (por ejemplo el calendario de reservas).

Comprobación rápida del tiempo que ve el servidor (solo en desarrollo):

```bash
curl -s http://localhost:3000/api/dev/server-time | jq
```

### Depuración con VS Code / Cursor (`.vscode/launch.json`)

El contenedor **app** arranca Node con `NODE_OPTIONS=--inspect=0.0.0.0:9229` y el puerto **9229** está publicado en el host, así podés **adjuntar** el depurador al proceso de Next dentro de Docker.

1. Levantá el stack con Compose (como arriba) y esperá a que Next muestre que escucha en el puerto 3000.
2. En VS Code o Cursor: **Run and Debug**, elegí la configuración **“Next.js: attach (Docker, port 9229)”** y pulsá **Start Debugging** (F5).

Esa entrada en `.vscode/launch.json` es esencialmente:

```json
{
  "name": "Next.js: attach (Docker, port 9229)",
  "type": "node",
  "request": "attach",
  "address": "localhost",
  "port": 9229,
  "localRoot": "${workspaceFolder}",
  "remoteRoot": "/app",
  "skipFiles": ["<node_internals>/**"]
}
```

- **`localRoot` / `remoteRoot`**: el código en el contenedor está en `/app` y coincide con la raíz del workspace por el volumen montado; así los breakpoints en el editor se mapean bien.
- Si cambiás el `WORKDIR` en la imagen, actualizá `remoteRoot` para que coincida.

**Depurar sin Docker** seguís pudiendo usar las otras configuraciones del mismo archivo, por ejemplo **“Next.js: dev (npx next dev)”** o **“Next.js: full stack (dev + Chrome)”**, que lanzan Next en la máquina local.

**Cliente (React en el navegador)**  
Para el front podés usar **“Next.js: Chrome (client)”** o **“Next.js: Firefox (client)”** contra `http://localhost:3000`, con la app ya corriendo (en Docker o no).

### 5. Servidor SMTP local (Mailpit)

Durante el desarrollo, todos los emails que envía la aplicación (confirmación de cuenta, recuperación de contraseña, etc.) son interceptados por **Mailpit** y nunca salen a internet.

Para ver los emails recibidos, abrí el panel web en:

**[http://localhost:8025](http://localhost:8025)**

Ahí vas a encontrar la bandeja de entrada con todos los mensajes enviados durante la sesión. Los emails se limpian al reiniciar el contenedor.

### 6. Ejecutar la app en la máquina (sin contenedor `app`)

Si levantaste solo Postgres y Mailpit con Compose, o no usás el servicio `app`:

```bash
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000). Si la app corre en Docker, la misma URL sirve; no hace falta este paso.

## Deploy en Vercel

### 1. Preparar para producción

Configura las siguientes variables de entorno en Vercel:

| Variable | Función |
|----------|---------|
| `DATABASE_URL` | URL de conexión a PostgreSQL |
| `NEXTAUTH_URL` | URL pública de la aplicación |
| `NEXTAUTH_SECRET` | Secreto para encriptación de cookies |
| `SMTP_SERVER_HOST` | Host del servidor SMTP |
| `SMTP_SERVER_PORT` | Puerto del servidor SMTP |
| `SMTP_SERVER_USERNAME` | Usuario del servidor SMTP |
| `SMTP_SERVER_PASSWORD` | Contraseña del servidor SMTP |
| `SMTP_SERVER_SECURE` | `true` en producción para habilitar TLS |
| `TURNSTILE_SECRET_KEY` | Secreto de Cloudflare Turnstile |
| `NEXT_PUBLIC_TURNSTILE_SITEKEY` | Key del widget de Cloudflare Turnstile |

### 2. Deploy

```bash
npm run build
npx vercel --prod
```

## Estructura del Proyecto

```
src/
├── app/                    # App Router de Next.js
│   ├── api/               # API Routes
│   │   ├── auth/          # Autenticación
│   │   ├── dashboard/     # Estadísticas del dashboard
│   │   ├── reservations/  # Gestión de reservas
│   │   └── user/          # Perfil de usuario
│   ├── auth/              # Páginas de autenticación
│   ├── dashboard/         # Dashboard principal
│   ├── coworking/         # Reservas de coworking
│   ├── lab/               # Reservas de laboratorio
│   ├── auditorium/        # Reservas de auditorio
│   └── settings/          # Configuración de usuario
├── components/            # Componentes reutilizables
│   ├── ui/               # Componentes de Shadcn UI
│   ├── user-layout.tsx   # Layout para usuarios
│   └── session-provider.tsx
└── lib/                   # Utilidades y configuración
    ├── auth.ts           # Configuración de NextAuth
    ├── clock.ts          # Reloj de pared en servidor (alineado con faketime en Docker)
    ├── prisma.ts         # Cliente de Prisma
    └── utils.ts          # Utilidades generales
```

## Colores de Marca

La aplicación utiliza los colores oficiales de La Nube:

- **Primary**: `#4E87C2` (Azul principal)
- **Secondary**: `#75E3F1` (Azul claro)
- **Accent**: `#C8F1FC` (Azul muy claro)

## Próximas Funcionalidades

- [ ] Panel de administración completo
- [ ] Sistema de check-in/check-out
- [ ] Reporte y gestión de incidentes
- [ ] Analytics de uso y estadísticas avanzadas
- [ ] Notificaciones por email
- [ ] Integración con calendarios externos

## Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## Licencia

Este proyecto está bajo la Licencia GNU Affero General Public License. Ver el archivo `LICENSE` para más detalles.
