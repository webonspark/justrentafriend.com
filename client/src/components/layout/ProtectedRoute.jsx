import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Skeleton } from "../ui";

/**
 * Keeps visitors out of member pages, and sends them back where they were
 * going once they have signed in.
 *
 * This is a courtesy, not a security measure. Every one of these routes is
 * also guarded on the server — hiding a page in the browser stops nobody
 * who can type a URL.
 */

export function RequireAuth() {
  const { signedIn, ready } = useAuth();
  const location = useLocation();

  if (!ready) return <Waiting />;

  if (!signedIn) {
    // `from` is what sends them back after signing in.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

/**
 * For pages that need a paid membership. Separate from RequireAuth because
 * the answer is different: signed out means sign in, no membership means
 * go and buy one.
 */
export function RequireMembership() {
  const { signedIn, ready, memberActive, user } = useAuth();
  const location = useLocation();

  if (!ready) return <Waiting />;
  if (!signedIn) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!user.mobileVerified) return <Navigate to="/verify-mobile" state={{ from: location }} replace />;
  if (!memberActive) return <Navigate to="/membership" state={{ from: location }} replace />;

  return <Outlet />;
}

/** Someone already signed in has no use for the sign-in page. */
export function RedirectIfSignedIn() {
  const { signedIn, ready } = useAuth();
  if (!ready) return <Waiting />;
  if (signedIn) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

/** Shown only while the session is being restored — a blink, usually. */
function Waiting() {
  return (
    <div className="k-wrap py-24">
      <div className="k-narrow space-y-3">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}
