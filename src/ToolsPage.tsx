// 工具管理页面，提供内置工具、MCP URL 和手写脚本三种接入控件。
import { useEffect, useMemo, useState } from 'react';
import type { ApiClient } from './api';
import type { Tool } from './types';
import './tools-page.css';

type Props = { api: ApiClient; notify: (s: string, b?: boolean) => void };
type ToolMode = 'builtin' | 'mcp' | 'script';

const modeOptions: Array<{ key: ToolMode; title: string; desc: string }> = [
  { key: 'builtin', title: '内置工具', desc: '绑定后端白名单适配器' },
  { key: 'mcp', title: 'MCP 服务', desc: '填写 MCP HTTP URL' },
  { key: 'script', title: '脚本工具', desc: '编写 Python 脚本' },
];

export function ToolsPage({ api, notify }: Props) {
  const q = useTools(api, notify);
  const [create, setCreate] = useState(false);
  const [edit, setEdit] = useState<Tool | null>(null);
  const enabledCount = q.tools.filter((item) => item.enabled).length;

  const submit = async (payload: unknown) => {
    try {
      if (edit) await api.put(`/api/tools/${edit.id}`, payload);
      else await api.post('/api/tools', payload);
      notify(edit ? '工具已更新' : '工具已接入');
      setCreate(false);
      setEdit(null);
      q.reload();
    } catch (error) {
      notify((error as Error).message, true);
    }
  };
  const test = async (tool: Tool) => {
    try {
      const result = await api.post<any>(`/api/tools/${tool.id}/test`, { task: `测试 ${tool.display_name} 工具连接` });
      if (result.status === 'approval_required') notify(`${tool.display_name} 需要审批，已验证安全门禁生效`);
      else if (result.status === 'succeeded') notify(`${tool.display_name} 测试成功`);
      else notify(`${tool.display_name} 测试失败：${result.error || '适配器未返回结果'}`, true);
    } catch (error) { notify((error as Error).message, true); }
  };

  return (
    <>
      <div className="tools-hero">
        <div>
          <span>TOOL ACCESS</span>
          <h2>工具接入</h2>
          <p>把内置能力、MCP 服务和脚本工具统一注册到后端，再按 Agent 维度授权使用。</p>
        </div>
        <button className="primary" onClick={() => setCreate(true)}>＋ 添加工具</button>
      </div>
      <div className="tool-mode-strip">
        {modeOptions.map((item) => (
          <div key={item.key}>
            <b>{item.title}</b>
            <small>{item.desc}</small>
          </div>
        ))}
      </div>
      <div className="toolbar">
        <div className="filter-tabs">
          <button className="active">全部</button>
          <button>已启用 {enabledCount}</button>
        </div>
      </div>
      {!q.loaded ? (
        <EmptyState loading={q.loading} error={q.error} />
      ) : (
        <article className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>工具</th>
                <th>接入方式</th>
                <th>后端适配器</th>
                <th>风险</th>
                <th>状态</th>
                <th>更新时间</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {q.tools.map((tool) => (
                <tr key={tool.id}>
                  <td>
                    <b>{tool.display_name}</b>
                    <small className="block">{tool.description || '暂无描述'}</small>
                  </td>
                  <td><span className="pill">{sourceLabel(tool)}</span></td>
                  <td><code>{String(tool.metadata?.adapter || tool.name)}</code></td>
                  <td><span className={`risk ${String(tool.metadata?.risk || 'low')}`}>{String(tool.metadata?.risk || 'low')}</span></td>
                  <td><StatusText value={tool.enabled ? '启用' : '停用'} ok={tool.enabled} /></td>
                  <td>{formatDate(tool.updated_at)}</td>
                  <td>
                    <button onClick={() => setEdit(tool)}>编辑</button>
                    <button onClick={() => test(tool)}>测试</button>
                    <button className="danger-link" onClick={() => q.remove(tool.id)}>删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!q.tools.length && <EmptyState text="还没有工具，请先添加一个 MCP 服务或脚本工具。" />}
        </article>
      )}
      {(create || edit) && (
        <ToolEditor
          tool={edit}
          onClose={() => { setCreate(false); setEdit(null); }}
          onSubmit={submit}
        />
      )}
    </>
  );
}

function ToolEditor({ tool, onClose, onSubmit }: { tool: Tool | null; onClose: () => void; onSubmit: (v: unknown) => void }) {
  const initialMode = (tool?.metadata?.source as ToolMode) || (tool?.metadata?.mcp_url ? 'mcp' : tool?.metadata?.script ? 'script' : 'builtin');
  const [mode, setMode] = useState<ToolMode>(initialMode);
  const [form, setForm] = useState({
    name: tool?.name || '',
    display_name: tool?.display_name || '',
    description: tool?.description || '',
    category: tool?.category || 'utility',
    tags: (tool?.tags || []).join(','),
    enabled: tool?.enabled ?? true,
    adapter: String(tool?.metadata?.adapter || ''),
    risk: String(tool?.metadata?.risk || 'low'),
    mcp_url: String(tool?.metadata?.mcp_url || tool?.metadata?.url || ''),
    method: String(tool?.metadata?.method || 'tools/list'),
    script: String(tool?.metadata?.script || defaultScript()),
    timeout_seconds: String(tool?.metadata?.timeout_seconds || '8'),
  });
  const finalAdapter = useMemo(() => {
    if (mode === 'mcp') return 'mcp_http';
    if (mode === 'script') return 'script';
    return form.adapter.trim() || form.name.trim();
  }, [form.adapter, form.name, mode]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const metadata = {
      ...(tool?.metadata || {}),
      source: mode,
      adapter: finalAdapter,
      risk: form.risk,
      timeout_seconds: Number(form.timeout_seconds || 8),
      ...(mode === 'mcp' ? { mcp_url: form.mcp_url.trim(), method: form.method.trim() || 'tools/list' } : {}),
      ...(mode === 'script' ? { language: 'python', script: form.script } : {}),
    };
    onSubmit({
      name: form.name.trim(),
      display_name: form.display_name.trim(),
      description: form.description,
      category: mode === 'mcp' ? 'mcp' : form.category,
      enabled: form.enabled,
      tags: split(form.tags),
      metadata,
    });
  };

  return (
    <div className="overlay">
      <div className="modal wide">
        <div className="modal-head">
          <h2>{tool ? '编辑工具' : '添加工具'}</h2>
          <button onClick={onClose}>×</button>
        </div>
        <form className="tool-editor" onSubmit={submit}>
          <div className="mode-tabs">
            {modeOptions.map((item) => (
              <button type="button" className={mode === item.key ? 'active' : ''} onClick={() => setMode(item.key)} key={item.key}>
                <b>{item.title}</b>
                <small>{item.desc}</small>
              </button>
            ))}
          </div>
          <div className="form-grid">
            <label>显示名称<input required value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></label>
            <label>唯一标识<input required disabled={!!tool} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>分类<input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label>
            <label>标签<input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="email,mcp,read" /></label>
            <label>后端适配器<input disabled={mode !== 'builtin'} value={finalAdapter} onChange={(e) => setForm({ ...form, adapter: e.target.value })} /></label>
            <label>风险等级<select value={form.risk} onChange={(e) => setForm({ ...form, risk: e.target.value })}><option value="low">low</option><option value="read">read</option><option value="medium">medium</option><option value="high">high</option></select></label>
            <label className="span">描述<textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            {mode === 'mcp' && (
              <>
                <label className="span">MCP HTTP URL<input required value={form.mcp_url} onChange={(e) => setForm({ ...form, mcp_url: e.target.value })} placeholder="http://127.0.0.1:3000/mcp" /></label>
                <label>JSON-RPC 方法<input value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} /></label>
                <label>超时秒数<input value={form.timeout_seconds} onChange={(e) => setForm({ ...form, timeout_seconds: e.target.value })} /></label>
              </>
            )}
            {mode === 'script' && (
              <label className="span">Python 脚本<textarea className="code" rows={12} value={form.script} onChange={(e) => setForm({ ...form, script: e.target.value })} /></label>
            )}
            <label className="checkline"><input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />启用工具</label>
          </div>
          <div className="script-note">
            工具描述只参与模型选择；真正能否调用，由这里写入的后端适配器、MCP URL、脚本内容和后端运行开关共同决定。
          </div>
          <div className="form-actions">
            <button type="button" onClick={onClose}>取消</button>
            <button className="primary" type="submit">{tool ? '保存修改' : '注入后端'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function useTools(api: ApiClient, notify: Props['notify']) {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reload = () => {
    setLoading(true);
    api.get<Tool[]>('/api/tools').then((items) => {
      setTools(items);
      setError('');
    }).catch((err) => setError((err as Error).message)).finally(() => setLoading(false));
  };
  useEffect(() => { reload(); }, [api]);
  const remove = async (id: string) => {
    if (!confirm('确认删除该工具？')) return;
    try {
      await api.delete(`/api/tools/${id}`);
      notify('工具已删除');
      reload();
    } catch (err) {
      notify((err as Error).message, true);
    }
  };
  return { tools, loading, loaded: !loading || tools.length > 0, error, reload, remove };
}

function sourceLabel(tool: Tool) {
  const source = String(tool.metadata?.source || '');
  if (source === 'mcp') return 'MCP URL';
  if (source === 'script') return '脚本';
  return '内置';
}

function StatusText({ value, ok }: { value: string; ok: boolean }) {
  return <span className={`status-text ${ok ? 'ok' : 'off'}`}>{value}</span>;
}

function EmptyState({ loading, error, text }: { loading?: boolean; error?: string; text?: string }) {
  return <div className="empty">{loading ? <span className="spinner" /> : <b>{error || text || '暂无数据'}</b>}</div>;
}

function split(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleString() : '-';
}

function defaultScript() {
  return `import json
import sys

payload = json.loads(sys.stdin.read() or "{}")
print(json.dumps({"received": payload.get("task", "")[:200]}, ensure_ascii=False))`;
}
