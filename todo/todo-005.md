# TODO-005: CSS 애니메이션 & 유틸리티

## 상태: 완료

## 구현 내용

- `@keyframes` 정의 추가:
  - `slideInUp` - 아래에서 위로 슬라이드 진입
  - `slideInLeft` - 왼쪽에서 오른쪽으로 슬라이드 진입
  - `fadeIn` - 페이드 인 효과
  - `pulseSubtle` - 미세한 펄스 애니메이션 (로딩/강조용)
- 유틸리티 클래스:
  - `stagger-enter` - 자식 요소에 순차적 진입 딜레이 적용
  - `bg-checkerboard` - 투명 배경 표시용 체커보드 패턴
- 글로벌 CSS에 등록하여 전체 앱에서 사용 가능

## 관련 파일

- `src/index.css` 또는 `src/styles/animations.css`
