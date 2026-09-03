import { contextBridge, ipcRenderer } from 'electron';

export interface AuthStatus {
  loggedIn: boolean;
  email?: string;
  message?: string;
}

const api = {
  getStatus: (): Promise<AuthStatus> => ipcRenderer.invoke('auth:status') as Promise<AuthStatus>,
  login: (email: string, password: string): Promise<AuthStatus> =>
    ipcRenderer.invoke('auth:login', { email, password }) as Promise<AuthStatus>,
  logout: (): Promise<AuthStatus> => ipcRenderer.invoke('auth:logout') as Promise<AuthStatus>,
};

contextBridge.exposeInMainWorld('api', api);

export type DesktopApi = typeof api;
