import * as path from 'path';
import { CronExpressionParser } from 'cron-parser';
import { spawn } from 'child_process';
import {
  appendRunLog,
  ensureRegistryState,
  readDaemonState,
  writeDaemonState,
  updateJob,
  safeNextRun,
  MACHINE_ID
} from './state';
import { executeJob } from './executor';
import { createServer } from './dashboard';
import { Job, DaemonState, RunRecord } from './types';

const HEARTBEAT_INTERVAL_MS = 15_000;
const SLEEP_GAP_THRESHOLD_MS = 90_000;

export function isProcessAlive(pid: number | null | undefined): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function isDaemonAlive(state: DaemonState): boolean {
  if (!state.pid) return false;
  if (isProcessAlive(state.pid)) return true;
  if (state.heartbeatAt) {
    const elapsed = Date.now() - new Date(state.heartbeatAt).getTime();
    return elapsed >= 0 && elapsed < 60_000;
  }
  return false;
}

export function dueJobs(current: Date = new Date()): Job[] {
  const registry = ensureRegistryState();
  return registry.jobs.filter(job => {
    if (!job.enabled) return false;
    if (job.lastStatus === 'running') return false;
    const nextRun = job.nextRun || safeNextRun(job.cron, current);
    if (!nextRun) return false;
    return new Date(nextRun).getTime() <= current.getTime();
  });
}

export function collectMissedJobs(lastHeartbeat: Date, current: Date): Job[] {
  const registry = ensureRegistryState();
  const from = new Date(lastHeartbeat);
  const to = new Date(current);
  return registry.jobs.filter(job => {
    if (!job.enabled) return false;
    try {
      const interval = CronExpressionParser.parse(job.cron, { currentDate: from, endDate: to });
      interval.next();
      return true;
    } catch {
      return false;
    }
  });
}

export async function recoverSleepMissedJobs(lastHeartbeat: Date, current: Date): Promise<number> {
  const jobs = collectMissedJobs(lastHeartbeat, current);
  const startedAt = lastHeartbeat.toISOString();
  const finishedAt = current.toISOString();

  for (const job of jobs) {
    const record: RunRecord = {
      jobName: job.name,
      trigger: 'scheduled',
      startedAt,
      finishedAt,
      status: 'missed',
      exitReason: 'sleep_missed',
      stdout: '',
      stderr: 'device_sleep_suspected'
    };

    appendRunLog(job.name, record);
    updateJob(job.name, currentJob => ({
      ...currentJob,
      lastRun: finishedAt,
      lastStartedAt: startedAt,
      lastFinishedAt: finishedAt,
      lastStatus: 'missed',
      lastError: 'device_sleep_suspected',
      lastExitReason: 'sleep_missed',
      history: [...(currentJob.history || []), record].slice(-20)
    }));

    // Record the missed trigger for auditability, then immediately recover it once the machine wakes.
    const refreshedJob = ensureRegistryState().jobs.find(currentJob => currentJob.name === job.name);
    if (refreshedJob && refreshedJob.lastStatus !== 'running') {
      await executeJob(refreshedJob, 'wake_recovery');
    }
  }
  return jobs.length;
}

export async function tick(): Promise<void> {
  const state = readDaemonState();
  const now = new Date();
  const lastHeartbeat = state.heartbeatAt ? new Date(state.heartbeatAt) : null;
  const gapMs = lastHeartbeat ? now.getTime() - lastHeartbeat.getTime() : 0;

  if (gapMs > SLEEP_GAP_THRESHOLD_MS && lastHeartbeat) {
    await recoverSleepMissedJobs(lastHeartbeat, now);
    writeDaemonState({ lastWakeGapMs: gapMs });
  }

  writeDaemonState({ status: 'running', pid: process.pid, machineId: MACHINE_ID, heartbeatAt: now.toISOString() });

  const jobs = dueJobs(now);
  for (const job of jobs) {
    try {
      await executeJob(job, 'scheduled');
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      updateJob(job.name, currentJob => ({
        ...currentJob,
        lastStatus: 'failed',
        lastError: errorMsg,
        lastExitReason: 'runner_exception',
        nextRun: safeNextRun(currentJob.cron, new Date())
      }));
    }
  }
}

const DASHBOARD_PORT = Number(process.env.OPENJOB_DASHBOARD_PORT) || 17852;

export async function runLoop(): Promise<void> {
  ensureRegistryState();
  writeDaemonState({ status: 'running', pid: process.pid, machineId: MACHINE_ID, startedAt: new Date().toISOString(), heartbeatAt: new Date().toISOString() });

  const handleStop = (): void => {
    writeDaemonState({ status: 'stopped', pid: null, machineId: MACHINE_ID, heartbeatAt: new Date().toISOString() });
    process.exit(0);
  };

  process.on('SIGINT', handleStop);
  process.on('SIGTERM', handleStop);

  const server = createServer(DASHBOARD_PORT, false);
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      const fallback = createServer(0, false);
      fallback.on('listening', () => {
        const addr = fallback.address();
        if (addr && typeof addr !== 'string') {
          writeDaemonState({ dashboardUrl: `http://127.0.0.1:${addr.port}` });
        }
      });
    }
  });
  server.on('listening', () => {
    const addr = server.address();
    if (addr && typeof addr !== 'string') {
      writeDaemonState({ dashboardUrl: `http://127.0.0.1:${addr.port}` });
    }
  });

  await tick();
  setInterval(() => {
    tick().catch(error => {
      const errorMsg = error instanceof Error ? error.message : String(error);
      writeDaemonState({ status: 'degraded', pid: process.pid, machineId: MACHINE_ID, heartbeatAt: new Date().toISOString(), lastError: errorMsg });
    });
  }, HEARTBEAT_INTERVAL_MS);
}

export function startDaemon(): DaemonState {
  const state = readDaemonState();
  if (state.pid && isProcessAlive(state.pid)) {
    return state;
  }

  const entry = path.join(__dirname, '..', 'bin', 'openjob');
  const child = spawn(process.execPath, [entry, 'daemon', 'run'], {
    detached: true,
    stdio: 'ignore',
    env: process.env
  });
  child.unref();

  return writeDaemonState({ status: 'starting', pid: child.pid!, machineId: MACHINE_ID, startedAt: new Date().toISOString(), heartbeatAt: null });
}

export function stopDaemon(): DaemonState {
  const state = readDaemonState();
  if (state.pid && isProcessAlive(state.pid)) {
    process.kill(state.pid, 'SIGTERM');
  }
  return writeDaemonState({ status: 'stopped', pid: null, machineId: MACHINE_ID });
}

export { readDaemonState };
