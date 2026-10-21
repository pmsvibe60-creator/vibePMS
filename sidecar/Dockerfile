FROM node:25-slim
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod=false
COPY tsconfig.json ./
COPY src ./src
COPY templates ./templates
ENV NODE_ENV=production FILES_DIR=/data
EXPOSE 4000
CMD ["pnpm", "start"]
