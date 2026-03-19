# TODO-001: 테마 시스템 기반 구축

## 상태: 완료

## 구현 내용

- `src/lib/themes.ts` 생성: 10개 테마 정의 (Dark 5개, Light 5개)
  - 각 테마는 id, name, group, accent, CSS 변수 맵을 포함
  - ThemeId 타입 export
- `src/hooks/useTheme.ts` 수정: ThemeId 기반 테마 적용 로직 추가
  - CSS 변수를 document root에 동적 주입
  - dark/light 클래스 자동 토글
- `src/stores/settingsStore.ts` 수정: themeId 필드 추가
  - 기본값 설정, persist 대상에 포함
  - settings.json 저장/로드 시 themeId 반영

## 관련 파일

- `src/lib/themes.ts`
- `src/hooks/useTheme.ts`
- `src/stores/settingsStore.ts`
