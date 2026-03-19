# TODO-014: ServerMonitor 리디자인

## 상태: 완료

## 구현 내용

- 호스트 정보 헤더 카드: 호스트명, IP, OS, 가동시간 표시
- 시스템 리소스 카드 그리드:
  - CPU 사용률 카드 (GaugeBar + 코어별 상세)
  - 메모리 사용률 카드 (GaugeBar + 사용/전체 표시)
  - 디스크 사용률 카드 (GaugeBar + 파티션별 상세)
- Docker 컨테이너 섹션 개선:
  - 검색 필터 입력 필드 추가
  - 교대행 배경색 (striped rows)
  - 로그 뷰어에 검색 기능 추가
- 데이터 로딩 중 Skeleton 컴포넌트 표시

## 관련 파일

- `src/pages/ServerMonitor.tsx`
