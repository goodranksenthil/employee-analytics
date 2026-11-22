export type Status = "Bench" | "Partially Allocated" | "Fully Allocated";

export interface SkillRef {
  name: string;
  proficiency: number;
}

export interface EmployeeSummary {
  id: number;
  emp_code: string;
  full_name: string;
  email: string;
  role: string;
  years_experience: number;
  location: string;
  utilization: number;
  available_pct: number;
  status: Status;
  is_billable: boolean;
  skills: SkillRef[];
  projects: { id: number; name: string; is_billable: boolean; allocation_pct: number }[];
  // Billing fields are omitted by the API for roles without money:view (HR, Employee).
  hourly_rate?: number;
  monthly_billing?: number;
}

export interface BenchEmployee extends EmployeeSummary {
  bench_since: string;
  bench_days: number;
  best_match: { project_id: number; name: string; score: number } | null;
}

export interface RateBreakdown {
  role: string;
  base: number;
  experience: number;
  skill_premium: number;
  skill_premiums: { skill: string; amount: number }[];
  capped: boolean;
  hourly_rate: number;
  monthly_full_time: number;
}

export interface EmployeeDetail extends EmployeeSummary {
  join_date: string;
  skills_detail: { skill_id: number; name: string; category: string; proficiency: number; years: number }[];
  rate?: RateBreakdown;
  allocations: {
    id: number;
    project_id: number;
    code: string;
    name: string;
    client: string;
    is_billable: boolean;
    allocation_pct: number;
    bill_rate?: number;
    monthly_billing?: number;
    start_date: string;
    end_date: string | null;
    active: boolean;
  }[];
  best_fit_projects: {
    project_id: number;
    code: string;
    name: string;
    is_billable: boolean;
    status: string;
    score: number;
    matched: MatchedSkill[];
    missing: string[];
  }[];
}

export interface ProjectSummary {
  id: number;
  code: string;
  name: string;
  client: string;
  is_billable: boolean;
  status: string;
  start_date: string;
  end_date: string | null;
  team_size: number;
  required_headcount: number;
  open_positions: number;
  monthly_revenue: number;
  skills: string[];
}

export interface Requirement {
  id?: number;
  skill_id: number;
  skill: string;
  role?: string;
  headcount?: number;
  min_proficiency: number;
  min_experience: number;
  filled?: number;
  open?: number;
}

export interface MatchedSkill {
  skill: string;
  proficiency: number;
  required: number;
}

export interface MatchResult {
  employee_id: number;
  emp_code: string;
  full_name: string;
  role: string;
  years_experience: number;
  status: Status;
  available_pct: number;
  score: number;
  matched: MatchedSkill[];
  missing: string[];
}

export interface ProjectDetail extends ProjectSummary {
  description: string;
  requirements: Requirement[];
  team: {
    allocation_id: number;
    employee_id: number;
    emp_code: string;
    full_name: string;
    role: string;
    years_experience: number;
    allocation_pct: number;
    bill_rate: number;
    monthly_billing: number;
    start_date: string;
  }[];
  candidates: MatchResult[];
}

export interface DashboardSummary {
  projects: {
    total: number;
    billable: number;
    non_billable: number;
    active: number;
    by_status: Record<string, number>;
    open_positions: number;
  };
  resources: {
    total: number;
    allocated: number;
    fully_allocated: number;
    partial: number;
    bench: number;
    billable: number;
    utilization_pct: number;
    by_role: Record<string, number>;
  };
  billing?: {
    monthly_revenue: number;
    annual_run_rate: number;
    avg_hourly_rate: number;
    by_project: { name: string; code: string; revenue: number }[];
  };
  bench_by_skill: { skill: string; count: number }[];
  recent_bench: EmployeeSummary[];
}

export interface HiringNeeds {
  total_open: number;
  total_to_hire: number;
  positions: (Requirement & {
    project_id: number;
    project: string;
    code: string;
    client: string;
    is_billable: boolean;
    status: string;
    internal_candidates: { employee_id: number; full_name: string; score: number }[];
    to_hire: number;
  })[];
  skills: {
    skill: string;
    open: number;
    internal_supply: number;
    to_hire: number;
    roles: string[];
    min_experience: number;
    projects: string[];
  }[];
}

export interface PipelineRequirement {
  skill: string;
  category: string;
  role: string;
  headcount: number;
  min_proficiency: number;
  min_experience: number;
  est_rate: number;
  monthly_billing: number;
  internal_available: number;
  to_hire: number;
  candidates: { employee_id: number; full_name: string; role: string; available_pct: number }[];
}

export interface PipelineProject {
  id: number;
  code: string;
  name: string;
  client: string;
  description: string;
  is_billable: boolean;
  start_date: string;
  days_to_start: number;
  duration_months: number;
  end_date: string;
  probability: number;
  headcount: number;
  monthly_billing: number;
  contract_value: number;
  weighted_value: number;
  blended_rate: number;
  to_hire: number;
  readiness_pct: number;
  technologies: string[];
  requirements: PipelineRequirement[];
}

export interface PipelineResponse {
  summary: {
    count: number;
    headcount: number;
    monthly_billing: number;
    contract_value: number;
    weighted_value: number;
    to_hire: number;
    next_start: string | null;
  };
  projects: PipelineProject[];
  technologies: { skill: string; category: string; headcount: number; internal_available: number; to_hire: number; projects: string[] }[];
  forecast: { month: string; weighted: number; full: number }[];
}

export interface MatchResponse {
  source: string;
  requirements: Requirement[];
  matches: MatchResult[];
  message?: string;
}
