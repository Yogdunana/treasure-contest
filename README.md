# 秘宝争夺战 (Treasure Contest)

多人实时 Web 桌游，专为社团招新活动设计。玩家用手机扫码加入房间，在大屏上展开一场 8-10 分钟的宝石争夺对决。

## 游戏简介

4-8 名玩家通过手机扫码加入同一房间，在 6 个回合中进行数字博弈与宝石争夺。每位玩家开局随机抽取 1 个数字（1-7）和 1 个秘密任务，通过选择数字决定本回合的选宝石顺序，在收集宝石的同时完成隐藏任务，最终总分最高者获胜。

### 核心机制

- **数字选择**：每回合限时 20 秒，每位玩家从手中的数字牌中选择一个提交
- **顺序决定**：数字由小到大排序，相同数字按座位号由小到大决出先后；4 人以上撞号则该号作废
- **宝石争夺**：每回合生成 4 颗随机宝石（数值 1-10，5 种颜色），按顺序每人限时 8 秒选 1 颗
- **同色加成**：收集同色宝石获得递增加成（2 颗 +3，3 颗 +8，4 颗 +15，5 颗 +25，6 颗 +40）
- **秘密任务**：每位玩家开局随机分配 3 个任务（简单/中等/困难各 1），完成后获得对应奖励分

### 三大界面

| 界面 | 设备 | 路由 | 说明 |
|------|------|------|------|
| 玩家界面 | 手机 | `/play/:roomCode` | 输入昵称加入、数字选择、宝石选取、个人状态查看 |
| 大屏界面 | 投影/大屏 | `/screen/:roomCode` | 全场公共信息展示，实时动画效果 |
| 主持人控制台 | 电脑/平板 | `/host/:roomCode` | 创建房间、控制游戏流程、查看队列与日志 |

## 技术栈

- **前端**：React 18 + TypeScript + Vite + TailwindCSS + Framer Motion
- **后端**：Node.js + Express + Socket.io + better-sqlite3
- **共享包**：纯函数状态机、类型定义、30 个任务池、核心游戏逻辑
- **部署**：Docker 多阶段构建
- **包管理**：pnpm workspaces monorepo

## 项目结构

```
treasure-contest/
├── packages/
│   └── shared/              # 共享包：类型、常量、游戏逻辑、任务池
│       └── src/
│           ├── types/        # 所有 TypeScript 类型定义
│           ├── constants.ts  # 游戏常量（回合数、时间、颜色加成表等）
│           ├── logic/        # 纯函数游戏逻辑（宝石生成、顺序计算、计分、任务检查）
│           └── missions/     # 30 个任务定义（简单×10 + 中等×10 + 困难×10）
├── apps/
│   ├── server/              # 后端服务
│   │   └── src/
│   │       ├── db/           # SQLite 数据库层（schema、migrations、repositories）
│   │       ├── game/         # 游戏引擎（状态机、房间管理、队列管理、计时器）
│   │       ├── identity/     # 四层重连身份识别
│   │       ├── socket/       # Socket.io 通信层（事件处理、广播、中间件）
│   │       ├── routes/       # REST API 路由（管理后台）
│   │       └── utils/        # 工具函数（日志、QR码、ID生成）
│   └── client/              # 前端应用
│       └── src/
│           ├── pages/        # 7 个页面组件
│           ├── components/   # UI 组件（host / player / screen / shared）
│           ├── hooks/        # 自定义 Hooks
│           ├── store/        # Zustand 状态管理
│           └── lib/          # 工具库（Socket 客户端、指纹、认证存储）
├── Dockerfile               # 多阶段 Docker 构建
├── .env.example             # 环境变量模板
└── pnpm-workspace.yaml      # 工作区配置
```

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 8
- Python 3 & make & g++（编译 better-sqlite3 原生模块所需）

### 安装

#### 方式 A：直接从 GitHub 克隆（服务器可联网时）

```bash
git clone https://github.com/Yogdunana/treasure-contest.git
cd treasure-contest

# 安装依赖（已配置国内 npmmirror 镜像）
pnpm install

# 复制环境变量配置
cp .env.example .env
```

#### 方式 B：离线传输（服务器无法访问 GitHub 时）

如果服务器在内网、无法访问 GitHub，在**能联网的电脑**上操作：

```bash
# 1. 在能联网的电脑上克隆并打包
git clone https://github.com/Yogdunana/treasure-contest.git
cd treasure-contest

# 2. 打成 tar 包（排除 node_modules 和 .git）
tar czf treasure-contest.tar.gz --exclude='node_modules' --exclude='.git' treasure-contest/

# 3. 用 scp / U盘 / 内网传输把 tar 包传到服务器
scp treasure-contest.tar.gz user@服务器IP:~/

# 4. 在服务器上解压
ssh user@服务器IP
tar xzf treasure-contest.tar.gz
cd treasure-contest

# 5. 安装依赖（服务器需能访问 npmmirror.com）
pnpm install

# 6. 构建并运行
pnpm build
cp .env.example .env
# 编辑 .env 修改密码和 PUBLIC_URL
node apps/server/dist/index.js
```

> 如果服务器连 npmmirror.com 都无法访问，可以在联网电脑上执行 `pnpm install` 后，把整个项目目录（含 `node_modules`）一起打包传到服务器。

### 本地开发

```bash
# 同时启动前后端开发服务器
pnpm dev

# 或分别启动
pnpm dev:server   # 后端运行在 http://localhost:3001
pnpm dev:client   # 前端运行在 http://localhost:5173
```

### 构建

```bash
# 构建所有包（shared -> client -> server）
pnpm build

# 分别构建
pnpm build:shared
pnpm build:client
pnpm build:server
```

### 生产运行

```bash
# 设置环境变量
export NODE_ENV=production
export PORT=3001
export DB_PATH=./data/treasure.db

# 构建后启动
node apps/server/dist/index.js
```

## Docker 部署

### 方式一：docker run

```bash
# 构建镜像
docker build -t treasure-contest .

# 运行容器
docker run -d \
  --name treasure-contest \
  -p 3000:3000 \
  -v treasure-data:/data \
  -e ADMIN_PASSWORD=你的管理密码 \
  -e HOST_PASSWORD=你的主持人密码 \
  -e PUBLIC_URL=http://服务器IP:3000 \
  treasure-contest
```

### 方式二：docker-compose（推荐）

编辑 `docker-compose.yml`，修改 `PUBLIC_URL`、`ADMIN_PASSWORD`、`HOST_PASSWORD`，然后：

```bash
docker compose up -d --build
```

### 国内服务器部署（Docker 镜像加速）

如果服务器在国内，Docker 拉取 `node:20-slim` 基础镜像可能很慢或失败。配置 Docker 镜像加速：

```bash
# 编辑 Docker 配置
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://docker.m.daocloud.io",
    "https://docker.xuanyuan.me"
  ]
}
EOF

# 重启 Docker
sudo systemctl daemon-reload
sudo systemctl restart docker
```

配置完成后重新执行 `docker build` 或 `docker compose up -d --build`。

> 项目已内置 `.npmrc` 文件，使用 npmmirror（淘宝/阿里云）作为 npm 源，Dockerfile 中 apt 也切换到了阿里云镜像。`.npmrc` 与 Dockerfile 已设置 `minimum-release-age=0`，避免 pnpm 10 因 npmmirror 同步延迟对 `express` 等新版本报 `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`。若仍失败，可在构建命令上再加 `--config.minimum-release-age=0`。

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3001` | 服务器监听端口 |
| `DB_PATH` | `./data/treasure.db` | SQLite 数据库文件路径 |
| `CORS_ORIGIN` | `http://localhost:5173` | 允许跨域的前端地址 |
| `PUBLIC_URL` | `http://localhost:5173` | 前端公开访问地址（用于生成二维码） |
| `NODE_ENV` | `development` | 运行环境 |
| `ADMIN_PASSWORD` | `admin123`(dev) | 管理后台密码，生产环境必须设置 |
| `ADMIN_JWT_SECRET` | 同 `ADMIN_PASSWORD` | 签名管理 token 的密钥 |
| `HOST_PASSWORD` | `host123`(dev) | 主持人创建房间密码，生产环境必须设置 |
| `COOKIE_SECURE` | 随 `PUBLIC_URL` | 设为 `true`/`false` 强制开关重连 Cookie 的 Secure 标记。校园 HTTP 部署请保持 false（默认：仅 https:// 的 PUBLIC_URL 才启用） |

## 游戏规则详解

### 回合流程

```
回合开始
  │
  ├── 1. 数字选择（20秒限时）
  │     所有玩家同时从手牌中选一个数字提交
  │
  ├── 2. 数字揭晓（8秒展示）
  │     大屏公布所有玩家选择的数字
  │
  ├── 3. 顺序计算（5秒）
  │     数字从小到大排序 → 相同数字按座位号 → 4人撞号作废
  │
  ├── 4. 宝石展示（7秒）
  │     生成4颗随机宝石，大屏展示
  │
  ├── 5. 依次选宝石（每人8秒）
  │     按计算顺序，每人限时选1颗宝石
  │     超时自动随机选取
  │
  └── 回合结束（8秒展示）→ 进入下一回合
```

### 计分规则

| 分数来源 | 说明 |
|----------|------|
| 宝石基础分 | 每颗宝石的面值（1-10 分） |
| 同色加成 | 红/蓝/绿/黄/紫各色独立计算，取最高档加成，多色叠加 |
| 任务奖励 | 简单 +10、中等 +20、困难 +35 |

**同色加成表：**

| 同色宝石数 | 加成分 |
|-----------|--------|
| 1 颗 | 0 |
| 2 颗 | +3 |
| 3 颗 | +8 |
| 4 颗 | +15 |
| 5 颗 | +25 |
| 6 颗 | +40 |

### 撞号规则

- 2-3 人选相同数字：按座位号从小到大排序，依次选取
- 4 人及以上选相同数字：该数字作废，所有选此数字的玩家本轮跳过

## 30 个秘密任务

### 简单任务（各 +10 分）

| ID | 任务名 | 条件 |
|----|--------|------|
| S01 | 蓝色收藏家 | 最终拥有至少 2 颗蓝色宝石 |
| S02 | 红色收藏家 | 最终拥有至少 2 颗红色宝石 |
| S03 | 绿色收藏家 | 最终拥有至少 2 颗绿色宝石 |
| S04 | 黄色收藏家 | 最终拥有至少 2 颗黄色宝石 |
| S05 | 紫色收藏家 | 最终拥有至少 2 颗紫色宝石 |
| S06 | 多彩新人 | 最终拥有至少 3 种不同颜色的宝石 |
| S07 | 小富翁 | 最终宝石基础分达到 20 分 |
| S08 | 高价值起步 | 最终拥有至少 1 颗数值达到 7 以上的宝石 |
| S09 | 双子宝石 | 最终拥有至少 2 颗数值相同的宝石 |
| S10 | 稳定发挥 | 至少有 4 个回合成功获得宝石 |

### 中等任务（各 +20 分）

| ID | 任务名 | 条件 |
|----|--------|------|
| M01 | 三色收藏家 | 最终拥有至少 3 种颜色，且其中一种颜色至少有 3 颗 |
| M02 | 蓝色专精 | 最终拥有至少 3 颗蓝色宝石 |
| M03 | 红色专精 | 最终拥有至少 3 颗红色宝石 |
| M04 | 四色玩家 | 最终拥有至少 4 种不同颜色的宝石 |
| M05 | 高价值收藏家 | 最终拥有至少 3 颗数值达到 8 以上的宝石 |
| M06 | 中产阶级 | 最终宝石基础分达到 35 分 |
| M07 | 双重颜色 | 最终至少有 2 种颜色分别拥有 3 颗宝石 |
| M08 | 双十收藏 | 最终拥有至少 2 颗数值为 10 的宝石 |
| M09 | 同色三连 | 最终拥有至少 3 颗相同颜色宝石，且基础分达到 30 分 |
| M10 | 最后一搏 | 第 6 轮成功获得宝石，且该宝石数值达到 8 以上 |

### 困难任务（各 +35 分）

| ID | 任务名 | 条件 |
|----|--------|------|
| H01 | 单色大师 | 最终拥有至少 5 颗相同颜色的宝石 |
| H02 | 五色收藏家 | 最终同时拥有红、蓝、绿、黄、紫五种颜色 |
| H03 | 三张王牌 | 最终拥有至少 3 颗数值达到 9 以上的宝石 |
| H04 | 大宝藏 | 最终宝石基础分达到 45 分 |
| H05 | 同色四连 | 最终拥有至少 4 颗相同颜色的宝石 |
| H06 | 三色成双 | 最终至少有 3 种颜色分别拥有 2 颗宝石 |
| H07 | 宝石猎人 | 最终一共获得 6 颗宝石 |
| H08 | 心理大师 | 至少有 2 个回合与其他玩家选择相同数字，并且自己在对应候选组中最终获得宝石 |
| H09 | 逆袭者 | 第 3 轮结束时基础分排名不在前三，但最终进入前三 |
| H10 | 全能赢家 | 最终宝石基础分达到 40 分，同时至少拥有 4 种颜色 |

## 玩家重连机制

浏览器无法获取 MAC 地址，因此采用四层身份识别保障断线重连：

1. **localStorage Token**：首次加入时生成唯一令牌存储在浏览器本地
2. **HTTP-only Cookie**：服务端设置 HttpOnly Cookie 作为后备
3. **浏览器指纹**：Canvas + WebGL + UA 指纹辅助匹配
4. **手动恢复**：主持人可通过控制台手动操作恢复玩家

每局游戏通过 `gameSession` 递增机制实现跨局隔离，确保上一局的断线玩家不会误入新局。

## 等待队列系统

- 房间满员后（默认 6 人，最大 8 人），新扫码玩家自动进入等待队列
- 二维码持续显示，无需刷新
- 主持人控制台实时查看队列状态，可手动将队列玩家提升到房间
- 队列最大容量 10 人

## 管理后台

访问 `/admin` 进入管理后台，需要输入管理密码（开发环境默认 `admin123`，生产环境通过 `ADMIN_PASSWORD` 环境变量配置）。

功能包括：

- 查看所有房间状态与游戏进度
- 查看当日统计数据（场次、参与人数、平均时长）
- 查看操作日志
- 导出数据（CSV）

**认证机制**：登录后服务端签发 HMAC-SHA256 签名 token（有效期 8 小时），同时通过 HTTP-only Cookie 和 localStorage 双通道保存，所有 API 端点均需认证才能访问。

## 开发命令

```bash
pnpm dev          # 同时启动前后端开发服务器
pnpm build        # 构建所有包
pnpm test         # 运行所有测试
pnpm typecheck    # TypeScript 类型检查
```

## License

MIT
