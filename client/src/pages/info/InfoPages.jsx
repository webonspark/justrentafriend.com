import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Accordion } from "react-bootstrap";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiLock,
  FiMapPin,
  FiMessageCircle,
  FiPhoneCall,
  FiShield,
  FiStar,
  FiUserCheck,
} from "react-icons/fi";
import { BRAND, CITY, LEGAL, MINIMUM_AGE } from "../../config/brand";
import { api } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { inr } from "../../lib/format";
import { REPORT_REASONS } from "../../lib/format";
import { Alert, Badge, Button, Card, Field, Skeleton } from "../../components/ui";
import { InfoPage, List, Mail, Section, Steps, useSiteConfig } from "./InfoLayout";

/**
 * The information pages. The legal pages live in LegalPages.jsx and are
 * re-exported from here, so App.jsx imports everything from one module.
 */

export {
  Terms,
  Privacy,
  Refunds,
  CommunityGuidelines,
  ChildSafety,
  AccountDeletion,
  GrievanceOfficer,
} from "./LegalPages";

/* ------------------------------ How it works ------------------------------ */

export function HowItWorks() {
  const { signedIn } = useAuth();
  return (
    <InfoPage
      eyebrow="How it works"
      title={`Real time with real people in ${CITY}`}
      intro="Book a verified local Companion for a coffee, a walk, a show or an event — strictly platonic, always in a public place."
    >
      <Section title="If you want to book a friend (Customer)">
        <Steps
          steps={[
            ["Join and get a membership", `Sign up, confirm your email and mobile, and choose a membership plan. You must be ${MINIMUM_AGE} or over.`],
            ["Find a Companion", "Search by area or near you, and filter by service, price, age, language, rating and the date you're free."],
            ["Send a request", "Pick a date, start time, duration, service and a public meeting place. Nothing is charged yet."],
            ["Pay once they accept", "The Companion accepts or declines. Once accepted, pay by UPI or card. We hold the money until after the meet."],
            ["Chat and meet", "Chat opens after payment. Check in when you arrive; the SOS button is there if you need it."],
            ["Confirm and review", "Confirm the meet happened to release the Companion's payout, then rate each other."],
          ]}
        />
      </Section>
      <Section title="If you want to be a Companion">
        <Steps
          steps={[
            ["Join and get a membership", "Sign up as a Companion and choose a membership plan."],
            ["Build your profile", "Add photos (moderated), a bio, languages, interests, your area, the services you offer and your hourly rate."],
            ["Get verified", "Verify your ID (Aadhaar or PAN) and take a selfie that's matched to your profile photo. You earn the Verified badge."],
            ["Get approved", "Our team reviews every Companion before they appear in search."],
            ["Set your calendar", "Choose the weekly hours you're free. Accept only the requests you want."],
            ["Meet and get paid", "After the meet the payout — your rate minus the platform commission — goes to your UPI or bank account."],
          ]}
        />
      </Section>
      <Section title="The rules that keep it safe">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            [FiShield, "Platonic only", "No sexual services or romantic arrangements, ever."],
            [FiMapPin, "Public places only", "Cafés, parks, malls, museums, events — never homes or hotel rooms."],
            [FiLock, "Money held in escrow", "Companions are paid only after the meet."],
            [FiMessageCircle, "Chat stays on the platform", "Phone numbers and handles are masked."],
          ].map(([Icon, t, b]) => (
            <Card key={t}>
              <Icon className="mb-2 text-rose" size={20} />
              <p className="mb-1 font-semibold">{t}</p>
              <p className="m-0 text-sm text-muted">{b}</p>
            </Card>
          ))}
        </div>
      </Section>
      {!signedIn && (
        <div className="flex flex-wrap gap-3">
          <Button to="/signup">Join {BRAND}</Button>
          <Button to="/pricing" variant="outline">
            See pricing
          </Button>
        </div>
      )}
    </InfoPage>
  );
}

/* ------------------------------ Pricing ------------------------------ */

export function Pricing() {
  const { commissionPct, freeHours, partialPct } = useSiteConfig();
  const [plans, setPlans] = useState(null);
  const [problem, setProblem] = useState("");

  useEffect(() => {
    api
      .plans()
      .then((d) => setPlans(d.plans))
      .catch(() => setProblem("Could not load the plans right now."));
  }, []);

  const example = 200000; // ₹2,000
  const commission = Math.floor((example * commissionPct) / 100);

  return (
    <InfoPage
      eyebrow="Pricing"
      title="Simple, upfront pricing"
      intro="A membership for both sides, and a commission on each booking that comes out of the Companion's rate — never added on top."
    >
      <Section title="Membership">
        <p>Membership is compulsory for Customers and Companions. It unlocks search, booking, being listed and chat.</p>
        <Alert>{problem}</Alert>
        <div className="grid gap-4 sm:grid-cols-3">
          {!plans &&
            !problem &&
            [0, 1, 2].map((i) => (
              <Card key={i}>
                <Skeleton className="mb-3 h-5 w-1/2" />
                <Skeleton className="h-8 w-2/3" />
              </Card>
            ))}
          {plans?.map((p) => (
            <Card key={p.id}>
              <p className="mb-1 font-semibold">{p.name}</p>
              <p className="mb-1 text-3xl font-bold text-rose">{inr(p.totalPaise)}</p>
              <p className="mb-3 text-xs text-muted">
                {inr(p.pricePaise)} + {inr(p.gstPaise)} GST · {p.days} days
              </p>
              {p.blurb && <p className="m-0 text-sm text-muted">{p.blurb}</p>}
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Each booking">
        <p>
          Companions set their own hourly rate. The Customer pays exactly the price shown. The platform commission —
          currently {commissionPct}% — is deducted from what the Companion receives. If GST on our platform fee applies,
          it is shown before you pay and on your tax invoice.
        </p>
        <Card>
          <p className="mb-3 font-semibold">Example: a ₹2,000 booking</p>
          <dl className="m-0 grid grid-cols-[1fr_auto] gap-y-2 text-sm">
            <dt className="text-muted">Customer pays</dt>
            <dd className="m-0 text-right font-semibold">{inr(example)}</dd>
            <dt className="text-muted">Platform commission ({commissionPct}%)</dt>
            <dd className="m-0 text-right">− {inr(commission)}</dd>
            <dt className="text-muted">Companion receives</dt>
            <dd className="m-0 text-right font-semibold text-rose">{inr(example - commission)}</dd>
          </dl>
        </Card>
      </Section>

      <Section title="Cancellations">
        <p>
          Full refund {freeHours} hours or more before the start, {partialPct}% inside {freeHours} hours, none after the start — and a full refund
          whenever the Companion cancels. These are the platform's default windows. <Link to={LEGAL.refunds}>Read the refund policy</Link>.
        </p>
      </Section>
    </InfoPage>
  );
}

/* ------------------------------ Safety centre ------------------------------ */

export function SafetyCentre() {
  const { signedIn } = useAuth();
  return (
    <InfoPage
      eyebrow="Safety"
      title="Safety centre"
      intro="Everything we do to keep meets safe — and what you can do too."
    >
      <div className="mb-10 rounded-panel border border-rose-line bg-rose-soft p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <FiPhoneCall size={28} className="mt-1 shrink-0 text-rose" />
          <div>
            <p className="mb-1 text-2xl font-bold">In danger? Call 112.</p>
            <p className="mb-4 text-muted">
              India's emergency number reaches police, fire and ambulance. Call first — then use the SOS button in the
              booking so your emergency contact gets your live location.
            </p>
            <Button href="tel:112">
              <FiPhoneCall /> Call 112
            </Button>
          </div>
        </div>
      </div>

      <Section title="Before you meet">
        <List
          items={[
            "Look for the Verified badge — the Companion's ID and selfie have been checked by our team.",
            "Read reviews. Ratings come only from completed bookings.",
            "Keep chat in the app. Never share your number, address or social handles, and never pay outside the app.",
            "Add an emergency contact in Settings so the SOS button can reach them.",
            "Tell a friend where you're going and when you expect to be back.",
          ]}
        />
        {signedIn && (
          <p>
            <Button to="/settings" variant="outline" size="sm">
              Set your emergency contact
            </Button>
          </p>
        )}
      </Section>

      <Section title="Public places only">
        <p>
          Every meet must be somewhere public: a café, restaurant, mall, park, museum or gallery, cinema or theatre,
          public event, bookstore, sports venue or landmark. Never a home, hotel room or car. Requests naming a private
          place are refused automatically.
        </p>
      </Section>

      <Section title="During the meet">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            [FiCheckCircle, "Check in and out", "Check in when you arrive and check out when you leave. It records that the meet happened and where."],
            [FiAlertTriangle, "SOS button", "On the booking page during a meet. It sends your live location to your emergency contact and alerts our safety team."],
            [FiMapPin, "Stay where you booked", "If the other person wants to move somewhere private, say no and leave."],
            [FiShield, "Leave whenever you want", "You never owe anyone more of your time. Report anything that made you uncomfortable."],
          ].map(([Icon, t, b]) => (
            <Card key={t}>
              <Icon className="mb-2 text-rose" size={20} />
              <p className="mb-1 font-semibold">{t}</p>
              <p className="m-0 text-sm text-muted">{b}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Report and block">
        <p>
          You can report or block anyone from their profile, the chat or the booking page. Blocking hides you from each
          other and closes the chat. Reports of harassment, solicitation or anyone who may be under {MINIMUM_AGE} go to
          the top of our queue.
        </p>
        <p>
          <Button to="/report" variant="outline" size="sm">
            Report an issue
          </Button>
        </p>
      </Section>

      <Section title="Useful numbers">
        <List
          items={[
            "Emergency: 112",
            "Women's helpline: 181",
            "Cyber crime: 1930 or cybercrime.gov.in",
            "Childline: 1098",
          ]}
        />
      </Section>
    </InfoPage>
  );
}

/* ------------------------------ Help ------------------------------ */

const FAQ = (commissionPct, freeHours, partialPct) => [
  ["What is this, exactly?", `${BRAND} lets you book a verified local Companion's time for platonic social activities in ${CITY} — coffee, a walk, a museum, a show, an event plus-one.`],
  ["Is it a dating or escort service?", "No. It is strictly platonic. Sexual services, solicitation and romantic arrangements are banned and lead to a permanent ban."],
  ["Who can join?", `Adults aged ${MINIMUM_AGE} and over. Your age is checked at sign-up, and Companions also verify their ID.`],
  ["Do both sides pay for membership?", "Yes. Membership is compulsory for Customers and Companions. See Pricing for the current plans."],
  ["How much does the platform take?", `${commissionPct}% of each booking, deducted from the Companion's rate. The Customer pays exactly the price shown.`],
  ["When am I charged for a booking?", "Only after the Companion accepts your request. The money is held by us and released to the Companion after the meet."],
  ["What if I need to cancel?", `Full refund ${freeHours} hours or more before the start, ${partialPct}% inside ${freeHours} hours, none after the start. If the Companion cancels you always get a full refund.`],
  ["Where do meets happen?", "In public places only — cafés, restaurants, malls, parks, museums, cinemas, events, bookstores, sports venues and landmarks. Never a home or hotel room."],
  ["Why can't I see their phone number?", "Contact details are masked in chat so that everything stays protected by the platform: escrow, refunds and safety tools."],
  ["What does the Verified badge mean?", "The Companion's government ID and a selfie matched to their photo have been checked by our team."],
  ["How do Companions get paid?", "To a UPI ID or bank account, after the meet is confirmed (or automatically 24 hours after it ends with no dispute). KYC must be approved first."],
  ["Something went wrong at a meet. What now?", "Open the booking and raise a problem. The payout is frozen until our team reviews it. If you are in danger, call 112."],
  ["How do I delete my account?", "Settings → Delete account. You have 30 days to change your mind by signing in again."],
];

export function Help() {
  const { commissionPct, supportEmail, freeHours, partialPct } = useSiteConfig();
  return (
    <InfoPage eyebrow="Help" title="Help and FAQ" intro="Answers to the questions we hear most.">
      <Accordion className="mb-10">
        {FAQ(commissionPct, freeHours, partialPct).map(([q, a], i) => (
          <Accordion.Item eventKey={String(i)} key={q}>
            <Accordion.Header>{q}</Accordion.Header>
            <Accordion.Body className="text-muted">{a}</Accordion.Body>
          </Accordion.Item>
        ))}
      </Accordion>
      <Card>
        <p className="mb-1 font-semibold">Still stuck?</p>
        <p className="m-0 text-sm text-muted">
          Email <Mail to={supportEmail} /> or see <Link to="/contact">Contact</Link>.
        </p>
      </Card>
    </InfoPage>
  );
}

/* ------------------------------ About ------------------------------ */

export function About() {
  return (
    <InfoPage
      eyebrow="About"
      title={`About ${BRAND}`}
      intro={`Big cities can be lonely. ${BRAND} makes it simple and safe to spend time with a friendly local — for an afternoon, an evening, or an event you'd rather not attend alone.`}
    >
      <Section title="What we believe">
        <List
          items={[
            "Company is valuable, and people who give their time should be paid fairly for it.",
            "Safety comes first: verified Companions, public places, money in escrow, and a safety team that reads every report.",
            "Platonic means platonic. That line is what makes the service trustworthy for everyone.",
          ]}
        />
      </Section>
      <Section title={`Starting in ${CITY}`}>
        <p>
          We are launching in one city so we can verify every Companion properly and respond quickly when something
          needs attention. More cities will follow.
        </p>
      </Section>
      <div className="flex flex-wrap gap-3">
        <Button to="/how-it-works">How it works</Button>
        <Button to="/safety" variant="outline">
          Safety centre
        </Button>
      </div>
    </InfoPage>
  );
}

/* ------------------------------ Blog ------------------------------ */

const POSTS = [
  ["Five first-meet spots that are always public", "Cafés with big windows, busy parks and galleries — where to meet and why.", "Safety"],
  ["How we verify every Companion", "ID, selfie face-match and a human review: what happens before anyone goes live.", "Trust"],
  ["A Companion's guide to setting your rate", "How to price your time, and what the platform commission actually covers.", "Companions"],
  [`Weekend ideas in ${CITY}`, "Food trails, museum afternoons and board-game cafés worth booking company for.", "Ideas"],
];

export function Blog() {
  return (
    <InfoPage eyebrow="Blog" title="Stories and guides" intro="Short reads on safety, ideas and getting the most out of your time.">
      <div className="grid gap-4 sm:grid-cols-2">
        {POSTS.map(([title, blurb, tag]) => (
          <Card key={title}>
            <Badge className="mb-3">{tag}</Badge>
            <h3 className="mb-2 text-lg">{title}</h3>
            <p className="mb-0 text-sm text-muted">{blurb}</p>
            <p className="mb-0 mt-3 text-xs text-muted">Coming soon</p>
          </Card>
        ))}
      </div>
    </InfoPage>
  );
}

/* ------------------------------ Contact ------------------------------ */

export function Contact() {
  const { supportEmail, grievanceEmail } = useSiteConfig();
  const { user } = useAuth();
  const [form, setForm] = useState({ name: user?.fullName || "", subject: "", message: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const send = (e) => {
    e.preventDefault();
    const body = `${form.message}\n\n— ${form.name}${user ? ` (${user.email})` : ""}`;
    window.location.href = `mailto:${supportEmail}?subject=${encodeURIComponent(form.subject || "Question")}&body=${encodeURIComponent(body)}`;
  };

  return (
    <InfoPage eyebrow="Contact" title="Get in touch" intro="We usually reply within one working day.">
      <div className="mb-10 grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="mb-1 font-semibold">Support</p>
          <p className="mb-2 text-sm text-muted">Bookings, payments, your account.</p>
          <Mail to={supportEmail} />
        </Card>
        <Card>
          <p className="mb-1 font-semibold">Grievance Officer</p>
          <p className="mb-2 text-sm text-muted">Complaints, data requests, appeals.</p>
          <Mail to={grievanceEmail} />
        </Card>
      </div>

      <form onSubmit={send} className="k-card k-card-pad mb-6">
        <Field label="Your name" id="c-name" value={form.name} onChange={set("name")} required />
        <Field label="Subject" id="c-subject" value={form.subject} onChange={set("subject")} />
        <Field label="Message" id="c-message" as="textarea" rows={5} value={form.message} onChange={set("message")} required />
        <Button type="submit">Open in my email app</Button>
      </form>
      <Alert tone="info">In an emergency, call 112. For safety concerns about a member, use Report on their profile, chat or booking.</Alert>
    </InfoPage>
  );
}

/* ------------------------------ Report an issue ------------------------------ */

export function ReportIssue() {
  const { signedIn } = useAuth();
  const { supportEmail } = useSiteConfig();
  return (
    <InfoPage
      eyebrow="Safety"
      title="Report an issue"
      intro="Every report is read by a person on our safety team, usually within 24 hours."
    >
      <div className="mb-10 rounded-panel border border-rose-line bg-rose-soft p-5">
        <p className="m-0 font-semibold">
          <FiPhoneCall className="me-2 inline text-rose" />
          If you or someone else is in danger right now, call 112.
        </p>
      </div>

      <Section title="How to report">
        {signedIn ? (
          <List
            items={[
              "A member: open their profile and choose Report.",
              "A message: open the chat, choose Report and the message is attached for our team.",
              "A booking or meet: open the booking and choose Report a problem, or Raise a dispute to freeze the payment.",
              "You can block someone at the same time — you'll stop seeing each other immediately.",
            ]}
          />
        ) : (
          <p>
            Sign in and report from the person's profile, the chat or the booking — that attaches the details we need.
            If you can't sign in, email <Mail to={supportEmail} /> with as much detail as you can.
          </p>
        )}
        {signedIn && (
          <p>
            <Button to="/bookings" variant="outline" size="sm">
              Go to my bookings
            </Button>
          </p>
        )}
      </Section>

      <Section title="What you can report">
        <List items={REPORT_REASONS.map(([, label]) => label)} />
      </Section>

      <Section title="What happens next">
        <List
          items={[
            "Urgent reports (solicitation, harassment, anyone who may be under 18) go to the top of the queue.",
            "We may review the chat and booking records — every such review is logged.",
            "Outcomes range from a warning to a permanent ban and, where needed, a report to the police.",
            "We'll let you know when we've reviewed your report. We don't share what action was taken against another member.",
          ]}
        />
      </Section>
    </InfoPage>
  );
}

/* ------------------------------ Payments ------------------------------ */

export function PaymentsInfo() {
  const { commissionPct } = useSiteConfig();
  return (
    <InfoPage eyebrow="Payments" title="How payments work" intro="Secure checkout, money held until the meet, and a GST invoice for every payment.">
      <Section title="Paying">
        <List
          items={[
            "Pay by UPI, debit or credit card, or netbanking through our payment partner (Razorpay). We never see or store your card or UPI PIN.",
            "Membership is paid upfront and activates immediately.",
            "A booking is paid only after the Companion accepts it.",
          ]}
        />
      </Section>
      <Section title="Escrow">
        <p>
          Booking payments are held by us — not passed to the Companion — until the meet is done. The payout is released
          when the Customer confirms the meet, or automatically 24 hours after its scheduled end if no one raises a
          problem. A dispute freezes the payout until our team decides.
        </p>
      </Section>
      <Section title="Commission and GST">
        <p>
          Our commission is {commissionPct}% of each booking, deducted from the Companion's rate. Membership prices
          include GST. Every payment comes with a tax invoice you can download from Payment history.
        </p>
      </Section>
      <Section title="Refunds">
        <p>
          Refunds go back to your original payment method, usually within 5–7 working days. See the{" "}
          <Link to={LEGAL.refunds}>refund policy</Link> for the cancellation windows.
        </p>
      </Section>
      <Section title="Payouts for Companions">
        <List
          items={[
            "Add a UPI ID or bank account (account number and IFSC) in your profile.",
            "Your identity verification (KYC) must be approved before your first payout. Until then, payouts are held safely.",
            "Each payout shows a bank reference in your Earnings dashboard.",
            "You are responsible for declaring your earnings for income tax.",
          ]}
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            [FiLock, "Held in escrow"],
            [FiUserCheck, "KYC before payout"],
            [FiStar, "Paid after the meet"],
          ].map(([Icon, t]) => (
            <Card key={t} className="flex items-center gap-3">
              <Icon className="text-rose" /> <span className="text-sm font-semibold">{t}</span>
            </Card>
          ))}
        </div>
      </Section>
    </InfoPage>
  );
}
