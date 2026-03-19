# TODO-017: MdViewer/PumlViewer 트리 리사이즈 버그 -- 테스트 결과

> 대응 todo: /todo/todo-017-mdviewer-tree-resize-bug.md
> 설계 문서: /docs/design/todo-017-mdviewer-tree-resize-bug.design.md
> 테스트 일시: 2026-02-27
> 상태: 버그 미해결 -- 추가 분석 필요

## 자동 테스트 결과

| 테스트 | 명령어 | 결과 | 비고 |
|--------|--------|------|------|
| TypeScript 타입 체크 | `npx tsc -b --noEmit` | PASS | 오류 없음 |
| Vite 빌드 | `npm run build` | PASS | 29초, 빌드 성공 |
| Rust 빌드 | `cd src-tauri && cargo build` | SKIP | 이번 수정은 프론트엔드만 해당 |
| Rust 린트 | `cd src-tauri && cargo clippy` | SKIP | 이번 수정은 프론트엔드만 해당 |

빌드 및 타입 체크는 통과하지만, **실제 리사이즈 동작이 여전히 작동하지 않음** (수동 확인 결과).

---

## 현재 수정이 효과가 없었던 원인 분석

설계서에서 제시한 4가지 수정 사항을 모두 적용했으나 리사이즈가 여전히 동작하지 않는다. 아래에서 실제 코드를 기반으로 한 심층 분석과, 설계서가 놓친 추가 원인 후보를 도출한다.

### 분석 1: CSS `transition` 수정 -- 구문 오류 가능성 (높음)

**현재 코드** (`src/index.css` 108-112행):
```css
button, a, input, select, textarea, [role="tab"] {
  transition: color, background-color, border-color, text-decoration-color,
              fill, stroke, opacity, box-shadow, outline-color
              150ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

**문제**: CSS `transition` 단축 속성(shorthand)의 구문이 올바르지 않다. CSS 명세에 따르면 `transition` 단축 속성은 쉼표로 **개별 transition 선언 전체**를 구분한다. 즉 각 속성별로 duration과 timing function을 반복해야 한다:

```
transition: <property> <duration> <timing>, <property> <duration> <timing>, ...
```

현재 코드는 속성 이름만 쉼표로 나열하고 마지막에만 `150ms cubic-bezier(...)`를 붙였다. 브라우저는 이를 다음 중 하나로 해석한다:
- **전체 선언 무효** (transition 규칙이 적용되지 않음)
- 마지막 `outline-color`에만 `150ms` 적용, 나머지는 기본값 `0s`

어느 경우든 **기존 `transition: all`과 동일한 문제가 제거되었을 수 있으나**, 이것이 리사이즈 버그의 근본 원인이 아니었다는 것을 의미한다.

**올바른 구문으:
```css
button, a, input, select, textarea, [role="tab"] {
  transition-property: color, background-color, border-color, text-decoration-color,
                       fill, stroke, opacity, box-shadow, outline-color;
  transition-duration: 150ms;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}
```
또는:
```css
button, a, input, select, textarea, [role="tab"] {
  transition: color 150ms cubic-bezier(0.4, 0, 0.2, 1),
              background-color 150ms cubic-bezier(0.4, 0, 0.2, 1),
              border-color 150ms cubic-bezier(0.4, 0, 0.2, 1),
              /* ... 각 속성별 반복 ... */;
}
```

### 분석 2: `transition: all`은 근본 원인이 아닌 악화 요인이었을 가능성 (높음)

설계서의 가설은 FileTree의 `<button>` 요소에 `transition: all`이 적용되어 드래그 중 레이아웃 지연이 발생한다는 것이었다. 그러나:

- react-resizable-panels v4는 패널의 `flex-grow` 값을 변경하여 리사이즈를 수행한다.
- Panel 자체에 `overflow: hidden`이 설정되어 있으므로 (라이브러리 소스 1867행), 내부 요소의 크기 변경 트랜지션이 Panel 바깥으로 영향을 줄 수 없다.
- `transition: all`은 리사이즈 성능을 **저하**시킬 수 있으나, 리사이즈 자체를 **완전히 차단**하지는 않는다.
- 실제로 `transition: all`을 제거(또는 무효한 구문으로 변경)한 후에도 리사이즈가 동작하지 않으므로, 이것은 근본 원인이 아니다.

### 분석 3: CallFlow vs MdViewer/PumlViewer -- 아직 분석되지 않은 차이점 (핵심)

실제 코드를 비교한 결과, 설계서에서 다루지 않은 중요한 구조적 차이점이 있다.

#### 차이점 A: `TabsContent`의 `display: flex` 조건부 적용

`src/components/ui/tabs.tsx` 83행:
```tsx
className={cn(
  "flex-1 flex-col min-h-0 w-full outline-none data-[state=active]:flex data-[state=inactive]:hidden",
  className
)}
```

`TabsContent`는 `data-[state=active]:flex data-[state=inactive]:hidden`으로, **활성 탭일 때만 `display: flex`가 적용**된다. 비활성일 때는 `display: hidden`이다. 이것은 `flex-1`과 `flex-col`이 정상 동작하기 위한 전제 조건이다.

그러나 `App.tsx` 159행에서:
```tsx
{visibleTabs.map((tab) => {
  if (tab.id !== activeTab) return null;  // <-- 비활성 탭은 아예 렌더링 안함
  ...
})}
```

비활성 탭은 렌더링 자체가 안되므로 `data-[state=inactive]:hidden`은 실제로는 관련 없다. 활성 탭은 항상 `display: flex`를 받는다.

이 부분은 정상이므로 문제의 원인이 아니다.

#### 차이점 B: CallFlow에는 있고 MdViewer/PumlViewer에는 없는 `groupRef` (잠재적 원인)

**CallFlow** (374행):
```tsx
<ResizablePanelGroup groupRef={groupRef} orientation="horizontal" ...>
```

**MdViewer** (수정 후, 158행):
```tsx
<ResizablePanelGroup orientation="horizontal" ...>
```

설계서에서는 `setLayout` useEffect가 `defaultSize`와 중복이므로 `groupRef`와 함께 제거했다. 그러나 CallFlow는 동일한 `setLayout` useEffect를 가지면서도 정상 동작한다. **`groupRef` 자체가 초기 레이아웃 설정에 필요한 역할을 하는 것은 아닌지 확인이 필요하다.**

react-resizable-panels v4의 소스에서 `groupRef`는 `useGroupRef()` 훅으로 생성되며, Group 컴포넌트에 전달되면 내부 상태 참조를 설정한다. `groupRef`가 없어도 `defaultSize` prop이 있으면 초기 레이아웃이 설정되어야 하지만, 라이브러리 버그나 타이밍 이슈로 `groupRef` 없이는 초기화가 올바르게 되지 않을 가능성이 있다.

#### 차이점 C: Radix ScrollArea의 `display: table` 래퍼와 Panel `overflow: hidden`의 조합

react-resizable-panels의 Panel 내부 구조 (라이브러리 소스 1861-1886행):
```
Panel (data-panel) [display: flex, flexBasis: 0, flexShrink: 1, overflow: hidden]
  +-- 내부 래퍼 div [maxHeight: 100%, maxWidth: 100%, flexGrow: 1]
       +-- children (className 적용) [사용자 코드가 여기에 들어감]
```

FileTree의 구조 (수정 후):
```
Panel
  +-- 내부 래퍼 div [maxHeight: 100%, maxWidth: 100%, flexGrow: 1]
       +-- div.flex.h-full.flex-col      <-- FileTree 외부 래퍼
            +-- ScrollArea (relative)     <-- Radix Root
                 +-- Viewport [overflow: scroll/hidden, width: 100%, height: 100%]
                      +-- div [display: table, minWidth: 100%]  <-- Radix 내부 콘텐츠 래퍼
                           +-- button 요소들...
```

CallFlow의 구조:
```
Panel
  +-- 내부 래퍼 div [maxHeight: 100%, maxWidth: 100%, flexGrow: 1]
       +-- div.flex.h-full.flex-col
            +-- (optional) 검색 필터 div
            +-- ScrollArea.flex-1
                 +-- Viewport [overflow: scroll/hidden]
                      +-- div [display: table, minWidth: 100%]
                           +-- div 요소들 (onClick)...
```

두 구조는 FileTree 래퍼를 추가한 후 거의 동일해졌다. **그러나 핵심 차이점은 CallFlow의 `ScrollArea`에는 `min-h-0`이 없다는 것이다.** CallFlow 392행: `<ScrollArea className="flex-1">` vs FileTree 92행: `<ScrollArea className="flex-1 min-h-0">`. 이것이 차이를 만드는지 확인이 필요하다 (보통 `min-h-0`은 flex 컨테이너에서 올바른 shrink를 위해 필요하므로 있는 것이 맞지만).

#### 차이점 D: Panel의 `maxSize` prop 유무

**CallFlow** (376행): `<ResizablePanel id="cf-tree" defaultSize={25} minSize={15}>`  -- **maxSize 없음**
**MdViewer** (162행): `<ResizablePanel id="md-tree" defaultSize={25} minSize={15} maxSize={40}>`
**PumlViewer** (182행): `<ResizablePanel id="puml-tree" defaultSize={22} minSize={15} maxSize={40}>`

`maxSize={40}` 제약이 리사이즈 핸들 동작에 영향을 줄 가능성은 낮지만, 라이브러리의 내부 검증 로직과 상호작용할 수 있다.

#### 차이점 E: ResizablePanelGroup의 className 적용 방식

`src/components/ui/resizable.tsx` 7-21행에서 `ResizablePanelGroup` 래퍼는 기본적으로 `flex h-full w-full`을 적용하고, 여기에 사용자의 `className`을 추가한다:

```tsx
className={cn(
  "flex h-full w-full aria-[orientation=vertical]:flex-col",
  className  // "flex-1 min-h-0"
)}
```

결과: `flex h-full w-full flex-1 min-h-0`

여기서 `h-full` (height: 100%)과 `flex-1` (flex: 1 1 0%)이 동시에 적용된다. 이 조합은 다음을 의미한다:
- `height: 100%` -- 부모 높이의 100%
- `flex: 1 1 0%` -- flex 아이템으로서 남은 공간 차지 (flexBasis: 0)

react-resizable-panels의 Group 컴포넌트가 자체적으로 `height: 100%, width: 100%`를 inline style로 설정한다 (소스 1663-1664행). Tailwind의 `h-full`은 className으로 적용되므로, **inline style이 우선**한다. 따라서 shadcn 래퍼의 `h-full w-full`은 실제로는 무시되고 라이브러리의 inline style이 적용된다.

문제는 라이브러리의 `height: 100%`가 부모(`TabPage`의 children 영역)에서 명시적 height를 필요로 한다는 것이다. `TabPage`는 `flex-1 min-h-0`을 가진 flex 컨테이너인데, 그 children은 flex 아이템이 아닌 일반 자식이다. **`ResizablePanelGroup`은 `TabPage`의 직접 자식으로서 `flex-1 min-h-0` className을 받지만, 동시에 라이브러리가 inline으로 `height: 100%`를 설정한다.** 이 두 값의 우선순위 충돌이 있을 수 있다.

그러나 CallFlow도 동일한 구조이므로 (`<ResizablePanelGroup ... className="flex-1 min-h-0">`), 이것만으로는 차이를 설명할 수 없다.

### 분석 4: 가장 유력한 추가 원인 후보 정리

| 순위 | 후보 | 근거 | 검증 방법 |
|------|------|------|----------|
| 1 | CSS transition 구문 오류로 hover 효과 손실 (부수 효과, 근본 원인 아님) | transition shorthand 구문이 잘못되어 적용 안 됨 | DevTools에서 computed transition 확인 |
| 2 | `groupRef` 제거가 초기 레이아웃 설정에 영향 | CallFlow는 groupRef 유지 + 정상 동작 | groupRef 복원 후 테스트 |
| 3 | Separator의 pointer event 처리와 다른 요소 간섭 | z-index나 다른 요소가 Separator 위를 가리는 경우 | DevTools로 Separator의 실제 히트 영역 확인 |
| 4 | FileTree의 `<button>` 요소가 Separator의 포인터 이벤트 전파를 방해 | `<button>`의 기본 user-agent stylesheet가 영향 | FileTree를 `<div onClick>`으로 변경하여 테스트 |
| 5 | react-resizable-panels의 내부 상태 초기화 타이밍 이슈 | lazy loading + Suspense와의 상호작용 | 직접 import로 변경하여 테스트 |

---

## 수동 테스트 케이스

### TC-017-01: MdViewer 리사이즈 기본 동작

- **전제 조건**: 마크다운 파일이 있는 폴더가 존재, MdViewer 탭 활성화, 좌측 트리에 파일 목록 표시됨
- **실행 단계**:
  1. MdViewer 탭으로 이동
  2. 폴더를 선택하여 파일 트리 로드
  3. 좌측 패널과 우측 패널 사이의 세로 구분선(Separator, 그립 아이콘 있음)에 마우스를 올림
  4. 마우스 커서가 `col-resize` (좌우 화살표)로 변경되는지 확인
  5. 구분선을 클릭하고 좌우로 드래그
- **기대 결과**: 드래그에 따라 좌측 패널과 우측 패널의 너비가 실시간으로 변경됨. 최소 15%, 최대 40% 범위 내에서 조절 가능.
- **실행 결과**: FAIL -- 리사이즈가 동작하지 않음
- **비고**: 커서 변경 여부도 함께 확인 필요. 커서가 변경되지 않는다면 Separator가 아예 인식되지 않는 것.

### TC-017-02: PumlViewer 리사이즈 기본 동작

- **전제 조건**: PlantUML 파일이 있는 폴더 존재, PumlViewer 탭 활성화
- **실행 단계**: TC-017-01과 동일하게 PumlViewer에서 수행
- **기대 결과**: 드래그에 따라 패널 크기 조절 가능
- **실행 결과**: FAIL -- 리사이즈가 동작하지 않음
- **비고**: MdViewer와 동일한 FileTree 컴포넌트 사용

### TC-017-03: CallFlow 리사이즈 정상 동작 확인 (회귀 방지)

- **전제 조건**: CallFlow 탭 활성화, Java 프로젝트 분석 완료 상태
- **실행 단계**:
  1. CallFlow 탭으로 이동
  2. 프로젝트 분석 수행
  3. 좌측 트리 패널과 우측 다이어그램 패널 사이의 Separator를 드래그
- **기대 결과**: 패널 크기가 정상적으로 조절됨
- **실행 결과**: PASS (기존부터 정상)
- **비고**: 이 수정으로 인한 회귀 없음 확인

### TC-017-04: Separator 커서 변경 확인

- **전제 조건**: MdViewer 탭 활성화, 파일 트리 로드됨
- **실행 단계**:
  1. Separator(그립 아이콘이 있는 세로 바) 위에 마우스를 올림
  2. DevTools에서 해당 요소를 선택하고 `data-separator` 속성 값 확인
  3. computed style에서 `cursor` 값 확인
- **기대 결과**: `data-separator="active"`, cursor가 `col-resize`
- **실행 결과**: NOT_TESTED (DevTools 확인 필요)
- **비고**: `data-separator="disabled"`이면 Separator가 비활성화된 상태

### TC-017-05: DevTools로 Separator 히트 영역 확인

- **전제 조건**: MdViewer 탭 활성화
- **실행 단계**:
  1. DevTools 열기 (F12)
  2. Elements 패널에서 `[data-separator]` 요소 찾기
  3. 해당 요소의 box model (margin, border, padding, content) 확인
  4. `::after` pseudo-element의 크기 확인 (히트 영역)
  5. z-index 스태킹 컨텍스트에서 다른 요소에 가려지는지 확인
- **기대 결과**: Separator가 시각적으로 보이고, pseudo-element가 최소 4px 너비를 가지며, 다른 요소에 가려지지 않음
- **실행 결과**: NOT_TESTED
- **비고**: 가려지는 요소가 있다면 z-index 조정 필요

### TC-017-06: CSS transition 속성 실제 적용 확인

- **전제 조건**: MdViewer 탭 활성화
- **실행 단계**:
  1. DevTools에서 FileTree 내부의 `<button>` 요소 선택
  2. Computed 탭에서 `transition` 관련 속성 확인
  3. `transition-property`, `transition-duration`, `transition-timing-function` 각각의 computed value 확인
- **기대 결과**: `transition-property`에 `all`이 포함되지 않아야 함. 시각적 속성(color, background-color 등)만 포함되어야 함.
- **실행 결과**: NOT_TESTED
- **비고**: 현재 CSS shorthand 구문 오류로 인해 transition이 아예 적용되지 않을 수 있음. `transition-property`가 비어있거나 invalid로 표시되면 구문 수정이 필요함.

### TC-017-07: groupRef 복원 테스트

- **전제 조건**: MdViewer.tsx에서 `groupRef`와 `useGroupRef` 관련 코드를 원복
- **실행 단계**:
  1. `src/pages/MdViewer.tsx`에 아래 코드 복원:
     - `import { useGroupRef } from "react-resizable-panels";`
     - `const groupRef = useGroupRef();`
     - `<ResizablePanelGroup groupRef={groupRef} ...>`
     - (setLayout useEffect는 복원하지 않음)
  2. `npm run dev`로 실행
  3. MdViewer에서 리사이즈 시도
- **기대 결과**: groupRef만으로 리사이즈가 복원되는지 확인
- **실행 결과**: NOT_TESTED
- **비고**: CallFlow는 groupRef를 사용하며 정상 동작. groupRef가 리사이즈 동작의 필수 요소인지 판별하는 테스트.

### TC-017-08: FileTree를 div로 변경하는 테스트

- **전제 조건**: FileTree.tsx의 `<button>` 요소를 `<div role="button" tabIndex={0}>`으로 임시 변경
- **실행 단계**:
  1. `src/components/FileTree.tsx`에서 36행과 70행의 `<button>`을 `<div role="button" tabIndex={0}>`으로 변경
  2. 닫는 태그도 `</div>`로 변경
  3. `npm run dev`로 실행
  4. MdViewer에서 리사이즈 시도
- **기대 결과**: `<div>` 변경만으로 리사이즈가 복원된다면 `<button>`의 user-agent stylesheet가 원인
- **실행 결과**: NOT_TESTED
- **비고**: CallFlow의 TreeItem이 `<div>`를 사용하는 것과의 일관성 확인

### TC-017-09: 패널 초기 레이아웃 확인

- **전제 조건**: MdViewer 탭으로 처음 진입
- **실행 단계**:
  1. 앱을 새로 시작
  2. MdViewer 탭 클릭
  3. DevTools에서 좌측 패널 요소의 `flex-grow` inline style 값 확인
  4. 패널 너비가 시각적으로 약 25%인지 확인
- **기대 결과**: `flex-grow` 값이 설정되어 있고, 시각적 너비가 약 25%
- **실행 결과**: NOT_TESTED
- **비고**: `defaultSize` prop이 올바르게 적용되었는지 확인. flex-grow가 0이면 초기화 실패.

### TC-017-10: Separator 키보드 조작

- **전제 조건**: MdViewer 탭 활성화
- **실행 단계**:
  1. Tab 키로 Separator에 포커스 (focus ring 표시 확인)
  2. 좌/우 화살표 키 입력
- **기대 결과**: 화살표 키에 따라 패널 크기가 조절됨
- **실행 결과**: NOT_TESTED
- **비고**: 마우스 드래그가 안 되는 상황에서 키보드 조작이 되는지 여부로 문제 범위를 좁힐 수 있음. 키보드는 되고 마우스는 안 된다면 pointer event 문제, 둘 다 안 된다면 Panel/Group 초기화 문제.

### TC-017-11: 빈 트리 상태에서 리사이즈

- **전제 조건**: MdViewer 탭 활성화, 폴더 미선택 (트리 비어있음)
- **실행 단계**:
  1. 폴더를 선택하지 않은 상태에서 Separator 드래그
- **기대 결과**: 빈 상태에서도 패널 크기 조절 가능
- **실행 결과**: NOT_TESTED
- **비고**: 파일 트리 콘텐츠 유무에 따라 동작이 달라지면 콘텐츠의 intrinsic size 문제

### TC-017-12: Lazy Loading 제거 테스트

- **전제 조건**: App.tsx에서 MdViewer의 `React.lazy()` 제거
- **실행 단계**:
  1. `src/App.tsx`에서 `const MdViewer = lazy(() => import("@/pages/MdViewer"));`를 `import MdViewer from "@/pages/MdViewer";`로 변경
  2. `npm run dev`로 실행
  3. MdViewer에서 리사이즈 시도
- **기대 결과**: lazy loading과 Suspense의 마운트 타이밍이 원인인지 판별
- **실행 결과**: NOT_TESTED
- **비고**: lazy loading은 Suspense 경계에서 컴포넌트를 늦게 마운트하므로 ResizablePanelGroup의 초기화에 영향을 줄 수 있음

---

## CallFlow vs MdViewer/PumlViewer 상세 비교표

| 비교 항목 | CallFlow (정상) | MdViewer (버그) | PumlViewer (버그) |
|-----------|----------------|-----------------|-------------------|
| 트리 노드 HTML 요소 | `<div onClick>` | `<button onClick>` | `<button onClick>` |
| groupRef 사용 | O (useGroupRef) | X (제거됨) | X (제거됨) |
| setLayout useEffect | O (유지) | X (제거됨) | X (제거됨) |
| Panel maxSize | 없음 | 40 | 40 |
| 좌측 패널 직접 자식 | `<div className="flex h-full flex-col">` | `<FileTree>` (내부에 flex wrapper) | `<FileTree>` (내부에 flex wrapper) |
| ScrollArea className | `flex-1` | `flex-1 min-h-0` | `flex-1 min-h-0` (FileTree 내부) |
| 트리 상단 검색 필터 | O (Input) | X | X |
| 파일 확장 필터 | X (전체 트리) | O (md/markdown) | O (puml 등) |
| react-resizable-panels import | Group, Panel, Separator + useGroupRef | Group, Panel, Separator | Group, Panel, Separator |

---

## 디버깅 방법 제안

### 방법 1: DevTools Console에서 react-resizable-panels 상태 확인

```javascript
// Group 요소 찾기
const group = document.querySelector('[data-group]');
console.log('Group:', group);
console.log('Group style:', group?.style.cssText);

// Panel 요소들 찾기
const panels = document.querySelectorAll('[data-panel]');
panels.forEach(p => {
  console.log('Panel:', p.id, 'flex-grow:', p.style.flexGrow);
});

// Separator 요소 찾기
const separators = document.querySelectorAll('[data-separator]');
separators.forEach(s => {
  console.log('Separator:', s.getAttribute('data-separator'),
              'cursor:', getComputedStyle(s).cursor);
});
```

### 방법 2: Pointer Event 추적

Separator 요소에 이벤트 리스너를 추가하여 포인터 이벤트가 도달하는지 확인:

```javascript
const sep = document.querySelector('[data-separator]');
['pointerdown', 'pointermove', 'pointerup', 'mousedown', 'mousemove', 'mouseup'].forEach(evt => {
  sep.addEventListener(evt, e => console.log(evt, e.clientX, e.clientY), true);
});
```

이벤트가 전혀 로그되지 않으면 다른 요소가 Separator를 가리고 있는 것이다.

### 방법 3: react-resizable-panels 내부 디버그 로그

`node_modules/react-resizable-panels/dist/react-resizable-panels.js`에서 Separator의 pointerdown 핸들러를 찾아 console.log를 추가:

```javascript
// Separator 컴포넌트에서 data-separator 속성이 설정되는 부분 근처에서
// 'active', 'hover' 등의 상태 변경을 추적
```

### 방법 4: 최소 재현 케이스 작성

MdViewer의 전체 코드를 간소화하여 최소 재현 케이스를 만든다:

```tsx
// src/pages/TestResize.tsx
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

export default function TestResize() {
  return (
    <div style={{ height: "400px", width: "100%" }}>
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel id="left" defaultSize={25}>
          <div>Left</div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel id="right" defaultSize={75}>
          <div>Right</div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
```

이 최소 케이스가 동작하면 점진적으로 FileTree, ScrollArea, TabPage 래퍼 등을 추가하여 어느 단계에서 리사이즈가 깨지는지 확인한다.

### 방법 5: CSS transition 유효성 확인

DevTools에서 FileTree 내부 `<button>` 요소를 선택한 후:
1. Styles 패널에서 `index.css`의 transition 규칙 확인
2. 속성 옆에 경고 아이콘이나 취소선이 있는지 확인 (무효한 CSS)
3. Computed 패널에서 `transition-property` 값 확인

---

## 실행 불가 항목

| 항목 | 사유 | 수동 대체 절차 |
|------|------|---------------|
| UI 리사이즈 동작 테스트 | Tauri GUI 앱으로 CLI 환경에서 실행 불가 | `npm run tauri dev`로 앱 실행 후 수동 확인 |
| DevTools CSS 확인 | 브라우저 DevTools 접근 필요 | 앱 실행 후 F12로 DevTools 열어서 확인 |
| Pointer event 추적 | 런타임 이벤트 디버깅 필요 | DevTools Console에서 스크립트 실행 |

---

## 회귀 테스트

- [ ] CallFlow 페이지 리사이즈가 기존과 동일하게 정상 동작
- [ ] 모든 페이지의 버튼 hover 효과가 정상 동작 (색상/배경 전환)
- [ ] 탭 전환 시 탭 라벨의 hover/active 전환 효과가 정상
- [ ] 다크 모드 전환 시 모든 UI 요소의 색상 전환이 정상
- [ ] DbDoc 페이지 등 다른 ResizablePanelGroup 사용 페이지가 정상 동작하는지 확인

---

## 추가 수정 권장 사항

### 1. CSS transition 구문 수정 (즉시)

현재 `transition` shorthand가 구문 오류를 포함하고 있으므로, `transition-property` / `transition-duration` / `transition-timing-function` 개별 속성으로 분리하여 수정:

**파일**: `src/index.css` 106-113행

**수정 전**:
```css
button, a, input, select, textarea, [role="tab"] {
  transition: color, background-color, border-color, text-decoration-color,
              fill, stroke, opacity, box-shadow, outline-color
              150ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

**수정 후**:
```css
button, a, input, select, textarea, [role="tab"] {
  transition-property: color, background-color, border-color, text-decoration-color,
                       fill, stroke, opacity, box-shadow, outline-color;
  transition-duration: 150ms;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}
```

### 2. 리사이즈 근본 원인 추가 조사 (우선)

위 TC-017-07 (groupRef 복원) 테스트를 최우선으로 수행할 것을 권장한다. 이유:
- CallFlow와의 가장 큰 코드 차이점이 `groupRef` 유무임
- 설계서에서는 `defaultSize`와 중복이라 제거했으나, `groupRef`가 라이브러리 내부에서 리사이즈 상태 관리에 사용될 가능성이 있음
- 복원이 간단하여 빠르게 검증 가능

만약 groupRef 복원으로도 해결되지 않으면, TC-017-08 (button -> div 변경), TC-017-12 (lazy loading 제거) 순으로 검증한다.

### 3. 최소 재현 케이스 우선 작성 (권장)

디버깅 방법 4에서 제안한 최소 재현 케이스를 먼저 작성하여 ResizablePanelGroup 자체가 TabPage/TabsContent 레이아웃 안에서 정상 동작하는지 확인한다. 최소 케이스가 동작한다면 FileTree, ScrollArea 등을 하나씩 추가하며 정확한 원인을 격리할 수 있다.
