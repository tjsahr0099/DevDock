# 에이전트 기반 개발 파이프라인

> 작업 ID: 0001
> 완료일: 2026-02-26

## 개요
Claude Code 에이전트 기반의 5단계 개발 파이프라인을 도입합니다. 사용자의 자연어 요청으로 todo 생성부터 설계, 구현, 테스트, 문서화까지 자동으로 진행됩니다.

## 사용법

### 기본 워크플로우

1. **기능 요청** → TodoWriter + Designer 자동 호출
2. **"진행"** → Implementer + Tester + DocUpdater 자동 호출
3. 모든 체크리스트 완료 시 자동 종료

### 요청 예시

```
"서버 모니터링에 알림 기능 추가해줘"
→ TodoWriter가 todo 생성 → Designer가 설계 문서 작성

"진행"
→ Implementer가 다음 미완료 항목 1개 구현 → Tester가 검증 → DocUpdater가 문서화

"3개 처리"
→ Implementer가 3개 항목 연속 구현 → Tester → DocUpdater

"테스트"
→ Tester가 현재 구현 상태를 검증

"문서 업데이트"
→ DocUpdater가 docs/features 업데이트
```

## 기술 변경사항

### 추가된 파일

| 파일 | 변경 내용 |
|------|----------|
| `.claude/agents/orchestrator.md` | 메인 라우팅 에이전트 정의 |
| `.claude/agents/todo-writer.md` | TodoWriter 에이전트 정의 |
| `.claude/agents/designer.md` | Designer 에이전트 정의 |
| `.claude/agents/implementer.md` | Implementer 에이전트 정의 |
| `.claude/agents/tester.md` | Tester 에이전트 정의 |
| `.claude/agents/doc-updater.md` | DocUpdater 에이전트 정의 |
| `.claude/templates/todo.template.md` | todo 파일 템플릿 |
| `.claude/templates/design.template.md` | 설계 문서 템플릿 |
| `.claude/templates/test.template.md` | 테스트 결과 템플릿 |
| `.claude/templates/feature-doc.template.md` | 기능 문서 템플릿 |
| `docs/features/` | 기능 문서 폴더 (신규) |

### 파일명 규칙
- ID: `0001`부터 시작, 4자리 제로패딩
- 형식: `<ID>-<slug>.{todo|design|test}.md`
- slug: 영문 kebab-case, 최대 5단어

## 테스트 결과 요약
- 자동 테스트: TypeScript, Vite빌드, Rust빌드, Clippy 모두 PASS
- 수동 테스트: 에이전트 파일 구조/내용 검증 PASS
- 제한사항: npm test, Rust 단위 테스트는 프레임워크 미도입 상태

## 알려진 제한사항
- 프론트엔드 단위 테스트 프레임워크(Vitest 등)가 미설정되어 `npm test` 불가
- Rust 단위 테스트 미작성 상태 (`cargo test` 실행 시 0개 테스트)
- E2E 테스트 프레임워크 미도입
- SSH/DB 연결이 필요한 기능은 실제 환경에서만 테스트 가능
