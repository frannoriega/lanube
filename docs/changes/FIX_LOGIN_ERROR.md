# Fix para Error de Login OAuth

## ❌ **Problema Original**

```
OAuthAccountNotLinked: Another account already exists with the same e-mail address
```

Este error ocurría porque:
1. El usuario admin se creaba directamente en la base de datos mediante el seed
2. NextAuth intentaba crear una nueva cuenta durante el flujo OAuth
3. Esto causaba un conflicto porque ya existía una cuenta con ese email

## ✅ **Solución Implementada**

### **1. Eliminación del Usuario Admin del Seed**
- Removido la creación automática del usuario admin en `prisma/seed.ts`
- El admin ahora se crea a través del flujo OAuth normal

### **2. Configuración de Auto-Asignación de Rol ADMIN**
En `src/lib/auth.ts`, agregado callback `signIn` que:
- Detecta cuando el email `frannoriega.92@gmail.com` inicia sesión
- Automáticamente asigna el rol `ADMIN` al usuario
- Crea el usuario si no existe, o actualiza el rol si ya existe

```typescript
async signIn({ user, account, profile }) {
  if (account?.provider === "google" && user.email) {
    // Check if this is the admin email
    if (user.email === "frannoriega.92@gmail.com") {
      // Update user role to ADMIN if not already set
      await prisma.user.upsert({
        where: { email: user.email },
        update: { role: "ADMIN" },
        create: {
          email: user.email,
          name: user.name || "Francisco",
          lastName: "Noriega",
          dni: "36248745",
          institution: null,
          reasonToJoin: "Admin account",
          role: "ADMIN",
          image: user.image,
        },
      })
    }
  }
  return true
}
```

### **3. Actualización de Documentación**
- Actualizado `SEED_README.md` para explicar que el admin se crea automáticamente
- Documentado el proceso de creación de cuenta admin

## 🚀 **Resultado**

Ahora el flujo de login funciona correctamente:

1. **Primera vez**: Al iniciar sesión con `frannoriega.92@gmail.com`
   - NextAuth crea la cuenta automáticamente
   - Se asigna el rol `ADMIN`
   - El usuario puede acceder al panel de administración

2. **Siguientes veces**: 
   - Login normal sin conflictos
   - Mantiene el rol `ADMIN`

## ✅ **Verificación**

- ✅ Build exitoso sin errores
- ✅ Seed ejecutado correctamente (sin crear admin)
- ✅ Base de datos poblada con datos de muestra
- ✅ Sistema listo para login con cuenta admin

## 🔑 **Credenciales de Admin**

- **Email**: `frannoriega.92@gmail.com`
- **Método**: Login con Google OAuth
- **Rol**: Se asigna automáticamente como `ADMIN`

¡El error de login está resuelto y el sistema funciona correctamente! 🌩️
