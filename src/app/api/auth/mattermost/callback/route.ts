import { NextResponse } from 'next/server';

export function GET() {
  const html = `
    <!DOCTYPE html>
    <html lang="ko">
    <head><title>Mattermost Auth</title></head>
    <body>
      <p>인증을 처리하고 있습니다. 창이 닫히지 않으면 수동으로 닫아주세요.</p>
      <script>
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const error = params.get('error');
        const errorDescription = params.get('error_description');
        const state = params.get('state');

        const payload = code
          ? {
              type: 'MATTERMOST_AUTH_CODE',
              payload: {
                code,
                state,
              },
            }
          : {
              type: 'MATTERMOST_AUTH_ERROR',
              error: errorDescription || error || 'Mattermost가 액세스 토큰을 반환하지 않았습니다.',
            };

        if (window.opener) {
          window.opener.postMessage(payload, window.location.origin);
        }
        window.close();
      </script>
    </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
