import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { metaGraph } from "@/lib/meta";

type InstagramMedia={id:string;media_type?:string;media_product_type?:string;permalink?:string;caption?:string;media_url?:string;thumbnail_url?:string;timestamp?:string;username?:string};
type MediaPage={data?:InstagramMedia[];paging?:{next?:string}};
type InsightRow={name?:string;values?:Array<{value?:number}>};

const MEDIA_FIELDS="id,media_type,media_product_type,permalink,caption,media_url,thumbnail_url,timestamp,username";
const INSIGHT_METRICS=["views","reach","likes","comments","shares","saved","total_interactions"] as const;

async function fetchMedia(accessToken:string):Promise<InstagramMedia[]>{
  const items:InstagramMedia[]=[];
  let nextUrl:string|undefined=`me/media?fields=${MEDIA_FIELDS}&limit=100`;
  while(nextUrl){
    const currentUrl:string=nextUrl;
    const page:MediaPage=await metaGraph<MediaPage>(currentUrl,accessToken);
    items.push(...(page.data??[]));
    nextUrl=page.paging?.next;
    if(items.length>=1000) break;
  }
  return items;
}

async function fetchMediaInsights(mediaId:string,accessToken:string):Promise<Record<string,number>>{
  const result:Record<string,number>={};
  for(const metric of INSIGHT_METRICS){
    try{
      const data=await metaGraph<{data?:InsightRow[]}>(`${mediaId}/insights?metric=${metric}`,accessToken);
      const row=data.data?.find((item)=>item.name===metric);
      const value=row?.values?.[0]?.value;
      if(typeof value==="number") result[metric]=value;
    }catch(error){
      console.warn(`Instagram metric ${metric} unavailable for ${mediaId}`,error instanceof Error?error.message:error);
    }
  }
  return result;
}

function toIso(value:string|undefined):string|null{return value?new Date(value).toISOString():null;}

export async function syncInstagramAccount(accountId:string){
  const supabase=createSupabaseServiceClient();
  const startedAt=new Date().toISOString();
  const run=await supabase.from("instagram_sync_runs").insert({account_id:accountId,status:"running",started_at:startedAt}).select("id").single();
  if(run.error||!run.data) throw new Error(run.error?.message||"Could not create sync run");
  let mediaImported=0; let insightsImported=0;
  try{
    const tokenResult=await supabase.schema("private").from("instagram_tokens").select("access_token").eq("account_id",accountId).single();
    if(tokenResult.error||!tokenResult.data) throw new Error("Instagram access token not found");
    const accessToken=tokenResult.data.access_token;
    const media=await fetchMedia(accessToken);
    for(const item of media){
      const saved=await supabase.from("instagram_media").upsert({account_id:accountId,instagram_media_id:item.id,media_type:item.media_type??null,media_product_type:item.media_product_type??null,permalink:item.permalink??null,caption:item.caption??null,media_url:item.media_url??null,thumbnail_url:item.thumbnail_url??null,published_at:toIso(item.timestamp),updated_at:new Date().toISOString()},{onConflict:"instagram_media_id"}).select("id").single();
      if(saved.error||!saved.data) throw new Error(saved.error?.message||`Could not save media ${item.id}`);
      mediaImported++;
      const metrics=await fetchMediaInsights(item.id,accessToken);
      if(Object.keys(metrics).length){
        const inserted=await supabase.from("instagram_media_insights").insert({media_id:saved.data.id,captured_at:new Date().toISOString(),views:metrics.views??null,reach:metrics.reach??null,likes:metrics.likes??null,comments:metrics.comments??null,shares:metrics.shares??null,saves:metrics.saved??null,total_interactions:metrics.total_interactions??null,raw_metrics:metrics});
        if(inserted.error) throw new Error(inserted.error.message);
        insightsImported++;
      }
    }
    await supabase.from("instagram_sync_runs").update({status:"success",finished_at:new Date().toISOString(),media_imported:mediaImported,insights_imported:insightsImported}).eq("id",run.data.id);
    return {mediaImported,insightsImported};
  }catch(error){
    await supabase.from("instagram_sync_runs").update({status:"error",finished_at:new Date().toISOString(),media_imported:mediaImported,insights_imported:insightsImported,error_message:error instanceof Error?error.message:"Instagram sync failed"}).eq("id",run.data.id);
    throw error;
  }
}
