"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/lib/auth";
import { api } from "@/lib/api";
import { OrgSwitcher } from "@/components/ui/OrgSwitcher";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { accessToken, user, setAuth, clearAuth } = useAuthStore();

  // On mount, if no token in memory, attempt a silent refresh.
  useEffect(() => {
    if (accessToken) return;

    api
      .getMe()
      .then((user) => {
        // getMe() triggers a token refresh internally; grab the refreshed token.
        const token = useAuthStore.getState().accessToken ?? "";
        setAuth(token, user);
      })
      .catch(() => {
        clearAuth();
        router.replace("/login");
      });
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLogout() {
    try {
      await api.logout();
    } finally {
      clearAuth();
      router.replace("/login");
    }
  }

  // While we have a valid token (or are re-hydrating) show the shell.
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      {/* Top nav */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-6">
        <Link href="/contracts" className="text-lg font-bold tracking-tight text-zinc-900">
          SignSafe
        </Link>

        <nav className="flex items-center gap-6">
          <Link
            href="/contracts"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
          >
            Contracts
          </Link>
          {user?.permissions?.includes("audit:read") && (
            <Link
              href="/audit-logs"
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
            >
              Audit Log
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          <OrgSwitcher />
          {user && (
            <span className="text-sm text-zinc-500 hidden sm:inline">
              {user.fullName}
            </span>
          )}
          <Link
            href="/settings"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            Settings
          </Link>
          <button
            onClick={handleLogout}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
