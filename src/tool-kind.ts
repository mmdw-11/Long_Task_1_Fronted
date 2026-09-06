import type { Tool } from './types';
export type ToolKind='code'|'mcp'|'openapi'|'builtin';

/** Adapter wins over storage source: workspace tools are platform-shipped but belong to the code category. */
export function toolKind(tool:Tool):ToolKind {
 const meta=(tool.metadata||{}) as Record<string,unknown>,adapter=String(meta.adapter||'').toLowerCase(),source=String(meta.source||'').toLowerCase();
 if(adapter.startsWith('workspace_')||tool.category==='workspace')return 'code';
 if(source==='mcp'||tool.category==='mcp')return 'mcp';
 if(source==='openapi'||tool.category==='openapi')return 'openapi';
 return 'builtin';
}
