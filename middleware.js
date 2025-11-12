import { stackServerApp } from "./lib/auth";
import { NextResponse } from "next/server";

// Create middleware function
const stackMiddleware = stackServerApp ? stackServerApp.withMiddleware() : null;

export default async function middleware(request) {
  try {
    // Check if Stack Auth is configured
    if (!stackMiddleware) {
      // If not configured, just pass through
      return NextResponse.next();
    }

    // Use Stack Auth middleware
    return await stackMiddleware(request);
  } catch (error) {
    console.error('Middleware error:', error);
    // On error, just pass through to avoid breaking the app
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};

