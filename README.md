# La Nube - Sistema de Gestión de Coworking

Sistema completo de gestión para el espacio de coworking La Nube, desarrollado con Next.js, TypeScript, TailwindCSS y PostgreSQL. Interfaz completamente en español (Latinoamérica).

## Características

### Para Usuarios

- ✅ Autenticación con Google OAuth
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
- **Autenticación**: NextAuth.js con Google OAuth
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

Copia el archivo `env.example` a `.env.local` y configura las variables:

```bash
cp env.example .env.local
```

Edita `.env.local` con tus valores:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/la_nube_coworking?schema=public"

# NextAuth.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

### 4. Configurar Google OAuth

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita la API de Google+
4. Ve a "Credenciales" y crea un ID de cliente OAuth 2.0
5. Agrega `http://localhost:3000/api/auth/callback/google` como URI de redirección
6. Copia el Client ID y Client Secret a tu archivo `.env.local`

### 5. Configurar la base de datos

1. Crea una base de datos PostgreSQL
2. Actualiza la `DATABASE_URL` en tu archivo `.env.local`
3. Ejecuta las migraciones:

```bash
npx prisma migrate dev
npx prisma generate
```

### 6. Ejecutar en desarrollo

```bash
npm run dev
```

Visita [http://localhost:3000](http://localhost:3000) para ver la aplicación.

## Deploy en Vercel

### 1. Preparar para producción

1. Configura las variables de entorno en Vercel:
   - `DATABASE_URL`
   - `NEXTAUTH_URL`
   - `NEXTAUTH_SECRET`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`

2. Actualiza la configuración de Google OAuth para incluir tu dominio de Vercel:
   - Agrega `https://tu-dominio.vercel.app/api/auth/callback/google`

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
