"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuthStore } from "@/lib/auth";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { Contract, DashboardStats, ContractStatus } from "@/types";

// ─── Status badge helpers (reusing contracts page colours) ─────────────────

const STATUS_LABEL: Record<string, string> = {
  uploaded: "업로드됨",
  processing: "처리 중",
  ready: "준비 완료",
  failed: "실패",
};

const STATUS_COLOR: Record<string, string> = {
  uploaded: "text-zinc-600 ring-zinc-300",
  processing: "text-amber-700 ring-amber-300",
  ready: "text-green-600 ring-green-400",
  failed: "text-red-600 ring-red-300",
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
        만료됨
      </span>
    );
  }
  if (days === 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
        오늘 만료
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
    <div className="animate-pulse rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 h-10 w-10 rounded-xl bg-zinc-100" />
      <div className="mb-2 h-3 w-20 rounded bg-zinc-100" />
      <div className="h-7 w-12 rounded bg-zinc-100" />
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

function StatCard({ label, value, accent = "text-zinc-800" }: StatCardProps) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold tabular-nums ${accent}`}>
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
        완료된 분석이 없습니다.
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
        <span className="flex items-center gap-1.5 text-zinc-500">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500" />
          높음 &mdash; {high} ({highPct}%)
        </span>
        <span className="flex items-center gap-1.5 text-zinc-500">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-400" />
          중간 &mdash; {medium} ({medPct}%)
        </span>
        <span className="flex items-center gap-1.5 text-zinc-500">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-green-400" />
          낮음 &mdash; {low} ({lowPct}%)
        </span>
      </div>
    </div>
  );
}

// ─── Expiry buckets widget ───────────────────────────────────────────────────

interface ExpiryBucketsWidgetProps {
  days30: number;
  days60: number;
  days90: number;
}

function ExpiryBucketsWidget({ days30, days60, days90 }: ExpiryBucketsWidgetProps) {
  // Only contracts expiring *between* buckets (exclusive increments).
  const between30and60 = days60 - days30;
  const between60and90 = days90 - days60;

  const buckets = [
    {
      label: "30일 이내",
      count: days30,
      barClass: "bg-red-500",
      textClass: "text-red-700",
      bgClass: "bg-red-50",
      ringClass: "ring-red-200",
    },
    {
      label: "31 – 60일",
      count: between30and60,
      barClass: "bg-amber-400",
      textClass: "text-amber-700",
      bgClass: "bg-amber-50",
      ringClass: "ring-amber-200",
    },
    {
      label: "61 – 90일",
      count: between60and90,
      barClass: "bg-yellow-300",
      textClass: "text-yellow-700",
      bgClass: "bg-yellow-50",
      ringClass: "ring-yellow-200",
    },
  ];

  const maxCount = Math.max(days30, between30and60, between60and90, 1);

  if (days90 === 0) {
    return (
      <p className="text-sm text-zinc-400">
        90일 이내 만료되는 계약서가 없습니다.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {buckets.map(({ label, count, barClass, textClass, bgClass, ringClass }) => (
        <div key={label} className="flex items-center gap-3">
          <span className="w-28 flex-shrink-0 text-xs text-zinc-500">{label}</span>
          <div className="flex flex-1 items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
              <div
                className={`h-full rounded-full transition-all ${barClass}`}
                style={{ width: `${Math.round((count / maxCount) * 100)}%` }}
              />
            </div>
            {count > 0 ? (
              <span
                className={`inline-flex min-w-[1.75rem] items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-medium ring-1 ${bgClass} ${textClass} ${ringClass}`}
              >
                {count}
              </span>
            ) : (
              <span className="min-w-[1.75rem] text-center text-xs text-zinc-300">0</span>
            )}
          </div>
        </div>
      ))}
      <p className="mt-1 text-xs text-zinc-400">
        90일 이내 만료 예정 총 {days90}건
      </p>
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
      setError(err instanceof Error ? err.message : "대시보드를 불러오지 못했습니다.");
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
    <div className="mx-auto w-full max-w-screen-xl px-6 py-8">
      {/* Error state */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}{" "}
          <button
            onClick={fetchStats}
            className="underline hover:no-underline"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* Contract status cards */}
      <section className="mb-8">
        <h2 className="mb-4 text-base font-bold text-zinc-800">계약서 현황</h2>
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="전체" value={stats?.totalContracts ?? 0} />
            <StatCard
              label="분석 완료"
              value={stats?.readyContracts ?? 0}
              accent="text-green-600"
            />
            <StatCard
              label="처리 중"
              value={stats?.processingContracts ?? 0}
              accent="text-amber-600"
            />
            <StatCard
              label="업로드됨"
              value={stats?.uploadedContracts ?? 0}
            />
            <StatCard
              label="실패"
              value={stats?.failedContracts ?? 0}
              accent="text-red-600"
            />
            <StatCard
              label="만료 임박 (30일)"
              value={stats?.expiryBuckets?.days30 ?? stats?.expiringSoon ?? 0}
              accent={
                (stats?.expiryBuckets?.days30 ?? stats?.expiringSoon ?? 0) > 0
                  ? "text-amber-600"
                  : "text-zinc-900"
              }
            />
          </div>
        )}
      </section>

      {/* Bottom three-column section */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Risk distribution */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-800">
              리스크 분포
            </h2>
            {!loading && stats && (
              <span className="text-xs text-zinc-400">
                최근 30일 분석 {stats.recentAnalyses}건
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
        <section className="rounded-2xl bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-800">
              최근 계약서
            </h2>
            <Link
              href="/contracts"
              className="text-xs font-medium text-blue-500 hover:text-blue-700"
            >
              전체 보기
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
              계약서가 없습니다.{" "}
              <Link href="/contracts" className="underline hover:no-underline">
                업로드하기
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
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${STATUS_COLOR[c.status as ContractStatus] ?? STATUS_COLOR.uploaded}`}
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
        <section className="rounded-2xl bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-800">
              만료 임박
            </h2>
            <span className="text-xs text-zinc-400">향후 30일</span>
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
              곧 만료되는 계약서가 없습니다.
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

      {/* Expiry timeline section — 30/60/90-day buckets */}
      <section className="mt-5 rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-800">
            만료 일정
          </h2>
          <Link
            href="/contracts?status=ready"
            className="text-xs font-medium text-blue-500 hover:text-blue-700"
          >
            계약서 관리
          </Link>
        </div>
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-3 w-28 rounded bg-zinc-100" />
                <div className="h-2 flex-1 rounded-full bg-zinc-100" />
                <div className="h-5 w-6 rounded-full bg-zinc-100" />
              </div>
            ))}
          </div>
        ) : stats?.expiryBuckets ? (
          <ExpiryBucketsWidget
            days30={stats.expiryBuckets.days30}
            days60={stats.expiryBuckets.days60}
            days90={stats.expiryBuckets.days90}
          />
        ) : (
          <p className="text-sm text-zinc-400">만료 데이터가 없습니다.</p>
        )}
      </section>
    </div>
  );
}
