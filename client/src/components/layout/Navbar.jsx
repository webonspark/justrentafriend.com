import { useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Dropdown } from "react-bootstrap";
import {
  FiMenu,
  FiX,
  FiLogOut,
  FiUser,
  FiCreditCard,
  FiSettings,
  FiShield,
  FiHelpCircle,
  FiLock,
  FiSun,
  FiMoon,
} from "react-icons/fi";
import { BRAND, CITY } from "../../config/brand";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { Avatar, Button } from "../ui";

/**
 * The top bar: sticky, with the current section marked.
 *
 * A visitor sees the marketing links and a highlighted way in. A signed-in
 * member sees the app's four places, with Earnings added for Customers.
 * Anything that needs a membership wears a lock rather than disappearing,
 * so nobody has to guess why a page is missing.
 */

const PUBLIC_LINKS = [
  { to: "/how-it-works", label: "How it works" },
  { to: "/safety", label: "Safety" },
  { to: "/pricing", label: "Pricing" },
];

const MEMBER_LINKS = [
  { to: "/discover", label: "Discover", gated: true },
  { to: "/bookings", label: "Bookings", gated: true },
  { to: "/messages", label: "Messages", gated: true },
];

export default function Navbar() {
  const { signedIn, user, isCustomer, memberActive, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const links = signedIn
    ? [...MEMBER_LINKS, ...(isCustomer ? [{ to: "/earnings", label: "Earnings", gated: true }] : [])]
    : PUBLIC_LINKS;

  const leave = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-ink-line bg-ink/85 backdrop-blur-xl">
      <div className="k-wrap flex h-[68px] items-center justify-between gap-6">
        <Link to={signedIn ? "/discover" : "/"} className="flex items-center gap-2.5">
          <Mark />
          <span className="text-[1.0625rem] font-extrabold tracking-[-0.03em]">{BRAND}</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {links.map((link) => (
            <TopLink key={link.to} {...link} locked={link.gated && signedIn && !memberActive} />
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {!signedIn && (
            <span className="hidden items-center gap-1.5 text-sm text-muted lg:flex">
              <FiShield size={14} aria-hidden="true" />
              {CITY}
            </span>
          )}

          <ThemeToggle />

          {signedIn ? (
            <AccountMenu user={user} isCustomer={isCustomer} onSignOut={leave} />
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Button to="/login" variant="ghost" size="sm">
                Log in
              </Button>
              <Button to="/signup" size="sm">
                Join {BRAND}
              </Button>
            </div>
          )}

          <button
            type="button"
            className="k-btn k-btn-ghost md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close the menu" : "Open the menu"}
          >
            {open ? <FiX size={20} /> : <FiMenu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <div id="mobile-menu" className="border-t border-ink-line bg-ink md:hidden">
          <nav className="k-wrap flex flex-col py-3" aria-label="Main">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setOpen(false)}
                className={`rounded-xl px-3 py-3 font-semibold ${
                  location.pathname === link.to ? "text-rose" : "text-muted"
                }`}
              >
                {link.label}
              </Link>
            ))}

            {!signedIn && (
              <div className="mt-3 flex flex-col gap-2 border-t border-ink-line pt-4">
                <Button to="/login" variant="outline" block onClick={() => setOpen(false)}>
                  Log in
                </Button>
                <Button to="/signup" block onClick={() => setOpen(false)}>
                  Join {BRAND}
                </Button>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

function TopLink({ to, label, locked }) {
  return (
    <NavLink
      to={locked ? "/membership" : to}
      className={({ isActive }) =>
        `rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
          isActive ? "bg-ink-high text-paper" : "text-muted hover:text-paper"
        }`
      }
    >
      <span className="inline-flex items-center gap-1.5">
        {label}
        {locked && <FiLock size={12} aria-label="Needs a membership" />}
      </span>
    </NavLink>
  );
}

/** The brand mark: two linked rings, drawn rather than loaded. */
function Mark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <circle cx="10" cy="13" r="6.5" style={{ stroke: "var(--rose)" }} strokeWidth="2.4" />
      <circle cx="17" cy="13" r="6.5" stroke="currentColor" strokeWidth="2.4" opacity="0.55" />
    </svg>
  );
}

/** Black or white. Shows the theme you would switch to, not the one you are on. */
function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      className="k-btn k-btn-ghost"
      onClick={toggle}
      aria-label={`Switch to the ${next === "light" ? "white" : "black"} theme`}
      title={`Switch to the ${next === "light" ? "white" : "black"} theme`}
    >
      {next === "light" ? <FiSun size={18} /> : <FiMoon size={18} />}
    </button>
  );
}

function AccountMenu({ user, isCustomer, onSignOut }) {
  return (
    <Dropdown align="end">
      <Dropdown.Toggle
        as="button"
        className="flex items-center gap-2 rounded-full border border-ink-line bg-ink-raised py-1 pl-1 pr-3 transition-colors hover:border-faint"
        id="account-menu"
      >
        <Avatar name={user.fullName} size={30} />
        <span className="hidden max-w-[9rem] truncate text-sm font-semibold sm:block">
          {user.fullName.split(" ")[0]}
        </span>
      </Dropdown.Toggle>

      <Dropdown.Menu>
        <div className="px-3 pb-2 pt-1">
          <p className="truncate text-sm font-bold">{user.fullName}</p>
          <p className="truncate text-xs text-muted">{user.email}</p>
        </div>
        <Dropdown.Divider />

        <Dropdown.Item as={Link} to="/profile">
          <FiUser className="mr-2 inline" size={15} /> My profile
        </Dropdown.Item>
        <Dropdown.Item as={Link} to="/membership">
          <FiCreditCard className="mr-2 inline" size={15} /> Membership
        </Dropdown.Item>
        {isCustomer && (
          <Dropdown.Item as={Link} to="/earnings">
            <FiCreditCard className="mr-2 inline" size={15} /> Earnings
          </Dropdown.Item>
        )}
        <Dropdown.Item as={Link} to="/settings">
          <FiSettings className="mr-2 inline" size={15} /> Settings
        </Dropdown.Item>
        <Dropdown.Item as={Link} to="/safety">
          <FiShield className="mr-2 inline" size={15} /> Safety centre
        </Dropdown.Item>
        <Dropdown.Item as={Link} to="/help">
          <FiHelpCircle className="mr-2 inline" size={15} /> Help
        </Dropdown.Item>

        <Dropdown.Divider />
        <Dropdown.Item as="button" onClick={onSignOut}>
          <FiLogOut className="mr-2 inline" size={15} /> Log out
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  );
}
