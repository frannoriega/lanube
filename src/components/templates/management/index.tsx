"use client";

import Logo from "@/components/atoms/logos/lanube";
import { ThemeToggle } from "@/components/molecules/theme";
import UserProfile from "@/components/molecules/user-profile";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import useUser from "@/hooks/use-user";
import { UserRole } from "@prisma/client";
import {
  Building2,
  Calendar,
  ChevronDown,
  FlaskConical,
  LayoutDashboard,
  LucideProps,
  Menu,
  Presentation,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ForwardRefExoticComponent, RefAttributes, useState } from "react";

interface ManagementLayoutProps {
  children: React.ReactNode;
  userType: "user" | "admin";
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
  user: [
    {
      name: "Panel de control",
      href: "/user/dashboard",
      icon: LayoutDashboard,
    },
    { name: "Coworking", href: "/user/coworking", icon: Building2 },
    { name: "Laboratorio", href: "/user/lab", icon: FlaskConical },
    { name: "Auditorio", href: "/user/auditorium", icon: Presentation },
    { name: "Sala de reuniones", href: "/user/meeting-room", icon: Users },
  ],
  admin: [
    { name: "Panel", href: "/admin", icon: LayoutDashboard },
    { name: "Usuarios", href: "/admin/users", icon: Users },
    {
      name: "Reservas",
      icon: Calendar,
      children: [
        {
          name: "Coworking",
          href: "/admin/reservations/coworking",
          icon: Building2,
        },
        {
          name: "Laboratorio",
          href: "/admin/reservations/lab",
          icon: FlaskConical,
        },
        {
          name: "Auditorio",
          href: "/admin/reservations/auditorium",
          icon: Presentation,
        },
        {
          name: "Sala de reuniones",
          href: "/admin/reservations/meeting",
          icon: Users,
        },
      ],
    },
  ],
};

export default function ManagementLayout({
  children,
  userType,
}: ManagementLayoutProps) {
  const user = useUser();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const toggleExpanded = (itemName: string) => {
    setExpandedItems((prev) =>
      prev.includes(itemName)
        ? prev.filter((item) => item !== itemName)
        : [...prev, itemName],
    );
  };
  const isActive = (href?: string) => {
    return pathname === href;
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
                ? "bg-la-nube-primary text-white"
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

  if (!user) {
    return <ManagementLayoutSkeleton />;
  }

  return (
    <div>
      <div className={`min-h-screen bg-slate-100 dark:bg-slate-800`}>
        {/* Mobile sidebar */}
        <div
          className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? "block" : "hidden"}`}
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
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="flex-1 space-y-1 px-2 py-4">
              {navigation[userType].map((item) => {
                return recursiveRender(item);
              })}
            </nav>
          </div>
        </div>

        {/* Desktop sidebar */}
        <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
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
              {navigation[userType].map((item) => {
                return recursiveRender(item);
              })}
            </nav>
          </div>
        </div>

        {/* Main content */}
        <div className="lg:pl-64">
          {/* Header */}
          <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 glass-header dark:glass-header-dark px-4 sm:gap-x-6 sm:px-6 lg:px-8">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
              <div className="flex flex-1" />
              <div className="flex items-center gap-x-4 lg:gap-x-6">
                {user.role === UserRole.ADMIN && (
                  <Link href="/admin/dashboard">
                    <Button>Panel de administrador</Button>
                  </Link>
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
