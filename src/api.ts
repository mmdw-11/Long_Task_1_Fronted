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
    const headers:Record<string,string>={...(init.headers as Record<string,string>||{})};
    // Browser must supply multipart boundary itself for FormData uploads.
    if(!(init.body instanceof FormData) && !headers['Content-Type']) headers['Content-Type']='application/json';
    if(this.credentials.adminKey) headers['X-Admin-Key']=this.credentials.adminKey;
    // HTTP header values must be Latin-1. A Chinese display name used as the
    // actor previously made fetch throw before any request left the browser.
    // Authenticated calls are attributed by the backend from the session, so
    // omitting a non-ASCII X-Actor header is both safe and correct.
    if(this.credentials.actor && /^[\x20-\x7e]+$/.test(this.credentials.actor)) headers['X-Actor']=this.credentials.actor;
    if(this.credentials.token) headers.Authorization=`Bearer ${this.credentials.token}`;
    let response:Response|undefined,lastNetworkError=false;
    const candidates=this.urls(path);
    for(let index=0;index<candidates.length;index++){
      const url=candidates[index];
      try{
        response=await fetch(url,{...init,headers,credentials:'include'});lastNetworkError=false;
        // A stale custom localhost URL can still answer normal platform
        // requests but not contain the newly added knowledge-base routes.
        // In development, try the local FastAPI server once before reporting
        // a 404. Resource-specific 404s still remain 404s on the fallback.
        if(response.status===404 && path.startsWith('/api/knowledge') && index<candidates.length-1) continue;
        break;
      }catch{lastNetworkError=true}
    }
    if(!response)throw new ApiError(lastNetworkError?'无法连接后端，请检查服务地址与 FastAPI 服务状态':'请求未发送',0);
    const raw=await response.text(); let data:unknown={};
    try{data=raw?JSON.parse(raw):{}}catch{data={detail:raw}}
    if(!response.ok){const d=data as {detail?:unknown};const detail=typeof d.detail==='string'?d.detail:`请求失败 (${response.status})`;const message=response.status===404&&detail==='Not Found'?`接口未找到：${init.method||'GET'} ${path}。请确认后端已重启并在“连接设置”中使用 / 或 http://127.0.0.1:8000。`:detail;throw new ApiError(message,response.status)}
    return data as T;
  }
  get<T>(p:string){return this.request<T>(p)}
  post<T>(p:string,b:unknown={}){return this.request<T>(p,{method:'POST',body:JSON.stringify(b)})}
  postRaw<T>(p:string,body:BodyInit,headers:Record<string,string>={}){return this.request<T>(p,{method:'POST',body,headers})}
  put<T>(p:string,b:unknown){return this.request<T>(p,{method:'PUT',body:JSON.stringify(b)})}
  delete<T>(p:string,b?:unknown){return this.request<T>(p,{method:'DELETE',body:b===undefined?undefined:JSON.stringify(b)})}
}
