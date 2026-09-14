# AgentForge Console

与 `long_task_1` FastAPI 后端完整配套的 React + TypeScript 管理控制台。

## Docker 运行

不要单独启动此前端目录。请到相邻后端目录 `../long_task_1` 执行：

```bash
docker compose up --build -d
```

随后访问 `http://localhost:8080`。生产部署下 nginx 会把 `/api` 自动转发到后端容器，页面的“后端连接”应保持默认值 `/`。

## 启动

```powershell
npm install
npm run dev
```

`npm run dev` 会先检查 FastAPI；8000 端口未启动时会自动从相邻的 `long_task_1` 目录启动后端，再启动 Vite。默认使用 `/api` 同源请求，开发服务器会将其代理到 `http://127.0.0.1:8000`；也可在“连接设置”页面切换地址、操作者和管理员密钥。

后端启动日志位于：

```text
../long_task_1/runs/server.out.log
../long_task_1/runs/server.err.log
```

## 页面与后端能力

- 总览：系统指标、近期运行、模型资源状态
- Agent 编排：Agent 创建/删除、入口设置、节点连接、画布与配置查看
- 工作流：保存、加载、删除、版本历史、回滚、快速运行
- 运行中心：后台执行、自动轮询、事件/结果/技能轨迹、取消、重试、生成技能
- 技能治理：创建、检索、验证、发布、拒绝、退役、灰度、版本回滚
- 工具目录：完整 CRUD 与启停管理
- 系统管理：能力状态、模型端点、审计日志、系统快照下载
- 连接设置：`X-Actor` 与 `X-Admin-Key`

## 构建

```powershell
npm run build
```
