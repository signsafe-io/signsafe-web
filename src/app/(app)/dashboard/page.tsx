"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuthStore } from "@/lib/auth";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { Contract, DashboardStats, ContractStatus } from "@/types";

// ─── Status badge helpers (reusing contracts page colours) ─────────────────

const STATUS_LABEL: Record<string, string> = {
  uploaded: "Uploaded",
  processing: "Processing",
  ready: "Ready",
  failed: "Failed",
};

const STATUS_COLOR: Record<string, string> = {
  uploaded: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  processing: "bg-amber-50 text-amber-700 ring-amber-200",
  ready: "bg-green-50 text-green-700 ring-green-200",
  failed: "bg-red-50 text-red-600 ring-red-200",
};

// ─── Expiry helpers ─────────────────────────────────────────────────────────

/**
 * Returns the number of days until a date string from now.
 * Negative means it has already expired.
 */
function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function ExpiryBadge({ expiresAt }: { expiresAt: string }) {
  const days = daysUntil(expiresAt);
  if (days < 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
        Expired
      </span>
    );
  }
  if (days === 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
        Expires today
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
      D-{days}
    </span>
  );
}

// ─── Skeleton helpers ───────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-zinc-200 bg-white p-5">
      <div className="mb-2 h-3 w-24 rounded bg-zinc-100" />
      <div className="h-8 w-16 rounded bg-zinc-100" />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="animate-pulse flex items-center gap-3 px-4 py-3">
      <div className="h-4 flex-1 rounded bg-zinc-100" />
      <div className="h-4 w-20 rounded bg-zinc-100" />
      <div className="h-4 w-24 rounded bg-zinc-100" />
    </div>
  );
}

// ─── Stat card ──────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  accent?: string; // tailwind text colour class
}

function StatCard({ label, value, accent = "text-zinc-900" }: StatCardProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
        {label}
      </p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${accent}`}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

// ─── Risk distribution bar ──────────────────────────────────────────────────

interface RiskBarProps {
  high: number;
  medium: number;
  low: number;
}

function RiskBar({ high, medium, low }: RiskBarProps) {
  const total = high + medium + low;
  if (total === 0) {
    return (
      <p className="text-sm text-zinc-400">
        No completed analyses yet.
      </p>
    );
  }

  const highPct = Math.round((high / total) * 100);
  const medPct = Math.round((medium / total) * 100);
  const lowPct = 100 - highPct - medPct;

  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {highPct > 0 && (
          <div
            className="bg-red-500 transition-all"
            style={{ width: `${highPct}%` }}
          />
        )}
        {medPct > 0 && (
          <div
            className="bg-amber-400 transition-all"
            style={{ width: `${medPct}%` }}
          />
        )}
        {lowPct > 0 && (
          <div
            className="bg-green-400 transition-all"
            style={{ width: `${lowPct}%` }}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        <span className="flex items-center gap-1.5 text-zinc-600">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500" />
          High — {high} ({highPct}%)
        </span>
        <span className="flex items-center gap-1.5 text-zinc-600">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-400" />
          Medium — {medium} ({medPct}%)
        </span>
        <span className="flex items-center gap-1.5 text-zinc-600">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-green-400" />
          Low — {low} ({lowPct}%)
        </span>
      </div>
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuthStore();
  const orgId = user?.organizationId ?? "";

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expiringContracts, setExpiringContracts] = useState<Contract[]>([]);
  const [expiringLoading, setExpiringLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDashboardStats(orgId);
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const fetchExpiring = useCallback(async () => {
    if (!orgId) return;
    setExpiringLoading(true);
    try {
      const data = await api.getExpiringContracts(orgId, 30);
      setExpiringContracts(data.contracts ?? []);
    } catch {
      // Non-critical: silently ignore
      setExpiringContracts([]);
    } finally {
      setExpiringLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchStats();
    fetchExpiring();
  }, [fetchStats, fetchExpiring]);

  // Wait for user to hydrate before fetching.
  useEffect(() => {
    if (orgId) {
      fetchStats();
      fetchExpiring();
    }
  }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 py-8 sm:px-6">
      {/* Page header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
          {user?.organizationName && (
            <p className="mt-0.5 text-sm text-zinc-500">{user.organizationName}</p>
          )}
        </div>
        <Link
          href="/contracts"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          View Contracts
        </Link>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}{" "}
          <button
            onClick={fetchStats}
            className="underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Contract status cards */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Contract Overview
        </h2>
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Total" value={stats?.totalContracts ?? 0} />
            <StatCard
              label="Ready"
              value={stats?.readyContracts ?? 0}
              accent="text-green-600"
            />
            <StatCard
              label="Processing"
              value={stats?.processingContracts ?? 0}
              accent="text-amber-600"
            />
            <StatCard
              label="Uploaded"
              value={stats?.uploadedContracts ?? 0}
            />
            <StatCard
              label="Failed"
              value={stats?.failedContracts ?? 0}
              accent="text-red-600"
            />
            <StatCard
              label="Expiring (30d)"
              value={stats?.expiringSoon ?? 0}
              accent={(stats?.expiringSoon ?? 0) > 0 ? "text-amber-600" : "text-zinc-900"}
            />
          </div>
        )}
      </section>

      {/* Bottom three-column section */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Risk distribution */}
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-800">
              Risk Distribution
            </h2>
            {!loading && stats && (
              <span className="text-xs text-zinc-400">
                {stats.recentAnalyses} analyses (last 30 days)
              </span>
            )}
          </div>
          {loading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-3 w-full rounded-full bg-zinc-100" />
              <div className="h-4 w-48 rounded bg-zinc-100" />
            </div>
          ) : stats ? (
            <RiskBar
              high={stats.riskDistribution.highCount}
              medium={stats.riskDistribution.mediumCount}
              low={stats.riskDistribution.lowCount}
            />
          ) : null}
        </section>

        {/* Recent contracts */}
        <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-800">
              Recent Contracts
            </h2>
            <Link
              href="/contracts"
              className="text-xs font-medium text-zinc-500 hover:text-zinc-800"
            >
              View all
            </Link>
          </div>

          {loading ? (
            <div className="divide-y divide-zinc-50">
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          ) : !stats || stats.recentContracts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-zinc-400">
              <svg
                className="h-8 w-8 text-zinc-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              No contracts yet.{" "}
              <Link href="/contracts" className="underline hover:no-underline">
                Upload one
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-50">
              {stats.recentContracts.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/contracts/${c.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-zinc-50"
                  >
                    <span className="truncate text-sm font-medium text-zinc-800">
                      {c.title}
                    </span>
                    <div className="flex flex-shrink-0 items-center gap-3">
                      <span
                        className={[
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                          STATUS_COLOR[c.status as ContractStatus] ?? STATUS_COLOR.uploaded,
                        ].join(" ")}
                      >
                        {STATUS_LABEL[c.status] ?? c.status}
                      </span>
                      <span className="text-xs text-zinc-400">
                        {formatDate(c.createdAt)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Expiring soon widget */}
        <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-800">
              Expiring Soon
            </h2>
            <span className="text-xs text-zinc-400">Next 30 days</span>
          </div>

          {expiringLoading ? (
            <div className="divide-y divide-zinc-50">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          ) : expiringContracts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-zinc-400">
              <svg
                className="h-8 w-8 text-zinc-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              No contracts expiring soon.
            </div>
          ) : (
            <ul className="divide-y divide-zinc-50">
              {expiringContracts.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/contracts/${c.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-zinc-50"
                  >
                    <span className="truncate text-sm font-medium text-zinc-800">
                      {c.title}
                    </span>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      {c.expiresAt && <ExpiryBadge expiresAt={c.expiresAt} />}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
