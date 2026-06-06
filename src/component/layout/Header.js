// src/components/Header.js
import React, { useState } from "react";
import { FiMenu, FiX } from "react-icons/fi";
import { Link, useNavigate } from "react-router-dom";
import useAuth from "../../contexts/Auth";

const navLinks = [
  { label: "Add Note", href: "/" },
  { label: "All Notes", href: "/allnotes" },
  { label: "Chat", href: "/message" },
  { label: "Drafts", href: "/draft" },
];

const Header = () => {
  const navigate = useNavigate();
  const { cookies, removeCookie, setAuth } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    removeCookie("token", { path: "/" });
    removeCookie("name", { path: "/" });
    removeCookie("userId", { path: "/" });
    setAuth(false);
    navigate("/login", { replace: true });
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-3 text-slate-900">
          <img
            src="image/logo.png"
            alt="Notepad logo"
            className="h-10 w-10 rounded-full border border-slate-200 object-cover"
          />
          <div>
            <p className="text-lg font-semibold">Notepad</p>
            <p className="text-xs text-slate-500">
              Notes, drafts & chat in one place
            </p>
          </div>
        </Link>

        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:hidden"
          onClick={() => setMenuOpen((current) => !current)}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? <FiX size={20} /> : <FiMenu size={20} />}
          Menu
        </button>

        <nav
          className={`w-full transition-all duration-200 sm:flex sm:w-auto ${menuOpen ? "block" : "hidden"}`}
          aria-hidden={!menuOpen}
        >
          <ul className="flex flex-col gap-2 px-2 pb-4 sm:flex-row sm:items-center sm:gap-4 sm:px-0 sm:pb-0">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  to={link.href}
                  className="block rounded-full px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 sm:px-3"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-1 items-center justify-end gap-3 sm:justify-between">
          <p className="hidden min-w-[140px] text-sm font-medium text-slate-600 sm:block">
            Hi, {cookies?.name ?? "User"}
          </p>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            onClick={handleLogout}
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
