# Jobs

Jobs 是 **Out of loop** 的定时任务系统，让 AI 能够在 Agent Loop 之外持续、自动地执行任务。

[English Version](./README.md)

## 核心概念

### In loop vs Out of loop

| 类型 | 触发方式 | 生命周期 | 自动化程度 |
|------|----------|----------|------------|
| **Skills** | Agent 决策 / 人工 `/slash` | 受限于当前 Agent Loop | 半自动化 |
| **Jobs** | Cron 定时 + 条件判断 | 系统级，Out of loop | **全自动化** |

### Jobs 解决的问题

- 想在睡眠时让 AI 继续消耗 token 帮你干活？
- 想让 AI 定时检查某些事情并自动执行？
- 想实现真正的自动化、自主进化？

**Jobs = Cron 定时任务 + 条件执行 + Skills 组合**

## 仓库结构

```
openjob/
├── README.md                 # 英文文档
├── README.zh.md              # 本文档（中文）
├── cli/                      # openjob CLI（发布的 npm 包）
├── skills/                   # Skills（job-creator、jobs-scheduler）
├── spec/
│   └── jobs-spec.md          # Jobs 规范定义
├── website/                  # 文档站点
└── .claude-plugin/
    └── marketplace.json      # Claude Code 插件配置
```

## 快速开始

### 1. 初始化 CLI

```bash
npx openjob@latest init
```

这会创建全局注册表 `~/.agents/jobs.json` 和任务目录 `~/.agents/jobs/`。

已发布包直接使用 npm 包名和可执行文件名 `openjob`，避开了 zsh 等 shell 中 `jobs` 内建命令带来的冲突。推荐调用方式是 `npx openjob@latest <command>`。

### 2. 创建一个 Job

#### 方式 A：使用 job-creator Skill（推荐）

最简单的方式是使用内置的 `job-creator` Skill。直接告诉 Claude：

> "创建一个任务，每周一上午 9 点检查 npm 全局更新"

Skill 会：
1. 生成合适的任务名称和 Cron 调度
2. 创建结构正确的 `~/.agents/jobs/<name>/JOB.md`
3. 自动验证并注册任务

#### 方式 B：手动创建

在全局目录 `~/.agents/jobs/<job-name>/JOB.md` 创建 Job：

```markdown
---
name: my-first-job
cron: 0 9 * * *
description: 每天上午 9 点执行的示例任务
---

# 我的第一个 Job

在这里编写任务执行时的指令。
```

然后注册：

```bash
npx openjob@latest add ~/.agents/jobs/my-first-job
```

`npx openjob@latest add` 会把 Job 写入全局注册表 `~/.agents/jobs.json`，可执行的 `JOB.md` 保存在 `~/.agents/jobs/<name>/JOB.md`，并同步启用的 Job 到 Claude scheduled tasks。

仓库里的 `jobs/` 目录是市场/源码模板。安装示例 Job 时会复制到全局 Jobs 目录：

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

### 3. 启动守护进程

```bash
npx openjob@latest daemon start
```

守护进程会定期检查并执行到期的任务。

## CLI 命令

| 命令 | 说明 |
|------|------|
| `openjob init` | 初始化全局任务注册表 |
| `openjob add SOURCE` | 从本地路径或 GitHub 仓库安装任务 |
| `openjob remove <name>` | 按名称移除任务 |
| `openjob list` | 列出所有已注册的任务 |
| `openjob status` | 显示守护进程状态和任务运行时信息 |
| `openjob enable <name>` | 启用任务 |
| `openjob disable <name>` | 禁用任务 |
| `openjob run <name>` | 立即执行任务（手动测试） |
| `openjob sync` | 将启用的任务同步到 Claude scheduled_tasks.json |
| `openjob daemon start` | 启动本地任务守护进程 |
| `openjob daemon stop` | 停止本地任务守护进程 |
| `openjob daemon status` | 显示守护进程状态 |
| `openjob autostart enable` | 登录时自动启动守护进程（macOS LaunchAgent） |
| `openjob autostart disable` | 移除开机自启 |
| `openjob autostart status` | 显示开机自启状态 |
| `openjob dashboard` | 打开本地 Web 仪表板 |

## Job 定义格式

Job 是一个带有 YAML Frontmatter 的 Markdown 文件：

```markdown
---
name: job-name                  # 必填：唯一标识（小写，连字符分隔）
cron: 0 9 * * *                # 必填：Cron 表达式（5 字段）
description: 任务描述           # 必填：描述
condition: ./check.sh          # 可选：执行条件脚本
allowedSkills: [skill1, skill2] # 可选：允许使用的技能
timeout: 60                    # 可选：超时时间（分钟，默认 60）
retry: 1                       # 可选：失败重试次数（默认 0）
tags: [automation, maintenance] # 可选：分类标签
---

# 任务标题

## Objective
描述此任务要完成什么。

## Execution Steps

1. 第一步
   ```bash
   echo "要执行的命令"
   ```

2. 第二步
   ```bash
   another-command
   ```

## Output Requirements
期望的输出或结果。
```

### 核心字段

| 字段 | 必填 | 说明 |
|------|------|------|
| `name` | 是 | Job 唯一标识（小写，连字符分隔） |
| `description` | 是 | Job 描述，说明何时使用 |
| `cron` | 是 | Cron 表达式，定义调度频率 |
| `condition` | 否 | 执行条件（脚本路径或自然语言描述） |
| `allowedSkills` | 否 | 允许使用的 Skills 列表 |
| `timeout` | 否 | 最大执行时间（分钟） |
| `retry` | 否 | 失败时的重试次数 |
| `tags` | 否 | 用于组织和筛选任务的标签 |

### Cron 表达式

```
┌───────────── 分钟 (0-59)
│ ┌───────────── 小时 (0-23)
│ │ ┌───────────── 日期 (1-31)
│ │ │ ┌───────────── 月份 (1-12)
│ │ │ │ ┌───────────── 星期 (0-6，周日为 0)
│ │ │ │ │
* * * * *
```

常用示例：
- `0 9 * * *` - 每天上午 9 点
- `0 9 * * 1` - 每周一上午 9 点
- `0 0 * * *` - 每天凌晨 0 点
- `*/30 * * * *` - 每 30 分钟

## 使用 Skills 创建 Jobs

### 使用 job-creator Skill

触发词：`create job`、`new job`、`job creator`

当你表达自动化需求时，job-creator Skill 会：

1. 理解你的自动化意图
2. 生成合适的任务名称和 Cron 调度
3. 创建 `~/.agents/jobs/<name>/JOB.md`
4. 可选地使用 `jobs add` 注册它

Skill 使用模板结构并通过 CLI 验证以确保兼容性。

### 使用 jobs-scheduler Skill

触发词：`/jobs`、`jobs list`、`show jobs`

此 Skill 读取全局注册表 `~/.agents/jobs.json` 并显示：
- 所有已注册的任务及其 Cron 调度
- 当前状态（启用/禁用）
- 最近的执行历史
- 需要注意的任务（失败、已禁用）

## Jobs 如何被消费（执行）

Jobs 支持两种执行模式：

### 1. 本地守护进程执行（基于 Shell）

守护进程（`jobs daemon start`）在本地运行并：

1. **Cron 检查** - 每 15 秒检查一次到期任务
2. **条件检查** - 如果指定了条件：
   - 如果是脚本路径（以 `./` 或 `/` 开头，或以 `.sh` 结尾），执行脚本
   - 如果脚本返回非零，任务被跳过
   - 自然语言条件需要 AI 评估（守护进程模式下跳过）
3. **命令提取** - 从 JOB.md 提取 bash/sh/shell 代码块
4. **Shell 执行** - 使用 zsh 执行命令，支持超时控制
5. **结果记录** - 更新 `jobs.json` 中的状态、历史和下次运行时间

**流程：**
```
Cron 检查 → 条件检查 → 提取代码块 → Shell 执行 → 记录结果
```

### 2. Claude 定时任务执行（基于 AI）

`jobs sync` 将启用的任务转换为 Claude 定时任务：

```json
{
  "id": "abc123",
  "cron": "0 9 * * *",
  "prompt": "## Scheduled Job: my-job\n\n阅读并按照 /path/to/JOB.md 中的指令执行...",
  "recurring": true
}
```

当 Claude 触发时：
- AI 阅读并理解 JOB.md
- 可以使用允许的 Skills 完成复杂任务
- 支持自然语言条件评估
- 更灵活但需要 AI 可用

### 执行模式对比

| 特性 | 本地守护进程 | Claude 任务 |
|------|--------------|-------------|
| 触发方式 | 基于定时器 | Agent Loop |
| 执行方式 | Shell 命令 | AI + Skills |
| 条件判断 | 仅脚本 | 脚本 + 自然语言 |
| Skills | 不可用 | 可用 |
| 离线执行 | 支持 | 需要 AI |
| 适用场景 | 简单自动化 | 复杂推理任务 |

## 监控任务执行

### 1. CLI 状态

```bash
# 列出所有任务基本信息
npx openjob@latest list

# 显示详细运行时状态
npx openjob@latest status
```

输出包括：
- 任务名称、状态（idle/running/success/failed/missed）
- 下次计划运行时间
- 上次执行时间
- 错误消息或退出原因

### 2. Web 仪表板

```bash
npx openjob@latest dashboard
```

打开本地 Web 界面，显示：
- 任务统计（总数/已启用/失败）
- 守护进程心跳状态
- 每个任务的详情：
  - 当前状态标识
  - Cron 表达式
  - 下次/上次运行时间
  - 错误详情
  - 最近执行历史（最近 3 次）
- 手动触发按钮（运行/启用/禁用）

### 3. 执行日志

日志存储位置：

- `~/.agents/jobs-state/runs/<job-name>.jsonl` - JSONL 格式的完整执行日志
- `~/.agents/jobs.json` - 每个任务的 `history` 数组（最近 20 次）

日志条目结构：
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

## 执行流程

```
┌──────────────┐
│   开始       │
└──────┬───────┘
       ▼
┌──────────────┐
│ 检查 Cron    │◄──────────────────┐
│ 是否到期?    │                   │
└──────┬───────┘                   │
       │                           │
   ┌───┴───┐                       │
   │ 否    │ 是                    │
   ▼       ▼                       │
┌──────┐ ┌──────────────┐         │
│等待  │ │检查 Condition│         │
└──┬───┘ └──────┬───────┘         │
   │            │                  │
   │        ┌───┴───┐              │
   │        │ 否    │ 是           │
   │        ▼       ▼              │
   │   ┌──────┐ ┌──────────────┐  │
   │   │等待  │ │ 执行 Job     │  │
   │   └──┬───┘ └──────┬───────┘  │
   │      │            │           │
   │      └────────────┼───────────┘
   │                   │
   └───────────────────┘
```

## 与 Skills 的关系

```
┌─────────────────────────────────────────┐
│                  Jobs                    │
│  ┌─────────────────────────────────┐    │
│  │  Cron 调度 + Condition 判断     │    │
│  │  (Out of loop)                  │    │
│  └──────────────┬──────────────────┘    │
│                 │                        │
│                 ▼                        │
│  ┌─────────────────────────────────┐    │
│  │         Skills 组合              │    │
│  │  (In loop / Agent loop)         │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

- **Jobs** 负责定时触发和条件判断（Out of loop）
- **Skills** 负责具体的任务执行（In loop）
- 一个 Job 可以组合多个 Skills 完成复杂任务

## 完整工作流程示例

```bash
# 1. 初始化系统
npx openjob@latest init

# 2. 手动创建任务或使用 job-creator Skill
mkdir -p ~/.agents/jobs/daily-report
cat > ~/.agents/jobs/daily-report/JOB.md << 'EOF'
---
name: daily-report
cron: 0 9 * * *
description: 从 git 提交生成每日工作总结
tags: [report, git]
timeout: 30
---

# 每日报告

## Objective
从 git 历史生成昨日工作摘要。

## Execution Steps

1. 获取昨日 git 日志
   ```bash
   git log --since="yesterday" --oneline
   ```

2. 格式化报告
   ```bash
   echo "## Daily Report $(date -d yesterday +%Y-%m-%d)"
   git log --since="yesterday" --pretty=format:"- %s"
   ```
EOF

# 3. 注册任务
npx openjob@latest add ~/.agents/jobs/daily-report

# 4. 启动守护进程进行自动执行
npx openjob@latest daemon start

# 5. 检查状态
npx openjob@latest status

# 6. 打开仪表板监控
npx openjob@latest dashboard

# 7. 手动测试运行
npx openjob@latest run daily-report

# 8. 同步到 Claude 进行 AI 执行
npx openjob@latest sync
```

## 更多信息

- [规范文档](./spec/jobs-spec.md) - 完整的 Jobs 规范定义
- [模板](./skills/job-creator/templates/JOB.md) - 创建新 Job 的模板
- [示例 Jobs](./jobs/) - 查看更多示例

## 相关

- [Jobs Over Skills](https://homyzone.pages.dev/blogs/aigc/jobs-over-skills)

核心观点：**定时任务是实现自动化、自主进化的一个重要方式。**
