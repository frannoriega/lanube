"use client"

import { ThemeToggle } from "@/components/molecules/theme"
import UserProfile from "@/components/molecules/user-profile"
import { Button } from "@/components/ui/button"
import { UserRole } from "@prisma/client"
import {
  Building2,
  LayoutDashboard,
  Menu,
  Microscope,
  Users,
  X
} from "lucide-react"
import { signOut, useSession } from "next-auth/react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"

interface UserLayoutProps {
  children: React.ReactNode
}

const navigation = [
  { name: "Panel", href: "/dashboard", icon: LayoutDashboard },
  { name: "Coworking", href: "/coworking", icon: Building2 },
  { name: "Laboratorio", href: "/lab", icon: Microscope },
  { name: "Auditorio", href: "/auditorium", icon: Users },
]

export default function UserLayout({ children }: UserLayoutProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" })
  }

  console.log(session)

  return (
    <div className={`min-h-screen bg-slate-100 dark:bg-slate-800`}>
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col glass-sidebar dark:glass-sidebar-dark shadow-xl">
          <div className="flex h-16 items-center justify-between px-4">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-full bg-la-nube-primary flex items-center justify-center">
                <span className="text-sm">🌩️</span>
              </div>
              <span className="text-xl font-bold text-la-nube-primary">La Nube</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-4">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center rounded-md px-2 py-2 text-sm font-medium ${
                    pathname === item.href
                      ? 'bg-la-nube-primary text-white'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex min-h-0 flex-1 flex-col glass-sidebar dark:glass-sidebar-dark shadow">
          <div className="flex h-16 items-center px-4">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-full bg-la-nube-primary flex items-center justify-center">
                <span className="text-sm">🌩️</span>
              </div>
              <span className="text-xl font-bold text-la-nube-primary">La Nube</span>
            </div>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-4">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center rounded-md px-2 py-2 text-sm font-medium ${
                    pathname === item.href
                      ? 'bg-la-nube-primary text-white'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              )
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
              {/* Theme toggle */}
              <div className="flex items-center gap-x-2">
                <ThemeToggle />
              </div>

              {session?.role === UserRole.ADMIN && (
                <Button variant="ghost" className="relative h-8 w-8 rounded-full" onClick={() => router.push('/admin/dashboard')}>
                  Panel de administrador
                </Button>
              )}

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
  )
}
