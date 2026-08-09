import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

export const LAUNCH_AGENT_LABEL = 'com.openjob.daemon';

const LAUNCHCTL_PATH = '/bin/launchctl';

export interface AutostartState {
  enabled: boolean;
  label: string;
  plistPath: string;
  loaded: boolean;
}

const autostartDeps = {
  platform: () => process.platform,
  homedir: () => os.homedir(),
  launchAgentsDir: () => path.join(os.homedir(), 'Library', 'LaunchAgents'),
  execPath: () => process.execPath,
  daemonEntry: () => path.join(__dirname, '..', 'bin', 'openjob'),
  runLaunchctl: (args: string[]): void => {
    execFileSync(LAUNCHCTL_PATH, args, { stdio: 'ignore' });
  },
  isLoaded: (label: string): boolean => {
    try {
      execFileSync(LAUNCHCTL_PATH, ['list', label], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  },
};

function plistPath(): string {
  return path.join(autostartDeps.launchAgentsDir(), `${LAUNCH_AGENT_LABEL}.plist`);
}

function assertSupported(): void {
  if (autostartDeps.platform() !== 'darwin') {
    throw new Error('Autostart is only supported on macOS (LaunchAgent)');
  }
}

function buildPlist(): string {
  const node = autostartDeps.execPath();
  const entry = autostartDeps.daemonEntry();
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LAUNCH_AGENT_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${node}</string>
    <string>${entry}</string>
    <string>daemon</string>
    <string>run</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ProcessType</key>
  <string>Background</string>
</dict>
</plist>
`;
}

export function readAutostartState(): AutostartState {
  const target = plistPath();
  const exists = fs.existsSync(target);
  return {
    enabled: exists,
    label: LAUNCH_AGENT_LABEL,
    plistPath: target,
    loaded: exists ? autostartDeps.isLoaded(LAUNCH_AGENT_LABEL) : false,
  };
}

export function enableAutostart(): AutostartState {
  assertSupported();

  const dir = autostartDeps.launchAgentsDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const target = plistPath();
  fs.writeFileSync(target, buildPlist());

  // Reload so an updated plist takes effect; ignore unload errors when not yet loaded.
  try {
    autostartDeps.runLaunchctl(['unload', target]);
  } catch {
    /* not loaded yet */
  }
  autostartDeps.runLaunchctl(['load', '-w', target]);

  return readAutostartState();
}

export function disableAutostart(): AutostartState {
  assertSupported();

  const target = plistPath();
  if (fs.existsSync(target)) {
    try {
      autostartDeps.runLaunchctl(['unload', '-w', target]);
    } catch {
      /* already unloaded */
    }
    fs.unlinkSync(target);
  }

  return readAutostartState();
}

export const autostartInternals = {
  buildPlist,
  plistPath,
  setPlatformForTests(platform: NodeJS.Platform) {
    autostartDeps.platform = () => platform;
  },
  setLaunchAgentsDirForTests(dir: string) {
    autostartDeps.launchAgentsDir = () => dir;
  },
  setExecPathForTests(execPath: string) {
    autostartDeps.execPath = () => execPath;
  },
  setDaemonEntryForTests(entry: string) {
    autostartDeps.daemonEntry = () => entry;
  },
  setRunLaunchctlForTests(runLaunchctl: (args: string[]) => void) {
    autostartDeps.runLaunchctl = runLaunchctl;
  },
  setIsLoadedForTests(isLoaded: (label: string) => boolean) {
    autostartDeps.isLoaded = isLoaded;
  },
  resetForTests() {
    autostartDeps.platform = () => process.platform;
    autostartDeps.homedir = () => os.homedir();
    autostartDeps.launchAgentsDir = () => path.join(os.homedir(), 'Library', 'LaunchAgents');
    autostartDeps.execPath = () => process.execPath;
    autostartDeps.daemonEntry = () => path.join(__dirname, '..', 'bin', 'openjob');
    autostartDeps.runLaunchctl = (args: string[]) => {
      execFileSync(LAUNCHCTL_PATH, args, { stdio: 'ignore' });
    };
    autostartDeps.isLoaded = (label: string) => {
      try {
        execFileSync(LAUNCHCTL_PATH, ['list', label], { stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    };
  },
};
