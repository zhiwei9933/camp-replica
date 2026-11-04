# 客服训练营 · 复刻版说明

本目录是按上传的 `project_20261103_084151.tar.gz` 完整复刻的可运行项目，技术栈与原版一致（Next.js 16 App Router + React 19 + TypeScript + Tailwind v4 + shadcn/ui）。

## 一、这个程序是什么

一套医疗客服（白癜风专科）培训系统，包含四个模块：

| 模块 | 路径 | 说明 |
| --- | --- | --- |
| 游戏化闯关训练营 | `/camp` | 8 章 16 小关，学（20）+ 练（30）+ 考（50）= 100 分，70 分通关，星级 90/80/70 分档；第 8 章为 99 分制结业考核 |
| 关卡详情与学习流程 | `/camp/level/[id]`、`/camp/learn/[id]` | 顺序解锁；每关最多 2 次考试，两次成绩取算术平均，首通奖励 +10 |
| 排行榜 | `/camp/leaderboard` | 总分降序，并列按「首次达到当前总分的时间」先后 |
| 错题本 | `/camp/wrong-book` | 学员个人薄弱题复习视图 |
| 章节测验 | `/quiz`、`/quiz/setup`、`/quiz/chapter/[id]` | 按章节答题 + 简答题评分 + 错题建议 |
| 模拟对话训练 | `/training`、`/training/chat`、`/training/report` | 患者角色扮演对话 + 评估报告 |
| 管理后台 | `/admin` | 全员总览、薄弱作答、成绩调整、删除离职学员账号 |

## 二、复刻时做了什么

1. **完整迁移** 134 个源码文件、164 个工程文件，页面与接口一个不少。
2. **补了一层「零外部依赖」本地存储**（原版所有成绩/进度/错题都依赖 Upstash Redis）：
   - 新增 `src/lib/local-store.ts`：文件持久化 KV（默认 `/tmp/camp-local/kv.json`），支持 `GET / SET / DEL / EXISTS / EXPIRE / KEYS / MGET / SCAN / INCR / EVAL`。
   - 修改 `src/lib/upstash.ts`：未配置 `UPSTASH_REDIS_URL` / `UPSTASH_REDIS_TOKEN` 时自动走本地存储，**业务代码零改动**。
   - 项目里用到的 5 段 Lua 脚本（考试提交、成绩 upsert、删除学员三连、审计追加）在本地模式下有等价 JS 实现，行为与线上一致（2 次机会、平均分、首通奖励、原子删除）。
3. **构建验证**：`next build` 全量通过，35 条路由全部产出。

## 三、怎么跑起来

```bash
pnpm install          # 只能用 pnpm，项目内置 only-allow 校验
pnpm dev              # 开发模式，http://localhost:5000
pnpm build && pnpm start   # 生产模式
```

> 注意：本项目依赖较多（809MB node_modules），请在本地磁盘或正常云主机上安装，不要在低性能网络盘上直接 `pnpm install`（会极慢）。

## 四、环境变量

全部可选，不配也能完整跑通（走本地存储）：

| 变量 | 作用 | 不配置时 |
| --- | --- | --- |
| `UPSTASH_REDIS_URL` / `UPSTASH_REDIS_TOKEN` | Upstash Redis REST 地址与令牌 | 使用本地文件存储 `/tmp/camp-local/kv.json` |
| `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL` | 外部 OpenAI 兼容模型（部署到云上时用） | 回落到扣子内部 SDK；都不可用时按关键词降级 |
| `COZE_LOOP_BASE_URL` / `COZE_LOOP_API_TOKEN` | 扣子环境内的模型凭证（仅扣子编程环境） | 自动降级为纯关键词评分，不阻塞提交 |
| `CAMP_ADMIN_TOKEN` | 后台危险操作（删除学员）口令 | 内置默认口令 `camp-admin-2026-7x2q` |
| `CAMP_RECORDINGS_DIR` | 口述题录音目录 | `/tmp/camp-recordings` |

## 五、验证记录（本地实测）

- 13 个页面全部返回 200：`/`、`/camp`、`/camp/leaderboard`、`/camp/wrong-book`、`/camp/level/1`、`/camp/learn/1-1`、`/quiz`、`/quiz/setup`、`/quiz/chapter/1`、`/training`、`/training/chat`、`/training/report`、`/admin`
- 首次考试提交：写入成功，得分 92 → 3 星，首通奖励生效
- 第二次考试提交：成功，最终成绩按平均 (92+60)/2 = 76，星级降为 1 星
- 第三次考试提交：正确拦截，返回 409「本关考试机会已用完（共 2 次）」
- 排行榜：`测试员甲` 总分 86（76 + 首通 10），首达时间正确
- 后台总览：首次 503 warming → 二次返回完整聚合数据
- 删除学员：预览 → 执行 → 成绩精确移除、审计落库、缓存失效，全链路正常
- 章节测验提交、进度同步接口均返回 200

## 六、与原版的关系

- 业务逻辑、页面、文案、评分规则、合规约束（不出现药品商品名、不用「会诊」、不承诺治愈率等）**原样保留**。
- 改动只有两处：存储层降级（脱离 Upstash 也能跑）、模型调用统一入口 `src/lib/llm.ts`（支持外部 OpenAI 兼容接口）。两处都可以通过环境变量切回原行为，业务代码没有改。

## 七、部署到云服务

已附 `Dockerfile`、`render.yaml`、`.dockerignore`，完整步骤和环境变量说明见 **DEPLOY.md**。
