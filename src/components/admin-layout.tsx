"use client"

import { useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { 
  LayoutDashboard, 
  Calendar, 
  Building2, 
  Microscope, 
  Users, 
  AlertTriangle,
  Settings, 
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  ChevronDown,
  CheckCircle
} from "lucide-react"
import { useTheme } from "next-themes"

interface AdminLayoutProps {
  children: React.ReactNode
}

const navigation = [
  { name: "Panel", href: "/admin", icon: LayoutDashboard },
  { 
    name: "Reservas", 
    icon: Calendar,
    children: [
      { name: "Coworking", href: "/admin/reservations/coworking", icon: Building2 },
      { name: "Laboratorio", href: "/admin/reservations/lab", icon: Microscope },
      { name: "Auditorio", href: "/admin/reservations/auditorium", icon: Users },
    ]
  },
  { name: "Ingreso/Salida", href: "/admin/checkin", icon: CheckCircle },
  { name: "Incidentes", href: "/admin/incidents", icon: AlertTriangle },
]

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const [expandedItems, setExpandedItems] = useState<string[]>([])

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" })
  }

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
    // TODO: Implement theme switching logic
  }

  const toggleExpanded = (itemName: string) => {
    setExpandedItems(prev => 
      prev.includes(itemName) 
        ? prev.filter(item => item !== itemName)
        : [...prev, itemName]
    )
  }

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/')
  }

              const hasActiveChild = (children: { href: string }[]) => {
    return children.some(child => isActive(child.href))
  }

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
              <span className="text-xl font-bold text-la-nube-primary">La Nube Admin</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-4">
            {navigation.map((item) => {
              if (item.children) {
                const Icon = item.icon
                const isExpanded = expandedItems.includes(item.name)
                const hasActive = hasActiveChild(item.children)
                
                return (
                  <div key={item.name}>
                    <button
                      onClick={() => toggleExpanded(item.name)}
                      className={`group flex w-full items-center rounded-md px-2 py-2 text-sm font-medium ${
                        hasActive
                          ? 'bg-la-nube-primary text-white'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <Icon className="mr-3 h-5 w-5" />
                      {item.name}
                      <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    {isExpanded && (
                      <div className="ml-6 space-y-1">
                        {item.children.map((child) => {
                          const ChildIcon = child.icon
                          return (
                            <Link
                              key={child.name}
                              href={child.href}
                              className={`group flex items-center rounded-md px-2 py-2 text-sm font-medium ${
                                isActive(child.href)
                                  ? 'bg-la-nube-primary text-white'
                                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                              }`}
                              onClick={() => setSidebarOpen(false)}
                            >
                              <ChildIcon className="mr-3 h-5 w-5" />
                              {child.name}
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              } else {
                const Icon = item.icon
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group flex items-center rounded-md px-2 py-2 text-sm font-medium ${
                      isActive(item.href)
                        ? 'bg-la-nube-primary text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                    }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                )
              }
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
              <span className="text-xl font-bold text-la-nube-primary">La Nube Admin</span>
            </div>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-4">
            {navigation.map((item) => {
              if (item.children) {
                const Icon = item.icon
                const isExpanded = expandedItems.includes(item.name)
                const hasActive = hasActiveChild(item.children)
                
                return (
                  <div key={item.name}>
                    <button
                      onClick={() => toggleExpanded(item.name)}
                      className={`group flex w-full items-center rounded-md px-2 py-2 text-sm font-medium ${
                        hasActive
                          ? 'bg-la-nube-primary text-white'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <Icon className="mr-3 h-5 w-5" />
                      {item.name}
                      <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    {isExpanded && (
                      <div className="ml-6 space-y-1">
                        {item.children.map((child) => {
                          const ChildIcon = child.icon
                          return (
                            <Link
                              key={child.name}
                              href={child.href}
                              className={`group flex items-center rounded-md px-2 py-2 text-sm font-medium ${
                                isActive(child.href)
                                  ? 'bg-la-nube-primary text-white'
                                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                              }`}
                            >
                              <ChildIcon className="mr-3 h-5 w-5" />
                              {child.name}
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              } else {
                const Icon = item.icon
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group flex items-center rounded-md px-2 py-2 text-sm font-medium ${
                      isActive(item.href)
                        ? 'bg-la-nube-primary text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                )
              }
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
                <Sun className="h-4 w-4" />
                <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} />
                <Moon className="h-4 w-4" />
              </div>

              {/* User menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={session?.user?.image || ""} alt={session?.user?.name || ""} />
                      <AvatarFallback>
                        {session?.user?.name?.charAt(0) || "A"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {session?.user?.name} (Admin)
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {session?.user?.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push('/admin/settings')}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Configuración</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Cerrar sesión</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
