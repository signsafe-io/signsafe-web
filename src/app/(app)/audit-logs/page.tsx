"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuthStore } from "@/lib/auth";
import { api } from "@/lib/api";
import type { AuditEvent } from "@/types";

const PAGE_SIZE = 30;
const CSV_BATCH_SIZE = 1000;

// Keys must match the exact action strings emitted by signsafe-api handlers.
const ACTION_COLOR: Record<string, string> = {
  CONTRACT_UPLOADED:   "bg-violet-50 text-violet-700 ring-violet-200",
  CONTRACT_DELETED:    "bg-red-50    text-red-700    ring-red-200",
  CONTRACT_UPDATED:    "bg-blue-50   text-blue-700   ring-blue-200",
  ANALYSIS_REQUESTED:  "bg-amber-50  text-amber-700  ring-amber-200",
  RISK_OVERRIDDEN:     "bg-orange-50 text-orange-700 ring-orange-200",
};

const ACTION_OPTIONS = Object.keys(ACTION_COLOR);

// ─── CSV helpers ───────────────────────────────────────────────────────────
function csvEscape(value: string | null | undefined): string {
  const s = value ?? "";
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function eventsToCSV(events: AuditEvent[]): string {
  const headers = ["시간", "행위자", "액션", "대상 유형", "대상 ID", "IP 주소", "컨텍스트"];
  const rows = events.map((e) => [
    new Date(e.createdAt).toISOString(),
    e.actorEmail ?? "",
    e.action,
    e.targetType ?? "",
    e.targetId ?? "",
    e.ipAddress ?? "",
    e.context ?? "",
  ]);
  return [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
}

function downloadCSV(content: string, filename: string) {
  const bom = "\uFEFF"; // UTF-8 BOM for Excel compatibility
  const blob = new Blob([bom + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Sub-components ────────────────────────────────────────────────────────
function ActionBadge({ action }: { action: string }) {
  const cls = ACTION_COLOR[action] ?? "bg-zinc-100 text-zinc-600 ring-zinc-200";
  const label = action
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 whitespace-nowrap ${cls}`}
    >
      {label}
    </span>
  );
}

function EventRow({ event }: { event: AuditEvent }) {
  const [expanded, setExpanded] = useState(false);
  const hasContext =
    event.context &&
    event.context !== "{}" &&
    event.context !== "" &&
    event.context !== "null";

  return (
    <li className="border-t border-zinc-100 first:border-t-0">
      <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-4 sm:px-5 sm:py-3.5">
        {/* Timestamp */}
        <span className="w-36 flex-shrink-0 text-xs text-zinc-400 tabular-nums">
          {new Date(event.createdAt).toLocaleString("ko-KR", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>

        {/* Actor */}
        <div className="hidden w-44 flex-shrink-0 min-w-0 sm:block">
          {event.actorEmail ? (
            <p className="truncate text-xs font-medium text-zinc-800">
              {event.actorEmail}
            </p>
          ) : (
            <span className="text-xs text-zinc-400">시스템</span>
          )}
        </div>

        {/* Action + details */}
        <div className="flex flex-1 flex-col gap-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ActionBadge action={event.action} />
            {event.actorEmail && (
              <span className="text-xs text-zinc-500 sm:hidden">{event.actorEmail}</span>
            )}
            {event.targetType && event.targetId && (
              <span className="text-xs text-zinc-400">
                {event.targetType}:{" "}
                <span className="font-mono text-zinc-500">
                  {event.targetId.length > 12
                    ? `${event.targetId.slice(0, 12)}\u2026`
                    : event.targetId}
                </span>
              </span>
            )}
          </div>
          {hasContext && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="cursor-pointer self-start text-xs text-zinc-400 transition-colors hover:text-zinc-600"
            >
              {expanded ? "상세 숨기기" : "상세 보기"}
            </button>
          )}
          {expanded && hasContext && (
            <pre className="mt-1 max-h-32 overflow-auto rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600 ring-1 ring-zinc-200 font-mono leading-relaxed whitespace-pre-wrap break-all">
              {event.context}
            </pre>
          )}
        </div>

        {/* IP address */}
        {event.ipAddress && (
          <span className="hidden lg:block flex-shrink-0 text-xs text-zinc-400 font-mono">
            {event.ipAddress}
          </span>
        )}
      </div>
    </li>
  );
}

function SkeletonRows() {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className={`flex items-center gap-4 px-5 py-3.5 ${i > 0 ? "border-t border-zinc-100" : ""}`}
        >
          <div className="h-3.5 w-28 animate-pulse rounded bg-zinc-100 flex-shrink-0" />
          <div className="h-3.5 w-36 animate-pulse rounded bg-zinc-100 flex-shrink-0 hidden sm:block" />
          <div className="h-5 w-24 animate-pulse rounded-full bg-zinc-100" />
        </div>
      ))}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function AuditLogsPage() {
  const user = useAuthStore((s) => s.user);
  const orgId = user?.organizationId ?? "";

  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadState, setLoadState] = useState<"loading" | "success" | "error">("loading");
  const [loadMoreState, setLoadMoreState] = useState<"idle" | "loading">("idle");
  const [exportState, setExportState] = useState<"idle" | "loading">("idle");

  // Filters
  const [actionFilter, setActionFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Ref to anchor scroll after load more
  const loadMoreAnchorRef = useRef<HTMLDivElement | null>(null);
  const prevEventCount = useRef(0);

  const hasActiveFilters = actionFilter !== "" || fromDate !== "" || toDate !== "";

  const fetchEvents = useCallback(async () => {
    if (!orgId) return;
    setLoadState("loading");
    setPage(1);
    try {
      const data = await api.listAuditEvents(orgId, {
        page: 1,
        pageSize: PAGE_SIZE,
        action: actionFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      setEvents(data.events ?? []);
      setTotal(data.total ?? 0);
      setLoadState("success");
    } catch {
      setLoadState("error");
    }
  }, [orgId, actionFilter, fromDate, toDate]);

  const loadMore = useCallback(async () => {
    if (!orgId || loadMoreState === "loading") return;
    const nextPage = page + 1;
    prevEventCount.current = events.length;
    setLoadMoreState("loading");
    try {
      const data = await api.listAuditEvents(orgId, {
        page: nextPage,
        pageSize: PAGE_SIZE,
        action: actionFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      setEvents((prev) => [...prev, ...(data.events ?? [])]);
      setPage(nextPage);
    } finally {
      setLoadMoreState("idle");
    }
  }, [orgId, page, loadMoreState, actionFilter, fromDate, toDate, events.length]);

  // CSV export: fetch all pages with current filters then trigger download
  const exportCSV = useCallback(async () => {
    if (!orgId || exportState === "loading") return;
    setExportState("loading");
    try {
      const allEvents: AuditEvent[] = [];
      let currentPage = 1;
      let fetched = 0;
      let totalCount = 0;

      do {
        const data = await api.listAuditEvents(orgId, {
          page: currentPage,
          pageSize: CSV_BATCH_SIZE,
          action: actionFilter || undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
        });
        const batch = data.events ?? [];
        allEvents.push(...batch);
        fetched += batch.length;
        totalCount = data.total ?? 0;
        currentPage++;
      } while (fetched < totalCount && fetched > 0);

      const csvContent = eventsToCSV(allEvents);
      const today = new Date().toISOString().slice(0, 10);
      downloadCSV(csvContent, `signsafe-audit-${today}.csv`);
    } finally {
      setExportState("idle");
    }
  }, [orgId, exportState, actionFilter, fromDate, toDate]);

  // Scroll to first newly loaded item after load more
  useEffect(() => {
    if (loadMoreState === "idle" && loadMoreAnchorRef.current && prevEventCount.current > 0 && events.length > prevEventCount.current) {
      loadMoreAnchorRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      prevEventCount.current = 0;
    }
  }, [events.length, loadMoreState]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  function clearFilters() {
    setActionFilter("");
    setFromDate("");
    setToDate("");
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10 space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">감사 로그</h1>
          {loadState === "success" && (
            <p className="mt-0.5 text-sm text-zinc-400">
              {total.toLocaleString()}건
              {hasActiveFilters && (
                <span className="ml-1 text-zinc-400">현재 필터 조건 기준</span>
              )}
            </p>
          )}
        </div>

        {/* Right side: filters + export */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
          {/* Action filter */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">액션</label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="cursor-pointer rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-colors hover:border-zinc-300"
            >
              <option value="">전체 액션</option>
              {ACTION_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {a.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          {/* Date range */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">시작일</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              max={toDate || undefined}
              className="cursor-pointer rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-colors hover:border-zinc-300"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">종료일</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              min={fromDate || undefined}
              className="cursor-pointer rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-colors hover:border-zinc-300"
            />
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="cursor-pointer self-end rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700 whitespace-nowrap"
            >
              필터 초기화
            </button>
          )}

          {/* Export CSV button */}
          <button
            onClick={exportCSV}
            disabled={exportState === "loading" || loadState !== "success" || total === 0}
            className="cursor-pointer self-end inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 hover:border-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {exportState === "loading" ? (
              <>
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-600" />
                내보내는 중&hellip;
              </>
            ) : (
              <>
                <svg
                  className="h-3.5 w-3.5 text-zinc-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                CSV 내보내기
              </>
            )}
          </button>
        </div>
      </div>

      {/* Loading skeleton */}
      {loadState === "loading" && <SkeletonRows />}

      {/* Error */}
      {loadState === "error" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-medium text-red-700">
            감사 이벤트를 불러오지 못했습니다.
          </p>
          <button
            onClick={fetchEvents}
            className="mt-2 cursor-pointer text-sm font-medium text-red-800 underline underline-offset-2 hover:no-underline"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* Empty state */}
      {loadState === "success" && events.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-white py-20 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100">
            <svg
              className="h-6 w-6 text-zinc-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-zinc-700">감사 이벤트가 없습니다</p>
          <p className="mt-1 text-sm text-zinc-400">
            {hasActiveFilters
              ? "현재 필터 조건에 맞는 이벤트가 없습니다."
              : "이 조직 내의 활동이 여기에 표시됩니다."}
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="cursor-pointer mt-4 text-sm font-medium text-zinc-700 underline underline-offset-2 hover:no-underline"
            >
              필터 초기화
            </button>
          )}
        </div>
      )}

      {/* Event list */}
      {loadState === "success" && events.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          {/* Column headers — desktop only */}
          <div className="hidden border-b border-zinc-100 sm:flex items-center gap-4 px-5 py-2.5">
            <span className="w-36 flex-shrink-0 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              시간
            </span>
            <span className="w-44 flex-shrink-0 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              행위자
            </span>
            <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              액션
            </span>
            <span className="hidden lg:block flex-shrink-0 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              IP
            </span>
          </div>

          <ul>
            {events.map((e, i) => (
              <div key={e.id} ref={i === prevEventCount.current ? loadMoreAnchorRef : undefined}>
                <EventRow event={e} />
              </div>
            ))}
          </ul>
        </div>
      )}

      {/* Progress indicator */}
      {loadState === "success" && events.length > 0 && (
        <p className="text-center text-xs text-zinc-400">
          {total.toLocaleString()}건 중 {events.length.toLocaleString()}건 표시 중
        </p>
      )}

      {/* Load more */}
      {loadState === "success" && events.length < total && (
        <div className="flex justify-center">
          <button
            onClick={loadMore}
            disabled={loadMoreState === "loading"}
            className="cursor-pointer rounded-lg border border-zinc-200 px-5 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadMoreState === "loading" ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-600" />
                로딩 중&hellip;
              </span>
            ) : (
              `더 보기 ${Math.min(PAGE_SIZE, total - events.length)}건 (${(total - events.length).toLocaleString()}건 남음)`
            )}
          </button>
        </div>
      )}
    </div>
  );
}
