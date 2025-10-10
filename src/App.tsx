import { ThemeProvider } from "@/components/theme-provider";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import OverlayPage from "./pages/OverlayPage";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import LoggedInRoute from "./components/auth/LoggedInRoute";
import MainLayout from "./components/MainLayout";

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Router>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<LoggedInRoute />}>
              <Route index element={<HomePage />} />
            </Route>
            <Route path="/overlay/:id" element={<ProtectedRoute />}>
              <Route index element={<OverlayPage />} />
            </Route>
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
