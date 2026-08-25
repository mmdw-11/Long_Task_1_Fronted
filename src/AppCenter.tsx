// 应用管理页面，按百炼 Managed Agents 的“创建应用—配置能力—调试发布”流程落地到本项目后端。
import { useEffect, useMemo, useState } from 'react';
import type { ApiClient } from './api';
import type { Application, Run, Skill, Tool } from './types';
import './app-center.css';

type Props = { api: ApiClient; notify: (s: string, b?: boolean) => void; go: (p: 'builder' | 'runs' | 'tools' | 'system') => void; openCreate?: boolean; onCreateOpened?: () => void };
type Template = typeof templates[number];
type AppPayload = {
  name: string;
  app_type: string;
  description: string;
  model: string;
  system_prompt: string;
  tool_ids: string[];
  skill_ids: string[];
  metadata?: Record<string, unknown>;
};

const templates = [
  { type: 'agent', title: '智能体应用', desc: '选择模型、编写系统提示词、挂载 MCP 与技能。', icon: 'AI' },
  { type: 'workflow', title: '工作流应用', desc: '通过可视化节点编排多 Agent 和工具调用路径。', icon: '⌘' },
  { type: 'chat', title: '对话助手', desc: '面向业务会话的单入口 Agent，适合快速验证。', icon: '💬' },
  { type: 'task', title: '长任务应用', desc: '保留上下文防漂移、TODO 和运行总结机制。', icon: '✓' },
];

export function AppCenter({ api, notify, go, openCreate = false, onCreateOpened }: Props) {
  const [apps, setApps] = useState<Application[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [template, setTemplate] = useState(templates[0]);
  const [editing, setEditing] = useState<Application | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([api.get<Application[]>('/api/apps'), api.get<Tool[]>('/api/tools'), api.get<Skill[]>('/api/skills')])
      .then(([a, t, s]) => { setApps(a); setTools(t); setSkills(s); })
      .catch((e) => notify((e as Error).message, true))
      .finally(() => setLoading(false));
  };
  useEffect(load, [api]);
  useEffect(() => { if (openCreate) { setTemplate(templates[0]); setModal(true); onCreateOpened?.(); } }, [openCreate, onCreateOpened]);

  const create = async (payload: AppPayload) => {
    try {
      const created = await api.post<Application>('/api/apps', payload);
      setModal(false);
      setEditing(created);
      notify('应用已创建，并自动生成工作流草稿');
      load();
    } catch (e) {
      notify((e as Error).message, true);
    }
  };

  const update = async (app: Application, payload: AppPayload) => {
    try {
      const saved = await api.put<Application>(`/api/apps/${app.id}`, payload);
      setEditing(saved);
      notify('应用配置已保存，入口 Agent 与工作流已同步');
      load();
    } catch (e) {
      notify((e as Error).message, true);
    }
  };

  const publish = async (app: Application) => {
    try {
      const saved = await api.post<Application>(`/api/apps/${app.id}/publish`);
      setEditing((prev) => (prev?.id === saved.id ? saved : prev));
      notify('应用已发布');
      load();
    } catch (e) {
      notify((e as Error).message, true);
    }
  };

  const run = async (app: Application, input?: string) => {
    try {
      await api.post<Run>(`/api/apps/${app.id}/runs`, {
        input: { input: input?.trim() || `请运行应用：${app.name}` },
        recursion_limit: 50,
      });
      notify('调试任务已启动');
      go('runs');
    } catch (e) {
      notify((e as Error).message, true);
    }
  };

  const counts = useMemo(() => ({
    apps: apps.length,
    published: apps.filter((app) => app.status === 'published').length,
    tools: tools.length,
    skills: skills.length,
  }), [apps, tools, skills]);

  return (
    <div className="managed-apps">
      <section className="managed-hero">
        <div>
          <span>Managed Agents</span>
          <h2>3分钟完成 Agent 创建、配置与会话发起。</h2>
          <p>全链路 API 驱动。创建应用后自动落到后端工作流，并继续使用你们已有的上下文防漂移、TODO 计划、技能演化和运行总结机制。</p>
        </div>
        <button className="primary" onClick={() => { setTemplate(templates[0]); setModal(true); }}>创建应用</button>
      </section>

      <section className="managed-metrics">
        <div><b>{counts.apps}</b><span>全部应用</span></div>
        <div><b>{counts.published}</b><span>已发布</span></div>
        <div><b>{counts.tools}</b><span>MCP/工具</span></div>
        <div><b>{counts.skills}</b><span>技能</span></div>
      </section>

      <section className="managed-steps">
        <div><b>1</b><span>创建应用</span><small>选择应用类型和模板</small></div>
        <div><b>2</b><span>配置 Agent</span><small>模型、提示词、调度策略</small></div>
        <div><b>3</b><span>挂载 MCP</span><small>从工具目录授权给应用</small></div>
        <div><b>4</b><span>调试发布</span><small>运行、观测、发布</small></div>
      </section>

      <section className="template-grid">
        {templates.map((item) => (
          <button key={item.type} onClick={() => { setTemplate(item); setModal(true); }}>
            <i>{item.icon}</i>
            <b>{item.title}</b>
            <small>{item.desc}</small>
          </button>
        ))}
      </section>

      <article className="panel app-table">
        <div className="panel-head">
          <div><h2>应用管理</h2><p>{apps.length ? '像百炼一样，从应用卡片进入配置、编排、调试和发布。' : '暂无应用，请先创建一个 Agent 应用。'}</p></div>
          <div className="button-row"><button onClick={() => go('tools')}>MCP 管理</button><button onClick={() => go('system')}>API Key</button></div>
        </div>
        {loading ? <div className="empty"><span className="spinner" />正在读取应用…</div> : apps.length ? (
          <div className="app-card-grid">
            {apps.map((app) => (
              <section className="managed-card" key={app.id}>
                <div><span>{app.app_type}</span><em>{app.status === 'published' ? '已发布' : '草稿'}</em></div>
                <h3>{app.name}</h3>
                <p>{app.description || '暂无描述'}</p>
                <dl>
                  <dt>模型</dt><dd>{app.model || '自动调度'}</dd>
                  <dt>MCP/工具</dt><dd>{app.tool_ids.length} 个</dd>
                  <dt>技能</dt><dd>{app.skill_ids.length} 个</dd>
                </dl>
                <footer>
                  <button onClick={() => setEditing(app)}>配置</button>
                  <button onClick={() => go('builder')}>编排</button>
                  <button onClick={() => run(app)}>调试</button>
                  <button className="primary" onClick={() => publish(app)}>发布</button>
                </footer>
              </section>
            ))}
          </div>
        ) : <div className="api-empty"><b>暂无应用</b><p>从模板创建应用后，会自动生成可运行的后端工作流。</p><button className="primary" onClick={() => setModal(true)}>创建应用</button></div>}
      </article>

      {modal && <AppConfigModal mode="create" template={template} tools={tools} skills={skills} close={() => setModal(false)} submit={(v) => create(v)} />}
      {editing && (
        <AppConfigModal
          mode="edit"
          app={editing}
          template={templates.find((item) => item.type === editing.app_type) || templates[0]}
          tools={tools}
          skills={skills}
          close={() => setEditing(null)}
          submit={(v) => update(editing, v)}
          run={(input) => run(editing, input)}
          publish={() => publish(editing)}
        />
      )}
    </div>
  );
}

function AppConfigModal({
  mode, template, app, tools, skills, close, submit, run, publish,
}: {
  mode: 'create' | 'edit';
  template: Template;
  app?: Application;
  tools: Tool[];
  skills: Skill[];
  close: () => void;
  submit: (v: AppPayload) => void;
  run?: (input: string) => void;
  publish?: () => void;
}) {
  const [name, setName] = useState(app?.name || template.title);
  const [desc, setDesc] = useState(app?.description || template.desc);
  const [model, setModel] = useState(app?.model || '');
  const [prompt, setPrompt] = useState(app?.system_prompt || '你是一个可靠的业务智能体。请先理解用户目标，再按步骤调用可用工具完成任务，并输出清晰结果。');
  const [toolIds, setToolIds] = useState<string[]>(app?.tool_ids || []);
  const [skillIds, setSkillIds] = useState<string[]>(app?.skill_ids || []);
  const [debugInput, setDebugInput] = useState('给客户写一封简短邮件，说明会议改到明天下午三点。');
  const toggle = (list: string[], value: string, set: (v: string[]) => void) => set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  const payload = (): AppPayload => ({
    name,
    app_type: app?.app_type || template.type,
    description: desc,
    model,
    system_prompt: prompt,
    tool_ids: toolIds,
    skill_ids: skillIds,
    metadata: { source: 'managed_agents_console' },
  });

  return (
    <div className="overlay">
      <div className="modal wide app-config-modal">
        <div className="modal-head">
          <div><h2>{mode === 'create' ? '创建应用' : '应用配置'}</h2><p>{template.title} · {template.desc}</p></div>
          <button onClick={close}>×</button>
        </div>
        <form className="create-app-form" onSubmit={(e) => { e.preventDefault(); submit(payload()); }}>
          <section>
            <h3>基础信息</h3>
            <label>应用名称<input required value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label>应用描述<textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
            <label>模型<select value={model} onChange={(e) => setModel(e.target.value)}><option value="">自动调度</option><option value="device">端侧优先</option><option value="edge">边缘优先</option><option value="cloud">云端优先</option></select></label>
            <label>系统提示词<textarea rows={8} value={prompt} onChange={(e) => setPrompt(e.target.value)} /></label>
          </section>
          <section>
            <h3>能力配置</h3>
            <p>这里选择的 MCP/工具/技能会写入入口 Agent 的授权配置。工具描述只参与匹配和展示，真正调用由后端适配器与审批流程决定。</p>
            <div className="choose-title"><b>MCP / 工具</b><small>需要新增 MCP URL 或脚本工具时，到左侧 MCP 管理配置</small></div>
            <div className="choose-list">{tools.map((tool) => <label key={tool.id}><input type="checkbox" checked={toolIds.includes(tool.id)} onChange={() => toggle(toolIds, tool.id, setToolIds)} /><span><b>{tool.display_name}</b><small>{tool.description || tool.name}</small></span></label>)}{!tools.length && <small>暂无工具，可先到 MCP 管理添加 URL 或脚本工具。</small>}</div>
            <div className="choose-title"><b>技能</b></div>
            <div className="choose-list">{skills.map((skill) => <label key={skill.id}><input type="checkbox" checked={skillIds.includes(skill.id)} onChange={() => toggle(skillIds, skill.id, setSkillIds)} /><span><b>{skill.name}</b><small>{skill.description || skill.status}</small></span></label>)}{!skills.length && <small>暂无技能。</small>}</div>
          </section>
          {mode === 'edit' && (
            <section className="debug-pane">
              <h3>调试运行</h3>
              <p>保存配置后可直接以应用为入口发起调试，运行中心会流式展示 TODO、Agent 切换、工具调用和最终总结。</p>
              <textarea rows={4} value={debugInput} onChange={(e) => setDebugInput(e.target.value)} />
              <div className="button-row">
                <button type="button" onClick={() => run?.(debugInput)}>发起调试</button>
                <button type="button" onClick={() => goToHash('runs')}>查看运行中心</button>
                <button type="button" onClick={() => publish?.()}>发布应用</button>
              </div>
            </section>
          )}
          <div className="form-actions">
            <button type="button" onClick={close}>取消</button>
            <button className="primary">{mode === 'create' ? '创建并进入配置' : '保存配置'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function goToHash(page: string) {
  window.location.hash = page;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
