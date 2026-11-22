import { useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, Layers, Send, Sparkles, Users, X } from "lucide-react";
import { api, useApi } from "../api";
import type { OpenPosition, PositionsResponse } from "../types";
import { Badge, Card, Empty, ErrorState, Kpi, Loading, PageHeader, Proficiency, Score, SkillChip, StatusBadge, Tabs } from "../components/ui";

type View = "all" | "fit" | "mine";

const STRONG_FIT = 80;

export default function OpenPositions() {
  const { data, loading, error, reload } = useApi<PositionsResponse>("/positions");
  const [view, setView] = useState<View>("all");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("All");
  const [applying, setApplying] = useState<OpenPosition | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const positions = data?.positions ?? [];
  const categories = useMemo(() => ["All", ...Array.from(new Set(positions.map((p) => p.category))).sort()], [positions]);

  const filtered = useMemo(() => {
    let list = positions;
    if (view === "fit") list = list.filter((p) => p.fit.score >= STRONG_FIT);
    if (view === "mine") list = list.filter((p) => p.my_application);
    if (category !== "All") list = list.filter((p) => p.category === category);
    if (q) {
      const s = q.toLowerCase();
      list = list.filter((p) =>
        [p.skill, p.role, p.project.name, p.project.client, ...p.project.technologies].some((x) => x.toLowerCase().includes(s))
      );
    }
    return list;
  }, [positions, view, category, q]);

  // Group by project, keeping the sort order the API returned.
  const groups = useMemo(() => {
    const map = new Map<number, { project: OpenPosition["project"]; items: OpenPosition[] }>();
    for (const p of filtered) {
      if (!map.has(p.project.id)) map.set(p.project.id, { project: p.project, items: [] });
      map.get(p.project.id)!.items.push(p);
    }
    return [...map.values()];
  }, [filtered]);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? ""} onRetry={reload} />;

  const mine = positions.filter((p) => p.my_application);
  const strong = positions.filter((p) => p.fit.score >= STRONG_FIT);
  const projects = new Set(positions.map((p) => p.project.id)).size;
  const techs = new Set(positions.flatMap((p) => p.project.technologies)).size;

  const withdraw = async (p: OpenPosition) => {
    if (!p.my_application) return;
    try {
      await api(`/applications/${p.my_application.id}`, { method: "DELETE" });
      setFlash(`Withdrew your application for ${p.skill} · ${p.project.name}.`);
      reload();
    } catch (e) {
      setFlash((e as Error).message);
    }
  };

  return (
    <>
      <PageHeader
        title="Open Positions"
        subtitle="Current openings on active and upcoming projects, the technologies they use, and how well they fit your skills."
      />

      {flash && (
        <div className="flash">
          <CheckCircle2 size={16} /> {flash}
          <button className="icon-btn" aria-label="Dismiss" onClick={() => setFlash(null)}><X size={14} /></button>
        </div>
      )}

      <div className="kpi-grid kpi-4">
        <Kpi label="Open Positions" value={positions.reduce((s, p) => s + p.openings, 0)} hint={`${positions.length} roles across ${projects} projects`} icon={<Users size={18} />} />
        <Kpi label="Good Fit For You" value={strong.length} hint={`Fit score ${STRONG_FIT}% or higher`} icon={<Sparkles size={18} />} tone="green" onClick={() => setView("fit")} />
        <Kpi label="Technologies" value={techs} hint="Across all hiring projects" icon={<Layers size={18} />} tone="violet" />
        <Kpi label="My Applications" value={mine.length} hint={mine.length ? `${mine.filter((p) => p.my_application!.status === "Shortlisted").length} shortlisted` : "Apply to any open role"} icon={<Send size={18} />} tone="blue" onClick={() => setView("mine")} />
      </div>

      <Card
        title={
          <Tabs<View>
            value={view}
            onChange={setView}
            options={[
              { value: "all", label: "All openings", count: positions.length },
              { value: "fit", label: "Good fit for me", count: strong.length },
              { value: "mine", label: "My applications", count: mine.length },
            ]}
          />
        }
        actions={
          <div className="toolbar">
            <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Technology area">
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
            <input className="input" placeholder="Search technology, role, project" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        }
      >
        {groups.length === 0 ? (
          <Empty>{view === "mine" ? "You haven't applied for any position yet." : "No open positions match these filters."}</Empty>
        ) : (
          <div className="pos-groups">
            {groups.map(({ project, items }) => (
              <section key={project.id} className="pos-project">
                <div className="pos-project-head">
                  <div>
                    <div className="name">{project.name}</div>
                    <div className="sub">{project.code} · {project.client}</div>
                  </div>
                  <div className="pos-badges">
                    <StatusBadge status={project.status} />
                    <Badge tone="slate"><CalendarClock size={12} /> {project.status === "Pipeline" ? "Starts" : "Started"} {project.start_date}</Badge>
                  </div>
                </div>
                {project.description && <p className="pos-desc">{project.description}</p>}
                <div className="pos-stack">
                  <span className="muted small">Technology stack:</span>
                  <div className="chips">{project.technologies.map((t) => <SkillChip key={t} name={t} />)}</div>
                </div>

                <div className="table-wrap">
                  <table className="table compact">
                    <thead>
                      <tr>
                        <th>Technology</th><th>Role</th><th>Requirement</th><th className="num">Openings</th>
                        <th>Your fit</th><th className="num">Applicants</th><th className="num">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((p) => (
                        <tr key={p.requirement_id}>
                          <td><SkillChip name={p.skill} /><div className="sub">{p.category}</div></td>
                          <td>{p.role}</td>
                          <td>
                            <div className="req-line"><Proficiency value={p.min_proficiency} /> <span className="muted small">level {p.min_proficiency}/5</span></div>
                            <div className="sub">{p.min_experience}+ yrs experience</div>
                          </td>
                          <td className="num">{p.openings}</td>
                          <td>
                            <div className="fit-line">
                              <Score value={p.fit.score} />
                              <span className="sub">
                                {p.fit.my_level ? `You: level ${p.fit.my_level}/5` : "New skill for you"}
                                {!p.fit.meets_experience && " · needs more experience"}
                              </span>
                            </div>
                          </td>
                          <td className="num">{p.applicants}</td>
                          <td className="num">
                            {p.my_application ? (
                              <div className="apply-state">
                                <StatusBadge status={p.my_application.status} />
                                {(p.my_application.status === "Applied" || p.my_application.status === "Shortlisted") && (
                                  <button className="btn btn-ghost btn-sm" onClick={() => withdraw(p)}>Withdraw</button>
                                )}
                              </div>
                            ) : (
                              <button className="btn btn-primary btn-sm" onClick={() => setApplying(p)}>
                                <Send size={13} /> Apply
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}
      </Card>

      {applying && (
        <ApplyDialog
          position={applying}
          onClose={() => setApplying(null)}
          onApplied={() => {
            setFlash(`Applied for ${applying.skill} · ${applying.role} on ${applying.project.name}. Delivery and HR will review it.`);
            setApplying(null);
            reload();
          }}
        />
      )}
    </>
  );
}

function ApplyDialog({ position: p, onClose, onApplied }: { position: OpenPosition; onClose: () => void; onApplied: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api(`/positions/${p.requirement_id}/apply`, { method: "POST", body: JSON.stringify({ note }) });
      onApplied();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="apply-title">
        <div className="modal-head">
          <h3 id="apply-title">Apply for this position</h3>
          <button className="icon-btn" aria-label="Close" onClick={onClose} disabled={busy}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="apply-summary">
            <div><span>Project</span><strong>{p.project.name}</strong><em className="muted"> · {p.project.client}</em></div>
            <div><span>Role</span><strong>{p.role}</strong></div>
            <div><span>Technology</span><SkillChip name={p.skill} /></div>
            <div><span>Needs</span><strong>Level {p.min_proficiency}/5 · {p.min_experience}+ yrs</strong></div>
            <div><span>Your fit</span><Score value={p.fit.score} /> <em className="muted">{p.fit.my_level ? `you're level ${p.fit.my_level}/5` : "new skill for you"}</em></div>
          </div>
          <label className="field">
            <span>Note to the hiring team <em className="muted">(optional)</em></span>
            <textarea rows={4} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Relevant experience, availability, why you're interested…" />
          </label>
          {err && <div className="login-error">{err}</div>}
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}><Send size={14} /> {busy ? "Submitting…" : "Submit application"}</button>
        </div>
      </div>
    </div>
  );
}
