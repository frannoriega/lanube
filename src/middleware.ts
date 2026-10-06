import {
  hasPermission,
  isAdminRole,
  NO_PERMISSIONS,
  type Permission,
  type PermissionSet,
} from "@/lib/rbac";
import { PATHNAME_HEADER, policyGateUrl } from "@/lib/policies/gate";
import {
  OAUTH_AUTHORIZE_PATH,
  safeCallbackUrl,
  signInUrl,
} from "@/lib/signin/callback-url";
import {
  loadSnapshotFor,
  maintenanceBlock,
  needsMaintenanceCheck,
} from "@/lib/maintenance/gate";
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
    ["/admin/themes", "landing-themes:manage"],
    ["/admin/maintenance", "maintenance:manage"],
    ["/admin/roles", "roles:manage"],
    ["/admin/audit", "audit:view"],
    ["/admin/profile-requests", "users:profile-requests:review"],
  ];

/**
 * Mantenimiento (milestone 22). Corre para **todo** pedido a `/api/**` y, sin tocar ninguna
 * ruta, responde 503 si una ventana vigente lo frena (solo lectura, función apagada). El
 * resto de este middleware —sesión, baneo, políticas— es de las páginas y no se aplica acá:
 * la API tiene sus propios guards (`requireActiveSession`, `requirePermission`).
 */
async function apiGate(request: NextRequest): Promise<NextResponse> {
  const { method, nextUrl } = request;
  if (needsMaintenanceCheck(method, nextUrl.pathname)) {
    const snapshot = await loadSnapshotFor(nextUrl.origin);
    const block = maintenanceBlock(snapshot, method, nextUrl.pathname);
    if (block) {
      return NextResponse.json(block, {
        status: 503,
        headers: { "Retry-After": "120" },
      });
    }
  }
  return NextResponse.next();
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return apiGate(request);
  }
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production",
  });
  const isAuth = !!token;
  const isSignedUp = isAuth && token?.signedUp;
  const isBanned = isAuth && token?.banned;
  // Roles are data (milestone 9), so the token carries the *resolved* permission list
  // rather than a role name — middleware stays a DB-free fast path. It can lag a role
  // edit by one request; api-auth/page-auth re-read from the DB and are authoritative.
  const permissionSet: PermissionSet = token
    ? {
        isSuperadmin: token.isSuperadmin === true,
        permissions: Array.isArray(token.permissions)
          ? (token.permissions as string[])
          : [],
      }
    : NO_PERMISSIONS;
  const isAuthPage = request.nextUrl.pathname.startsWith("/auth");

  // `/oauth/authorize` (milestone 20, consentimiento del conector MCP) hereda ingreso, baneo
  // y gate de políticas como el resto de la zona autenticada.
  const requiresSession =
    request.nextUrl.pathname.startsWith("/admin") ||
    request.nextUrl.pathname.startsWith("/user") ||
    request.nextUrl.pathname.startsWith(OAUTH_AUTHORIZE_PATH);

  const requiresAdmin = request.nextUrl.pathname.startsWith("/admin");

  if (!isAuth && requiresSession) {
    // Se vuelve a la ruta pedida después de ingresar (milestone 20): imprescindible para el
    // flujo OAuth, que llega acá con todos sus parámetros en la query.
    return NextResponse.redirect(
      new URL(
        signInUrl(request.nextUrl.pathname + request.nextUrl.search),
        request.url,
      ),
    );
  }

  if (requiresSession && isBanned) {
    return NextResponse.redirect(new URL("/banned", request.url));
  }

  // Gate de políticas (milestone 19): con políticas pendientes no se usa nada de la zona
  // autenticada — admins y superadmins incluidos — hasta aceptarlas. Va después del baneo (un
  // suspendido ve /banned: no tiene sentido pedirle que acepte para usar algo que no puede
  // usar) y antes del perfil completo (una cuenta vieja sin perfil acepta primero). Las
  // páginas públicas no se frenan.
  //
  // El token puede atrasarse respecto de la base (la cookie se reescribe recién cuando el
  // cliente consulta /api/auth/session); por eso los layouts de /user y /admin y
  // `requireActiveSession()` vuelven a chequear con la sesión fresca.
  const pathname = request.nextUrl.pathname;
  if (
    isAuth &&
    token?.policiesPending === true &&
    (requiresSession || pathname.startsWith("/auth/signup"))
  ) {
    return NextResponse.redirect(
      new URL(policyGateUrl(pathname + request.nextUrl.search), request.url),
    );
  }

  if (isAuthPage && isSignedUp) {
    // If user is already authenticated and trying to access auth pages, redirect to the
    // validated callbackUrl (the dashboard by default).
    return NextResponse.redirect(
      new URL(
        safeCallbackUrl(request.nextUrl.searchParams.get("callbackUrl")),
        request.url,
      ),
    );
  }

  if (requiresSession && !isSignedUp) {
    return NextResponse.redirect(new URL("/auth/signup", request.url));
  }

  if (isSignedUp && requiresAdmin && !isAdminRole(permissionSet)) {
    return NextResponse.redirect(new URL("/user/dashboard", request.url));
  }

  if (isSignedUp && requiresAdmin) {
    const required = ADMIN_PATH_PERMISSIONS.find(([prefix]) =>
      request.nextUrl.pathname.startsWith(prefix),
    );
    if (required && !hasPermission(permissionSet, required[1])) {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
  }

  // Los layouts de servidor no conocen la ruta pedida; el gate la necesita para volver a ella.
  const headers = new Headers(request.headers);
  headers.set(PATHNAME_HEADER, pathname + request.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    "/",
    "/user/:path*",
    "/admin/:path*",
    "/auth/:path*",
    "/oauth/:path*",
    "/api/:path*",
  ],
};
