"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type CallbackState = "loading" | "error";

export default function AuthCallbackPage() {
  const [state, setState] = useState<CallbackState>("loading");

  useEffect(() => {
    let active = true;

    async function completeSignIn() {
      const supabase = createSupabaseBrowserClient();
      const url = new URL(window.location.href);
      const fragment = new URLSearchParams(url.hash.slice(1));

      const providerError =
        url.searchParams.get("error_description") ??
        fragment.get("error_description");

      if (providerError) {
        throw new Error(providerError);
      }

      const code = url.searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
      } else {
        const tokenHash =
          url.searchParams.get("token_hash") ?? fragment.get("token_hash");
        const type = url.searchParams.get("type") ?? fragment.get("type");

        if (tokenHash && (type === "email" || type === "magiclink")) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as EmailOtpType,
          });
          if (error) throw error;
        } else {
          const accessToken =
            url.searchParams.get("access_token") ?? fragment.get("access_token");
          const refreshToken =
            url.searchParams.get("refresh_token") ?? fragment.get("refresh_token");

          if (!accessToken || !refreshToken) {
            throw new Error("The callback did not contain a sign-in code or session.");
          }

          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        }
      }

      if (active) window.location.replace("/");
    }

    completeSignIn().catch(() => {
      if (active) setState("error");
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">INSTAGRAM ANALYTICS</p>
        {state === "loading" ? (
          <>
            <h1>Concluindo seu acesso...</h1>
            <p>Estamos validando o link de entrada.</p>
          </>
        ) : (
          <>
            <h1>Não foi possível concluir o acesso.</h1>
            <p>O link pode ter expirado ou já ter sido usado. Peça um novo link para entrar.</p>
            <Link className="connect" href="/login">
              Voltar ao login
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
