import { hasPermission, isAdminRole, type Permission } from "@/lib/rbac";
import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

/**
 * Path prefixes inside /admin that need a specific permission beyond admin:access.
 * The JWT role can lag a promotion/demotion; API routes re-check against the DB.
 */
const ADMIN_PATH_PERMISSIONS: Array<[prefix: string, permission: Permission]> =
  [
    ["/admin/spaces", "spaces:manage"],
    ["/admin/resources", "resources:manage"],
    ["/admin/reservation-types", "reservation-types:manage"],
    ["/admin/site", "site-config:manage"],
  ];

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production",
  });
  const isAuth = !!token;
  const isSignedUp = isAuth && token?.signedUp;
  const isBanned = isAuth && token?.banned;
  const role = token?.role as string | undefined;
  const isAuthPage = request.nextUrl.pathname.startsWith("/auth");

  const requiresSession =
    request.nextUrl.pathname.startsWith("/admin") ||
    request.nextUrl.pathname.startsWith("/user");

  const requiresAdmin = request.nextUrl.pathname.startsWith("/admin");

  if (!isAuth && requiresSession) {
    return NextResponse.redirect(new URL("/auth/signin", request.url));
  }

  if (requiresSession && isBanned) {
    return NextResponse.redirect(new URL("/banned", request.url));
  }

  if (isAuthPage && isSignedUp) {
    // If user is already authenticated and trying to access auth pages, redirect to dashboard
    return NextResponse.redirect(new URL("/user/dashboard", request.url));
  }

  if (requiresSession && !isSignedUp) {
    return NextResponse.redirect(new URL("/auth/signup", request.url));
  }

  if (isSignedUp && requiresAdmin && !isAdminRole(role)) {
    return NextResponse.redirect(new URL("/user/dashboard", request.url));
  }

  if (isSignedUp && requiresAdmin) {
    const required = ADMIN_PATH_PERMISSIONS.find(([prefix]) =>
      request.nextUrl.pathname.startsWith(prefix),
    );
    if (required && !hasPermission(role, required[1])) {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/user/:path*", "/admin/:path*", "/auth/:path*"],
};
