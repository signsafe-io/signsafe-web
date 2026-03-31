"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/lib/auth";
import { api } from "@/lib/api";
import { OrgSwitcher } from "@/components/ui/OrgSwitcher";

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={[
        "relative text-sm font-medium transition-colors duration-150",
        isActive
          ? "text-zinc-900"
          : "text-zinc-500 hover:text-zinc-800",
      ].join(" ")}
    >
      {children}
      {isActive && (
        <span className="absolute -bottom-[1px] left-0 right-0 h-[2px] rounded-full bg-zinc-900" />
      )}
    </Link>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { accessToken, user, setAuth, clearAuth } = useAuthStore();

  useEffect(() => {
    if (accessToken) return;

    api
      .getMe()
      .then((user) => {
        const token = useAuthStore.getState().accessToken ?? "";
        setAuth(token, user);
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

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      {/* Top nav */}
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-14 max-w-screen-xl items-center justify-between px-6">
          {/* Left: logo + nav */}
          <div className="flex items-center gap-8">
            <Link
              href="/contracts"
              className="flex items-center gap-2 text-sm font-semibold tracking-tight text-zinc-900"
            >
              {/* Shield icon */}
              <svg
                className="h-5 w-5 text-zinc-900"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              SignSafe
            </Link>

            <nav className="flex items-center gap-6">
              <NavLink href="/contracts">Contracts</NavLink>
              {user?.permissions?.includes("audit:read") && (
                <NavLink href="/audit-logs">Audit Log</NavLink>
              )}
            </nav>
          </div>

          {/* Right: org switcher + user */}
          <div className="flex items-center gap-3">
            <OrgSwitcher />

            {user && (
              <span className="hidden text-sm text-zinc-500 sm:inline">
                {user.fullName}
              </span>
            )}

            <div className="flex items-center gap-1.5">
              <Link
                href="/settings"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              >
                Settings
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
