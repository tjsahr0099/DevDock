# TODO-018: MdViewer 슬라이드 뷰 모드 추가 -- 설계

> 파일 위치: /docs/design/todo-018-md-to-slide-view.design.md
> 대응 todo: /todo/todo-018-md-to-slide-view.md
> 생성일: 2026-02-27

## 개요

MdViewer 페이지에 "슬라이드 뷰" 모드를 추가하여, 마크다운 문서를 PPT 스타일의 프레젠테이션 슬라이드로 표시한다. 마크다운 내용을 구분자(`---`, `## ` 헤딩)를 기준으로 슬라이드 단위로 분할하고, 한 장씩 탐색하는 UI와 전체화면 프레젠테이션 모드, 슬라이드 목차/썸네일 사이드바를 제공한다.

## 수정 대상 파일

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `src/pages/MdViewer.tsx` | 수정 | 슬라이드 뷰 모드 전환 토글 UI 추가, SlideView 컴포넌트 연동 |
| `src/lib/parseSlides.ts` | 신규 | 마크다운 텍스트를 슬라이드 단위로 분할하는 파서 유틸리티 |
| `src/components/SlideView.tsx` | 신규 | 슬라이드 뷰 메인 컴포넌트 (슬라이드 렌더링, 네비게이션, 전체화면) |
| `src/components/SlideThumbnailSidebar.tsx` | 신규 | 슬라이드 목차/썸네일 사이드바 컴포넌트 |
| `src/index.css` | 수정 | 슬라이드 프레젠테이션 스타일링 추가 (일반 + 전체화면 모드) |

## 상세 설계

### 1. 마크다운 슬라이드 파서 (`src/lib/parseSlides.ts`)

마크다운 텍스트를 슬라이드 배열로 분할하는 순수 함수를 구현한다. 백엔드 변경 없이 프론트엔드에서 처리한다.

#### 분할 규칙

1. **수평선 구분자 (`---`)**: 가장 높은 우선순위. 줄 단위로 `---`만 있는 행(앞뒤 공백 허용)을 기준으로 분할한다. YAML frontmatter(`---`로 시작하고 `---`로 끝나는 문서 헤더)는 구분자로 취급하지 않고 첫 번째 슬라이드에 포함시키거나 제거한다.
2. **H2 헤딩 (`## `)**: `---` 구분자가 문서 내에 하나도 없을 경우, `## ` 헤딩을 슬라이드 분할 기준으로 사용한다. 각 `## ` 헤딩이 새 슬라이드의 시작점이 된다.
3. **구분자 없음**: `---`도 `## `도 없으면 전체 내용을 하나의 슬라이드로 취급한다.

#### 데이터 타입

```typescript
// src/lib/parseSlides.ts

export interface Slide {
  /** 0-based 슬라이드 인덱스 */
  index: number;
  /** 슬라이드 제목 (첫 번째 헤딩에서 추출, 없으면 "슬라이드 N") */
  title: string;
  /** 슬라이드의 마크다운 원문 */
  content: string;
}

/**
 * 마크다운 텍스트를 슬라이드 배열로 분할한다.
 *
 * 분할 우선순위:
 * 1. `---` 수평선 구분자가 있으면 이를 기준으로 분할
 * 2. `---`가 없고 `## ` 헤딩이 있으면 H2를 기준으로 분할
 * 3. 둘 다 없으면 전체를 하나의 슬라이드로 반환
 */
export function parseSlides(markdown: string): Slide[] {
  // 구현
}
```

#### 파서 구현 상세

```typescript
// src/lib/parseSlides.ts

export interface Slide {
  index: number;
  title: string;
  content: string;
}

/**
 * 마크다운 첫 번째 헤딩(#, ##, ### 등)에서 제목 텍스트를 추출한다.
 * 헤딩이 없으면 null을 반환한다.
 */
function extractTitle(content: string): string | null {
  const match = content.match(/^#{1,6}\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

/**
 * YAML frontmatter를 제거한다.
 * 문서 시작이 ---로 시작하고 이후 ---로 닫히는 블록을 제거.
 */
function stripFrontmatter(markdown: string): string {
  const trimmed = markdown.trimStart();
  if (!trimmed.startsWith("---")) return markdown;

  // 첫 번째 --- 이후 다음 --- 찾기
  const endIndex = trimmed.indexOf("\n---", 3);
  if (endIndex === -1) return markdown;

  // 닫는 --- 다음 줄부터 반환
  const afterFrontmatter = trimmed.substring(endIndex + 4);
  return afterFrontmatter;
}

/**
 * --- 수평선이 실제 구분자로 사용되었는지 확인한다.
 * frontmatter 이후의 본문에서 단독 --- 행이 있는지 검사.
 */
function hasHorizontalRuleSeparators(content: string): boolean {
  const lines = content.split("\n");
  for (const line of lines) {
    if (/^\s*---\s*$/.test(line)) {
      return true;
    }
  }
  return false;
}

/**
 * --- 구분자를 기준으로 분할한다.
 */
function splitByHorizontalRule(content: string): string[] {
  const parts: string[] = [];
  const lines = content.split("\n");
  let current: string[] = [];

  for (const line of lines) {
    if (/^\s*---\s*$/.test(line)) {
      parts.push(current.join("\n"));
      current = [];
    } else {
      current.push(line);
    }
  }

  // 마지막 파트 추가
  if (current.length > 0) {
    parts.push(current.join("\n"));
  }

  return parts;
}

/**
 * ## 헤딩을 기준으로 분할한다.
 * 첫 번째 ## 이전의 내용이 있으면 첫 슬라이드로 포함한다.
 */
function splitByH2(content: string): string[] {
  const parts: string[] = [];
  const lines = content.split("\n");
  let current: string[] = [];

  for (const line of lines) {
    if (/^##\s+/.test(line) && current.length > 0) {
      parts.push(current.join("\n"));
      current = [line];
    } else {
      current.push(line);
    }
  }

  if (current.length > 0) {
    parts.push(current.join("\n"));
  }

  return parts;
}

export function parseSlides(markdown: string): Slide[] {
  const cleaned = stripFrontmatter(markdown);

  let rawParts: string[];

  if (hasHorizontalRuleSeparators(cleaned)) {
    rawParts = splitByHorizontalRule(cleaned);
  } else {
    rawParts = splitByH2(cleaned);
  }

  // 빈 슬라이드 필터링 (공백만 있는 파트 제거)
  const nonEmpty = rawParts
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  // 하나도 없으면 전체를 하나의 슬라이드로
  if (nonEmpty.length === 0) {
    return [{ index: 0, title: "슬라이드 1", content: cleaned.trim() }];
  }

  return nonEmpty.map((content, index) => ({
    index,
    title: extractTitle(content) ?? `슬라이드 ${index + 1}`,
    content,
  }));
}
```

---

### 2. 슬라이드 뷰 컴포넌트 (`src/components/SlideView.tsx`)

슬라이드 한 장을 렌더링하고, 이전/다음 네비게이션, 전체화면 전환 기능을 제공하는 핵심 컴포넌트이다.

#### 컴포넌트 Props 인터페이스

```typescript
// src/components/SlideView.tsx

import type { Slide } from "@/lib/parseSlides";

interface SlideViewProps {
  slides: Slide[];
  fileName: string;
}
```

#### 내부 상태

```typescript
const [currentIndex, setCurrentIndex] = useState(0);
const [isFullscreen, setIsFullscreen] = useState(false);
const [showSidebar, setShowSidebar] = useState(true);
const containerRef = useRef<HTMLDivElement>(null);
```

#### 전체 컴포넌트 구현

```typescript
// src/components/SlideView.tsx

import { useState, useRef, useCallback, useEffect } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import SlideThumbnailSidebar from "@/components/SlideThumbnailSidebar";
import type { Slide } from "@/lib/parseSlides";

interface SlideViewProps {
  slides: Slide[];
  fileName: string;
}

export default function SlideView({ slides, fileName }: SlideViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalSlides = slides.length;
  const currentSlide = slides[currentIndex];

  // slides가 변경되면 (다른 파일 선택) 인덱스 리셋
  useEffect(() => {
    setCurrentIndex(0);
  }, [slides]);

  // --- 네비게이션 ---

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => Math.min(totalSlides - 1, prev + 1));
  }, [totalSlides]);

  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  // --- 키보드 네비게이션 ---

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 입력 요소에 포커스가 있으면 무시
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      switch (e.key) {
        case "ArrowLeft":
        case "ArrowUp":
          e.preventDefault();
          goToPrev();
          break;
        case "ArrowRight":
        case "ArrowDown":
        case " ": // 스페이스바
          e.preventDefault();
          goToNext();
          break;
        case "Home":
          e.preventDefault();
          setCurrentIndex(0);
          break;
        case "End":
          e.preventDefault();
          setCurrentIndex(totalSlides - 1);
          break;
        case "Escape":
          if (isFullscreen) {
            e.preventDefault();
            exitFullscreen();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToPrev, goToNext, totalSlides, isFullscreen]);

  // --- 전체화면 ---

  const enterFullscreen = useCallback(async () => {
    if (containerRef.current) {
      try {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } catch {
        // Fullscreen API 미지원 또는 거부
      }
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      setIsFullscreen(false);
    } catch {
      // 무시
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  // Fullscreen 상태 변경 감지 (Esc로 브라우저가 직접 종료할 때)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // --- 렌더링 ---

  if (!currentSlide) return null;

  return (
    <div
      ref={containerRef}
      className={`flex h-full flex-col ${
        isFullscreen ? "slide-fullscreen bg-background" : ""
      }`}
    >
      {/* 슬라이드 컨트롤 바 */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1">
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => setShowSidebar(!showSidebar)}
                >
                  {showSidebar ? (
                    <PanelLeftClose className="h-3.5 w-3.5" />
                  ) : (
                    <PanelLeftOpen className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {showSidebar ? "목차 숨기기" : "목차 보기"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span className="text-sm font-medium">{fileName}</span>
          <Badge variant="secondary" className="text-[10px]">
            {currentIndex + 1} / {totalSlides}
          </Badge>
        </div>

        <div className="flex items-center gap-1">
          {/* 이전 */}
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={goToPrev}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>

          {/* 다음 */}
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={goToNext}
            disabled={currentIndex === totalSlides - 1}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>

          {/* 전체화면 */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={toggleFullscreen}
                >
                  {isFullscreen ? (
                    <Minimize className="h-3.5 w-3.5" />
                  ) : (
                    <Maximize className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isFullscreen ? "전체화면 종료 (Esc)" : "전체화면 프레젠테이션"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* 메인 콘텐츠 영역 (사이드바 + 슬라이드) */}
      <div className="flex flex-1 min-h-0">
        {/* 썸네일 사이드바 */}
        {showSidebar && (
          <SlideThumbnailSidebar
            slides={slides}
            currentIndex={currentIndex}
            onSelect={goToSlide}
          />
        )}

        {/* 슬라이드 표시 영역 */}
        <div className="flex flex-1 items-center justify-center overflow-auto p-4">
          <div
            key={currentSlide.index}
            className="slide-card animate-fade-in w-full max-w-4xl"
          >
            <div className="prose prose-sm dark:prose-invert max-w-none p-8 md:p-12">
              <Markdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
              >
                {currentSlide.content}
              </Markdown>
            </div>
          </div>
        </div>
      </div>

      {/* 전체화면 모드 하단 네비게이션 오버레이 */}
      {isFullscreen && (
        <div className="slide-fullscreen-nav">
          <Button
            size="sm"
            variant="ghost"
            onClick={goToPrev}
            disabled={currentIndex === 0}
            className="text-foreground/70 hover:text-foreground"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            이전
          </Button>
          <span className="text-sm tabular-nums text-foreground/60">
            {currentIndex + 1} / {totalSlides}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={goToNext}
            disabled={currentIndex === totalSlides - 1}
            className="text-foreground/70 hover:text-foreground"
          >
            다음
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
```

#### 키보드 단축키 정리

| 키 | 동작 |
|----|------|
| `ArrowLeft` / `ArrowUp` | 이전 슬라이드 |
| `ArrowRight` / `ArrowDown` / `Space` | 다음 슬라이드 |
| `Home` | 첫 슬라이드 |
| `End` | 마지막 슬라이드 |
| `Escape` | 전체화면 종료 |

---

### 3. 슬라이드 썸네일 사이드바 (`src/components/SlideThumbnailSidebar.tsx`)

슬라이드 목차/썸네일 목록을 좌측에 표시한다. 현재 슬라이드를 하이라이트하고, 클릭으로 이동할 수 있다.

```typescript
// src/components/SlideThumbnailSidebar.tsx

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Slide } from "@/lib/parseSlides";

interface SlideThumbnailSidebarProps {
  slides: Slide[];
  currentIndex: number;
  onSelect: (index: number) => void;
}

export default function SlideThumbnailSidebar({
  slides,
  currentIndex,
  onSelect,
}: SlideThumbnailSidebarProps) {
  const activeRef = useRef<HTMLButtonElement>(null);

  // 현재 슬라이드가 변경되면 사이드바에서 해당 항목이 보이도록 스크롤
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentIndex]);

  return (
    <div className="flex w-48 flex-col border-r border-border bg-muted/30">
      <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b border-border">
        목차
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-1 p-2">
          {slides.map((slide) => (
            <button
              key={slide.index}
              ref={slide.index === currentIndex ? activeRef : null}
              onClick={() => onSelect(slide.index)}
              className={cn(
                "flex items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                slide.index === currentIndex
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground"
              )}
            >
              <span className="mt-px shrink-0 tabular-nums text-[10px] text-muted-foreground/60">
                {slide.index + 1}
              </span>
              <span className="line-clamp-2 break-all">{slide.title}</span>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
```

#### 사이드바 특징

- **너비 고정 (`w-48`)**: 192px 고정 너비로 슬라이드 영역을 최대한 확보한다.
- **자동 스크롤**: `scrollIntoView`로 현재 슬라이드에 해당하는 목차 항목이 항상 보이도록 한다.
- **제목 표시**: `Slide.title`을 표시하며, 긴 제목은 `line-clamp-2`로 2줄까지만 보여준다.
- **번호 표시**: 좌측에 슬라이드 번호를 작게 표시한다.

---

### 4. MdViewer 페이지 수정 (`src/pages/MdViewer.tsx`)

기존 MdViewer에 "일반 뷰 / 슬라이드 뷰" 모드 전환 토글을 추가하고, 슬라이드 뷰 모드일 때 SlideView 컴포넌트를 렌더링한다.

#### 변경 사항 요약

1. `parseSlides` import 추가
2. `SlideView` 컴포넌트 import 추가
3. `viewMode` 상태 추가 (`"normal" | "slide"`)
4. 파일 헤더 영역에 모드 전환 토글 그룹 추가
5. 콘텐츠 영역을 `viewMode`에 따라 분기

#### 변경할 import 블록

```typescript
// 기존 import에 추가
import { parseSlides } from "@/lib/parseSlides";
import SlideView from "@/components/SlideView";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  FolderOpen,
  RefreshCw,
  FolderOpenDot,
  FileDown,
  Loader2,
  FileText,
  BookOpen,      // 추가: 일반 뷰 아이콘
  Presentation,  // 추가: 슬라이드 뷰 아이콘
} from "lucide-react";
```

#### 추가할 상태

```typescript
// 기존 상태 선언 블록 내에 추가
const [viewMode, setViewMode] = useState<"normal" | "slide">("normal");
```

#### 파일 헤더 영역 변경

**변경 전** (183-217행, 파일 헤더 영역):

```tsx
{fileName && (
  <div className="flex items-center justify-between border-b border-border px-3 py-1">
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">{fileName}</span>
      <span className="text-[10px] text-muted-foreground">
        {fileSize} &middot; {lineCount}줄
      </span>
    </div>
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant="ghost"
        className="h-6"
        onClick={handleOpenFolder}
      >
        <FolderOpenDot className="mr-1 h-3.5 w-3.5" />
        폴더 열기
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-6"
        onClick={handleExportPdf}
        disabled={pdfExporting}
      >
        {pdfExporting ? (
          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileDown className="mr-1 h-3.5 w-3.5" />
        )}
        PDF 저장
      </Button>
    </div>
  </div>
)}
```

**변경 후**:

```tsx
{fileName && (
  <div className="flex items-center justify-between border-b border-border px-3 py-1">
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">{fileName}</span>
      <span className="text-[10px] text-muted-foreground">
        {fileSize} &middot; {lineCount}줄
      </span>
    </div>
    <div className="flex items-center gap-1">
      {/* 뷰 모드 전환 토글 */}
      <ToggleGroup
        type="single"
        size="sm"
        variant="outline"
        value={viewMode}
        onValueChange={(value) => {
          if (value) setViewMode(value as "normal" | "slide");
        }}
      >
        <ToggleGroupItem value="normal" className="h-6 px-2 text-xs">
          <BookOpen className="mr-1 h-3 w-3" />
          일반
        </ToggleGroupItem>
        <ToggleGroupItem value="slide" className="h-6 px-2 text-xs">
          <Presentation className="mr-1 h-3 w-3" />
          슬라이드
        </ToggleGroupItem>
      </ToggleGroup>

      <div className="mx-1 h-4 w-px bg-border" />

      <Button
        size="sm"
        variant="ghost"
        className="h-6"
        onClick={handleOpenFolder}
      >
        <FolderOpenDot className="mr-1 h-3.5 w-3.5" />
        폴더 열기
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-6"
        onClick={handleExportPdf}
        disabled={pdfExporting}
      >
        {pdfExporting ? (
          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileDown className="mr-1 h-3.5 w-3.5" />
        )}
        PDF 저장
      </Button>
    </div>
  </div>
)}
```

#### 콘텐츠 영역 변경

**변경 전** (219-241행, Markdown content 영역):

```tsx
{/* Markdown content */}
<ScrollArea className="flex-1 min-h-0">
  {content ? (
    <div className="prose prose-sm dark:prose-invert max-w-none p-6 animate-fade-in">
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
      >
        {content}
      </Markdown>
    </div>
  ) : (
    <EmptyState
      icon={FileText}
      title={folderPath ? "파일을 선택하세요" : "폴더를 선택하세요"}
      description={
        folderPath
          ? "좌측 트리에서 마크다운 파일을 선택하면 미리볼 수 있습니다"
          : "폴더를 선택하면 마크다운 파일을 미리볼 수 있습니다"
      }
    />
  )}
</ScrollArea>
```

**변경 후**:

```tsx
{/* 콘텐츠 영역 - 모드에 따라 분기 */}
{content ? (
  viewMode === "slide" ? (
    <SlideView
      slides={parseSlides(content)}
      fileName={fileName}
    />
  ) : (
    <ScrollArea className="flex-1 min-h-0">
      <div className="prose prose-sm dark:prose-invert max-w-none p-6 animate-fade-in">
        <Markdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
        >
          {content}
        </Markdown>
      </div>
    </ScrollArea>
  )
) : (
  <EmptyState
    icon={FileText}
    title={folderPath ? "파일을 선택하세요" : "폴더를 선택하세요"}
    description={
      folderPath
        ? "좌측 트리에서 마크다운 파일을 선택하면 미리볼 수 있습니다"
        : "폴더를 선택하면 마크다운 파일을 미리볼 수 있습니다"
    }
  />
)}
```

**성능 고려사항**: `parseSlides(content)`는 `content`가 변경될 때만 재계산되어야 한다. 렌더링마다 파싱하지 않도록 `useMemo`를 사용한다.

```typescript
// MdViewer 컴포넌트 내부에 추가
const slides = useMemo(() => {
  if (!content) return [];
  return parseSlides(content);
}, [content]);
```

그리고 JSX에서는 `parseSlides(content)` 대신 `slides`를 사용한다:

```tsx
<SlideView slides={slides} fileName={fileName} />
```

`useMemo` import도 추가해야 한다:

```typescript
import { useState, useCallback, useEffect, useMemo } from "react";
```

---

### 5. 슬라이드 스타일링 (`src/index.css`)

슬라이드 카드, 전체화면 모드, 전환 애니메이션에 필요한 CSS를 추가한다. 기존 파일 마지막에 새 섹션을 추가한다.

```css
/* ── Slide View Styles ── */

/* 슬라이드 카드: PPT 스타일 카드 모양 */
.slide-card {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  box-shadow:
    0 4px 6px -1px rgb(0 0 0 / 0.1),
    0 2px 4px -2px rgb(0 0 0 / 0.1);
  min-height: 400px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.dark .slide-card {
  box-shadow:
    0 4px 6px -1px rgb(0 0 0 / 0.3),
    0 2px 4px -2px rgb(0 0 0 / 0.2);
}

/* 전체화면 프레젠테이션 모드 */
.slide-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 50;
}

.slide-fullscreen .slide-card {
  min-height: 60vh;
  max-height: 80vh;
  border-radius: 1rem;
  box-shadow:
    0 20px 25px -5px rgb(0 0 0 / 0.15),
    0 8px 10px -6px rgb(0 0 0 / 0.15);
}

.dark .slide-fullscreen .slide-card {
  box-shadow:
    0 20px 25px -5px rgb(0 0 0 / 0.4),
    0 8px 10px -6px rgb(0 0 0 / 0.3);
}

/* 전체화면 모드 하단 네비게이션 오버레이 */
.slide-fullscreen-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 0.75rem;
  border-top: 1px solid var(--color-border);
  background: var(--color-background);
}

/* 슬라이드 전환 애니메이션 */
@keyframes slideEnter {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.slide-card {
  animation: slideEnter 250ms ease-out;
}
```

#### 테마 대응

위 CSS는 기존 CSS 변수 시스템(`--color-card`, `--color-border`, `--color-background`)을 활용하므로 모든 테마에 자동으로 대응된다.

- **라이트 모드**: 흰색 카드에 연한 그림자
- **다크 모드**: `.dark` 클래스 하위에서 더 진한 그림자로 전환
- **커스텀 테마**: `useTheme`에서 CSS 변수를 오버라이드하면 슬라이드 카드도 자동으로 따라감

---

### 6. 아키텍처 다이어그램

```
MdViewer.tsx
  |
  +-- [viewMode === "normal"] --> ScrollArea + Markdown (기존 렌더링)
  |
  +-- [viewMode === "slide"]
        |
        +-- parseSlides(content) --> Slide[]
        |
        +-- SlideView
              |
              +-- 슬라이드 컨트롤 바 (ToggleGroup 모드전환, 네비게이션, 전체화면)
              |
              +-- SlideThumbnailSidebar (좌측, 토글 가능)
              |     |
              |     +-- ScrollArea + 슬라이드 제목 목록
              |
              +-- 슬라이드 카드 (Markdown 렌더링)
              |
              +-- [전체화면] 하단 네비게이션 오버레이
```

---

### 7. 파일별 전체 변경 사항 명세

#### `src/lib/parseSlides.ts` (신규)

- `Slide` 인터페이스 정의
- `parseSlides()` 함수: 마크다운 텍스트를 슬라이드 배열로 분할
- `stripFrontmatter()`: YAML frontmatter 제거
- `extractTitle()`: 슬라이드 제목 추출
- `splitByHorizontalRule()`: `---` 기준 분할
- `splitByH2()`: `## ` 기준 분할

#### `src/components/SlideView.tsx` (신규)

- 슬라이드 뷰 메인 컴포넌트
- 상태: `currentIndex`, `isFullscreen`, `showSidebar`
- 기능: 이전/다음 네비게이션, 키보드 화살표 지원, Fullscreen API, 사이드바 토글
- shadcn/ui 컴포넌트 사용: `Button`, `Badge`, `Tooltip`

#### `src/components/SlideThumbnailSidebar.tsx` (신규)

- 슬라이드 목차/썸네일 사이드바
- 현재 슬라이드 하이라이트
- 클릭으로 슬라이드 이동
- 자동 스크롤 (`scrollIntoView`)

#### `src/pages/MdViewer.tsx` (수정)

| 변경 위치 | 변경 내용 |
|----------|----------|
| import 블록 | `parseSlides`, `SlideView`, `ToggleGroup/ToggleGroupItem`, `useMemo`, `BookOpen`, `Presentation` 추가 |
| 상태 선언 | `viewMode` 상태 추가, `slides` memoized 값 추가 |
| 파일 헤더 | 모드 전환 ToggleGroup 추가 (일반/슬라이드) |
| 콘텐츠 영역 | `viewMode`에 따라 기존 Markdown 렌더링 또는 SlideView 분기 |

#### `src/index.css` (수정)

| 변경 위치 | 변경 내용 |
|----------|----------|
| 파일 끝 | `/* Slide View Styles */` 섹션 추가 |
| | `.slide-card` 슬라이드 카드 스타일 |
| | `.slide-fullscreen` 전체화면 모드 스타일 |
| | `.slide-fullscreen-nav` 전체화면 하단 네비 |
| | `@keyframes slideEnter` 슬라이드 전환 애니메이션 |

---

### 8. 백엔드 변경 사항

**없음.** 이 기능은 순수 프론트엔드 변경이다. 마크다운 파싱은 클라이언트에서 수행하며, 기존의 `read_text_file` Tauri 커맨드로 파일 내용을 가져온 후 프론트엔드에서 슬라이드로 분할한다. 새로운 Tauri 커맨드 추가가 필요하지 않다.

## 영향 범위

- **MdViewer 페이지**: 파일 헤더에 모드 전환 UI가 추가된다. 기본값은 "일반" 모드이므로 기존 사용자의 워크플로우에 변화가 없다.
- **기존 마크다운 렌더링**: 일반 뷰 모드는 기존과 완전히 동일하게 동작한다. 슬라이드 뷰는 별도 분기이다.
- **다른 페이지**: 영향 없음. SlideView, SlideThumbnailSidebar는 MdViewer에서만 사용된다.
- **글로벌 CSS**: `src/index.css`에 새 클래스 추가만 하므로 기존 스타일에 영향 없음.
- **번들 크기**: 새로운 외부 의존성 추가 없음. `parseSlides.ts`는 순수 TypeScript 유틸리티이고, `SlideView`와 `SlideThumbnailSidebar`는 이미 사용 중인 라이브러리(react-markdown, remarkGfm, rehypeHighlight, lucide-react, shadcn/ui)만 활용한다.

## 테스트 포인트

- [ ] **슬라이드 파싱 - `---` 구분자**: `---`로 구분된 마크다운 문서가 올바른 수의 슬라이드로 분할되는지 확인
- [ ] **슬라이드 파싱 - `##` 헤딩 구분**: `---` 없이 `## ` 헤딩만 있는 문서가 H2 기준으로 분할되는지 확인
- [ ] **슬라이드 파싱 - YAML frontmatter**: frontmatter가 있는 문서에서 frontmatter가 구분자로 오인되지 않는지 확인
- [ ] **슬라이드 파싱 - 구분자 없는 문서**: 구분자가 없는 문서가 1장의 슬라이드로 표시되는지 확인
- [ ] **모드 전환**: "일반" <-> "슬라이드" 토글이 정상 동작하는지 확인
- [ ] **슬라이드 네비게이션 - 버튼**: 이전/다음 버튼으로 슬라이드 이동 확인
- [ ] **슬라이드 네비게이션 - 키보드**: 화살표 키(좌/우, 상/하), Space, Home, End 키 동작 확인
- [ ] **슬라이드 네비게이션 - 범위 제한**: 첫 슬라이드에서 "이전" 비활성화, 마지막에서 "다음" 비활성화 확인
- [ ] **전체화면 프레젠테이션**: 전체화면 버튼 클릭 시 Fullscreen API로 전환되는지 확인
- [ ] **전체화면 종료**: Esc 키 또는 축소 버튼으로 전체화면 종료 확인
- [ ] **썸네일 사이드바**: 슬라이드 목차가 표시되고, 클릭으로 이동되는지 확인
- [ ] **사이드바 토글**: 사이드바 표시/숨기기 버튼 동작 확인
- [ ] **사이드바 자동 스크롤**: 많은 슬라이드가 있을 때 현재 슬라이드로 자동 스크롤되는지 확인
- [ ] **파일 전환**: 다른 마크다운 파일 선택 시 슬라이드 인덱스가 0으로 리셋되는지 확인
- [ ] **다크/라이트 테마**: 양쪽 테마에서 슬라이드 카드, 사이드바, 전체화면 모드가 올바르게 표시되는지 확인
- [ ] **마크다운 렌더링**: 슬라이드 내에서 GFM 테이블, 코드 하이라이트, 이미지 등이 정상 렌더링되는지 확인
- [ ] **빈 콘텐츠**: 파일 미선택 상태에서 EmptyState가 정상 표시되는지 확인 (모드와 무관)
- [ ] **기존 일반 뷰**: 일반 뷰 모드에서 기존과 동일하게 마크다운이 렌더링되는지 확인 (회귀 방지)
