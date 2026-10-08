"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const PRODUCTION_SITE_URL = "https://instagram-analytics-contlacteos.vercel.app";

function getAuthRedirectUrl() {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  const siteUrl =
    configuredSiteUrl ||
    (process.env.NODE_ENV === "production"
      ? PRODUCTION_SITE_URL
      : window.location.origin);

  return new URL("/auth/callback", siteUrl).toString();
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending || rateLimited) return;

    setError("");
    setSending(true);

    const supabase = createSupabaseBrowserClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: getAuthRedirectUrl() },
    });

    setSending(false);

    if (authError) {
      if (authError.message.toLowerCase().includes("email rate limit exceeded")) {
        setRateLimited(true);
        setError(
          "O limite de envio do Supabase foi atingido. Sem SMTP personalizado, este projeto pode enviar apenas 2 e-mails por hora. Configure um SMTP no painel do Supabase antes de tentar novamente."
        );
      } else {
        setError(authError.message);
      }
      return;
    }

    setSent(true);
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">INSTAGRAM ANALYTICS</p>
        <h1>Entre para analisar seu Instagram.</h1>
        {sent ? (
          <div className="auth-success">
            <h2>Confira seu e-mail.</h2>
            <p>Enviamos um link seguro para entrar no painel.</p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label htmlFor="email">Seu e-mail</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="voce@exemplo.com"
            />
            <button className="connect" type="submit" disabled={sending || rateLimited}>
              {sending
                ? "Enviando..."
                : rateLimited
                  ? "Envio temporariamente bloqueado"
                  : "Enviar link de acesso"}
            </button>
            {error && <p className="auth-error">{error}</p>}
          </form>
        )}
      </section>
    </main>
  );
}
