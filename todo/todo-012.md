# TODO-012: CallFlow 리디자인

## 상태: 완료

## 구현 내용

- 좌측 트리 패널 개선:
  - 검색 입력 필드 추가 (클래스/메서드 이름 필터링)
  - 필터 결과 실시간 반영
- 메서드 항목에 Badge 컴포넌트로 아이콘 표시
  - public/private/protected 접근 제어자별 색상 구분
- 다이어그램 뷰어 배경에 checkerboard 패턴 적용
  - bg-checkerboard 클래스 활용
- 분석 대상 미선택 시 EmptyState 가이드 표시
  - 사용 방법 안내 텍스트 포함

## 관련 파일

- `src/pages/CallFlow.tsx`
