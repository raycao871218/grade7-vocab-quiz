# 七年级英语词汇摸底

一个给小朋友做新版人教版七年级英语词汇摸底的小应用。

## 架构

- `src/`：React 前端。
- `server/`：FastAPI 后端，负责访问 PostgreSQL 并提供 `/api`。
- `db/`：数据库表结构。
- `scripts/`：一次性迁移和词表导入脚本。

## 功能

- 后端从 PostgreSQL 读取词表、单词、中文释义和英文例句。
- 三种练习模式：英译中选择、看中文拼英文、拼写自测。
- 拼写自测支持三档难度：简单显示中文和字母提示，中等只显示中文，困难显示英文填空句。
- 记录正确率、进度和错题。

## 初始化

```bash
cp .env.example .env
npm install
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
npm run db:migrate
npm run db:seed
```

## 开发启动

先启动后端：

```bash
.venv/bin/uvicorn server.main:app --host 0.0.0.0 --port 8000
```

再启动前端：

```bash
npm run dev
```

电脑上打开终端显示的本地地址。手机在同一局域网时，打开 Vite 显示的 `Network` 地址，比如 `http://10.10.0.6:5173/`。

也可以通过 npm 启动后端：

```bash
npm run dev:api
```

## Docker 部署

普通联网环境：

```bash
npm run build
docker compose up -d --build
```

Synology NAS 如果已有 Container Manager 但无法联网拉 Python 镜像，可以使用 NAS 专用 compose 文件。该文件基于 NAS 上已有的 `node:22-trixie` 镜像，并通过本地准备的 `.docker-wheels/` 和 `get-pip.py` 离线安装 Python 依赖：

```bash
docker compose -f docker-compose.nas.yml up -d --build
```

服务启动后访问：

```text
http://NAS_IP:8000/
```

## 数据库配置

在 `.env` 中修改：

```bash
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=grade7
DB_USER=grade7
DB_PASSWORD=change-me
VOCAB_LIST_SLUG=grade7-renjiao-placement
API_PROXY_TARGET=http://127.0.0.1:8000
VOCAB_SOURCE_PATH=/absolute/path/to/vocab.md
```

`VOCAB_SOURCE_PATH` 只用于 `npm run db:seed` 从现有 Markdown 词表做一次性导入。应用运行时是：

```text
React 前端 -> FastAPI /api/vocab -> PostgreSQL
```

开发环境里 Vite 会把 `/api` 代理到 `API_PROXY_TARGET`。

## 后端接口

- `GET /api/health`：健康检查。
- `GET /api/vocab`：读取 `.env` 中 `VOCAB_LIST_SLUG` 指定的词表。
- `GET /api/vocab?list_slug=grade7-renjiao-placement`：读取指定词表。

## 数据结构

- `vocab_lists`：词表，比如七年级摸底词表、八年级拓展词表。
- `vocab_words`：标准英文词条，按规范化英文去重。
- `vocab_list_items`：词条在某个词表里的顺序、是否加测。
- `vocab_meanings`：释义，当前使用 `zh-CN`。
- `vocab_examples`：例句和填空句，当前困难模式读取 `hard` 难度例句。
