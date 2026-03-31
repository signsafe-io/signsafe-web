"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/lib/auth";
import { api } from "@/lib/api";
import type { AuditEvent } from "@/types";

const PAGE_SIZE = 30;

const ACTION_COLOR: Record<string, string> = {
  LOGIN: "bg-blue-50 text-blue-700 ring-blue-200",
  LOGOUT: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  SIGNUP: "bg-green-50 text-green-700 ring-green-200",
  UPLOAD_CONTRACT: "bg-violet-50 text-violet-700 ring-violet-200",
  DELETE_CONTRACT: "bg-red-50 text-red-700 ring-red-200",
  CREATE_ANALYSIS: "bg-amber-50 text-amber-700 ring-amber-200",
  OVERRIDE_RISK: "bg-orange-50 text-orange-700 ring-orange-200",
  VIEW_EVIDENCE: "bg-sky-50 text-sky-700 ring-sky-200",
};

const ACTION_OPTIONS = Object.keys(ACTION_COLOR);

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
          {new Date(event.createdAt).toLocaleString("en-US", {
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
            <span className="text-xs text-zinc-400">System</span>
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
                    ? `${event.targetId.slice(0, 12)}…`
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
              {expanded ? "Hide details" : "Show details"}
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

export default function AuditLogsPage() {
  const user = useAuthStore((s) => s.user);
  const orgId = user?.organizationId ?? "";

  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadState, setLoadState] = useState<"loading" | "success" | "error">("loading");
  const [loadMoreState, setLoadMoreState] = useState<"idle" | "loading">("idle");
  const [actionFilter, setActionFilter] = useState("");

  const fetchEvents = useCallback(async () => {
    if (!orgId) return;
    setLoadState("loading");
    setPage(1);
    try {
      const data = await api.listAuditEvents(
        orgId,
        1,
        PAGE_SIZE,
        actionFilter || undefined
      );
      setEvents(data.events ?? []);
      setTotal(data.total ?? 0);
      setLoadState("success");
    } catch {
      setLoadState("error");
    }
  }, [orgId, actionFilter]);

  const loadMore = useCallback(async () => {
    if (!orgId || loadMoreState === "loading") return;
    const nextPage = page + 1;
    setLoadMoreState("loading");
    try {
      const data = await api.listAuditEvents(
        orgId,
        nextPage,
        PAGE_SIZE,
        actionFilter || undefined
      );
      setEvents((prev) => [...prev, ...(data.events ?? [])]);
      setPage(nextPage);
    } finally {
      setLoadMoreState("idle");
    }
  }, [orgId, page, loadMoreState, actionFilter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10 space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Audit Log</h1>
          {loadState === "success" && (
            <p className="mt-0.5 text-sm text-zinc-400">
              {total.toLocaleString()} event{total !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="action-filter"
            className="text-xs text-zinc-500 whitespace-nowrap"
          >
            Filter by action
          </label>
          <select
            id="action-filter"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="cursor-pointer rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-colors hover:border-zinc-300"
          >
            <option value="">All actions</option>
            {ACTION_OPTIONS.map((a) => (
              <option key={a} value={a}>
                {a.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading skeleton */}
      {loadState === "loading" && <SkeletonRows />}

      {/* Error */}
      {loadState === "error" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-medium text-red-700">
            Failed to load audit events.
          </p>
          <button
            onClick={fetchEvents}
            className="mt-2 cursor-pointer text-sm font-medium text-red-800 underline underline-offset-2 hover:no-underline"
          >
            Try again
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
          <p className="text-sm font-medium text-zinc-700">No audit events yet</p>
          <p className="mt-1 text-sm text-zinc-400">
            {actionFilter
              ? "No events match the selected filter."
              : "Actions within this organization will appear here."}
          </p>
        </div>
      )}

      {/* Event list */}
      {loadState === "success" && events.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          {/* Column headers — desktop only */}
          <div className="hidden border-b border-zinc-100 sm:flex items-center gap-4 px-5 py-2.5">
            <span className="w-36 flex-shrink-0 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Time
            </span>
            <span className="w-44 flex-shrink-0 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Actor
            </span>
            <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Action
            </span>
            <span className="hidden lg:block flex-shrink-0 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              IP
            </span>
          </div>

          <ul>
            {events.map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
          </ul>
        </div>
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
                Loading…
              </span>
            ) : (
              `Load more (${total - events.length} remaining)`
            )}
          </button>
        </div>
      )}
    </div>
  );
}
