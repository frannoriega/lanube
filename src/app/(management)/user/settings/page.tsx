import { redirect } from "next/navigation";

/** `/user/settings` no tiene contenido propio: abre la primera sección. */
export default function SettingsIndexPage() {
  redirect("/user/settings/profile");
}
