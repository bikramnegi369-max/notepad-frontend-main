import React from "react";
import { Outlet } from "react-router-dom";
import Header from "../layout/Header";

const DashboardLayout = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header />
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 mt-24">
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;
