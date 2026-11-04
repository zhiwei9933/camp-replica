# 项目上下文

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4

## 目录结构

```
├── public/                 # 静态资源
├── scripts/                # 构建与启动脚本
│   ├── build.sh            # 构建脚本
│   ├── dev.sh              # 开发环境启动脚本
│   ├── prepare.sh          # 预处理脚本
│   └── start.sh            # 生产环境启动脚本
├── src/
│   ├── app/                # 页面路由与布局
│   ├── components/ui/      # Shadcn UI 组件库
│   ├── hooks/              # 自定义 Hooks
│   ├── lib/                # 工具库
│   │   └── utils.ts        # 通用工具函数 (cn)
│   └── server.ts           # 自定义服务端入口
├── next.config.ts          # Next.js 配置
├── package.json            # 项目依赖管理
└── tsconfig.json           # TypeScript 配置
```

- 项目文件（如 app 目录、pages 目录、components 等）默认初始化到 `src/` 目录下。

### 训练营（/camp）模块结构

游戏化闯关训练营的内容与页面按如下组织：

- `src/lib/camp-data.ts`：类型定义（LearnBlock / LearnCard / PracticeQuestion / ExamQuestion / SubLevel / Level）、`LEVELS` 聚合、`RANKS` 段位。
- `src/lib/camp/chapterN.ts`：每章一个文件，导出 `chapterNSubLevels: SubLevel[]`。共 8 章 16 小关：
  - 第 1 章 3 小关（1-1/1-2/1-3）、第 2 章 2 小关、第 3 章 3 小关、第 4 章 2 小关、第 5 章 2 小关、第 6 章 2 小关、第 7 章 1 小关、第 8 章 1 小关（结业考核）。
- `src/lib/camp-progress.ts`：localStorage 进度、积分、段位、连胜；`saveSubLevelResult` 同步本地，`submitSubLevelRecord` 异步上报 `/api/camp/submit-result`。
- `src/lib/camp-recordings.ts`：口述题录音文件写入 `/tmp/camp-recordings/`，元数据存 Redis key `camp_recordings`（历史功能，学员端已无入口）。
- `src/lib/camp-weak.ts`：后台薄弱作答的**派生存储**（按人分 key）。Redis key `camp_weak:{city}:{staffName}`，value 为该人 `WeakEntry[]` JSON，TTL=-1 永久。每次考核提交（`/api/camp/submit-result`，写入 camp_results 同一次流程、Lua 之后）调用 `buildWeakEntriesFromBreakdown` + `appendWeakEntries` 同步追加本次非满分题（客观题 isCorrect=false / 简答题 awarded<1，按 id 去重）；条目 id = `staffName|city|subId|questionId|submittedAt`（绑定某次提交+某题，重考新 submittedAt 天然是新条目）。薄弱条目**只做展示，主管端暂无删除操作**（无删除接口）。`GET /api/admin/camp-overview` 通过 `scanAllWeakEntries`（`listWeakKeys` SCAN `camp_weak:*` 游标遍历，游标强制 String 化；逐 key GET，解析失败只告警跳过）服务端聚合并按城市/姓名筛选，顶层同时下发 `weakEntries` 与兼容别名 `weakAnswers`/`weakCount`/`weakAggregationMs`（含完整作答原文/选项/解析，不再截断 snippet），服务端按 submittedAt 倒序。**overview 性能架构（`src/lib/camp-admin-agg.ts`）**：`camp_results` 单 key 已达 ~1.1MB，每次完整读回再聚合会超平台 30s 网关超时 → 改「进程内快照 + 单飞后台刷新」：聚合结果存内存快照(`getMemorySnapshot`)，GET 读内存毫秒级返回；过期时 `scheduleRefresh()` 单飞后台用 60s 宽超时重算（常驻进程内跑，不受单次 HTTP 30s 墙限制）并写 Redis 暖缓存 `camp_admin_overview_v1`；冷启动回退读暖缓存（3s 短超时），无数据则 503 warming。城市/姓名筛选在快照完整结果上内存过滤。写入用纯 GET/SET 读改写（`readWeakEntries`+`appendWeakEntries`，按 id 去重，无 TTL），与 camp_progress 同机制，避免 Lua cjson 中文转义差异。**camp_weak 只是可重建的提醒视图，camp_results 才是唯一成绩库；聚合/迁移全程不触碰 camp_results。** 生产环境一次性迁移接口：`POST /api/admin/migrate-weak`（header `x-migrate-token: camp-weak-migrate-2026-9f3a`，或 `Authorization: Bearer`；可用 env `CAMP_WEAK_MIGRATE_TOKEN` 覆盖），重算 camp_results 全量历史非满分题按人写入 camp_weak:*（幂等，按条目 id 去重），迁移前把 camp_results 快照备份到 `camp_results_backup_weak_migration`（TTL=-1，覆盖写）；body `{"dryRun":true}` 可只统计不写入；POST 响应带写后自检 `scannedWeakKeys/scannedWeakEntries/cleanedDirtyKeys`（自动清理"含 camp_weak 但前缀不正确"的误写脏 key，绝不碰 camp_results/camp_progress）。`GET /api/admin/migrate-weak`（同 token）为只读诊断，返回 SCAN 到的每个 key 原始字符串与条目数/字节数、`encodedLikeKeys` 疑似编码脏 key、以及 `KEYS camp_weak:*`/`KEYS *camp_weak*` 对比计数。
- 考核明细（V2.2 起）：`examBreakdown.objectiveScores: ObjectiveQuestionScore[]` 记录每道客观题（选择/判断）的 chosen/correct/isCorrect/score/maxScore；`textScores` 每项带 `maxScore`。
- 简答题评分（V2.3 起，`src/lib/camp-text-scoring.ts` 关键词 + `src/lib/camp-llm-scoring.ts` LLM 兜底）：① 关键词匹配 `normalize()` 在去标点空白基础上，额外剥离情态/助动词插入字（能/会/可以/应该/应当/得/要/去/需/该），使"不能自称医生"→"不自称医生"、"保证能治好"→"保证治好"命中；红线/禁忌类题 keyPoints 同时收录"规范表述"和"被禁止行为表述"（如"随口报价/乱承诺"），学员引述红线行为即算懂。② 服务端权威重算：`/api/camp/submit-result` 收到 breakdown 后，对 `ratio<0.5` 的简答题调用 LLM（doubao-seed-2-0-mini，15s 超时）语义判分，取关键词/LLM 较高系数（awarded 0/0.5/1，阈值 0.5 半分/0.8 满分），命中要点合并，快照写入 `textScores` 的 `llmAwarded/llmMatchedPoints/llmReason`；失败/超时降级为纯关键词结果，不影响提交。重算后以服务端 examScore/bestScore 为准回写 camp_results 与响应（客户端 `applyServerRecord` 回放）。③ 无 0 命中兜底辛苦分；客观题评分、分值结构、通关线不变。④ 历史 camp_results 分数/命中数**冻结不重算**；新逻辑只作用于部署后新提交。后台薄弱作答对无 llmReason 的历史条目显示"按提交时规则自动评阅，仅供带教参考"提示。
- 离职学员账号删除（`POST /api/admin/delete-student`，`src/app/api/admin/delete-student/route.ts` + `src/lib/admin-auth.ts`）：**仅限 camp（专业知识考核系统）数据**，一次只删一人。鉴权双重：① 管理口令 header `x-admin-token`（env `CAMP_ADMIN_TOKEN` 覆盖，默认内置 `camp-admin-2026-7x2q`，常量时间比较；学员免密身份不可调用）；② body `confirmName` 必须与 `staffName` 完全一致。删除范围：`camp_results` 大 key 用 Lua 按 `city+staffName` 精确过滤（其他学员记录原样保留，返回 removed 明细）、个人 key `camp_weak:{city}:{staffName}` 与 `camp_progress:{city}:{staffName}` DEL、遗留 `camp_recordings` 数组按 city+employee 过滤；**不触碰 training_results / quiz_results**。删除前若该人 0 条成绩记录则 404 中止、空删保护。删除后调 `invalidateOverviewSnapshot()`/`invalidateLeaderboardSnapshot()` 清内存快照+DEL 暖缓存并后台重建。审计写独立 key `camp_admin_audit`（JSON 数组，最新在前、上限 500 条，不随学员删除）：action/project/city/staffName/operator/deletedAt + snapshot（resultCount/subIds/bestScoreSum/passedCount/lastSubmittedAt/各 key 是否删除），不含作答原文。同路由 `GET ?city=&staffName=`（同口令）为删除前预览。前端 `src/app/admin/page.tsx` 总览表每行红色【删除账号】，AlertDialog 列将删数据+手动输入姓名，口令存 sessionStorage(`camp_admin_token`)。
- `src/app/camp/page.tsx`：训练营首页（Hero/排行榜/继续学习/闯关地图）。
- `src/app/camp/level/[id]/page.tsx`：关卡详情（小关列表 + 顺序解锁）。
- `src/app/camp/learn/[id]/page.tsx`：学-练-考主流程；`final-exam.tsx` 为第 8 章抽题考核（口试 15 选 7 / 情景 10 选 5 / 判断 5 题全做，满分 99）。
- `src/app/camp/leaderboard/page.tsx`：排行榜（空状态友好，真实数据来自 `/api/camp/leaderboard`）。
- **排行榜排序口径（`src/lib/camp-leaderboard-agg.ts`）**：同 overview 采用「进程内快照 + 单飞后台刷新 + Redis 暖缓存 `camp_leaderboard_v1`」，避免每次读大 key `camp_results`（约21s）。总分 = 各小关最终 bestScore 合计 + 首通奖励 +10（历史冻结，重考取该小关最新提交即最终分）。排序：总分降序 → 并列时按「首次达到当前总分时间」(reachTimeMs) 升序（先达到者领先）→ 无 submittedAt/无法定首达者排后 → 再姓名/城市稳定。reachTimeMs 口径：按 submittedAt 升序重放参与总分的小关最终记录，累计 bestScore(+奖励) 首次 ≥ 当前总分的那条的时间（重考刷分提升总分时首达时间随之延后）。`/api/camp/leaderboard`（前台首页与排行榜页消费）与后台 `camp-admin-agg` overview summary 均使用该一致口径（后台 summary 总分=bestScoreSum 不含奖励，并列同样按 reachTimeMs 次级排序）。
- `src/app/camp/wrong-book/page.tsx`：学员个人错题本（只读复习视图，措辞为"错题复习"无管理视角词）。身份取自 `quiz_user_info`（`getUserInfo`，无身份引导 `/quiz/setup?from=camp`）；数据来自 `GET /api/camp/my-weak?city=&staffName=`（直接 GET 该人 `camp_weak:{city}:{staffName}` 单 key，不 SCAN，按 submittedAt 倒序）；顶部汇总错题总数+题型计数，支持章节（按实际有错题的章节动态生成）与"全部/只看简答/只看客观题"筛选；客观题展示选项正误对照+解析，简答题展示完整原文+参考要点命中态，有 llmReason 显示"AI 评阅"；空态"还没有错题，继续保持！"。首页快捷入口【错题本】指向 `/camp/wrong-book`。
- `src/components/audio-recorder.tsx`：MediaRecorder 录音组件（audio/webm → mp4 → ogg 降级，120s 上限）。

小关分值：学 20 + 练 30 + 考 50 = 100，70 分通关；星级 90+ 三星、80-89 两星、70-79 一星。第 8 章为 99 分制，70 分通关。小关按顺序解锁，第 8 章需前 7 章全部通关。

考试规则（V2.1 起）：每员工每小关最多 2 次考试机会（首次 + 1 次重考），第 2 次提交后入口关闭（服务端 Lua 原子拦截，409 rejected）。最终成绩：1 次=该次；2 次=两次算术平均四舍五入（`attemptsList` 存每次明细，`bestScore` 字段语义=最终成绩，不再取最高）。首次通关（含重考首达 70）发 10 分奖励一次。重考必须重新完成学习→练习→考试（点击重考调 `resetLocalStageMarks` 清本地学/练打点）。考试页/结果页有琥珀色规则横幅；结果页【重考本关】仅 `remainingAttempts>0` 显示。历史数据无 `attemptsList` 视为 1 次、剩余 1 次机会（`normalizeRecord`/Lua 兼容）。换机考第 2 次以服务端快照次数为准（`applyCloudProgress` 云端 attempts 权威）。

### 合规要点（训练营内容通用）

- 不出现具体药品商品名，讲药物类别与角色代号（消防员/调解员/精准导弹/重武器/后勤/养护）。
- 不使用"会诊"，统一用"学术交流/交流学习"。
- 不承诺"治愈率/根治/包好"，使用"控制、恢复、复色、管理"等表述。
- 城市特定信息（如"温州唯一进口 308"）不写进通用 camp 内容，走 `getKnowledgeBase(city)` 注入。

## 包管理规范

**仅允许使用 pnpm** 作为包管理器，**严禁使用 npm 或 yarn**。
**常用命令**：
- 安装依赖：`pnpm add <package>`
- 安装开发依赖：`pnpm add -D <package>`
- 安装所有依赖：`pnpm install`
- 移除依赖：`pnpm remove <package>`

## 开发规范

### 编码规范

- 默认按 TypeScript `strict` 心智写代码；优先复用当前作用域已声明的变量、函数、类型和导入，禁止引用未声明标识符或拼错变量名。
- 禁止隐式 `any` 和 `as any`；函数参数、返回值、解构项、事件对象、`catch` 错误在使用前应有明确类型或先完成类型收窄，并清理未使用的变量和导入。

### next.config 配置规范

- 配置的路径不要写死绝对路径，必须使用 path.resolve(__dirname, ...)、import.meta.dirname 或 process.cwd() 动态拼接。

### Hydration 问题防范

1. 严禁在 JSX 渲染逻辑中直接使用 typeof window、Date.now()、Math.random() 等动态数据。**必须使用 'use client' 并配合 useEffect + useState 确保动态内容仅在客户端挂载后渲染**；同时严禁非法 HTML 嵌套（如 <p> 嵌套 <div>）。
2. **禁止使用 head 标签**，优先使用 metadata，详见文档：https://nextjs.org/docs/app/api-reference/functions/generate-metadata
   1. 三方 CSS、字体等资源可在 `globals.css` 中顶部通过 `@import` 引入或使用 next/font
   2. preload, preconnect, dns-prefetch 通过 ReactDOM 的 preload、preconnect、dns-prefetch 方法引入
   3. json-ld 可阅读 https://nextjs.org/docs/app/guides/json-ld

## UI 设计与组件规范 (UI & Styling Standards)

- 模板默认预装核心组件库 `shadcn/ui`，位于`src/components/ui/`目录下
- Next.js 项目**必须默认**采用 shadcn/ui 组件、风格和规范，**除非用户指定用其他的组件和规范。**
