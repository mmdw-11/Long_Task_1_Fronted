import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './dialogs.css';

type Kind = 'confirm' | 'alert' | 'prompt';
type Job = {kind:Kind; message:string; initial:string; resolve:(value:any)=>void; opener:Element|null};
const queue:Job[]=[];
let active=false;
function next(){
  if(active||!queue.length)return;
  active=true;
  const job=queue.shift()!;
  const host=document.createElement('div');
  document.body.appendChild(host);
  const root=createRoot(host);
  const finish=(value:any)=>{
    root.unmount();host.remove();active=false;
    if(job.opener instanceof HTMLElement&&job.opener.isConnected)job.opener.focus();
    job.resolve(value);next();
  };
  root.render(<Dialog job={job} finish={finish}/>);
}
function request(kind:Kind,message:string,initial=''){
  return new Promise<any>(resolve=>{queue.push({kind,message,initial,resolve,opener:document.activeElement});next();});
}
export const appConfirm=(message:string):Promise<boolean>=>request('confirm',message);
export const appAlert=(message:string):Promise<void>=>request('alert',message);
export const appPrompt=(message:string,initial=''):Promise<string|null>=>request('prompt',message,initial);

function Dialog({job,finish}:{job:Job;finish:(value:any)=>void}){
  const [value,setValue]=useState(job.initial);
  const panel=useRef<HTMLDivElement>(null);
  const cancel=()=>finish(job.kind==='prompt'?null:job.kind==='confirm'?false:undefined);
  const accept=()=>finish(job.kind==='prompt'?value:job.kind==='confirm'?true:undefined);
  useEffect(()=>{
    const old=document.body.style.overflow;document.body.style.overflow='hidden';
    const children=Array.from(document.body.children).filter(el=>el!==panel.current?.parentElement?.parentElement) as HTMLElement[];
    const previous=children.map(el=>el.inert);children.forEach(el=>el.inert=true);
    (panel.current?.querySelector('input')||panel.current?.querySelector('button'))?.focus();
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cancel();}};
    window.addEventListener('keydown',escape,true);
    return()=>{window.removeEventListener('keydown',escape,true);document.body.style.overflow=old;children.forEach((el,i)=>el.inert=previous[i]);};
  },[]);
  return <div className="app-dialog-backdrop"><div ref={panel} className="app-dialog" role={job.kind==='prompt'?'dialog':'alertdialog'} aria-modal="true" aria-labelledby="app-dialog-title" aria-describedby="app-dialog-message" onKeyDown={e=>{
    if(e.key!=='Tab')return;
    const items=Array.from(panel.current!.querySelectorAll<HTMLElement>('button,input'));
    if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1)?.focus();}
    else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0]?.focus();}
  }}>
    <h2 id="app-dialog-title">{job.kind==='confirm'?'请确认操作':job.kind==='prompt'?'请输入内容':'提示'}</h2>
    <p id="app-dialog-message">{job.message}</p>
    <form onSubmit={e=>{e.preventDefault();accept();}}>
      {job.kind==='prompt'&&<input aria-label={job.message} value={value} onChange={e=>setValue(e.target.value)}/>}
      <footer>{job.kind!=='alert'&&<button type="button" onClick={cancel}>取消</button>}<button type="submit" className="app-dialog-primary">确定</button></footer>
    </form>
  </div></div>;
}
