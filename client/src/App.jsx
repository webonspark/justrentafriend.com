import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Layout from "./components/layout/Layout";
import {
  RedirectIfSignedIn,
  RequireAuth,
  RequireMembership,
} from "./components/layout/ProtectedRoute";
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
 * ones a visitor has not opened.
 */

const Home = lazy(() => import("./pages/Home"));
const Dashboard = lazy(() => import("./pages/dashboard/Dashboard"));
const Wallet = lazy(() => import("./pages/wallet/Wallet"));
const Favorites = lazy(() => import("./pages/favorites/Favorites"));
const SignUp = lazy(() => import("./pages/auth/SignUp"));
const Login = lazy(() => import("./pages/auth/Login"));
const VerifyOtp = lazy(() => import("./pages/auth/VerifyOtp"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const VerifyMobile = lazy(() => import("./pages/auth/VerifyMobile"));

const Discover = lazy(() => import("./pages/discover/Discover"));
const CompanionProfile = lazy(() => import("./pages/discover/CompanionProfile"));
const Bookings = lazy(() => import("./pages/bookings/Bookings"));
const BookingDetail = lazy(() => import("./pages/bookings/BookingDetail"));
const Messages = lazy(() => import("./pages/messages/Messages"));
const MyProfile = lazy(() => import("./pages/profile/MyProfile"));
const Settings = lazy(() => import("./pages/settings/Settings"));
const Membership = lazy(() => import("./pages/membership/Membership"));
const Earnings = lazy(() => import("./pages/earnings/Earnings"));
const PaymentsHistory = lazy(() => import("./pages/payments/PaymentsHistory"));
const Notifications = lazy(() => import("./pages/notifications/Notifications"));
const SosShare = lazy(() => import("./pages/safety/SosShare"));
const AdminApp = lazy(() => import("./pages/admin/AdminApp"));

/* Information and legal pages live in one module; each is a named export. */
const info = (name) => lazy(() => import("./pages/info/InfoPages").then((m) => ({ default: m[name] })));
const HowItWorks = info("HowItWorks");
const Pricing = info("Pricing");
const SafetyCentre = info("SafetyCentre");
const Help = info("Help");
const About = info("About");
const Blog = info("Blog");
const Contact = info("Contact");
const ReportIssue = info("ReportIssue");
const Terms = info("Terms");
const Privacy = info("Privacy");
const Refunds = info("Refunds");
const PaymentsInfo = info("PaymentsInfo");
const CommunityGuidelines = info("CommunityGuidelines");
const ChildSafety = info("ChildSafety");
const AccountDeletion = info("AccountDeletion");
const GrievanceOfficer = info("GrievanceOfficer");

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
                <Route path="/verify-mobile" element={<VerifyMobile />} />
                <Route path="/membership" element={<Membership />} />
                <Route path="/onboarding" element={<Navigate to="/profile" replace />} />
                <Route path="/support-view" element={<Navigate to="/" replace />} />
                <Route path="/profile" element={<MyProfile />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/wallet" element={<Wallet />} />
                <Route path="/favorites" element={<Favorites />} />
                <Route path="/payments-history" element={<PaymentsHistory />} />
                <Route path="/earnings" element={<Earnings />} />
              </Route>

              {/* ---- signed in, and paid for ---- */}
              <Route element={<RequireMembership />}>
                <Route path="/discover" element={<Discover />} />
                <Route path="/companions/:id" element={<CompanionProfile />} />
                <Route path="/bookings" element={<Bookings />} />
                <Route path="/bookings/:id" element={<BookingDetail />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/messages/:id" element={<Messages />} />
              </Route>

              {/* ---- the emergency contact's live view, no sign-in ---- */}
              <Route path="/sos/:token" element={<SosShare />} />

              {/* ---- information and legal ---- */}
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/safety" element={<SafetyCentre />} />
              <Route path="/help" element={<Help />} />
              <Route path="/about" element={<About />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/report" element={<ReportIssue />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/refunds" element={<Refunds />} />
              <Route path="/payments" element={<PaymentsInfo />} />
              <Route path="/community-guidelines" element={<CommunityGuidelines />} />
              <Route path="/child-safety" element={<ChildSafety />} />
              <Route path="/account-deletion" element={<AccountDeletion />} />
              <Route path="/grievance-officer" element={<GrievanceOfficer />} />

              {/* ---- system ---- */}
              <Route path="/403" element={<Forbidden />} />
              <Route path="/500" element={<ServerError />} />
              <Route path="/maintenance" element={<Maintenance />} />
              <Route path="*" element={<NotFound />} />
            </Route>

            {/* The admin area is its own shell with its own login. */}
            <Route path="/admin/*" element={<AdminApp />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
