// ─────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  emailVerified: boolean;
  mfaEnabled: boolean;
  createdAt: string;
  permissions: string[];
  organizationId: string;
  organizationName?: string;
  organizationRole?: string;
}

export interface LoginResponse {
  accessToken: string;
  expiresAt: string;
}

export interface SignupResponse {
  userId: string;
  organizationId: string;
  message: string;
}

// ─────────────────────────────────────────────
// Organization
// ─────────────────────────────────────────────

/** Summary of an organization returned by GET /users/me/organizations */
export interface OrganizationSummary {
  id: string;
  name: string;
  plan: string;
  role: string;
}

export interface Organization {
  id: string;
  name: string;
  plan: string;
  features: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemberInfo {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  joinedAt: string;
  emailVerified: boolean;
}

export interface MembersResponse {
  members: MemberInfo[];
  total: number;
}

// ─────────────────────────────────────────────
// Contract
// ─────────────────────────────────────────────
export type ContractStatus =
  | "uploaded"
  | "processing"
  | "ready"
  | "failed";

export interface Contract {
  id: string;
  organizationId: string;
  uploadedBy: string;
  title: string;
  status: ContractStatus;
  filePath: string;
  fileName: string;
  fileSize: number;
  fileMimeType: string;
  parties: string;
  tags: string;
  language: string;
  contractType: string | null;
  signedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContractListResponse {
  contracts: Contract[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UploadContractResponse {
  contractId: string;
  jobId: string;
}

export interface UpdateContractRequest {
  title?: string;
  tags?: string;
  parties?: string;
  language?: string;
  contractType?: string;
  signedAt?: string;
  expiresAt?: string;
}

export interface ExpiringContractsResponse {
  contracts: Contract[];
  total: number;
  days: number;
}

// ─────────────────────────────────────────────
// Ingestion Job
// ─────────────────────────────────────────────
export type IngestionJobStatus =
  | "pending"
  | "parsing"
  | "chunking"
  | "indexing"
  | "completed"
  | "failed";

export interface IngestionJob {
  id: string;
  contractId: string;
  status: IngestionJobStatus;
  progress: number;
  currentStep: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────
// Clause
// ─────────────────────────────────────────────
export interface Clause {
  id: string;
  contractId: string;
  clauseIndex: number;
  label: string | null;
  content: string;
  pageStart: number;
  pageEnd: number;
  anchorX: number | null;
  anchorY: number | null;
  anchorWidth: number | null;
  anchorHeight: number | null;
  startOffset: number;
  endOffset: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClauseListResponse {
  clauses: Clause[];
  total: number;
}

export interface SnippetsResponse {
  snippets: Clause[];
}

// ─────────────────────────────────────────────
// Risk Analysis
// ─────────────────────────────────────────────
export type RiskLevel = "HIGH" | "MEDIUM" | "LOW" | "none";
export type AnalysisStatus = "pending" | "running" | "completed" | "failed";

export interface RiskAnalysis {
  id: string;
  contractId: string;
  requestedBy: string;
  status: AnalysisStatus;
  modelVersion: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClauseResult {
  id: string;
  analysisId: string;
  clauseId: string;
  riskLevel: RiskLevel;
  issueType: string | null;
  summary: string | null;
  highlightX: number | null;
  highlightY: number | null;
  highlightWidth: number | null;
  highlightHeight: number | null;
  pageNumber: number | null;
  overriddenRiskLevel: string | null;
  overrideReason: string | null;
  overriddenBy: string | null;
  overriddenAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Populated by GET /risk-analyses/:id via LEFT JOIN on evidence_sets. */
  evidenceSetId: string | null;
}

export interface RiskAnalysisResponse {
  analysis: RiskAnalysis;
  clauseResults: ClauseResult[];
}

export interface CreateAnalysisResponse {
  analysisId: string;
  status: string;
}

// ─────────────────────────────────────────────
// Evidence Set
// ─────────────────────────────────────────────
export interface Citation {
  id: string;
  type: "case" | "policy" | "guideline" | "clause";
  title: string;
  snippet: string;
  whyRelevant: string;
  source?: string;
  score?: number;
}

export interface EvidenceSet {
  id: string;
  clauseResultId: string;
  rationale: string;
  citations: string; // JSON string of Citation[]
  recommendedActions: string; // JSON string of string[]
  topK: number;
  filterParams: string;
  retrievedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface RetrieveEvidenceResponse {
  evidenceSetId: string;
  status: string;
}

// ─────────────────────────────────────────────
// Risk Override
// ─────────────────────────────────────────────
export interface RiskOverride {
  id: string;
  clauseResultId: string;
  originalRiskLevel: string;
  newRiskLevel: string;
  reason: string;
  decidedBy: string;
  createdAt: string;
}

// ─────────────────────────────────────────────
// Audit
// ─────────────────────────────────────────────
export interface AuditEvent {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  organizationId: string | null;
  context: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

// ─────────────────────────────────────────────
// Common
// ─────────────────────────────────────────────
export interface ApiError {
  error: string;
}

// ─────────────────────────────────────────────
// Dashboard Stats
// ─────────────────────────────────────────────
export interface RiskDistribution {
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

export interface DashboardRecentContract {
  id: string;
  title: string;
  status: ContractStatus;
  createdAt: string;
}

export interface DashboardStats {
  totalContracts: number;
  uploadedContracts: number;
  processingContracts: number;
  readyContracts: number;
  failedContracts: number;
  recentAnalyses: number;
  expiringSoon: number;
  riskDistribution: RiskDistribution;
  recentContracts: DashboardRecentContract[];
}
