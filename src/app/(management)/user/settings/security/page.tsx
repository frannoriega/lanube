import { Check, LockKeyhole } from "lucide-react";

import { FormSection } from "@/components/molecules/form-layout";
import { PasskeysSection } from "@/components/organisms/settings/passkeys-section";
import { RecoveryCodesSection } from "@/components/organisms/settings/recovery-codes-section";

/**
 * Configuración → Seguridad (milestone 17): cómo entra el usuario a su cuenta.
 *
 * Dos métodos para entrar — contraseña (todas las cuentas la tienen) y passkeys
 * (opcionales, varias por cuenta) — más los códigos de recuperación. La contraseña se
 * muestra como estado, sin acciones: cambiarla desde acá quedó para más adelante (decisión
 * del usuario, ver el doc del milestone); hoy se cambia con "Olvidé mi contraseña".
 */
export default function SecuritySettingsPage() {
  return (
    <>
      <PasskeysSection />
      <FormSection
        title="Contraseña"
        description="Tu forma de entrar de respaldo, aunque pierdas tus passkeys."
      >
        <div className="flex items-start gap-3 rounded-lg border p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <LockKeyhole className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <p className="flex items-center gap-1.5 font-medium">
              Configurada
              <Check
                className="h-4 w-4 text-green-700 dark:text-green-400"
                aria-hidden
              />
            </p>
            <p className="text-sm text-muted-foreground">
              Para cambiarla, cerrá sesión y elegí «Olvidé mi contraseña» en la
              pantalla de ingreso: te mandamos un enlace a tu email. Si también
              perdiste el email, usá un código de recuperación.
            </p>
          </div>
        </div>
      </FormSection>
      <RecoveryCodesSection />
    </>
  );
}
