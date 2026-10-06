# Milestone 24 — Áreas comunes («amenities»)

**Estado:** implementado (2026-10-07) en la rama `milestone-24` (desde `preview`), sin commitear
al escribir este doc. Numeración: el 22 se trabaja en otra rama y existe una rama `milestone-23`
ajena a este trabajo; el usuario pidió este como 24.

## Pedido

Hoy la landing y `/spaces` muestran todos los `Space`. El usuario quería sumar lugares que **no se
reservan ni tienen capacidad** (cocina, jardín, living): «más que espacios, amenities». Debían:

- mostrarse como una sección aparte (opcional) en la landing y en `/spaces`;
- admitir preguntas frecuentes como los espacios;
- permitir **«sin capacidad»**.

Decisiones del usuario sobre la propuesta: nombre público **«Amenities»**; capacidad opcional
(si se carga, se muestra; si no, nada); **fotos** (mismas tarjetas-foto que los espacios).

## Diseño

### Un solo modelo, con `kind`

Se descartó un modelo aparte: una amenity necesita lo mismo que un espacio (nombre, slug, texto
corto y markdown, imagen, ícono, chips de equipamiento, FAQs, orden, CRUD del panel, reordenar,
auditoría, anclas `/spaces#<slug>`). Duplicarlo o abstraerlo costaba más que una columna.

El riesgo de la tabla única es que una amenity se cuele donde se asume "lugar reservable". Se
cierra en tres capas (ver abajo).

```prisma
enum SpaceKind { SPACE  AMENITY }          // @@map("space_kinds")
model Space {
  kind     SpaceKind @default(SPACE)
  capacity Int?      @default(1)           // null = sin capacidad (solo AMENITY)
  @@index([kind, displayOrder])
}
```

Migración `20261007100000_space_kind`: las filas existentes quedan `SPACE` (default), sin backfill.

### Capacidad opcional

`capacity` pasa a nullable. Es seguro para las funciones SQL de reservas porque
`create_reservation()` ya rechazaba un espacio con `cap IS NULL`; y una amenity nunca tiene
reservas ni eventos. En TypeScript el tipo `number | null` se propagó a
`ReservationWithRelations`, `ApprovalConflicts`, `resolveCapacity` (participantes) y la vista de
inscriptos (`?? 0`): esos lugares solo ven espacios reales, así que `null` ahí no ocurre.

### Reglas que se hacen cumplir en la base

Hay varios caminos de escritura (web, panel, conector MCP): ninguno debe poder saltearlas.

| Regla                                                                           | Cómo                                                                                       |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Un `SPACE` siempre tiene capacidad; una `AMENITY` no es reservable ni exclusiva | `CHECK spaces_kind_invariants`                                                             |
| Una `AMENITY` no puede tener reservas ni eventos                                | triggers `reservations_reject_amenity`, `events_reject_amenity` (`reject_amenity_space()`) |
| Un espacio con reservas/eventos no puede pasar a `AMENITY`                      | trigger `spaces_reject_amenity_if_in_use`                                                  |

En la aplicación hay un mensaje claro antes de llegar al trigger: `getSpaceCapacity()` (eventos)
rechaza una amenity con `DomainError`, `requestUserReservation` ya rechazaba lo no reservable, y
`spaceInputSchema` (Zod) valida lo mismo con `superRefine`.

**El tipo no cambia al editar** (`updateSpace` ignora el `kind` que llegue y conserva el guardado):
pasar de espacio a amenity, con reservas, eventos y links por medio, es una migración de datos.
`toSpaceData` fuerza `isReservable=false`/`isExclusive=false` en una amenity.

### Consultas

| Función                 | Devuelve                     | Quién la usa                                  |
| ----------------------- | ---------------------------- | --------------------------------------------- |
| `getPublicSpaces()`     | todo (espacios + amenities)  | `/spaces`, listado admin                      |
| `getSpacesByKind(kind)` | un tipo, en orden del panel  | landing, `admin/events`, `admin/reservations` |
| `getPublicAmenities()`  | `getSpacesByKind("AMENITY")` | landing                                       |
| `getReservableSpaces()` | `isReservable && kind=SPACE` | menú de usuario, conector MCP (`list_spaces`) |

`src/lib/db/spaces-kind.test.ts` **falla si `getPublicSpaces` aparece en un archivo nuevo**: hay
que decidir si ese lugar debe mostrar también las amenities y, si sí, sumarlo a `ALLOWED` con el
motivo (mismo estilo que los tests de auditoría y de `requireActiveSession`).

### Sitio público

- **Landing:** «Nuestros espacios» filtra a `SPACE`; nueva sección **«Amenities»**
  (`templates/landing/amenities`) justo después, con la misma tarjeta-foto (`SpaceTile`, ahora
  exportada; sin chip si no hay capacidad, enlace «Conocer más»). Devuelve `null` si no hay
  amenities: no deja franja vacía ni rompe la alternancia de fondos (`LANDING_SECTION_BG`).
- **`/spaces`:** una consulta y dos bloques; el segundo (`id="amenities"`) con su
  `SectionHeading`. Reusa `SpaceSection` (foto, markdown, FAQs); el chip de capacidad solo si hay
  capacidad y el botón «Reservar» no aparece (no son reservables). Las anclas `/spaces#<slug>`
  siguen igual.

### Panel

- `/admin/spaces`: pestañas **Espacios / Áreas comunes** sobre la misma tabla; cada pestaña tiene
  su botón de alta, su estado vacío y su **Reordenar** (el orden solo se compara dentro de un
  tipo; el loader de auditoría ordena por `kind` y luego `displayOrder`).
- `/admin/spaces/new?kind=amenity` crea una amenity; el tipo se decide ahí y no se cambia luego.
  El formulario de una amenity oculta el panel «Comportamiento» (reservable / exclusivo /
  destacado) y ofrece el switch **«Sin capacidad»**.
- Permiso, ruta y migas no cambian (`spaces:manage`, `/admin/spaces`).
- Auditoría: el campo `kind` se suma a `AUDIT_ENTITIES.Space` (etiquetas en `SPACE_KIND_LABELS`).

### Seed

`prisma/seed.ts` suma Cocina (sin capacidad), Jardín (20) y Living (10), sin foto: la sube el admin
y mientras tanto la landing muestra el panel con el ícono de marca.

## Fuera de alcance / decisiones

- **El conector MCP no expone amenities** (`list_spaces` sigue siendo solo reservables). Hacerlas
  una tool pública sin scope es una extensión posible, no se hizo sin que se pidiera.
- `Space.isFeatured` no lo lee ningún lugar del sitio (ya era así para los espacios); por eso una
  amenity no lo ofrece en el formulario.
- No hay interruptor manual para ocultar la sección: sin amenities, no se muestra.

## Notas para quien siga

- Tras el cambio de schema local: `npx prisma migrate deploy`, `npm run db:generate` y
  `docker restart lanube-app` (el servidor de desarrollo cachea el cliente viejo).
- `npm run db:seed` no carga `.env` por su cuenta con `tsx`: usar
  `npx tsx --env-file=.env prisma/seed.ts` si falla con «client password must be a string».

## Verificación

`tsc`, `eslint`, `prettier --check` y `vitest` (538 tests, incluidos los dos nuevos) en verde.
CHECK y los tres triggers probados a mano en Postgres (alta inválida, evento y reserva en una
amenity, espacio con reservas pasado a amenity). Landing y `/spaces` renderizan las tres amenities
del seed contra el contenedor local. **No** se revisó visualmente en navegador ni en móvil
(`scripts/mobile-shots.mjs` pendiente).
