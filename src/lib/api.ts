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
  UpdateContractRequest,
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

  // Auth endpoints manage their own credentials — never intercept their 401s.
  const isAuthEndpoint = path.startsWith("/auth/");
  if (res.status === 401 && !isRetry && !isAuthEndpoint) {
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
    const text = await res.text().catch(() => "");
    let message = `API error ${res.status}`;
    if (text) {
      try {
        const json = JSON.parse(text) as { error?: string };
        message = json.error ?? text;
      } catch {
        message = text;
      }
    }
    throw new Error(message);
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

async function resendVerification(
  email: string
): Promise<{ message: string }> {
  return request<{ message: string }>("/auth/resend-verification", {
    method: "POST",
    body: JSON.stringify({ email }),
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

/**
 * Upload a contract and report upload progress via onProgress callback.
 * Uses XMLHttpRequest so that the upload.onprogress event fires.
 * Handles 401 → token refresh → retry automatically.
 */
async function uploadContractWithProgress(
  formData: FormData,
  onProgress: (percent: number) => void
): Promise<UploadContractResponse> {
  function xhrUpload(token: string | null): Promise<UploadContractResponse> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_URL}/contracts`);
      xhr.withCredentials = true;
      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      }

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200 || xhr.status === 201) {
          try {
            resolve(JSON.parse(xhr.responseText) as UploadContractResponse);
          } catch {
            reject(new Error("Failed to parse upload response"));
          }
        } else {
          let message = `API error ${xhr.status}`;
          try {
            const json = JSON.parse(xhr.responseText) as { error?: string };
            message = json.error ?? message;
          } catch {
            /* ignore */
          }
          reject(Object.assign(new Error(message), { status: xhr.status }));
        }
      };

      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.send(formData);
    });
  }

  try {
    return await xhrUpload(getAccessToken());
  } catch (err: unknown) {
    // Retry once after refreshing the token on 401.
    const status = (err as { status?: number }).status;
    if (status === 401) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        clearAuth();
        redirectToLogin();
        return new Promise(() => {});
      }
      return xhrUpload(getAccessToken());
    }
    throw err;
  }
}

async function deleteContract(contractId: string): Promise<void> {
  return request<void>(`/contracts/${contractId}`, { method: "DELETE" });
}

async function updateContract(
  contractId: string,
  data: UpdateContractRequest
): Promise<Contract> {
  return request<Contract>(`/contracts/${contractId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
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
  resendVerification,
  logout,
  forgotPassword,
  resetPassword,
  getMe,

  // Contracts
  listContracts,
  getContract,
  uploadContract,
  uploadContractWithProgress,
  deleteContract,
  updateContract,
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
