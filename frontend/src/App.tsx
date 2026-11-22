import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import Layout from "./components/Layout";
import { RequireAuth, RequirePerm } from "./components/Guards";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Pipeline from "./pages/Pipeline";
import Resources from "./pages/Resources";
import EmployeeDetail from "./pages/EmployeeDetail";
import Bench from "./pages/Bench";
import SkillMatching from "./pages/SkillMatching";
import HiringNeeds from "./pages/HiringNeeds";
import Billing from "./pages/Billing";

function Home() {
  const { user, can } = useAuth();
  if (!can("dashboard:view")) return <Navigate to={user?.home ?? "/me"} replace />;
  return <Dashboard />;
}

function MyProfile() {
  const { user } = useAuth();
  if (!user?.employee_id) {
    return <RequirePerm perms={["self:view"]}><div className="state">No employee record is linked to this login.</div></RequirePerm>;
  }
  return <EmployeeDetail employeeId={user.employee_id} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Home />} />
        <Route path="me" element={<MyProfile />} />
        <Route path="projects" element={<RequirePerm perms={["projects:view"]}><Projects /></RequirePerm>} />
        <Route path="projects/:id" element={<RequirePerm perms={["projects:view"]}><ProjectDetail /></RequirePerm>} />
        <Route path="pipeline" element={<RequirePerm perms={["pipeline:view"]}><Pipeline /></RequirePerm>} />
        <Route path="resources" element={<RequirePerm perms={["resources:view"]}><Resources /></RequirePerm>} />
        <Route path="resources/:id" element={<RequirePerm perms={["resources:view"]}><EmployeeDetail /></RequirePerm>} />
        <Route path="bench" element={<RequirePerm perms={["bench:view"]}><Bench /></RequirePerm>} />
        <Route path="matching" element={<RequirePerm perms={["matching:use"]}><SkillMatching /></RequirePerm>} />
        <Route path="hiring" element={<RequirePerm perms={["hiring:view"]}><HiringNeeds /></RequirePerm>} />
        <Route path="billing" element={<RequirePerm perms={["billing:view"]}><Billing /></RequirePerm>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
