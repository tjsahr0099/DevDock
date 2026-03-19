import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { GripVertical } from "lucide-react";
import {
  type TabConfig,
  type NavPosition,
  type NavDisplayMode,
  useSettingsStore,
} from "@/stores/settingsStore";

interface TabSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tabs: TabConfig[];
  onSave: (tabs: TabConfig[]) => void;
}

function SortableTab({
  tab,
  onToggle,
}: {
  tab: TabConfig;
  onToggle: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: tab.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground focus:outline-none"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Checkbox
        id={tab.id}
        checked={tab.visible}
        onCheckedChange={() => onToggle(tab.id)}
      />
      <label htmlFor={tab.id} className="flex-1 cursor-pointer text-sm">
        {tab.label}
      </label>
    </div>
  );
}

export default function TabSettings({
  open,
  onOpenChange,
  tabs,
  onSave,
}: TabSettingsProps) {
  const { settings, saveSettings } = useSettingsStore();
  const [localTabs, setLocalTabs] = useState<TabConfig[]>([]);
  const [navPosition, setNavPosition] = useState<NavPosition>("top");
  const [navDisplayMode, setNavDisplayMode] = useState<NavDisplayMode>("both");

  useEffect(() => {
    if (open) {
      setLocalTabs([...tabs].sort((a, b) => a.order - b.order));
      setNavPosition(settings.navPosition ?? "top");
      setNavDisplayMode(settings.navDisplayMode ?? "both");
    }
  }, [open, tabs, settings.navPosition, settings.navDisplayMode]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleToggle = (id: string) => {
    setLocalTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, visible: !t.visible } : t)),
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setLocalTabs((prev) => {
        const oldIndex = prev.findIndex((t) => t.id === active.id);
        const newIndex = prev.findIndex((t) => t.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const handleSave = () => {
    const updated = localTabs.map((t, i) => ({ ...t, order: i }));
    onSave(updated);
    saveSettings({ navPosition, navDisplayMode });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>탭 설정</DialogTitle>
          <DialogDescription>
            네비게이션 바와 탭의 표시를 설정합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          {/* Nav bar settings */}
          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-medium">네비게이션 바 설정</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">위치</Label>
                <Select value={navPosition} onValueChange={(v) => setNavPosition(v as NavPosition)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top">상단</SelectItem>
                    <SelectItem value="bottom">하단</SelectItem>
                    <SelectItem value="left">좌측</SelectItem>
                    <SelectItem value="right">우측</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">표시 모드</Label>
                <Select value={navDisplayMode} onValueChange={(v) => setNavDisplayMode(v as NavDisplayMode)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">아이콘 + 라벨</SelectItem>
                    <SelectItem value="icon">아이콘만</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Tab order/visibility */}
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-medium">탭 순서 및 표시</h4>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={localTabs.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                {localTabs.map((tab) => (
                  <SortableTab
                    key={tab.id}
                    tab={tab}
                    onToggle={handleToggle}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleSave}>저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
