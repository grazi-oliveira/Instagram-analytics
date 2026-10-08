const META_VERSION=process.env.META_GRAPH_VERSION||"v24.0";
const META_BASE_URL=`https://graph.instagram.com/${META_VERSION}`;

export async function metaGraph<T>(path:string,accessToken:string,init?:RequestInit):Promise<T>{
  const url=path.startsWith("http://")||path.startsWith("https://")?new URL(path):new URL(`${META_BASE_URL}/${path.replace(/^\//,"")}`);
  url.searchParams.set("access_token",accessToken);
  const response=await fetch(url,{...init,headers:{"Content-Type":"application/json",...(init?.headers||{})},cache:"no-store"});
  const data=await response.json();
  if(!response.ok||data?.error) throw new Error(data?.error?.message||"Instagram Graph API request failed");
  return data as T;
}

export async function exchangeInstagramCode(code:string,redirectUri:string){
  const body=new URLSearchParams({client_id:process.env.META_APP_ID||"",client_secret:process.env.META_APP_SECRET||"",grant_type:"authorization_code",redirect_uri:redirectUri,code});
  const response=await fetch("https://api.instagram.com/oauth/access_token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body,cache:"no-store"});
  const data=await response.json();
  if(!response.ok||data?.error_message) throw new Error(data?.error_message||"Instagram authorization code exchange failed");
  return data as {access_token:string;user_id:string};
}

export async function exchangeLongLivedToken(shortLivedToken:string){
  const url=new URL("https://graph.instagram.com/access_token");
  url.searchParams.set("grant_type","ig_exchange_token");
  url.searchParams.set("client_secret",process.env.META_APP_SECRET||"");
  url.searchParams.set("access_token",shortLivedToken);
  const response=await fetch(url,{cache:"no-store"});
  const data=await response.json();
  if(!response.ok||data?.error) throw new Error(data?.error?.message||"Instagram long-lived token exchange failed");
  return data as {access_token:string;token_type:string;expires_in:number};
}