# TODO-010: PumlViewer 리디자인

## 상태: 완료

## 구현 내용

- 파일 탐색 영역에 breadcrumb 네비게이션 추가
  - 현재 경로를 세그먼트별로 클릭 가능하게 표시
- SVG 뷰어 개선:
  - fit-to-width 버튼 추가 (컨테이너 너비에 맞춤)
  - 줌 인/아웃 컨트롤 유지
- 다이어그램 배경에 checkerboard 패턴 적용
  - bg-checkerboard 클래스 활용, 투명 영역 시각화
- 파일 미선택 시 EmptyState 표시
- 렌더링 대기 중 Skeleton 표시

## 관련 파일

- `src/pages/PumlViewer.tsx`
