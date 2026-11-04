# 客服训练营 - 生产镜像
# 适用于 Render / Koyeb / Hugging Face Spaces / Google Cloud Run 等任意容器平台

# ---------- 构建阶段 ----------
FROM node:22-slim AS builder

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1 \
    # 免费容器通常只有 512MB 内存，压低 V8 堆上限避免被 OOM 杀掉
    NODE_OPTIONS=--max-old-space-size=420

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

# 先装依赖（含 devDependencies，next build / tsup 都要用），利用镜像层缓存
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --prefer-frozen-lockfile

# 再拷源码并构建
COPY . .
RUN NODE_ENV=production pnpm next build \
 && pnpm tsup src/server.ts --format cjs --platform node --target node20 --outDir dist --no-splitting --no-minify

# ---------- 运行阶段 ----------
FROM node:22-slim AS runner

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=5000 \
    NODE_OPTIONS=--max-old-space-size=380

WORKDIR /app

COPY --from=builder /app ./

EXPOSE 5000

CMD ["node", "dist/server.js"]
