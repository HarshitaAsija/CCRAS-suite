// frontend/src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require authentication
const PROTECTED_ROUTES = [
  "/dashboard",
  "/homepage",
  "/search",
  "/chat",
  "/graph",
  "/library",
  "/collections",
  "/analytics",
  "/upload",
  "/alerts",
  "/settings",
];

// Routes only for non-authenticated users
const AUTH_ROUTES = ["/login", "/register"];

// Public routes (no auth required)
const PUBLIC_ROUTES = ["/", "/about", "/papers", "/search"];

// Development bypass - set to false in production
const DEV_BYPASS = process.env.NODE_ENV === "development";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("krita_token")?.value;
  const userId = request.cookies.get("user_id")?.value;

  // --- DEVELOPMENT BYPASS ---
  // In development, auto-set test token for protected routes
  if (DEV_BYPASS && pathname === "/library" && !token) {
    const response = NextResponse.next();
    response.cookies.set("krita_token", "dev-test-token", {
      path: "/",
      maxAge: 86400, // 24 hours
      httpOnly: false,
      sameSite: "lax",
    });
    response.cookies.set("user_id", "11111111-1111-1111-1111-111111111111", {
      path: "/",
      maxAge: 86400,
      httpOnly: false,
      sameSite: "lax",
    });
    return response;
  }

  const isProtected = PROTECTED_ROUTES.some((r) => pathname.startsWith(r));
  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));
  const isPublic = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));

  // --- AUTH CHECK ---
  // Protected route + no token → redirect to login
  if (isProtected && !token && !DEV_BYPASS) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Has token + trying to access login/register → redirect to dashboard
  if (isAuthRoute && token) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // --- ADD USER ID HEADER for API calls ---
  const response = NextResponse.next();
  if (userId) {
    response.headers.set("X-User-ID", userId);
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};