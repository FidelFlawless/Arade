/**
 * Pure authorization decisions shared by the admin API routes and admin server
 * actions.
 *
 * These helpers deliberately have no Next.js / Supabase imports so they can be
 * unit tested in isolation and reused from any server-side entry point.
 *
 * They never read a request body: the caller must resolve the identity from the
 * authenticated server-side session and pass it in. A role (or user id) coming
 * from the client must never be forwarded to these functions.
 */

export type AuthorizationDecision =
  | { allowed: true; userId: string }
  | { allowed: false; status: 401 | 403; error: string };

/** 401 when there is no authenticated user, otherwise allow. */
export function decideAuthenticatedUser(
  userId: string | null | undefined
): AuthorizationDecision {
  if (!userId) {
    return { allowed: false, status: 401, error: "Authentication required." };
  }
  return { allowed: true, userId };
}

/** 401 when unauthenticated, 403 when authenticated without `role = 'admin'`. */
export function decideAdminAuthorization(
  userId: string | null | undefined,
  role: string | null | undefined
): AuthorizationDecision {
  const authenticated = decideAuthenticatedUser(userId);
  if (!authenticated.allowed) return authenticated;

  if (role !== "admin") {
    return { allowed: false, status: 403, error: "Admin access required." };
  }

  return { allowed: true, userId: authenticated.userId };
}
