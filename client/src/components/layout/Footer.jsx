import { Link } from "react-router-dom";
import { BRAND, CITY } from "../../config/brand";

/**
 * The footer carries the pages India requires a platform to publish —
 * grievance officer, child safety, refunds — alongside the ordinary ones.
 * They are grouped by what someone is looking for, not by who owns them
 * internally.
 */

const COLUMNS = [
  {
    heading: "Company",
    links: [
      ["About", "/about"],
      ["How it works", "/how-it-works"],
      ["Pricing", "/pricing"],
      ["Blog", "/blog"],
    ],
  },
  {
    heading: "Legal",
    links: [
      ["Terms of use", "/terms"],
      ["Privacy", "/privacy"],
      ["Refunds and cancellation", "/refunds"],
      ["Community guidelines", "/community-guidelines"],
      ["Child safety", "/child-safety"],
      ["Delete your account", "/account-deletion"],
    ],
  },
  {
    heading: "Support",
    links: [
      ["Safety centre", "/safety"],
      ["Help and FAQ", "/help"],
      ["Contact", "/contact"],
      ["Report an issue", "/report"],
      ["Grievance officer", "/grievance-officer"],
      ["Payments", "/payments"],
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-ink-line bg-ink-raised">
      <div className="k-wrap py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <p className="mb-3 text-lg font-extrabold tracking-[-0.03em]">{BRAND}</p>
            <p className="max-w-xs text-sm leading-relaxed text-muted">
              Pay for someone&rsquo;s time by the hour — a coffee, a gig, a walk across the city.
              Open in {CITY}.
            </p>

            <p className="mt-5 max-w-xs rounded-xl border border-ink-line bg-ink p-3 text-xs leading-relaxed text-muted">
              Bookings are for social time only. Sexual services and solicitation are banned, and
              reported accounts are removed.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.heading} aria-labelledby={`foot-${col.heading}`}>
              <h4 id={`foot-${col.heading}`} className="mb-3 text-sm font-bold">
                {col.heading}
              </h4>
              <ul className="list-none space-y-2 p-0">
                {col.links.map(([label, to]) => (
                  <li key={to}>
                    <Link to={to} className="text-sm text-muted transition-colors hover:text-paper">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <hr className="k-rule my-9" />

        <div className="flex flex-col items-start justify-between gap-3 text-xs text-faint sm:flex-row sm:items-center">
          <p>
            &copy; {new Date().getFullYear()} {BRAND}. Adults only, 18+.
          </p>
          <p>Prices include GST where it applies.</p>
        </div>
      </div>
    </footer>
  );
}
