type Event = Record<string, any>;

export type RunAction = { id:string; title:string; detail:string; meta:string; status:'running'|'succeeded'|'waiting'|'failed' };
const failed=(event:Event)=>event.type==='model_failed'||['failed','blocked','unsupported'].includes(String(event.status||''));
const toolName=(event:Event)=>{const call=event.tool_call||{};return String(event.tool_name||call.display_name||call.name||'工具')};

/** Collapse low-level events into one row per invocation, in execution order. */
export function runActions(events:Event[]):RunAction[]{
  const actions:RunAction[]=[],models=new Map<string,number>(),activeTools=new Map<string,number[]>(),knowledge=new Map<string,number>();
  const add=(action:RunAction)=>(actions.push(action),actions.length-1);
  const finish=(index:number|undefined,event:Event,detail='')=>{if(index==null)return;actions[index]={...actions[index],status:failed(event)?'failed':event.status==='approval_required'?'waiting':'succeeded',detail:detail||String(event.message||actions[index].detail||''),meta:[actions[index].meta,event.duration_ms!=null?`${event.duration_ms} ms`:''].filter(Boolean).join(' · ')}};
  events.forEach((event,eventIndex)=>{
    if(event.type==='model_started'){
      const id=String(event.generation_id||`model-${eventIndex}`);models.set(id,add({id,title:`调用模型${event.model?` · ${event.model}`:''}`,detail:'',meta:String(event.node||''),status:'running'}));
    }else if(event.type==='model_finished'||event.type==='model_failed')finish(models.get(String(event.generation_id||'')),event);
    else if(event.type==='tool_started'){
      const name=toolName(event),key=String(event.tool_id||name),index=add({id:`tool-${event.sequence||eventIndex}`,title:`调用工具 · ${name}`,detail:String(event.message||''),meta:String(event.node||''),status:'running'});activeTools.set(key,[...(activeTools.get(key)||[]),index]);
    }else if(event.type==='tool_finished'||event.type==='tool_result'){
      const name=toolName(event),key=String(event.tool_id||event.tool_call?.tool_id||name),queue=activeTools.get(key)||[];let index=queue.pop();if(index==null)index=add({id:`tool-${event.sequence||eventIndex}`,title:`调用工具 · ${name}`,detail:'',meta:String(event.node||''),status:'running'});activeTools.set(key,queue);finish(index,event);
    }else if(event.type==='approval_required'){
      const name=toolName(event),key=String(event.tool_id||event.tool_call?.tool_id||name),index=(activeTools.get(key)||[]).at(-1);if(index!=null)actions[index]={...actions[index],status:'waiting',detail:'等待批准'};else add({id:`approval-${event.sequence||eventIndex}`,title:`等待批准 · ${name}`,detail:'',meta:'',status:'waiting'});
    }else if(event.type==='skill_applied'){
      const name=event.skill_name||event.name||event.skill_id||'Skill';add({id:`skill-${event.sequence||eventIndex}`,title:`应用 Skill · ${name}`,detail:String(event.message||''),meta:[event.version,event.source].filter(Boolean).join(' · '),status:'succeeded'});
    }else if(event.type==='knowledge_retrieval_start'){
      const key=String(event.retrieval_id||event.node||`knowledge-${eventIndex}`);knowledge.set(key,add({id:key,title:'检索知识库',detail:String(event.message||''),meta:String(event.node||''),status:'running'}));
    }else if(event.type==='knowledge_retrieval_end'){
      const key=String(event.retrieval_id||event.node||'');finish(knowledge.get(key),event,event.result_count!=null?`命中 ${event.result_count} 条`:'');
    }
  });
  return actions;
}
