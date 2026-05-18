# Semilla de Base de Datos La Nube

Este archivo de semilla crea datos de muestra para el sistema de gestión de coworking La Nube.

## Cuenta de Administrador

**Nota**: La cuenta de administrador se creará automáticamente cuando inicies sesión por primera vez con:

- **Email**: frannoriega.92@gmail.com
- **Name**: Francisco Noriega (se obtiene de Google)
- **Role**: Se asignará como ADMIN automáticamente

## Datos de Muestra Creados

### 👥 Usuarios (5 usuarios de muestra)

- María González - Universidad Nacional (working on AI thesis)
- Carlos Rodríguez - StartupTech (fintech development)
- Ana Martínez - Freelancer (designer)
- José Silva - Laboratorio de Investigación (biotech researcher)
- Lucía Fernández - Comunidad Tech (event organizer)

### 📅 Reservas (8 reservas)

- **Coworking**: 3 reservations (approved, pending, approved)
- **Laboratory**: 2 reservations (approved, pending)
- **Auditorium**: 2 reservations (approved, rejected)

### 🚪 Ingresos (5 ingresos)

- 3 completed check-ins with check-out times
- 2 active check-ins (currently in La Nube)

### ⚠️ Incidentes (3 incidentes)

- AC problem (OPEN status)
- Lab equipment issue (RESOLVED)
- Audio system problem (CLOSED)

### 🔗 Relaciones Incidente-Usuario

- Automatic linking of users present during incidents
- Based on check-in times and incident timestamps

## Ejecutar la Semilla

```bash
# Ejecutar la semilla (requiere base de datos existente)
npm run db:seed

# Reiniciar base de datos y semilla (ADVERTENCIA: elimina todos los datos)
npm run db:reset
```

## Notas

- All sample data uses realistic Spanish names and institutions
- Reservations span different time periods for testing
- Check-ins include both completed and active sessions
- Incidents demonstrate the full workflow (open → resolved → closed)
- Admin account can be used to test all admin features immediately

## Probar el Sistema

1. **Iniciar sesión como admin**: Usar frannoriega.92@gmail.com
2. **Probar funciones de usuario**: Iniciar sesión con cualquier email de usuario de muestra
3. **Revisar panel de admin**: Ver reservas, ingresos e incidentes
4. **Probar flujos de trabajo**: Aprobar/rechazar reservas, gestionar incidentes

Los datos de semilla proporcionan un entorno de prueba completo para todas las funciones del sistema.
