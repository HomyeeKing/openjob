# Jobs

Jobs is an **Out of loop** scheduled task system that enables AI to execute tasks continuously and automatically outside the Agent Loop.

[中文版本](./README.zh.md)

## Core Concepts

### In loop vs Out of loop

| Type | Trigger | Lifecycle | Automation |
|------|---------|-----------|------------|
| **Skills** | Agent decision / Manual `/slash` | Bound to current Agent Loop | Semi-automated |
| **Jobs** | Cron schedule + Condition check | System-level, Out of loop | **Fully automated** |

### Problems Jobs Solve

- Want AI to keep consuming tokens and working for you while you sleep?
- Want AI to periodically check things and execute automatically?
- Want to achieve true automation and autonomous evolution?

**Jobs = Cron Scheduled Tasks + Conditional Execution + Skills Composition**

## Repository Structure

```
openjob/
├── README.md                 # This document
├── README.zh.md              # Chinese version
├── cli/                      # openjob CLI (published npm package)
├── spec/
│   └── jobs-spec.md          # Jobs specification
├── skills/                   # Bundled skills
│   ├── job-creator/          # Includes templates/JOB.md job template
│   └── jobs-scheduler/
├── website/                  # Documentation site
└── .claude-plugin/
    └── marketplace.json      # Claude Code plugin configuration
```

## Quick Start

### 1. Initialize CLI

```bash
npx openjob@latest init
```

This creates the global registry at `~/.agents/jobs.json` and the jobs directory at `~/.agents/jobs/`.

The published package uses both the npm name and installed binary name `openjob`, avoiding collisions with the shell builtin `jobs` in shells like zsh. The recommended invocation is `npx openjob@latest <command>`.

### 2. Create a Job

#### Option A: Use job-creator Skill (Recommended)

The easiest way is to use the built-in `job-creator` skill. Simply tell Claude:

> "Create a job to check npm global updates every Monday at 9 AM"

The skill will:
1. Generate an appropriate job name and cron schedule
2. Create `~/.agents/jobs/<name>/JOB.md` with proper structure
3. Validate and register the job automatically

#### Option B: Manual Creation

Create a global Job under `~/.agents/jobs/<job-name>/JOB.md`:

```markdown
---
name: my-first-job
cron: 0 9 * * *
description: Example job that runs daily at 9 AM
---

# My First Job

Write your instructions here that Claude will follow when this job triggers.
```

Then register it:

```bash
npx openjob@latest add ~/.agents/jobs/my-first-job
```

`npx openjob@latest add` stores Jobs in the global registry at `~/.agents/jobs.json`, keeps the executable `JOB.md` under `~/.agents/jobs/<name>/JOB.md`, and syncs enabled Jobs to Claude scheduled tasks.

Repository examples under `jobs/` are marketplace/source templates. Installing one copies it into the global Jobs directory:

```bash
npx openjob@latest add jobs/todo-night-executor
```

#### Source Formats

```bash
# GitHub shorthand (owner/repo)
npx openjob@latest add owner/repo

# Full GitHub URL
npx openjob@latest add https://github.com/owner/repo

# Direct path to a job in a repo
npx openjob@latest add HomyeeKing/openjob/skills/job-creator/templates
npx openjob@latest add https://github.com/owner/repo/tree/main/path/to/job

# Branch, tag, or commit
npx openjob@latest add owner/repo#main

# Select a job by name
npx openjob@latest add owner/repo@daily-report

# Branch plus job name
npx openjob@latest add owner/repo#main@daily-report

# Local path
npx openjob@latest add ./jobs/todo-night-executor
```

### 3. Start the Daemon

```bash
npx openjob@latest daemon start
```

The daemon will periodically check and execute due jobs.

## CLI Commands

| Command | Description |
|---------|-------------|
| `openjob init` | Initialize the global jobs registry |
| `openjob add SOURCE` | Install a job from a local path or GitHub repository |
| `openjob remove <name>` | Remove a job by name |
| `openjob list` | List all registered jobs |
| `openjob status` | Show daemon status and job runtime info |
| `openjob enable <name>` | Enable a job |
| `openjob disable <name>` | Disable a job |
| `openjob run <name>` | Execute a job immediately (manual test) |
| `openjob sync` | Sync enabled jobs to Claude scheduled_tasks.json |
| `openjob daemon start` | Start local jobs daemon |
| `openjob daemon stop` | Stop local jobs daemon |
| `openjob daemon status` | Show daemon status |
| `openjob autostart enable` | Start the daemon automatically on login (macOS LaunchAgent) |
| `openjob autostart disable` | Remove login autostart |
| `openjob autostart status` | Show login autostart status |
| `openjob dashboard` | Open local web dashboard |

## Job Definition Format

A Job is a Markdown file with YAML frontmatter:

```markdown
---
name: job-name                  # Required: Unique identifier (lowercase, hyphen-separated)
cron: 0 9 * * *                # Required: Cron expression (5 fields)
description: What this job does # Required: Description
condition: ./check.sh          # Optional: Execution condition script
allowedSkills: [skill1, skill2] # Optional: Allowed skills for this job
timeout: 60                    # Optional: Timeout in minutes (default: 60)
retry: 1                       # Optional: Retry count on failure (default: 0)
tags: [automation, maintenance] # Optional: Tags for categorization
---

# Job Title

## Objective
Describe what this job accomplishes.

## Execution Steps

1. Step one
   ```bash
   echo "Command to execute"
   ```

2. Step two
   ```bash
   another-command
   ```

## Output Requirements
Expected output or results.
```

### Core Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique identifier for the job (lowercase, hyphen-separated) |
| `description` | Yes | Description of what the job does and when to use it |
| `cron` | Yes | Cron expression defining the schedule |
| `condition` | No | Execution condition (script path or natural language description) |
| `allowedSkills` | No | List of Skills allowed for this job |
| `timeout` | No | Maximum execution time in minutes |
| `retry` | No | Number of retries on failure |
| `tags` | No | Tags for organizing and filtering jobs |

### Cron Expression

```
┌───────────── Minute (0-59)
│ ┌───────────── Hour (0-23)
│ │ ┌───────────── Day of month (1-31)
│ │ │ ┌───────────── Month (1-12)
│ │ │ │ ┌───────────── Day of week (0-6, Sunday is 0)
│ │ │ │ │
* * * * *
```

Common examples:
- `0 9 * * *` - Every day at 9 AM
- `0 9 * * 1` - Every Monday at 9 AM
- `0 0 * * *` - Every day at midnight
- `*/30 * * * *` - Every 30 minutes

## Creating Jobs with Skills

### Using job-creator Skill

Trigger phrases: `create job`, `new job`, `job creator`

When you express an automation need, the job-creator Skill will:

1. Understand your automation intent
2. Generate an appropriate job name and cron schedule
3. Create `~/.agents/jobs/<name>/JOB.md` with proper structure
4. Optionally register it with `jobs add`

The Skill uses the template structure and validates through the CLI to ensure compatibility.

### Using jobs-scheduler Skill

Trigger phrases: `/jobs`, `jobs list`, `show jobs`

This Skill reads the global registry at `~/.agents/jobs.json` and displays:
- All registered jobs with their cron schedules
- Current status (enabled/disabled)
- Recent execution history
- Jobs needing attention (failing, disabled)

## How Jobs Are Consumed

Jobs support two execution modes:

### 1. Local Daemon Execution (Shell-based)

The daemon (`jobs daemon start`) runs locally and:

1. **Cron Check** - Every 15 seconds, checks for due jobs
2. **Condition Check** - If a condition is specified:
   - If it's a script path (starts with `./` or `/`, or ends with `.sh`), executes the script
   - If the script returns non-zero, the job is skipped
   - Natural language conditions require AI evaluation (skip in daemon mode)
3. **Command Extraction** - Extracts bash/sh/shell code blocks from JOB.md
4. **Shell Execution** - Executes commands using zsh with timeout control
5. **Result Recording** - Updates status, history, and next run time in `jobs.json`

**Flow:**
```
Cron Check → Condition Check → Extract Code Blocks → Shell Execute → Record Result
```

### 2. Claude Scheduled Task Execution (AI-based)

`jobs sync` converts enabled jobs to Claude scheduled tasks:

```json
{
  "id": "abc123",
  "cron": "0 9 * * *",
  "prompt": "## Scheduled Job: my-job\n\nRead and follow instructions in /path/to/JOB.md...",
  "recurring": true
}
```

When Claude triggers:
- AI reads and understands JOB.md
- Can use allowed Skills to complete complex tasks
- Supports natural language condition evaluation
- More flexible but requires AI availability

### Execution Mode Comparison

| Aspect | Local Daemon | Claude Task |
|--------|--------------|-------------|
| Trigger | Timer-based | Agent Loop |
| Execution | Shell commands | AI + Skills |
| Condition | Script only | Script + Natural language |
| Skills | Not available | Available |
| Offline | Yes | Requires AI |
| Use case | Simple automation | Complex reasoning tasks |

## Monitoring Job Execution

### 1. CLI Status

```bash
# List all jobs with basic info
npx openjob@latest list

# Show detailed runtime status
npx openjob@latest status
```

Output includes:
- Job name, status (idle/running/success/failed/missed)
- Next scheduled run time
- Last execution time
- Error messages or exit reasons

### 2. Web Dashboard

```bash
npx openjob@latest dashboard
```

Opens a local web interface showing:
- Task totals (total/enabled/failed)
- Daemon heartbeat status
- Per-job details:
  - Current status badge
  - Cron expression
  - Next/last run times
  - Error details
  - Recent execution history (last 3 runs)
- Manual trigger buttons (run/enable/disable)

### 3. Execution Logs

Logs are stored in:

- `~/.agents/jobs-state/runs/<job-name>.jsonl` - Full execution log in JSONL format
- `~/.agents/jobs.json` - Each job's `history` array (last 20 runs)

Log entry structure:
```json
{
  "jobName": "my-job",
  "trigger": "scheduled",
  "startedAt": "2026-05-12T09:00:00.000Z",
  "finishedAt": "2026-05-12T09:05:00.000Z",
  "status": "success",
  "exitReason": "exit:0",
  "stdout": "...",
  "stderr": "..."
}
```

## Execution Flow

```
┌──────────────┐
│    Start     │
└──────┬───────┘
       ▼
┌──────────────┐
│ Check Cron   │◄──────────────────┐
│  Is due?     │                   │
└──────┬───────┘                   │
       │                           │
   ┌───┴───┐                       │
   │  No   │ Yes                   │
   ▼       ▼                       │
┌──────┐ ┌──────────────┐         │
│Wait  │ │Check Condition│         │
└──┬───┘ └──────┬───────┘         │
   │            │                  │
   │        ┌───┴───┐              │
   │        │  No   │ Yes           │
   │        ▼       ▼              │
   │   ┌──────┐ ┌──────────────┐  │
   │   │Wait  │ │ Execute Job  │  │
   │   └──┬───┘ └──────┬───────┘  │
   │      │            │           │
   │      └────────────┼───────────┘
   │                   │
   └───────────────────┘
```

## Relationship with Skills

```
┌─────────────────────────────────────────┐
│                  Jobs                    │
│  ┌─────────────────────────────────┐    │
│  │  Cron Scheduling + Condition    │    │
│  │  Checking (Out of loop)         │    │
│  └──────────────┬──────────────────┘    │
│                 │                        │
│                 ▼                        │
│  ┌─────────────────────────────────┐    │
│  │         Skills Composition      │    │
│  │  (In loop / Agent loop)         │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

- **Jobs** handle scheduling and condition checking (Out of loop)
- **Skills** handle actual task execution (In loop)
- One Job can compose multiple Skills to complete complex tasks

## Complete Workflow Example

```bash
# 1. Initialize the system
npx openjob@latest init

# 2. Create a job manually or use job-creator Skill
mkdir -p ~/.agents/jobs/daily-report
cat > ~/.agents/jobs/daily-report/JOB.md << 'EOF'
---
name: daily-report
cron: 0 9 * * *
description: Generate daily work summary from git commits
tags: [report, git]
timeout: 30
---

# Daily Report

## Objective
Generate a summary of yesterday's work from git history.

## Execution Steps

1. Get yesterday's git log
   ```bash
   git log --since="yesterday" --oneline
   ```

2. Format the report
   ```bash
   echo "## Daily Report $(date -d yesterday +%Y-%m-%d)"
   git log --since="yesterday" --pretty=format:"- %s"
   ```
EOF

# 3. Register the job
npx openjob@latest add ~/.agents/jobs/daily-report

# 4. Start the daemon for automatic execution
npx openjob@latest daemon start

# 5. Check status
npx openjob@latest status

# 6. Open dashboard for monitoring
npx openjob@latest dashboard

# 7. Test run manually
npx openjob@latest run daily-report

# 8. Sync to Claude for AI-based execution
npx openjob@latest sync
```

## More Information

- [Specification](./spec/jobs-spec.md) - Complete Jobs specification
- [Template](./skills/job-creator/templates/JOB.md) - Template for creating new Jobs
- [Example Jobs](./jobs/) - View more examples

## Related

- [Jobs Over Skills](https://homyzone.pages.dev/blogs/aigc/jobs-over-skills)

Core insight: **Scheduled tasks are an important way to achieve automation and autonomous evolution.**
