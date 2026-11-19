import { Link } from "react-router-dom";
import { BRAND, CITY, LEGAL, MINIMUM_AGE } from "../../config/brand";
import { Alert, Button } from "../../components/ui";
import { InfoPage, List, Mail, Section, useSiteConfig } from "./InfoLayout";

/**
 * The legal pages. Plain English, numbered sections, a last-updated date,
 * and a visible reminder that a lawyer must review them before launch.
 */


/* ------------------------------ Terms ------------------------------ */

export function Terms() {
  const { commissionPct, supportEmail, grievanceEmail } = useSiteConfig();
  const sections = [
    {
      title: "Who we are and what this is",
      body: (
        <>
          <p>
            {BRAND} ("we", "us") runs a platform in {CITY}, India that lets adults book a Companion's time for
            platonic social activities — a coffee, a city walk, a museum visit, an event plus-one. These Terms are a
            contract between you and us. By creating an account you accept them, together with our{" "}
            <Link to={LEGAL.privacy}>Privacy policy</Link>, <Link to={LEGAL.refunds}>Refund policy</Link> and{" "}
            <Link to={LEGAL.guidelines}>Community guidelines</Link>.
          </p>
          <p>
            We are an intermediary under the Information Technology Act, 2000. Companions are independent individuals,
            not our employees or agents. We provide the platform, payments, verification and safety tools.
          </p>
        </>
      ),
    },
    {
      title: "Accounts and eligibility",
      body: (
        <List
          items={[
            `You must be at least ${MINIMUM_AGE} years old. Your date of birth is checked at sign-up, and accounts found to belong to anyone younger are closed immediately.`,
            "You join as a Customer (you book Companions) or a Companion (you offer your time). One person, one account.",
            "The information you give must be true and kept up to date. Your email and mobile number are verified by one-time code.",
            "You are responsible for keeping your password safe and for everything done from your account.",
            "A paid membership is compulsory for both Customers and Companions before searching, booking, being listed or chatting.",
          ]}
        />
      ),
    },
    {
      title: "Strictly platonic, public-place meetings",
      body: (
        <>
          <p>
            Bookings are for social company only. Sexual services, solicitation, escorting, romantic or "dating"
            arrangements, and any request for physical intimacy are forbidden and will lead to a permanent ban and,
            where the law requires, a report to the police.
          </p>
          <p>
            Every meeting must take place in a public place — a café, restaurant, mall, park, museum or gallery,
            cinema or theatre, public event, bookstore, sports venue or landmark. Homes, hotel rooms, guest houses and
            other private spaces are never allowed.
          </p>
        </>
      ),
    },
    {
      title: "Companions",
      body: (
        <List
          items={[
            "Before going live, a Companion completes identity verification (Aadhaar or PAN via DigiLocker or a verification provider), a selfie liveness and face-match check, and is approved by our team.",
            "Photos are moderated. The \"Verified\" badge shows identity and selfie checks have passed — it is not an endorsement of character.",
            "Companions set their own hourly rate within the limits we publish, their services and their weekly availability, and may accept or decline any request.",
            "Companions are responsible for their own taxes on what they earn.",
          ]}
        />
      ),
    },
    {
      title: "Bookings and payment",
      body: (
        <>
          <p>
            A Customer sends a request for a date, time, duration, service and public meeting place. The Companion
            accepts or declines. Once accepted, the Customer pays through our payment partner. The money is held by us
            (escrow) and is released to the Companion after the meet — when the Customer confirms it took place, or
            automatically 24 hours after the scheduled end if no one has raised a problem.
          </p>
          <p>
            The Customer pays the price shown. Our commission ({commissionPct}% by default) is deducted from the
            Companion's rate, not added on top. If GST on our platform fee applies, it is shown before payment and on
            the tax invoice.
          </p>
          <p>
            Never pay or accept payment outside the platform. Off-platform payments are not protected, are a breach of
            these Terms, and are a common sign of a scam.
          </p>
        </>
      ),
    },
    {
      title: "Cancellations, refunds and disputes",
      body: (
        <p>
          Cancellation and refund rules are set out in the <Link to={LEGAL.refunds}>Refund policy</Link>. Either
          side may raise a dispute on a confirmed booking; the payout is frozen until our team decides, and our decision
          on the release or refund of funds held by us is final as between the two members, without affecting any
          rights you have under law.
        </p>
      ),
    },
    {
      title: "Chat and conduct",
      body: (
        <>
          <p>
            Chat opens only once a booking is paid for. Phone numbers, emails, UPI IDs and social handles are masked,
            and messages are automatically checked for content that breaks our policies. Flagged and reported messages
            may be reviewed by our safety team; every such review is logged.
          </p>
          <p>
            You agree to follow the <Link to={LEGAL.guidelines}>Community guidelines</Link>. You may report or block
            anyone at any time.
          </p>
        </>
      ),
    },
    {
      title: "Safety tools",
      body: (
        <p>
          We provide check-in and check-out, an SOS button that shares your live location with your emergency contact,
          reporting and blocking. These tools help, but they do not replace your own judgement or the emergency
          services. In an emergency, call 112.
        </p>
      ),
    },
    {
      title: "Reviews",
      body: (
        <p>
          After a completed booking, the Customer and the Companion may each rate the other once. Reviews must be
          honest and about the meeting. We may hide reviews that are abusive, contain personal information or are
          clearly not genuine.
        </p>
      ),
    },
    {
      title: "Suspension and termination",
      body: (
        <p>
          We may warn, suspend or ban an account, cancel bookings, or withhold a payout pending investigation, where we
          reasonably believe these Terms, our guidelines or the law have been broken, or to protect someone's safety.
          You may delete your account at any time — see <Link to={LEGAL.deletion}>Deleting your account</Link>.
        </p>
      ),
    },
    {
      title: "Our responsibility",
      body: (
        <p>
          We take reasonable care in verifying Companions and running the platform, but we cannot guarantee how any
          member will behave. To the extent the law allows, we are not liable for indirect loss, and our total liability
          to you for any claim is limited to the amount you paid us in the three months before it arose. Nothing here
          limits liability that cannot be limited under Indian law.
        </p>
      ),
    },
    {
      title: "Changes, law and contact",
      body: (
        <>
          <p>
            We may update these Terms and will tell you of material changes before they take effect. These Terms are
            governed by the laws of India, and the courts at {CITY} have jurisdiction.
          </p>
          <p>
            Questions: <Mail to={supportEmail} />. Complaints: our <Link to={LEGAL.grievance}>Grievance Officer</Link>{" "}
            at <Mail to={grievanceEmail} />.
          </p>
        </>
      ),
    },
  ];
  return <InfoPage eyebrow="Legal" title="Terms of use" intro="The rules for using the platform." sections={sections} toc legal />;
}

/* ------------------------------ Privacy ------------------------------ */

export function Privacy() {
  const { supportEmail, grievanceEmail } = useSiteConfig();
  const sections = [
    {
      title: "Who is responsible for your data",
      body: (
        <p>
          {BRAND} is the Data Fiduciary for personal data processed through this platform under the Digital Personal
          Data Protection Act, 2023 ("DPDP Act"). This policy explains what we collect, why, who we share it with and
          the rights you have.
        </p>
      ),
    },
    {
      title: "What we collect",
      body: (
        <List
          items={[
            "Account: name, email, mobile number, date of birth, password (stored only as a one-way hash), role.",
            "Profile: photos, bio, gender, languages, interests, city and area, services and rates (Companions), availability.",
            "Location: an approximate location you choose to save, used to show distance. Your exact position is never shown to other members. During an SOS, your live location is shared with your emergency contact and our safety team.",
            "Verification (Companions): the type of ID document, its last four digits, an image of the document and a selfie. The full Aadhaar or PAN number is never stored by us.",
            "Bookings, payments and payouts: what was booked, amounts, invoices, refund records, and the UPI ID or last four digits and IFSC of a payout account. Card and UPI credentials are handled by our payment partner, not us.",
            "Chat messages, reports, blocks, reviews and safety records.",
            "Technical: IP address, device and browser information, sign-in times and security logs.",
          ]}
        />
      ),
    },
    {
      title: "Why we use it",
      body: (
        <List
          items={[
            "To run your account and the service you asked for (bookings, payments, chat, payouts).",
            "To keep members safe: age checks, identity verification, moderation, fraud prevention, investigating reports and responding to SOS alerts.",
            "To meet legal obligations: tax invoices, accounting records, and lawful requests from authorities.",
            "To send you service messages by email, SMS, WhatsApp or push. You can turn off non-essential email in Settings.",
          ]}
        />
      ),
    },
    {
      title: "Consent",
      body: (
        <p>
          We ask for your consent at sign-up and record when and to which version you agreed. You may withdraw consent
          at any time by deleting your account; withdrawal does not affect processing already done, or records we must
          keep by law.
        </p>
      ),
    },
    {
      title: "Who we share it with",
      body: (
        <>
          <p>We never sell your personal data. We share only what is needed with:</p>
          <List
            items={[
              "The other member of a booking: your first name, photos, area, rating and the booking details. Contact details are masked in chat.",
              "Service providers acting for us: payment gateway (e.g. Razorpay), payout partner, identity verification (DigiLocker or a provider such as IDfy or Signzy), SMS/WhatsApp/email and hosting providers — under contracts that limit their use of your data.",
              "Your emergency contact, only when you raise an SOS.",
              "Police or other authorities, where the law requires or where someone's life or safety is at risk.",
            ]}
          />
        </>
      ),
    },
    {
      title: "How long we keep it",
      body: (
        <List
          items={[
            "While your account is open, and for 30 days after you ask to delete it (so you can change your mind).",
            "After that, your profile, photos, verification images, location and contact details are erased.",
            "Payment, invoice and payout records are kept for as long as tax and accounting law requires (generally eight years), with your identity minimised.",
            "Records connected to a safety investigation or legal claim are kept until it is closed.",
          ]}
        />
      ),
    },
    {
      title: "Security",
      body: (
        <p>
          Passwords are hashed, sessions use short-lived tokens, verification documents are stored privately and are
          visible only to authorised staff, and every staff view of a document or private chat is written to an audit
          log. No system is perfectly secure; if a breach affects you, we will tell you and the Data Protection Board as
          the DPDP Act requires.
        </p>
      ),
    },
    {
      title: "Your rights",
      body: (
        <>
          <p>Under the DPDP Act you may:</p>
          <List
            items={[
              "Access a summary of your personal data and how it is processed.",
              "Correct or update it (most of it directly in your profile and settings).",
              "Erase it, by deleting your account.",
              "Nominate another person to exercise your rights if you die or become incapacitated.",
              "Have your complaint addressed by our Grievance Officer, and then by the Data Protection Board of India.",
            ]}
          />
          <p>
            Write to <Mail to={supportEmail} /> or our Grievance Officer at <Mail to={grievanceEmail} />.
          </p>
        </>
      ),
    },
    {
      title: "Children",
      body: (
        <p>
          The service is for adults aged {MINIMUM_AGE} and over only. We do not knowingly process data of children; any
          such account is closed and its data deleted. See our <Link to={LEGAL.childSafety}>Child safety policy</Link>.
        </p>
      ),
    },
    {
      title: "Changes",
      body: <p>We will tell you about material changes to this policy before they take effect.</p>,
    },
  ];
  return <InfoPage eyebrow="Legal" title="Privacy policy" intro="What we collect, why, and your rights under the DPDP Act, 2023." sections={sections} toc legal />;
}

/* ------------------------------ Refunds ------------------------------ */

export function Refunds() {
  const { supportEmail, freeHours, partialPct } = useSiteConfig();
  const sections = [
    {
      title: "How booking payments work",
      body: (
        <p>
          You pay only after the Companion accepts your request. Your money is held by us (escrow) — the Companion does
          not receive it until the meet is complete. That is what makes a refund possible when something goes wrong.
        </p>
      ),
    },
    {
      title: "If you cancel (Customer)",
      body: (
        <>
          <p>These are the default windows set by the platform; the exact rule is shown before you confirm a cancellation.</p>
          <List
            items={[
              `${freeHours} hours or more before the start: full refund.`,
              `Less than ${freeHours} hours before the start: ${partialPct}% refund. The rest goes to the Companion (less our commission) for the time they kept free.`,
              "After the start time: no refund.",
              "Before you have paid (request pending or accepted): nothing is charged.",
            ]}
          />
        </>
      ),
    },
    {
      title: "If the Companion cancels or declines",
      body: <p>You get a full refund, whenever they cancel. A declined or expired request is never charged.</p>,
    },
    {
      title: "No-shows and problems at the meet",
      body: (
        <p>
          If the other person does not turn up, or the meet breaks our rules, raise a dispute from the booking page
          before the payout is released (within 24 hours of the scheduled end). The payout is frozen while our team
          reviews messages, check-in records and both accounts. We may refund in full, in part, or release the payment
          to the Companion.
        </p>
      ),
    },
    {
      title: "Membership fees",
      body: (
        <p>
          Membership activates immediately and is not refundable once used, except where required by law or where we
          close your account without cause. If you were charged twice or charged for a membership that never
          activated, write to <Mail to={supportEmail} /> and we will refund the duplicate.
        </p>
      ),
    },
    {
      title: "How and when refunds arrive",
      body: (
        <p>
          Refunds go back to the original payment method (UPI, card or netbanking) through our payment partner. They
          usually appear within 5–7 working days, depending on your bank. GST on our platform fee is refunded in the
          same proportion.
        </p>
      ),
    },
  ];
  return <InfoPage eyebrow="Legal" title="Refunds and cancellation" intro="What happens to your money if plans change." sections={sections} toc legal />;
}

/* ------------------------------ Community guidelines ------------------------------ */

export function CommunityGuidelines() {
  const sections = [
    {
      title: "Platonic only",
      body: (
        <p>
          {BRAND} is for friendship and company. No sexual services, no solicitation, no escorting, no romantic or
          "girlfriend/boyfriend experience" arrangements, no requests for physical intimacy. Asking for any of these is
          the fastest way to a permanent ban.
        </p>
      ),
    },
    {
      title: "Public places, every time",
      body: (
        <List
          items={[
            "Meet only in public places: cafés, restaurants, malls, parks, museums and galleries, cinemas and theatres, public events, bookstores, sports venues, landmarks.",
            "Never a home, hotel room, guest house, car or any private space — even if both of you agree.",
            "Stay at the place booked. Moving somewhere else, especially somewhere private, is a reason to end the meet.",
          ]}
        />
      ),
    },
    {
      title: "Respect and consent",
      body: (
        <List
          items={[
            "No harassment, threats, stalking, hate speech or discrimination.",
            "No unwanted touching. A handshake is fine; anything else needs clear agreement and stays platonic.",
            "No alcohol or drugs to the point of impairment. Either side may leave if they feel unsafe.",
            "Do not photograph or record the other person without their permission.",
          ]}
        />
      ),
    },
    {
      title: "Honesty",
      body: (
        <List
          items={[
            "Use your own, recent photos. No filters that change who you are, no other people's photos.",
            "Be who you say you are. Fake profiles and impersonation are banned.",
            "Turn up on time, or cancel through the app as early as you can.",
          ]}
        />
      ),
    },
    {
      title: "Keep it on the platform",
      body: (
        <p>
          Don't share phone numbers, social handles or UPI IDs, and never pay or accept money outside the app. Chat
          masks contact details automatically. Off-platform deals lose every protection we offer — refunds, escrow,
          safety tools — and are a breach of our Terms.
        </p>
      ),
    },
    {
      title: "Photos and content",
      body: (
        <p>
          Photos are moderated before anyone sees them. No nudity, sexual poses, weapons, drugs, children, or images of
          other people without consent. Bios and messages follow the same rules.
        </p>
      ),
    },
    {
      title: "What happens when rules are broken",
      body: (
        <p>
          Depending on what happened: a warning, removal of content, suspension, a permanent ban, withholding of a
          payout pending investigation, and — for anything illegal — a report to the police. Report anything that
          worries you from the person's profile, the chat or the booking page, or via <Link to="/report">Report an issue</Link>.
        </p>
      ),
    },
  ];
  return <InfoPage eyebrow="Legal" title="Community guidelines" intro="How everyone here is expected to behave." sections={sections} toc legal />;
}

/* ------------------------------ Child safety ------------------------------ */

export function ChildSafety() {
  const { supportEmail, grievanceEmail } = useSiteConfig();
  const sections = [
    {
      title: "Zero tolerance",
      body: (
        <p>
          {BRAND} has zero tolerance for child sexual abuse material (CSAM), the sexualisation of minors, grooming, or
          any attempt to involve a person under {MINIMUM_AGE} in the service. Any such content or conduct leads to an
          immediate permanent ban, preservation of evidence and a report to the authorities.
        </p>
      ),
    },
    {
      title: `${MINIMUM_AGE}+ only`,
      body: (
        <List
          items={[
            `Every account must belong to someone aged ${MINIMUM_AGE} or over. The date of birth is checked on the server at sign-up.`,
            "Companions are additionally verified with a government ID (Aadhaar or PAN) and a selfie face-match before they can be listed.",
            "Photos are reviewed by moderators before they appear, and anything suggesting a minor is rejected.",
            "Bringing a minor to a meet, or arranging a meet for or with a minor, is forbidden.",
          ]}
        />
      ),
    },
    {
      title: "How to report",
      body: (
        <>
          <p>
            Use "Report" on any profile, message or booking and choose "Appears to be under 18". These reports go to the
            top of our safety queue. You can also email <Mail to={supportEmail} /> or our Grievance Officer at{" "}
            <Mail to={grievanceEmail} />.
          </p>
          <p>
            If a child is in immediate danger, call <strong>112</strong>. You can also call Childline on{" "}
            <strong>1098</strong>, and report CSAM to the National Cyber Crime Reporting Portal at{" "}
            <a href="https://cybercrime.gov.in" target="_blank" rel="noreferrer" className="text-rose">
              cybercrime.gov.in
            </a>
            .
          </p>
        </>
      ),
    },
    {
      title: "What we do with a report",
      body: (
        <List
          items={[
            "Suspend the account at once while we investigate.",
            "Preserve the evidence securely and restrict access to authorised staff, with every view logged.",
            "Report to Indian law enforcement as required under the POCSO Act, 2012 and the IT Rules, and to NCMEC (the US National Center for Missing & Exploited Children) where applicable.",
            "Cooperate fully with lawful requests from the police and courts.",
          ]}
        />
      ),
    },
    {
      title: "Contact for child-safety concerns",
      body: (
        <p>
          Our designated contact for child safety is the Grievance Officer: <Mail to={grievanceEmail} />. We
          acknowledge child-safety reports within 24 hours.
        </p>
      ),
    },
  ];
  return <InfoPage eyebrow="Legal" title="Child safety policy" intro="Our standards against child sexual abuse and exploitation." sections={sections} toc legal />;
}

/* ------------------------------ Account deletion ------------------------------ */

export function AccountDeletion() {
  const { supportEmail } = useSiteConfig();
  return (
    <InfoPage
      eyebrow="Your data"
      title="Deleting your account"
      intro={`How to delete your ${BRAND} account and what happens to your data.`}
      legal
    >
      <Section title="Delete it in the app">
        <List
          items={[
            "Sign in and open Settings.",
            "Scroll to \"Delete account\", enter your password and confirm.",
            "You are signed out on every device and your profile is hidden immediately.",
          ]}
        />
        <p>
          <Button to="/settings" variant="outline" size="sm">
            Go to Settings
          </Button>
        </p>
        <p>
          You cannot delete an account while a booking is confirmed or under dispute — finish or cancel it first. Pending
          requests are cancelled automatically.
        </p>
      </Section>
      <Section title="The 30-day grace period">
        <p>
          For 30 days you can change your mind: simply sign in again and your account is restored. After 30 days it is
          erased for good.
        </p>
      </Section>
      <Section title="What is deleted">
        <List
          items={[
            "Your name, email, mobile number and password.",
            "Your profile, bio, photos, location and emergency contact.",
            "Identity documents and selfies (Companions), and your payout account details.",
          ]}
        />
      </Section>
      <Section title="What is kept, and why">
        <List
          items={[
            "Payment, invoice and payout records — tax and accounting law requires us to keep them (generally eight years). They are kept with your identity removed.",
            "Reports, reviews you left (shown as \"Deleted member\") and safety records connected to an open investigation or legal claim, until it is closed.",
          ]}
        />
      </Section>
      <Section title="Can't sign in?">
        <p>
          Email <Mail to={supportEmail} /> from the address on your account with the subject "Delete my account". We
          will verify it is you and complete the deletion within 30 days.
        </p>
      </Section>
    </InfoPage>
  );
}

/* ------------------------------ Grievance officer ------------------------------ */

export function GrievanceOfficer() {
  const { grievanceEmail } = useSiteConfig();
  return (
    <InfoPage
      eyebrow="Legal"
      title="Grievance officer"
      intro="Published under the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 and the DPDP Act, 2023."
      legal
    >
      <div className="k-card k-card-pad mb-10">
        <p className="mb-1 text-sm text-muted">Grievance Officer</p>
        <p className="mb-3 text-lg font-semibold">{BRAND}</p>
        <p className="mb-1">
          Email: <Mail to={grievanceEmail} />
        </p>
        <p className="m-0 text-muted">Address: [Registered address], {CITY}, India</p>
      </div>
      <Section title="What you can raise">
        <List
          items={[
            "Content or conduct on the platform that breaks the law, our Terms or our Community guidelines.",
            "Complaints about how your personal data is handled, or requests under the DPDP Act.",
            "Appeals against a suspension, ban or content removal.",
            "Payment, refund or payout complaints that support has not resolved.",
          ]}
        />
      </Section>
      <Section title="Timelines">
        <List
          items={[
            "We acknowledge every complaint within 24 hours.",
            "We resolve it within 15 days of receipt.",
            "Content that exposes someone's private areas, shows nudity or sexual acts, or impersonates someone is acted on within 24 hours of a complaint from the person concerned.",
          ]}
        />
      </Section>
      <Section title="How to write to us">
        <p>
          Include your name, the email on your account, what happened, links or booking numbers, and what you would like
          us to do. If you are not satisfied with our answer, you may approach the Grievance Appellate Committee under
          the IT Rules or, for data matters, the Data Protection Board of India.
        </p>
      </Section>
      <Alert tone="info">In an emergency, do not wait for email — call 112.</Alert>
    </InfoPage>
  );
}
