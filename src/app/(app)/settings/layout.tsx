"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function SettingsTab({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={[
        "relative pb-3 text-sm font-medium transition-colors duration-150",
        isActive
          ? "text-zinc-900"
          : "text-zinc-500 hover:text-zinc-800",
      ].join(" ")}
    >
      {children}
      {isActive && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-zinc-900" />
      )}
    </Link>
  );
}

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      {/* Sticky tab bar */}
      <div className="sticky top-14 lg:top-0 z-20 border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-3xl gap-6 px-4 pt-5 sm:px-6">
          <SettingsTab href="/settings">계정</SettingsTab>
          <SettingsTab href="/settings/organization">조직</SettingsTab>
        </div>
      </div>

      {/* Page content — each page provides its own container */}
      {children}
    </div>
  );
}
