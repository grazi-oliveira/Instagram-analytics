"use client";
import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function LoginPage(){
  const [email,setEmail]=useState(""); const [sent,setSent]=useState(false); const [error,setError]=useState("");
  async function submit(event:FormEvent){
    event.preventDefault(); setError("");
    const supabase=createSupabaseBrowserClient();
    const {error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:window.location.origin+"/auth/callback"}});
    if(error) setError(error.message); else setSent(true);
  }
  return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">INSTAGRAM ANALYTICS</p><h1>Entre para analisar seu Instagram.</h1>{sent?<div className="auth-success"><h2>Confira seu e-mail.</h2><p>Enviamos um link seguro para entrar no painel.</p></div>:<form onSubmit={submit}><label htmlFor="email">Seu e-mail</label><input id="email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@exemplo.com"/><button className="connect" type="submit">Enviar link de acesso</button>{error&&<p className="auth-error">{error}</p>}</form>}</section></main>
}