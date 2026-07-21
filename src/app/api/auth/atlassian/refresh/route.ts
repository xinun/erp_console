export async function POST(request: Request) {
  const clientId = process.env.NEXT_PUBLIC_ATLASSIAN_CLIENT_ID;
  const clientSecret = process.env.ATLASSIAN_CLIENT_SECRET;
  const body = (await request.json()) as { refreshToken?: string };

  if (!clientId || !clientSecret || !body.refreshToken) {
    return Response.json({ error: 'Refresh configuration is missing' }, { status: 400 });
  }

  try {
    const response = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: body.refreshToken,
      }),
    });
    const token = await response.json();
    if (!response.ok) {
      return Response.json({ error: 'Atlassian login expired' }, { status: 401 });
    }

    return Response.json({
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? body.refreshToken,
      expiresAt: Date.now() + Number(token.expires_in ?? 3600) * 1000,
    });
  } catch {
    return Response.json({ error: 'Atlassian refresh failed' }, { status: 502 });
  }
}
