# TODO-019: 2단계 그룹 탭 구조로 변경

> 생성일: 2026-02-27
> 상태: 진행중

## 요청 요약
현재 1단계 flat 탭 구조를 2단계(그룹 - 하위 탭) 구조로 변경한다. 예: "문서 도구" 그룹 아래 DB 정의서/PUML 뷰어/마크다운 뷰어, "개발 도구" 그룹 아래 호출 흐름/JSON Tool, "서버" 그룹 아래 서버 관리/서버 모니터링/대시보드. 1단계 탭바에서 그룹을 선택하면 2단계 탭바에 하위 탭이 표시되는 형태.

## 체크리스트
- [ ] `settingsStore.ts`에 그룹 타입 정의 추가 (TabGroup: { id, label, order, visible, tabs: TabConfig[] }) 및 기존 TabConfig에 groupId 필드 추가
- [ ] `data/tab-settings.json` 스키마를 그룹 정보 포함 형태로 설계하고, 기존 flat 구조에서 새 그룹 구조로의 마이그레이션 로직 구현
- [ ] `App.tsx`의 Radix Tabs를 2단계 구조로 변경 (1단계: 그룹 탭바, 2단계: 선택된 그룹의 하위 탭바)
- [ ] 그룹 내 하위 탭이 1개뿐인 경우 2단계 탭바 없이 바로 콘텐츠 표시 처리
- [ ] 단독 탭(홈) 지원 - 그룹 없이 단독으로 존재하는 탭은 클릭 시 바로 콘텐츠 표시
- [ ] `TabSettings.tsx` 그룹 단위 탭 설정 UI 변경 (그룹별 표시/숨김, 그룹 내 탭 순서 변경, 그룹 순서 변경)
- [ ] 기존 tab-settings.json 하위 호환성 보장 (이전 flat 형식 감지 시 자동 마이그레이션)

## 참고
- 관련 파일: `src/stores/settingsStore.ts`, `src/App.tsx`, `src/components/TabSettings.tsx`, `data/tab-settings.json`
- 우선순위: 높음
