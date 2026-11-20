import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileUp } from "lucide-react";
import { api, useApi } from "../api";
import type { MatchResponse, ProjectSummary } from "../types";
import { Card, Empty, Loading, PageHeader, Score, SkillChip, StatusBadge, Tabs } from "../components/ui";

type Mode = "project" | "document";

export default function SkillMatching() {
  const nav = useNavigate();
  const projects = useApi<ProjectSummary[]>("/projects");
  const [mode, setMode] = useState<Mode>("project");
  const [projectId, setProjectId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [result, setResult] = useState<MatchResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (mode === "project") {
        if (!projectId) throw new Error("Choose a project");
        setResult(await api<MatchResponse>(`/matching/project/${projectId}?only_available=${onlyAvailable}`));
      } else {
        const fd = new FormData();
        if (file) fd.append("file", file);
        else if (text.trim()) fd.append("text", text);
        else throw new Error("Upload a document or paste requirement text");
        fd.append("only_available", String(onlyAvailable));
        setResult(await api<MatchResponse>("/matching/document", { method: "POST", body: fd }));
      }
    } catch (e) {
      setErr((e as Error).message);
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Skill Matching" subtitle="Match employee skills against a project's requirements or an uploaded requirement document (PDF, DOCX, TXT)." />

      <Card title={<Tabs<Mode> value={mode} onChange={(m) => { setMode(m); setResult(null); }} options={[{ value: "project", label: "By Project" }, { value: "document", label: "By Requirement Document" }]} />}>
        <div className="match-form">
          {mode === "project" ? (
            <label className="field">
              <span>Project</span>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">Select a project…</option>
                {projects.data?.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} · {p.name} ({p.status})</option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label className="dropzone">
                <FileUp size={22} />
                <span>{file ? file.name : "Click to upload a requirement document (.pdf, .docx, .txt, .md)"}</span>
                <input type="file" accept=".pdf,.docx,.txt,.md" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
              {file && <button className="btn btn-ghost btn-sm" onClick={() => setFile(null)}>Remove file</button>}
              {!file && (
                <label className="field">
                  <span>…or paste the requirement text</span>
                  <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Looking for a senior engineer with 5+ years in React, TypeScript and AWS…" />
                </label>
              )}
            </>
          )}
          <div className="form-row">
            <label className="check">
              <input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} />
              Only show employees with free capacity
            </label>
            <button className="btn btn-primary" onClick={run} disabled={busy}>{busy ? "Matching…" : "Find Matches"}</button>
          </div>
          {err && <div className="text-red">{err}</div>}
        </div>
      </Card>

      {busy && <Loading />}
      {result && !busy && (
        <>
          <Card title={`Extracted Requirements · ${result.source}`}>
            {result.requirements.length === 0 ? (
              <p className="muted">{result.message ?? "No requirements found."}</p>
            ) : (
              <div className="chips">
                {result.requirements.map((r) => <SkillChip key={r.skill} name={r.skill} level={r.min_proficiency} />)}
                {result.requirements[0]?.min_experience ? <span className="muted">· min {Math.max(...result.requirements.map((r) => r.min_experience))} yrs experience</span> : null}
              </div>
            )}
          </Card>
          <Card title={`Ranked Matches (${result.matches.length})`}>
            {result.matches.length === 0 ? (
              <Empty>No employees match these skills — consider hiring.</Empty>
            ) : (
              <table className="table">
                <thead><tr><th>#</th><th>Employee</th><th>Status</th><th className="num">Available</th><th>Matched</th><th>Missing</th><th className="num">Fit Score</th></tr></thead>
                <tbody>
                  {result.matches.map((m, i) => (
                    <tr key={m.employee_id} className="row-link" onClick={() => nav(`/resources/${m.employee_id}`)}>
                      <td className="muted">{i + 1}</td>
                      <td><div className="name">{m.full_name}</div><div className="sub">{m.role} · {m.years_experience} yrs</div></td>
                      <td><StatusBadge status={m.status} /></td>
                      <td className="num">{m.available_pct}%</td>
                      <td><div className="chips">{m.matched.map((s) => <SkillChip key={s.skill} name={s.skill} level={s.proficiency} />)}</div></td>
                      <td><div className="chips">{m.missing.map((s) => <SkillChip key={s} name={s} missing />)}</div></td>
                      <td className="num"><Score value={m.score} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </>
  );
}
