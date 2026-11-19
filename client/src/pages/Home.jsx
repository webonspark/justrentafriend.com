import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Accordion } from "react-bootstrap";
import {
  FiSearch,
  FiShield,
  FiCheckCircle,
  FiSlash,
  FiEye,
  FiFlag,
  FiMapPin,
  FiHeart,
  FiCoffee,
  FiMusic,
  FiFilm,
  FiShoppingBag,
  FiBookOpen,
  FiSun,
  FiActivity,
  FiMessageCircle,
  FiStar,
  FiLock,
  FiAlertTriangle,
  FiUsers,
} from "react-icons/fi";
import { BRAND, CITY, CITIES } from "../config/brand";
import { useAuth } from "../context/AuthContext";
import { useSiteConfig } from "./info/InfoLayout";
import { Avatar, Badge, Button, Price } from "../components/ui";
import "../styles/home.css";
import FloatingHearts from "../components/shared/FloatingHearts";

/**
 * The front page: pink, red, white and black, with floating hearts.
 *
 * Motion is decoration, never information — everything reads the same with
 * animation off, and it is switched off for anyone whose device asks for
 * reduced motion (see styles/home.css).
 *
 * The people in the hero deck are illustrations, not members.
 */

const SHOWCASE = [
  { name: "Meera Iyer", age: 27, area: "Indiranagar", km: 3.2, paise: 180000, tag: "City walk", rating: 4.9 },
  { name: "Arjun Nair", age: 31, area: "Koramangala", km: 1.1, paise: 200000, tag: "Live music", rating: 4.8 },
  { name: "Ananya Rao", age: 33, area: "Jayanagar", km: 5.4, paise: 250000, tag: "Theatre", rating: 5.0 },
];

const ROTATING = ["a coffee", "a city walk", "a concert", "a museum day", "a food trail", "a movie night", "a wedding plus-one"];

const SERVICES = [
  { icon: FiCoffee, name: "Coffee & conversation" },
  { icon: FiMapPin, name: "City walks" },
  { icon: FiMusic, name: "Gigs & concerts" },
  { icon: FiFilm, name: "Movies & theatre" },
  { icon: FiShoppingBag, name: "Shopping buddy" },
  { icon: FiBookOpen, name: "Museums & books" },
  { icon: FiActivity, name: "Fitness buddy" },
  { icon: FiUsers, name: "Event plus-one" },
];

const STEPS = [
  { icon: FiCheckCircle, title: "Join and verify", body: `Sign up, confirm your email and mobile, and pick a membership. Everyone on ${BRAND} is 18 or over.` },
  { icon: FiSearch, title: "Find your person", body: "Filter by area, price, language, rating and the day you are free. Every Companion is ID-checked and approved by our team." },
  { icon: FiMessageCircle, title: "Request, pay, meet", body: "They accept, you pay, and the money is held safely until after your meet. Chat opens the moment it is confirmed." },
];

const SAFETY = [
  { icon: FiCheckCircle, title: "ID & selfie checked", body: "Companions pass an Aadhaar/PAN check and a selfie match, and are approved by a person before they go live." },
  { icon: FiSlash, title: "Strictly platonic", body: "Social time only. Solicitation gets an account removed, and chat is filtered for it." },
  { icon: FiMapPin, title: "Public places only", body: "Cafés, parks, museums, malls, events. Homes and hotel rooms are refused at booking." },
  { icon: FiLock, title: "Money held in escrow", body: "Your payment is released to the Companion only after the meet — never paid off-platform." },
  { icon: FiAlertTriangle, title: "SOS during every meet", body: "One tap sends your live location to your emergency contact and our safety team." },
  { icon: FiFlag, title: "Report & block anywhere", body: "On every profile, booking and chat message. Urgent reports jump the queue." },
];

const STATS = [
  { value: 18, suffix: "+", label: "Adults only, age-checked" },
  { value: 100, suffix: "%", label: "Companions ID-verified" },
  { value: 0, prefix: "₹", label: "Paid outside the app, ever" },
  { value: 24, suffix: "/7", label: "SOS and safety team" },
];

/* ------------------------------ small motion helpers ------------------------------ */

/** Adds .is-in to every .h-reveal inside `ref` as it scrolls into view. */
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const items = root.querySelectorAll(".h-reveal");
    if (!("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-in"));
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.15 }
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return ref;
}

/** Cycles through ROTATING words in the headline. */
function Rotator() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % ROTATING.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="h-rotator" aria-live="off">
      {ROTATING.map((w, n) => (
        <span key={w} className={n === i ? "is-on" : ""} aria-hidden={n !== i}>
          {w}
        </span>
      ))}
    </span>
  );
}

/** Counts up to `value` once it is on screen. */
function CountUp({ value, prefix = "", suffix = "" }) {
  const ref = useRef(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || value === 0) return undefined;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now) => {
        const p = Math.min((now - start) / 1400, 1);
        setN(Math.round(value * (1 - (1 - p) ** 3)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [value]);
  return (
    <span ref={ref} className="h-stat-num">
      {prefix}
      {n}
      {suffix}
    </span>
  );
}

/* ------------------------------ the page ------------------------------ */

export default function Home() {
  const navigate = useNavigate();
  const { signedIn } = useAuth();
  const { commissionPct, freeHours, partialPct } = useSiteConfig();
  const [city, setCity] = useState(CITY);
  const page = useReveal();

  const search = (e) => {
    e.preventDefault();
    navigate(signedIn ? `/discover?city=${encodeURIComponent(city)}` : "/signup");
  };

  const example = 200000;
  const fee = Math.floor((example * commissionPct) / 100);
  const faq = [
    ["Do I pay for the membership and for each booking?", "Yes. The membership unlocks search, booking and chat; after that you pay each Companion's hourly price per booking. You see the full price before you pay."],
    ["How much does the platform take?", `${commissionPct}% of the price, deducted from what the Companion set — never added on top. On a ₹2,000 booking the Companion receives ₹${(example - fee) / 100} and you pay exactly ₹2,000.`],
    ["When is the Companion paid?", "After the meet. Your payment is held safely until you confirm it happened, or 24 hours after the end if nobody raises a problem."],
    ["What if I need to cancel?", `Full refund ${freeHours} hours or more before the start, ${partialPct}% inside ${freeHours} hours. If the Companion cancels, you always get a full refund.`],
    ["Is this a dating or escort app?", `No. ${BRAND} is for platonic social time in public places. Anything sexual is banned, filtered in chat and removed.`],
    [`Can I use it outside ${CITY}?`, `Not yet. We are open in ${CITY} only while we get the safety side right.`],
  ];

  return (
    <div ref={page}>
      {/* ============================ hero ============================ */}
      <section className="h-hero">
        <span className="h-blob h-blob-pink" aria-hidden="true" />
        <span className="h-blob h-blob-red" aria-hidden="true" />
        <FloatingHearts />

        <div className="k-wrap relative grid items-center gap-14 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
          <div className="k-enter min-w-0">
            <Badge tone="accent" className="mb-6">
              <span className="h-beat"><FiHeart size={12} /></span> Now open in {CITY}
            </Badge>

            <h1 className="k-plain mb-5 text-[2.6rem] leading-[1.05] sm:text-[3.6rem] lg:text-[4.2rem]">
              <span className="h-gradient-text">Rent a friend</span>
              <br />
              for <Rotator />
            </h1>

            <p className="mb-8 max-w-[52ch] text-lg leading-relaxed text-muted">
              Verified, friendly people in {CITY} who&rsquo;ll join you for an hour or an afternoon —
              strictly platonic, always in public, paid safely through the app.
            </p>

            <form onSubmit={search} className="mb-7 flex flex-col gap-2.5 sm:flex-row">
              <label htmlFor="city" className="sr-only">City</label>
              <select id="city" className="k-input sm:max-w-[12rem]" value={city} onChange={(e) => setCity(e.target.value)}>
                {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <Button type="submit" size="lg" className="h-cta sm:flex-1">
                <FiSearch size={17} /> {signedIn ? "Find a friend nearby" : "Find your friend"}
              </Button>
            </form>

            <div className="flex flex-wrap gap-2">
              <Badge><FiCheckCircle size={12} /> ID-verified</Badge>
              <Badge><FiShield size={12} /> 18+ only</Badge>
              <Badge><FiSlash size={12} /> Strictly platonic</Badge>
            </div>
          </div>

          <div className="relative mx-auto w-full min-w-0 max-w-md lg:max-w-none">
            <div className="h-chip" style={{ left: "-1.5rem", top: "-1.5rem" }}>
              <span className="h-beat"><FiHeart /></span> 100% verified
            </div>
            <div className="h-chip" style={{ right: "-0.5rem", bottom: "-1.75rem", animationDelay: "-2.5s" }}>
              <FiLock style={{ color: "var(--pink)" }} /> Escrow protected
            </div>
            <div className="space-y-5">
              {SHOWCASE.map((person, i) => <ShowcaseCard key={person.name} person={person} index={i} />)}
            </div>
          </div>
        </div>
      </section>

      {/* ============================ marquee ============================ */}
      <div className="h-marquee" aria-hidden="true">
        <div className="h-marquee-track">
          {[...SERVICES, ...SERVICES].map((s, i) => (
            <span key={i}><s.icon /> {s.name} <FiHeart size={12} /></span>
          ))}
        </div>
      </div>

      {/* ============================ how it works ============================ */}
      <section className="k-wrap py-16 lg:py-24" aria-labelledby="how">
        <div className="h-reveal mb-12 text-center">
          <Badge tone="accent" className="mb-4">How it works</Badge>
          <h2 id="how" className="mb-3"><span className="h-gradient-text">Three steps</span> to a good time</h2>
          <p className="mx-auto max-w-prose text-muted">From sign-up to your first meet in minutes.</p>
        </div>
        <ol className="m-0 grid list-none gap-6 p-0 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="h-reveal" style={{ "--d": `${i * 0.12}s` }}>
              <div className="h-step">
                <div className="h-step-num">{i + 1}</div>
                <h3 className="mb-2 flex items-center gap-2"><s.icon style={{ color: "var(--pink)" }} /> {s.title}</h3>
                <p className="m-0 text-sm leading-relaxed text-muted">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ============================ services ============================ */}
      <section className="border-y border-ink-line bg-ink-raised py-16 lg:py-24" aria-labelledby="ideas">
        <div className="k-wrap">
          <div className="h-reveal mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Badge tone="accent" className="mb-4">Ideas</Badge>
              <h2 id="ideas" className="mb-2">What will you <span className="h-gradient-text">do together?</span></h2>
              <p className="m-0 max-w-prose text-muted">Pick an activity — every Companion lists what they enjoy.</p>
            </div>
            <Button to={signedIn ? "/discover" : "/signup"} className="h-cta"><FiHeart /> Explore Companions</Button>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {SERVICES.map((s, i) => (
              <div key={s.name} className="h-service h-reveal" style={{ "--d": `${(i % 4) * 0.08}s` }}>
                <span className="h-service-icon"><s.icon size={20} /></span>
                <p className="m-0 font-bold">{s.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ promises in numbers ============================ */}
      <section className="k-wrap py-16 lg:py-20">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {STATS.map((s, i) => (
            <div key={s.label} className="h-stat h-reveal" style={{ "--d": `${i * 0.1}s` }}>
              <CountUp value={s.value} prefix={s.prefix} suffix={s.suffix} />
              <p className="mb-0 mt-2 text-sm text-muted">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============================ safety ============================ */}
      <section className="py-16 lg:py-24" aria-labelledby="safety" style={{ background: "linear-gradient(180deg, var(--ink), var(--pink-soft) 50%, var(--ink))" }}>
        <div className="k-wrap">
          <div className="h-reveal mb-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Badge tone="accent" className="mb-4"><FiShield size={12} /> Safety first</Badge>
              <h2 id="safety" className="mb-3">Built so you can <span className="h-gradient-text">relax and enjoy</span></h2>
              <p className="m-0 max-w-prose text-muted">Meeting someone new only works if the rules are real. These are enforced by people and by the app.</p>
            </div>
            <Button to="/safety" variant="outline"><FiShield size={16} /> Safety centre</Button>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SAFETY.map(({ icon: Icon, title, body }, i) => (
              <div key={title} className="h-step h-reveal flex gap-4" style={{ "--d": `${(i % 3) * 0.1}s` }}>
                <span className="h-safety-icon"><Icon size={19} aria-hidden="true" /></span>
                <div>
                  <h4 className="mb-1.5">{title}</h4>
                  <p className="m-0 text-sm leading-relaxed text-muted">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ two sides ============================ */}
      <section className="k-wrap py-16 lg:py-24">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-step h-reveal">
            <span className="h-safety-icon mb-4"><FiSearch size={19} /></span>
            <h3 className="mb-2">Looking for company?</h3>
            <p className="mb-6 text-sm text-muted">Browse verified Companions, request a time that suits you, and pay only once they accept. Rate them after.</p>
            <Button to="/signup" className="h-cta">Book a friend</Button>
          </div>
          <div className="h-step h-reveal" style={{ "--d": "0.12s" }}>
            <span className="h-safety-icon mb-4"><FiSun size={19} /></span>
            <h3 className="mb-2">Enjoy meeting people?</h3>
            <p className="mb-6 text-sm text-muted">Become a Companion: set your own hourly rate and calendar, accept the bookings you like, and get paid to UPI after every meet.</p>
            <Button to="/signup" variant="outline">Become a Companion</Button>
          </div>
        </div>
      </section>

      {/* ============================ faq ============================ */}
      <section className="k-wrap pb-16 lg:pb-24" aria-labelledby="faq">
        <h2 id="faq" className="h-reveal mb-10 text-center">Questions people ask</h2>
        <div className="h-reveal mx-auto max-w-3xl">
          <Accordion flush defaultActiveKey="0">
            {faq.map(([q, a], i) => (
              <Accordion.Item eventKey={String(i)} key={q}>
                <Accordion.Header>{q}</Accordion.Header>
                <Accordion.Body>{a}</Accordion.Body>
              </Accordion.Item>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ============================ last call ============================ */}
      <section className="k-wrap pb-24">
        <div className="h-final h-reveal px-6 py-14 text-center sm:px-12">
          <FloatingHearts count={12} />
          <span className="h-beat mb-4 inline-block text-4xl" style={{ color: "#fff" }}><FiHeart /></span>
          <h2 className="mb-3 text-[2rem] sm:text-[2.6rem]">Your next good hour is one tap away</h2>
          <p className="mx-auto mb-8 max-w-xl opacity-90">Join in a couple of minutes. Look around before you pay for anything.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button to="/signup" size="lg" className="h-white-btn"><FiHeart /> Join {BRAND}</Button>
            <Button to="/how-it-works" size="lg" variant="outline" style={{ color: "#fff", borderColor: "rgba(255,255,255,0.6)" }}>How it works</Button>
          </div>
        </div>
      </section>
    </div>
  );
}

/** One card in the hero deck, gently bobbing, with a beating heart. */
function ShowcaseCard({ person, index }) {
  const tilt = [-1.2, 1, -0.6][index] || 0;
  return (
    <article className="k-card h-deck-card p-4" style={{ "--i": index, "--tilt": tilt }}>
      <span className="h-like" style={{ "--i": index }} aria-hidden="true"><FiHeart size={15} /></span>
      <div className="flex items-center gap-4">
        <Avatar name={person.name} size={56} />
        <div className="min-w-0 flex-1">
          <p className="m-0 flex items-center gap-1.5 truncate font-bold leading-tight">
            {person.name}, {person.age} <FiCheckCircle size={14} style={{ color: "var(--good)" }} />
          </p>
          <p className="m-0 mt-0.5 truncate text-sm text-muted">{person.area} &mdash; {person.km} km away</p>
        </div>
      </div>
      <div className="mt-3.5 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <span className="k-badge">{person.tag}</span>
          <span className="flex items-center gap-1 text-sm font-bold"><FiStar size={13} style={{ color: "var(--pink)" }} /> {person.rating.toFixed(1)}</span>
        </span>
        <Price paise={person.paise} size="md" />
      </div>
    </article>
  );
}
