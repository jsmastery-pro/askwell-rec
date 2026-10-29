import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { SIGN_IN_URL, SIGN_UP_URL, getRouteAccess } from "./lib/auth/routes";
import { UNAUTHORIZED_STATUS, unauthorizedBody } from "./lib/auth/unauthorized";

export default clerkMiddleware(
  async (auth, req) => {
    const access = getRouteAccess(req.nextUrl.pathname);
    if (access === "public") return;

    const { isAuthenticated, redirectToSignIn } = await auth();
    if (isAuthenticated) return;

    // API callers get JSON, never a redirect.
    if (access === "protected-api") {
      return NextResponse.json(unauthorizedBody(), { status: UNAUTHORIZED_STATUS });
    }
    return redirectToSignIn({ returnBackUrl: req.url });
  },
  { signInUrl: SIGN_IN_URL, signUpUrl: SIGN_UP_URL },
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
