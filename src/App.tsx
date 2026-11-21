import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import Overview from "@/pages/Overview";
import Trends from "@/pages/Trends";
import Individual from "@/pages/Individual";
import Upload from "@/pages/Upload";
import { SnapshotProvider } from "@/lib/snapshot-store";

export default function App() {
  return (
    <SnapshotProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<Overview />} />
            <Route path="/trends" element={<Trends />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SnapshotProvider>
  );
}
