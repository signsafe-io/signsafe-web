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
        <div className="mx-auto flex h-14 max-w-screen-xl items-center justify-between gap-4 px-4 sm:px-6">
          {/* Left: logo + nav */}
          <div className="flex items-center gap-6 min-w-0">
            <Link
              href="/contracts"
              className="flex flex-shrink-0 items-center gap-2 text-sm font-semibold tracking-tight text-zinc-900"
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
              <span className="hidden sm:inline">SignSafe</span>
            </Link>

            <nav className="flex items-center gap-5">
              <NavLink href="/dashboard">대시보드</NavLink>
              <NavLink href="/contracts">계약서</NavLink>
              {user?.permissions?.includes("audit:read") && (
                <NavLink href="/audit-logs">감사 로그</NavLink>
              )}
            </nav>
          </div>

          {/* Right: org switcher + user */}
          <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
            <OrgSwitcher />

            {user && (
              <span className="hidden text-sm text-zinc-500 lg:inline truncate max-w-[120px]">
                {user.fullName}
              </span>
            )}

            <div className="flex items-center gap-1">
              <Link
                href="/settings"
                className="cursor-pointer rounded-md px-2.5 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              >
                <span className="hidden sm:inline">설정</span>
                <svg
                  className="h-4 w-4 sm:hidden"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </Link>
              <button
                onClick={handleLogout}
                className="cursor-pointer rounded-md px-2.5 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              >
                <span className="hidden sm:inline">로그아웃</span>
                <svg
                  className="h-4 w-4 sm:hidden"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
