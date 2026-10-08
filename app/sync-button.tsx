"use client";
import { useState } from "react";

export function SyncButton(){
 const [loading,setLoading]=useState(false); const [message,setMessage]=useState("");
 async function sync(){
  setLoading(true); setMessage("");
  try{ const response=await fetch("/api/instagram/sync",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"}); const data=await response.json(); if(!response.ok) throw new Error(data.error||"Não foi possível sincronizar."); const total=(data.results||[]).reduce((sum:any,item:any)=>sum+(item.mediaImported||0),0); setMessage(`Sincronização concluída: ${total} conteúdos processados.`); }
  catch(error){setMessage(error instanceof Error?error.message:"Erro na sincronização.");}
  finally{setLoading(false);}
 }
 return <div className="sync-control"><button className="sync-button" onClick={sync} disabled={loading}>{loading?"Sincronizando…":"Sincronizar agora"}</button>{message&&<span className="sync-message">{message}</span>}</div>;
}