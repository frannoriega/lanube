# Prisma Schema Organization

This document explains how the Prisma schema is organized for better maintainability and readability.

## 📁 Structure

```
prisma/
├── schema.prisma              # Main config (generator + datasource)
├── models/                    # All model definitions
│   ├── enums.prisma          # All enums
│   ├── auth.prisma           # Authentication & users
│   ├── bans.prisma           # Ban management
│   ├── events.prisma         # Events management
│   ├── incidents.prisma      # Incidents management
│   ├── inventory.prisma      # Inventory & purchase orders
│   ├── organizations.prisma  # Organizations & teams
│   ├── proposals.prisma      # Proposals & comments
│   ├── reservations.prisma   # Reservations & check-ins
│   └── resources.prisma      # Resource management
├── migrations/               # Database migrations
└── seed.ts                   # Seed data
```

## 📄 File Descriptions

### Main Config (`schema.prisma`)

- Generator configuration
- Datasource configuration
- **Note**: No model definitions here - all in `models/` directory

### Model Files

#### `enums.prisma`

All enum types used across the application:

- `UserRole`
- `IncidentStatus`
- `OrderStatus`
- `ProposalStatus`
- `ReservableType`
- `EventType`
- `ReservationStatus`
- `ResourceType`

#### `auth.prisma`

Authentication and user management:

- `Account` - OAuth accounts
- `Session` - User sessions
- `User` - Base user (NextAuth)
- `RegisteredUser` - Extended user profile
- `VerificationToken` - Email verification

#### `bans.prisma`

User ban management:

- `Ban` - User bans with time ranges

#### `events.prisma`

Event management:

- `Event` - Events/activities
- `UserEvent` - User-event relationships

#### `incidents.prisma`

Incident tracking:

- `Incident` - Incident reports
- `IncidentUser` - User-incident relationships

#### `inventory.prisma`

Inventory management:

- `Inventory` - Inventory items
- `PurchaseOrder` - Purchase requests

#### `organizations.prisma`

Organization and team structure:

- `Organization` - Organizations
- `OrgMembership` - Organization memberships
- `Team` - Teams within organizations
- `TeamMember` - Team memberships

#### `proposals.prisma`

Proposal system:

- `Proposal` - Community proposals
- `ProposalComment` - Comments on proposals
- `ProposalLike` - Proposal likes
- `ProposalCommentLike` - Comment likes

#### `reservations.prisma`

Reservation system (core functionality):

- `Reservation` - Resource reservations
- `ReservationException` - Recurring reservation exceptions
- `CheckIn` - User check-ins

#### `resources.prisma`

Resource management:

- `FungibleResource` - Resource types (Meeting, Coworking, etc.)
- `Resource` - Individual resource instances

## 🔧 How It Works

### Automatic Loading

The `prisma.config.ts` has:

```typescript
schema: "prisma";
```

This tells Prisma to load **all `.prisma` files** from the `prisma/` directory, including subdirectories.

### Commands

All Prisma commands work the same:

```bash
# Format all schema files
npx prisma format

# Generate Prisma Client
npx prisma generate

# Create migration
npx prisma migrate dev --name your_migration_name

# Push schema changes
npx prisma db push

# Open Prisma Studio
npx prisma studio
```

## ✅ Benefits

### 1. **Better Organization**

- Related models grouped together
- Easy to find specific models
- Clear separation of concerns

### 2. **Easier Maintenance**

- Smaller files are easier to read
- Changes isolated to specific domains
- Less merge conflicts in teams

### 3. **Better Navigation**

- Jump to specific domain quickly
- IDE/editor shows file structure
- Logical grouping aids understanding

### 4. **Scalability**

- Easy to add new domains
- Can split large files further if needed
- Clear pattern to follow

## 📝 Adding New Models

### 1. Choose the Right File

- Authentication/users → `auth.prisma`
- New business domain → Create new file

### 2. Create New File (if needed)

```prisma
// prisma/models/your-domain.prisma

model YourModel {
  id        String   @id @default(cuid())
  // ... fields

  @@map("your_table")
}
```

### 3. Enums Go in `enums.prisma`

```prisma
enum YourEnum {
  VALUE1
  VALUE2

  @@map("your_enum")
}
```

### 4. Run Prisma Commands

```bash
npx prisma format
npx prisma generate
```

## 🔗 Relationships Across Files

Models can reference each other across files:

```prisma
// In reservations.prisma
model Reservation {
  registeredUser RegisteredUser? @relation(...)
  //             ↑ defined in auth.prisma
}
```

Prisma automatically resolves references across all files.

## 🚨 Important Notes

1. **Generator/Datasource**: Only in `schema.prisma` (once)
2. **Enums**: All in `enums.prisma` for easy reference
3. **No Imports**: Prisma auto-loads files, no import needed
4. **Formatting**: `npx prisma format` formats all files

## 📊 Model Count by File

- `auth.prisma`: 5 models
- `bans.prisma`: 1 model
- `events.prisma`: 2 models
- `incidents.prisma`: 2 models
- `inventory.prisma`: 2 models
- `organizations.prisma`: 4 models
- `proposals.prisma`: 4 models
- `reservations.prisma`: 3 models
- `resources.prisma`: 2 models
- `enums.prisma`: 8 enums

**Total**: 25 models + 8 enums

## 🎯 Summary

The schema is now organized into **logical domain files** instead of one monolithic file. This makes it:

- ✅ Easier to find models
- ✅ Easier to maintain
- ✅ Better for collaboration
- ✅ Scales with growth

All Prisma commands work exactly the same - the organization is transparent to Prisma tools!
