import UserProvider, { type CurrentUser } from "@/components/providers/user";
import ManagementLayout from "@/components/templates/management";
import { auth } from "@/lib/auth";
import { getPermissionSetForUser } from "@/lib/db/roles";
import { getRegisteredUserById } from "@/lib/db/users";
import { serializeJson } from "@/lib/json-bigint";
import { isAdminRole } from "@/lib/rbac";
import { type RegisteredUser } from "@/types/prisma";
import { ThemeProvider } from "next-themes";
import { redirect } from "next/navigation";
import { redirectIfPoliciesPending } from "@/lib/policies/page-gate";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await auth();
  if (!session?.userId) {
    redirect("/auth/signin");
  }
  // Políticas pendientes → pantalla de aceptación (milestone 19; ver page-gate.ts).
  await redirectIfPoliciesPending(session);
  const registeredUser = await getRegisteredUserById(session.userId);
  if (!registeredUser) {
    redirect("/auth/signup");
  }
  // Resolve permissions from the DB (not the JWT) so a demotion — or an edit to the
  // role itself — applies immediately rather than on the session's next refresh.
  const resolved = await getPermissionSetForUser(registeredUser.id);
  if (!isAdminRole(resolved?.permissions)) {
    redirect("/user/dashboard");
  }
  // serializeJson turns BigInt timestamps into numbers, matching the client type
  const user: CurrentUser = {
    ...(serializeJson(registeredUser) as unknown as RegisteredUser),
    role: resolved?.role?.name ?? null,
    isSuperadmin: resolved?.permissions.isSuperadmin ?? false,
    permissions: [...(resolved?.permissions.permissions ?? [])],
  };
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="la-nube-theme"
    >
      <UserProvider user={user}>
        <ManagementLayout userType="admin">{children}</ManagementLayout>
      </UserProvider>
    </ThemeProvider>
  );
}
