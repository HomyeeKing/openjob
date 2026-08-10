/** Job 运行时状态 */
export type JobStatus = 'idle' | 'running' | 'success' | 'failed' | 'skipped' | 'missed';

/** 触发方式 */
export type TriggerType = 'manual' | 'scheduled' | 'dashboard_manual' | 'wake_recovery';

/** 退出原因 */
export type ExitReason = 
  | `exit:${number}`
  | `signal:${string}`
  | 'timeout'
  | 'condition_not_met'
  | 'condition_requires_ai_evaluation'
  | 'sleep_missed'
  | 'runner_exception'
  | 'no_executable_command'
  | `condition_script_not_found:${string}`;

/** Daemon 状态 */
export type DaemonStatus = 'stopped' | 'starting' | 'running' | 'degraded';

/** Job 定义（从 JOB.md 解析） */
export interface JobDefinition {
  name: string;
  cron: string;
  description: string;
  condition?: string;
  allowedSkills?: string[];
  timeout?: number;
  retry?: number;
  tags?: string[];
  command?: string;
  cwd?: string;
  body?: string;
  source: string;
  sourcePath: string;
  originalSource?: string;
}

/** Job 完整记录（包含运行时状态） */
export interface Job extends JobDefinition {
  enabled: boolean;
  installedAt: string;
  lastRun: string | null;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  nextRun: string | null;
  lastStatus: JobStatus;
  lastError: string | null;
  lastExitReason: ExitReason | null;
  runCount: number;
  consecutiveFailures: number;
  history: RunRecord[];
  pid: number | null;
  originalSource: string;
}

/** 运行记录 */
export interface RunRecord {
  jobName: string;
  trigger: TriggerType;
  startedAt: string;
  finishedAt: string;
  status: JobStatus;
  exitReason: ExitReason | string;
  stdout: string;
  stderr: string;
  pid?: number;
  machineId?: string;
}

/** Registry 结构 */
export interface Registry {
  version: string;
  jobs: Job[];
}

/** Daemon 状态 */
export interface DaemonState {
  status: DaemonStatus;
  pid: number | null;
  machineId?: string;
  startedAt: string | null;
  heartbeatAt: string | null;
  lastWakeGapMs: number;
  lastError?: string;
  dashboardUrl?: string;
}

/** 任务运行时配置 */
export interface JobRuntime {
  parsed: JobDefinition;
  cwd: string;
  command: string;
  commandBlocks: string[];
}

/** Shell 执行结果 */
export interface ShellResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  pid: number;
}

/** Condition 检查结果 */
export interface ConditionCheck {
  skipped: boolean;
  reason?: ExitReason | string;
  script?: string;
}

export interface KeepAwakeState {
  enabled: boolean;
  pid: number | null;
  startedAt: string | null;
  lastError: string | null;
}

/** Dashboard API 响应 */
export interface OverviewResponse {
  daemon: DaemonState;
  jobs: JobSummary[];
  machineId: string;
  keepAwake: KeepAwakeState;
}

/** 任务摘要（用于列表展示） */
export interface JobSummary {
  name: string;
  description: string;
  cron: string;
  sourcePath: string;
  enabled: boolean;
  nextRun: string | null;
  lastRun: string | null;
  lastStatus: JobStatus;
  lastError: string | null;
  lastExitReason: ExitReason | null;
  runCount: number;
  consecutiveFailures: number;
  history?: RunRecord[];
}

/** Claude Task 结构 */
export interface ClaudeTask {
  id: string;
  cron: string;
  prompt: string;
  createdAt: number;
  recurring: boolean;
}
