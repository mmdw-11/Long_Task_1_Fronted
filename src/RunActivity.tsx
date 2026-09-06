import './run-activity.css';
import { runActions } from './run-actions';

/** Shows one factual row per real invocation. Prompts, arguments and reasoning stay private. */
export function RunActivity({events,running}:{events:Record<string,any>[];running:boolean}){
  const activity=runActions(events);
  if(!activity.length)return null;
  return <details className="run-live-activity" open={running}>
    <summary>{running?`正在执行${activity.at(-1)?.title?` · ${activity.at(-1)?.title}`:''}`:'查看执行过程'} <small>{activity.length} 项</small></summary>
    <ol>{activity.map((item,index)=><li key={item.id||index} className={item.status==='failed'?'error':''}>
      <span aria-hidden="true">{item.status==='running'?'…':item.status==='failed'?'!':item.status==='waiting'?'○':'✓'}</span>
      <div><b>{item.title}</b>{item.detail&&<p>{item.detail}</p>}{item.meta&&<small>{item.meta}</small>}</div>
    </li>)}</ol>
  </details>;
}
