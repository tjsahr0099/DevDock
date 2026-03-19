# TODO-{NNN}: {제목} — 테스트 결과

> 대응 todo: /todo/todo-{NNN}-{slug}.md
> 테스트 일시: {date}

## 자동 테스트 결과

| 테스트 | 명령어 | 결과 | 비고 |
|--------|--------|------|------|
| TypeScript 타입 체크 | `npx tsc -b --noEmit` | {PASS/FAIL} | {출력 요약} |
| Vite 빌드 | `npm run build` | {PASS/FAIL} | {출력 요약} |
| Rust 빌드 | `cd src-tauri && cargo build` | {PASS/FAIL/SKIP} | {출력 요약} |
| Rust 린트 | `cd src-tauri && cargo clippy` | {PASS/FAIL/SKIP} | {출력 요약} |

## 수동 테스트 케이스

### TC-{NNN}-01: {테스트 제목}
- **전제 조건**: {필요한 상태/데이터}
- **실행 단계**:
  1. {단계 1}
  2. {단계 2}
  3. {단계 3}
- **기대 결과**: {예상되는 동작}
- **실행 결과**: {PASS/FAIL/NOT_TESTED}
- **비고**: {추가 메모}

## 실행 불가 항목
| 항목 | 사유 | 수동 대체 절차 |
|------|------|---------------|
| {항목} | {사유} | {수동 테스트 방법} |

## 회귀 테스트
- [ ] 기존 기능 {X} 정상 동작 확인
- [ ] 기존 기능 {Y} 정상 동작 확인
