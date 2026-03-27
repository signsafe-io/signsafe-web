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

## 라이브러리 선택 요약

| 용도 | 라이브러리 |
|------|-----------|
| 전역 상태 | zustand ^5 |
| PDF 렌더링 | react-pdf ^10 |
| 애니메이션 | framer-motion ^12 |
| 서버 상태 (설치됨, 미사용) | @tanstack/react-query ^5 |
| UI 스타일 | Tailwind CSS v4 |

*최종 업데이트: 2026-03-27*
