import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  decideAdminAuthorization,
  decideAuthenticatedUser,
  type AuthorizationDecision,
} from "@/lib/auth/authorization";

/**
 * Server-side authentication/authorization for route handlers and server
 * actions. This is the single admin-auth mechanism used by the API; it reuses
 * the cookie-based Supabase server client that middleware already refreshes, so
 * no second authentication system is introduced.
 *
 * The identity always comes from `supabase.auth.getUser()`, which validates the
 * session token against Supabase Auth - never from a request body or header.
 */

export type AuthenticatedRequest =
  | { allowed: true; userId: string }
  | { allowed: false; response: NextResponse };

function deny(decision: { status: 401 | 403; error: string }): AuthenticatedRequest {
  return {
    allowed: false,
    response: NextResponse.json({ error: decision.error }, { status: decision.status }),
  };
}

/** The authenticated user id resolved from the server-side session, if any. */
export async function getSessionUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user.id;
}

/** 401 unless a valid Supabase session is present. */
export async function requireAuthenticatedUser(): Promise<AuthenticatedRequest> {
  const decision: AuthorizationDecision = decideAuthenticatedUser(await getSessionUserId());
  if (!decision.allowed) return deny(decision);
  return { allowed: true, userId: decision.userId };
}

/**
 * 401 when unauthenticated, 403 when the authenticated user's profile role is
 * not `admin`. The role is read from the user's own `profiles` row through the
 * user-scoped (RLS enforced) client - middleware uses the same lookup.
 */
export async function requireAdminUser(): Promise<AuthenticatedRequest> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      allowed: false,
      response: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const decision = decideAdminAuthorization(user.id, profile?.role ?? null);
  if (!decision.allowed) return deny(decision);
  return { allowed: true, userId: decision.userId };
}
