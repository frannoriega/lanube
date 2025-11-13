import { UserRole } from "@prisma/client"
import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NODE_ENV === 'production'
  })
  const isAuth = !!token
  const isSignedUp = isAuth && token?.signedUp
  const isBanned = isAuth && token?.banned
  const role = token?.role
  const isAuthPage = request.nextUrl.pathname.startsWith("/auth")

  const requiresSession = 
    request.nextUrl.pathname.startsWith("/admin") ||
    request.nextUrl.pathname.startsWith("/user")

  const requiresAdmin = 
    request.nextUrl.pathname.startsWith("/admin")

  console.debug({
    token,
    request
  })

  if (!isAuth && requiresSession) {
    return NextResponse.redirect(new URL("/auth/signin", request.url))
  }

  if (requiresSession && isBanned) {
    return NextResponse.redirect(new URL("/banned", request.url))
  }

  if (isAuthPage && isSignedUp) {
    // If user is already authenticated and trying to access auth pages, redirect to dashboard
    return NextResponse.redirect(new URL("/user/dashboard", request.url))
  }

  if (requiresSession && !isSignedUp) {
    return NextResponse.redirect(new URL("/auth/signup", request.url))
  }

  if (isSignedUp && requiresAdmin && role !== UserRole.ADMIN) {
    return NextResponse.redirect(new URL("/user/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/", "/user/:path*", "/admin/:path*", "/auth/:path*"]
}