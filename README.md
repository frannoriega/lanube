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

### 4. Levantar los servicios locales con Docker

El proyecto incluye una configuración de Docker Compose en la carpeta `docker/` con todos los servicios necesarios para el desarrollo local:

| Servicio | Descripción |
|----------|-------------|
| **postgres** | Base de datos PostgreSQL 17.2 (igual que producción en Vercel) |
| **migrate** | Contenedor que aplica las migraciones y ejecuta el seed automáticamente al iniciar |
| **mailpit** | Servidor SMTP local para capturar emails enviados por la aplicación |

#### Prerrequisitos

Tener [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y corriendo.

#### Iniciar los servicios

Desde la carpeta `docker/`:

```bash
cd docker
docker compose up
```

O en segundo plano:

```bash
docker compose up -d
```

Al iniciar, Docker levanta PostgreSQL y espera a que esté listo. Una vez saludable, el servicio `migrate` aplica automáticamente todas las migraciones pendientes y ejecuta el seed de la base de datos. No hace falta correr ningún comando de Prisma manualmente.

#### Detener los servicios

```bash
docker compose down
```

Para detener y eliminar también los volúmenes (borra todos los datos):

```bash
docker compose down -v
```

### 5. Servidor SMTP local (Mailpit)

Durante el desarrollo, todos los emails que envía la aplicación (confirmación de cuenta, recuperación de contraseña, etc.) son interceptados por **Mailpit** y nunca salen a internet.

Para ver los emails recibidos, abrí el panel web en:

**[http://localhost:8025](http://localhost:8025)**

Ahí vas a encontrar la bandeja de entrada con todos los mensajes enviados durante la sesión. Los emails se limpian al reiniciar el contenedor.

### 6. Ejecutar en desarrollo

```bash
npm run dev
```

Visita [http://localhost:3000](http://localhost:3000) para ver la aplicación.

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
