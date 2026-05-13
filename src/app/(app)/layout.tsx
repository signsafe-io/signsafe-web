"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/lib/auth";
import type { User } from "@/types";
import { api } from "@/lib/api";
import { OrgSwitcher } from "@/components/ui/OrgSwitcher";

// ── Icons ─────────────────────────────────────────────────────────────────────

function DashboardIcon() {
  return (
    <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 13a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z"
      />
    </svg>
  );
}

function ContractIcon() {
  return (
    <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function AuditIcon() {
  return (
    <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

// ── Nav link ──────────────────────────────────────────────────────────────────

function NavLink({
  href,
  icon,
  children,
  collapsed,
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  collapsed?: boolean;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? String(children) : undefined}
      className={[
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        collapsed ? "justify-center" : "",
        isActive
          ? "bg-blue-50 text-blue-600"
          : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800",
      ].join(" ")}
    >
      <span className={isActive ? "text-blue-600" : "text-zinc-400"}>
        {icon}
      </span>
      {!collapsed && children}
    </Link>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({
  user,
  collapsed,
  onToggleCollapse,
  onLogout,
  onClose,
}: {
  user: User | null;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onLogout: () => void;
  onClose?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Logo + collapse toggle */}
      <div className={[
        "flex-shrink-0 border-b border-zinc-100",
        collapsed ? "flex h-16 items-center justify-center px-3" : "px-4",
      ].join(" ")}>
        <div className={[
          "flex h-16 items-center",
          collapsed ? "" : "justify-between",
        ].join(" ")}>
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600">
                <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <span className="text-base font-bold text-blue-600">SignSafe</span>
            </div>
          )}
          {collapsed && (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600">
              <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
          )}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className={[
                "rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600",
                collapsed ? "absolute -right-3 top-[3.75rem] z-10 border border-zinc-200 bg-white shadow-sm" : "",
              ].join(" ")}
              title={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
            >
              {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </button>
          )}
        </div>
        {/* OrgSwitcher — below logo, only when expanded */}
        {!collapsed && (
          <div className="pb-3">
            <OrgSwitcher />
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3 py-3">
        <NavLink href="/dashboard" icon={<DashboardIcon />} collapsed={collapsed} onClick={onClose}>
          대시보드
        </NavLink>
        <NavLink href="/contracts" icon={<ContractIcon />} collapsed={collapsed} onClick={onClose}>
          계약서
        </NavLink>
        {user?.permissions?.includes("audit:read") && (
          <NavLink href="/audit-logs" icon={<AuditIcon />} collapsed={collapsed} onClick={onClose}>
            감사 로그
          </NavLink>
        )}
      </nav>

      {/* Bottom section */}
      <div className={[
        "flex-shrink-0 space-y-1 border-t border-zinc-100 px-3 py-4",
        collapsed ? "items-center" : "",
      ].join(" ")}>
        {!collapsed && user && (
          <div className="truncate px-3 pb-1 text-xs text-zinc-400">
            {user.fullName}
          </div>
        )}
        <NavLink href="/settings" icon={<SettingsIcon />} collapsed={collapsed} onClick={onClose}>
          설정
        </NavLink>
        <button
          onClick={onLogout}
          title={collapsed ? "로그아웃" : undefined}
          className={[
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-800",
            collapsed ? "justify-center" : "",
          ].join(" ")}
        >
          <span className="text-zinc-400">
            <LogoutIcon />
          </span>
          {!collapsed && "로그아웃"}
        </button>
      </div>
    </div>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { accessToken, user, setAuth, clearAuth } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (accessToken) return;

    api
      .getMe()
      .then((u) => {
        const token = useAuthStore.getState().accessToken ?? "";
        setAuth(token, u);
      })
      .catch(() => {
        clearAuth();
        router.replace("/login");
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLogout() {
    try {
      await api.logout();
    } finally {
      clearAuth();
      router.replace("/login");
    }
  }

  const sidebarWidth = collapsed ? "lg:w-16" : "lg:w-64";
  const contentMargin = collapsed ? "lg:ml-16" : "lg:ml-64";

  return (
    <div className="flex min-h-screen bg-zinc-50">
      {/* Desktop sidebar */}
      <aside className={[
        "fixed inset-y-0 left-0 z-30 hidden border-r border-zinc-200 bg-white transition-all duration-200 lg:flex lg:flex-col",
        sidebarWidth,
      ].join(" ")}>
        <Sidebar
          user={user}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((v) => !v)}
          onLogout={handleLogout}
        />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 w-64 border-r border-zinc-200 bg-white transition-transform duration-200 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <Sidebar user={user} onLogout={handleLogout} onClose={() => setMobileOpen(false)} />
      </aside>

      {/* Content area */}
      <div className={[
        "flex min-h-screen flex-1 flex-col transition-all duration-200",
        contentMargin,
      ].join(" ")}>
        {/* Mobile top bar */}
        <header className="flex h-14 items-center gap-3 border-b border-zinc-200 bg-white px-4 lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100"
          >
            <MenuIcon />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
              <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <span className="text-sm font-bold text-blue-600">SignSafe</span>
          </div>
        </header>

        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
