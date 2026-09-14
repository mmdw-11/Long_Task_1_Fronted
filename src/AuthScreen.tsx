import { useState } from 'react';
import { ApiClient } from './api';
import type { AuthUser } from './types';

type Mode='login'|'register'|'forgot'|'reset';
type AuthResult={token:string;user:AuthUser};

export function AuthScreen({api,onAuthenticated}:{api:ApiClient;onAuthenticated:(value:AuthResult)=>void}){
 const [mode,setMode]=useState<Mode>('login'); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [notice,setNotice]=useState(''); const [resetToken,setResetToken]=useState('');
 const submit=async(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();setBusy(true);setError('');setNotice('');const f=new FormData(e.currentTarget);try{
  const authApi=new ApiClient('/',{adminKey:'',actor:'auth'});
  if(mode==='login'||mode==='register'){const body=mode==='login'?{email:f.get('email'),password:f.get('password')}:{email:f.get('email'),name:f.get('name'),password:f.get('password')};const result=await authApi.post<AuthResult>(`/api/auth/${mode}`,body);onAuthenticated(result);return}
  if(mode==='forgot'){const result=await authApi.post<{message:string;reset_token?:string}>('/api/auth/forgot-password',{email:f.get('email')});setNotice(result.message);if(result.reset_token){setResetToken(result.reset_token);setMode('reset')}return}
  await authApi.post('/api/auth/reset-password',{token:f.get('token'),password:f.get('password')});setNotice('密码已重置，请使用新密码登录');setMode('login')
 }catch(e){const msg=(e as Error).message;if(msg.includes('无法连接后端')){localStorage.setItem('apiUrl','/');setError('已重置后端地址为本地代理，请再次点击登录')}else setError(msg)}finally{setBusy(false)}};
 const change=(next:Mode)=>{setMode(next);setError('');setNotice('')};
 return <main className="auth-page"><section className="auth-hero"><div className="auth-brand"><span>A</span><b>TIDE-Swarm</b></div><div><em>AI AGENT OPERATIONS</em><h1>把复杂任务，交给一支<br/>可观察的智能体团队。</h1><p>设计编排、授权工具、实时追踪执行，并保留完整、可审计的任务结果。</p></div><footer>安全会话 · 结构化事件 · 可控工具权限</footer></section><section className="auth-panel"><div className="auth-card"><small>AGENTFORGE CONSOLE</small><h2>{mode==='login'?'欢迎回来':mode==='register'?'创建账户':mode==='forgot'?'找回密码':'设置新密码'}</h2><p>{mode==='login'?'登录后进入智能体运行平台':mode==='register'?'注册后将自动登录':mode==='forgot'?'输入注册邮箱获取重置凭据':'重置凭据 30 分钟内有效'}</p>{error&&<div className="auth-message error">{error}</div>}{notice&&<div className="auth-message">{notice}</div>}<form onSubmit={submit}>
  {mode==='register'&&<label><span>姓名</span><input name="name" autoComplete="name" required placeholder="你的姓名"/></label>}
  {(mode==='login'||mode==='register'||mode==='forgot')&&<label><span>邮箱</span><input name="email" type="email" autoComplete="email" required placeholder="name@example.com"/></label>}
  {mode==='reset'&&<label><span>重置凭据</span><input name="token" required defaultValue={resetToken} placeholder="粘贴邮件中的重置凭据"/></label>}
  {(mode==='login'||mode==='register'||mode==='reset')&&<label><span>{mode==='reset'?'新密码':'密码'}</span><input name="password" type="password" minLength={8} autoComplete={mode==='login'?'current-password':'new-password'} required placeholder="至少 8 个字符"/></label>}
  <button className="primary auth-submit" disabled={busy}>{busy?'处理中…':mode==='login'?'登录':mode==='register'?'注册并登录':mode==='forgot'?'获取重置说明':'保存新密码'}</button>
 </form><div className="auth-links">{mode==='login'?<><button onClick={()=>change('forgot')}>忘记密码？</button><span>还没有账户？<button onClick={()=>change('register')}>立即注册</button></span></>:<button onClick={()=>change('login')}>← 返回登录</button>}</div>{mode==='forgot'&&<button className="token-link" onClick={()=>change('reset')}>我已有重置凭据</button>}</div></section></main>
}
