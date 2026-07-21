import type { SearchResult } from './types';

interface MattermostPost {
  id: string;
  message?: string;
  user_id?: string;
  create_at?: number;
}

interface MattermostSearchResponse {
  order?: string[];
  posts?: Record<string, MattermostPost>;
}

interface MattermostTeam {
  id: string;
  name: string;
  display_name: string;
}

export async function searchMattermostFromBrowser(
  query: string,
  baseUrl: string,
  token: string
): Promise<SearchResult[]> {
  const teamsResponse = await fetch(`${baseUrl}/api/v4/users/me/teams`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!teamsResponse.ok) {
    throw new Error(`팀 조회에 실패했습니다 (${teamsResponse.status}).`);
  }

  const teams = (await teamsResponse.json()) as MattermostTeam[];
  const groups = await Promise.all(
    teams.map(async (team) => {
      const response = await fetch(`${baseUrl}/api/v4/teams/${team.id}/posts/search`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ terms: query, is_or_search: false }),
      });

      if (!response.ok) return [];
      const data = (await response.json()) as MattermostSearchResponse;

      return (data.order ?? []).flatMap((postId): SearchResult[] => {
        const post = data.posts?.[postId];
        if (!post) return [];

        return [{
          id: post.id,
          source: 'mattermost',
          title: `메시지 (${team.display_name})`,
          snippet: post.message ?? '',
          url: `${baseUrl}/${team.name}/pl/${post.id}`,
          author: post.user_id ?? 'Mattermost User',
          date: new Date(post.create_at ?? 0).toISOString(),
          team: team.display_name,
        }];
      });
    })
  );

  return groups.flat().sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}
