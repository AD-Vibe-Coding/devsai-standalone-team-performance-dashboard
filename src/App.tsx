import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import Overview from "@/pages/Overview";
import Trends from "@/pages/Trends";
import ImportPage from "@/pages/ImportPage";
import RawData from "@/pages/RawData";
import Disputes from "@/pages/Disputes";
import Help from "@/pages/Help";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Overview />} />
          <Route path="/trends" element={<Trends />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/raw" element={<RawData />} />
          <Route path="/disputes" element={<Disputes />} />
          <Route path="/help" element={<Help />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
