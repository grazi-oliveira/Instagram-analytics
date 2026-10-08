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

type LoginMode = "password" | "magic-link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<LoginMode>("password");
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

    if (mode === "password") {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      setSending(false);

      if (authError) {
        setError("E-mail ou senha incorretos. Confira os dados e tente novamente.");
        return;
      }

      window.location.assign("/");
      return;
    }

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

  function switchMode() {
    setMode(mode === "password" ? "magic-link" : "password");
    setError("");
    setRateLimited(false);
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
              autoComplete="email"
            />
            {mode === "password" && (
              <>
                <label htmlFor="password" style={{ marginTop: 16 }}>
                  Senha
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                />
              </>
            )}
            <button className="connect" type="submit" disabled={sending || rateLimited}>
              {sending
                ? mode === "password"
                  ? "Entrando..."
                  : "Enviando..."
                : rateLimited
                  ? "Envio temporariamente bloqueado"
                  : mode === "password"
                    ? "Entrar com senha"
                    : "Enviar link de acesso"}
            </button>
            {error && <p className="auth-error">{error}</p>}
            <button className="connect secondary" type="button" onClick={switchMode}>
              {mode === "password"
                ? "Prefiro receber um link por e-mail"
                : "Voltar para entrar com senha"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
