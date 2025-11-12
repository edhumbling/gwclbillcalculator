import { stackServerApp } from "./lib/auth";
import { NextResponse } from "next/server";

export default async function middleware(request) {
  try {
    // Check if Stack Auth is configured and has withMiddleware method
    if (!stackServerApp || typeof stackServerApp.withMiddleware !== 'function') {
      // If not configured, just pass through
      return NextResponse.next();
    }

    // Create and use Stack Auth middleware
    const stackMiddleware = stackServerApp.withMiddleware();
    if (typeof stackMiddleware === 'function') {
      return await stackMiddleware(request);
    }
    
    // Fallback if withMiddleware doesn't return a function
    return NextResponse.next();
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

