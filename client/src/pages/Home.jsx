import { useState } from "react";
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
} from "react-icons/fi";
import { BRAND, CITY, CITIES } from "../config/brand";
import { Avatar, Badge, Button, Card, Price } from "../components/ui";

/**
 * The front page.
 *
 * The hero is built around the one thing this product is: an hour of
 * someone's time has a price. So rather than a headline floating over a
 * gradient, the right-hand side is a deck of real-looking people with the
 * rate as the loudest thing on each card. The left-hand side is the city
 * and the search — the two decisions a visitor actually makes.
 *
 * Everything on this page is invented. No photographs exist yet, so the
 * avatars are generated from the names.
 */

const SHOWCASE = [
  { name: "Meera Iyer", age: 27, area: "Indiranagar", km: 3.2, paise: 180000, tag: "Trekking" },
  { name: "Arjun Nair", age: 31, area: "Koramangala", km: 1.1, paise: 200000, tag: "Live music" },
  { name: "Ananya Rao", age: 33, area: "Jayanagar", km: 5.4, paise: 250000, tag: "Theatre" },
];

const STEPS = [
  {
    title: "Join and verify",
    body: `Sign up, confirm your email and pick a membership. Everyone on ${BRAND} is 18 or over and ID-checked before they can be paid.`,
  },
  {
    title: "Find someone nearby",
    body: "Filter by distance, age, price and what they are into. You see a rounded distance and an area — never anyone's exact location.",
  },
  {
    title: "Pay, then meet",
    body: "Choose your hours and pay the price shown. Chat opens the moment payment clears, and you both confirm afterwards.",
  },
];

const SAFETY = [
  { icon: FiCheckCircle, title: "ID-checked before payout", body: "No Customer is paid until their identity has been verified by a person on our team." },
  { icon: FiSlash, title: "No sexual services", body: "Bookings are social time only. Solicitation gets an account removed, and reports are acted on." },
  { icon: FiEye, title: "Location stays yours", body: "We show an area and a rounded distance. Your address is never shared, with anyone." },
  { icon: FiFlag, title: "Report anything, any time", body: "Report and block are on every profile and in every chat. Urgent reports jump the queue." },
];

const FAQ = [
  ["Do I pay for the membership and for each booking?", `Yes, both. The membership keeps your profile visible and unlocks chat and booking. After that you pay the Customer's price for each connection separately.`],
  ["How much does the platform take?", `18% of the price, deducted from what the Customer set — never added on top. On a ₹2,000 booking the Customer receives ₹1,640 and you pay exactly ₹2,000.`],
  ["When does chat open?", "Once payment has been confirmed by the payment provider on our server. Phone numbers and social handles stay hidden until then."],
  ["What if the other person does not turn up?", "You get a full refund. If you cancel close to the start time a partial refund may apply — the exact window is on the refunds page."],
  ["Is this a dating app?", `${BRAND} is for paid social time: company for an event, a walk, a meal, a conversation. It is not an escort service, and anything of that kind is removed.`],
  ["Can I use it outside " + CITY + "?", `Not yet. We are open in ${CITY} only while we get the safety side right.`],
];

export default function Home() {
  const navigate = useNavigate();
  const [city, setCity] = useState(CITY);

  const search = (e) => {
    e.preventDefault();
    navigate(`/discover?city=${encodeURIComponent(city)}`);
  };

  return (
    <>
      {/* ============================ hero ============================ */}
      <section className="relative overflow-hidden">
        {/* One wash of colour behind the deck, nowhere else on the page. */}
        <div
          aria-hidden="true"
          /* top-0, not a negative offset: clipping a blur part-way through
             leaves a hard bright line along the section's top edge, which
             reads as a rendering fault under the navbar. */
          className="pointer-events-none absolute -right-40 top-32 h-[32rem] w-[32rem] rounded-full opacity-[0.14] blur-[120px]"
          style={{ background: "radial-gradient(circle, var(--rose), transparent 70%)" }}
        />

        <div className="k-wrap relative grid items-center gap-14 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          {/* min-w-0: grid items are min-width:auto by default, so the deck
              card's nowrap text would otherwise widen the whole column past
              a phone screen instead of truncating. */}
          <div className="k-enter min-w-0">
            <Badge tone="accent" className="mb-6">
              <FiMapPin size={12} /> Now open in {CITY}
            </Badge>

            <h1 className="mb-5 max-w-[14ch]">Real people. Real hours.</h1>

            <p className="mb-8 max-w-[52ch] text-lg leading-relaxed text-muted">
              Book someone&rsquo;s time by the hour — company for a gig, a long walk, a meal you
              would rather not eat alone. They set the price. You see it before you pay.
            </p>

            <form onSubmit={search} className="mb-7 flex flex-col gap-2.5 sm:flex-row">
              <label htmlFor="city" className="sr-only">
                City
              </label>
              <select
                id="city"
                className="k-input sm:max-w-[12rem]"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              >
                {CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <Button type="submit" size="lg" className="sm:flex-1">
                <FiSearch size={17} /> Find people nearby
              </Button>
            </form>

            <div className="flex flex-wrap gap-2">
              <Badge>18+ only</Badge>
              <Badge>ID-checked Customers</Badge>
              <Badge>No sexual services</Badge>
            </div>
          </div>

          {/* The deck. Offset and tilted so it reads as a handful of cards
              rather than a screenshot of a grid. */}
          <div className="relative mx-auto w-full min-w-0 max-w-md lg:max-w-none">
            <div className="space-y-4">
              {SHOWCASE.map((person, i) => (
                <ShowcaseCard key={person.name} person={person} index={i} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================ how it works ============================ */}
      <section className="k-wrap py-16 lg:py-24" aria-labelledby="how">
        <h2 id="how" className="mb-3">
          How it works
        </h2>
        <p className="mb-12 max-w-prose text-muted">
          Three steps, and you only pay for the third one more than once.
        </p>

        {/* Numbered because this genuinely is a sequence. */}
        <ol className="grid gap-5 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <Card className="h-full">
                <span
                  className="mb-5 grid h-10 w-10 place-items-center rounded-full border border-rose-line bg-rose-soft text-sm font-extrabold text-rose"
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <h3 className="mb-2">{step.title}</h3>
                <p className="text-sm leading-relaxed text-muted">{step.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* ============================ safety ============================ */}
      <section className="border-y border-ink-line bg-ink-raised py-16 lg:py-24" aria-labelledby="safety">
        <div className="k-wrap">
          <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="safety" className="mb-3">
                What we do about safety
              </h2>
              <p className="max-w-prose text-muted">
                Paying to meet a stranger only works if the rules are real. These are enforced by
                people, not just written down.
              </p>
            </div>
            <Button to="/safety" variant="outline">
              <FiShield size={16} /> Safety centre
            </Button>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {SAFETY.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-4 rounded-card border border-ink-line bg-ink p-5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-soft text-rose">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <div>
                  <h4 className="mb-1.5">{title}</h4>
                  <p className="text-sm leading-relaxed text-muted">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ what members say ============================ */}
      <section className="k-wrap py-16 lg:py-24" aria-labelledby="said">
        <h2 id="said" className="mb-3">
          What members say
        </h2>
        <p className="mb-10 max-w-prose text-muted">
          We will put real quotes here once we have permission to use them. For now, these show
          what the cards look like.
        </p>

        <div className="grid gap-5 md:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <Card key={n} className="opacity-70">
              <div className="mb-4 space-y-2">
                <span className="k-skeleton block h-3 w-full" />
                <span className="k-skeleton block h-3 w-11/12" />
                <span className="k-skeleton block h-3 w-3/5" />
              </div>
              <div className="flex items-center gap-3">
                <span className="k-skeleton block h-9 w-9 rounded-full" />
                <span className="k-skeleton block h-3 w-24" />
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ============================ faq ============================ */}
      <section className="k-wrap pb-16 lg:pb-24" aria-labelledby="faq">
        <h2 id="faq" className="mb-10">
          Questions people ask
        </h2>

        <Accordion flush defaultActiveKey="0">
          {FAQ.map(([q, a], i) => (
            <Accordion.Item eventKey={String(i)} key={q}>
              <Accordion.Header>{q}</Accordion.Header>
              <Accordion.Body>{a}</Accordion.Body>
            </Accordion.Item>
          ))}
        </Accordion>
      </section>

      {/* ============================ last call ============================ */}
      <section className="k-wrap pb-24">
        <Card className="flex flex-col items-start justify-between gap-6 bg-ink-high sm:flex-row sm:items-center">
          <div>
            <h3 className="mb-2">Ready to meet someone?</h3>
            <p className="text-sm text-muted">
              Join in a couple of minutes. You can look around before you pay for anything.
            </p>
          </div>
          <Button to="/signup" size="lg">
            Join {BRAND}
          </Button>
        </Card>
      </section>
    </>
  );
}

/** One card in the hero deck. The price is the point, so it is the loudest. */
function ShowcaseCard({ person, index }) {
  return (
    <article
      className="k-card k-card-link k-deck-card animate-rise p-4"
      style={{
        // Each card sits a little further in, like a hand of cards. The
        // offset itself is applied in CSS and only on wide screens — on a
        // phone it would push the page wider than the viewport.
        "--deck-step": index,
        animationDelay: `${0.2 + index * 0.12}s`,
      }}
    >
      {/* Two rows rather than one. A single row has to truncate the name on
          a narrow screen, and a person's name is the last thing that should
          be cut to make room. */}
      <div className="flex items-center gap-4">
        <Avatar name={person.name} size={56} />

        <div className="min-w-0 flex-1">
          <p className="truncate font-bold leading-tight">
            {person.name}, {person.age}
          </p>
          <p className="mt-0.5 truncate text-sm text-muted">
            {person.area} &mdash; {person.km} km away
          </p>
        </div>
      </div>

      <div className="mt-3.5 flex items-center justify-between gap-3">
        <span className="k-badge">{person.tag}</span>
        <Price paise={person.paise} size="md" />
      </div>
    </article>
  );
}
