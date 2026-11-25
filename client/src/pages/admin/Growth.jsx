import { useState } from "react";
import { Modal } from "react-bootstrap";
import { FiEdit2, FiPlus } from "react-icons/fi";
import { adminApi } from "../../services/api";
import { dateOnly, inr } from "../../lib/format";
import { Alert, Badge, Button, Field } from "../../components/ui";
import PlaceMap from "../../components/shared/PlaceMap";
import { AdminTable, Loader, PageHead, errText, readOnly, useAdmin, useLoad } from "./shared";

/* ============================== coupons ============================== */

const EMPTY_COUPON = { code: "", description: "", kind: "percent", value: "", maxDiscount: "", minAmount: "", firstBookingOnly: false, usageLimit: "", perUserLimit: 1, startsAt: "", endsAt: "", isActive: true };
const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

/** Discount codes. The platform pays the discount out of its commission. */
export function Coupons() {
  const { admin } = useAdmin();
  const state = useLoad(() => adminApi.get("/coupons"));
  const [edit, setEdit] = useState(null);
  const list = state.data?.coupons || [];

  return (
    <>
      <PageHead title="Coupons" sub="Codes customers enter when paying. The discount comes out of the platform's commission — Companions always get their full share.">
        {!readOnly(admin) && <Button size="sm" onClick={() => setEdit({ ...EMPTY_COUPON })}><FiPlus /> New coupon</Button>}
      </PageHead>
      <Loader state={state} empty={!list.length} emptyTitle="No coupons yet" emptyBody="Try FIRST20 — 20% off a first booking, up to ₹500.">
        <AdminTable>
          <thead><tr><th>Code</th><th>Discount</th><th>Rules</th><th>Valid</th><th>Used</th><th>Given away</th><th>Status</th><th /></tr></thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id}>
                <td><strong className="font-mono">{c.code}</strong>{c.description && <span className="block text-xs text-muted">{c.description}</span>}</td>
                <td>{c.kind === "percent" ? `${c.value}%` : inr(c.value)}{c.maxDiscountPaise != null && <span className="block text-xs text-muted">max {inr(c.maxDiscountPaise)}</span>}</td>
                <td className="text-xs">
                  {c.firstBookingOnly && <span className="block">First booking only</span>}
                  {c.minAmountPaise > 0 && <span className="block">Min {inr(c.minAmountPaise)}</span>}
                  <span className="block">{c.perUserLimit}× per member{c.usageLimit != null ? ` · ${c.usageLimit} total` : ""}</span>
                </td>
                <td className="text-xs">{c.startsAt ? dateOnly(c.startsAt) : "Now"} – {c.endsAt ? dateOnly(c.endsAt) : "no end"}</td>
                <td>{c.uses}</td>
                <td>{inr(c.discountGivenPaise)}</td>
                <td>{c.isActive ? <Badge tone="good">Active</Badge> : <Badge>Off</Badge>}</td>
                <td>
                  {!readOnly(admin) && (
                    <Button size="sm" variant="ghost" onClick={() => setEdit({
                      ...c,
                      value: c.kind === "flat" ? c.value / 100 : c.value,
                      maxDiscount: c.maxDiscountPaise != null ? c.maxDiscountPaise / 100 : "",
                      minAmount: c.minAmountPaise ? c.minAmountPaise / 100 : "",
                      usageLimit: c.usageLimit ?? "",
                      startsAt: toDateInput(c.startsAt),
                      endsAt: toDateInput(c.endsAt),
                    })}><FiEdit2 /> Edit</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </AdminTable>
      </Loader>
      {edit && <CouponForm coupon={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); state.reload(); }} />}
    </>
  );
}

function CouponForm({ coupon, onClose, onSaved }) {
  const [f, setF] = useState(coupon);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const save = async () => {
    setBusy(true);
    setProblem("");
    const rupees = (v) => (v === "" || v === null || v === undefined ? null : Math.round(Number(v) * 100));
    const body = {
      code: f.code,
      description: f.description,
      kind: f.kind,
      value: f.kind === "flat" ? rupees(f.value) : Number(f.value),
      maxDiscountPaise: f.kind === "percent" ? rupees(f.maxDiscount) : null,
      minAmountPaise: rupees(f.minAmount) || 0,
      firstBookingOnly: f.firstBookingOnly,
      usageLimit: f.usageLimit === "" ? null : Number(f.usageLimit),
      perUserLimit: Number(f.perUserLimit) || 1,
      startsAt: f.startsAt || null,
      endsAt: f.endsAt ? `${f.endsAt}T23:59:59+05:30` : null,
      isActive: f.isActive,
    };
    try {
      if (f.id) await adminApi.put(`/coupons/${f.id}`, body);
      else await adminApi.post("/coupons", body);
      onSaved();
    } catch (e) {
      setProblem(errText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal show onHide={onClose} centered>
      <Modal.Header closeButton><Modal.Title>{f.id ? `Edit ${f.code}` : "New coupon"}</Modal.Title></Modal.Header>
      <Modal.Body>
        <Field label="Code" id="c-code" value={f.code} onChange={(e) => setF((x) => ({ ...x, code: e.target.value.toUpperCase() }))} placeholder="FIRST20" />
        <Field label="Description (shown to the member)" id="c-desc" value={f.description || ""} onChange={set("description")} placeholder="20% off your first meet" />
        <div className="grid grid-cols-2 gap-3">
          <Field as="select" label="Type" id="c-kind" value={f.kind} onChange={set("kind")}>
            <option value="percent">Percentage off</option>
            <option value="flat">Fixed ₹ off</option>
          </Field>
          <Field label={f.kind === "percent" ? "Percent (1–100)" : "Rupees off"} id="c-value" type="number" min="1" value={f.value} onChange={set("value")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {f.kind === "percent" && <Field label="Max discount ₹ (optional)" id="c-max" type="number" min="0" value={f.maxDiscount} onChange={set("maxDiscount")} />}
          <Field label="Min booking ₹ (optional)" id="c-min" type="number" min="0" value={f.minAmount} onChange={set("minAmount")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Uses per member" id="c-per" type="number" min="1" value={f.perUserLimit} onChange={set("perUserLimit")} />
          <Field label="Total uses (blank = no limit)" id="c-lim" type="number" min="1" value={f.usageLimit} onChange={set("usageLimit")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts (optional)" id="c-start" type="date" value={f.startsAt} onChange={set("startsAt")} />
          <Field label="Ends (optional)" id="c-end" type="date" value={f.endsAt} onChange={set("endsAt")} />
        </div>
        <label className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.firstBookingOnly} onChange={set("firstBookingOnly")} /> First booking only</label>
        <label className="mb-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isActive} onChange={set("isActive")} /> Active</label>
        <Alert>{problem}</Alert>
        <Button block loading={busy} disabled={!f.code || !f.value} onClick={save}>Save coupon</Button>
      </Modal.Body>
    </Modal>
  );
}

/* ============================== public places ============================== */

const EMPTY_PLACE = { name: "", type: "cafe", city: "Bengaluru", area: "", address: "", latitude: "", longitude: "", isActive: true };

/** The checked public places bookings must use. */
export function Places() {
  const { admin } = useAdmin();
  const state = useLoad(() => adminApi.get("/places"));
  const [edit, setEdit] = useState(null);
  const [q, setQ] = useState("");
  const list = (state.data?.places || []).filter((p) => !q || `${p.name} ${p.area} ${p.city}`.toLowerCase().includes(q.toLowerCase()));
  const types = state.data?.types || [];

  return (
    <>
      <PageHead title="Public places" sub="Busy, well-known places bookings can use. Turn the list off in Settings (public_places_only) to let members type any public place.">
        {!readOnly(admin) && <Button size="sm" onClick={() => setEdit({ ...EMPTY_PLACE })}><FiPlus /> Add place</Button>}
      </PageHead>
      <input className="k-input mb-4 max-w-sm" placeholder="Search places" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search places" />
      <Loader state={state} empty={!list.length} emptyTitle="No places">
        <AdminTable>
          <thead><tr><th>Place</th><th>Type</th><th>Area</th><th>Position</th><th>Status</th><th /></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td><strong>{p.name}</strong>{p.address && <span className="block text-xs text-muted">{p.address}</span>}</td>
                <td>{types.find((t) => t.id === p.type)?.name || p.type}</td>
                <td>{p.area || "—"}, {p.city}</td>
                <td className="text-xs"><a href={`https://www.google.com/maps/search/?api=1&query=${p.latitude}%2C${p.longitude}`} target="_blank" rel="noreferrer noopener">{p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}</a></td>
                <td>{p.isActive ? <Badge tone="good">On the list</Badge> : <Badge>Hidden</Badge>}</td>
                <td>{!readOnly(admin) && <Button size="sm" variant="ghost" onClick={() => setEdit(p)}><FiEdit2 /> Edit</Button>}</td>
              </tr>
            ))}
          </tbody>
        </AdminTable>
      </Loader>
      {edit && <PlaceForm place={edit} types={types} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); state.reload(); }} />}
    </>
  );
}

function PlaceForm({ place, types, onClose, onSaved }) {
  const [f, setF] = useState(place);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  /* Paste "12.9716, 77.5946" from Google Maps into either box. */
  const pastePosition = (e) => {
    const m = String(e.target.value).match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (m) setF((x) => ({ ...x, latitude: m[1], longitude: m[2] }));
    else set(e.target.id === "p-lat" ? "latitude" : "longitude")(e);
  };
  const hasPos = f.latitude !== "" && f.longitude !== "" && Number.isFinite(Number(f.latitude)) && Number.isFinite(Number(f.longitude));

  const save = async () => {
    setBusy(true);
    setProblem("");
    const body = { ...f, latitude: Number(f.latitude), longitude: Number(f.longitude) };
    try {
      if (f.id) await adminApi.put(`/places/${f.id}`, body);
      else await adminApi.post("/places", body);
      onSaved();
    } catch (e) {
      setProblem(errText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal show onHide={onClose} centered>
      <Modal.Header closeButton><Modal.Title>{f.id ? "Edit place" : "Add a public place"}</Modal.Title></Modal.Header>
      <Modal.Body>
        <Field label="Name" id="p-name" value={f.name} onChange={set("name")} placeholder="Third Wave Coffee, 12th Main" />
        <div className="grid grid-cols-2 gap-3">
          <Field as="select" label="Type" id="p-type" value={f.type} onChange={set("type")}>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Field>
          <Field label="City" id="p-city" value={f.city} onChange={set("city")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Area" id="p-area" value={f.area || ""} onChange={set("area")} placeholder="Indiranagar" />
          <Field label="Address / landmark" id="p-addr" value={f.address || ""} onChange={set("address")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Latitude" id="p-lat" value={f.latitude} onChange={pastePosition} hint="Tip: paste “lat, lng” from Google Maps" />
          <Field label="Longitude" id="p-lng" value={f.longitude} onChange={pastePosition} />
        </div>
        {hasPos && <div className="mb-3"><PlaceMap latitude={f.latitude} longitude={f.longitude} name={f.name || "Preview"} height={160} /></div>}
        <label className="mb-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isActive} onChange={set("isActive")} /> Show on the list</label>
        <Alert>{problem}</Alert>
        <Button block loading={busy} disabled={!f.name || !hasPos} onClick={save}>Save place</Button>
      </Modal.Body>
    </Modal>
  );
}
