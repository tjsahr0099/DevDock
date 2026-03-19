import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface ServerInfo {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  description: string;
  display_order: number;
}

export interface DockerContainer {
  container_id: string;
  image: string;
  command: string;
  created: string;
  status: string;
  ports: string;
  names: string;
  cpu_percent: string;
  mem_usage: string;
  mem_percent: string;
  net_io: string;
  block_io: string;
}

export interface ServerHealth {
  hostname: string;
  uptime: string;
  load_average: string;
  cpu_usage: number;
  cpu_cores: number;
  mem_total: number;
  mem_used: number;
  mem_free: number;
  mem_usage_percent: number;
  swap_total: number;
  swap_used: number;
  disk_total: number;
  disk_used: number;
  disk_free: number;
  disk_usage_percent: number;
}

export interface PuttySession {
  name: string;
  host: string;
  port: number;
  username: string;
}

interface ServerStore {
  servers: ServerInfo[];
  loaded: boolean;
  loadServers: () => Promise<void>;
  saveServer: (server: ServerInfo) => Promise<void>;
  deleteServer: (id: string) => Promise<void>;
  saveServersOrder: (ids: string[]) => Promise<void>;
}

export const useServerStore = create<ServerStore>((set) => ({
  servers: [],
  loaded: false,

  loadServers: async () => {
    try {
      const servers = await invoke<ServerInfo[]>("get_servers");
      set({ servers, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  saveServer: async (server: ServerInfo) => {
    await invoke("save_server", { server });
    const servers = await invoke<ServerInfo[]>("get_servers");
    set({ servers });
  },

  deleteServer: async (id: string) => {
    await invoke("delete_server", { id });
    const servers = await invoke<ServerInfo[]>("get_servers");
    set({ servers });
  },

  saveServersOrder: async (ids: string[]) => {
    await invoke("save_servers_order", { ids });
    const servers = await invoke<ServerInfo[]>("get_servers");
    set({ servers });
  },
}));
