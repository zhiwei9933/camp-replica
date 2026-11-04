# 部署到免费云服务

这个项目是 Next.js 16 + 自定义 Node server（`dist/server.js`），**必须跑在常驻 Node 容器里**，所以不能直接丢到 Vercel / Cloudflare Pages（它们只跑标准 Next 或边缘函数）。

下面按「上手难度 × 免费程度」排序。

---

## 先搞清楚两个真实限制

### 1. 数据默认存在本地文件
项目原来依赖 Upstash Redis，我加了本地文件降级。免费平台（Render / Koyeb / HF Spaces）的容器文件系统**重启就清空**，所以：

- 想让成绩、排行榜、错题本长期保留 → 注册一个免费的 Upstash Redis（10K 命令/天，够几百人用），填两个环境变量就自动切过去。
- 只是给人看看效果 → 不配也行，重启后数据归零。

### 2. AI 功能依赖扣子内部模型
话术训练对话、主观题评分原来调的是扣子内部模型，外部环境调不通。我已经加了统一入口 `src/lib/llm.ts`：配置 `LLM_API_KEY` 后自动改走任意 OpenAI 兼容接口（DeepSeek、通义、豆包方舟、智谱、OpenAI 都行）。不配的话这些接口会走降级逻辑，页面能开、题库和计分正常，但患者模拟对话不可用。

---

## 方案对比（2026 年免费额度）

| 平台 | 免费额度 | 要信用卡 | 休眠 | 适合 |
|---|---|---|---|---|
| **Render** | 750 小时/月，512MB 内存，5GB 流量 | 否 | 15 分钟无访问休眠，约 1 分钟唤醒 | 最省事，推荐先试 |
| **Koyeb** | 1 个服务，512MB，100GB 流量 | 是（$29 预授权） | 1 小时无访问，1-5 秒唤醒 | 几乎不休眠 |
| **Hugging Face Spaces** | 免费 Docker Space，内存大 | 否 | 48 小时无访问才休眠 | 构建不怕内存不够 |
| **腾讯云 CloudBase 云托管** | 有免费额度 | 实名 | 可配 0 副本 | 国内访问快 |

> 512MB 内存是 Render / Koyeb 免费层的硬门槛。Next 16 构建峰值可能超，构建失败就换 Hugging Face Spaces 或本地构建好推镜像。

---

## Render 部署步骤（约 10 分钟）

1. 把 `camp-replica` 目录推到 GitHub（公开或私有都行）。
2. 打开 [render.com](https://render.com) 用 GitHub 登录，**不需要绑卡**。
3. New → **Web Service** → 选中这个仓库。Render 会自动识别根目录的 `Dockerfile`，Runtime 显示 Docker。
4. Instance Type 选 **Free**。
5. 在 Environment 里填环境变量（见下表），Region 选 Singapore（离国内近）。
6. 点 Create Web Service，等构建完成（首次约 5-10 分钟）。
7. 拿到 `https://xxx.onrender.com` 就能用了。

也可以用仓库里的 `render.yaml` 走 Blueprint 一键创建。

---

## 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `UPSTASH_REDIS_URL` | 建议 | Upstash Redis 的 REST URL，配了就自动用远程存储 |
| `UPSTASH_REDIS_TOKEN` | 建议 | 上面配套的 Token |
| `LLM_API_KEY` | 可选 | 任意 OpenAI 兼容服务的 Key，配了 AI 功能才可用 |
| `LLM_BASE_URL` | 可选 | 默认 `https://api.deepseek.com/v1` |
| `LLM_MODEL` | 可选 | 默认 `deepseek-chat` |
| `CAMP_ADMIN_TOKEN` | 建议 | 管理后台口令，不填用内置默认 `camp-admin-2026-7x2q`，**上线务必改** |
| `CAMP_LOCAL_DATA_DIR` | 可选 | 本地降级存储目录，默认 `/tmp/camp-local` |

### Upstash 免费 Redis 怎么开
1. [upstash.com](https://upstash.com) 注册（免信用卡）。
2. Create Database → 选免费计划、Region 选 Singapore。
3. 进数据库详情，复制 **UPSTASH_REDIS_REST_URL** 和 **UPSTASH_REDIS_REST_TOKEN**，分别填到上面两个变量。

### LLM 怎么配（以 DeepSeek 为例）
```
LLM_API_KEY=sk-xxxx
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_MODEL=deepseek-chat
```
豆包方舟、通义、智谱的 base_url 各自不同，填对应的 `/v1` 地址即可。

---

## 本地验证部署形态

```bash
docker build -t camp-replica .
docker run -p 5000:5000 -e CAMP_ADMIN_TOKEN=your-token camp-replica
# 打开 http://localhost:5000/camp
```

---

## 常见问题

**构建时 OOM（exit 137）**
免费层 512MB 不够 Next 构建。换 Hugging Face Spaces（内存宽松），或在 GitHub Actions 里构建镜像再推 Docker Hub，Render 选 Image 部署。

**访问很慢 / 第一次要等 1 分钟**
Render 免费服务 15 分钟无访问会休眠，属正常。Koyeb 只休眠 1 小时且唤醒 1-5 秒，更接近常驻。

**数据每次重启都没了**
没配 Upstash Redis，容器文件系统是临时的。按上面步骤接 Redis 即可。

**话术训练一直转圈**
没配 `LLM_API_KEY`，或者 Key / base_url / 模型名不匹配。看服务日志里的 `LLM 请求失败 xxx` 能定位。
