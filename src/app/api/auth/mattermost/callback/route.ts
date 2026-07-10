import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const sendHtmlResponse = (messagePayload: any) => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>Mattermost Auth</title></head>
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
  };

  if (error) {
    return sendHtmlResponse({ type: 'MATTERMOST_AUTH_ERROR', error });
  }

  if (!code) {
    return sendHtmlResponse({ type: 'MATTERMOST_AUTH_ERROR', error: 'No code provided' });
  }

  const mattermostUrl = process.env.NEXT_PUBLIC_MATTERMOST_URL;
  const clientId = process.env.NEXT_PUBLIC_MATTERMOST_CLIENT_ID;
  const clientSecret = process.env.MATTERMOST_CLIENT_SECRET;
  const redirectUri = `${request.nextUrl.origin}/api/auth/mattermost/callback`;

  if (!mattermostUrl || !clientId || !clientSecret) {
    return sendHtmlResponse({ type: 'MATTERMOST_AUTH_ERROR', error: 'Server configuration missing' });
  }

  try {
    const cleanBaseUrl = mattermostUrl.replace(/\/$/, '');
    
    // Exchange code for access token
    const tokenResponse = await fetch(`${cleanBaseUrl}/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Mattermost token error:', tokenData);
      return sendHtmlResponse({ type: 'MATTERMOST_AUTH_ERROR', error: 'Failed to obtain access token' });
    }

    const { access_token } = tokenData;

    return sendHtmlResponse({
      type: 'MATTERMOST_AUTH_SUCCESS',
      payload: {
        access_token,
        // Mattermost OAuth tokens typically don't have a short expiry like Atlassian,
        // but we'll set a generous expiry or rely on API failures to trigger re-auth.
        expires_at: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
      },
    });
  } catch (err: any) {
    console.error('Mattermost auth callback exception:', err);
    return sendHtmlResponse({ type: 'MATTERMOST_AUTH_ERROR', error: 'Internal server error' });
  }
}
