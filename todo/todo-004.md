# TODO-004: 공용 컴포넌트 생성

## 상태: 완료

## 구현 내용

- `SectionHeader` - 섹션 제목 + 부제목 + 우측 액션 슬롯 조합 컴포넌트
- `EmptyState` - 아이콘 + 메시지 + 선택적 액션 버튼, 빈 데이터 상태 표시
- `StatCard` - 아이콘 + 라벨 + 값 + 선택적 추세 표시, 통계 스트립용
- `GaugeBar` - 퍼센트 기반 프로그레스 바, sm/md/lg 사이즈, 색상 자동 변환
- `StatusDot` - 서버 상태 표시용 컬러 도트 (online/offline/warning 등)

각 컴포넌트는 테마 CSS 변수와 연동되며 재사용 가능하도록 설계.

## 관련 파일

- `src/components/common/SectionHeader.tsx`
- `src/components/common/EmptyState.tsx`
- `src/components/common/StatCard.tsx`
- `src/components/common/GaugeBar.tsx`
- `src/components/common/StatusDot.tsx`
