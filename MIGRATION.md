# DevDock 마이그레이션 설계 문서

> JavaFX → Tauri 2 (Rust + React + TypeScript) 전환

## 1. 현재 프로젝트 개요

### 기술 스택
- **프레임워크**: JavaFX 17.0.2
- **빌드**: Gradle + Shadow JAR + jpackage
- **테마**: AtlantaFX (7개 테마)
- **언어**: Java 17

### 기능 목록 (9개 탭)

| # | 탭 ID | 이름 | 핵심 기능 |
|---|-------|------|----------|
| 1 | home | 홈 | 앱 소개 정적 페이지 |
| 2 | dbdoc | DB 정의서 | MariaDB 접속 → 테이블 메타데이터 조회 → Excel 파일 생성 |
| 3 | pumlviewer | PUML 뷰어 | 폴더 탐색 → PlantUML 파일 렌더링 → 이미지 미리보기 |
| 4 | mdviewer | 마크다운 뷰어 | 폴더 탐색 → MD 파일 HTML 미리보기 → PDF 변환 |
| 5 | callflow | 호출 흐름 | Spring Boot 프로젝트 분석 → 시퀀스 다이어그램 생성 |
| 6 | servermanager | 서버 관리 | SSH 서버 정보 CRUD, PuTTY 가져오기, SSH 터미널 연결 |
| 7 | servermonitor | 서버 모니터링 | SSH로 서버 상태(CPU/MEM/DISK) 조회, Docker 컨테이너 관리 |
| 8 | dashboard | 대시보드 | 전체 서버 카드형 모니터링, 이벤트 로그, 드래그 정렬 |
| 9 | jsontool | JSON Tool | JSON 포맷팅/압축/검증, 실시간 에러 표시 |

### 외부 라이브러리 의존성

| 라이브러리 | 용도 | Tauri 대응 |
|-----------|------|-----------|
| mariadb-java-client | DB 연결 | `sqlx` (Rust) |
| apache-poi | Excel 생성 | `rust_xlsxwriter` (Rust) |
| plantuml | UML 렌더링 | PlantUML Server HTTP 호출 또는 `plantuml` CLI wrapping |
| javaparser | Java 소스 분석 | `tree-sitter` 또는 직접 구현 (Rust) |
| jsch | SSH 연결/실행 | `russh` (Rust) |
| gson | JSON 파싱 | `serde_json` (Rust) / 프론트에서 직접 처리 |
| flying-saucer-pdf | HTML→PDF 변환 | `headless-chrome` 또는 `weasyprint` CLI |
| atlantafx | UI 테마 | Tailwind CSS + shadcn/ui (React) |

### 데이터 저장소

| 파일 | 위치 | 내용 |
|------|------|------|
| tab-settings.json | data/ | 탭 표시/순서 설정 |
| servers.json | data/ | SSH 서버 정보 목록 |
| tracked-containers.json | data/ | 트래킹 중인 Docker 컨테이너 |
| Java Preferences | OS 레지스트리 | DB 설정, 폴더 경로, 테마 등 |

---

## 2. 타겟 아키텍처

### 기술 스택

```
┌─────────────────────────────────────────────┐
│              Frontend (React)               │
│  TypeScript + React 18 + Tailwind CSS       │
│  shadcn/ui 컴포넌트 + React Router          │
│  Monaco Editor (JSON Tool용)                │
└──────────────┬──────────────────────────────┘
               │ invoke() / events
┌──────────────▼──────────────────────────────┐
│            Tauri 2 Core (Rust)              │
│  Commands: DB, SSH, 파일 I/O, Excel 생성     │
│  sqlx · russh · rust_xlsxwriter · serde     │
└─────────────────────────────────────────────┘
```

### 프로젝트 구조

```
C:\workspace\DevDock\
├── src-tauri/                    # Rust 백엔드
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── icons/                    # 앱 아이콘
│   │   ├── icon.ico
│   │   └── icon.png
│   └── src/
│       ├── main.rs               # Tauri 진입점
│       ├── lib.rs                # 모듈 등록
│       ├── commands/             # Tauri Command (프론트 호출용)
│       │   ├── mod.rs
│       │   ├── db.rs             # DB 연결/메타데이터 조회/Excel 생성
│       │   ├── ssh.rs            # SSH 연결/명령 실행
│       │   ├── docker.rs         # Docker 컨테이너 조회/로그
│       │   ├── fs.rs             # 파일 시스템 (폴더 탐색, 파일 읽기)
│       │   ├── puml.rs           # PlantUML 렌더링
│       │   ├── callflow.rs       # Java 프로젝트 분석
│       │   ├── markdown.rs       # Markdown → HTML/PDF 변환
│       │   ├── excel.rs          # Excel 생성 공통
│       │   └── settings.rs       # 앱 설정 CRUD
│       ├── models/               # 데이터 모델
│       │   ├── mod.rs
│       │   ├── server.rs         # ServerInfo, DockerContainer, ServerHealth
│       │   ├── callflow.rs       # ClassMetadata, MethodMetadata, MethodCall
│       │   └── settings.rs       # TabConfig, AppSettings
│       ├── services/             # 비즈니스 로직
│       │   ├── mod.rs
│       │   ├── db_manager.rs     # DB 연결 관리
│       │   ├── ssh_executor.rs   # SSH 세션 관리
│       │   ├── project_analyzer.rs  # Java 소스 분석
│       │   ├── puml_generator.rs    # PlantUML 코드 생성
│       │   ├── table_def_generator.rs  # Excel 정의서 생성
│       │   ├── dictionary_generator.rs # 데이터 사전 생성
│       │   └── server_config.rs  # 서버 설정 파일 관리
│       └── utils/
│           ├── mod.rs
│           └── paths.rs          # 앱 경로 관리
│
├── src/                          # React 프론트엔드
│   ├── main.tsx                  # React 진입점
│   ├── App.tsx                   # 라우팅 + 탭 레이아웃
│   ├── index.css                 # Tailwind 설정
│   ├── lib/
│   │   ├── tauri.ts              # invoke 래퍼 함수
│   │   └── utils.ts              # 공통 유틸
│   ├── components/               # 공통 컴포넌트
│   │   ├── ui/                   # shadcn/ui 컴포넌트
│   │   ├── Layout.tsx            # 사이드바/탭 레이아웃
│   │   ├── TitleBar.tsx          # 커스텀 타이틀바
│   │   ├── FileTree.tsx          # 파일 트리 공통 컴포넌트
│   │   └── HelpDialog.tsx        # 도움말 다이얼로그
│   ├── pages/                    # 각 탭 페이지
│   │   ├── Home.tsx
│   │   ├── DbDoc.tsx
│   │   ├── PumlViewer.tsx
│   │   ├── MdViewer.tsx
│   │   ├── CallFlow.tsx
│   │   ├── ServerManager.tsx
│   │   ├── ServerMonitor.tsx
│   │   ├── Dashboard.tsx
│   │   └── JsonTool.tsx
│   ├── hooks/                    # 커스텀 훅
│   │   ├── useSettings.ts        # 설정 읽기/저장
│   │   ├── useTheme.ts           # 테마 관리
│   │   └── useFileTree.ts        # 파일 트리 상태
│   └── stores/                   # 상태 관리 (zustand)
│       ├── settingsStore.ts
│       └── serverStore.ts
│
├── public/                       # 정적 리소스
│   └── docs/                     # 도움말 MD 파일
│       ├── dashboard-help.md
│       ├── db-definition-generator.md
│       ├── json-tool-help.md
│       ├── md-viewer-help.md
│       ├── puml-viewer-help.md
│       ├── callflow-help.md
│       ├── server-manager-help.md
│       └── server-monitor-help.md
│
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── vite.config.ts
└── components.json               # shadcn/ui 설정
```

---

## 3. Rust 백엔드 상세 설계

### 3.1 Cargo.toml 의존성

```toml
[dependencies]
tauri = { version = "2", features = ["tray-icon", "dialog"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }

# DB
sqlx = { version = "0.8", features = ["runtime-tokio", "mysql", "chrono"] }

# SSH
russh = "0.46"
russh-keys = "0.46"

# Excel
rust_xlsxwriter = "0.79"

# 파일 시스템
walkdir = "2"
notify = "7"           # 파일 변경 감시 (선택)

# UUID
uuid = { version = "1", features = ["v4"] }

# 날짜
chrono = { version = "0.4", features = ["serde"] }

# 로깅
log = "0.4"
env_logger = "0.11"

# 정규식
regex = "1"

# Java 파싱 (callflow)
tree-sitter = "0.24"
tree-sitter-java = "0.23"

# PlantUML (HTTP 호출 방식 사용 시)
reqwest = { version = "0.12", features = ["blocking"] }

# PDF 변환
# 방법 1: wkhtmltopdf CLI 호출 (std::process::Command)
# 방법 2: headless Chrome/Chromium 으로 print-to-pdf
```

### 3.2 Tauri Commands 인터페이스

모든 Command는 `#[tauri::command]`로 정의하고 프론트엔드에서 `invoke()`로 호출한다.

#### DB 관련 (db.rs)

```rust
#[tauri::command]
async fn test_db_connection(host: String, port: u16, database: String,
                            username: String, password: String) -> Result<bool, String>

#[tauri::command]
async fn get_all_tables(host: String, port: u16, database: String,
                        username: String, password: String) -> Result<Vec<String>, String>

#[tauri::command]
async fn get_table_columns(/* connection params */, table: String)
    -> Result<Vec<ColumnInfo>, String>

#[tauri::command]
async fn get_table_indexes(/* connection params */, table: String)
    -> Result<Vec<IndexInfo>, String>

#[tauri::command]
async fn generate_table_definition(/* connection params */, output_path: String,
                                    author: String, db_user: String) -> Result<String, String>
// 프로그레스: Tauri Event로 전송
// emit("generate-progress", { message: "...", progress: 0.5 })

#[tauri::command]
async fn generate_dictionary(/* connection params */, output_path: String) -> Result<String, String>
```

#### SSH 관련 (ssh.rs)

```rust
#[tauri::command]
async fn ssh_execute(server_id: String, command: String) -> Result<String, String>

#[tauri::command]
async fn ssh_test_connection(host: String, port: u16,
                              username: String, password: String) -> Result<bool, String>

#[tauri::command]
async fn open_ssh_terminal(server_id: String) -> Result<(), String>
// OS별 터미널 실행: PuTTY / Windows Terminal / iTerm2 / GNOME Terminal
```

#### Docker 관련 (docker.rs)

```rust
#[tauri::command]
async fn get_docker_containers(server_id: String) -> Result<Vec<DockerContainer>, String>
// docker ps -a --format + docker stats --no-stream 파싱

#[tauri::command]
async fn get_docker_logs(server_id: String, container_id: String,
                          tail: u32) -> Result<String, String>

#[tauri::command]
async fn docker_exec(server_id: String, container_id: String) -> Result<(), String>
// OS 터미널에서 docker exec -it 실행
```

#### 파일 시스템 (fs.rs)

```rust
#[tauri::command]
fn list_directory(path: String, extensions: Vec<String>) -> Result<Vec<FileNode>, String>
// 재귀 트리 구조 반환, 확장자 필터링

#[tauri::command]
fn read_file(path: String) -> Result<String, String>

#[tauri::command]
fn select_directory() -> Result<Option<String>, String>
// 네이티브 폴더 선택 다이얼로그

#[tauri::command]
fn open_in_explorer(path: String) -> Result<(), String>
// OS 파일 탐색기 열기
```

#### PlantUML (puml.rs)

```rust
#[tauri::command]
async fn render_puml(source: String) -> Result<Vec<u8>, String>
// 방법 1: 내장 PlantUML JAR를 java -jar로 실행
// 방법 2: PlantUML 온라인 서버 HTTP 호출
// 방법 3: plantuml CLI 호출
// PNG 바이트 배열 반환 → 프론트에서 blob URL로 표시

#[tauri::command]
fn render_puml_svg(source: String) -> Result<String, String>
// SVG 문자열 반환 (프론트에서 직접 렌더링, 확대/축소에 유리)
```

#### 호출 흐름 분석 (callflow.rs)

```rust
#[tauri::command]
async fn analyze_project(project_path: String) -> Result<AnalysisResult, String>
// tree-sitter로 Java 소스 파싱
// ClassMetadata, MethodMetadata, MethodCall 추출

#[tauri::command]
fn generate_sequence_diagram(controller: String, method: String) -> Result<String, String>
// PlantUML 시퀀스 다이어그램 코드 생성
```

#### Markdown (markdown.rs)

```rust
#[tauri::command]
fn markdown_to_html(content: String) -> Result<String, String>
// pulldown-cmark 또는 comrak 크레이트 사용

#[tauri::command]
async fn markdown_to_pdf(content: String, output_path: String) -> Result<String, String>
// HTML 변환 후 wkhtmltopdf / Chrome headless로 PDF 생성
```

#### 설정 (settings.rs)

```rust
#[tauri::command]
fn get_settings() -> Result<AppSettings, String>

#[tauri::command]
fn save_settings(settings: AppSettings) -> Result<(), String>

#[tauri::command]
fn get_tab_settings() -> Result<Vec<TabConfig>, String>

#[tauri::command]
fn save_tab_settings(configs: Vec<TabConfig>) -> Result<(), String>

#[tauri::command]
fn get_servers() -> Result<Vec<ServerInfo>, String>

#[tauri::command]
fn save_server(server: ServerInfo) -> Result<(), String>

#[tauri::command]
fn delete_server(id: String) -> Result<(), String>

#[tauri::command]
fn get_tracked_containers() -> Result<Vec<TrackedContainer>, String>

#[tauri::command]
fn save_tracked_containers(containers: Vec<TrackedContainer>) -> Result<(), String>

#[tauri::command]
fn import_putty_sessions() -> Result<Vec<PuttySession>, String>
// Windows 레지스트리에서 PuTTY 세션 읽기
```

### 3.3 데이터 모델 (Rust)

```rust
// --- server.rs ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerInfo {
    pub id: String,           // UUID
    pub name: String,
    pub host: String,
    pub port: u16,            // default: 22
    pub username: String,
    pub password: String,
    pub description: String,
    pub display_order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DockerContainer {
    pub container_id: String,
    pub image: String,
    pub command: String,
    pub created: String,
    pub status: String,
    pub ports: String,
    pub names: String,
    pub cpu_percent: String,
    pub mem_usage: String,
    pub mem_percent: String,
    pub net_io: String,
    pub block_io: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerHealth {
    pub hostname: String,
    pub uptime: String,
    pub load_average: String,
    pub cpu_usage: f64,
    pub cpu_cores: u32,
    pub mem_total: u64,       // MB
    pub mem_used: u64,
    pub mem_free: u64,
    pub mem_usage_percent: f64,
    pub swap_total: u64,
    pub swap_used: u64,
    pub disk_total: u64,      // GB
    pub disk_used: u64,
    pub disk_free: u64,
    pub disk_usage_percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackedContainer {
    pub server_id: String,
    pub server_name: String,
    pub container_id: String,
    pub container_name: String,
    pub order: i32,
}

// --- callflow.rs ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassMetadata {
    pub package_name: String,
    pub class_name: String,
    pub full_name: String,
    pub class_type: ClassType,
    pub annotations: Vec<String>,
    pub methods: Vec<MethodMetadata>,
    pub injected_fields: HashMap<String, String>,  // field_name → type
    pub base_path: String,
    pub table_name: String,
    pub javadoc: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ClassType {
    Controller, Service, Repository, Component,
    Entity, Batch, ExternalClient, Mapper, Other,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MethodMetadata {
    pub method_name: String,
    pub return_type: String,
    pub parameters: Vec<String>,
    pub annotations: Vec<String>,
    pub is_endpoint: bool,
    pub http_method: String,
    pub request_path: String,
    pub is_scheduled: bool,
    pub cron_expression: String,
    pub method_calls: Vec<MethodCall>,
    pub javadoc: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MethodCall {
    pub target_class: String,
    pub target_method: String,
    pub call_type: CallType,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CallType {
    Internal, ExternalApi, DbAccess, MessageQueue,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisResult {
    pub controllers: Vec<ClassMetadata>,
    pub scheduled_methods: Vec<ScheduledEntry>,
    pub total_classes: usize,
    pub total_endpoints: usize,
    pub total_scheduled: usize,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduledEntry {
    pub class: ClassMetadata,
    pub method: MethodMetadata,
}

// --- settings.rs ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub theme: String,
    pub db_host: String,
    pub db_port: String,
    pub db_database: String,
    pub db_username: String,
    pub db_output_path: String,
    pub db_author: String,
    pub db_user: String,
    pub puml_folder_path: String,
    pub callflow_project_path: String,
    pub md_viewer_folder_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TabConfig {
    pub id: String,
    pub name: String,
    pub visible: bool,
    pub order: i32,
}

// --- fs.rs ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Vec<FileNode>,
}
```

### 3.4 설정 저장 방식 변경

| 현재 (JavaFX) | Tauri |
|---------------|-------|
| Java Preferences (OS 레지스트리) | `data/settings.json` (JSON 파일) |
| data/servers.json | data/servers.json (동일) |
| data/tab-settings.json | data/tab-settings.json (동일) |
| data/tracked-containers.json | data/tracked-containers.json (동일) |

모든 설정을 JSON 파일로 통합. 경로: `{앱실행폴더}/data/` (포터블 앱 유지)

---

## 4. React 프론트엔드 상세 설계

### 4.1 package.json 주요 의존성

```json
{
  "dependencies": {
    "@tauri-apps/api": "^2",
    "@tauri-apps/plugin-dialog": "^2",
    "@tauri-apps/plugin-shell": "^2",
    "react": "^18",
    "react-dom": "^18",
    "react-router-dom": "^6",
    "zustand": "^5",
    "@tanstack/react-query": "^5",
    "tailwindcss": "^3",
    "class-variance-authority": "^0.7",
    "clsx": "^2",
    "lucide-react": "^0.400",
    "react-resizable-panels": "^2",
    "@monaco-editor/react": "^4",
    "react-markdown": "^9",
    "rehype-highlight": "^7",
    "remark-gfm": "^4",
    "@dnd-kit/core": "^6",
    "@dnd-kit/sortable": "^8",
    "recharts": "^2"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2",
    "typescript": "^5",
    "vite": "^5",
    "@vitejs/plugin-react": "^4",
    "autoprefixer": "^10",
    "postcss": "^8"
  }
}
```

### 4.2 페이지별 UI 설계

#### App.tsx — 메인 레이아웃

```
┌─ 커스텀 타이틀바 (data-tauri-drag-region) ──────────────────┐
│ [🔲] DevDock     [파일 ▾] [설정 ▾] [도움말 ▾]   [─][□][✕] │
├──────────────────────────────────────────────────────────────┤
│ ┌─ 탭 바 ─────────────────────────────────────────────────┐ │
│ │ [홈] [DB 정의서] [PUML 뷰어] [마크다운] [호출 흐름] ... │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │                                                         │ │
│ │              현재 탭 콘텐츠                               │ │
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

- 타이틀바: `data-tauri-drag-region`으로 드래그 이동
- 탭: React Router로 전환, 설정에 따라 표시/숨김/순서 변경
- 테마: Tailwind dark mode + CSS variables

#### Home.tsx

중앙 정렬된 로고 + "DevDock" + "탭에서 원하는 기능을 선택하세요" 메시지.

#### DbDoc.tsx

```
┌─ 타이틀 ─────────────────────────────── [도움말] ┐
├──────────────────────────────────────────────────┤
│ ┌─ DB 연결 정보 ───────────────────────────────┐ │
│ │ Host [________] Port [____] DB [__________]  │ │
│ │ User [________] Password [___] [연결 테스트]  │ │
│ ├─ 추가 정보 ──────────────────────────────────┤ │
│ │ 작성자 [________] DB USER [________]         │ │
│ ├─ 출력 설정 ──────────────────────────────────┤ │
│ │ 경로 [_____________________] [찾아보기]      │ │
│ ├──────────────────────────────────────────────┤ │
│ │ [정의서 생성]  [단어사전 다운로드]              │ │
│ │ ████████████████░░░░ 75%  테이블 처리 중...   │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

- 프로그레스: Tauri Event `listen("generate-progress")` 수신
- 파일 선택: `@tauri-apps/plugin-dialog`의 `open()` 사용

#### PumlViewer.tsx

```
┌─ 폴더 경로 [_________________] [찾아보기] [새로고침] ┐
├───────┬──────────────────────────────────────────────┤
│ 트리   │  [─] [100%] [+]                  [로딩...]  │
│ .puml  │ ┌──────────────────────────────────────────┐ │
│ 파일   │ │                                          │ │
│ 목록   │ │     SVG 다이어그램 표시 영역               │ │
│        │ │     (확대/축소/패닝)                       │ │
│        │ │                                          │ │
│        │ └──────────────────────────────────────────┘ │
│        │ ▸ PlantUML 소스 코드                         │
├────────┴─────────────────────────────────────────────┤
│ 상태 메시지                                           │
└──────────────────────────────────────────────────────┘
```

- SVG 직접 렌더링 (확대/축소가 깨지지 않음)
- `react-resizable-panels`로 좌/우 패널 분할
- Ctrl+스크롤 줌

#### MdViewer.tsx

```
┌─ 폴더 경로 [________________] [찾아보기] [새로고침] ┐
├───────┬─────────────────────────────────────────────┤
│ .md   │ 파일명.md          [폴더 열기] [PDF 저장]    │
│ 파일  │ ┌─────────────────────────────────────────┐  │
│ 트리  │ │                                         │  │
│       │ │   Markdown HTML 미리보기                  │  │
│       │ │   (react-markdown + rehype-highlight)    │  │
│       │ │                                         │  │
│       │ └─────────────────────────────────────────┘  │
├───────┴─────────────────────────────────────────────┤
│ 상태 메시지                                          │
└─────────────────────────────────────────────────────┘
```

- `react-markdown`으로 직접 렌더링 (WebView 불필요!)
- GFM 테이블, 코드 하이라이팅 지원
- PDF 변환은 Rust 백엔드에서 처리

#### CallFlow.tsx

```
┌─ 프로젝트 경로 [___________] [찾아보기] [분석] [로딩] ┐
├───────┬──────────────────────────────────────────────┤
│ 분석  │ ┌──────────────────────────────────────────┐ │
│ 결과  │ │                                          │ │
│ 트리  │ │   시퀀스 다이어그램 (SVG)                   │ │
│       │ │                                          │ │
│  API  │ └──────────────────────────────────────────┘ │
│  엔드 │ ▸ PlantUML 코드     [PUML 저장] [PNG 저장]   │
│  포인 │                                              │
│  트   │                                              │
├───────┴──────────────────────────────────────────────┤
│ 상태 메시지                                           │
└──────────────────────────────────────────────────────┘
```

#### ServerManager.tsx

```
┌─ 서버 관리 ──────────────────────── [도움말] ┐
├──────────────────┬───────────────────────────┤
│ 서버 목록 테이블   │ 서버 정보 입력 폼          │
│ (이름/IP/포트/설명)│ 이름 [________]           │
│                   │ IP [__________]           │
│ [PuTTY 가져오기]  │ 포트 [___] 사용자 [____]   │
│                   │ 비밀번호 [________]        │
│                   │ 설명 [____________]        │
│                   │                           │
│                   │ [추가] [수정] [삭제] [초기화]│
│                   │ ─────────────────────     │
│                   │ [SSH 연결]                 │
├──────────────────┴───────────────────────────┤
│ 상태 메시지                                    │
└──────────────────────────────────────────────┘
```

- `@dnd-kit/sortable`로 서버 순서 드래그 정렬
- PuTTY 가져오기: Rust에서 Windows 레지스트리 읽기 → 다이얼로그에 체크박스 표시

#### ServerMonitor.tsx

```
┌─ 서버 [▾ 서버 선택] [조회] [☐ 자동(10s)] [서버 새로고침] ┐
├──────────────────────────────────────────────────────────┤
│ ┌─ 서버 상태 ──────────────────────────────────────────┐ │
│ │ Hostname: xxx   Uptime: 5d   Load: 0.15             │ │
│ │ CPU ████████░░ 78%  MEM ██████░░░░ 62%  DISK █░ 15% │ │
│ └──────────────────────────────────────────────────────┘ │
│ [트래킹] [Exec] [로그]                                   │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ ● | ID   | 이름     | 이미지   | 상태 | CPU | MEM   │ │
│ │ ○ | abc1 | nginx    | nginx:1 | Up   | 2%  | 50MB  │ │
│ │ ● | def2 | mysql    | mysql:8 | Up   | 5%  | 200MB │ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

- 게이지: `recharts`의 RadialBarChart 또는 커스텀 CSS 프로그레스바
- 컨테이너 로그: 별도 모달 창, 자동 스크롤 옵션

#### Dashboard.tsx

```
┌─ 대시보드   [새로고침] [☐ 자동(15s)] [서버 새로고침]  [도움말] ┐
│ 필터: [☑ 정상] [☑ 실패] | [☑ 실행] [☑ 중지]                  │
├───────────────────────────────────────────────────────────────┤
│ ┌─ 서버A ────── ● ─── CPU 78% ── MEM 62% ── DISK 15% ─────┐ │
│ │ ☰ 192.168.1.1       [nginx ●]  [mysql ●]  [redis ○]      │ │
│ └───────────────────────────────────────────────────────────┘ │
│ ┌─ 서버B ────── ● ─── CPU 45% ── MEM 80% ── DISK 30% ─────┐ │
│ │ ☰ 192.168.1.2       [app ●]   [worker ●]                 │ │
│ └───────────────────────────────────────────────────────────┘ │
├─ ▸ 이벤트 로그 (3) ─────────────────────────────────────────┤
│ [14:30:05] ⚠ 서버B 연결 실패                                  │
│ [14:30:20] ✓ 서버B 연결 복구                                  │
└───────────────────────────────────────────────────────────────┘
```

- 서버 카드: `@dnd-kit/sortable`로 드래그 정렬
- 컨테이너 박스: 서버 카드 내에서 드래그 정렬
- 필터: 상태 체크박스로 카드 표시/숨김

#### JsonTool.tsx

```
┌─ JSON 도구 ──────────────────────────── [도움말] ┐
│ [포맷팅] [압축] [검증] | 들여쓰기 [▾ 2 spaces]    │
│ [붙여넣기] [샘플] [지우기]                         │
│ ⚠ Line 5, Column 12: ':' 가 필요합니다            │
├─────────────────────┬────────────────────────────┤
│ 입력 JSON            │ 결과          [복사] [↔]   │
│ ┌─────────────────┐ │ ┌──────────────────────┐   │
│ │ Monaco Editor   │ │ │ Monaco Editor        │   │
│ │ (JSON 모드)     │ │ │ (읽기 전용)           │   │
│ │                 │ │ │                      │   │
│ └─────────────────┘ │ └──────────────────────┘   │
├─────────────────────┴────────────────────────────┤
│ ✓ 유효한 JSON (152자, 12줄)                       │
└──────────────────────────────────────────────────┘
```

- `@monaco-editor/react` 사용 → 구문 하이라이팅, 에러 표시, 줄번호 기본 지원
- JSON 파싱/검증은 프론트에서 `JSON.parse()` 직접 처리 (Rust 불필요)

### 4.3 테마 시스템

```typescript
// hooks/useTheme.ts
type Theme = 'light' | 'dark' | 'nord-light' | 'nord-dark' | 'dracula';

// Tailwind CSS Variables + data-theme 속성으로 전환
// <html data-theme="dark" class="dark">
```

Tailwind의 `darkMode: 'class'` + CSS 변수를 조합하여 테마별 색상 정의.
현재 7개 테마 → 최소 light/dark 2개로 시작, 필요시 추가.

### 4.4 상태 관리

```typescript
// stores/settingsStore.ts (zustand)
interface SettingsStore {
  theme: string;
  tabConfigs: TabConfig[];
  dbSettings: DbSettings;
  pumlFolderPath: string;
  callflowProjectPath: string;
  mdViewerFolderPath: string;

  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
  setTheme: (theme: string) => void;
  // ...
}

// stores/serverStore.ts (zustand)
interface ServerStore {
  servers: ServerInfo[];
  trackedContainers: TrackedContainer[];

  loadServers: () => Promise<void>;
  addServer: (server: ServerInfo) => Promise<void>;
  deleteServer: (id: string) => Promise<void>;
  // ...
}
```

---

## 5. 마이그레이션 순서

난이도와 의존성을 고려한 단계별 구현 순서:

### Phase 1: 프로젝트 셋업 + 기본 골격

1. Tauri 2 프로젝트 초기화 (`npm create tauri-app@latest`)
2. React + TypeScript + Tailwind + shadcn/ui 설정
3. 커스텀 타이틀바 구현 (TitleBar.tsx)
4. 탭 레이아웃 구현 (App.tsx + React Router)
5. 홈 페이지 (Home.tsx) — 정적 UI
6. 테마 시스템 (light/dark)
7. 설정 저장/로드 (Rust settings command + zustand store)
8. 탭 설정 다이얼로그 (표시/숨김/순서)

### Phase 2: 프론트엔드 독립 기능

9. **JSON Tool** — 프론트엔드만으로 완성 가능 (Monaco Editor)
10. **마크다운 뷰어** — 파일 읽기(Rust) + react-markdown(프론트)
11. **PUML 뷰어** — 파일 읽기(Rust) + SVG 렌더링(Rust)

### Phase 3: SSH/서버 관련

12. **서버 관리** — Rust SSH + 서버 CRUD
13. **서버 모니터링** — SSH 명령 실행 + 결과 파싱
14. **대시보드** — 모니터링 확장, 카드 레이아웃

### Phase 4: DB/분석 기능

15. **DB 정의서** — Rust DB 연결 + Excel 생성
16. **호출 흐름** — Java 소스 파싱 + PlantUML 생성

### Phase 5: 마무리

17. PDF 변환 (마크다운 → PDF)
18. PuTTY 가져오기 (Windows 레지스트리)
19. 도움말 시스템 (MD 파일 표시)
20. 빌드/배포 설정 (tauri build)
21. 아이콘, 스플래시 화면

---

## 6. 기능별 상세 매핑

### 6.1 DB 정의서 (dbdoc)

| JavaFX 구현 | Tauri 구현 |
|------------|-----------|
| `DatabaseManager` (JDBC) | `sqlx::MySqlPool` (Rust) |
| `TableInfoRetriever` (SQL 쿼리) | 동일 SQL을 `sqlx::query()` 로 실행 |
| `TableDefinitionGenerator` (Apache POI) | `rust_xlsxwriter` 로 Excel 생성 |
| `DictionaryGenerator` (Apache POI) | `rust_xlsxwriter` 로 Excel 생성 |
| `DbDocController` (JavaFX UI) | `DbDoc.tsx` (React) |
| Progress: `BiConsumer<String, Double>` | Tauri Event: `app.emit("progress", ...)` |

핵심 SQL 쿼리 (그대로 재사용):
```sql
-- 테이블 목록
SELECT TABLE_NAME FROM information_schema.TABLES
WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME

-- 컬럼 정보
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY,
       COLUMN_DEFAULT, COLUMN_COMMENT
FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?

-- 인덱스 정보
SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX, NON_UNIQUE
FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
```

### 6.2 PUML 뷰어 (pumlviewer)

| JavaFX 구현 | Tauri 구현 |
|------------|-----------|
| `PumlRenderer` (PlantUML 라이브러리) | 방법 A: PlantUML JAR 내장 + `java -jar` 실행 |
| | 방법 B: PlantUML 온라인 서버 HTTP 호출 |
| | 방법 C: Kroki API 호출 (추천) |
| `ImageView` + 줌 | SVG 직접 렌더링 + CSS transform scale |
| `TreeView<File>` | `FileTree.tsx` 공통 컴포넌트 |
| `TextArea` (소스 코드) | Monaco Editor (읽기 전용) |

**추천: Kroki API** → PlantUML 소스를 HTTP POST로 보내면 SVG 반환.
오프라인 필요 시: PlantUML JAR를 앱에 번들링하고 `Command::new("java")` 실행.

### 6.3 마크다운 뷰어 (mdviewer)

| JavaFX 구현 | Tauri 구현 |
|------------|-----------|
| 커스텀 MD→HTML 파서 (regex) | `react-markdown` + `remark-gfm` + `rehype-highlight` |
| `WebView` (HTML 미리보기) | React 직접 렌더링 (WebView 불필요!) |
| `MarkdownToPdfConverter` (Flying Saucer) | Rust: `wkhtmltopdf` CLI 또는 Chrome headless |
| `TreeView<File>` | `FileTree.tsx` 공통 컴포넌트 |

React 렌더링이 JavaFX WebView보다 훨씬 자연스럽고 빠름.

### 6.4 호출 흐름 (callflow)

| JavaFX 구현 | Tauri 구현 |
|------------|-----------|
| `JavaParser` (AST 파싱) | `tree-sitter` + `tree-sitter-java` (Rust) |
| `ProjectAnalyzer` | `project_analyzer.rs` — 동일 로직 Rust로 재작성 |
| `PlantUmlGenerator` | `puml_generator.rs` — 동일 로직 Rust로 재작성 |
| `PumlRenderer` (이미지 렌더링) | PUML 뷰어와 공유 (SVG 렌더링) |
| `TreeView` (분석 결과) | React TreeView 컴포넌트 |

분석 로직이 가장 복잡한 부분. tree-sitter가 JavaParser보다 더 빠르고 가벼움.

### 6.5 서버 관리 (servermanager)

| JavaFX 구현 | Tauri 구현 |
|------------|-----------|
| `SshExecutor` (JSch) | `russh` (Rust) |
| `ServerConfigManager` (JSON) | `server_config.rs` — serde_json 사용 |
| `TableView` | shadcn/ui `<Table>` 컴포넌트 |
| PuTTY 가져오기 (레지스트리) | Rust `winreg` 크레이트 |
| OS별 터미널 실행 | Rust `std::process::Command` |

### 6.6 서버 모니터링 (servermonitor)

| JavaFX 구현 | Tauri 구현 |
|------------|-----------|
| SSH로 시스템 명령 실행 | `ssh_execute` command 재사용 |
| `docker ps` / `docker stats` 파싱 | 동일 파싱 로직 Rust로 구현 |
| `ProgressBar` (CPU/MEM/DISK) | CSS 프로그레스바 또는 `recharts` |
| `Timeline` (자동 새로고침) | `setInterval()` + React Query |
| Docker 로그 스트리밍 | Tauri Event stream |

### 6.7 대시보드 (dashboard)

| JavaFX 구현 | Tauri 구현 |
|------------|-----------|
| 서버 카드 (HBox) | React 카드 컴포넌트 + Tailwind |
| 드래그 정렬 (서버/컨테이너) | `@dnd-kit/sortable` |
| 필터 체크박스 | React state 필터링 |
| 이벤트 로그 (ListView) | React 리스트 + 자동 스크롤 |
| `Timeline` (15초 갱신) | `setInterval()` + React Query |

### 6.8 JSON Tool (jsontool)

| JavaFX 구현 | Tauri 구현 |
|------------|-----------|
| `TextArea` (입/출력) | Monaco Editor (JSON 모드) |
| `Gson` (파싱/포맷팅) | `JSON.parse()` + `JSON.stringify(_, _, indent)` |
| 에러 줄/컬럼 표시 | Monaco Editor `setModelMarkers()` |
| 들여쓰기 옵션 | `JSON.stringify()` indent 파라미터 |

**Rust 백엔드 불필요** — 모든 로직이 프론트엔드에서 처리 가능.

---

## 7. 빌드 및 배포

### 개발

```bash
# 설치
npm install
cd src-tauri && cargo build

# 개발 모드 (핫 리로드)
npm run tauri dev
```

### 배포

```bash
# Windows 빌드
npm run tauri build

# 결과물
# src-tauri/target/release/DevDock.exe          (단일 실행 파일)
# src-tauri/target/release/bundle/nsis/         (NSIS 설치 파일)
# src-tauri/target/release/bundle/msi/          (MSI 설치 파일)
```

### 배포 크기 비교

| 항목 | JavaFX (현재) | Tauri (예상) |
|------|-------------|-------------|
| 실행 파일 | ~89MB JAR + ~200MB JRE | ~5-15MB |
| 설치 파일 | ~200MB .exe | ~10-20MB |
| 메모리 사용 | ~200MB+ | ~50-100MB |
| 기동 시간 | 3-5초 | <1초 |

### tauri.conf.json 핵심 설정

```json
{
  "productName": "DevDock",
  "version": "2.0.0",
  "identifier": "com.cudo.devdock",
  "build": {
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [{
      "title": "DevDock",
      "width": 1000,
      "height": 700,
      "minWidth": 800,
      "minHeight": 600,
      "decorations": false,
      "center": true
    }]
  },
  "bundle": {
    "active": true,
    "icon": ["icons/icon.ico", "icons/icon.png"],
    "targets": ["nsis", "msi"]
  }
}
```

---

## 8. 리소스 마이그레이션

### 그대로 복사할 파일

```
현재 위치                                    → 타겟 위치
src/main/resources/docs/*.md                → public/docs/*.md
src/main/resources/icons/logo.png           → src-tauri/icons/icon.png
src/main/resources/icons/logo.ico           → src-tauri/icons/icon.ico
data/servers.json                           → data/servers.json (런타임)
data/tab-settings.json                      → data/tab-settings.json (런타임)
data/tracked-containers.json                → data/tracked-containers.json (런타임)
```

### 제거되는 파일

- 모든 `.fxml` 파일 → React 컴포넌트로 대체
- `style.css` → Tailwind CSS로 대체
- `Launcher.java` → 불필요 (Rust가 진입점)
- `module-info.java` → 불필요

---

## 9. 주의사항 및 리스크

### 높은 위험

| 항목 | 설명 | 대응 |
|------|------|------|
| PlantUML 렌더링 | Rust에 PlantUML 네이티브 라이브러리 없음 | Kroki API 또는 JAR 번들링 |
| Java 소스 파싱 | tree-sitter-java가 JavaParser만큼 상세하지 않을 수 있음 | 필요시 regex 보완 |
| PDF 변환 | Rust 네이티브 PDF 라이브러리의 한글 지원 미흡 | wkhtmltopdf CLI 동봉 |

### 중간 위험

| 항목 | 설명 | 대응 |
|------|------|------|
| SSH 연결 안정성 | russh가 JSch 대비 성숙도 차이 | 충분한 테스트, 대안으로 ssh2 크레이트 |
| Windows 레지스트리 | PuTTY 가져오기 OS 의존적 | `winreg` 크레이트 (Windows only) |
| Excel 생성 | rust_xlsxwriter의 셀 스타일 지원 범위 | Apache POI 수준의 스타일링 가능 확인됨 |

### 낮은 위험

| 항목 | 설명 |
|------|------|
| 파일 트리 탐색 | Rust `walkdir`가 Java보다 빠름 |
| JSON 처리 | 프론트에서 네이티브 처리, 성능 우수 |
| Markdown 렌더링 | react-markdown이 커스텀 파서보다 기능 풍부 |
| 테마 시스템 | Tailwind CSS가 AtlantaFX보다 유연 |

---

## 10. 검증 체크리스트

각 기능 마이그레이션 완료 시 확인:

- [ ] 홈 화면 표시
- [ ] 커스텀 타이틀바 (드래그, 최소화, 최대화, 닫기)
- [ ] 테마 전환 (라이트/다크)
- [ ] 탭 표시/숨김/순서 설정
- [ ] JSON 포맷팅/압축/검증/에러 표시
- [ ] 마크다운 파일 트리 탐색 + HTML 미리보기
- [ ] 마크다운 → PDF 변환
- [ ] PlantUML 파일 트리 + SVG 미리보기 + 줌
- [ ] 서버 추가/수정/삭제
- [ ] PuTTY 세션 가져오기 (Windows)
- [ ] SSH 터미널 연결
- [ ] 서버 상태 조회 (CPU/MEM/DISK)
- [ ] Docker 컨테이너 목록/상태
- [ ] Docker 로그 스트리밍
- [ ] 컨테이너 트래킹 설정
- [ ] 대시보드 카드형 모니터링
- [ ] 대시보드 드래그 정렬
- [ ] 대시보드 필터링
- [ ] 이벤트 로그
- [ ] DB 연결 테스트
- [ ] 테이블 정의서 Excel 생성 + 프로그레스
- [ ] 데이터 사전 Excel 생성
- [ ] Java 프로젝트 분석
- [ ] 시퀀스 다이어그램 생성
- [ ] 무설치 배포 (.exe)
