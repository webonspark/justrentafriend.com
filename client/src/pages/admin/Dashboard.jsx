import { useState } from "react";
import { Link } from "react-router-dom";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart } from "recharts";
import { adminApi } from "../../services/api";
import { inr } from "../../lib/format";
import { Card } from "../../components/ui";
import { AdminTable, Loader, PageHead, Select, StatusBadge, useLoad } from "./shared";

/**
 * The first screen: what needs a person now (queues), what the money looks
 * like, and how the last few weeks went.
 */

const QUEUES = [
  ["activeSos", "Active SOS", "/admin/sos"],
  ["pendingApprovals", "Companions to approve", "/admin/approvals"],
  ["kycQueue", "KYC documents", "/admin/kyc"],
  ["photoQueue", "Photos to review", "/admin/photos"],
  ["openReports", "Open reports", "/admin/reports"],
  ["disputes", "Disputed bookings", "/admin/bookings"],
  ["heldPayouts", "Payouts needing action", "/admin/payouts"],
];

const axis = { stroke: "var(--muted)", fontSize: 12 };
const tooltip = { contentStyle: { background: "var(--ink-raised)", border: "1px solid var(--ink-line)", borderRadius: 12, color: "var(--paper)" } };

export default function Dashboard() {
  const [days, setDays] = useState("30");
  const dash = useLoad(() => adminApi.get("/dashboard"));
  const stats = useLoad(() => adminApi.get(`/analytics?days=${days}`), [days]);

  const c = dash.data?.counts;
  const m = dash.data?.money;

  return (
    <>
      <PageHead title="Dashboard" sub="Queues first, then the numbers." />
      <Loader state={dash}>
        {c && (
          <>
            <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
              {QUEUES.map(([key, label, to]) => (
                <Link key={key} to={to} className="no-underline">
                  <Card className={`h-full ${c[key] > 0 && key === "activeSos" ? "border-rose" : ""}`} style={c[key] > 0 && key === "activeSos" ? { borderColor: "var(--rose)" } : undefined}>
                    <p className={`mb-1 text-2xl font-bold ${c[key] > 0 ? "text-rose" : ""}`}>{c[key]}</p>
                    <p className="mb-0 text-xs text-muted">{label}</p>
                  </Card>
                </Link>
              ))}
            </div>
            <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Customers" value={c.customers} />
              <Stat label="Companions" value={`${c.companions} (${c.liveCompanions} live)`} />
              <Stat label="Bookings today" value={c.bookingsToday} />
              <Stat label="Collected (net of refunds)" value={inr(m.collectedPaise)} />
              <Stat label="Membership revenue" value={inr(m.membershipPaise)} />
              <Stat label="Completed GMV" value={inr(m.gmvPaise)} />
              <Stat label="Commission earned" value={inr(m.commissionPaise)} />
            </div>
          </>
        )}
      </Loader>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="mb-0 text-lg">Trends</h2>
        <Select label="Period" value={days} onChange={setDays} options={[["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"], ["365", "Last year"]]} />
      </div>
      <Loader state={stats}>
        {stats.data && (
          <>
            <div className="mb-6 grid gap-4 xl:grid-cols-2">
              <Card>
                <p className="mb-3 text-sm font-semibold">Sign-ups and bookings</p>
                <div style={{ height: 260 }}>
                  <ResponsiveContainer>
                    <LineChart data={stats.data.series}>
                      <CartesianGrid stroke="var(--ink-line)" vertical={false} />
                      <XAxis dataKey="date" tick={axis} tickFormatter={(d) => d.slice(5)} />
                      <YAxis tick={axis} allowDecimals={false} />
                      <Tooltip {...tooltip} />
                      <Legend />
                      <Line type="monotone" dataKey="customers" name="Customers" stroke="var(--paper)" dot={false} />
                      <Line type="monotone" dataKey="companions" name="Companions" stroke="var(--good)" dot={false} />
                      <Line type="monotone" dataKey="bookings" name="Bookings" stroke="var(--rose)" dot={false} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card>
                <p className="mb-3 text-sm font-semibold">Revenue (commission + memberships)</p>
                <div style={{ height: 260 }}>
                  <ResponsiveContainer>
                    <BarChart data={stats.data.series.map((s) => ({ ...s, revenue: s.revenuePaise / 100 }))}>
                      <CartesianGrid stroke="var(--ink-line)" vertical={false} />
                      <XAxis dataKey="date" tick={axis} tickFormatter={(d) => d.slice(5)} />
                      <YAxis tick={axis} />
                      <Tooltip {...tooltip} formatter={(v) => inr(v * 100)} />
                      <Bar dataKey="revenue" name="Revenue" fill="var(--rose)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <p className="mb-2 text-sm font-semibold">By city</p>
                <AdminTable>
                  <thead>
                    <tr><th>City</th><th>Bookings</th><th>Completed</th><th>GMV</th><th>Commission</th></tr>
                  </thead>
                  <tbody>
                    {stats.data.byCity.length === 0 && <tr><td colSpan={5} className="text-muted">No bookings in this period.</td></tr>}
                    {stats.data.byCity.map((r) => (
                      <tr key={r.city}><td>{r.city}</td><td>{r.bookings}</td><td>{r.completed}</td><td>{inr(r.gmvPaise)}</td><td>{inr(r.commissionPaise)}</td></tr>
                    ))}
                  </tbody>
                </AdminTable>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold">Booking status mix</p>
                <AdminTable>
                  <tbody>
                    {Object.keys(stats.data.statusMix).length === 0 && <tr><td className="text-muted">No bookings in this period.</td></tr>}
                    {Object.entries(stats.data.statusMix).map(([k, v]) => (
                      <tr key={k}><td><StatusBadge value={k} /></td><td className="text-right">{v}</td></tr>
                    ))}
                  </tbody>
                </AdminTable>
              </div>
            </div>
          </>
        )}
      </Loader>
    </>
  );
}

function Stat({ label, value }) {
  return (
    <Card>
      <p className="mb-1 text-lg font-bold">{value}</p>
      <p className="mb-0 text-xs text-muted">{label}</p>
    </Card>
  );
}
