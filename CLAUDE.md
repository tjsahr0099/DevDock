# CLAUDE.md

이 파일은 Claude Code (claude.ai/code)가 이 저장소에서 작업할 때 참고하는 가이드입니다.

## 프로젝트 개요

DevDock은 Tauri 2 데스크톱 애플리케이션(Rust 백엔드 + React 프론트엔드)으로, JavaFX에서 마이그레이션된 개발자 도구 모음입니다. 9개의 설정 가능한 탭 기반 도구를 제공합니다: Dashboard, DB 정의서, PlantUML 뷰어, Markdown 뷰어, Java 호출 흐름 분석기, 서버 관리, 서버 모니터링, JSON 도구.

UI 라벨은 한국어를 사용합니다 (예: "DB 정의서", "서버 관리", "호출 흐름") — 탭 라벨이나 사용자에게 보이는 텍스트를 수정할 때 이를 유지해야 합니다.

## 빌드 및 개발 명령어

```bash
# 전체 앱 실행 (Tauri + Vite 개발 서버, 포트 1420)
npm run tauri dev

# 배포 빌드 (NSIS/MSI 설치 파일)
npm run tauri build

# 프론트엔드만 (Tauri 셸 없이)
npm run dev          # Vite 개발 서버
npm run build        # TypeScript 검사 + Vite 빌드

# Rust 백엔드만
cd src-tauri
cargo build          # 디버그 빌드
cargo clippy         # 린트
cargo fmt            # 포맷
```

테스트 프레임워크는 설정되어 있지 않습니다. ESLint/Prettier 설정도 없습니다. TypeScript strict 모드가 활성화되어 있으며 `noUnusedLocals`와 `noUnusedParameters`가 켜져 있습니다.

## 아키텍처

### 프론트엔드 → 백엔드 IPC

모든 백엔드 호출은 Tauri의 `invoke()`를 통해 이루어집니다. 프론트엔드에서 `invoke<ReturnType>("command_name", { params })`를 호출하면 `src-tauri/src/lib.rs`에 등록된 `#[tauri::command]` 함수로 매핑됩니다. 모든 커맨드 목록은 해당 파일에서 확인할 수 있습니다.

### 프론트엔드 (`src/`)

- **App.tsx** — 메인 셸. Radix `Tabs`를 사용한 탭 기반 라우팅. 모든 페이지 컴포넌트는 `React.lazy()`와 `PAGE_MAP` 조회를 통해 지연 로딩됩니다.
- **pages/** — 탭당 하나의 컴포넌트 (Dashboard, DbDoc, PumlViewer, MdViewer, CallFlow, ServerManager, ServerMonitor, JsonTool, Home).
- **stores/** — 전역 상태를 위한 Zustand 스토어:
  - `settingsStore.ts` — 앱 설정, 탭 구성 (표시 여부/순서)
  - `serverStore.ts` — 서버 목록, 추적 중인 Docker 컨테이너
- **components/ui/** — shadcn/ui 컴포넌트 (New York 스타일, Tailwind CSS 4). `components.json`으로 설정.
- **hooks/useTheme.ts** — CSS 변수와 `.dark` 클래스를 이용한 라이트/다크 테마 전환.

### 백엔드 (`src-tauri/src/`)

- **lib.rs** — Tauri 빌더 설정 및 커맨드 등록 (단일 `generate_handler![]` 블록).
- **commands/** — 9개의 커맨드 모듈, 각각 `#[tauri::command]` async 함수를 내보냄:
  - `settings.rs` — 설정/탭 설정 JSON 파일 I/O
  - `fs.rs` — 디렉토리 목록, 파일 읽기/쓰기, 탐색기에서 열기
  - `ssh.rs` — `russh`를 통한 SSH 연결, 원격 명령 실행
  - `docker.rs` — SSH를 통한 Docker 컨테이너 목록/로그 조회
  - `server_config.rs` — 서버 CRUD, PuTTY 세션 가져오기 (Windows `winreg`)
  - `db.rs` — `sqlx`를 통한 MySQL 연결 (테이블, 컬럼, 인덱스)
  - `excel.rs` — `rust_xlsxwriter`를 통한 XLSX 생성
  - `puml.rs` — PlantUML 서버로 HTTP 호출하여 SVG 렌더링
  - `callflow.rs` — Java 소스 AST 파싱 및 시퀀스 다이어그램 생성 (최대 모듈, ~970줄)
- **models/** — `server.rs`에 `ServerInfo`, `DockerContainer`, `ServerHealth` 등 정의.

### 데이터 저장

모든 앱 데이터는 `data/` 디렉토리에 JSON 파일로 저장됩니다 (이동식, 데이터베이스 불필요):
- `data/settings.json` — 테마, 경로, DB 자격 증명
- `data/tab-settings.json` — 탭 표시 여부 및 순서
- `data/servers.json` — SSH 서버 정의
- `data/tracked-containers.json` — Docker 컨테이너 추적 정보

### 주요 패턴

- Tauri 커맨드는 `Result<T, String>`을 반환합니다 — IPC 전송을 위해 에러를 문자열로 변환합니다.
- 프론트엔드 상태 흐름: Zustand 스토어 → `invoke()` → Rust 커맨드 → JSON 파일/네트워크 → 응답 → 스토어 업데이트.
- 새 Tauri 커맨드를 추가하려면 세 곳에 등록해야 합니다: 커맨드 모듈, `commands/mod.rs`의 `pub mod`, `lib.rs`의 `generate_handler![]` 매크로.
- shadcn/ui 컴포넌트는 `src/components/ui/`에 위치하며 shadcn CLI(`npx shadcn@latest add <컴포넌트>`)로 추가합니다.

## 에이전트 기반 개발 파이프라인

이 저장소는 Claude Code 에이전트 파이프라인을 사용합니다. 자연어로 기능 요청 → 자동으로 todo/설계/구현/테스트/문서화 진행.

- **에이전트 정의**: `.claude/agents/` (orchestrator, todo-writer, designer, implementer, tester, doc-updater)
- **템플릿**: `.claude/templates/` (todo, design, test, feature-doc)
- **작업 파일**: `/todo/` (`todo-NNN-<slug>.md`, `todo-NNN-<slug>.design.md`, `todo-NNN-<slug>.test.md`)
- **기능 문서**: `/docs/features/`
- **상세 가이드**: `docs/AGENT-PIPELINE.md`

## 주요 참고 자료

- **docs/AGENT-PIPELINE.md** — 에이전트 파이프라인 설치/사용 가이드.
- **MIGRATION.md** — JavaFX에서의 상세 마이그레이션 설계 문서. 아키텍처 설계도, 기능 매핑, 구현 로드맵 포함.
- **tauri.conf.json** — 앱 윈도우 설정 (1280x800, 데코레이션 없음/커스텀 타이틀바), 번들 설정, 개발 서버 URL.
