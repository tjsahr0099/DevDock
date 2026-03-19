# TODO-008: Dashboard 리디자인

## 상태: 완료

## 구현 내용

- 상단 StatCard 통계 스트립: 서버 수, 온라인, 경고, 컨테이너 수 등 표시
- 서버 카드를 Card 컴포넌트 기반으로 리팩토링
  - 상태별 좌측 보더 색상 (online=green, offline=red, warning=yellow)
  - GaugeBar(sm) 사이즈로 CPU/MEM 사용률 표시
- 이벤트 로그 섹션 개선:
  - 각 로그 항목에 타입별 아이콘 표시
  - 교대 배경색 (striped rows) 적용
- 데이터 없을 때 EmptyState 컴포넌트 표시
- 로딩 중 Skeleton 컴포넌트 표시

## 관련 파일

- `src/pages/Dashboard.tsx`
