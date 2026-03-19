# TODO-002: 테마 선택 UI

## 상태: 완료

## 구현 내용

- TitleBar.tsx에 테마 선택 드롭다운 서브메뉴 추가
  - DropdownMenuSub 컴포넌트 활용
  - Dark 그룹 (5개)과 Light 그룹 (5개)으로 분리 표시
  - 각 테마 항목에 accent 컬러 스와치 (원형 색상 표시) 렌더링
  - 현재 선택된 테마에 체크 표시 (CheckIcon) 표시
- 테마 변경 시 settingsStore 업데이트 및 즉시 반영
- 서브메뉴 스크롤 없이 전체 목록 표시

## 관련 파일

- `src/components/TitleBar.tsx`
- `src/lib/themes.ts`
