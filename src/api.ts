export class ApiError extends Error { constructor(message:string, public status:number){super(message)} }
export type Credentials={adminKey:string;actor:string};
export class ApiClient {
  constructor(public baseUrl:string, private credentials:Credentials){ }
  setCredentials(v:Credentials){this.credentials=v}
  private async request<T>(path:string, init:RequestInit={}):Promise<T>{
    const headers:Record<string,string>={'Content-Type':'application/json',...(init.headers as Record<string,string>||{})};
    if(this.credentials.adminKey) headers['X-Admin-Key']=this.credentials.adminKey;
    if(this.credentials.actor) headers['X-Actor']=this.credentials.actor;
    let response:Response;
    try{response=await fetch(`${this.baseUrl.replace(/\/$/,'')}${path}`,{...init,headers})}catch{throw new ApiError('无法连接后端，请检查服务地址与 FastAPI 服务状态',0)}
    const raw=await response.text(); let data:unknown={};
    try{data=raw?JSON.parse(raw):{}}catch{data={detail:raw}}
    if(!response.ok){const d=data as {detail?:unknown};throw new ApiError(typeof d.detail==='string'?d.detail:`请求失败 (${response.status})`,response.status)}
    return data as T;
  }
  get<T>(p:string){return this.request<T>(p)}
  post<T>(p:string,b:unknown={}){return this.request<T>(p,{method:'POST',body:JSON.stringify(b)})}
  put<T>(p:string,b:unknown){return this.request<T>(p,{method:'PUT',body:JSON.stringify(b)})}
  delete<T>(p:string,b?:unknown){return this.request<T>(p,{method:'DELETE',body:b===undefined?undefined:JSON.stringify(b)})}
}
