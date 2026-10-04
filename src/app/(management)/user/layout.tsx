import UserProvider, { type CurrentUser } from "@/components/providers/user";
import ManagementLayout from "@/components/templates/management";
import { auth } from "@/lib/auth";
import { getPermissionSetForUser } from "@/lib/db/roles";
import { getReservableSpaces } from "@/lib/db/spaces";
import { getRegisteredUserById } from "@/lib/db/users";
import { serializeJson } from "@/lib/json-bigint";
import { type RegisteredUser } from "@/types/prisma";
import { ThemeProvider } from "next-themes";
import { redirect } from "next/navigation";
import { redirectIfPoliciesPending } from "@/lib/policies/page-gate";

interface UserLayoutProps {
  children: React.ReactNode;
}

export default async function UserLayout({ children }: UserLayoutProps) {
  const session = await auth();
  if (!session?.userId) {
    redirect("/auth/signin");
  }
  // Políticas pendientes → pantalla de aceptación (milestone 19; ver page-gate.ts).
  await redirectIfPoliciesPending(session);
  const [registeredUser, spaces] = await Promise.all([
    getRegisteredUserById(session.userId),
    getReservableSpaces(),
  ]);
  if (!registeredUser) {
    redirect("/auth/signup");
  }
  // serializeJson turns BigInt timestamps into numbers, matching the client type.
  // Permissions travel with the user so client components can gate on them directly.
  const resolved = await getPermissionSetForUser(registeredUser.id);
  const user: CurrentUser = {
    ...(serializeJson(registeredUser) as unknown as RegisteredUser),
    role: resolved?.role?.name ?? null,
    isSuperadmin: resolved?.permissions.isSuperadmin ?? false,
    permissions: [...(resolved?.permissions.permissions ?? [])],
  };
  // Build the sidebar's space links from the DB so slugs always match (the slug is
  // superadmin-editable). Only serializable fields are passed to the client layout.
  const spaceNav = spaces.map((s) => ({
    name: s.name,
    href: `/user/spaces/${s.slug}`,
    iconName: s.iconName,
  }));
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="la-nube-theme"
    >
      <UserProvider user={user}>
        <ManagementLayout userType="user" spaceNav={spaceNav}>
          {children}
        </ManagementLayout>
      </UserProvider>
    </ThemeProvider>
  );
}
