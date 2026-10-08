import { NextResponse } from "next/server";
import { exchangeInstagramCode, exchangeLongLivedToken, metaGraph } from "@/lib/meta";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

function getCookie(request: Request, name: string) {
  const raw = request.headers.get("cookie") || "";
  const match = raw.split(";").map((v) => v.trim()).find((v) => v.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const savedState = getCookie(request, "ig_oauth_state");
  const redirectUri = process.env.META_REDIRECT_URI || `${url.origin}/api/instagram/callback`;

  if (!code || !returnedState || !savedState || returnedState !== savedState) {
    return NextResponse.redirect(new URL("/?error=instagram_oauth_state", url.origin));
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.redirect(new URL("/?error=login_required", url.origin));

    const shortToken = await exchangeInstagramCode(code, redirectUri);
    const longToken = await exchangeLongLivedToken(shortToken.access_token);
    const profile = await metaGraph<{ id: string; username?: string; name?: string; profile_picture_url?: string }>(
      "me?fields=id,username,name,profile_picture_url",
      longToken.access_token
    );

    const { data: account, error: accountError } = await supabase
      .from("instagram_accounts")
      .upsert({
        user_id: user.id,
        instagram_user_id: profile.id,
        username: profile.username ?? null,
        name: profile.name ?? null,
        profile_picture_url: profile.profile_picture_url ?? null,
        token_expires_at: new Date(Date.now() + longToken.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "instagram_user_id" })
      .select("id")
      .single();

    if (accountError || !account) throw new Error(accountError?.message || "Could not save Instagram account");

    const service = createSupabaseServiceClient();
    const { error: tokenError } = await service
      .schema("private")
      .from("instagram_tokens")
      .upsert({
        account_id: account.id,
        access_token: longToken.access_token,
        updated_at: new Date().toISOString(),
      });

    if (tokenError) throw new Error(tokenError.message);

    const response = NextResponse.redirect(new URL("/?connected=instagram", url.origin));
    response.headers.append("Set-Cookie", "ig_oauth_state=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax");
    return response;
  } catch (error) {
    console.error("Instagram OAuth callback failed", error);
    return NextResponse.redirect(new URL("/?error=instagram_connection_failed", url.origin));
  }
}
