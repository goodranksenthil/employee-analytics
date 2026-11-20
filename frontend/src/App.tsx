import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
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

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="pipeline" element={<Pipeline />} />
        <Route path="resources" element={<Resources />} />
        <Route path="resources/:id" element={<EmployeeDetail />} />
        <Route path="bench" element={<Bench />} />
        <Route path="matching" element={<SkillMatching />} />
        <Route path="hiring" element={<HiringNeeds />} />
        <Route path="billing" element={<Billing />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
