import type {
  LoginResponse,
  SignupResponse,
  User,
  Contract,
  ContractListResponse,
  UploadContractResponse,
  IngestionJob,
  Clause,
  ClauseListResponse,
  SnippetsResponse,
  RiskAnalysisResponse,
  CreateAnalysisResponse,
  EvidenceSet,
  RetrieveEvidenceResponse,
  RiskOverride,
  AuditEvent,
} from "@/types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

// ─────────────────────────────────────────────
// Token management (in-memory, accessed lazily)
// ─────────────────────────────────────────────

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  // Lazy import to avoid circular dependency at module initialisation.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useAuthStore } = require("@/lib/auth");
  return useAuthStore.getState().accessToken as string | null;
}

function setAccessToken(token: string): void {
  if (typeof window === "undefined") return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useAuthStore } = require("@/lib/auth");
  useAuthStore.getState().setAccessToken(token);
}

function clearAuth(): void {
  if (typeof window === "undefined") return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useAuthStore } = require("@/lib/auth");
  useAuthStore.getState().clearAuth();
}

function redirectToLogin(): void {
  if (typeof window !== "undefined") {
    window.location.replace("/login");
  }
}

// ─────────────────────────────────────────────
// Refresh token logic (concurrent-safe via promise reuse)
// ─────────────────────────────────────────────

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) return false;
      const data = (await res.json()) as LoginResponse;
      setAccessToken(data.accessToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ─────────────────────────────────────────────
// Core request function
// ─────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {},
  isRetry = false
): Promise<T> {
  const token = getAccessToken();

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Only set Content-Type for JSON bodies; multipart/form-data sets its own boundary.
  if (
    !(options.body instanceof FormData) &&
    !headers["Content-Type"]
  ) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (res.status === 401 && !isRetry) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      clearAuth();
      redirectToLogin();
      // Return a never-resolving promise so callers don't see partial data.
      return new Promise(() => {});
    }
    return request<T>(path, options, true);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body}`);
  }

  if (res.status === 204) return undefined as unknown as T;

  return res.json() as Promise<T>;
}

// ─────────────────────────────────────────────
// Auth endpoints
// ─────────────────────────────────────────────

async function login(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

async function signup(
  email: string,
  password: string,
  fullName: string
): Promise<SignupResponse> {
  return request<SignupResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, fullName }),
  });
}

async function verifyEmail(token: string): Promise<{ message: string }> {
  return request<{ message: string }>("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

async function logout(): Promise<{ message: string }> {
  return request<{ message: string }>("/auth/logout", { method: "POST" });
}

async function forgotPassword(
  email: string
): Promise<{ message: string }> {
  return request<{ message: string }>("/auth/password/forgot", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

async function resetPassword(
  token: string,
  newPassword: string
): Promise<{ message: string }> {
  return request<{ message: string }>("/auth/password/reset", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  });
}

async function getMe(): Promise<User> {
  return request<User>("/users/me");
}

// ─────────────────────────────────────────────
// Contract endpoints
// ─────────────────────────────────────────────

async function listContracts(
  organizationId: string,
  page = 1,
  pageSize = 20
): Promise<ContractListResponse> {
  return request<ContractListResponse>(
    `/contracts?organizationId=${organizationId}&page=${page}&pageSize=${pageSize}`
  );
}

async function getContract(contractId: string): Promise<Contract> {
  return request<Contract>(`/contracts/${contractId}`);
}

async function uploadContract(
  formData: FormData
): Promise<UploadContractResponse> {
  return request<UploadContractResponse>("/contracts", {
    method: "POST",
    body: formData,
  });
}

async function getIngestionJob(jobId: string): Promise<IngestionJob> {
  return request<IngestionJob>(`/ingestion-jobs/${jobId}`);
}

async function listClauses(contractId: string): Promise<ClauseListResponse> {
  return request<ClauseListResponse>(`/contracts/${contractId}/clauses`);
}

async function getSnippets(
  contractId: string,
  page: number,
  startOffset: number,
  endOffset: number
): Promise<SnippetsResponse> {
  return request<SnippetsResponse>(
    `/contracts/${contractId}/snippets?page=${page}&startOffset=${startOffset}&endOffset=${endOffset}`
  );
}

// ─────────────────────────────────────────────
// Analysis endpoints
// ─────────────────────────────────────────────

async function createAnalysis(
  contractId: string
): Promise<CreateAnalysisResponse> {
  return request<CreateAnalysisResponse>(
    `/contracts/${contractId}/risk-analyses`,
    { method: "POST", body: JSON.stringify({}) }
  );
}

async function getAnalysis(analysisId: string): Promise<RiskAnalysisResponse> {
  return request<RiskAnalysisResponse>(`/risk-analyses/${analysisId}`);
}

async function getLatestAnalysis(
  contractId: string
): Promise<RiskAnalysisResponse> {
  return request<RiskAnalysisResponse>(
    `/contracts/${contractId}/risk-analyses`
  );
}

async function createOverride(
  analysisId: string,
  clauseResultId: string,
  newRiskLevel: string,
  reason: string
): Promise<RiskOverride> {
  return request<RiskOverride>(
    `/risk-analyses/${analysisId}/overrides`,
    {
      method: "POST",
      body: JSON.stringify({ clauseResultId, newRiskLevel, reason }),
    }
  );
}

// ─────────────────────────────────────────────
// Evidence endpoints
// ─────────────────────────────────────────────

async function getEvidenceSet(evidenceSetId: string): Promise<EvidenceSet> {
  return request<EvidenceSet>(`/evidence-sets/${evidenceSetId}`);
}

async function retrieveEvidence(
  evidenceSetId: string,
  topK = 5,
  filterParams = ""
): Promise<RetrieveEvidenceResponse> {
  return request<RetrieveEvidenceResponse>(
    `/evidence-sets/${evidenceSetId}/retrieve`,
    {
      method: "POST",
      body: JSON.stringify({ topK, filterParams }),
    }
  );
}

// ─────────────────────────────────────────────
// Audit endpoints
// ─────────────────────────────────────────────

async function createAuditEvent(
  action: string,
  targetType?: string,
  targetId?: string,
  organizationId?: string,
  context = ""
): Promise<AuditEvent> {
  return request<AuditEvent>("/audit-events", {
    method: "POST",
    body: JSON.stringify({
      action,
      targetType,
      targetId,
      organizationId,
      context,
    }),
  });
}

// ─────────────────────────────────────────────
// Exported API surface
// ─────────────────────────────────────────────

export const api = {
  // Auth
  login,
  signup,
  verifyEmail,
  logout,
  forgotPassword,
  resetPassword,
  getMe,

  // Contracts
  listContracts,
  getContract,
  uploadContract,
  getIngestionJob,
  listClauses,
  getSnippets,

  // Analysis
  createAnalysis,
  getAnalysis,
  getLatestAnalysis,
  createOverride,

  // Evidence
  getEvidenceSet,
  retrieveEvidence,

  // Audit
  createAuditEvent,
};

// Also expose the raw request helper for edge cases.
export { request };

// Re-export Clause type parsed from ClauseResult for convenience.
export type { Clause };
