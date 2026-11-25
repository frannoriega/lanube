# Estado de los milestones (atajo)

Una tabla para saber **en qué está cada milestone sin leerlo ni mirar el código**. El detalle de
cada uno está en su doc y en [`README.md`](./README.md). **Se actualiza en la misma sesión en que
cambia el estado de un milestone** (o se crea uno).

| Estado     | Significa                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `seed`     | en discusión: idea o diseño a medias, nada para implementar todavía                                                                  |
| `promoted` | listo para implementar: diseño acordado                                                                                              |
| `done`     | implementado                                                                                                                         |
| `parked`   | en pausa por decisión del usuario; se puede retomar                                                                                  |
| `dropped`  | cancelado. **Lleva el motivo** (columna «Nota» y, si es una idea descartada, una entrada en [`../rejected/`](../rejected/README.md)) |

Última revisión: 2026-11-25.

| #   | Milestone                                 | Estado   | Nota                                                         |
| --- | ----------------------------------------- | -------- | ------------------------------------------------------------ |
| 1   | Navegación de reservas del admin          | done     |                                                              |
| 2   | Auditoría                                 | done     |                                                              |
| 3   | Temas estacionales de la landing          | done     | v2 (acentos, cinta) abierto en `OPEN_QUESTIONS.md`           |
| 4   | Noticias                                  | done     |                                                              |
| 5   | Cancelar recurrentes (alcance)            | done     |                                                              |
| 6   | Equipos y organizaciones                  | seed     | solo planificación; se discute junto con el 36               |
| 7   | Propuestas                                | seed     | el 37 la absorbe o la reemplaza: decidirlo al discutirlos    |
| 8   | Inventario y órdenes de compra            | seed     | solo planificación                                           |
| 9   | Roles dinámicos                           | done     | caché de Global Config quedó como seam                       |
| 10  | Auditoría de frontend                     | done     |                                                              |
| 11  | Navegación y consistencia de UI           | done     |                                                              |
| 12  | Auditoría de dominio                      | done     |                                                              |
| 13  | Notificaciones                            | done     |                                                              |
| 14  | Rediseño mobile                           | done     |                                                              |
| 15  | Rediseño de noticias                      | done     |                                                              |
| 16  | Registro de auditoría y listas            | done     |                                                              |
| 17  | Ajustes de cuenta y passkeys              | done     |                                                              |
| 18  | Experimento de marca pública              | done     | solo en la rama `experimental`, sin mergear                  |
| 19  | Políticas y aceptación                    | done     |                                                              |
| 20  | Conector MCP                              | done     | falta probar con Claude web/ChatGPT contra un deploy público |
| 21  | Gestión por MCP                           | done     |                                                              |
| 22  | Modo mantenimiento                        | done     |                                                              |
| 23  | Días cerrados                             | done     | el README dice «sin implementar» pero está en el código      |
| 24  | Áreas comunes                             | done     |                                                              |
| 25  | Rendimiento y seguridad                   | done     |                                                              |
| 26  | Horario de reserva                        | done     |                                                              |
| 27  | Historial de «Mis reservas»               | promoted | planificado, no implementado                                 |
| 28  | Versionado y verificación de build        | done     |                                                              |
| 29  | Arreglos de UI (eventos, enums, usuarios) | done     |                                                              |
| 30  | Check-in de eventos                       | done     |                                                              |
| 31  | Reportes de eventos                       | done     |                                                              |
| 32  | Calendario de actividades y exportación   | done     |                                                              |
| 33  | Eventos en varios espacios                | parked   | postergado por el usuario                                    |
| 34  | Campo «Participante» y check-in grupal    | promoted | retomado con diseño del usuario; v1.2.0                      |
| 35  | Título de reserva y UI más calma          | done     | v1.1.0                                                       |
| 36  | Amistades, directorio e invitados         | seed     | idea del usuario; con el 6                                   |
| 37  | Plataforma de ideas con votación          | seed     | idea del usuario; depende del 36                             |
| 38  | Instrumentación (métricas, trazas, logs)  | seed     | diseño propuesto; esperan decisiones (RAM del VPS, acceso)   |
| 39  | BI y rutas calientes                      | seed     | diseño propuesto; la capa 2 usa el Grafana del 38            |
| 40  | Arreglos de la v1.2.0                     | promoted | temas, auth, reportes, reprogramar, notificaciones; v1.2.0   |
| 41  | SEO y vista previa al compartir           | promoted | Open Graph, meta descripción, sitemap; v1.2.0                |
| 42  | Reservar más allá de dos semanas          | promoted | permiso nuevo, ventana de un año; v1.2.0                     |
| 43  | Eventos privados e invitados              | promoted | lista opcional que restringe; v1.2.0                         |
| 44  | Motivo por sesión                         | promoted | un correo por participante sigue igual; v1.2.0               |
| 45  | Exportar el calendario (ICS)              | seed     | idea futura del usuario                                      |
| 46  | Notificaciones por WhatsApp               | seed     | idea futura del usuario; depende de Meta Business            |

## Ideas descartadas (`dropped`)

Ninguna todavía. Cuando un milestone o una idea se cancele: pasarlo a `dropped` acá **con el motivo**
y, si es una idea que alguien podría volver a proponer, agregar una entrada en
[`../rejected/`](../rejected/README.md) (qué se propuso, por qué tentaba, por qué no).

Decisiones de producto menores que se tomaron «en contra» de algo existente viven en el doc del
milestone donde se decidieron (p. ej. el tipo de reserva sacado del formulario, en el 35).
