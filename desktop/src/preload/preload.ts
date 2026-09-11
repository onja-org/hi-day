import { contextBridge, ipcRenderer } from 'electron';

export interface AuthStatus {
  loggedIn: boolean;
  email?: string;
  organisationName?: string;
}

export interface StartPairingResult {
  ok: boolean;
  message?: string;
}

export type PairingPollResult =
  | { status: 'pending' }
  | { status: 'approved'; email: string; organisationName: string }
  | { status: 'expired' }
  | { status: 'error'; message: string };

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

export type TrackingResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; runningEntry?: TimeEntry; signedOut?: boolean };

export interface UpdateCheckResult {
  updateAvailable: boolean;
  latestVersion?: string;
}

const api = {
  getStatus: (): Promise<AuthStatus> => ipcRenderer.invoke('auth:status') as Promise<AuthStatus>,
  auth: {
    startPairing: (): Promise<StartPairingResult> =>
      ipcRenderer.invoke('auth:startPairing') as Promise<StartPairingResult>,
    pairingStatus: (): Promise<PairingPollResult> =>
      ipcRenderer.invoke('auth:pairingStatus') as Promise<PairingPollResult>,
  },
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
  },
  idle: {
    seconds: (): Promise<number> => ipcRenderer.invoke('idle:seconds') as Promise<number>,
  },
  update: {
    status: (): Promise<UpdateCheckResult> =>
      ipcRenderer.invoke('update:status') as Promise<UpdateCheckResult>,
    openReleasesPage: (): Promise<void> =>
      ipcRenderer.invoke('update:openReleasesPage') as Promise<void>,
  },
};

contextBridge.exposeInMainWorld('api', api);

export type DesktopApi = typeof api;
