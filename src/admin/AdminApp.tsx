import { ArrowClockwise } from "@phosphor-icons/react/ArrowClockwise";
import { ArrowDownRight } from "@phosphor-icons/react/ArrowDownRight";
import { ArrowSquareOut } from "@phosphor-icons/react/ArrowSquareOut";
import { ArrowUpRight } from "@phosphor-icons/react/ArrowUpRight";
import { ChartLineUp } from "@phosphor-icons/react/ChartLineUp";
import { CheckCircle } from "@phosphor-icons/react/CheckCircle";
import { DownloadSimple } from "@phosphor-icons/react/DownloadSimple";
import { FunnelSimple } from "@phosphor-icons/react/FunnelSimple";
import { GlobeHemisphereEast } from "@phosphor-icons/react/GlobeHemisphereEast";
import { MagnifyingGlass } from "@phosphor-icons/react/MagnifyingGlass";
import { MouseSimple } from "@phosphor-icons/react/MouseSimple";
import { UsersThree } from "@phosphor-icons/react/UsersThree";
import { X } from "@phosphor-icons/react/X";
import { useCallback, useEffect, useMemo, useState } from "react";

interface MetricValues {
  visitors: number;
  page_views: number;
  clicks: number;
  leads: number;
  allLeads?: number;
}

interface DailyPoint {
  day: string;
  visitors: number;
  page_views: number;
  clicks: number;
}

interface Lead {
  id: string;
  name: string;
  email: string;
  organization: string;
  interest: string;
  message: string;
  status: LeadStatus;
  notes: string;
  owner: string;
  sourcePage: string;
  referrer: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  sessionId: string;
  country: string;
  region: string;
  city: string;
  timezone: string;
  ipAddress: string;
  ipMasked: string;
  userAgent: string;
  createdAt: number;
  updatedAt: number;
}

type LeadStatus = "new" | "contacted" | "qualified" | "closed";

interface Summary {
  period: string;
  totals: MetricValues;
  previous: MetricValues;
  daily: DailyPoint[];
  markets: Array<{ country: string; visitors: number; events: number }>;
  sources: Array<{ source: string; visitors: number }>;
  devices: Array<{ device: string; visitors: number }>;
  recentLeads: Lead[];
}

const statusLabels: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  closed: "Closed",
};

function numeric(value: number | null | undefined) {
  return Number(value || 0);
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    const error = new Error(body.error || "Request failed") as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return body;
}

function percentChange(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function formatDate(timestamp: number, includeTime = false) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(timestamp);
}

function friendlySource(source: string) {
  if (source === "Direct") return source;
  try {
    return new URL(source).hostname.replace(/^www\./, "");
  } catch {
    return source;
  }
}

export function AdminApp() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [status, setStatus] = useState<LeadStatus | "">("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authStatus, setAuthStatus] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [summaryResult, leadResult] = await Promise.all([
        api<Summary>("/api/admin/summary"),
        api<{ leads: Lead[] }>("/api/admin/leads"),
      ]);
      setSummary(summaryResult);
      setLeads(leadResult.leads);
      setAuthStatus(null);
    } catch (loadError) {
      const statusCode = (loadError as Error & { status?: number }).status;
      if (statusCode === 401 || statusCode === 403) setAuthStatus(statusCode);
      setError(loadError instanceof Error ? loadError.message : "Unable to load the dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredLeads = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesStatus = !status || lead.status === status;
      const matchesSearch =
        !needle ||
        [lead.name, lead.email, lead.organization, lead.interest].some((value) =>
          value.toLowerCase().includes(needle),
        );
      return matchesStatus && matchesSearch;
    });
  }, [leads, query, status]);

  if (authStatus) return <AccessScreen forbidden={authStatus === 403} />;

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <a className="admin-wordmark" href="/" aria-label="Cerebel website">
          <img
            src="/assets/cerebel-wordmark.png"
            alt="Cerebel"
            width="595"
            height="194"
          />
        </a>
        <div className="admin-header__actions">
          <span className="live-indicator"><i /> Live data</span>
          <a href="/" target="_blank" rel="noreferrer">
            View website <ArrowSquareOut aria-hidden="true" />
          </a>
          <button type="button" onClick={() => void load()} disabled={loading}>
            <ArrowClockwise aria-hidden="true" /> Refresh
          </button>
        </div>
      </header>

      <main className="admin-main">
        <div className="admin-title">
          <div>
            <p>COMMAND CENTER / 01</p>
            <h1>Website intelligence</h1>
            <span>Traffic, market interest and demo pipeline in one view.</span>
          </div>
          <div className="admin-period">
            <span>Reporting window</span>
            <strong>{summary?.period || "Last 30 days"}</strong>
          </div>
        </div>

        {error && !summary ? <div className="admin-error">{error}</div> : null}
        {loading && !summary ? <DashboardSkeleton /> : null}
        {summary ? (
          <>
            <MetricGrid summary={summary} />
            <div className="admin-grid admin-grid--wide">
              <TrendPanel daily={summary.daily} />
              <DevicePanel devices={summary.devices} />
            </div>
            <div className="admin-grid">
              <MarketPanel markets={summary.markets} />
              <SourcePanel sources={summary.sources} />
            </div>
            <section className="admin-panel leads-panel">
              <div className="panel-heading leads-heading">
                <div>
                  <span>PIPELINE / DEMO REQUESTS</span>
                  <h2>Leads</h2>
                </div>
                <a className="admin-export" href="/api/admin/leads/export.csv">
                  <DownloadSimple aria-hidden="true" /> Export CSV
                </a>
              </div>
              <div className="lead-controls">
                <label>
                  <MagnifyingGlass aria-hidden="true" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search name, email, organization…"
                  />
                </label>
                <label>
                  <FunnelSimple aria-hidden="true" />
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value as LeadStatus | "")}
                  >
                    <option value="">All statuses</option>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option value={value} key={value}>{label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <LeadTable leads={filteredLeads} onSelect={setSelectedLead} />
            </section>
          </>
        ) : null}
      </main>

      {selectedLead ? (
        <LeadDrawer
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onSaved={(updated) => {
            setLeads((current) => current.map((lead) => lead.id === updated.id ? updated : lead));
            setSelectedLead(updated);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

function AccessScreen({ forbidden }: { forbidden: boolean }) {
  return (
    <main className="access-screen">
      <div className="access-screen__mark">MV</div>
      <p>PRIVATE OPERATIONS CONSOLE</p>
      <h1>{forbidden ? "Account not authorized." : "Sign in required."}</h1>
      <span>
        {forbidden
          ? "This dashboard is restricted to the Cerebel owner account."
          : "Open this page through your private Cerebel Sites access link."}
      </span>
      <a href="/">Return to website <ArrowUpRight aria-hidden="true" /></a>
    </main>
  );
}

function DashboardSkeleton() {
  return (
    <div className="admin-skeleton" aria-label="Loading dashboard">
      {Array.from({ length: 8 }, (_, index) => <i key={index} />)}
    </div>
  );
}

function MetricGrid({ summary }: { summary: Summary }) {
  const metrics = [
    {
      label: "Unique visitors",
      value: numeric(summary.totals.visitors),
      previous: numeric(summary.previous.visitors),
      icon: UsersThree,
    },
    {
      label: "Page views",
      value: numeric(summary.totals.page_views),
      previous: numeric(summary.previous.page_views),
      icon: ChartLineUp,
    },
    {
      label: "CTA clicks",
      value: numeric(summary.totals.clicks),
      previous: numeric(summary.previous.clicks),
      icon: MouseSimple,
    },
    {
      label: "Demo leads",
      value: numeric(summary.totals.leads),
      previous: numeric(summary.previous.leads),
      icon: CheckCircle,
    },
  ];

  return (
    <section className="metric-grid" aria-label="Key metrics">
      {metrics.map((metric) => {
        const delta = percentChange(metric.value, metric.previous);
        const Icon = metric.icon;
        return (
          <article className="metric-card" key={metric.label}>
            <div><span>{metric.label}</span><Icon aria-hidden="true" /></div>
            <strong>{metric.value.toLocaleString()}</strong>
            <p className={delta >= 0 ? "is-positive" : "is-negative"}>
              {delta >= 0 ? <ArrowUpRight /> : <ArrowDownRight />}
              {Math.abs(delta)}% <span>vs previous 30d</span>
            </p>
          </article>
        );
      })}
    </section>
  );
}

function completedDaily(points: DailyPoint[]) {
  const values = new Map(points.map((point) => [point.day, point]));
  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (29 - index));
    const day = date.toISOString().slice(0, 10);
    return values.get(day) || { day, visitors: 0, page_views: 0, clicks: 0 };
  });
}

function TrendPanel({ daily }: { daily: DailyPoint[] }) {
  const points = completedDaily(daily);
  const width = 760;
  const height = 260;
  const max = Math.max(1, ...points.map((point) => numeric(point.visitors)));
  const line = points.map((point, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = height - (numeric(point.visitors) / max) * (height - 34) - 12;
    return `${x},${y}`;
  }).join(" ");
  const area = `0,${height} ${line} ${width},${height}`;

  return (
    <section className="admin-panel trend-panel">
      <div className="panel-heading">
        <div><span>TRAFFIC / 30 DAY SIGNAL</span><h2>Visitor trend</h2></div>
        <div className="chart-legend"><i /> Unique visitors</div>
      </div>
      <div className="trend-chart">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Unique visitors over the last 30 days">
          <defs>
            <linearGradient id="traffic-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff5a1f" stopOpacity=".3" />
              <stop offset="100%" stopColor="#ff5a1f" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3].map((row) => (
            <line key={row} x1="0" x2={width} y1={(height / 4) * row + 12} y2={(height / 4) * row + 12} />
          ))}
          <polygon points={area} fill="url(#traffic-area)" />
          <polyline points={line} fill="none" stroke="#ff5a1f" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="chart-axis">
          <span>{formatDate(new Date(points[0].day).getTime())}</span>
          <span>{formatDate(new Date(points[14].day).getTime())}</span>
          <span>{formatDate(new Date(points[29].day).getTime())}</span>
        </div>
      </div>
    </section>
  );
}

function DevicePanel({ devices }: { devices: Summary["devices"] }) {
  const total = Math.max(1, devices.reduce((sum, row) => sum + numeric(row.visitors), 0));
  const desktop = devices.find((row) => row.device === "desktop");
  const desktopShare = Math.round((numeric(desktop?.visitors) / total) * 100);
  return (
    <section className="admin-panel device-panel">
      <div className="panel-heading"><div><span>AUDIENCE / DEVICES</span><h2>Environment</h2></div></div>
      <div
        className="device-ring"
        style={{ "--share": `${desktopShare * 3.6}deg` } as React.CSSProperties}
      >
        <div><strong>{desktopShare}%</strong><span>desktop</span></div>
      </div>
      <div className="device-list">
        {devices.map((row) => (
          <div key={row.device}><span>{row.device || "unknown"}</span><strong>{numeric(row.visitors)}</strong></div>
        ))}
        {!devices.length ? <p>No traffic yet</p> : null}
      </div>
    </section>
  );
}

function MarketPanel({ markets }: { markets: Summary["markets"] }) {
  const max = Math.max(1, ...markets.map((market) => numeric(market.visitors)));
  return (
    <section className="admin-panel">
      <div className="panel-heading">
        <div><span>GEO / EDGE MARKET SIGNAL</span><h2>Top markets</h2></div>
        <GlobeHemisphereEast aria-hidden="true" />
      </div>
      <div className="rank-list">
        {markets.map((market, index) => (
          <div className="rank-row" key={market.country}>
            <span className="rank-index">{String(index + 1).padStart(2, "0")}</span>
            <strong>{market.country}</strong>
            <div><i style={{ width: `${(numeric(market.visitors) / max) * 100}%` }} /></div>
            <span>{numeric(market.visitors).toLocaleString()}</span>
          </div>
        ))}
        {!markets.length ? <EmptyState text="Market data will appear after the first visit." /> : null}
      </div>
    </section>
  );
}

function SourcePanel({ sources }: { sources: Summary["sources"] }) {
  const total = Math.max(1, sources.reduce((sum, source) => sum + numeric(source.visitors), 0));
  return (
    <section className="admin-panel">
      <div className="panel-heading"><div><span>ATTRIBUTION / ACQUISITION</span><h2>Traffic sources</h2></div></div>
      <div className="source-list">
        {sources.map((source) => {
          const share = Math.round((numeric(source.visitors) / total) * 100);
          return (
            <div key={source.source}>
              <span>{friendlySource(source.source)}</span>
              <div><i style={{ width: `${share}%` }} /></div>
              <strong>{share}%</strong>
            </div>
          );
        })}
        {!sources.length ? <EmptyState text="Acquisition sources will appear after the first visit." /> : null}
      </div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="empty-state">{text}</p>;
}

function LeadTable({ leads, onSelect }: { leads: Lead[]; onSelect: (lead: Lead) => void }) {
  if (!leads.length) return <EmptyState text="No leads match this view yet." />;
  return (
    <div className="lead-table-wrap">
      <table className="lead-table">
        <thead><tr><th>Contact</th><th>Organization</th><th>Interest</th><th>Market / IP</th><th>Status</th><th>Received</th></tr></thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} onClick={() => onSelect(lead)}>
              <td><strong>{lead.name}</strong><span>{lead.email}</span></td>
              <td>{lead.organization}</td>
              <td>{lead.interest}</td>
              <td><strong>{[lead.city, lead.country].filter(Boolean).join(", ") || "Unknown"}</strong><span>{lead.ipAddress || "No IP"}</span></td>
              <td><span className={`status-pill status-pill--${lead.status}`}>{statusLabels[lead.status]}</span></td>
              <td>{formatDate(lead.createdAt, true)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LeadDrawer({
  lead,
  onClose,
  onSaved,
}: {
  lead: Lead;
  onClose: () => void;
  onSaved: (lead: Lead) => void;
}) {
  const [leadStatus, setLeadStatus] = useState<LeadStatus>(lead.status);
  const [notes, setNotes] = useState(lead.notes);
  const [owner, setOwner] = useState(lead.owner);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      await api(`/api/admin/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: leadStatus, notes, owner }),
      });
      onSaved({ ...lead, status: leadStatus, notes, owner, updatedAt: Date.now() });
      setMessage("Saved");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="drawer-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <aside className="lead-drawer" aria-label={`Lead details for ${lead.name}`}>
        <div className="drawer-heading">
          <div><span>LEAD RECORD</span><h2>{lead.name}</h2><a href={`mailto:${lead.email}`}>{lead.email}</a></div>
          <button type="button" onClick={onClose} aria-label="Close lead details"><X /></button>
        </div>
        <dl className="lead-facts">
          <div><dt>Organization</dt><dd>{lead.organization}</dd></div>
          <div><dt>Interest</dt><dd>{lead.interest}</dd></div>
          <div><dt>Received</dt><dd>{formatDate(lead.createdAt, true)}</dd></div>
          <div><dt>Location</dt><dd>{[lead.city, lead.region, lead.country].filter(Boolean).join(", ") || "Unknown"}</dd></div>
          <div><dt>Raw IP address</dt><dd className="mono">{lead.ipAddress || "Unavailable"}</dd></div>
          <div><dt>Attribution</dt><dd>{lead.utmSource || friendlySource(lead.referrer) || "Direct"}</dd></div>
        </dl>
        <div className="lead-message"><span>MESSAGE</span><p>{lead.message}</p></div>
        <div className="lead-edit">
          <label><span>Status</span><select value={leadStatus} onChange={(event) => setLeadStatus(event.target.value as LeadStatus)}>
            {Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select></label>
          <label><span>Owner</span><input value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="Assign owner" /></label>
          <label><span>Internal notes</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={6} placeholder="Add follow-up context…" /></label>
          <button type="button" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
          <small aria-live="polite">{message}</small>
        </div>
      </aside>
    </div>
  );
}
