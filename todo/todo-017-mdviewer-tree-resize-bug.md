# TODO-017: MdViewer/PumlViewer 트리 리사이즈 버그

> 생성일: 2026-02-26
> 상태: 완료

## 요청 요약
MdViewer와 PumlViewer에서 좌측 파일 트리와 콘텐츠 영역 사이의 세로 바(Separator)를 좌우로 드래그하여 패널 크기를 조절할 수 없는 버그 조사 및 수정.

## 버그 분석

### 현상
- MdViewer, PumlViewer 두 페이지에서 트리와 콘텐츠 영역 사이의 세로 바(Separator)를 좌우로 드래그해도 패널 크기 조절이 되지 않음
- CallFlow 페이지는 동일한 ResizablePanelGroup 패턴을 사용하지만 **정상 동작함**

### 관련 파일
- `src/pages/MdViewer.tsx` — ResizablePanelGroup 사용부
- `src/components/ui/resizable.tsx` — shadcn 래퍼 (Group, Panel, Separator)
- `src/components/FileTree.tsx` — 트리 컴포넌트 (ScrollArea 사용)
- `src/components/ui/scroll-area.tsx` — Radix ScrollArea 래퍼
- `src/index.css` — 글로벌 CSS (transition: all 규칙)

### 동일 패턴 사용 파일 (비교 대상)
- `src/pages/PumlViewer.tsx` — **동일 버그 발생**
- `src/pages/CallFlow.tsx` — **정상 동작** (리사이즈 됨) — **리사이즈 정상 동작 확인됨** (버그 없음)

### 잠재적 원인

#### 1. 글로벌 `transition: all` 규칙 (index.css:108)
```css
button, a, input, select, textarea, [role="tab"] {
  transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
}
```
- FileTree 내부의 모든 `<button>` 요소에 `transition: all`이 적용됨
- 드래그 중 패널 너비 변경 시 내부 요소들의 트랜지션 애니메이션이 리사이즈 성능에 영향 가능

#### 2. Separator 히트 영역 부족 (resizable.tsx)
- 핸들 기본 너비: `w-px` (1px)
- pseudo-element 히트 영역: `after:w-1` (4px)
- `withHandle` 그립 아이콘은 시각적 표시만 제공
- 라이브러리 자체 히트 영역은 `resizeTargetMinimumSize` prop으로 조절 가능 (현재 미설정)

#### 3. setLayout useEffect 타이밍 (MdViewer.tsx:127-130)
```tsx
useEffect(() => {
  requestAnimationFrame(() => {
    groupRef.current?.setLayout({ "md-tree": 25, "md-content": 75 });
  });
}, []);
```
- 마운트 시 한 번 실행되지만 requestAnimationFrame 타이밍이 초기 핸들러 등록과 충돌 가능성

#### 4. CSS 높이 계산 충돌 (resizable.tsx + MdViewer.tsx)
- shadcn 래퍼 기본: `h-full w-full` (height: 100%, width: 100%)
- MdViewer 추가: `flex-1 min-h-0` (flex: 1 1 0%, min-height: 0)
- flex column 컨테이너(TabPage) 안에서 `height: 100%`와 `flex: 1`이 동시 적용되어 높이 계산 혼란 가능

### 라이브러리 정보
- react-resizable-panels v4.6.5
- API: Group, Panel, Separator (v4에서 PanelResizeHandle → Separator로 변경)
- Group props: orientation, groupRef, resizeTargetMinimumSize, disabled 등

## 체크리스트
- [x] MdViewer.tsx 코드 분석
- [x] resizable.tsx (shadcn 래퍼) 확인
- [x] FileTree.tsx / ScrollArea 확인
- [x] 글로벌 CSS 영향 분석
- [x] PumlViewer/CallFlow 동일 패턴 비교
- [x] react-resizable-panels v4 API 확인
- [x] 다른 뷰어에서 동일 현상 확인 → PumlViewer: 버그 있음, CallFlow: 정상
- [x] 원인 확정 후 수정 구현
- [x] 수정 후 동작 검증

## 참고
- 우선순위: 중간
- CallFlow는 정상 → 전체 리사이즈 문제가 아니라 MdViewer/PumlViewer 고유 문제
- CallFlow와의 차이점을 비교 분석하여 원인 특정 필요
