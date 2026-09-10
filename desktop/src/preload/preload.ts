import { contextBridge, ipcRenderer } from 'electron';

export interface AuthStatus {
  loggedIn: boolean;
  email?: string;
  message?: string;
}

export interface TrackedProject {
  id: string;
  name: string;
  colour: string;
  client: string | null;
}

export interface TrackedTask {
  id: string;
  name: string;
  status: 'open' | 'closed';
}

export interface TimeEntry {
  id: string;
  projectId: string;
  taskId: string | null;
  startedAt: string;
  endedAt: string | null;
}

export interface CurrentTimer {
  entry: TimeEntry | null;
  now: string;
}

export type IdleHandling = 'off' | 'flag' | 'auto_subtract';

export interface IdlePolicy {
  handling: IdleHandling;
  thresholdMinutes: number;
}

export type DesktopDevicePlatformName = 'windows' | 'macos' | 'linux';

export interface CapturePermissionStatus {
  windowTrackingEnabled: boolean;
  platform: DesktopDevicePlatformName;
  screenRecordingGranted: boolean;
  waylandUnsupported: boolean;
}

export type TrackingResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; runningEntry?: TimeEntry };

const api = {
  getStatus: (): Promise<AuthStatus> => ipcRenderer.invoke('auth:status') as Promise<AuthStatus>,
  login: (email: string, password: string): Promise<AuthStatus> =>
    ipcRenderer.invoke('auth:login', { email, password }) as Promise<AuthStatus>,
  logout: (): Promise<AuthStatus> => ipcRenderer.invoke('auth:logout') as Promise<AuthStatus>,
  tracking: {
    listProjects: (): Promise<TrackingResult<TrackedProject[]>> =>
      ipcRenderer.invoke('tracking:listProjects') as Promise<
        TrackingResult<TrackedProject[]>
      >,
    listTasks: (projectId: string): Promise<TrackingResult<{ tasks: TrackedTask[] }>> =>
      ipcRenderer.invoke('tracking:listTasks', projectId) as Promise<
        TrackingResult<{ tasks: TrackedTask[] }>
      >,
    start: (projectId: string, taskId: string | null): Promise<TrackingResult<TimeEntry>> =>
      ipcRenderer.invoke('tracking:start', projectId, taskId) as Promise<
        TrackingResult<TimeEntry>
      >,
    switchTo: (
      projectId: string,
      taskId: string | null,
    ): Promise<TrackingResult<TimeEntry>> =>
      ipcRenderer.invoke('tracking:switch', projectId, taskId) as Promise<
        TrackingResult<TimeEntry>
      >,
    stop: (endedAt?: string): Promise<TrackingResult<TimeEntry>> =>
      ipcRenderer.invoke('tracking:stop', endedAt) as Promise<TrackingResult<TimeEntry>>,
    status: (): Promise<TrackingResult<CurrentTimer>> =>
      ipcRenderer.invoke('tracking:status') as Promise<TrackingResult<CurrentTimer>>,
    idlePolicy: (): Promise<TrackingResult<IdlePolicy>> =>
      ipcRenderer.invoke('tracking:idlePolicy') as Promise<TrackingResult<IdlePolicy>>,
    permissionStatus: (): Promise<TrackingResult<CapturePermissionStatus>> =>
      ipcRenderer.invoke('tracking:permissionStatus') as Promise<
        TrackingResult<CapturePermissionStatus>
      >,
    requestScreenRecordingAccess: (): Promise<void> =>
      ipcRenderer.invoke('tracking:requestScreenRecordingAccess') as Promise<void>,
    openScreenRecordingSettings: (): Promise<void> =>
      ipcRenderer.invoke('tracking:openScreenRecordingSettings') as Promise<void>,
  },
  idle: {
    seconds: (): Promise<number> => ipcRenderer.invoke('idle:seconds') as Promise<number>,
  },
};

contextBridge.exposeInMainWorld('api', api);

export type DesktopApi = typeof api;
