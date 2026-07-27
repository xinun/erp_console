function getMattermostConfig() {
  const baseUrl = process.env.MATTERMOST_BASE_URL?.replace(/\/+$/, '');
  const clientId = process.env.MATTERMOST_CLIENT_ID;
  const clientSecret = process.env.MATTERMOST_CLIENT_SECRET;
  return { baseUrl, clientId, clientSecret };
}

export async function POST(request: Request) {
  const { baseUrl, clientId, clientSecret } = getMattermostConfig();
  if (!baseUrl || !clientId || !clientSecret) {
    return Response.json(
      { error: 'Mattermost 서버 환경변수가 설정되지 않았습니다.' },
      { status: 503 }
    );
  }

  let body: { code?: string; codeVerifier?: string };
  try {
    body = await request.json() as { code?: string; codeVerifier?: string };
  } catch {
    return Response.json({ error: '올바르지 않은 요청입니다.' }, { status: 400 });
  }

  if (!body.code || !body.codeVerifier) {
    return Response.json({ error: 'Mattermost 인증 정보가 누락되었습니다.' }, { status: 400 });
  }

  const redirectUri = `${new URL(request.url).origin}/api/auth/mattermost/callback`;

  try {
    const response = await fetch(`${baseUrl}/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: body.code,
        code_verifier: body.codeVerifier,
        redirect_uri: redirectUri,
      }),
      cache: 'no-store',
    });

    const tokenData = await response.json() as {
      access_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    if (!response.ok || !tokenData.access_token) {
      console.error('Mattermost token error:', tokenData);
      return Response.json(
        { error: tokenData.error_description ?? tokenData.error ?? 'Mattermost 토큰을 발급받지 못했습니다.' },
        { status: 502 }
      );
    }

    return Response.json({
      accessToken: tokenData.access_token,
      expiresIn: tokenData.expires_in,
      baseUrl,
      clientId,
    });
  } catch (error) {
    console.error('Mattermost token request failed:', error);
    return Response.json(
      { error: 'Mattermost 서버에 연결하지 못했습니다.' },
      { status: 502 }
    );
  }
}
