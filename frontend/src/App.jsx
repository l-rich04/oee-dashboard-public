import { BrowserRouter, Routes, Route } from "react-router-dom";
import ForemanForm from "./pages/ForemanForm";
import SupervisorDashboard from "./pages/SupervisorDashboard";
import DefectForm from "./pages/DefectForm";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"           element={<ForemanForm />} />
        <Route path="/supervisor" element={<SupervisorDashboard />} />
        <Route path="/defects"    element={<DefectForm />} />
      </Routes>
    </BrowserRouter>
  );
}