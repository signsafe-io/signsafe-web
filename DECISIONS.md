# Architecture Decision Records — signsafe-web

## ADR-001: 상태 관리 라이브러리

**결정:** Zustand (메모리 전용 스토어, `persist` 미들웨어 없음)

**이유:**
- Access Token은 메모리에만 보관해야 하므로 `persist` 사용 불가
- Zustand의 `getState()` 패턴이 api.ts에서 토큰 접근 시 lazy import를 가능하게 함

---

## ADR-002: API 클라이언트 구조

**결정:** 커스텀 fetch 래퍼 (`src/lib/api.ts`), React Query 사용 안 함

**이유:**
- 401 자동 refresh 로직이 커스텀 구현을 요구함
- Concurrent refresh 방지를 위해 Promise 재사용 패턴 사용
- React Query는 폴링(ingestion, analysis)에 적합하지만 interceptor 패턴과 충돌할 수 있어 간단한 커스텀 훅 방식 채택

**Refresh Token 위치:** httpOnly Cookie (API 서버가 `Set-Cookie` 처리, SameSite=Strict)

---

## ADR-003: PDF 렌더링

**결정:** `react-pdf` (pdfjs-dist 기반)

**이유:**
- ARCHITECTURE.md 권고 사항
- Page별 렌더링을 지원하여 위험도 오버레이 좌표 계산에 용이

**Worker 설정:** `pdfjs.GlobalWorkerOptions.workerSrc` = `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`

**주의:** DocumentViewer는 `dynamic()` + `{ ssr: false }`로 가져와야 SSR 오류 방지

---

## ADR-004: 위험도 오버레이 좌표 체계

**결정:** API의 `highlightX/Y/Width/Height`는 0~1 범위의 상대 좌표 (페이지 비율)

**이유:**
- react-pdf가 `width` prop에 따라 다른 크기로 렌더링할 수 있음
- 절대 좌표로 저장하면 렌더링 크기에 따라 오프셋 계산이 어려움

**구현:** `RiskOverlay.tsx`에서 `x = relX * pageWidth` 로 변환

---

## ADR-005: 근거 패널 슬라이드인 애니메이션

**결정:** `framer-motion` AnimatePresence + slide from right

**이유:**
- ARCHITECTURE.md에서 framer-motion을 권고
- `x: "100%" → 0` 트랜지션으로 직관적인 슬라이드인 효과

---

## ADR-006: EvidenceSet 접근 방식

**결정:** `evidenceSetId`는 ClauseResult에 확장 필드로 전달됨

**현황:**
- `signsafe-api`의 `ClauseResult` 모델에는 `evidenceSetId`가 없음
- API가 `GET /risk-analyses/:id` 응답에 evidenceSetId를 포함할 경우 동작
- 없을 경우 EvidencePanel은 "근거 데이터 없음" 상태를 표시

**향후 개선:** API에 `evidenceSetId` 필드 추가 요청 (api-builder에 전달)

---

## ADR-007: 계약 목록에서 organizationId

**현황:**
- `GET /contracts`는 `organizationId` 쿼리 파라미터 필수
- 현재는 `user.id`를 임시 orgId로 사용
- 다중 조직 지원 시 조직 선택 UI 추가 필요

---

## ADR-008: 계약 파일 URL

**현황:**
- API의 `Contract.filePath`는 스토리지 내부 경로
- 브라우저에서 직접 접근 불가
- `GET /contracts/:id/file` 엔드포인트가 API 서버에 구현되어야 PDF 뷰어 동작
- 미구현 시 DocumentViewer는 "Document preview not available" 상태 표시

---

## ADR-009: 조직 전환 UI

**결정:** 헤더 조직명 뱃지를 `OrgSwitcher` 드롭다운 컴포넌트로 교체

**구현 위치:** `src/components/ui/OrgSwitcher.tsx`

**상태 관리:**
- `useAuthStore`에 `switchOrganization(id, name)` 액션 추가
- 드롭다운 열 때마다 `GET /users/me/organizations` 호출 (매번 최신 목록 보장)
- 조직 선택 시 store의 `user.organizationId`, `user.organizationName`만 업데이트 → 이후 API 호출(계약 목록 등)에 자동 반영

**새 조직 생성 모달:**
- 같은 파일 내 `NewOrgModal` 컴포넌트 (코드 응집도 유지)
- 생성 성공 후 새 조직으로 즉시 전환 + Toast "Organization created"

**API 추가:**
- `listMyOrganizations()` → `GET /users/me/organizations`
- `createOrganization(name)` → `POST /organizations`
- 응답 타입: `OrganizationSummary { id, name, plan, role }`

---

## 라이브러리 선택 요약

| 용도 | 라이브러리 |
|------|-----------|
| 전역 상태 | zustand ^5 |
| PDF 렌더링 | react-pdf ^10 |
| 애니메이션 | framer-motion ^12 |
| 서버 상태 (설치됨, 미사용) | @tanstack/react-query ^5 |
| UI 스타일 | Tailwind CSS v4 |

*최종 업데이트: 2026-03-27*

---

## ADR-012: 조항 리스크 필터 — ClauseNav 내부 상태 관리

**날짜**: 2026-04-01

**결정**: 리스크 필터 상태(`activeFilters: Set<RiskLevel>`)를 ClauseNav 컴포넌트 내부 state로 관리한다.

**이유**:
- 필터는 ClauseNav 뷰 전용 UI 상태이므로 상위 컴포넌트(ContractViewerPage)에 올릴 필요 없음
- 여러 뷰어 인스턴스(데스크톱 사이드바 + 모바일 드로어)가 독립적인 필터 상태를 가져도 무관
- 분석 미완료 시 필터 UI를 숨기는 로직도 ClauseNav 내부에서 처리 가능

**설계**:
- 빈 Set = 전체 표시 (기본값)
- 필터 적용 시: analyzed 조항은 필터 매칭만, unanalyzed(none) 조항은 항상 표시
- ClauseNav 외부 인터페이스(props)는 변경 없음

**영향**: 없음 (ContractViewerPage 변경 불필요)

---

## ADR-013: 대시보드 만료 구간 통계 — expiryBuckets 필드 추가

**날짜**: 2026-04-01

**결정**: DashboardStats 응답에 `expiryBuckets: { days30, days60, days90 }` 필드를 추가한다. 기존 `expiringSoon` 필드는 하위 호환성을 위해 유지하되 deprecated 처리.

**이유**:
- 30일 단일 버킷만으로는 계약 만료 우선순위를 판단하기 어려움
- 30/60/90일 구간으로 나누면 중장기 갱신 계획 수립 가능
- API는 단일 쿼리에 3개 COUNT FILTER를 추가하여 N+1 없이 처리

**대시보드 UI 설계**:
- 가로 막대 그래프로 3개 구간 시각화 (Within 30 / 31-60 / 61-90)
- 각 막대 너비: 최대값 대비 상대 비율
- 0인 구간도 표시 (상태 명확성)
