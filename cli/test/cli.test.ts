import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChildProcess } from 'child_process';
import { resolveAgentsDir } from '../src/registry';
import { parseSource } from '../src/source';
import { installerInternals } from '../src/installer';
import { disableKeepAwake, enableKeepAwake, keepAwakeInternals, readKeepAwakeState } from '../src/keepAwake';
import { autostartInternals, disableAutostart, enableAutostart, readAutostartState } from '../src/autostart';
import { addJob } from '../src/registry';
import { ensureRegistryState, readRunLog, updateJob, writeDaemonState } from '../src/state';
import { recoverSleepMissedJobs } from '../src/daemon';
import { parseJob } from '../src/parser';

const tempDirs: string[] = [];

function run(command: string, args: string[], cwd: string): void {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed: ${(result.stderr || result.stdout).trim()}`);
  }
}

function writeJob(dir: string, name: string): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'JOB.md'), `---
name: ${name}
cron: 0 9 * * *
description: ${name} description
---

# ${name}
`);
}

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openjob-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  keepAwakeInternals.resetForTests();
  autostartInternals.resetForTests();
  vi.restoreAllMocks();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('parseSource', () => {
  it('parses GitHub URLs and shorthand sources', () => {
    expect(parseSource('https://github.com/owner/repo')).toMatchObject({
      type: 'github',
      url: 'https://github.com/owner/repo.git'
    });
    expect(parseSource('https://github.com/owner/repo.git')).toMatchObject({
      type: 'github',
      url: 'https://github.com/owner/repo.git'
    });
    expect(parseSource('https://github.com/owner/repo/tree/main/jobs/foo')).toMatchObject({
      type: 'github',
      url: 'https://github.com/owner/repo.git',
      ref: 'main',
      subpath: 'jobs/foo'
    });
    expect(parseSource('owner/repo')).toMatchObject({
      type: 'github',
      url: 'https://github.com/owner/repo.git'
    });
    expect(parseSource('owner/repo/jobs/foo')).toMatchObject({
      type: 'github',
      url: 'https://github.com/owner/repo.git',
      subpath: 'jobs/foo'
    });
    expect(parseSource('owner/repo@daily')).toMatchObject({
      type: 'github',
      url: 'https://github.com/owner/repo.git',
      jobName: 'daily'
    });
    expect(parseSource('owner/repo#dev')).toMatchObject({
      type: 'github',
      url: 'https://github.com/owner/repo.git',
      ref: 'dev'
    });
    expect(parseSource('owner/repo#dev@daily')).toMatchObject({
      type: 'github',
      url: 'https://github.com/owner/repo.git',
      ref: 'dev',
      jobName: 'daily'
    });
  });

  it('keeps local paths as local sources', () => {
    expect(parseSource('./docs/page.md#anchor')).toMatchObject({
      type: 'local',
      input: './docs/page.md#anchor'
    });
  });
});

describe('parseJob', () => {
  it.each([
    ['name', '   '],
    ['cron', 123],
    ['description', ['invalid']],
  ])('rejects an invalid required %s field', (field, value) => {
    const dir = createTempDir();
    const jobPath = path.join(dir, 'JOB.md');
    const frontmatter = {
      name: 'valid-name',
      cron: '0 9 * * *',
      description: 'valid description',
      [field]: value,
    };
    fs.writeFileSync(jobPath, `---
${Object.entries(frontmatter).map(([key, item]) => `${key}: ${JSON.stringify(item)}`).join('\n')}
---

# Invalid field
`);

    expect(() => parseJob(jobPath)).toThrow(`Missing or invalid required field: ${field}`);
  });
});

describe('registry paths', () => {
  it('resolves global agents dir from os homedir when HOME is missing', () => {
    expect(resolveAgentsDir({} as NodeJS.ProcessEnv, () => '/tmp/openjob-global-home'))
      .toBe('/tmp/openjob-global-home/.agents');
  });
});

describe('keep awake', () => {
  it('enables and disables keep-awake state with a tracked pid', () => {
    const dir = createTempDir();
    keepAwakeInternals.setStatePathForTests(path.join(dir, 'keep-awake.json'));
    keepAwakeInternals.setPlatformForTests('darwin');
    keepAwakeInternals.setPmsetExistsForTests(true);
    keepAwakeInternals.setNowIsoForTests('2026-05-19T07:20:00.000Z');
    keepAwakeInternals.setSpawnNoIdleForTests(() => ({ pid: 4321, unref: vi.fn() } as unknown as ChildProcess));
    keepAwakeInternals.setProcessExistsForTests((pid) => pid === 4321);
    keepAwakeInternals.setKillProcessForTests(() => {});

    expect(readKeepAwakeState()).toEqual({
      enabled: false,
      pid: null,
      startedAt: null,
      lastError: null,
    });

    expect(enableKeepAwake()).toEqual({
      enabled: true,
      pid: 4321,
      startedAt: '2026-05-19T07:20:00.000Z',
      lastError: null,
    });

    expect(disableKeepAwake()).toEqual({
      enabled: false,
      pid: null,
      startedAt: null,
      lastError: null,
    });
  });

  it('clears stale keep-awake state and preserves a useful error', () => {
    const dir = createTempDir();
    keepAwakeInternals.setStatePathForTests(path.join(dir, 'keep-awake.json'));
    keepAwakeInternals.writeKeepAwakeState({
      enabled: true,
      pid: 9999,
      startedAt: '2026-05-19T07:20:00.000Z',
      lastError: null,
    });
    keepAwakeInternals.setProcessExistsForTests(() => false);

    expect(readKeepAwakeState()).toEqual({
      enabled: false,
      pid: null,
      startedAt: null,
      lastError: '防休眠进程已退出，点击上方开关可重新启用',
    });
  });

  it('rejects keep-awake when pmset exits before the process becomes observable', () => {
    const dir = createTempDir();
    keepAwakeInternals.setStatePathForTests(path.join(dir, 'keep-awake.json'));
    keepAwakeInternals.setPlatformForTests('darwin');
    keepAwakeInternals.setPmsetExistsForTests(true);
    keepAwakeInternals.setSpawnNoIdleForTests(() => ({ pid: 5555, unref: vi.fn() } as unknown as ChildProcess));
    keepAwakeInternals.setProcessExistsForTests(() => false);

    expect(() => enableKeepAwake()).toThrow(/exited before keep-awake was enabled/);
  });
});

describe('autostart', () => {
  it('writes and loads a LaunchAgent plist on enable', () => {
    const dir = createTempDir();
    const loaded: string[][] = [];
    autostartInternals.setPlatformForTests('darwin');
    autostartInternals.setLaunchAgentsDirForTests(dir);
    autostartInternals.setExecPathForTests('/usr/local/bin/node');
    autostartInternals.setDaemonEntryForTests('/opt/openjob/bin/openjob');
    autostartInternals.setRunLaunchctlForTests((args) => { loaded.push(args); });
    autostartInternals.setIsLoadedForTests(() => true);

    const state = enableAutostart();
    const plist = fs.readFileSync(state.plistPath, 'utf8');

    expect(fs.existsSync(state.plistPath)).toBe(true);
    expect(plist).toContain('<string>/usr/local/bin/node</string>');
    expect(plist).toContain('<string>daemon</string>');
    expect(plist).toContain('<key>RunAtLoad</key>');
    expect(plist).toContain('<key>KeepAlive</key>');
    expect(loaded.some((a) => a[0] === 'load')).toBe(true);
    expect(state.enabled).toBe(true);
    expect(state.loaded).toBe(true);
  });

  it('removes the plist on disable', () => {
    const dir = createTempDir();
    autostartInternals.setPlatformForTests('darwin');
    autostartInternals.setLaunchAgentsDirForTests(dir);
    autostartInternals.setRunLaunchctlForTests(() => {});
    autostartInternals.setIsLoadedForTests(() => false);

    enableAutostart();
    const state = disableAutostart();

    expect(fs.existsSync(state.plistPath)).toBe(false);
    expect(state.enabled).toBe(false);
  });

  it('reports disabled status when no plist exists', () => {
    const dir = createTempDir();
    autostartInternals.setLaunchAgentsDirForTests(dir);
    autostartInternals.setIsLoadedForTests(() => false);

    const state = readAutostartState();
    expect(state.enabled).toBe(false);
    expect(state.loaded).toBe(false);
  });

  it('refuses to enable on non-macOS platforms', () => {
    autostartInternals.setPlatformForTests('linux');
    expect(() => enableAutostart()).toThrow(/only supported on macOS/);
  });
});

describe('installer internals', () => {
  it('resolves and filters jobs from a git repository', () => {
    const dir = createTempDir();
    const repo = path.join(dir, 'repo');
    fs.mkdirSync(repo);
    writeJob(path.join(repo, 'jobs', 'one'), 'one');
    writeJob(path.join(repo, 'jobs', 'two'), 'two');
    fs.mkdirSync(path.join(repo, 'docs'));
    fs.writeFileSync(path.join(repo, 'docs', 'JOB.md'), '# invalid');
    run('git', ['init'], repo);
    run('git', ['add', '.'], repo);
    run('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'seed jobs'], repo);

    const single = installerInternals.resolveRemoteJob({
      type: 'git',
      input: repo,
      url: repo,
      subpath: 'jobs/one'
    });
    try {
      expect(single.job.name).toBe('one');
      expect(fs.existsSync(single.job.sourcePath)).toBe(true);
    } finally {
      single.cleanup();
    }

    const filtered = installerInternals.resolveRemoteJob({
      type: 'git',
      input: repo,
      url: repo,
      subpath: 'jobs',
      jobName: 'two'
    });
    try {
      expect(filtered.job.name).toBe('two');
    } finally {
      filtered.cleanup();
    }
  });

  it('throws helpful errors for ambiguous or missing remote jobs', () => {
    const dir = createTempDir();
    const repo = path.join(dir, 'repo');
    fs.mkdirSync(repo);
    writeJob(path.join(repo, 'jobs', 'one'), 'one');
    writeJob(path.join(repo, 'jobs', 'two'), 'two');
    run('git', ['init'], repo);
    run('git', ['add', '.'], repo);
    run('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'seed jobs'], repo);

    expect(() => installerInternals.resolveRemoteJob({
      type: 'git',
      input: repo,
      url: repo,
      subpath: 'jobs'
    })).toThrow(/Multiple jobs found: one, two/);

    expect(() => installerInternals.resolveRemoteJob({
      type: 'git',
      input: repo,
      url: repo,
      subpath: 'missing'
    })).toThrow(/No valid JOB\.md found under "missing"/);
  });
});

describe('sleep recovery', () => {
  it('replays jobs missed during sleep once the machine wakes', async () => {
    const dir = createTempDir();
    const home = path.join(dir, 'home');
    fs.mkdirSync(home, { recursive: true });
    process.env.HOME = home;

    const jobDir = path.join(dir, 'job');
    fs.mkdirSync(jobDir, { recursive: true });
    fs.writeFileSync(path.join(jobDir, 'JOB.md'), `---
name: wake-recovery-job
cron: "* * * * *"
description: wake recovery
command: printf 'recovered'
---
`);

    addJob({
      name: 'wake-recovery-job',
      source: path.join(jobDir, 'JOB.md'),
      sourcePath: path.join(jobDir, 'JOB.md'),
      cron: '* * * * *',
      description: 'wake recovery',
      command: `printf 'recovered'`
    });

    updateJob('wake-recovery-job', {
      nextRun: '2026-08-10T08:00:00.000Z',
      lastStatus: 'idle',
      history: []
    });

    writeDaemonState({
      status: 'running',
      pid: 123,
      startedAt: '2026-08-10T07:00:00.000Z',
      heartbeatAt: '2026-08-10T08:00:00.000Z',
      lastWakeGapMs: 0
    });

    const recovered = await recoverSleepMissedJobs(
      new Date('2026-08-10T08:00:00.000Z'),
      new Date('2026-08-10T08:02:30.000Z')
    );

    expect(recovered).toBe(1);

    const registry = ensureRegistryState();
    const job = registry.jobs.find(item => item.name === 'wake-recovery-job');
    expect(job).toBeDefined();
    expect(job?.lastStatus).toBe('success');
    expect(job?.lastExitReason).toBe('exit:0');
    expect(job?.lastError).toBeNull();
    expect(job?.runCount).toBe(1);
    expect(job?.history).toHaveLength(2);
    expect(job?.history[0]?.status).toBe('missed');
    expect(job?.history[0]?.exitReason).toBe('sleep_missed');
    expect(job?.history[1]?.trigger).toBe('wake_recovery');
    expect(job?.history[1]?.status).toBe('success');

    const logs = readRunLog('wake-recovery-job', 200);
    expect(logs.length).toBeGreaterThanOrEqual(2);
    expect(logs.at(-2)?.status).toBe('missed');
    expect(logs.at(-2)?.exitReason).toBe('sleep_missed');
    expect(logs.at(-1)?.trigger).toBe('wake_recovery');
    expect(logs.at(-1)?.status).toBe('success');
  });
});
