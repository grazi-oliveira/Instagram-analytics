import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { syncInstagramAccount } from "@/lib/instagram-sync";

export async function POST(request:Request){
  try{
    const cronSecret=request.headers.get("x-cron-secret");
    const isCron=Boolean(process.env.CRON_SECRET&&cronSecret===process.env.CRON_SECRET);
    const body=await request.json().catch(()=>({}));
    const accountId=typeof body.accountId==="string"?body.accountId:null;
    if(isCron){
      const service=createSupabaseServiceClient();
      const accounts=await service.from("instagram_accounts").select("id");
      if(accounts.error) throw new Error(accounts.error.message);
      const results=[];
      for(const account of accounts.data||[]){
        try{ results.push({accountId:account.id,...await syncInstagramAccount(account.id)}); }
        catch(error){ results.push({accountId:account.id,error:error instanceof Error?error.message:"Sync failed"}); }
      }
      return NextResponse.json({ok:true,results});
    }
    const supabase=await createSupabaseServerClient();
    const {data:{user}}=await supabase.auth.getUser();
    if(!user) return NextResponse.json({error:"Authentication required"}, {status:401});
    let query=supabase.from("instagram_accounts").select("id").eq("user_id",user.id);
    if(accountId) query=query.eq("id",accountId);
    const {data:accounts,error}=await query;
    if(error) throw new Error(error.message);
    if(!accounts?.length) return NextResponse.json({error:"Instagram account not found"}, {status:404});
    const results=[];
    for(const account of accounts){ results.push({accountId:account.id,...await syncInstagramAccount(account.id)}); }
    return NextResponse.json({ok:true,results});
  }catch(error){
    console.error("Instagram sync failed",error);
    return NextResponse.json({error:error instanceof Error?error.message:"Instagram sync failed"},{status:500});
  }
}