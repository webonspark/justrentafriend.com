import { useEffect, useRef, useState } from "react";
import { FiCamera, FiCheckCircle, FiCircle, FiPlus, FiStar, FiTrash2, FiUpload } from "react-icons/fi";
import { api, ApiError } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { WEEKDAYS } from "../../lib/format";
import { Alert, Badge, Button, Card, Field, Skeleton } from "../../components/ui";

/**
 * My profile.
 *
 * For a Companion this is also the go-live checklist: about, services and
 * rate, calendar, photos, ID (Aadhaar/PAN), selfie check, payout account,
 * then "Submit for review". An admin approves before they appear in search.
 * A Customer edits the basics and their photo.
 */
export default function MyProfile() {
  const { isCompanion, user, refreshUser } = useAuth();
  const [me, setMe] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [problem, setProblem] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    api.myProfile().then(setMe).catch((e) => setProblem(e instanceof ApiError ? e.message : "Could not load your profile."));
    api.catalog().then(setCatalog).catch(() => {});
  }, []);

  /** Runs a change and keeps the page in step with what the server saved. */
  const save = async (fn, message) => {
    setProblem("");
    setNotice("");
    try {
      const next = await fn();
      setMe(next);
      if (message) setNotice(message);
      refreshUser().catch(() => {});
      return true;
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : "That did not save. Try again.");
      return false;
    }
  };

  if (!me) return <div className="k-wrap py-10">{problem ? <Alert>{problem}</Alert> : <Skeleton className="h-96 w-full rounded-2xl" />}</div>;

  return (
    <div className="k-wrap py-8 lg:py-12">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mb-1 text-[2rem]">My profile</h1>
          <p className="m-0 text-muted">{user.fullName} · {isCompanion ? "Companion" : "Customer"}{me.profile.verified && " · "}{me.profile.verified && <Badge tone="good">Verified</Badge>}</p>
        </div>
        {isCompanion && me.profile.approvalStatus === "approved" && <Button to={`/companions/${user.id}`} variant="outline">View public profile</Button>}
      </div>

      <div className="sticky top-[68px] z-10 -mx-4 bg-ink/90 px-4 py-2 backdrop-blur">
        <Alert tone="good">{notice}</Alert>
        <Alert>{problem}</Alert>
      </div>

      {isCompanion && <GoLive me={me} save={save} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <About me={me} catalog={catalog} isCompanion={isCompanion} save={save} />
        <Photos me={me} save={save} isCompanion={isCompanion} />
        {isCompanion && <ServicesAndRate me={me} catalog={catalog} save={save} />}
        {isCompanion && <Calendar me={me} save={save} />}
        {isCompanion && <BookingRules me={me} save={save} />}
        <Verification me={me} save={save} isCompanion={isCompanion} />
        {isCompanion && <PayoutAccount me={me} save={save} />}
      </div>
    </div>
  );
}

/* ------------------------------ go-live ------------------------------ */

const STEPS = [
  ["about", "About you (bio of 30+ characters, gender, area, languages)"],
  ["services", "At least one service"],
  ["rate", "Hourly rate"],
  ["availability", "Weekly availability"],
  ["photo", "A profile photo"],
  ["kyc", "ID check — Aadhaar or PAN"],
  ["selfie", "Selfie check"],
];

function GoLive({ me, save }) {
  const [busy, setBusy] = useState(false);
  const status = me.profile.approvalStatus;
  const list = me.checklist || {};
  const ready = STEPS.every(([k]) => list[k]);
  const tone = { approved: "good", pending: "warn", rejected: "warn", draft: "plain" }[status];
  const label = { approved: "Live — you appear in search", pending: "With our team for review", rejected: "Changes needed", draft: "Not submitted yet" }[status];

  return (
    <Card className="mb-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-lg">Going live</h2>
        <Badge tone={tone}>{label}</Badge>
      </div>
      {status === "rejected" && me.profile.approvalNote && <Alert>{me.profile.approvalNote}</Alert>}
      <ul className="mb-4 grid list-none gap-1 p-0 sm:grid-cols-2">
        {STEPS.map(([k, text]) => (
          <li key={k} className="flex items-center gap-2 text-sm">
            {list[k] ? <FiCheckCircle className="text-[var(--good)]" /> : <FiCircle className="text-muted" />} {text}
          </li>
        ))}
      </ul>
      {status !== "approved" && status !== "pending" && (
        <Button
          disabled={!ready}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await save(() => api.submitForApproval(), "Submitted. We review new Companions within two working days.");
            setBusy(false);
          }}
        >
          Submit for review
        </Button>
      )}
      {status === "pending" && <p className="m-0 text-sm text-muted">We will notify you when it is approved. You can keep editing meanwhile.</p>}
      <p className="mb-0 mt-3 text-xs text-muted">You also need an active membership to appear in search.</p>
    </Card>
  );
}

/* ------------------------------ about ------------------------------ */

function About({ me, catalog, isCompanion, save }) {
  const [f, setF] = useState({
    bio: me.profile.bio || "",
    gender: me.profile.gender || "",
    area: me.profile.area || "",
    occupation: me.profile.occupation || "",
    languages: me.profile.languages,
    interestIds: me.interestIds,
  });
  const [busy, setBusy] = useState(false);
  const toggle = (key, v) => setF((x) => ({ ...x, [key]: x[key].includes(v) ? x[key].filter((y) => y !== v) : [...x[key], v] }));

  const locate = () =>
    navigator.geolocation?.getCurrentPosition((p) =>
      save(() => api.updateProfile({ latitude: p.coords.latitude, longitude: p.coords.longitude }), "Location saved. Only your area name and a rounded distance are ever shown.")
    );

  return (
    <Card>
      <h2 className="mb-4 text-lg">About you</h2>
      <Field as="textarea" rows={4} label={isCompanion ? "Bio — what are you like to spend time with?" : "Bio (optional)"} id="bio" value={f.bio} maxLength={1000} onChange={(e) => setF({ ...f, bio: e.target.value })} hint={`${f.bio.length}/1000`} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field as="select" label="Gender" id="gender" value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}>
          <option value="">Choose</option>
          <option value="female">Woman</option>
          <option value="male">Man</option>
          <option value="other">Non-binary / other</option>
          <option value="prefer_not_to_say">Prefer not to say</option>
        </Field>
        <Field as="select" label="Area / neighbourhood" id="area" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })}>
          <option value="">Choose your area</option>
          {/* Keep an older free-text area selectable until it is changed. */}
          {f.area && !(catalog?.areas || []).includes(f.area) && <option value={f.area}>{f.area}</option>}
          {(catalog?.areas || []).map((a) => <option key={a} value={a}>{a}</option>)}
        </Field>
      </div>
      <Field label="Occupation (optional)" id="occupation" value={f.occupation} onChange={(e) => setF({ ...f, occupation: e.target.value })} />
      <span className="k-label">Languages</span>
      <div className="mb-4 flex flex-wrap gap-2">
        {(catalog?.languages || []).map((l) => (
          <Chip key={l} on={f.languages.includes(l)} onClick={() => toggle("languages", l)}>{l}</Chip>
        ))}
      </div>
      <span className="k-label">Interests</span>
      <div className="mb-4 flex flex-wrap gap-2">
        {(catalog?.interests || []).map((i) => (
          <Chip key={i.id} on={f.interestIds.includes(i.id)} onClick={() => toggle("interestIds", i.id)}>{i.name}</Chip>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button loading={busy} onClick={async () => { setBusy(true); await save(() => api.updateProfile(f), "Saved."); setBusy(false); }}>Save</Button>
        <Button variant="outline" onClick={locate}>{me.profile.latitude ? "Update my location" : "Use my location"}</Button>
      </div>
    </Card>
  );
}

function Chip({ on, onClick, children }) {
  return (
    <button type="button" onClick={onClick} className={`k-badge ${on ? "k-badge-accent" : ""}`} style={{ cursor: "pointer" }} aria-pressed={on}>
      {children}
    </button>
  );
}

/* ------------------------------ photos ------------------------------ */

function Photos({ me, save, isCompanion }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    await save(() => api.uploadPhoto(file), "Photo uploaded. It shows publicly once our team approves it.");
    setBusy(false);
  };
  const tone = { approved: "good", pending: "warn", rejected: "plain" };

  return (
    <Card>
      <h2 className="mb-1 text-lg">Photos</h2>
      <p className="mb-4 text-sm text-muted">Clear, recent photos of you alone. Every photo is checked by our team before it is shown.{isCompanion && " Your selfie check is matched against your main photo."}</p>
      {me.photos.length === 0 && (
        <p className="mb-4 rounded-xl border border-ink-line bg-ink-high p-3 text-sm">
          <strong>Tip:</strong> {isCompanion ? "profiles with a clear, friendly photo get many more booking requests." : "Companions are more likely to accept requests from members with a photo."} Until you add one, people see a plain placeholder.
        </p>
      )}
      <div className="mb-4 grid grid-cols-3 gap-3">
        {me.photos.map((p) => (
          <div key={p.id} className="relative overflow-hidden rounded-xl bg-ink-high">
            <img src={p.thumbUrl} alt="" className="aspect-square w-full object-cover" />
            <div className="absolute left-1 top-1"><Badge tone={tone[p.moderationStatus]}>{p.isPrimary ? "Main · " : ""}{p.moderationStatus}</Badge></div>
            <div className="absolute bottom-1 right-1 flex gap-1">
              {!p.isPrimary && <button type="button" className="k-btn k-btn-sm k-btn-outline bg-ink/80" onClick={() => save(() => api.primaryPhoto(p.id), "Main photo changed.")} aria-label="Make main photo"><FiStar size={12} /></button>}
              <button type="button" className="k-btn k-btn-sm k-btn-outline bg-ink/80" onClick={() => window.confirm("Delete this photo?") && save(() => api.deletePhoto(p.id), "Photo deleted.")} aria-label="Delete photo"><FiTrash2 size={12} /></button>
            </div>
            {p.rejectionReason && <p className="m-0 p-1 text-[0.6875rem] text-muted">{p.rejectionReason}</p>}
          </div>
        ))}
        {me.photos.length < 6 && (
          <button type="button" onClick={() => input.current?.click()} className="grid aspect-square place-items-center rounded-xl border border-dashed border-ink-line text-muted" disabled={busy}>
            {busy ? "Uploading…" : <FiPlus size={22} />}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={upload} />
    </Card>
  );
}

/* ------------------------------ services & rate ------------------------------ */

function ServicesAndRate({ me, catalog, save }) {
  const [ids, setIds] = useState(me.serviceIds);
  const [rate, setRate] = useState(me.pricePerHourPaise ? me.pricePerHourPaise / 100 : "");
  const [busy, setBusy] = useState(false);
  const toggle = (id) => setIds((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  return (
    <Card>
      <h2 className="mb-4 text-lg">Services and rate</h2>
      <span className="k-label">What do you offer?</span>
      <div className="mb-4 space-y-2">
        {(catalog?.services || []).map((s) => (
          <label key={s.id} className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={ids.includes(s.id)} onChange={() => toggle(s.id)} />
            <span><strong>{s.name}</strong>{s.description && <span className="text-muted"> — {s.description}</span>}</span>
          </label>
        ))}
      </div>
      <Field label="Your hourly rate (₹)" id="rate" type="number" min="0" step="50" value={rate} onChange={(e) => setRate(e.target.value)}
        hint="Customers pay this. The platform fee is deducted from it; you receive the rest after each meet." />
      <Button loading={busy} onClick={async () => { setBusy(true); await save(() => api.updateProfile({ serviceIds: ids, pricePerHourPaise: Math.round(Number(rate) * 100) }), "Services and rate saved."); setBusy(false); }}>Save</Button>
    </Card>
  );
}

/* ------------------------------ calendar ------------------------------ */

function Calendar({ me, save }) {
  const [slots, setSlots] = useState(me.availability);
  const [busy, setBusy] = useState(false);
  const add = (weekday) => setSlots((s) => [...s, { weekday, startTime: "18:00", endTime: "21:00" }]);
  const change = (i, k, v) => setSlots((s) => s.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const remove = (i) => setSlots((s) => s.filter((_, j) => j !== i));

  return (
    <Card>
      <h2 className="mb-1 text-lg">Weekly availability</h2>
      <p className="mb-4 text-sm text-muted">Customers can only request times inside these windows. Times are in IST.</p>
      <div className="mb-4 space-y-3">
        {WEEKDAYS.map((day, d) => (
          <div key={day} className="border-b border-ink-line pb-2">
            <div className="flex items-center justify-between">
              <strong className="text-sm">{day}</strong>
              <button type="button" className="k-btn k-btn-ghost k-btn-sm" onClick={() => add(d)}><FiPlus size={13} /> Add</button>
            </div>
            {slots.map((s, i) =>
              s.weekday === d ? (
                <div key={i} className="mt-1 flex items-center gap-2">
                  <input type="time" step="1800" className="k-input" value={s.startTime} onChange={(e) => change(i, "startTime", e.target.value)} aria-label={`${day} start`} />
                  <span>–</span>
                  <input type="time" step="1800" className="k-input" value={s.endTime} onChange={(e) => change(i, "endTime", e.target.value)} aria-label={`${day} end`} />
                  <button type="button" className="k-btn k-btn-ghost k-btn-sm" onClick={() => remove(i)} aria-label="Remove"><FiTrash2 size={13} /></button>
                </div>
              ) : null
            )}
          </div>
        ))}
      </div>
      <Button loading={busy} onClick={async () => { setBusy(true); await save(() => api.setAvailability(slots), "Availability saved."); setBusy(false); }}>Save availability</Button>
    </Card>
  );
}

/* ------------------------------ verification ------------------------------ */

function Verification({ me, save, isCompanion }) {
  const [docType, setDocType] = useState("aadhaar");
  const [number, setNumber] = useState("");
  const [busy, setBusy] = useState("");
  const docInput = useRef(null);
  const selfieInput = useRef(null);
  const latest = me.kyc[0];
  const kycTone = { submitted: "warn", approved: "good", rejected: "plain" };

  const sendDoc = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy("kyc");
    if (await save(() => api.submitKyc(docType, number, file), "ID submitted. Only the last four digits are stored.")) setNumber("");
    setBusy("");
  };
  const sendSelfie = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy("selfie");
    await save(() => api.submitSelfie(file), "Selfie submitted for the match check.");
    setBusy("");
  };

  return (
    <Card>
      <h2 className="mb-1 text-lg">{isCompanion ? "Verification" : "ID verified badge"}</h2>
      <p className="mb-4 text-sm text-muted">
        {isCompanion
          ? "Needed before you go live and before any payout. Both together earn the Verified badge."
          : "Optional. Companions see an \"ID verified\" badge on your requests, and some only accept verified members. Only the last four digits are kept, and the document is never shown to anyone but our team."}
      </p>

      <h3 className="mb-2 text-base">{isCompanion ? "1. ID check" : "ID check"}</h3>
      {latest && (
        <p className="mb-3 text-sm">
          {latest.docType.toUpperCase()} {latest.numberMasked} · <Badge tone={kycTone[latest.status]}>{latest.status}</Badge>
          {latest.rejectionReason && <span className="block text-muted">{latest.rejectionReason}</span>}
        </p>
      )}
      {(!latest || latest.status === "rejected") && (
        <>
          <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
            <Field as="select" label="Document" id="doctype" value={docType} onChange={(e) => setDocType(e.target.value)}>
              <option value="aadhaar">Aadhaar</option>
              <option value="pan">PAN</option>
            </Field>
            <Field label={docType === "pan" ? "PAN (ABCDE1234F)" : "Aadhaar number (12 digits)"} id="docnum" value={number} onChange={(e) => setNumber(e.target.value)} />
          </div>
          <Button variant="outline" loading={busy === "kyc"} disabled={!number} onClick={() => docInput.current?.click()}><FiUpload /> Upload document photo</Button>
          <input ref={docInput} type="file" accept="image/*" hidden onChange={sendDoc} />
        </>
      )}

      {isCompanion && <>
      <h3 className="mb-2 mt-6 text-base">2. Selfie check</h3>
      <p className="mb-3 text-sm">
        Status: <Badge tone={{ approved: "good", submitted: "warn", rejected: "plain", none: "plain" }[me.profile.selfieStatus]}>{me.profile.selfieStatus === "none" ? "not done" : me.profile.selfieStatus}</Badge>
      </p>
      {["none", "rejected"].includes(me.profile.selfieStatus) && (
        <>
          <p className="mb-3 text-xs text-muted">Face the camera in good light, no sunglasses. It is compared with your main photo and never shown publicly.</p>
          <Button variant="outline" loading={busy === "selfie"} onClick={() => selfieInput.current?.click()}><FiCamera /> Take a selfie</Button>
          <input ref={selfieInput} type="file" accept="image/*" capture="user" hidden onChange={sendSelfie} />
        </>
      )}
      </>}
    </Card>
  );
}

/* ------------------------------ booking rules ------------------------------ */

/** Companions: "Available now" for same-day meets, and who may book them. */
function BookingRules({ me, save }) {
  const [busy, setBusy] = useState("");
  const until = me.profile.availableNowUntil ? new Date(me.profile.availableNowUntil) : null;
  const setNow = async (hours) => {
    setBusy(`now${hours}`);
    await save(async () => { await api.setAvailableNow(hours); return api.myProfile(); }, hours ? `You show as available now for ${hours} hour${hours === 1 ? "" : "s"}.` : "Available now is off.");
    setBusy("");
  };
  return (
    <Card>
      <h2 className="mb-1 text-lg">Availability &amp; who can book</h2>
      <h3 className="mb-1 mt-3 text-base">Available now</h3>
      <p className="mb-2 text-sm text-muted">
        {until ? `On until ${until.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}. You appear first in search with an "Available now" badge.` : "Free today? Switch this on and you appear first in search with an \"Available now\" badge."}
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        {[1, 2, 3, 6].map((h) => (
          <Button key={h} size="sm" variant="outline" loading={busy === `now${h}`} onClick={() => setNow(h)}>{h} h</Button>
        ))}
        {until && <Button size="sm" variant="ghost" loading={busy === "now0"} onClick={() => setNow(0)}>Turn off</Button>}
      </div>
      <p className="mb-2 text-xs text-muted">Customers still book at least two hours ahead, inside your weekly hours.</p>
      <label className="mt-3 flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={Boolean(me.profile.verifiedCustomersOnly)}
          onChange={() => save(() => api.updateProfile({ verifiedCustomersOnly: !me.profile.verifiedCustomersOnly }), "Saved.")}
        />
        <span>Only accept requests from ID-verified Customers<span className="block text-xs text-muted">Fewer requests, but every Customer has passed an ID check.</span></span>
      </label>
    </Card>
  );
}

/* ------------------------------ payouts ------------------------------ */

function PayoutAccount({ me, save }) {
  const acc = me.payoutAccount;
  const [f, setF] = useState({ method: acc?.method || "upi", upiId: acc?.upiId || "", accountName: acc?.accountName || "", accountNumber: "", ifsc: acc?.ifsc || "" });
  const [busy, setBusy] = useState("");
  const [codeSent, setCodeSent] = useState("");
  const [devCode, setDevCode] = useState("");
  const [codeProblem, setCodeProblem] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const sendCode = async () => {
    setBusy("code");
    setCodeProblem("");
    try {
      const r = await api.payoutCode();
      setCodeSent(r.sentTo);
      setDevCode(r.devCode || "");
    } catch (e) {
      setCodeProblem(e instanceof ApiError ? e.message : "Could not send a code. Try again.");
    } finally {
      setBusy("");
    }
  };
  return (
    <Card>
      <h2 className="mb-1 text-lg">Payout account</h2>
      <p className="mb-4 text-sm text-muted">
        {acc ? `Payouts go to ${acc.method === "upi" ? acc.upiId : `A/C ••••${acc.accountLast4} (${acc.ifsc})`}.` : "Where your earnings are sent after each completed meet."}
      </p>
      <div className="mb-3 flex gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="radio" checked={f.method === "upi"} onChange={() => setF({ ...f, method: "upi" })} /> UPI</label>
        <label className="flex items-center gap-2"><input type="radio" checked={f.method === "bank"} onChange={() => setF({ ...f, method: "bank" })} /> Bank account</label>
      </div>
      {f.method === "upi" ? (
        <Field label="UPI ID" id="upi" placeholder="name@okaxis" value={f.upiId} onChange={set("upiId")} />
      ) : (
        <>
          <Field label="Name on the account" id="accname" value={f.accountName} onChange={set("accountName")} />
          <Field label="Account number" id="accnum" inputMode="numeric" value={f.accountNumber} onChange={set("accountNumber")} hint="Only the last four digits are stored here." />
          <Field label="IFSC" id="ifsc" value={f.ifsc} onChange={set("ifsc")} />
        </>
      )}
      {acc && (
        <div className="mb-3 rounded-lg border border-ink-line p-3 text-sm">
          <p className="mb-2">For your safety, changing your payout account needs a code. Payouts wait 24 hours after a change.</p>
          {!codeSent ? (
            <Button size="sm" variant="outline" loading={busy === "code"} onClick={sendCode}>Send me a code</Button>
          ) : (
            <>
              <p className="mb-2 text-muted">We sent a code to {codeSent}.</p>
              {devCode && <Alert tone="info">Development mode — your code is <strong>{devCode}</strong>.</Alert>}
              <Field label="Code" id="payout-code" inputMode="numeric" autoComplete="one-time-code" value={f.code || ""} onChange={set("code")} />
              <button type="button" className="text-xs underline" onClick={sendCode}>Send a new code</button>
            </>
          )}
          <Alert>{codeProblem}</Alert>
        </div>
      )}
      <Button
        loading={busy === "save"}
        disabled={Boolean(acc) && !f.code}
        onClick={async () => {
          setBusy("save");
          const ok = await save(() => api.savePayoutAccount(f), acc ? "Payout account changed. Payouts wait 24 hours after a change." : "Payout account saved.");
          if (ok) { setCodeSent(""); setDevCode(""); setF((x) => ({ ...x, code: "", accountNumber: "" })); }
          setBusy("");
        }}
      >
        {acc ? "Change payout account" : "Save"}
      </Button>
    </Card>
  );
}
