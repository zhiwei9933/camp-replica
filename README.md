# 客服训练营

面向医疗客服团队的游戏化培训系统：闯关式学习、章节测验、AI 患者模拟对话、排行榜与错题本，配套管理后台。

## 功能

| 模块 | 路径 | 说明 |
|---|---|---|
| 训练营首页 | `/camp` | 八关闯关地图、进度与星级 |
| 关卡学习 | `/camp/learn/[id]` | 每关的知识点与话术要点 |
| 关卡考试 | `/camp/level/[id]` | 学习 / 练习 / 考试三段计分，2 次考试机会 |
| 排行榜 | `/camp/leaderboard` | 总分、首通奖励、城市榜 |
| 错题本 | `/camp/wrong-book` | 按知识点聚合的薄弱项 |
| 章节测验 | `/quiz` | 单选、多选、判断、简答，支持 AI 语义评分 |
| 话术训练 | `/training/chat` | AI 扮演患者多轮对话，结束后按 14 个环节评分 |
| 管理后台 | `/admin` | 全员进度总览、学员删除、审计记录 |

## 技术栈

Next.js 16（App Router）+ React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui，自定义 Node server（`src/server.ts`，由 tsup 打包为 `dist/server.js`）。

## 本地运行

```bash
pnpm install
pnpm dev          # http://localhost:5000
```

生产构建：

```bash
pnpm build        # next build + tsup 打包 server
pnpm start        # node dist/server.js
```

## 环境变量

全部可选，不配也能跑：

| 变量 | 作用 | 不配置时 |
|---|---|---|
| `UPSTASH_REDIS_URL` / `UPSTASH_REDIS_TOKEN` | 成绩、进度、排行榜存储 | 落本地文件（重启清空） |
| `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL` | 患者模拟对话、主观题评分 | 关键词降级，AI 功能不可用 |
| `CAMP_ADMIN_TOKEN` | 后台删除学员口令 | 内置默认值，**上线必须改** |
| `CAMP_RECORDINGS_DIR` | 口述题录音目录 | `/tmp/camp-recordings` |

## 部署

仓库自带 `Dockerfile`、`render.yaml`、`.dockerignore`，可部署到任意容器平台（Render / Koyeb / Hugging Face Spaces / Cloud Run 等）。

详细步骤与常见问题见 [DEPLOY.md](./DEPLOY.md)。

## 文档

- [DEPLOY.md](./DEPLOY.md) — 免费云部署步骤
- [REPLICA.md](./REPLICA.md) — 复刻说明、改动清单与验证记录
- [DESIGN.md](./DESIGN.md) — 设计规范
- [AGENTS.md](./AGENTS.md) — 协作约定
