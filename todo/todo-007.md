# TODO-007: Home 리디자인

## 상태: 완료

## 구현 내용

- 각 도구 카드에 accent color 좌측 보더 적용
  - 테마의 accent 색상을 borderLeft 스타일로 사용
- 아이콘 배경에 accent 색상 반투명 처리
  - 아이콘 컨테이너에 accent 기반 배경색 적용
- stagger 애니메이션으로 카드 순차 진입 효과
  - stagger-enter 클래스 활용
  - 각 카드가 순서대로 슬라이드+페이드 인
- 전체적으로 깔끔한 카드 그리드 레이아웃 유지

## 관련 파일

- `src/pages/Home.tsx`
