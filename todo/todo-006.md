# TODO-006: 탭바 & App Shell 리디자인

## 상태: 완료

## 구현 내용

- 탭바에 각 탭별 아이콘 추가 (Lucide 아이콘 활용)
  - Dashboard: LayoutDashboard, DB 정의서: Database, PlantUML: FileImage 등
- 탭 트리거에 아이콘 + 라벨 조합 렌더링
- 하단 상태바 개선:
  - 현재 적용된 테마의 accent 색상 dot 표시
  - 테마 이름 텍스트 표시
- App.tsx의 Radix Tabs 레이아웃에 아이콘 매핑 통합

## 관련 파일

- `src/App.tsx`
- `src/components/TitleBar.tsx`
