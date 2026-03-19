# TODO-017: MdViewer/PumlViewer 트리 리사이즈 버그 -- 설계

> 파일 위치: /docs/design/todo-017-mdviewer-tree-resize-bug.design.md
> 대응 todo: /todo/todo-017-mdviewer-tree-resize-bug.md
> 생성일: 2026-02-27

## 개요

MdViewer와 PumlViewer 페이지에서 좌측 파일 트리와 콘텐츠 영역 사이의 세로 리사이즈 핸들(Separator)을 드래그해도 패널 크기가 조절되지 않는 버그를 수정한다. 동일한 ResizablePanelGroup 패턴을 사용하는 CallFlow 페이지는 정상 동작하므로, CallFlow와의 구조적 차이를 분석하여 근본 원인을 제거한다.

## 근본 원인 분석

### CallFlow와의 핵심 차이점 비교

CallFlow (정상 동작)와 MdViewer/PumlViewer (버그)의 좌측 패널 구조를 비교하면 두 가지 핵심 차이가 있다.

#### 차이 1: `transition: all`이 FileTree의 button 요소에 적용됨 (주요 원인)

`src/index.css` 108행의 글로벌 CSS 규칙:
```css
button, a, input, select, textarea, [role="tab"] {
  transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

이 규칙은 모든 `<button>` 요소에 `transition: all`을 적용한다.

- **FileTree** (`src/components/FileTree.tsx`): 트리 노드를 `<button>` 요소로 렌더링 (36행, 70행)
- **CallFlow의 TreeItem**: 트리 노드를 `<div onClick>` 요소로 렌더링 (146행)

`transition: all`은 width, height, padding, margin, flex 등 **모든 레이아웃 속성**의 변경을 150ms 동안 애니메이션한다. react-resizable-panels가 드래그 중에 패널의 `flex-grow` 값을 실시간으로 변경하면, FileTree 내부의 모든 button 요소의 computed width가 변경되고, 각 button에서 150ms 트랜지션이 트리거된다. 이로 인해:

1. 매 포인터 이동 프레임마다 수십 개의 button에서 width transition이 시작됨
2. 트랜지션이 실제 레이아웃 변경을 150ms 지연시킴
3. react-resizable-panels의 `getBoundingClientRect()` 기반 히트 테스트가 실제 DOM 크기와 불일치
4. 드래그 중 패널이 "고정"된 것처럼 보이거나 극도로 느리게 반응

CallFlow는 `<div>` 요소를 사용하므로 이 글로벌 규칙의 영향을 받지 않아 정상 동작한다.

#### 차이 2: FileTree의 ScrollArea 높이 계산 방식

- **FileTree**: `<ScrollArea className="h-full">` -- 부모의 height: 100%에 의존
- **CallFlow**: `<ScrollArea className="flex-1">` -- flex 컨텍스트에서 남은 공간을 차지

react-resizable-panels v4의 Panel 내부 구조:
```
Panel (data-panel) [overflow: hidden, display: flex, flexBasis: 0, flexShrink: 1]
  └─ 내부 래퍼 div [maxHeight: 100%, maxWidth: 100%, flexGrow: 1]
       └─ children (여기에 FileTree가 들어감)
```

Panel의 내부 래퍼 div에 `maxHeight: 100%`와 `flexGrow: 1`이 함께 적용된다. 이 컨텍스트에서 `height: 100%` (`h-full`)는 부모의 `maxHeight: 100%`를 참조하게 되어 높이 체인이 불안정할 수 있다. 반면 `flex: 1 1 0%` (`flex-1`)는 flex 컨텍스트에서 명확하게 남은 공간을 차지한다. 이것은 리사이즈 동작 자체를 차단하는 원인은 아니지만, 리사이즈 후 높이가 올바르게 재계산되지 않는 부수 효과를 유발할 수 있다.

### Radix ScrollArea의 `display: table` 콘텐츠 래퍼

Radix ScrollArea Viewport 내부에는 `display: table; minWidth: 100%` 스타일의 콘텐츠 래퍼 div가 존재한다 (라이브러리 소스 130행). `display: table`은 내부 콘텐츠의 intrinsic width를 유지하면서 수평 스크롤을 지원하기 위한 것이다. 리사이즈 중에 `transition: all`이 적용된 button들의 크기가 변경되면, table 레이아웃 재계산이 추가로 발생하여 성능 저하를 가중시킨다.

### 히트 영역은 원인이 아님

react-resizable-panels v4는 Group 레벨에서 `resizeTargetMinimumSize` prop (기본값: fine pointer 10px, coarse pointer 20px)으로 히트 영역을 자동 확장한다. Separator 요소의 시각적 크기(`w-px`, 1px)와 무관하게 최소 10px의 히트 영역이 보장된다. 또한 포인터 이벤트는 document 레벨 capture phase에서 처리되므로, 다른 요소가 이벤트를 가로채는 것도 아니다.

## 수정 대상 파일

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `src/index.css` | 수정 | 글로벌 `transition: all` 규칙을 레이아웃에 영향 없는 속성으로 제한 |
| `src/components/FileTree.tsx` | 수정 | ScrollArea의 높이 계산을 `h-full`에서 `flex-1` 패턴으로 변경 |
| `src/pages/MdViewer.tsx` | 수정 | `setLayout` useEffect 제거 (defaultSize와 중복) |
| `src/pages/PumlViewer.tsx` | 수정 | `setLayout` useEffect 제거 (defaultSize와 중복) |

## 상세 설계

### 1. 글로벌 `transition: all` 규칙 수정 (핵심 수정)

**파일**: `src/index.css`

`transition: all`을 시각적 속성(색상, 배경, 테두리, 투명도, 그림자)으로 제한한다. 이렇게 하면 width, height, padding, margin, flex 등 레이아웃 속성에는 트랜지션이 적용되지 않아 리사이즈 성능 문제를 해결한다.

**변경 전** (107-111행):
```css
/* Global interactive transition */
@layer base {
  button, a, input, select, textarea, [role="tab"] {
    transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
  }
}
```

**변경 후**:
```css
/* Global interactive transition — layout 속성 제외 (리사이즈 패널 호환) */
@layer base {
  button, a, input, select, textarea, [role="tab"] {
    transition: color, background-color, border-color, text-decoration-color,
                fill, stroke, opacity, box-shadow, outline-color
                150ms cubic-bezier(0.4, 0, 0.2, 1);
  }
}
```

이 변경은 기존의 hover/focus 시각 효과(색상 변경, 배경색 변경 등)를 그대로 유지하면서, 레이아웃 속성의 트랜지션만 제거한다. 이것은 shadcn/ui Button 컴포넌트에 이미 적용된 `transition-all` 클래스와도 공존하며, 더 구체적인 속성 목록이 `transition-all`보다 우선 적용된다.

**참고**: shadcn/ui의 `button.tsx`에도 `transition-all` 클래스가 있지만 (Tailwind CSS 4의 `transition-all`은 `transition-property: all`을 설정), index.css의 글로벌 규칙이 `@layer base`에 있고 Tailwind의 유틸리티 클래스가 더 높은 specificity를 가지므로, 개별 shadcn 컴포넌트는 자신의 transition 설정을 유지한다. 다만 FileTree의 `<button>` 요소는 shadcn Button이 아닌 일반 HTML `<button>`이므로 글로벌 규칙만 적용된다.

### 2. FileTree 컴포넌트 높이 계산 수정

**파일**: `src/components/FileTree.tsx`

ScrollArea의 높이 계산을 CallFlow 패턴과 동일하게 맞춘다. FileTree를 `flex` 컬럼 컨테이너로 감싸고, ScrollArea에 `flex-1`을 사용한다.

**변경 전** (85-111행):
```tsx
export default function FileTree({
  nodes,
  selectedPath,
  onSelect,
}: FileTreeProps) {
  return (
    <ScrollArea className="h-full">
      {nodes.length === 0 ? (
        <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
          파일이 없습니다
        </div>
      ) : (
        <div className="p-1">
          {nodes.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              depth={0}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </ScrollArea>
  );
}
```

**변경 후**:
```tsx
export default function FileTree({
  nodes,
  selectedPath,
  onSelect,
}: FileTreeProps) {
  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 min-h-0">
        {nodes.length === 0 ? (
          <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
            파일이 없습니다
          </div>
        ) : (
          <div className="p-1">
            {nodes.map((node) => (
              <TreeNode
                key={node.path}
                node={node}
                depth={0}
                selectedPath={selectedPath}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
```

변경 포인트:
- 외부 `<div className="flex h-full flex-col">`으로 감싸서 flex 컨텍스트 생성
- ScrollArea의 `h-full`을 `flex-1 min-h-0`으로 변경
- `min-h-0`은 flex 컨테이너 내에서 shrink가 올바르게 동작하도록 보장

이 패턴은 CallFlow 좌측 패널(377행: `<div className="flex h-full flex-col">`, 392행: `<ScrollArea className="flex-1">`)과 동일하다.

### 3. 불필요한 setLayout useEffect 제거

**파일**: `src/pages/MdViewer.tsx`

`defaultSize` prop과 동일한 값을 `setLayout`으로 다시 설정하는 것은 불필요하다. `requestAnimationFrame` 타이밍 이슈로 인한 초기 레이아웃 불안정을 제거한다.

**변경 전** (126-130행):
```tsx
useEffect(() => {
  requestAnimationFrame(() => {
    groupRef.current?.setLayout({ "md-tree": 25, "md-content": 75 });
  });
}, []);
```

**변경 후**: 해당 useEffect 블록 전체 삭제.

`groupRef`와 `useGroupRef` import도 더 이상 사용하지 않으므로 함께 제거한다.

**변경 전** (import, 12행):
```tsx
import { useGroupRef } from "react-resizable-panels";
```

**변경 후**: 해당 import 삭제.

**변경 전** (38행):
```tsx
const groupRef = useGroupRef();
```

**변경 후**: 해당 선언 삭제.

**변경 전** (165-166행):
```tsx
<ResizablePanelGroup
  groupRef={groupRef}
  orientation="horizontal"
  className="flex-1 min-h-0"
>
```

**변경 후**:
```tsx
<ResizablePanelGroup
  orientation="horizontal"
  className="flex-1 min-h-0"
>
```

---

**파일**: `src/pages/PumlViewer.tsx`

동일한 패턴으로 정리한다.

**변경 전** (134-138행):
```tsx
useEffect(() => {
  requestAnimationFrame(() => {
    groupRef.current?.setLayout({ "puml-tree": 22, "puml-preview": 78 });
  });
}, []);
```

**변경 후**: 해당 useEffect 블록 전체 삭제.

**변경 전** (import, 9행):
```tsx
import { useGroupRef } from "react-resizable-panels";
```

**변경 후**: 해당 import 삭제.

**변경 전** (43행):
```tsx
const groupRef = useGroupRef();
```

**변경 후**: 해당 선언 삭제.

**변경 전** (188행):
```tsx
<ResizablePanelGroup groupRef={groupRef} orientation="horizontal" className="flex-1 min-h-0">
```

**변경 후**:
```tsx
<ResizablePanelGroup orientation="horizontal" className="flex-1 min-h-0">
```

**참고**: CallFlow에서는 `groupRef`와 `setLayout` useEffect를 유지한다. CallFlow는 현재 정상 동작하며, 추후 프로그래밍적 레이아웃 변경이 필요할 수 있으므로 불필요하게 변경하지 않는다.

### 4. 수정 사항 요약

| 순서 | 파일 | 변경 내용 | 효과 |
|------|------|----------|------|
| 1 | `src/index.css` | `transition: all` -> 시각적 속성만 명시 | 리사이즈 중 layout thrashing 제거 (핵심) |
| 2 | `src/components/FileTree.tsx` | `<ScrollArea className="h-full">` -> flex 래퍼 + `flex-1 min-h-0` | 높이 계산 안정화, CallFlow 패턴 통일 |
| 3 | `src/pages/MdViewer.tsx` | `setLayout` useEffect + groupRef 제거 | 초기 레이아웃 타이밍 이슈 제거, 코드 정리 |
| 4 | `src/pages/PumlViewer.tsx` | `setLayout` useEffect + groupRef 제거 | 초기 레이아웃 타이밍 이슈 제거, 코드 정리 |

## 영향 범위

- **MdViewer**: 리사이즈 버그 수정, 레이아웃 동작 정상화
- **PumlViewer**: 리사이즈 버그 수정, 레이아웃 동작 정상화
- **CallFlow**: 변경 없음 (이미 정상 동작)
- **모든 페이지의 button/a/input 요소**: `transition: all`이 시각적 속성만으로 제한되므로, hover/focus 시 색상/배경/테두리 전환은 그대로 동작하지만 크기 변경 전환은 제거됨. 기존에 의도적으로 button 크기를 transition 시키는 곳은 없으므로 시각적 영향 없음.
- **shadcn/ui 컴포넌트**: shadcn의 Button, Input 등은 자체적으로 `transition-all` 또는 `transition-[color,box-shadow]` 등의 Tailwind 클래스를 가지고 있어 글로벌 규칙 변경의 영향을 받지 않음 (유틸리티 클래스가 `@layer base` 규칙보다 우선)

## 테스트 포인트

- [ ] **MdViewer 리사이즈**: 파일 트리 로드 상태에서 Separator를 좌우로 드래그하여 패널 크기가 실시간으로 변경되는지 확인
- [ ] **PumlViewer 리사이즈**: 동일하게 Separator 드래그 동작 확인
- [ ] **CallFlow 리사이즈**: 기존 정상 동작이 유지되는지 확인 (회귀 방지)
- [ ] **초기 레이아웃**: MdViewer/PumlViewer 탭 진입 시 좌측 트리 패널이 25%/22% 너비로 올바르게 표시되는지 확인
- [ ] **파일 트리 빈 상태**: 폴더 미선택 시 "파일이 없습니다" 메시지가 중앙 정렬되는지 확인
- [ ] **스크롤 동작**: 파일 트리에 많은 파일이 있을 때 세로 스크롤이 정상 동작하는지 확인
- [ ] **버튼 hover 효과**: 모든 페이지에서 버튼/링크의 hover/focus 시 색상/배경 전환 효과가 기존과 동일하게 동작하는지 확인
- [ ] **다크 모드**: 라이트/다크 모드 전환 시 transition 효과가 정상 동작하는지 확인
- [ ] **Separator 키보드 조작**: Separator에 포커스 후 좌/우 화살표 키로 패널 크기 조절이 동작하는지 확인
