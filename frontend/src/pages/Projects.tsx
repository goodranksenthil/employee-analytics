import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useApi, usd } from "../api";
import type { ProjectSummary } from "../types";
import { BillableBadge, Card, Empty, ErrorState, Kpi, Loading, PageHeader, StatusBadge, Tabs } from "../components/ui";

type Filter = "all" | "true" | "false";

export default function Projects() {
  const [params, setParams] = useSearchParams();
  const filter = (params.get("billable") as Filter | null) ?? "all";
  const [status, setStatus] = useState("All");
  const [q, setQ] = useState("");
  const nav = useNavigate();
  const { data, loading, error, reload } = useApi<ProjectSummary[]>("/projects");

  const rows = useMemo(() => {
    let r = data ?? [];
    if (filter !== "all") r = r.filter((p) => String(p.is_billable) === filter);
    if (status !== "All") r = r.filter((p) => p.status === status);
    if (q) {
      const s = q.toLowerCase();
      r = r.filter((p) => [p.name, p.client, p.code, ...p.skills].some((x) => x.toLowerCase().includes(s)));
    }
    return r;
  }, [data, filter, status, q]);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? ""} onRetry={reload} />;

  const billable = data.filter((p) => p.is_billable);
  const title = filter === "true" ? "Billable Projects" : filter === "false" ? "Non-Billable Projects" : "All Projects";

  return (
    <>
      <PageHeader title={title} subtitle="Every engagement in the organization with staffing and billing status." />
      <div className="kpi-grid kpi-4">
        <Kpi label="Total Projects" value={data.length} />
        <Kpi label="Billable" value={billable.length} tone="green" />
        <Kpi label="Non-Billable" value={data.length - billable.length} tone="violet" />
        <Kpi label="Monthly Billing" value={usd(data.reduce((s, p) => s + p.monthly_revenue, 0))} tone="green" />
      </div>

      <Card
        title={
          <Tabs<Filter>
            value={filter}
            onChange={(v) => setParams(v === "all" ? {} : { billable: v })}
            options={[
              { value: "all", label: "All", count: data.length },
              { value: "true", label: "Billable", count: billable.length },
              { value: "false", label: "Non-Billable", count: data.length - billable.length },
            ]}
          />
        }
        actions={
          <div className="toolbar">
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {["All", "Active", "Pipeline", "On Hold", "Completed"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <input className="input" placeholder="Search project, client, skill" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        }
      >
        {rows.length === 0 ? (
          <Empty>No projects match these filters.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Client</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th className="num">Team</th>
                  <th className="num">Open</th>
                  <th>Key Skills</th>
                  <th className="num">Monthly Billing</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="row-link" onClick={() => nav(`/projects/${p.id}`)}>
                    <td>
                      <div className="name">{p.name}</div>
                      <div className="sub">{p.code}</div>
                    </td>
                    <td>{p.client}</td>
                    <td><BillableBadge billable={p.is_billable} /></td>
                    <td><StatusBadge status={p.status} /></td>
                    <td className="num">{p.team_size}/{p.required_headcount}</td>
                    <td className="num">{p.open_positions > 0 ? <span className="text-red">{p.open_positions}</span> : "—"}</td>
                    <td className="muted">{p.skills.slice(0, 4).join(", ")}</td>
                    <td className="num">{p.monthly_revenue ? usd(p.monthly_revenue) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
