import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(request: NextRequest) {
  const token = await getToken({ 
    req: request,
    secret: process.env.NEXTAUTH_SECRET 
  })
  const isAuth = !!token
  const isAuthPage = request.nextUrl.pathname.startsWith("/auth")
  const isDashboardPage = request.nextUrl.pathname.startsWith("/dashboard")
  const isProtectedPage = request.nextUrl.pathname.startsWith("/coworking") || 
                         request.nextUrl.pathname.startsWith("/lab") || 
                         request.nextUrl.pathname.startsWith("/auditorium") ||
                         request.nextUrl.pathname.startsWith("/settings") ||
                         request.nextUrl.pathname.startsWith("/admin")

  if (isAuthPage && isAuth) {
    // If user is already authenticated and trying to access auth pages, redirect to dashboard
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  // Handle root path - redirect authenticated users to dashboard
  if (request.nextUrl.pathname === "/" && isAuth) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  if (!isAuth && (isDashboardPage || isProtectedPage)) {
    // If user is not authenticated and trying to access protected pages, redirect to home
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/coworking/:path*", "/lab/:path*", "/auditorium/:path*", "/admin/:path*", "/auth/:path*", "/settings/:path*"]
}