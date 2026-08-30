import { useState } from 'react';
import type { ApiClient } from './api';
import type { ModelConnection } from './types';

type Preset = { provider: string; name: string; base_url?:string };

export function ModelConnectionModal({ api, models, presets, close, done }: {
  api: ApiClient;
  models: ModelConnection[];
  presets: Preset[];
  close: () => void;
  done: () => Promise<unknown>;
}) {
  const [form, setForm] = useState({
    name: '', provider: presets[0]?.provider || 'openai', model_id: '',
    base_url: '', api_key_env: '', tier: 'cloud', auto_default: false, enabled: true,
  });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [testResult,setTestResult]=useState('');
  const [pendingDelete,setPendingDelete]=useState<ModelConnection|null>(null);
  const set = (key: string, value: string | boolean) => setForm(old => ({ ...old, [key]: value }));
  const create = async () => {
    setBusy('create'); setError('');
    try {
      await api.post('/api/model-connections', form);
      await done();
      setForm(old => ({ ...old, name: '', model_id: '', base_url: '' }));
    } catch (e) { setError((e as Error).message); } finally { setBusy(''); }
  };
  const test = async (id: string) => {
    setBusy(id); setError('');
    try { const value=await api.post<any>(`/api/model-connections/${id}/test`);setTestResult(`${value.test_result?.model||'模型'} 真实推理成功 · ${value.test_result?.latency_ms||0} ms · ${value.test_result?.response||''}`); await done(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(''); }
  };
  const setDefault = async (model: ModelConnection) => {
    setBusy(`default-${model.id}`); setError('');
    try { await api.put(`/api/model-connections/${model.id}`, {auto_default:true}); await done(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(''); }
  };
  const remove = async () => {
    if (!pendingDelete) return;
    setBusy(`delete-${pendingDelete.id}`); setError('');
    try { await api.delete(`/api/model-connections/${pendingDelete.id}`); setPendingDelete(null); await done(); }
    catch (e) { setError((e as Error).message); setPendingDelete(null); } finally { setBusy(''); }
  };
  const tiers = ([['device','端'],['edge','边'],['cloud','云']] as const);
  const ready = tiers.every(([tier]) => models.some(model => model.tier === tier && model.auto_default && model.enabled && model.configured && model.test_status === 'succeeded'));
  return <div className="overlay"><div className="external-import-modal model-connection-modal">
    <header><div><h2>模型连接管理</h2><p>层级在这里配置一次；应用选择固定模型时无需重复选择。</p></div><button onClick={close}>×</button></header>
    <div className={`model-auto-status ${ready?'ready':''}`}><b>AUTO {ready?'已就绪':'未就绪'}</b><span>{tiers.map(([tier,label])=><em key={tier}>{label} {models.some(model=>model.tier===tier&&model.auto_default&&model.enabled&&model.configured&&model.test_status==='succeeded')?'✓':'×'}</em>)}</span><small>端、边、云都设置可用的 AUTO 默认模型后，应用才可使用 AUTO。</small></div>
    <div className="model-connection-list">{tiers.map(([tier,label])=><section key={tier}><h3>{label}模型</h3>{models.filter(model=>model.tier===tier).map(model => <div key={model.id}>
      <span><b>{model.name}{model.auto_default&&<mark>AUTO 默认</mark>}</b><small>{model.provider} · {model.model_id || '未填写 model_id'}</small></span>
      <em className={model.test_status}>{model.test_status === 'succeeded' ? '测试成功' : model.test_status === 'failed' ? '测试失败' : '待测试'}</em>
      {!model.auto_default&&<button disabled={busy === `default-${model.id}`} onClick={() => setDefault(model)}>设为默认</button>}
      <button disabled={busy === model.id} onClick={() => test(model.id)}>{busy === model.id ? '测试中…' : '连接测试'}</button>
      <button className="danger model-delete-button" disabled={busy === `delete-${model.id}`} onClick={()=>setPendingDelete(model)}>删除</button>
    </div>)}{!models.some(model=>model.tier===tier)&&<p>尚未配置{label}模型</p>}</section>)}</div>
    <div className="import-form model-connection-form">
      <div className="model-connect-help">密钥请先写入后端 <code>.env</code> 并重启服务。DeepSeek：<code>deepseek-chat / https://api.deepseek.com/v1 / DEEPSEEK_API_KEY</code>；千问：<code>qwen-plus / DashScope 兼容地址 / DASHSCOPE_API_KEY</code>；Ollama 使用 <code>http://127.0.0.1:11434/v1</code> 且密钥变量留空。</div>
      <label>连接名称<input value={form.name} onChange={e => set('name', e.target.value)} placeholder="例如：生产 DeepSeek" /></label>
      <label>提供商<select value={form.provider} onChange={e => {const preset=presets.find(p=>p.provider===e.target.value);setForm(old=>({...old,provider:e.target.value,base_url:preset?.base_url||old.base_url,name:old.name||preset?.name||''}))}}>{presets.map(p => <option key={p.provider} value={p.provider}>{p.name}</option>)}</select></label>
      <label>模型 ID<input value={form.model_id} onChange={e => set('model_id', e.target.value)} placeholder="以服务商实际 model_id 为准" /></label>
      <label>OpenAI 兼容 Base URL<input value={form.base_url} onChange={e => set('base_url', e.target.value)} placeholder="https://api.example.com/v1" /></label>
      <label>API Key 环境变量<input value={form.api_key_env} onChange={e => set('api_key_env', e.target.value)} placeholder="例如 DEEPSEEK_API_KEY" /><small>平台仅保存变量名，接口不会回显密钥。</small></label>
      <label>资源层级<select value={form.tier} onChange={e => set('tier', e.target.value)}><option value="device">端</option><option value="edge">边</option><option value="cloud">云</option></select></label>
      <label className="model-default-check"><input type="checkbox" checked={form.auto_default} onChange={e=>set('auto_default',e.target.checked)}/> 设为该层级的 AUTO 默认模型</label>
      {error && <div className="import-error">{error}</div>}
      {testResult&&<div className="model-test-result">✓ {testResult}</div>}
      <footer><button onClick={close}>关闭</button><button className="primary" disabled={busy === 'create' || !form.name.trim() || !form.model_id.trim() || !form.base_url.trim()} onClick={create}>{busy === 'create' ? '创建中…' : '创建连接'}</button></footer>
    </div>
    {pendingDelete&&<div className="model-delete-layer" onMouseDown={event=>event.target===event.currentTarget&&setPendingDelete(null)}><section role="alertdialog" aria-modal="true" aria-labelledby="model-delete-title"><h3 id="model-delete-title">删除模型连接</h3><p>确定删除“{pendingDelete.name}”吗？删除后无法恢复。</p><footer><button onClick={()=>setPendingDelete(null)}>取消</button><button className="danger" autoFocus disabled={busy===`delete-${pendingDelete.id}`} onClick={remove}>{busy===`delete-${pendingDelete.id}`?'删除中…':'确认删除'}</button></footer></section></div>}
  </div></div>;
}
