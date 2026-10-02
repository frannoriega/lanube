"use client";

import { FormSection } from "@/components/molecules/form-layout";
import { LoadError } from "@/components/molecules/load-error";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserProfile } from "@/hooks/api";
import { NO_ROLE_LABEL } from "@/lib/rbac";
import { formatDate } from "@/lib/utils/date";

/**
 * Configuración → Cuenta: datos fijos de la cuenta, de solo lectura. No hay nada para
 * editar acá: el email es el usuario con el que se entra, y el rol lo asigna el equipo.
 */
export default function AccountSettingsPage() {
  const { data: user, error, firstTime, refetch } = useUserProfile();

  if (error && !user) {
    return (
      <LoadError
        message="No pudimos cargar tu cuenta."
        onRetry={() => void refetch()}
      />
    );
  }
  if (firstTime || !user) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }

  const items: { label: string; value: string; hint?: string }[] = [
    {
      label: "Email",
      value: user.displayEmail ?? user.email,
      hint: "Es tu usuario para entrar, así que no se puede cambiar.",
    },
    {
      label: "Rol",
      value: user.role ?? NO_ROLE_LABEL,
      hint: "Lo asigna el equipo de La Nube.",
    },
    {
      label: "Miembro desde",
      value: formatDate(new Date(user.createdAt)),
    },
  ];

  return (
    <FormSection
      title="Datos de la cuenta"
      description="Información fija de tu cuenta."
    >
      <dl className="divide-y rounded-lg border">
        {items.map((item) => (
          <div
            key={item.label}
            className="grid gap-1 p-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4"
          >
            <dt className="text-sm font-medium text-muted-foreground">
              {item.label}
            </dt>
            <dd className="min-w-0 space-y-0.5">
              <span className="block break-words">{item.value}</span>
              {item.hint ? (
                <span className="block text-xs text-muted-foreground">
                  {item.hint}
                </span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </FormSection>
  );
}
