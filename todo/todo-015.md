# TODO-015: JsonTool 리디자인

## 상태: 완료

## 구현 내용

- 툴바 버튼에 Tooltip 추가:
  - 각 버튼의 키보드 단축키 표시 (예: Ctrl+Shift+F = 포맷)
  - 기능 설명 텍스트 포함
- 에러 처리 개선:
  - JSON 파싱 에러 시 Alert(destructive) 배너 표시
  - 에러 위치 (line:column) 정보 포함
- 하단 상태바 확장 정보:
  - JSON 유효성 상태 표시
  - 문자 수, 줄 수, 키 개수 등 통계
  - 현재 뎁스 레벨 표시

## 관련 파일

- `src/pages/JsonTool.tsx`
