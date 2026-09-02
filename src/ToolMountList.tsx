import { useMemo, useState } from 'react';
import type { Tool } from './types';
import './tool-mount-list.css';

type Props = {
  tools: Tool[];
  selected: string[];
  toggle: (id: string) => void;
  changeMany: (ids: string[], add: boolean) => void;
  emptyText?: string;
};

export function ToolMountList({tools, selected, toggle, changeMany, emptyText}: Props) {
  const [expanded, setExpanded] = useState<string[]>([]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const mounted = useMemo(() => tools.filter(tool => selectedSet.has(tool.id)), [tools, selectedSet]);
  const groups = useMemo(() => groupTools(mounted), [mounted]);
  if (!mounted.length) return <div className="tool-mount-list empty"><div>{emptyText || '暂无可用资源，请先在控制台对应模块中创建。'}</div></div>;
  return <div className="tool-mount-list">{groups.map(group => {
    const usable = group.tools.filter(tool => tool.enabled);
    const checked = usable.length > 0 && usable.every(tool => selectedSet.has(tool.id));
    const open = expanded.includes(group.key);
    return <section className="tool-mount-group" key={group.key}>
      <header>
        <button type="button" className="tool-mount-expand" onClick={() => setExpanded(values => values.includes(group.key) ? values.filter(value => value !== group.key) : [...values, group.key])} aria-label={`${open ? '收起' : '展开'} ${group.name}`}>{open ? '⌄' : '›'}</button>
        <span><b>{group.name}</b><small>{group.type} · {group.tools.length} 个工具</small></span>
        <label>
          <input type="checkbox" disabled={!usable.length} checked={checked} onChange={() => changeMany(usable.map(tool => tool.id), !checked)} />
        </label>
      </header>
      {open && <div className="tool-mount-tools">{group.tools.map(tool => <label className={!tool.enabled ? 'disabled' : ''} key={tool.id}>
        <input type="checkbox" disabled={!tool.enabled} checked={selectedSet.has(tool.id)} onChange={() => toggle(tool.id)} />
        <span><b>{tool.display_name || tool.name}</b><small>{tool.description || '暂无描述'}</small></span>
        <em>{toolBadge(tool)}</em>
      </label>)}</div>}
    </section>;
  })}</div>;
}

type ToolGroup = { key: string; name: string; type: string; tools: Tool[] };

function groupTools(tools: Tool[]): ToolGroup[] {
  const map = new Map<string, ToolGroup>();
  for (const tool of tools) {
    const meta = (tool.metadata || {}) as Record<string, unknown>;
    const source = toolSource(tool);
    const endpoint = String(meta.mcp_url || meta.operation_url || '');
    const connection = String(meta.connection_id || meta.mcp_server_id || endpoint || source);
    const key = `${source}:${connection || 'default'}`;
    const name = source === 'builtin'
      ? '平台内置工具'
      : String(meta.connection_name || meta.mcp_name || meta.market_slug || (source === 'openapi' ? 'OpenAPI 服务' : 'MCP 服务'));
    const type = source === 'builtin' ? 'BUILTIN' : source.toUpperCase();
    if (!map.has(key)) map.set(key, {key, name, type, tools: []});
    map.get(key)!.tools.push(tool);
  }
  return [...map.values()];
}

function toolSource(tool: Tool) {
  const source = String((tool.metadata as Record<string, unknown> | undefined)?.source || '').toLowerCase();
  if (source === 'mcp' || tool.category === 'mcp') return 'mcp';
  if (source === 'openapi' || tool.category === 'openapi') return 'openapi';
  return 'builtin';
}

function toolBadge(tool: Tool) {
  const source = toolSource(tool);
  if (source === 'builtin') return '内置';
  return source.toUpperCase();
}
