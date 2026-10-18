import "server-only";
/**
 * Supabase client for server components, server actions and route handlers,
 * bound to the signed-in user's session cookies (REQ-004 FR-4, FR-8).
 * Row-level security applies to everything this client does.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { siteIsHttps } from "@/lib/site";
import { readSupabaseEnv } from "./env";

export async function createSupabaseServerClient() {
  const { url, publishableKey } = readSupabaseEnv();
  const cookieStore = await cookies();
  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, {
              ...options,
              httpOnly: true,
              // Secure over https, which production is; CI's production build serves http://localhost,
              // where WebKit drops a Secure cookie and Chromium keeps it (#108 run 1, the iphone case).
              secure: siteIsHttps(),
              sameSite: "lax",
            });
          }
        } catch {
          // Called from a Server Component, where cookies cannot be written;
          // the proxy or a server action refreshes the session instead.
        }
      },
    },
  });
}
