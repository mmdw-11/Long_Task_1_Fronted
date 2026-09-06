import type { ApiClient } from './api';
import type { Workspace } from './types';

type DirectorySelection={canceled:boolean;path:string;name:string};
const samePath=(left:string,right:string)=>left.replaceAll('\\','/').replace(/\/$/,'').toLowerCase()===right.replaceAll('\\','/').replace(/\/$/,'').toLowerCase();

/** Selects a host folder and reuses an existing registration for that path. */
export async function chooseWorkspace(api:ApiClient,existing:Workspace[]):Promise<{workspace:Workspace;created:boolean}|null>{
  const selected=await api.post<DirectorySelection>('/api/workspaces/pick-directory');
  if(selected.canceled||!selected.path)return null;
  const registered=existing.find(item=>samePath(item.root_path,selected.path));
  if(registered)return {workspace:registered,created:false};
  const workspace=await api.post<Workspace>('/api/workspaces',{name:selected.name||'本地项目',root_path:selected.path});
  return {workspace,created:true};
}
