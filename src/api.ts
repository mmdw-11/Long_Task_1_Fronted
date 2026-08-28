export class ApiError extends Error { constructor(message:string, public status:number){super(message)} }
export type Credentials={adminKey:string;actor:string;token?:string};
export class ApiClient {
  constructor(public baseUrl:string, private credentials:Credentials){ }
  setCredentials(v:Credentials){this.credentials=v}
  getAuthToken(){return this.credentials.token||''}
  private urls(path:string):string[]{
    const base=this.baseUrl.trim();
    const normalized=base==='/'?'':base.replace(/\/$/,'');
    const primary=`${normalized}${path}`;
    // Vite's proxy is the first choice during local development. Some local
    // browser/proxy combinations can abort a proxied request even though the
    // FastAPI process is healthy, so retry once against FastAPI directly.
    const localFallback='http://127.0.0.1:8000'+path;
    if(typeof window!=='undefined'&&/^localhost$|^127\.0\.0\.1$|^\[::1\]$/.test(window.location.hostname)){
      return primary===localFallback?[primary]:[primary,localFallback];
    }
    return [primary];
  }
  private async request<T>(path:string, init:RequestInit={}):Promise<T>{
    const headers:Record<string,string>={'Content-Type':'application/json',...(init.headers as Record<string,string>||{})};
    if(this.credentials.adminKey) headers['X-Admin-Key']=this.credentials.adminKey;
    // HTTP header values must be Latin-1. A Chinese display name used as the
    // actor previously made fetch throw before any request left the browser.
    // Authenticated calls are attributed by the backend from the session, so
    // omitting a non-ASCII X-Actor header is both safe and correct.
    if(this.credentials.actor && /^[\x20-\x7e]+$/.test(this.credentials.actor)) headers['X-Actor']=this.credentials.actor;
    if(this.credentials.token) headers.Authorization=`Bearer ${this.credentials.token}`;
    let response:Response|undefined,lastNetworkError=false;
    for(const url of this.urls(path)){
      try{response=await fetch(url,{...init,headers,credentials:'include'});lastNetworkError=false;break}catch{lastNetworkError=true}
    }
    if(!response)throw new ApiError(lastNetworkError?'无法连接后端，请检查服务地址与 FastAPI 服务状态':'请求未发送',0);
    const raw=await response.text(); let data:unknown={};
    try{data=raw?JSON.parse(raw):{}}catch{data={detail:raw}}
    if(!response.ok){const d=data as {detail?:unknown};throw new ApiError(typeof d.detail==='string'?d.detail:`请求失败 (${response.status})`,response.status)}
    return data as T;
  }
  get<T>(p:string){return this.request<T>(p)}
  post<T>(p:string,b:unknown={}){return this.request<T>(p,{method:'POST',body:JSON.stringify(b)})}
  postRaw<T>(p:string,body:BodyInit,headers:Record<string,string>={}){return this.request<T>(p,{method:'POST',body,headers})}
  put<T>(p:string,b:unknown){return this.request<T>(p,{method:'PUT',body:JSON.stringify(b)})}
  delete<T>(p:string,b?:unknown){return this.request<T>(p,{method:'DELETE',body:b===undefined?undefined:JSON.stringify(b)})}
}
