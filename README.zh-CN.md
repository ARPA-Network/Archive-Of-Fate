**语言 / Language:** [English](README.md) · **中文**

# 命运档案馆 · Archive of Fate

> AI 驱动的文字人生模拟游戏 + 链上命运铭刻（BNB Smart Chain）。
> 随机世界出生 → 抽天赋 → 分配属性 → 逐年经历随机事件 → 生成人生总结 → 把这段命运铸成 NFT 永久上链。

一局游戏就是一段完整人生：你在**现实 / 修仙 / 西幻**三个世界之一出生，用有限的属性点塑造角色，看它在几十年里被随机命运推着走完一生，最后得到一句 AI 写的人生总结与一个命运等级。满意的话，可以用钱包把这段命运**铭刻**成链上 NFT，进入全服「命运公告栏」，供所有人查看与**链上验真**。

---

## ✨ 核心功能

| 功能 | 说明 |
|---|---|
| **文字人生模拟** | 确定性规则引擎逐年推进：事件、天赋、属性(颜值/智力/体质/家境/快乐)、神话时刻、命运等级(D→SSS) |
| **三大世界** | 现实(`zh-cn`)、修仙武侠(`zh-cn-wf`)、西幻(`zh-cn-cf`)，各有独立事件/天赋/角色数据 |
| **中英双语** | 全量 i18n（zh-cn / en），像素风字体（Departure Mono + 缝合怪 Fusion Pixel）逐字回退 |
| **链上随机数** | ARPA Randcast 提供可验证随机种子；连钱包用户自付 BNB，游客试玩由后端代付 |
| **命运铭刻 (NFT)** | 付 50 ARPA 铸造 ERC-721，命运数据(种子/天赋/属性/随机数来源)全部上链 |
| **防伪签名** | 后端 EIP-712 签名授权 + 链上回执校验，杜绝伪造铭刻记录 |
| **链上验真** | 公告栏每条真实铭刻都能一键对比链上 `getFate` / `ownerOf` |
| **AI 人生总结** | Claude 生成一句凝练的人生总结（无 API key 时走规则兜底） |
| **命运分享卡** | 一键把结算画面导出为 PNG 分享卡 |
| **跨局进化** | 连钱包玩家跨局累积属性点与天赋池（游客固定基础点，不累积） |

---

## 🏗️ 系统架构

```
                    ┌───────────────────────────────────────────────┐
                    │  前端  Vite + TypeScript (固定 750×1334 画布)  │
                    │  Core (proxy) → 后端 API  或  本地 Mock 引擎   │
                    │  web3/chain.ts (ethers + MetaMask)            │
                    └───────────────┬───────────────┬───────────────┘
                          REST/JSON │               │ 钱包直连(用户签名/付费)
                                    ▼               ▼
        ┌────────────────────────────────────┐   ┌──────────────────────────────┐
        │  后端  Node + Express (:8787)      │   │  BNB Smart Chain              │
        │  · 确定性规则引擎 (mulberry32)      │   │  · InscriptionNFT (ERC-721)   │
        │  · 会话 API (/game/*)              │◄─►│  · FateRandomnessConsumer     │
        │  · EIP-712 铭刻签名 / 回执校验      │RPC│    ↕ ARPA Randcast            │
        │  · AI 总结 (Claude / 规则兜底)      │   │  · ARPA (铭刻费 token)        │
        │  · operator 代付试玩随机数          │   └──────────────────────────────┘
        └───────────────┬────────────────────┘
                        │
                        ▼
        ┌─────────────────────────────────────┐
        │  PostgreSQL (铭刻/存档/污染池)       │
        │  未配置时自动回退内存存储             │
        └─────────────────────────────────────┘
```

**数据来源**：游戏内容（事件/天赋/年龄/角色/世界）存放在仓库根目录的 `game-data/zh/`(中文) 与 `game-data/en/`(英译)，后端启动时加载。

---

## 🧰 技术栈

- **前端**：TypeScript + Vite（无 UI 框架）；自研游戏引擎式架构（三层渲染 View/Dialog/Popup、页面生命周期、全局单例、事件总线）；`ethers` v6 + MetaMask。
- **后端**：Node.js + TypeScript + Express；确定性规则引擎；`@anthropic-ai/sdk`（AI 总结）；`pg`（PostgreSQL，可选）；`ethers`（EIP-712 签名 + 链上校验）。
- **合约**：Solidity + Foundry（forge/anvil/cast）；OpenZeppelin；ARPA Randcast。
- **链**：BNB Smart Chain（主网 chainId 56；本地 anvil 31337）。
- **数据流水线**：Python（标准库）+ DeepSeek/Claude 辅助的英译与清洗脚本。

---

## 📁 仓库结构

```
AoF/
├── README.md                  英文版（默认）
├── README.zh-CN.md            ← 本文件
└── src/
    ├── front-end/             Vite + TS 前端（当前使用）
    │   └── src/{core,pages,ui,web3,i18n,styles,...}
    ├── back-end/          Node/Express 后端（当前使用）
    │   └── src/{engine,routes,services,db,...}
    ├── contracts/             Foundry 合约（InscriptionNFT / FateRandomnessConsumer + Mock）
    └── uiux/                  设计参考资源
```

---

## 🎮 游戏流程

```
连接钱包 / 游客试玩
   → 天赋选择（3 选，池随进化扩大）
   → 属性分配（基础 20 点 + 连钱包累积；范围随进化放宽）
   → 人生回放（逐年随机事件，可能触发神话时刻）
   → 人生结算（属性峰值 / 综评 / 命运等级 / 雷达图）
   → 命运总结（AI 一句话 + 称号 + 特质）
        ├─ 铭刻（钱包付 50 ARPA 铸 NFT）→ 命运公告栏
        └─ 分享卡（导出 PNG）
   → 命运公告栏（全服铭刻 / 我的图鉴 / 逐条链上验真）
```

---

## ⛓️ 链上与经济模型

| 环节 | 谁付费 | 付什么 | 说明 |
|---|---|---|---|
| **随机数（连钱包）** | 玩家钱包 | 少量 BNB | 直接调 `requestSeed`，付 ARPA Randcast 费 |
| **随机数（游客试玩）** | 后端 operator 代付 | BNB（订阅池） | 前端限 **10 局**；operator 调 `requestSeedFor` |
| **铭刻 NFT** | 玩家钱包 | **50 ARPA** + gas | `approve` + `mint`，命运数据上链 |
| **AI 人生总结** | 运营方 | Claude API | 极短文本，单次成本极低；无 key 走规则兜底 |

- **防伪**：后端用独立的 `AUTHORIZER` 私钥对铭刻参数做 EIP-712 签名，合约校验签名；后端 `/inscribe` 再用 RPC 拉交易回执，核对 tokenId/owner/seed 一致后才落库。
- **验真**：任何人可在公告栏点「验证」，前端用只读 RPC 读合约 `getFate`/`ownerOf`，与展示记录逐项比对。
- **游客不累积属性**：游客固定 20 基础点、默认范围；只有连钱包玩家跨局进化。

---

## 🚀 快速开始

### 本地全功能联调（推荐先跑这个）

用 Foundry `anvil` 在本机拉一条链，部署 Mock 合约，把「随机数 + 铭刻 + 回执校验 + NFT 元数据」全链路跑通。

极简版：

```bash
# 1) 本地链
anvil                                   # RPC :8545, chainId 31337

# 2) 部署 Mock 合约（另开终端）
cd src/contracts && forge script script/DeployLocal.s.sol:DeployLocal \
  --rpc-url http://127.0.0.1:8545 --broadcast \
  --skip FateRandomnessConsumer.sol --skip Deploy.s.sol

# 3) 后端（填 .env：链地址 + AUTHORIZER/OPERATOR 私钥）
cd src/back-end && npm install && npm run dev     # :8787

# 4) 前端（填 .env：VITE_API_BASE + 合约地址）
cd src/front-end && npm install && npm run dev        # :5173
```

### 只跑前端（无需后端/链）

前端 `core` 未配置 `VITE_API_BASE` 时自动使用内置 **Mock 引擎**（确定性 RNG + 三世界示例数据），可独立游玩：

```bash
cd src/front-end && npm install && npm run dev
```

### 生产部署

- 前端：静态构建，部署到 Vercel 等（`npm run build` → `dist/`）。
- 后端：容器化部署到 AWS App Runner / Lightsail（有内存态会话，不适合 serverless）。
- 数据库：AWS RDS PostgreSQL。

---

## 🔧 关键环境变量

**前端 `src/front-end/.env`**
```ini
VITE_API_BASE=http://localhost:8787      # 不填则用本地 Mock 引擎
VITE_BSC_CHAIN_ID=56                      # 主网 56；本地 anvil 31337
VITE_CONSUMER_ADDRESS=0x...               # 随机数消费者合约
VITE_INSCRIPTION_NFT=0x...                # 铭刻 NFT 合约
VITE_PROJECT_TOKEN=0x...                  # ARPA / 铭刻费 token
VITE_BSC_RPC=https://bsc-dataseed.binance.org/   # 只读验真用
```

**后端 `src/back-end/.env`**
```ini
PORT=8787
DATABASE_URL=postgres://...               # 不填则内存存储
ANTHROPIC_API_KEY=sk-ant-...              # 不填则 AI 总结走规则兜底
ANTHROPIC_MODEL=claude-haiku-4-5          # 可选，默认最便宜档
BSC_CHAIN_ID=56
BSC_RPC_URL=https://bsc-dataseed.binance.org/
INSCRIPTION_NFT=0x...
RANDCAST_CONSUMER=0x...
AUTHORIZER_PRIVATE_KEY=0x...              # EIP-712 防伪签名（独立低权限热钱包）
OPERATOR_PRIVATE_KEY=0x...               # 游客随机数代付（独立低权限热钱包）
SEED_COST_BNB=0.0002                      # 连钱包用户 requestSeed 附带的 BNB
ANON_GAME_LIMIT=10                        # 游客免费局数
```

> ⚠️ `AUTHORIZER` / `OPERATOR` 必须是**独立的低权限热钱包**；`.env` 与私钥**绝不入库**。

---

## 🔌 后端 API 概览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/game/new` | 建会话；连钱包→等待链上种子，游客→operator 代付种子 |
| GET  | `/game/:id` | 轮询种子就绪 / 开局信息 |
| POST | `/game/:id/seed` | 连钱包：回传链上种子，后端校验后开局 |
| POST | `/game/:id/play` | 提交天赋+属性，返回逐年时间线与结算 |
| POST | `/game/:id/inscribe/prepare` | 构建铭刻交易 + EIP-712 签名 |
| POST | `/game/:id/inscribe` | 校验 mint 回执 → 落库 → 进公告栏 |
| GET  | `/registry/list` · `/registry/by_player` | 全服 / 个人铭刻 |
| GET  | `/nft/:tokenId` | 标准 ERC-721 元数据 |
| GET  | `/health` | 健康检查（db / ai 状态） |

---

## 🙏 致谢

- 灵感来源：[人生重开模拟器 · lifeRestart](https://github.com/VickScarlet/lifeRestart)
- 随机数：[ARPA Randcast](https://docs.arpanetwork.io/randcast)
- 字体：[Departure Mono](https://justfreefonts.com/fonts/departure-mono/)、[Fusion Pixel](https://github.com/TakWolf/fusion-pixel-font)
