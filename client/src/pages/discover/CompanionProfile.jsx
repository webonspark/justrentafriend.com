import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FiCheckCircle, FiFlag, FiMapPin, FiShield, FiSlash, FiStar } from "react-icons/fi";
import { api, ApiError } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { WEEKDAYS, dateOnly, inr, isoDate } from "../../lib/format";
import { Alert, Avatar, Badge, Button, Card, EmptyState, Field, Price, Skeleton } from "../../components/ui";
import ReportModal from "../../components/shared/ReportModal";

/**
 * A Companion's public page, and the booking request form.
 *
 * The form only offers start times the server says are free, and only
 * durations that fit before the next booking or the end of the window. The
 * server checks all of it again when the request arrives.
 */
export default function CompanionProfile() {
  const { id } = useParams();
  const { isCustomer, user } = useAuth();
  const [c, setC] = useState(null);
  const [problem, setProblem] = useState("");
  const [photo, setPhoto] = useState(0);
  const [reporting, setReporting] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    api.companion(id).then(setC).catch((e) => setProblem(e instanceof ApiError ? e.message : "Could not load this profile."));
  }, [id]);

  if (problem) {
    return (
      <div className="k-wrap py-16">
        <EmptyState title="Profile not available" body={problem} action={<Button to="/discover" variant="outline">Back to Discover</Button>} />
      </div>
    );
  }
  if (!c) {
    return (
      <div className="k-wrap grid gap-8 py-10 lg:grid-cols-[1fr_380px]">
        <Skeleton className="h-96 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  const block = async () => {
    if (!window.confirm(`Block ${c.firstName}? Neither of you will see the other.`)) return;
    await api.block(c.id);
    setBlocked(true);
  };

  return (
    <div className="k-wrap py-8 lg:py-12">
      <Link to="/discover" className="mb-4 inline-block text-sm text-muted">← Discover</Link>
      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        <div>
          <div className="mb-4 overflow-hidden rounded-panel bg-ink-high">
            {c.photos.length ? (
              <img src={c.photos[photo].url} alt={`${c.firstName}`} className="aspect-[4/3] w-full object-cover" />
            ) : (
              <div className="grid aspect-[4/3] place-items-center">
                <Avatar name={c.name} size={140} />
              </div>
            )}
          </div>
          {c.photos.length > 1 && (
            <div className="mb-6 flex gap-2 overflow-x-auto">
              {c.photos.map((p, i) => (
                <button key={p.id} type="button" onClick={() => setPhoto(i)} className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 ${i === photo ? "border-rose" : "border-transparent"}`}>
                  <img src={p.thumbUrl} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h1 className="m-0 text-[2rem]">{c.firstName}, {c.age}</h1>
            {c.verified && <Badge tone="good"><FiCheckCircle className="mr-1 inline" size={12} />Verified</Badge>}
          </div>
          <p className="mb-4 flex flex-wrap items-center gap-3 text-muted">
            <span className="flex items-center gap-1"><FiMapPin size={14} /> {c.area}, {c.city}{c.distanceKm != null && ` · ${c.distanceKm} km`}</span>
            <span className="flex items-center gap-1"><FiStar size={14} className="text-rose" /> {c.ratingCount ? `${c.rating.toFixed(1)} (${c.ratingCount} reviews)` : "New"}</span>
            <span>{c.completedMeets} completed meets</span>
          </p>
          {c.bio && <p className="mb-6 whitespace-pre-line text-[1.0625rem] leading-relaxed">{c.bio}</p>}

          <Section title="Services">
            <div className="flex flex-wrap gap-2">{c.services.map((s) => <Badge key={s.id} tone="accent">{s.name}</Badge>)}</div>
          </Section>
          {c.languages.length > 0 && (
            <Section title="Languages"><p className="m-0">{c.languages.join(", ")}</p></Section>
          )}
          {c.interests.length > 0 && (
            <Section title="Interests">
              <div className="flex flex-wrap gap-2">{c.interests.map((i) => <Badge key={i.id}>{i.name}</Badge>)}</div>
            </Section>
          )}
          <Section title="Usually available">
            <ul className="m-0 list-none space-y-1 p-0 text-sm">
              {WEEKDAYS.map((d, i) => {
                const w = c.availability.filter((a) => a.weekday === i);
                return (
                  <li key={d} className="flex justify-between border-b border-ink-line py-1.5">
                    <span>{d}</span>
                    <span className="text-muted">{w.length ? w.map((a) => `${a.startTime}–${a.endTime}`).join(", ") : "—"}</span>
                  </li>
                );
              })}
            </ul>
          </Section>
          <Section title={`Reviews (${c.ratingCount})`}>
            {c.reviews.length === 0 ? (
              <p className="text-muted">No reviews yet.</p>
            ) : (
              <div className="space-y-3">
                {c.reviews.map((r) => (
                  <Card key={r.id}>
                    <div className="mb-1 flex justify-between text-sm">
                      <strong>{r.author}</strong>
                      <span className="text-rose">{"★".repeat(r.rating)}<span className="text-muted">{"★".repeat(5 - r.rating)}</span></span>
                    </div>
                    {r.comment && <p className="m-0 text-sm">{r.comment}</p>}
                    <p className="m-0 mt-1 text-xs text-muted">{dateOnly(r.createdAt)}</p>
                  </Card>
                ))}
              </div>
            )}
          </Section>

          {user?.id !== c.id && (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setReporting(true)}><FiFlag /> Report</Button>
              <Button variant="ghost" size="sm" onClick={block} disabled={blocked}><FiSlash /> {blocked ? "Blocked" : "Block"}</Button>
            </div>
          )}
        </div>

        <aside>
          <div className="sticky top-24">
            {isCustomer && !blocked ? (
              <BookingForm c={c} />
            ) : (
              <Card>
                <Price paise={c.pricePerHourPaise} size="xl" />
                <p className="mt-3 text-sm text-muted">
                  {user?.id === c.id ? "This is how Customers see your profile." : "Only Customers can book a Companion."}
                </p>
              </Card>
            )}
          </div>
        </aside>
      </div>
      <ReportModal show={reporting} onHide={() => setReporting(false)} reportedId={c.id} name={c.firstName} onDone={({ blocked: b }) => b && setBlocked(true)} />
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-7">
      <h2 className="mb-3 text-lg">{title}</h2>
      {children}
    </section>
  );
}

function BookingForm({ c }) {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState(null);
  const [form, setForm] = useState({ serviceId: c.services[0]?.id || "", date: "", startTime: "", hours: 1, meetingPlaceType: "cafe", meetingPlaceName: "", meetingPlaceAddress: "", note: "" });
  const [slots, setSlots] = useState(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  useEffect(() => { api.catalog().then(setCatalog).catch(() => {}); }, []);

  useEffect(() => {
    if (!form.date) return;
    setSlots(null);
    api.slots(c.id, form.date).then((d) => setSlots(d.slots)).catch(() => setSlots([]));
  }, [c.id, form.date]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const slot = slots?.find((s) => s.time === form.startTime);
  const hourOptions = useMemo(() => {
    const max = slot ? slot.maxHours : 8;
    const out = [];
    for (let h = 1; h <= max; h += 0.5) out.push(h);
    return out;
  }, [slot]);
  const total = Math.round(c.pricePerHourPaise * Number(form.hours));

  const submit = async (e) => {
    e.preventDefault();
    setProblem("");
    setBusy(true);
    try {
      const b = await api.requestBooking({ ...form, companionId: c.id, hours: Number(form.hours), serviceId: Number(form.serviceId) });
      navigate(`/bookings/${b.id}`, { state: { justRequested: true } });
    } catch (err) {
      setProblem(err instanceof ApiError ? err.message : "Could not send the request.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card as="form" onSubmit={submit}>
      <div className="mb-4 flex items-baseline justify-between">
        <Price paise={c.pricePerHourPaise} size="xl" />
      </div>
      <Field as="select" label="Service" id="bk-service" value={form.serviceId} onChange={set("serviceId")} required>
        {c.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </Field>
      <Field label="Date" id="bk-date" type="date" min={isoDate()} value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value, startTime: "" }))} required />
      {form.date && (
        <Field as="select" label="Start time" id="bk-time" value={form.startTime} onChange={set("startTime")} required
          hint={slots && slots.length === 0 ? "No free times on this date — try another day." : undefined}>
          <option value="">{slots === null ? "Loading…" : "Choose a time"}</option>
          {(slots || []).map((s) => <option key={s.time} value={s.time}>{s.time}</option>)}
        </Field>
      )}
      <Field as="select" label="Duration" id="bk-hours" value={form.hours} onChange={set("hours")}>
        {hourOptions.map((h) => <option key={h} value={h}>{h} {h === 1 ? "hour" : "hours"}</option>)}
      </Field>
      <Field as="select" label="Meeting place (public places only)" id="bk-ptype" value={form.meetingPlaceType} onChange={set("meetingPlaceType")}>
        {(catalog?.meetingPlaceTypes || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </Field>
      <Field label="Place name" id="bk-pname" placeholder="e.g. Third Wave Coffee, 100 Feet Road" value={form.meetingPlaceName} onChange={set("meetingPlaceName")} required />
      <Field label="Address or landmark (optional)" id="bk-paddr" value={form.meetingPlaceAddress} onChange={set("meetingPlaceAddress")} />
      <Field as="textarea" rows={2} label="Note to the Companion (optional)" id="bk-note" value={form.note} onChange={set("note")} />

      <div className="mb-4 rounded-xl border border-ink-line p-3 text-sm">
        <div className="flex justify-between"><span>{inr(c.pricePerHourPaise)} × {form.hours} h</span><strong>{inr(total)}</strong></div>
        <p className="m-0 mt-1 text-xs text-muted">You pay only after {c.firstName} accepts. The money is held safely until after your meet.</p>
      </div>
      <Alert>{problem}</Alert>
      <Button type="submit" block loading={busy} disabled={!form.startTime || !form.meetingPlaceName}>Request booking</Button>
      <p className="mb-0 mt-3 flex items-center gap-1 text-xs text-muted"><FiShield size={12} /> Platonic time only. Meet in public. Never pay outside the app.</p>
    </Card>
  );
}
