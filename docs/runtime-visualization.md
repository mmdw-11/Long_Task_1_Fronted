# 运行过程可视化设计

运行界面不要求模型输出私有思维过程，也不让模型自行声明虚假的工具调用。

后端执行引擎产生结构化事件：

```text
node_start   进入 Agent
node_end     Agent 完成并附带可见输出、执行器和模型
route        确定下一执行节点
final        图执行结束
run_completed 运行状态、耗时和总结确定
```

`GET /api/runs/{run_id}/events` 使用 SSE 推送这些事件。前端按事件类型渲染不同字号、颜色和层级；运行结束后自动折叠完整过程，保留“展开完整过程”入口，并展示依据全部节点输出生成的有序总结。

工具事件只消费后端推理结果 `metadata.tool_calls` 中的真实调用。当前 Tool Catalog 是元数据目录，尚未提供任意工具执行器和模型 function-calling 循环，因此不会根据描述伪造工具调用。后续接入执行器时应产生独立的 `tool_start`、`tool_end`、`tool_error` 事件，并在高风险工具前增加审批事件。
