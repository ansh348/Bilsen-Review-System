import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const role = (req.auth?.user as { role?: string } | undefined)?.role;

  const authRoutes = ["/login", "/signup"];
  const protectedRoutes = [
    "/dashboard",
    "/papers",
    "/reviews",
    "/profile",
    "/link-slack",
    "/admin",
  ];

  if (!isLoggedIn && protectedRoutes.some((r) => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isLoggedIn && pathname.startsWith("/admin") && role !== "COORDINATOR") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (isLoggedIn && authRoutes.some((r) => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
