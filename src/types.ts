// 前端共享类型定义，和 FastAPI 返回结构保持一致。
export type Json = Record<string, unknown>;
export interface Agent { id:string; name:string; sys_prompt:string; model:string; description:string; config:Json; parent_id?:string|null; children:string[] }
export type LogicNodeKind='agent'|'script'|'condition'|'intent'|'loop'|'batch';
export interface GraphConnection {source:string;target:string;conditional?:boolean;condition_key?:string;path_map?:Record<string,string>;edge_type?:'direct'|'condition'|'intent'|'loop'|'batch'}
export interface GraphData { agents:Agent[]; connections:GraphConnection[]; entry_id?:string|null; entry?:string|null }
export interface Workflow { id:string; name:string; description:string; tags:string[]; metadata:Json; graph:GraphData; created_at:string; updated_at:string; version:number }
export interface Application { id:string; name:string; app_type:string; description:string; status:string; workflow_id:string; entry_agent_id:string; model:string; system_prompt:string; tool_ids:string[]; skill_ids:string[]; metadata:Json; created_at:string; updated_at:string }
export interface Run { id:string; workflow_id?:string|null; status:string; input:Json; recursion_limit:number; state:Json; events:Json[]; error?:string|null; parent_run_id?:string|null; retry_count:number; metadata:Json; created_at:string; updated_at:string; finished_at?:string|null; canceled_at?:string|null }
export interface Skill { id:string; name:string; content:string; description:string; tags:string[]; status:string; version:number; validation?:Json|null; approved_by?:string|null; rollout_percent?:number; metadata:Json; created_at:string; updated_at:string }
export interface Tool { id:string; name:string; display_name:string; description:string; category:string; enabled:boolean; tags:string[]; metadata:Json; created_at:string; updated_at:string }
export interface MCPTool { name:string; title?:string; description:string; input_schema:Json; enabled?:boolean; enabled_for_agent?:boolean }
export interface AgentMCPBinding { id:string; agent_id:string; mcp_server_id:string; enabled:boolean; enabled_tools:string[]; server:{id:string;name:string;transport:string;endpoint:string;auth_type:string;status:string;tools:MCPTool[];last_synced_at:string;has_auth_secret:boolean}; tools:MCPTool[]; created_at:string; updated_at:string }
export interface ApiKeyRecord { id:string; name:string; prefix:string; scope:string; enabled:boolean; created_by:string; created_at:string; updated_at:string; last_used_at:string; secret?:string }
export interface SystemStatus { now:string; capabilities:Record<string,boolean>; models:Record<string,{base_url:string;model:string;configured:boolean}>; storage:Record<string,string>; security?:{admin_key_enabled:boolean;audit_log_path:string}; api_access?:{openai_compatible_base_url:string;anthropic_base_url:string;workspace:string;api_key_count:number} }
export interface AuthUser { id:string; email:string; name:string; created_at:string }
