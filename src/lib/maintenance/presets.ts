import type { MaintenanceInput } from "@/lib/schemas/maintenance";

/**
 * Atajos del formulario de mantenimiento (milestone 22): los dos casos que se repiten, con
 * el texto ya redactado. Se pueden editar antes de guardar; no son tipos ni plantillas
 * guardadas, solo valores iniciales.
 */
export type MaintenancePreset = {
  id: string;
  label: string;
  description: string;
  values: Pick<MaintenanceInput, "title" | "reasonMd" | "mode" | "areas">;
};

export const MAINTENANCE_PRESETS: readonly MaintenancePreset[] = [
  {
    id: "migration",
    label: "Migración o respaldo (solo lectura)",
    description:
      "Todo el sitio en solo lectura: se puede consultar todo, no se puede crear ni modificar nada.",
    values: {
      title: "Migración de servidor",
      mode: "READ_ONLY",
      areas: ["all"],
      reasonMd:
        "Estamos migrando La Nube a un servidor nuevo. Mientras dure el proceso podés **consultar toda tu información**, pero no se pueden crear ni modificar reservas, eventos, noticias ni los datos de tu cuenta.\n\nVolvemos a la normalidad en cuanto termine.",
    },
  },
  {
    id: "mail-down",
    label: "Correo fuera de servicio",
    description:
      "Apaga el registro, la recuperación de contraseña y los correos de eventos. El resto sigue andando.",
    values: {
      title: "Correo electrónico fuera de servicio",
      mode: "UNAVAILABLE",
      areas: ["signup", "password-recovery", "event-emails"],
      reasonMd:
        "Nuestro servidor de correo no está funcionando. Por eso, **por ahora no se puede crear una cuenta ni recuperar la contraseña**, y los participantes de eventos **no reciben correos** (inscripción, decisiones o cambios de sesiones).\n\nLos cambios de un evento se ven igual en su página y en las notificaciones dentro de La Nube. El resto de las funciones anda con normalidad.",
    },
  },
];
