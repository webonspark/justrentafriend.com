import { useEffect, useState } from "react";
import { Form } from "react-bootstrap";
import { adminApi } from "../../services/api";
import { dateTime, inr } from "../../lib/format";
import { Alert, Button, Card, Field, PasswordField } from "../../components/ui";
import { AdminTable, Loader, PageHead, Pager, StatusBadge, errText, useAdmin, useLoad } from "./shared";

/** Settings, service categories, plans, the audit log and staff accounts. */

/* ------------------------------ settings ------------------------------ */

const GROUPS = { money: "Money & commission", bookings: "Bookings & cancellations", company: "Company & invoices", general: "General" };
// Stored in paise, edited in rupees.
const isPaise = (key) => key.endsWith("_paise");

export function SettingsAdmin() {
  const { admin } = useAdmin();
  const state = useLoad(() => adminApi.get("/settings"));
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ tone: "good", text: "" });
  const canEdit = ["super_admin", "finance"].includes(admin.role);

  useEffect(() => {
    if (state.data) setDraft(Object.fromEntries(state.data.settings.map((s) => [s.key, s.value])));
  }, [state.data]);

  const save = async () => {
    setBusy(true);
    setMsg({ tone: "good", text: "" });
    try {
      const changed = Object.fromEntries(
        state.data.settings.filter((s) => JSON.stringify(s.value) !== JSON.stringify(draft[s.key])).map((s) => [s.key, draft[s.key]])
      );
      if (!Object.keys(changed).length) {
        setMsg({ tone: "info", text: "Nothing changed." });
        return;
      }
      await adminApi.put("/settings", { settings: changed });
      setMsg({ tone: "good", text: `Saved ${Object.keys(changed).length} setting(s). New bookings use them at once; existing bookings keep their terms.` });
      state.reload();
    } catch (e) {
      setMsg({ tone: "bad", text: errText(e) });
    } finally {
      setBusy(false);
    }
  };

  const groups = {};
  (state.data?.settings || []).forEach((s) => { (groups[s.group] = groups[s.group] || []).push(s); });

  const input = (s) => {
    const v = draft[s.key];
    if (typeof s.value === "boolean") {
      return (
        <Form.Check type="switch" id={`set-${s.key}`} label={s.label || s.key} checked={Boolean(v)} disabled={!canEdit} onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.checked }))} />
      );
    }
    if (typeof s.value === "number") {
      return (
        <Field
          id={`set-${s.key}`}
          label={`${s.label || s.key}${isPaise(s.key) ? " (₹)" : ""}`}
          type="number"
          disabled={!canEdit}
          value={v === undefined ? "" : isPaise(s.key) ? v / 100 : v}
          onChange={(e) => setDraft((d) => ({ ...d, [s.key]: isPaise(s.key) ? Math.round(Number(e.target.value) * 100) : Number(e.target.value) }))}
        />
      );
    }
    return <Field id={`set-${s.key}`} label={s.label || s.key} disabled={!canEdit} value={v ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.value }))} />;
  };

  return (
    <>
      <PageHead title="Settings" sub="Commission, GST, cancellation windows, price limits and invoice details.">
        {canEdit && <Button onClick={save} loading={busy}>Save changes</Button>}
      </PageHead>
      <Alert tone={msg.tone}>{msg.text}</Alert>
      <Loader state={state}>
        <div className="grid gap-4 xl:grid-cols-2">
          {Object.entries(groups).map(([g, rows]) => (
            <Card key={g}>
              <h2 className="mb-4 text-base">{GROUPS[g] || g}</h2>
              {rows.map((s) => (
                <div key={s.key} className="mb-2">{input(s)}</div>
              ))}
            </Card>
          ))}
        </div>
      </Loader>
    </>
  );
}

/* ------------------------------ categories ------------------------------ */

export function Categories() {
  const state = useLoad(() => adminApi.get("/categories"));
  const [form, setForm] = useState({ name: "", description: "", sortOrder: "" });
  const [msg, setMsg] = useState({ tone: "bad", text: "" });
  const [editing, setEditing] = useState(null);

  const add = async (e) => {
    e.preventDefault();
    setMsg({ tone: "bad", text: "" });
    try {
      await adminApi.post("/categories", { ...form, sortOrder: Number(form.sortOrder) || 0 });
      setForm({ name: "", description: "", sortOrder: "" });
      state.reload();
    } catch (err) {
      setMsg({ tone: "bad", text: errText(err) });
    }
  };

  const update = async (c, patch) => {
    setMsg({ tone: "bad", text: "" });
    try {
      await adminApi.put(`/categories/${c.id}`, patch);
      setEditing(null);
      state.reload();
    } catch (err) {
      setMsg({ tone: "bad", text: errText(err) });
    }
  };

  return (
    <>
      <PageHead title="Service categories" sub="What Companions offer and Customers filter by. Turning one off hides it from new choices." />
      <Alert tone={msg.tone}>{msg.text}</Alert>
      <Card className="mb-6">
        <form onSubmit={add} className="grid gap-x-3 sm:grid-cols-[1fr_2fr_6rem_auto] sm:items-end">
          <Field id="cat-name" label="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Field id="cat-desc" label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <Field id="cat-order" label="Order" type="number" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))} />
          <div className="mb-4"><Button type="submit">Add</Button></div>
        </form>
      </Card>
      <Loader state={state} empty={state.data?.categories.length === 0} emptyTitle="No categories">
        <AdminTable>
          <thead>
            <tr><th>Order</th><th>Name</th><th>Description</th><th>Active</th><th /></tr>
          </thead>
          <tbody>
            {state.data?.categories.map((c) =>
              editing?.id === c.id ? (
                <tr key={c.id}>
                  <td><input className="k-input" style={{ width: 70 }} type="number" value={editing.sortOrder} onChange={(e) => setEditing((x) => ({ ...x, sortOrder: e.target.value }))} /></td>
                  <td><input className="k-input" value={editing.name} onChange={(e) => setEditing((x) => ({ ...x, name: e.target.value }))} /></td>
                  <td><input className="k-input" value={editing.description || ""} onChange={(e) => setEditing((x) => ({ ...x, description: e.target.value }))} /></td>
                  <td />
                  <td className="whitespace-nowrap">
                    <Button size="sm" onClick={() => update(c, { name: editing.name, description: editing.description, sortOrder: Number(editing.sortOrder) })}>Save</Button>{" "}
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                  </td>
                </tr>
              ) : (
                <tr key={c.id}>
                  <td>{c.sortOrder}</td>
                  <td>{c.name}</td>
                  <td className="text-muted">{c.description || "—"}</td>
                  <td><Form.Check type="switch" id={`cat-${c.id}`} checked={c.isActive} onChange={() => update(c, { isActive: !c.isActive })} aria-label="Active" /></td>
                  <td><Button size="sm" variant="ghost" onClick={() => setEditing({ ...c })}>Edit</Button></td>
                </tr>
              )
            )}
          </tbody>
        </AdminTable>
      </Loader>
    </>
  );
}

/* ------------------------------ plans ------------------------------ */

export function Plans() {
  const state = useLoad(() => adminApi.get("/plans"));
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState("");

  const save = async () => {
    setMsg("");
    try {
      await adminApi.put(`/plans/${editing.id}`, {
        name: editing.name,
        blurb: editing.blurb,
        days: Number(editing.days),
        pricePaise: Math.round(Number(editing.rupees) * 100),
        gstPct: Number(editing.gstPct),
        isActive: editing.isActive,
      });
      setEditing(null);
      state.reload();
    } catch (e) {
      setMsg(errText(e));
    }
  };

  return (
    <>
      <PageHead title="Membership plans" sub="Membership is compulsory for both sides. Prices are before GST." />
      <Alert>{msg}</Alert>
      <Loader state={state} empty={state.data?.plans.length === 0} emptyTitle="No plans">
        <div className="grid gap-4 md:grid-cols-3">
          {state.data?.plans.map((p) =>
            editing?.id === p.id ? (
              <Card key={p.id}>
                <Field id="pl-name" label="Name" value={editing.name} onChange={(e) => setEditing((x) => ({ ...x, name: e.target.value }))} />
                <Field id="pl-days" label="Days" type="number" value={editing.days} onChange={(e) => setEditing((x) => ({ ...x, days: e.target.value }))} />
                <Field id="pl-price" label="Price (₹, before GST)" type="number" value={editing.rupees} onChange={(e) => setEditing((x) => ({ ...x, rupees: e.target.value }))} />
                <Field id="pl-gst" label="GST %" type="number" value={editing.gstPct} onChange={(e) => setEditing((x) => ({ ...x, gstPct: e.target.value }))} />
                <Field id="pl-blurb" label="Blurb" value={editing.blurb || ""} onChange={(e) => setEditing((x) => ({ ...x, blurb: e.target.value }))} />
                <Form.Check className="mb-4" type="switch" id="pl-active" label="On sale" checked={editing.isActive} onChange={(e) => setEditing((x) => ({ ...x, isActive: e.target.checked }))} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={save}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                </div>
              </Card>
            ) : (
              <Card key={p.id}>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="mb-0 text-base">{p.name}</h2>
                  <StatusBadge value={p.isActive ? "active" : "off"} />
                </div>
                <p className="mb-1 text-xl font-bold text-rose">{inr(p.pricePaise)}</p>
                <p className="mb-3 text-sm text-muted">{p.days} days · GST {Number(p.gstPct)}%{p.forRole ? ` · ${p.forRole}s only` : ""}</p>
                {p.blurb && <p className="mb-3 text-sm">{p.blurb}</p>}
                <Button size="sm" variant="outline" onClick={() => setEditing({ ...p, rupees: Number(p.pricePaise) / 100, gstPct: Number(p.gstPct) })}>Edit</Button>
              </Card>
            )
          )}
        </div>
      </Loader>
    </>
  );
}

/* ------------------------------ audit ------------------------------ */

export function Audit() {
  const [page, setPage] = useState(1);
  const state = useLoad(() => adminApi.get(`/audit?page=${page}`), [page]);
  return (
    <>
      <PageHead title="Audit log" sub="Every staff action and every view of sensitive data." />
      <Loader state={state} empty={state.data?.entries.length === 0} emptyTitle="Nothing logged yet">
        {state.data && (
          <>
            <AdminTable>
              <thead>
                <tr><th>When</th><th>Who</th><th>Action</th><th>On</th><th>Detail</th><th>IP</th></tr>
              </thead>
              <tbody>
                {state.data.entries.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap">{dateTime(e.createdAt)}</td>
                    <td>{e.actorName || e.actorType}</td>
                    <td>{e.action} {e.wasSensitive && <StatusBadge value="sensitive" />}</td>
                    <td>{e.entityType}{e.entityId ? ` #${e.entityId}` : ""}</td>
                    <td className="max-w-xs text-xs">{e.detail || "—"}</td>
                    <td className="text-xs">{e.ip}</td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
            <Pager page={page} total={state.data.total} limit={100} onPage={setPage} />
          </>
        )}
      </Loader>
    </>
  );
}

/* ------------------------------ staff ------------------------------ */

const ROLES = [["support", "Support (read-only)"], ["moderator", "Moderator"], ["finance", "Finance"], ["super_admin", "Super admin"]];

export function Staff() {
  const { admin } = useAdmin();
  const state = useLoad(() => adminApi.get("/staff"));
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "support" });
  const [msg, setMsg] = useState({ tone: "bad", text: "" });

  const add = async (e) => {
    e.preventDefault();
    setMsg({ tone: "bad", text: "" });
    try {
      await adminApi.post("/staff", form);
      setForm({ name: "", email: "", password: "", role: "support" });
      setMsg({ tone: "good", text: "Staff account created. Share the password with them privately." });
      state.reload();
    } catch (err) {
      setMsg({ tone: "bad", text: errText(err) });
    }
  };

  const update = async (s, patch) => {
    setMsg({ tone: "bad", text: "" });
    try {
      await adminApi.put(`/staff/${s.id}`, patch);
      state.reload();
    } catch (err) {
      setMsg({ tone: "bad", text: errText(err) });
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <PageHead title="Staff" sub="Who can open the admin area, and what they can do." />
      <Alert tone={msg.tone}>{msg.text}</Alert>
      <Card className="mb-6">
        <form onSubmit={add} className="grid gap-x-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_12rem_auto] xl:items-end">
          <Field id="st-name" label="Name" value={form.name} onChange={set("name")} />
          <Field id="st-email" label="Email" type="email" value={form.email} onChange={set("email")} />
          <PasswordField id="st-pass" label="Password (10+ characters)" autoComplete="new-password" value={form.password} onChange={set("password")} />
          <Field id="st-role" label="Role" as="select" value={form.role} onChange={set("role")}>
            {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Field>
          <div className="mb-4"><Button type="submit">Add staff</Button></div>
        </form>
      </Card>
      <Loader state={state}>
        <AdminTable>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Last sign-in</th><th>Active</th></tr>
          </thead>
          <tbody>
            {state.data?.staff.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.email}</td>
                <td>
                  <select className="k-input" style={{ width: "auto" }} value={s.role} disabled={s.id === admin.id} onChange={(e) => update(s, { role: e.target.value })} aria-label="Role">
                    {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </td>
                <td>{dateTime(s.lastLoginAt)}</td>
                <td><Form.Check type="switch" id={`st-${s.id}`} checked={s.isActive} disabled={s.id === admin.id} onChange={() => update(s, { isActive: !s.isActive })} aria-label="Active" /></td>
              </tr>
            ))}
          </tbody>
        </AdminTable>
      </Loader>
    </>
  );
}
