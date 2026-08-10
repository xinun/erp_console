import { NextRequest } from 'next/server';
import { formatMattermostUserName } from '@/lib/mattermost-user';

interface MattermostPost {
  id: string;
  message?: string;
  user_id?: string;
  create_at?: number;
}

interface MattermostUser {
  id: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  nickname?: string;
}

export async function GET(request: NextRequest) {
  const postId = request.nextUrl.searchParams.get('postId')?.trim();
  const accessToken = request.headers.get('x-mattermost-token');
  const baseUrl = process.env.MATTERMOST_BASE_URL?.replace(/\/+$/, '');

  if (!postId || !/^[a-z0-9]+$/i.test(postId)) {
    return Response.json({ error: '올바른 Mattermost 스레드 ID가 필요합니다.' }, { status: 400 });
  }
  if (!accessToken) {
    return Response.json({ error: 'Mattermost 연결이 필요합니다.' }, { status: 401 });
  }
  if (!baseUrl) {
    return Response.json({ error: 'Mattermost 서버 설정이 필요합니다.' }, { status: 500 });
  }

  const headers = { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' };
  const threadResponse = await fetch(`${baseUrl}/api/v4/posts/${encodeURIComponent(postId)}/thread`, {
    headers,
    cache: 'no-store',
  });
  if (!threadResponse.ok) {
    return Response.json(
      { error: `Mattermost 스레드를 불러오지 못했습니다. (${threadResponse.status})` },
      { status: threadResponse.status }
    );
  }

  const thread = await threadResponse.json() as {
    order?: string[];
    posts?: Record<string, MattermostPost>;
  };
  const posts = (thread.order ?? []).flatMap((id) => thread.posts?.[id] ? [thread.posts[id]] : []);
  const userIds = [...new Set(posts.map((post) => post.user_id).filter((id): id is string => Boolean(id)))];
  const usersResponse = userIds.length > 0
    ? await fetch(`${baseUrl}/api/v4/users/ids`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(userIds),
        cache: 'no-store',
      })
    : null;
  const users = usersResponse?.ok ? await usersResponse.json() as MattermostUser[] : [];
  const userById = new Map(users.map((user) => [user.id, user]));

  const messages = posts
    .map((post) => {
      const user = post.user_id ? userById.get(post.user_id) : undefined;
      return {
        id: post.id,
        author: formatMattermostUserName(user) || '알 수 없는 사용자',
        message: post.message ?? '',
        date: new Date(post.create_at ?? 0).toISOString(),
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return Response.json({ messages });
}
