import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Layout from "./components/layout/Layout";
import {
  RedirectIfSignedIn,
  RequireAuth,
  RequireMembership,
} from "./components/layout/ProtectedRoute";
import Placeholder from "./pages/Placeholder";
import { Skeleton } from "./components/ui";
import {
  Forbidden,
  Maintenance,
  NotFound,
  ServerError,
} from "./pages/system/SystemPages";

/**
 * Every route in the app.
 *
 * Pages are lazy-loaded, so the home page does not carry the weight of the
 * ones a visitor has not opened. The routes for later phases exist now,
 * pointing at a placeholder that names the phase — the navigation is then
 * real from the start and nothing dead-ends.
 */

const Home = lazy(() => import("./pages/Home"));
const SignUp = lazy(() => import("./pages/auth/SignUp"));
const Login = lazy(() => import("./pages/auth/Login"));
const VerifyOtp = lazy(() => import("./pages/auth/VerifyOtp"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));

function Loading() {
  return (
    <div className="k-wrap py-24">
      <div className="k-narrow space-y-3">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  );
}

const soon = (title, phase, body) => <Placeholder title={title} phase={phase} body={body} />;

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route element={<Layout />}>
              {/* ---- open to everyone ---- */}
              <Route path="/" element={<Home />} />

              {/* ---- signed out only ---- */}
              <Route element={<RedirectIfSignedIn />}>
                <Route path="/signup" element={<SignUp />} />
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
              </Route>

              {/* Reaching these mid-flow while signed in is legitimate. */}
              <Route path="/verify" element={<VerifyOtp />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* ---- signed in, membership not needed yet ---- */}
              <Route element={<RequireAuth />}>
                <Route path="/membership" element={soon("Membership and checkout", 3)} />
                <Route path="/onboarding" element={soon("Set up your profile", 2)} />
                <Route path="/profile" element={soon("My profile", 2)} />
                <Route path="/settings" element={soon("Settings", 2)} />
              </Route>

              {/* ---- signed in, and paid for ---- */}
              <Route element={<RequireMembership />}>
                <Route path="/discover" element={soon("Discover", 2)} />
                <Route path="/bookings" element={soon("Bookings", 4)} />
                <Route path="/messages" element={soon("Messages", 5)} />
                <Route path="/earnings" element={soon("Earnings", 4)} />
              </Route>

              {/* ---- information and legal, Phase 7 ---- */}
              <Route path="/how-it-works" element={soon("How it works", 7)} />
              <Route path="/pricing" element={soon("Pricing", 7)} />
              <Route path="/safety" element={soon("Safety centre", 7)} />
              <Route path="/help" element={soon("Help and FAQ", 7)} />
              <Route path="/about" element={soon("About", 7)} />
              <Route path="/blog" element={soon("Blog", 7)} />
              <Route path="/contact" element={soon("Contact", 7)} />
              <Route path="/report" element={soon("Report an issue", 7)} />
              <Route path="/terms" element={soon("Terms of use", 7)} />
              <Route path="/privacy" element={soon("Privacy policy", 7)} />
              <Route path="/refunds" element={soon("Refunds and cancellation", 7)} />
              <Route path="/payments" element={soon("Payments", 7)} />
              <Route
                path="/community-guidelines"
                element={soon("Community guidelines", 7)}
              />
              <Route path="/child-safety" element={soon("Child safety policy", 7)} />
              <Route path="/account-deletion" element={soon("Deleting your account", 7)} />
              <Route path="/grievance-officer" element={soon("Grievance officer", 7)} />

              {/* ---- system ---- */}
              <Route path="/403" element={<Forbidden />} />
              <Route path="/500" element={<ServerError />} />
              <Route path="/maintenance" element={<Maintenance />} />
              <Route path="*" element={<NotFound />} />
            </Route>

            {/* The admin area is its own shell with its own login, Phase 6. */}
            <Route path="/admin/*" element={<Navigate to="/admin/login" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
