"use client";

import Logo from "@/components/atoms/logos/lanube";
import { ThemeToggle } from "@/components/molecules/theme";
import UserProfile from "@/components/molecules/user-profile";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import useUser from "@/hooks/use-user";
import { getSpaceIcon } from "@/lib/constants/spaces";
import { hasPermission, isAdminRole } from "@/lib/rbac";
import {
  BarChart3,
  Building2,
  Calendar,
  CalendarDays,
  ChevronDown,
  FileText,
  Contact,
  LayoutDashboard,
  LucideProps,
  Menu,
  Settings,
  Shield,
  Tags,
  User,
  Users,
  Wrench,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ForwardRefExoticComponent,
  RefAttributes,
  useMemo,
  useState,
} from "react";

/** A reservable space's sidebar link, resolved from the DB (icon by name) so slugs always match. */
export interface SpaceNavItem {
  name: string;
  href: string;
  iconName: string | null;
}

interface ManagementLayoutProps {
  children: React.ReactNode;
  userType: "user" | "admin";
  /** DB-driven space links for the user sidebar (ignored for admin). */
  spaceNav?: SpaceNavItem[];
}

interface NavigationItem {
  name: string;
  href?: string;
  icon: ForwardRefExoticComponent<
    Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>
  >;
  children?: NavigationItem[];
}

const navigation: Record<"user" | "admin", NavigationItem[]> = {
  // Fixed user items. Space links are inserted between these two from the DB (see navItems),
  // so a superadmin renaming/adding a space is reflected without touching this file.
  user: [
    {
      name: "Panel de control",
      href: "/user/dashboard",
      icon: LayoutDashboard,
    },
    {
      name: "Mis eventos",
      href: "/user/events",
      icon: CalendarDays,
    },
  ],
  admin: [
    { name: "Panel", href: "/admin/dashboard", icon: LayoutDashboard },
    { name: "Usuarios", href: "/admin/users", icon: Users },
    { name: "Reservas", href: "/admin/reservations", icon: Calendar },
    { name: "Eventos", href: "/admin/events", icon: CalendarDays },
    { name: "Formularios", href: "/admin/forms", icon: FileText },
    { name: "Reportes", href: "/admin/reports", icon: BarChart3 },
  ],
};

/** Superadmin-only configuration section (requires the *:manage config permissions). */
const configNavigation: NavigationItem = {
  name: "Configuración",
  icon: Settings,
  children: [
    { name: "Espacios", href: "/admin/spaces", icon: Building2 },
    { name: "Recursos", href: "/admin/resources", icon: Wrench },
    { name: "Tipos de reserva", href: "/admin/reservation-types", icon: Tags },
    { name: "Contacto", href: "/admin/site", icon: Contact },
  ],
};

export default function ManagementLayout({
  children,
  userType,
  spaceNav = [],
}: ManagementLayoutProps) {
  const user = useUser();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Groups whose child is the current page start expanded.
  const [expandedItems, setExpandedItems] = useState<string[]>(() =>
    configNavigation.children?.some((c) => c.href && pathname === c.href)
      ? [configNavigation.name]
      : [],
  );
  const toggleExpanded = (itemName: string) => {
    setExpandedItems((prev) =>
      prev.includes(itemName)
        ? prev.filter((item) => item !== itemName)
        : [...prev, itemName],
    );
  };
  const isActive = (href?: string) => {
    if (!href) return false;
    if (pathname === href) return true;
    if (
      href === "/admin/reservations" &&
      pathname.startsWith("/admin/reservations")
    )
      return true;
    return false;
  };

  const hasActiveChild = (children: NavigationItem[]) => {
    return children.some((child) => isActive(child.href));
  };

  const recursiveRender = (item: NavigationItem) => {
    if (item.children) {
      const Icon = item.icon;
      const isExpanded = expandedItems.includes(item.name);
      const hasActive = hasActiveChild(item.children);

      return (
        <div key={item.name}>
          <button
            onClick={() => toggleExpanded(item.name)}
            className={`group flex w-full items-center rounded-md px-2 py-2 text-sm font-medium ${
              hasActive && !item.children
                ? "bg-la-nube-primary text-white"
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <Icon className="mr-3 h-5 w-5" />
            {item.name}
            <ChevronDown
              className={`ml-auto h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            />
          </button>
          {isExpanded && (
            <div className="ml-6 space-y-1">
              {item.children.map((child) => {
                return recursiveRender(child);
              })}
            </div>
          )}
        </div>
      );
    } else {
      const Icon = item.icon;
      if (item.href) {
        return (
          <Link
            key={item.name}
            href={item.href}
            className={`group flex items-center rounded-md px-2 py-2 text-sm font-medium ${
              isActive(item.href)
                ? "bg-(--sidebar-selected) text-white"
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
            }`}
            onClick={() => setSidebarOpen(false)}
          >
            <Icon className="mr-3 h-5 w-5" />
            {item.name}
          </Link>
        );
      } else {
        return (
          <div key={item.name}>
            <Icon className="mr-3 h-5 w-5" />
            {item.name}
          </div>
        );
      }
    }
  };

  const navItems = useMemo(() => {
    if (userType !== "admin") {
      const spaceItems: NavigationItem[] = spaceNav.map((s) => ({
        name: s.name,
        href: s.href,
        icon: getSpaceIcon(s.iconName ?? ""),
      }));
      // Panel de control · reservable spaces (from DB) · Mis eventos.
      const [panel, ...tail] = navigation.user;
      return [panel, ...spaceItems, ...tail];
    }
    const canConfigure = hasPermission(user?.role, "spaces:manage");
    return canConfigure
      ? [...navigation.admin, configNavigation]
      : navigation.admin;
  }, [userType, user?.role, spaceNav]);

  if (!user) {
    return <ManagementLayoutSkeleton />;
  }

  return (
    <div>
      <div className={`min-h-screen bg-slate-100 dark:bg-slate-800`}>
        {/* Mobile sidebar */}
        <div
          className={`fixed inset-0 z-50 lg:hidden print:hidden ${sidebarOpen ? "block" : "hidden"}`}
        >
          <div
            className="fixed inset-0 bg-gray-600 bg-opacity-75"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 flex w-64 flex-col glass-sidebar dark:glass-sidebar-dark shadow-xl">
            <div className="flex h-16 items-center justify-between px-4">
              <div className="flex items-center space-x-2">
                <Logo />
                {/* <div className="h-8 w-8 rounded-full bg-la-nube-primary flex items-center justify-center">
                  <span className="text-sm">🌩️</span>
                </div>
                <span className="text-xl font-bold text-la-nube-primary">La Nube</span> */}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(false)}
                aria-label="Cerrar menu"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="flex-1 space-y-1 px-2 py-4">
              {navItems.map((item) => {
                return recursiveRender(item);
              })}
            </nav>
          </div>
        </div>

        {/* Desktop sidebar */}
        <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col print:hidden">
          <div className="flex min-h-0 flex-1 flex-col glass-sidebar dark:glass-sidebar-dark shadow">
            <div className="flex h-16 items-center px-4">
              <div className="flex items-center space-x-2">
                <Logo />
                {/* <div className="h-8 w-8 rounded-full bg-la-nube-primary flex items-center justify-center">
                  <span className="text-sm">🌩️</span>
                </div>
                <span className="text-xl font-bold text-la-nube-primary">La Nube</span> */}
              </div>
            </div>
            <nav className="flex-1 space-y-1 px-2 py-4">
              {navItems.map((item) => {
                return recursiveRender(item);
              })}
            </nav>
          </div>
        </div>

        {/* Main content */}
        <div className="lg:pl-64 print:pl-0">
          {/* Header */}
          <div className="sticky top-0 z-100 flex h-16 shrink-0 items-center gap-x-4 glass-header dark:glass-header-dark px-4 sm:gap-x-6 sm:px-6 lg:px-8 print:hidden">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
              <div className="flex flex-1" />
              <div className="flex items-center gap-x-4 lg:gap-x-6">
                {isAdminRole(user.role) && (
                  <nav
                    aria-label="Cambiar de vista"
                    className="flex items-center gap-0.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-slate-900/60 p-0.5 text-sm font-medium"
                  >
                    <Link
                      href="/user/dashboard"
                      aria-current={userType === "user" ? "page" : undefined}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors ${
                        userType === "user"
                          ? "bg-la-nube-primary text-white shadow-sm"
                          : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                      }`}
                    >
                      <User className="h-4 w-4" />
                      <span className="hidden sm:inline">Usuario</span>
                    </Link>
                    <Link
                      href="/admin/dashboard"
                      aria-current={userType === "admin" ? "page" : undefined}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors ${
                        userType === "admin"
                          ? "bg-la-nube-primary text-white shadow-sm"
                          : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                      }`}
                    >
                      <Shield className="h-4 w-4" />
                      <span className="hidden sm:inline">Administración</span>
                    </Link>
                  </nav>
                )}
                {/* Theme toggle */}
                <div className="flex items-center gap-x-2">
                  <ThemeToggle />
                </div>

                {/* User menu */}
                <UserProfile />
              </div>
            </div>
          </div>

          {/* Page content */}
          <main className="py-6">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
      <Toaster />
    </div>
  );
}

export function ManagementLayoutSkeleton() {
  return (
    <div>
      <div className={`min-h-screen bg-slate-100 dark:bg-slate-800`}>
        {/* Desktop sidebar skeleton */}
        <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
          <div className="flex min-h-0 flex-1 flex-col glass-sidebar dark:glass-sidebar-dark shadow">
            <div className="flex h-16 items-center px-4">
              <div className="h-8 w-8 rounded bg-gray-300 dark:bg-gray-600 animate-pulse" />
            </div>
            <nav className="flex-1 space-y-1 px-2 py-4">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-10 rounded-md bg-gray-300 dark:bg-gray-600 animate-pulse"
                  style={{ animationDelay: `${i * 100}ms` }}
                />
              ))}
            </nav>
          </div>
        </div>

        {/* Main content skeleton */}
        <div className="lg:pl-64">
          {/* Header skeleton */}
          <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 glass-header dark:glass-header-dark px-4 sm:gap-x-6 sm:px-6 lg:px-8">
            <div className="h-8 w-8 rounded bg-gray-300 dark:bg-gray-600 animate-pulse lg:hidden" />
            <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
              <div className="flex flex-1" />
              <div className="flex items-center gap-x-4 lg:gap-x-6">
                <div className="h-6 w-6 rounded-full bg-gray-300 dark:bg-gray-600 animate-pulse" />
                <div className="h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-600 animate-pulse" />
              </div>
            </div>
          </div>

          {/* Page content skeleton */}
          <main className="py-6">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="space-y-6">
                {/* Title skeleton */}
                <div className="h-8 w-64 rounded bg-gray-300 dark:bg-gray-600 animate-pulse" />

                {/* Content cards skeleton */}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className="h-32 rounded-lg bg-gray-300 dark:bg-gray-600 animate-pulse"
                      style={{ animationDelay: `${i * 100}ms` }}
                    />
                  ))}
                </div>

                {/* Table/List skeleton */}
                <div className="space-y-3">
                  <div className="h-12 w-full rounded bg-gray-300 dark:bg-gray-600 animate-pulse" />
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="h-16 w-full rounded bg-gray-300 dark:bg-gray-600 animate-pulse"
                      style={{ animationDelay: `${(i + 6) * 100}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
