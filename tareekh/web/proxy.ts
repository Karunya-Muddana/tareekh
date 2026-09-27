import { NextResponse, type NextRequest } from "next/server";

// Simulated sign-in: anyone without the session cookie goes to /login first.
export function proxy(request: NextRequest) {
  const signedIn = request.cookies.has("tareekh_session");
  const { pathname, search } = request.nextUrl;
  if (pathname === "/login") {
    return signedIn ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }
  if (!signedIn) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Pages only: never the backend proxy, the chat API, Next internals or static files.
  matcher: ["/((?!backend|api|_next/|fonts/|brand|icon|apple-icon|manifest|.*\\.(?:png|svg|ico|webmanifest|txt)$).*)"],
};
