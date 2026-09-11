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
  /** Non-null while the entry has an open pause span. */
  pausedAt: string | null;
  /** Total seconds paused so far, across every *closed* pause span. */
  pausedSeconds: number;
}

export interface LastProject {
  projectId: string;
  taskId: string | null;
}

export interface TrackedEntry {
  id: string;
  projectId: string;
  durationSeconds: number | null;
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
  | { ok: false; message: string; runningEntry?: TimeEntry; unauthorized?: boolean };

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
    pause: (): Promise<TrackingResult<TimeEntry>> =>
      ipcRenderer.invoke('tracking:pause') as Promise<TrackingResult<TimeEntry>>,
    resume: (): Promise<TrackingResult<TimeEntry>> =>
      ipcRenderer.invoke('tracking:resume') as Promise<TrackingResult<TimeEntry>>,
    lastProject: (): Promise<LastProject | null> =>
      ipcRenderer.invoke('tracking:lastProject') as Promise<LastProject | null>,
    entriesBetween: (from: string, to: string): Promise<TrackingResult<TrackedEntry[]>> =>
      ipcRenderer.invoke('tracking:entriesBetween', from, to) as Promise<
        TrackingResult<TrackedEntry[]>
      >,
    idlePolicy: (): Promise<TrackingResult<IdlePolicy>> =>
      ipcRenderer.invoke('tracking:idlePolicy') as Promise<TrackingResult<IdlePolicy>>,
  },
  idle: {
    seconds: (): Promise<number> => ipcRenderer.invoke('idle:seconds') as Promise<number>,
  },
  urlCapture: {
    // Fire-and-forget push, not invoke — main has nothing to return, and the
    // renderer stays the authoritative source of "is a timer running".
    timerStateChanged: (running: boolean): void => {
      ipcRenderer.send('urlCapture:timerStateChanged', running);
    },
  },
};

contextBridge.exposeInMainWorld('api', api);

export type DesktopApi = typeof api;
