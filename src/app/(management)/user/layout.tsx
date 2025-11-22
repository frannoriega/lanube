import UserProvider from "@/components/providers/user";
import ManagementLayout from "@/components/templates/management";
import { auth } from "@/lib/auth";
import {
  Building2,
  FlaskConical,
  LayoutDashboard,
  Presentation,
  Users,
} from "lucide-react";
import { ThemeProvider } from "next-themes";
import { redirect } from "next/navigation";

interface UserLayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: "Panel de control", href: "/user/dashboard", icon: LayoutDashboard },
  { name: "Coworking", href: "/user/coworking", icon: Building2 },
  { name: "Laboratorio", href: "/user/lab", icon: FlaskConical },
  { name: "Auditorio", href: "/user/auditorium", icon: Presentation },
  { name: "Sala de reuniones", href: "/user/meeting-room", icon: Users },
];

export default async function UserLayout({ children }: UserLayoutProps) {
  const session = await auth();
  if (!session?.userId) {
    redirect("/auth/signin");
  }
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="la-nube-theme"
    >
      <UserProvider userId={session.userId}>
        <ManagementLayout userType="user">{children}</ManagementLayout>
      </UserProvider>
    </ThemeProvider>
  );
}
