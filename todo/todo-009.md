# TODO-009: DbDoc 리디자인

## 상태: 완료

## 구현 내용

- 전체 섹션을 Card 컴포넌트로 래핑
  - 연결 설정, 테이블 목록, 컬럼 상세 등 각 영역 Card 처리
- SectionHeader 컴포넌트로 각 섹션 제목 통일
- Alert 컴포넌트 활용:
  - DB 연결 에러 시 Alert(destructive) 표시
  - 연결 성공 시 Alert(success) 피드백
- 애니메이션 피드백:
  - 테이블 선택 시 fadeIn 애니메이션
  - 데이터 로딩 시 Skeleton 표시

## 관련 파일

- `src/pages/DbDoc.tsx`
