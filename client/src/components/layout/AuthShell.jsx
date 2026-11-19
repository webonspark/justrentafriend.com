import { Link } from "react-router-dom";
import { FiCheckCircle, FiHeart, FiLock, FiMapPin, FiShield } from "react-icons/fi";
import { BRAND, CITY } from "../../config/brand";
import FloatingHearts from "../shared/FloatingHearts";

/**
 * The frame for sign-up, log-in and the code screens: the home page's
 * black → red → pink panel on one side, the form on a card on the other,
 * over the same drifting hearts and soft glows as the home page.
 */
const POINTS = [
  [FiCheckCircle, "Every Companion ID- and selfie-verified"],
  [FiMapPin, "Public places only, strictly platonic"],
  [FiLock, "Money held safely until after your meet"],
  [FiShield, "SOS and a real safety team, 24/7"],
];

export default function AuthShell({ children, wide = false }) {
  return (
    <div className="h-hero">
      <span className="h-blob h-blob-pink" aria-hidden="true" />
      <span className="h-blob h-blob-red" aria-hidden="true" />
      <FloatingHearts count={16} />
    <div className="k-wrap relative py-8 lg:py-16">
      <div className={`mx-auto grid overflow-hidden rounded-panel border border-pink-line shadow-lift lg:grid-cols-[0.9fr_1.1fr] ${wide ? "max-w-6xl" : "max-w-5xl"}`}>
        <aside
          className="relative flex flex-col justify-between gap-8 overflow-hidden p-7 text-white lg:p-10"
          style={{ background: "linear-gradient(150deg, #0b0b0b 0%, var(--rose-deep) 60%, var(--pink) 100%)" }}
        >
          <div>
            <Link to="/" className="mb-8 inline-flex items-center gap-2 font-extrabold text-white">
              <FiHeart /> {BRAND}
            </Link>
            <h2 className="mb-3 text-[1.75rem] leading-tight text-white lg:text-[2.25rem]">
              Real people.
              <br />
              Good company.
            </h2>
            <p className="m-0 max-w-sm text-white/85">
              Book a verified friend in {CITY} for a coffee, a walk, a gig — or become one.
            </p>
          </div>
          <ul className="m-0 hidden list-none space-y-3 p-0 lg:block">
            {POINTS.map(([Icon, text]) => (
              <li key={text} className="flex items-center gap-3 text-sm text-white/90">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/15"><Icon size={15} /></span>
                {text}
              </li>
            ))}
          </ul>
          <p className="m-0 hidden text-xs text-white/70 lg:block">18+ only · Strictly platonic · Made in {CITY}</p>
        </aside>
        <section className="bg-ink-raised p-6 sm:p-10">{children}</section>
      </div>
    </div>
    </div>
  );
}
