import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const ROLE_ROUTES: Record<string, string[]> = {
  super_admin: ["/super-admin"],
  admin: ["/admin"],
  prof: ["/prof"],
  eleve: ["/eleve"],
};

const API_ROLE_ROUTES: Record<string, string[]> = {
  super_admin: ["/api/super-admin"],
  admin: ["/api/admin"],
  prof: ["/api/prof"],
  eleve: ["/api/eleve"],
};

function hasAccess(pathname: string, role: string): boolean {
  for (const [allowedRole, prefixes] of Object.entries(ROLE_ROUTES)) {
    for (const prefix of prefixes) {
      if (pathname.startsWith(prefix)) {
        if (allowedRole === "admin") {
          return role === "admin" || role === "super_admin";
        }
        return role === allowedRole;
      }
    }
  }

  for (const [allowedRole, prefixes] of Object.entries(API_ROLE_ROUTES)) {
    for (const prefix of prefixes) {
      if (pathname.startsWith(prefix)) {
        if (allowedRole === "admin") {
          return role === "admin" || role === "super_admin";
        }
        return role === allowedRole;
      }
    }
  }

  return true;
}

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const role = token.role as string;

    if (!hasAccess(pathname, role)) {
      if (role === "super_admin") return NextResponse.redirect(new URL("/super-admin", req.url));
      if (role === "admin") return NextResponse.redirect(new URL("/admin", req.url));
      if (role === "prof") return NextResponse.redirect(new URL("/prof", req.url));
      return NextResponse.redirect(new URL("/eleve", req.url));
    }

    if (role === "super_admin" && !pathname.startsWith("/super-admin")) {
      return NextResponse.redirect(new URL("/super-admin", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/super-admin/:path*",
    "/admin/:path*",
    "/prof/:path*",
    "/eleve/:path*",
    "/api/super-admin/:path*",
    "/api/admin/:path*",
    "/api/prof/:path*",
    "/api/eleve/:path*",
    "/api/notifications/:path*",
    "/api/profil/:path*",
  ],
};
