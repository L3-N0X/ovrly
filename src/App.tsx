import { ThemeProvider } from "@/components/theme-provider";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import OverlayPage from "./pages/OverlayPage";
import { SettingsPage } from "./pages/SettingsPage";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import MainLayout from "./components/MainLayout";
import PublicCounterPage from "./pages/PublicCounterPage";
import SharedComponentPage from "./pages/SharedComponentPage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <Router>
          <Routes>
            <Route element={<MainLayout />}>
              {/* Shows the landing page or the dashboard, so it waits for the session itself. */}
              <Route path="/" element={<HomePage />} />
              <Route path="/settings" element={<ProtectedRoute />}>
                <Route index element={<SettingsPage />} />
              </Route>
              {/* Open to anyone with the link; adding the component needs a sign-in. */}
              <Route path="/components/shared/:token" element={<SharedComponentPage />} />
            </Route>
            {/* The editor is full screen with its own top bar. */}
            <Route path="/overlay/:id" element={<ProtectedRoute />}>
              <Route index element={<OverlayPage />} />
            </Route>
            <Route path="/public/overlay/:overlayId" element={<PublicCounterPage />} />
          </Routes>
        </Router>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
