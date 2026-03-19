# DevDock 에이전트 기반 개발 파이프라인

## 설치/사용 방법

### 사전 요구사항
- [Claude Code](https://claude.ai/code) CLI 설치
- Node.js 18+, Rust 1.70+
- 이 저장소 클론

### 파이프라인 구조

```
사용자 요청
    ↓
Orchestrator (라우팅)
    ↓
┌──────────────────────────────────────────┐
│  TodoWriter → Designer → Implementer    │
│                  → Tester → DocUpdater   │
└──────────────────────────────────────────┘
    ↓
/todo/todo-NNN-*.md            → 요청 체크리스트
/docs/design/todo-NNN-*.design.md → 기능 설계서
/todo/todo-NNN-*.test.md       → 테스트 결과
/docs/features/                → 기능 문서
```

### 서브에이전트 호출 방식

Orchestrator는 각 에이전트를 **Task 도구(subagent_type="general-purpose")**로 호출한다.
에이전트 정의 파일(`.claude/agents/*.md`)의 내용을 prompt에 포함하여 서브에이전트에 역할을 부여한다.

```
Task(
  subagent_type="general-purpose",
  description="TodoWriter: CPU 알림 기능",
  prompt="<.claude/agents/todo-writer.md 내용>\n\n## 요청\nCPU 알림 기능 추가"
)
```

- 순차 의존성이 있는 에이전트(예: Designer는 TodoWriter 결과 필요)는 이전 완료 후 호출
- 독립 에이전트는 병렬 호출 가능

### 에이전트 역할

| 에이전트 | 역할 | 입력 | 출력 |
|----------|------|------|------|
| **Orchestrator** | 요청 라우팅 | 사용자 문장 | 에이전트 호출 순서 |
| **TodoWriter** | todo 생성 | 사용자 요청 | `/todo/todo-NNN-<slug>.md` |
| **Designer** | 기능 설계 | todo 파일 | `/docs/design/todo-NNN-<slug>.design.md` |
| **Implementer** | 코드 구현 | todo + design | 소스 코드 + 체크리스트 업데이트 |
| **Tester** | 테스트 실행 | 구현 결과 | `/todo/todo-NNN-<slug>.test.md` |
| **DocUpdater** | 문서 업데이트 | 전체 결과 | `/docs/features/NNN-<slug>.md` |

### 사용법

Claude Code를 실행한 후 자연어로 요청합니다:

#### 1. 기능 요청 (TodoWriter + Designer 호출)

```
"서버 모니터링에 CPU 알림 기능 추가해줘"
"다크모드에서 테이블 가독성이 떨어져요, 개선해주세요"
"JSON Tool에 YAML 변환 기능을 넣고 싶어"
```

→ 결과: `/todo/todo-018-cpu-alert.md` + `/todo/todo-018-cpu-alert.design.md` 생성

#### 2. 구현 진행 (Implementer + Tester + DocUpdater 호출)

```
"진행"           → 다음 미완료 항목 1개 처리
"3개 처리"       → 3개 항목 연속 처리
"전체 파이프라인" → 처음부터 끝까지 한번에
```

→ 결과: 코드 수정 + todo 체크 + 테스트 + 문서화

#### 3. 테스트만 실행

```
"테스트"
"검증해줘"
```

→ 결과: `/todo/todo-NNN-<slug>.test.md` 생성

#### 4. 문서만 업데이트

```
"문서 업데이트"
"docs 갱신"
```

→ 결과: `/docs/features/NNN-<slug>.md` 생성/업데이트

### 작업 ID 규칙

- 3자리 제로패딩 숫자: `001`, `002`, ...
- `/todo` 폴더에서 가장 큰 번호 +1로 자동 증가
- 파일명:
  - Todo: `todo-NNN-<slug>.md`
  - Design: `docs/design/todo-NNN-<slug>.design.md`
  - Test: `todo-NNN-<slug>.test.md`
  - Feature doc: `NNN-<slug>.md` (`/docs/features/`)
- slug: 영문 kebab-case (최대 5단어)

### 테스트 인프라 현황

| 테스트 유형 | 명령어 | 상태 |
|------------|--------|------|
| TypeScript 타입 체크 | `npx tsc -b --noEmit` | 사용 가능 |
| Vite 프로덕션 빌드 | `npm run build` | 사용 가능 |
| Rust 빌드 | `cd src-tauri && cargo build` | 사용 가능 |
| Rust 린트 | `cd src-tauri && cargo clippy` | 사용 가능 |
| Rust 단위 테스트 | `cd src-tauri && cargo test` | 실행 가능 (테스트 0개) |
| npm test | `npm test` | 미설정 (프레임워크 필요) |
| E2E 테스트 | 미설정 | 미도입 |

### 수동 테스트 절차

자동 테스트로 커버되지 않는 기능은 아래 절차로 수동 테스트:

1. `npm run tauri dev`로 앱 실행
2. 변경된 페이지/기능으로 이동
3. 정상 동작 확인
4. 테마 전환(10개) 후 UI 깨짐 없는지 확인
5. 빈 상태 / 데이터 있는 상태 / 에러 상태 각각 확인

### 폴더 구조

```
DevDock/
├── .claude/
│   ├── agents/
│   │   ├── orchestrator.md      # 메인 라우팅
│   │   ├── todo-writer.md       # todo 생성
│   │   ├── designer.md          # 설계
│   │   ├── implementer.md       # 구현
│   │   ├── tester.md            # 테스트
│   │   └── doc-updater.md       # 문서화
│   └── templates/
│       ├── todo.template.md     # todo 템플릿
│       ├── design.template.md   # 설계 템플릿
│       ├── test.template.md     # 테스트 템플릿
│       └── feature-doc.template.md  # 기능 문서 템플릿
├── todo/                         # 작업 파일
│   ├── todo-NNN-*.md            # todo 파일
│   └── todo-NNN-*.test.md       # 테스트 결과
└── docs/
    ├── AGENT-PIPELINE.md        # 이 문서
    ├── design/                  # 설계 문서
    │   └── todo-NNN-*.design.md
    └── features/                # 기능별 문서
        └── *.md
```
