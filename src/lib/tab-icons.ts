import {
  Home as HomeIcon,
  Database,
  FileImage,
  FileText,
  GitBranch,
  Server,
  Activity,
  FileJson,
  type LucideIcon,
} from "lucide-react";

export const TAB_ICONS: Record<string, LucideIcon> = {
  home: HomeIcon,
  dbdoc: Database,
  pumlviewer: FileImage,
  mdviewer: FileText,
  callflow: GitBranch,
  servermanager: Server,
  servermonitor: Activity,
  jsontool: FileJson,
};
