import type { ReactNode } from "react";
import HelpDialog from "@/components/HelpDialog";

interface TabPageProps {
  helpKey: string;
  toolbar?: ReactNode;
  statusBar?: ReactNode;
  children: ReactNode;
}

export default function TabPage({ helpKey, toolbar, statusBar, children }: TabPageProps) {
  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
      <div className="page-toolbar">
        {toolbar}
        <div className="ml-auto">
          <HelpDialog helpKey={helpKey} />
        </div>
      </div>
      {children}
      {statusBar !== undefined && (
        <div className="page-statusbar">{statusBar}</div>
      )}
    </div>
  );
}
