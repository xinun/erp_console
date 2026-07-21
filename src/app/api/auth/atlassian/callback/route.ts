import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');

  // Popup에 띄울 HTML 응답을 생성하는 헬퍼 함수
  const sendHtmlResponse = (messagePayload: unknown) => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>Atlassian Auth</title></head>
      <body>
        <p>인증을 처리 중입니다. 창이 닫히지 않으면 수동으로 닫아주세요.</p>
        <script>
          if (window.opener) {
            window.opener.postMessage(
              ${JSON.stringify(messagePayload)},
              window.location.origin
            );
          }
          window.close();
        </script>
      </body>
      </html>
    `;
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  if (error) {
    return sendHtmlResponse({ type: 'ATLASSIAN_AUTH_ERROR', error });
  }

  if (!code) {
    return sendHtmlResponse({ type: 'ATLASSIAN_AUTH_ERROR', error: 'No code provided' });
  }

  const clientId = process.env.NEXT_PUBLIC_ATLASSIAN_CLIENT_ID;
  const clientSecret = process.env.ATLASSIAN_CLIENT_SECRET;
  const redirectUri = `${request.nextUrl.origin}/api/auth/atlassian/callback`;

  if (!clientId || !clientSecret) {
    return sendHtmlResponse({ type: 'ATLASSIAN_AUTH_ERROR', error: 'Server configuration missing' });
  }

  try {
    // 1. Exchange code for access token
    const tokenResponse = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Atlassian token error:', tokenData);
      return sendHtmlResponse({ type: 'ATLASSIAN_AUTH_ERROR', error: 'Failed to obtain access token' });
    }

    const { access_token, refresh_token, expires_in } = tokenData;

    // 2. Get accessible resources (Cloud IDs)
    const resourcesResponse = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: 'application/json',
      },
    });

    const resources = await resourcesResponse.json();

    if (!resourcesResponse.ok || !Array.isArray(resources) || resources.length === 0) {
      console.error('Atlassian resources error:', resources);
      return sendHtmlResponse({ type: 'ATLASSIAN_AUTH_ERROR', error: 'No accessible resources found' });
    }

    // 3. 부모 창으로 데이터 전달
    return sendHtmlResponse({
      type: 'ATLASSIAN_AUTH_SUCCESS',
      payload: {
        access_token,
        refresh_token,
        expires_at: Date.now() + expires_in * 1000,
        state,
        resources: resources.map((resource: unknown) => {
          const item = resource as Record<string, unknown>;
          return {
            id: String(item.id ?? ''),
            url: String(item.url ?? ''),
            name: String(item.name ?? ''),
            avatarUrl: String(item.avatarUrl ?? ''),
          };
        }),
      },
    });
  } catch (err: unknown) {
    console.error('Atlassian auth callback exception:', err);
    return sendHtmlResponse({ type: 'ATLASSIAN_AUTH_ERROR', error: 'Internal server error' });
  }
}
