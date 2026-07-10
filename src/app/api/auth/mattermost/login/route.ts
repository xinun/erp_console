import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { serverUrl, loginId, password } = await request.json();

  if (!serverUrl || !loginId || !password) {
    return NextResponse.json({ error: '필수 값이 누락되었습니다.' }, { status: 400 });
  }

  try {
    const cleanUrl = serverUrl.replace(/\/$/, '');
    const res = await fetch(`${cleanUrl}/api/v4/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login_id: loginId, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: data.message || `로그인 실패 (${res.status})` },
        { status: res.status }
      );
    }

    const token = res.headers.get('Token');
    if (!token) {
      return NextResponse.json({ error: '토큰을 받지 못했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ token });
  } catch (err: any) {
    return NextResponse.json({ error: '서버에 연결할 수 없습니다.' }, { status: 500 });
  }
}
