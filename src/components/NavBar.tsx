import { type TabConfig, type NavPosition, type NavDisplayMode } from "@/stores/settingsStore";
import { TAB_ICONS } from "@/lib/tab-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface NavBarProps {
  position: NavPosition;
  displayMode: NavDisplayMode;
  tabs: TabConfig[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

function tooltipSide(position: NavPosition): "top" | "bottom" | "left" | "right" {
  switch (position) {
    case "top": return "bottom";
    case "bottom": return "top";
    case "left": return "right";
    case "right": return "left";
  }
}

export default function NavBar({ position, displayMode, tabs, activeTab, onTabChange }: NavBarProps) {
  const isHorizontal = position === "top" || position === "bottom";
  const isIconOnly = displayMode === "icon";

  const containerClass = cn(
    "shrink-0 bg-background z-10",
    isHorizontal
      ? "flex flex-row items-stretch overflow-x-auto no-scrollbar"
      : "flex flex-col items-stretch overflow-y-auto no-scrollbar",
    isHorizontal && "h-10 px-1",
    !isHorizontal && isIconOnly && "w-12 py-1",
    !isHorizontal && !isIconOnly && "w-44 py-1",
    position === "top" && "border-b border-border",
    position === "bottom" && "border-t border-border",
    position === "left" && "border-r border-border",
    position === "right" && "border-l border-border",
  );

  return (
    <TooltipProvider>
      <nav className={containerClass}>
        {tabs.map((tab) => {
          const Icon = TAB_ICONS[tab.id];
          const isActive = tab.id === activeTab;

          const buttonClass = cn(
            "flex items-center gap-1.5 text-[13px] font-medium transition-colors duration-150 cursor-pointer",
            "text-muted-foreground hover:text-foreground",
            // horizontal
            isHorizontal && "flex-none px-3 h-full border-b-2 border-transparent",
            isHorizontal && isActive && "border-primary text-foreground",
            // vertical
            !isHorizontal && "px-3 py-2 mx-1 rounded-md",
            !isHorizontal && isActive && "bg-accent text-foreground",
            !isHorizontal && isIconOnly && "justify-center px-0 mx-0",
          );

          const button = (
            <button
              key={tab.id}
              className={buttonClass}
              onClick={() => onTabChange(tab.id)}
            >
              {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
              {!isIconOnly && <span className="truncate">{tab.label}</span>}
            </button>
          );

          if (isIconOnly) {
            return (
              <Tooltip key={tab.id}>
                <TooltipTrigger asChild>
                  {button}
                </TooltipTrigger>
                <TooltipContent side={tooltipSide(position)} sideOffset={4}>
                  {tab.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return button;
        })}
      </nav>
    </TooltipProvider>
  );
}
