import React from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";

const MainLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      {/* Pages marked `data-full-bleed` (the landing page) run edge to edge. */}
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 pt-8 has-[[data-full-bleed]]:max-w-none has-[[data-full-bleed]]:p-0">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
