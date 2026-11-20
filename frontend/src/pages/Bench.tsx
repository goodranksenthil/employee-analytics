import { useNavigate } from "react-router-dom";
import { useApi, usd } from "../api";
import type { BenchEmployee } from "../types";
import { Card, Empty, ErrorState, Kpi, Loading, PageHeader, Score, SkillChip } from "../components/ui";

export default function Bench() {
  const nav = useNavigate();
  const { data, loading, error, reload } = useApi<BenchEmployee[]>("/bench");
  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? ""} onRetry={reload} />;

  const avgDays = data.length ? Math.round(data.reduce((s, e) => s + e.bench_days, 0) / data.length) : 0;
  const withMatch = data.filter((e) => e.best_match).length;
  const lostRevenue = data.reduce((s, e) => s + e.hourly_rate * 160, 0);

  return (
    <>
      <PageHeader title="Bench Resources" subtitle="Employees with no active project allocation, and the open project they fit best." />
      <div className="kpi-grid kpi-4">
        <Kpi label="On Bench" value={data.length} tone="red" />
        <Kpi label="Avg. Days on Bench" value={avgDays} tone="amber" />
        <Kpi label="Have a Project Match" value={withMatch} hint="Can be deployed now" tone="green" />
        <Kpi label="Unbilled Capacity / Month" value={usd(lostRevenue)} hint="At computed bill rates" tone="slate" />
      </div>
      <Card title="Bench List">
        {data.length === 0 ? (
          <Empty>Everyone is allocated. 🎉</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th className="num">Exp</th>
                  <th>Skills</th>
                  <th>Location</th>
                  <th>Bench Since</th>
                  <th className="num">Rate</th>
                  <th>Best Match</th>
                </tr>
              </thead>
              <tbody>
                {data.map((e) => (
                  <tr key={e.id} className="row-link" onClick={() => nav(`/resources/${e.id}`)}>
                    <td><div className="name">{e.full_name}</div><div className="sub">{e.role} · {e.emp_code}</div></td>
                    <td className="num">{e.years_experience}</td>
                    <td><div className="chips">{e.skills.map((s) => <SkillChip key={s.name} name={s.name} level={s.proficiency} />)}</div></td>
                    <td>{e.location}</td>
                    <td><div>{e.bench_since}</div><div className="sub">{e.bench_days} days</div></td>
                    <td className="num">{usd(e.hourly_rate)}/hr</td>
                    <td>
                      {e.best_match ? (
                        <a
                          className="link"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            nav(`/projects/${e.best_match!.project_id}`);
                          }}
                        >
                          {e.best_match.name} <Score value={e.best_match.score} />
                        </a>
                      ) : (
                        <span className="muted">No open match</span>
                      )}
                    </td>
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
