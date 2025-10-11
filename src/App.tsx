import { ThemeProvider } from "@/components/theme-provider";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import OverlayPage from "./pages/OverlayPage";
import { SettingsPage } from "./pages/SettingsPage";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import LoggedInRoute from "./components/auth/LoggedInRoute";
import MainLayout from "./components/MainLayout";
import PublicCounterPage from "./pages/PublicCounterPage";

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Router>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<LoggedInRoute />}>
              <Route index element={<HomePage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="/overlay/:id" element={<ProtectedRoute />}>
              <Route index element={<OverlayPage />} />
            </Route>
          </Route>
          <Route path="/public/:overlayId" element={<PublicCounterPage />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
