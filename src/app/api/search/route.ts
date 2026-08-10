import { NextRequest } from 'next/server';
import { formatMattermostUserName } from '@/lib/mattermost-user';
import type { SearchResult, SearchResponse, DateRange } from '@/lib/types';

// ─── Text extraction ──────────────────────────────────────────────────────────

function extractAdfText(description: unknown): string {
  if (!description) return '';
  if (typeof description === 'string') return description;
  if (typeof description === 'object' && description !== null) {
    const adf = description as Record<string, unknown>;
    if (Array.isArray(adf.content)) {
      const texts: string[] = [];
      function traverse(nodes: unknown[]) {
        for (const node of nodes) {
          if (typeof node === 'object' && node !== null) {
            const n = node as Record<string, unknown>;
            if (n.type === 'text' && typeof n.text === 'string') texts.push(n.text);
            if (n.type === 'hardBreak') texts.push('\n');
            if (n.type === 'listItem') texts.push('• ');
            if (Array.isArray(n.content)) traverse(n.content as unknown[]);
            if (['paragraph', 'heading', 'listItem', 'blockquote', 'codeBlock'].includes(String(n.type))) texts.push('\n');
          }
        }
      }
      traverse(adf.content as unknown[]);
      return texts.join('').replace(/\n{3,}/g, '\n\n').trim();
    }
  }
  return '';
}

function stripHtmlAndMarkers(text: string): string {
  return text
    .replace(/@@@hl@@@/g, '')
    .replace(/@@@endhl@@@/g, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function getContextSnippet(text: string, query: string): string {
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  if (!normalizedText) return '';
  const lowerText = normalizedText.toLocaleLowerCase();
  const candidates = [query.trim(), ...query.trim().split(/\s+/)]
    .filter((candidate, index, values) => candidate.length > 1 && values.indexOf(candidate) === index)
    .sort((a, b) => b.length - a.length);
  const matchIndex = candidates
    .map((candidate) => lowerText.indexOf(candidate.toLocaleLowerCase()))
    .find((index) => index >= 0);
  if (matchIndex === undefined) return normalizedText.slice(0, 280);

  const start = Math.max(0, matchIndex - 90);
  const end = Math.min(normalizedText.length, matchIndex + 190);
  return `${start > 0 ? '…' : ''}${normalizedText.slice(start, end)}${end < normalizedText.length ? '…' : ''}`;
}

function calculateRelevance(result: SearchResult, query: string): number {
  const normalizedQuery = query.toLocaleLowerCase().trim();
  const terms = normalizedQuery
    .split(/\s+/)
    .map((term) => term.replace(/["*]/g, ''))
    .filter((term) => term.length > 0 && !term.includes(':'));
  const title = result.title.toLocaleLowerCase();
  const body = [result.snippet, result.content, result.author, result.project, result.space, result.channelName]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase();

  let score = 0;
  if (title === normalizedQuery) score += 120;
  else if (title.includes(normalizedQuery)) score += 80;
  for (const term of terms) {
    if (title.includes(term)) score += 24;
    if (body.includes(term)) score += 8;
  }
  if (result.matchType === 'title') score += 40;
  if (result.matchType === 'content') score += 15;

  const age = Date.now() - new Date(result.date).getTime();
  if (Number.isFinite(age) && age >= 0) {
    score += Math.max(0, 12 - Math.floor(age / (30 * 24 * 60 * 60 * 1000)));
  }
  return score;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getJiraDateFilter(dateRange: DateRange): string {
  switch (dateRange) {
    case '1w': return ' AND updated >= -7d';
    case '1m': return ' AND updated >= -30d';
    case '3m': return ' AND updated >= -90d';
    default: return '';
  }
}

function getConfluenceDateFilter(dateRange: DateRange): string {
  if (dateRange === 'all') return '';
  const days = dateRange === '1w' ? 7 : dateRange === '1m' ? 30 : 90;
  const date = new Date();
  date.setDate(date.getDate() - days);
  return ` AND lastModified >= "${date.toISOString().split('T')[0]}"`;
}

function getDriveDateFilter(dateRange: DateRange): string {
  if (dateRange === 'all') return '';
  const days = dateRange === '1w' ? 7 : dateRange === '1m' ? 30 : 90;
  const date = new Date();
  date.setDate(date.getDate() - days);
  return ` and modifiedTime > '${date.toISOString()}'`;
}

// ─── Jira ─────────────────────────────────────────────────────────────────────

type AtlassianAuthConfig = 
  | { type: 'basic'; baseUrl: string; email: string; token: string }
  | { type: 'oauth'; baseUrl: string; cloudId: string; accessToken: string };

async function searchJira(
  q: string,
  authConfig: AtlassianAuthConfig,
  dateRange: DateRange,
  projectKey?: string,
  source: 'jira' | 'jsm' = 'jira',
  jqlFilter?: string
): Promise<SearchResult[]> {
  const safeQ = q.replace(/"/g, '\\"').split(/\s+/).filter(Boolean).map(t => `${t}*`).join(' ');
  const projectFilter = projectKey ? `project="${projectKey.replace(/"/g, '')}"` : '';
  const scopeFilter = jqlFilter?.trim() || projectFilter;
  const jql = `${scopeFilter ? `(${scopeFilter}) AND ` : ''}text~"${safeQ}"${getJiraDateFilter(dateRange)} ORDER BY updated DESC`;

  const params = new URLSearchParams({
    jql,
    maxResults: '20',
    fields: 'summary,description,status,assignee,reporter,priority,labels,comment,created,updated,issuetype,project',
  });

  const url = authConfig.type === 'basic'
    ? `${authConfig.baseUrl}/rest/api/3/search/jql?${params}`
    : `https://api.atlassian.com/ex/jira/${authConfig.cloudId}/rest/api/3/search/jql?${params}`;

  const authHeader = authConfig.type === 'basic'
    ? `Basic ${Buffer.from(`${authConfig.email}:${authConfig.token}`).toString('base64')}`
    : `Bearer ${authConfig.accessToken}`;

  const response = await fetch(url, {
    headers: { Authorization: authHeader, Accept: 'application/json' },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Jira 오류 (${response.status}): ${text.slice(0, 200)}`);
  }

  const data = await response.json();

  return (data.issues ?? []).map((issue: Record<string, unknown>) => {
    const fields = issue.fields as Record<string, unknown>;
    const assignee = fields.assignee as Record<string, string> | null;
    const reporter = fields.reporter as Record<string, string> | null;
    const priority = fields.priority as Record<string, string> | null;
    const status = fields.status as Record<string, string> | null;
    const issueType = fields.issuetype as Record<string, string> | null;
    const project = fields.project as Record<string, string> | null;
    const commentPage = fields.comment as { total?: number; comments?: Array<Record<string, unknown>> } | null;
    const comments = (commentPage?.comments ?? []).map((comment) => {
      const commentAuthor = comment.author as Record<string, string> | undefined;
      return {
        id: String(comment.id ?? ''),
        author: commentAuthor?.displayName ?? '알 수 없음',
        avatarUrl: commentAuthor?.avatarUrls
          ? (commentAuthor.avatarUrls as unknown as Record<string, string>)['48x48']
          : undefined,
        body: extractAdfText(comment.body),
        created: String(comment.created ?? ''),
        updated: comment.updated ? String(comment.updated) : undefined,
      };
    });

    const contentText = extractAdfText(fields.description);
    return {
      id: issue.id as string,
      source,
      title: fields.summary as string,
      snippet: contentText,
      content: contentText,
      url: `${authConfig.baseUrl}/browse/${issue.key}`,
      key: issue.key as string,
      author: assignee?.displayName ?? '미배정',
      date: fields.updated as string,
      status: status?.name ?? '',
      issueType: issueType?.name ?? '',
      project: project?.name ?? '',
      reporter: reporter?.displayName ?? '',
      priority: priority?.name ?? '',
      labels: Array.isArray(fields.labels) ? fields.labels.map(String) : [],
      comments,
      commentsTotal: commentPage?.total ?? comments.length,
    };
  });
}

// ─── Confluence ───────────────────────────────────────────────────────────────

async function searchConfluence(
  q: string,
  authConfig: AtlassianAuthConfig,
  dateRange: DateRange
): Promise<SearchResult[]> {
  const safeQ = q.replace(/"/g, '\\"').split(/\s+/).filter(Boolean).map(t => `${t}*`).join(' ');
  const cql = `text~"${safeQ}"${getConfluenceDateFilter(dateRange)} ORDER BY lastModified DESC`;

  const params = new URLSearchParams({ cql, limit: '20', excerpt: 'highlight' });

  const url = authConfig.type === 'basic'
    ? `${authConfig.baseUrl}/wiki/rest/api/search?${params}`
    : `https://api.atlassian.com/ex/confluence/${authConfig.cloudId}/rest/api/search?${params}`;

  const authHeader = authConfig.type === 'basic'
    ? `Basic ${Buffer.from(`${authConfig.email}:${authConfig.token}`).toString('base64')}`
    : `Bearer ${authConfig.accessToken}`;

  const response = await fetch(url, {
    headers: { Authorization: authHeader, Accept: 'application/json' },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Confluence 오류 (${response.status}): ${text.slice(0, 200)}`);
  }

  const data = await response.json();

  return (data.results ?? []).map((item: Record<string, unknown>) => {
    const content = item.content as Record<string, unknown> | null;
    const lastModifier = item.lastModifier as Record<string, string> | null;
    const contentSpace = content?.space as Record<string, string> | null;
    const globalContainer = item.resultGlobalContainer as Record<string, string> | null;
    const parentContainer = item.resultParentContainer as Record<string, string> | null;

    return {
      id: (content?.id as string) ?? String(Math.random()),
      source: 'confluence' as const,
      title: item.title as string,
      snippet: stripHtmlAndMarkers((item.excerpt as string) ?? ''),
      url: `${authConfig.baseUrl}/wiki${item.url as string}`,
      author: lastModifier?.displayName ?? '',
      date: item.lastModified as string,
      space: contentSpace?.name || globalContainer?.title || parentContainer?.title || '',
      pageType: (content?.type as string) ?? 'page',
    };
  });
}

// ─── Google Drive ─────────────────────────────────────────────────────────────

function getDriveFileType(mimeType: string): string {
  const map: Record<string, string> = {
    'application/vnd.google-apps.document': 'Docs',
    'application/vnd.google-apps.spreadsheet': 'Sheets',
    'application/vnd.google-apps.presentation': 'Slides',
    'application/vnd.google-apps.folder': '폴더',
    'application/vnd.google-apps.form': 'Forms',
    'application/pdf': 'PDF',
  };
  return map[mimeType] ?? '파일';
}

async function searchGoogleDrive(
  q: string,
  accessToken: string,
  dateRange: DateRange,
  googleFileTypes: string[],
  googleSearchAreas: string[]
): Promise<SearchResult[]> {
  const safeQ = q.replace(/'/g, "\\'");
  const mimeTypes = {
    docs: 'application/vnd.google-apps.document',
    sheets: 'application/vnd.google-apps.spreadsheet',
    slides: 'application/vnd.google-apps.presentation',
    folder: 'application/vnd.google-apps.folder',
  } as const;
  const selectedTypes = new Set(googleFileTypes);
  const mimeClauses = [
    ...(selectedTypes.has('docs') ? [`mimeType = '${mimeTypes.docs}'`] : []),
    ...(selectedTypes.has('sheets') ? [`mimeType = '${mimeTypes.sheets}'`] : []),
    ...(selectedTypes.has('slides') ? [`mimeType = '${mimeTypes.slides}'`] : []),
    ...(selectedTypes.has('files') ? [
      `(mimeType != '${mimeTypes.docs}' and mimeType != '${mimeTypes.sheets}' and mimeType != '${mimeTypes.slides}' and mimeType != '${mimeTypes.folder}')`,
    ] : []),
  ];
  const mimeFilter = mimeClauses.length > 0 ? ` and (${mimeClauses.join(' or ')})` : '';
  const baseFilter = `trashed = false${mimeFilter}${getDriveDateFilter(dateRange)}`;
  const fullTextQuery = `fullText contains '${safeQ}' and ${baseFilter}`;
  const titleQuery = `name contains '${safeQ}' and ${baseFilter}`;

  const areaConfigs = [
    ...(googleSearchAreas.includes('user') ? [{ area: 'user', corpora: 'user' }] : []),
    ...(googleSearchAreas.includes('sharedDrives') ? [{ area: 'sharedDrives', corpora: 'allDrives' }] : []),
    ...(googleSearchAreas.includes('domain') ? [{ area: 'domain', corpora: 'domain' }] : []),
  ];

  const searchArea = async (area: string, corpora: string, driveQuery: string) => {
    const params = new URLSearchParams({
      q: driveQuery,
      fields: 'files(id,name,mimeType,webViewLink,modifiedTime,owners,driveId)',
      pageSize: '100',
      orderBy: 'modifiedTime desc',
      spaces: 'drive',
      corpora,
    });
    if (area !== 'user') {
      params.set('includeItemsFromAllDrives', 'true');
      params.set('supportsAllDrives', 'true');
    }

    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Google Drive 오류 (${response.status}): ${text.slice(0, 200)}`);
    }

    const data = await response.json();
    const files = (data.files ?? []) as Array<Record<string, unknown>>;
    return area === 'sharedDrives' ? files.filter((file) => Boolean(file.driveId)) : files;
  };

  const [fullTextAreaFiles, titleAreaFiles] = await Promise.all([
    Promise.all(areaConfigs.map(({ area, corpora }) => searchArea(area, corpora, fullTextQuery))),
    Promise.all(areaConfigs.map(({ area, corpora }) => searchArea(area, corpora, titleQuery))),
  ]);
  const titleMatchIds = new Set(titleAreaFiles.flat().map((file) => file.id as string));

  const uniqueFiles = Array.from(
    new Map(fullTextAreaFiles.flat().map((file) => [file.id as string, file])).values()
  ).sort((a, b) => new Date((b.modifiedTime as string) ?? 0).getTime() - new Date((a.modifiedTime as string) ?? 0).getTime());

  return uniqueFiles.map((file) => {
    const owners = file.owners as Array<{ displayName: string }> | undefined;
    const mimeType = (file.mimeType as string) ?? '';
    const fileType = getDriveFileType(mimeType);

    return {
      id: file.id as string,
      source: 'drive' as const,
      title: file.name as string,
      snippet: '',
      url: (file.webViewLink as string) ?? `https://drive.google.com/file/d/${file.id}/view`,
      author: owners?.[0]?.displayName ?? '',
      date: (file.modifiedTime as string) ?? '',
      fileType,
      mimeType,
      matchType: titleMatchIds.has(file.id as string) ? 'title' as const : 'content' as const,
    };
  });
}

// ─── Mattermost ───────────────────────────────────────────────────────────────

interface MattermostPost {
  id: string;
  message?: string;
  user_id?: string;
  channel_id?: string;
  create_at?: number;
  root_id?: string;
  reply_count?: number;
}

interface MattermostTeam {
  id: string;
  name: string;
  display_name: string;
}

interface MattermostUser {
  id: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  nickname?: string;
}

interface MattermostChannel {
  id: string;
  name?: string;
  display_name?: string;
  type?: string;
}

interface MattermostChannelMember {
  user_id: string;
}

interface MattermostFileInfo {
  id: string;
  user_id?: string;
  post_id?: string;
  channel_id?: string;
  create_at?: number;
  name?: string;
  extension?: string;
  size?: number;
  mime_type?: string;
}

function expandShortMattermostTerms(query: string): string {
  return query
    .split(/\s+/)
    .map((term) => /^[가-힣]{1,2}$/.test(term) ? `${term}*` : term)
    .join(' ');
}

async function searchMattermost(
  q: string,
  accessToken: string,
  dateRange: DateRange
): Promise<SearchResult[]> {
  const baseUrl = process.env.MATTERMOST_BASE_URL?.replace(/\/+$/, '');
  if (!baseUrl) throw new Error('Mattermost 서버 환경변수가 설정되지 않았습니다.');

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
  };
  const searchTerms = expandShortMattermostTerms(q);
  const [teamsResponse, currentUserResponse] = await Promise.all([
    fetch(`${baseUrl}/api/v4/users/me/teams`, { headers, cache: 'no-store' }),
    fetch(`${baseUrl}/api/v4/users/me`, { headers, cache: 'no-store' }),
  ]);

  if (!teamsResponse.ok) {
    throw new Error(`Mattermost 팀 조회 오류 (${teamsResponse.status})`);
  }

  const teams = await teamsResponse.json() as MattermostTeam[];
  const currentUser = currentUserResponse.ok ? await currentUserResponse.json() as MattermostUser : null;
  const [groups, fileGroups] = await Promise.all([
    Promise.all(teams.map(async (team) => {
      const response = await fetch(`${baseUrl}/api/v4/teams/${team.id}/posts/search`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ terms: searchTerms, is_or_search: false }),
        cache: 'no-store',
      });
      if (!response.ok) return [];

      const data = await response.json() as {
        order?: string[];
        posts?: Record<string, MattermostPost>;
      };

      return (data.order ?? []).flatMap((postId) => {
        const post = data.posts?.[postId];
        if (!post) return [];
        return [{ post, team }];
      });
    })),
    Promise.all(teams.map(async (team) => {
      const formData = new FormData();
      formData.set('terms', searchTerms);
      formData.set('is_or_search', 'false');
      formData.set('include_deleted_channels', 'true');
      formData.set('per_page', '100');
      const response = await fetch(`${baseUrl}/api/v4/teams/${team.id}/files/search`, {
        method: 'POST',
        headers,
        body: formData,
        cache: 'no-store',
      });
      if (!response.ok) return [];
      const data = await response.json() as { file_infos?: MattermostFileInfo[] };
      return (data.file_infos ?? []).map((file) => ({ file, team }));
    })),
  ]);

  const matches = groups.flat();
  const fileMatches = fileGroups.flat();
  const userIds = [...new Set([
    ...matches.map(({ post }) => post.user_id),
    ...fileMatches.map(({ file }) => file.user_id),
  ].filter((id): id is string => !!id))];
  const channelIds = [...new Set([
    ...matches.map(({ post }) => post.channel_id),
    ...fileMatches.map(({ file }) => file.channel_id),
  ].filter((id): id is string => !!id))];
  const channelIdsByTeam = new Map<string, Set<string>>();
  for (const { post, team } of matches) {
    if (!post.channel_id) continue;
    const ids = channelIdsByTeam.get(team.id) ?? new Set<string>();
    ids.add(post.channel_id);
    channelIdsByTeam.set(team.id, ids);
  }
  for (const { file, team } of fileMatches) {
    if (!file.channel_id) continue;
    const ids = channelIdsByTeam.get(team.id) ?? new Set<string>();
    ids.add(file.channel_id);
    channelIdsByTeam.set(team.id, ids);
  }

  const [usersResponse, channelsByTeam] = await Promise.all([
    userIds.length > 0
      ? fetch(`${baseUrl}/api/v4/users/ids`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify(userIds),
          cache: 'no-store',
        })
      : null,
    Promise.all([...channelIdsByTeam.entries()].map(async ([teamId, ids]) => {
      const response = await fetch(`${baseUrl}/api/v4/teams/${encodeURIComponent(teamId)}/channels/ids`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify([...ids]),
        cache: 'no-store',
      });
      return response.ok ? await response.json() as MattermostChannel[] : [];
    })),
  ]);
  const users = usersResponse?.ok ? await usersResponse.json() as MattermostUser[] : [];
  const userById = new Map(users.map((user) => [user.id, user]));
  const channelById = new Map(channelsByTeam.flat().map((channel) => [channel.id, channel]));

  const missingChannelIds = channelIds.filter((channelId) => !channelById.has(channelId));
  const fallbackChannels = await Promise.all(missingChannelIds.map(async (channelId) => {
    const response = await fetch(`${baseUrl}/api/v4/channels/${encodeURIComponent(channelId)}`, {
      headers,
      cache: 'no-store',
    });
    return response.ok ? await response.json() as MattermostChannel : null;
  }));
  for (const channel of fallbackChannels) {
    if (channel) channelById.set(channel.id, channel);
  }

  const conversationChannels = [...channelById.values()].filter((channel) => channel.type === 'D' || channel.type === 'G');
  const conversationMembers = new Map<string, string[]>();
  const memberGroups = await Promise.all(conversationChannels.map(async (channel) => {
    const response = await fetch(`${baseUrl}/api/v4/channels/${encodeURIComponent(channel.id)}/members?page=0&per_page=100`, {
      headers,
      cache: 'no-store',
    });
    if (response.ok) {
      const members = await response.json() as MattermostChannelMember[];
      return [channel.id, members.map((member) => member.user_id)] as const;
    }
    const parsedIds = channel.type === 'D' ? (channel.name ?? '').split('__').filter(Boolean) : [];
    return [channel.id, parsedIds] as const;
  }));
  for (const [channelId, memberIds] of memberGroups) conversationMembers.set(channelId, memberIds);

  const missingMemberIds = [...new Set(memberGroups.flatMap(([, memberIds]) => memberIds))]
    .filter((userId) => !userById.has(userId));
  if (missingMemberIds.length > 0) {
    const response = await fetch(`${baseUrl}/api/v4/users/ids`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(missingMemberIds),
      cache: 'no-store',
    });
    if (response.ok) {
      const memberUsers = await response.json() as MattermostUser[];
      for (const user of memberUsers) userById.set(user.id, user);
    }
  }

  const getUserName = (user?: MattermostUser) => formatMattermostUserName(user);
  const getChannelName = (channel?: MattermostChannel) => {
    if (!channel) return '알 수 없는 채널';
    if (channel.type === 'D' || channel.type === 'G') {
      const names = (conversationMembers.get(channel.id) ?? [])
        .filter((userId) => userId !== currentUser?.id)
        .map((userId) => getUserName(userById.get(userId)))
        .filter(Boolean);
      if (channel.type === 'D') return names[0] ? `${names[0]}님과의 대화` : '개인 메시지';
      if (names.length === 0) return '그룹 메시지';
      return `${names.slice(0, 2).join(', ')}${names.length > 2 ? ` 외 ${names.length - 2}명` : ''} 그룹 대화`;
    }
    return channel.display_name || channel.name || '알 수 없는 채널';
  };

  const matchedResults = matches.map(({ post, team }) => {
    const user = post.user_id ? userById.get(post.user_id) : undefined;
    const channel = post.channel_id ? channelById.get(post.channel_id) : undefined;
    const author = getUserName(user) || '알 수 없는 사용자';
    const channelName = getChannelName(channel);
    const result: SearchResult = {
      id: post.id,
      source: 'mattermost',
      title: `${author}님의 메시지`,
      snippet: post.message ?? '',
      content: post.message ?? '',
      url: `${baseUrl}/${team.name}/pl/${post.id}`,
      author,
      date: new Date(post.create_at ?? 0).toISOString(),
      team: team.display_name,
      channelName,
    };
    return {
      result,
      groupKey: `${team.id}:${post.root_id || post.id}`,
      threadId: post.root_id || post.id,
      isThread: Boolean(post.root_id) || (post.reply_count ?? 0) > 0,
    };
  });

  const groupedResults = new Map<string, typeof matchedResults>();
  for (const item of matchedResults) {
    const group = groupedResults.get(item.groupKey) ?? [];
    group.push(item);
    groupedResults.set(item.groupKey, group);
  }

  const messageResults: SearchResult[] = Array.from(groupedResults.values()).map((group) => {
    const ordered = [...group].sort(
      (a, b) => new Date(a.result.date).getTime() - new Date(b.result.date).getTime()
    );
    const first = ordered[0];
    const latest = ordered[ordered.length - 1];
    const isThread = group.length > 1 || group.some((item) => item.isThread);
    return {
      ...first.result,
      id: isThread ? `thread-${first.threadId}` : first.result.id,
      title: isThread ? `${first.result.channelName || 'Mattermost'} 스레드` : first.result.title,
      url: isThread ? first.result.url.replace(/\/pl\/[^/]+$/, `/pl/${first.threadId}`) : first.result.url,
      date: latest.result.date,
      threadId: isThread ? first.threadId : undefined,
      threadMessages: isThread ? ordered.map(({ result }) => ({
        id: result.id,
        author: result.author,
        message: result.content || result.snippet,
        date: result.date,
      })) : undefined,
      threadMatchCount: isThread ? ordered.length : undefined,
      content: isThread ? ordered.map(({ result }) => result.content || result.snippet).join('\n\n') : first.result.content,
    };
  });

  const fileResults: SearchResult[] = fileMatches.map(({ file, team }) => {
    const user = file.user_id ? userById.get(file.user_id) : undefined;
    const channel = file.channel_id ? channelById.get(file.channel_id) : undefined;
    const author = getUserName(user) || '알 수 없는 사용자';
    const channelName = getChannelName(channel);
    return {
      id: `file-${file.id}`,
      source: 'mattermost',
      resultKind: 'attachment',
      title: file.name || 'Mattermost 첨부파일',
      snippet: `${file.extension?.toUpperCase() || file.mime_type || '파일'} · ${channelName}`,
      url: file.post_id ? `${baseUrl}/${team.name}/pl/${file.post_id}` : `${baseUrl}/${team.name}`,
      author,
      date: new Date(file.create_at ?? 0).toISOString(),
      team: team.display_name,
      channelName,
      fileType: file.extension?.toUpperCase() || '파일',
      mimeType: file.mime_type,
      fileSize: file.size,
      extension: file.extension,
    };
  });

  const results = [...messageResults, ...fileResults];

  const days = dateRange === '1w' ? 7 : dateRange === '1m' ? 30 : dateRange === '3m' ? 90 : null;
  const cutoff = days ? Date.now() - days * 24 * 60 * 60 * 1000 : null;
  return results
    .filter((result) => !cutoff || new Date(result.date).getTime() >= cutoff)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get('q')?.trim();
  const sourcesParam = searchParams.get('sources');
  const googleFileTypes = (searchParams.get('googleFileTypes') ?? 'docs,sheets,slides,files')
    .split(',')
    .filter((type) => ['docs', 'sheets', 'slides', 'files'].includes(type));
  const googleSearchAreas = (searchParams.get('googleSearchAreas') ?? 'user,sharedDrives,domain')
    .split(',')
    .filter((area) => ['user', 'sharedDrives', 'domain'].includes(area));
  const dateRange = (searchParams.get('dateRange') as DateRange) ?? 'all';
  const excludedKeywords = (searchParams.get('exclude') ?? '')
    .split(/[\n,]+/)
    .map((keyword) => keyword.trim().toLocaleLowerCase())
    .filter(Boolean);

  if (!q) {
    return Response.json({ results: [], counts: { jira: 0, confluence: 0, jsm: 0, drive: 0, mattermost: 0 }, errors: {} });
  }

  const sources = sourcesParam ? sourcesParam.split(',') : ['jira', 'confluence'];

  // Basic Auth headers
  const jiraBaseUrl = request.headers.get('x-jira-base-url');
  const jiraEmail = request.headers.get('x-jira-email');
  const jiraToken = request.headers.get('x-jira-token');
  
  // OAuth headers
  const atlassianOAuthToken = request.headers.get('x-atlassian-oauth-token');
  const atlassianCloudId = request.headers.get('x-atlassian-cloud-id');
  const atlassianSiteUrl = request.headers.get('x-atlassian-site-url');
  const jiraProjectKey = request.headers.get('x-jira-project-key') ?? undefined;
  const encodedJqlFilter = request.headers.get('x-jira-jql-filter');
  const jiraJqlFilter = encodedJqlFilter ? decodeURIComponent(encodedJqlFilter) : undefined;

  const googleToken = request.headers.get('x-google-token');
  const mattermostToken = request.headers.get('x-mattermost-token');
  
  const errors: Record<string, string> = {};
  const allResults: SearchResult[] = [];
  const counts = { jira: 0, confluence: 0, jsm: 0, drive: 0, mattermost: 0 };

  const tasks: Promise<void>[] = [];

  const needsAtlassianAuth = sources.includes('jira') || sources.includes('confluence') || sources.includes('jsm');
  let atlassianConfig: AtlassianAuthConfig | null = null;

  if (needsAtlassianAuth) {
    if (atlassianOAuthToken && atlassianCloudId && atlassianSiteUrl) {
      atlassianConfig = {
        type: 'oauth',
        baseUrl: atlassianSiteUrl,
        cloudId: atlassianCloudId,
        accessToken: atlassianOAuthToken,
      };
    } else if (jiraBaseUrl && jiraEmail && jiraToken) {
      atlassianConfig = {
        type: 'basic',
        baseUrl: jiraBaseUrl,
        email: jiraEmail,
        token: jiraToken,
      };
    } else {
      return Response.json(
        { error: '설정이 필요합니다. 설정 페이지에서 연동을 완료해주세요.' },
        { status: 401 }
      );
    }
  }

  if (sources.includes('jira') && atlassianConfig) {
    tasks.push(
      searchJira(q, atlassianConfig, dateRange)
        .then((r) => { allResults.push(...r); counts.jira = r.length; })
        .catch((e: Error) => { errors.jira = e.message; })
    );
  }

  if (sources.includes('jsm') && atlassianConfig) {
    tasks.push(
      searchJira(q, atlassianConfig, dateRange, jiraProjectKey, 'jsm', jiraJqlFilter)
        .then((r) => { allResults.push(...r); counts.jsm = r.length; })
        .catch((e: Error) => { errors.jsm = e.message; })
    );
  }

  if (sources.includes('confluence') && atlassianConfig) {
    tasks.push(
      searchConfluence(q, atlassianConfig, dateRange)
        .then((r) => { allResults.push(...r); counts.confluence = r.length; })
        .catch((e: Error) => { errors.confluence = e.message; })
    );
  }

  if (sources.includes('drive') && googleToken) {
    tasks.push(
      searchGoogleDrive(q, googleToken, dateRange, googleFileTypes, googleSearchAreas)
        .then((r) => { allResults.push(...r); counts.drive = r.length; })
        .catch((e: Error) => { errors.drive = e.message; })
    );
  }

  if (sources.includes('mattermost') && mattermostToken) {
    tasks.push(
      searchMattermost(q, mattermostToken, dateRange)
        .then((r) => { allResults.push(...r); counts.mattermost = r.length; })
        .catch((e: Error) => { errors.mattermost = e.message; })
    );
  }

  await Promise.all(tasks);

  const filteredResults = excludedKeywords.length === 0
    ? allResults
    : allResults.filter((result) => {
        const searchableText = [
          result.title,
          result.snippet,
          result.author,
          result.project,
          result.space,
          result.team,
        ].filter(Boolean).join(' ').toLocaleLowerCase();
        return !excludedKeywords.some((keyword) => searchableText.includes(keyword));
      });
  const results = filteredResults
    .map((result) => ({
      ...result,
      snippet: getContextSnippet(result.snippet, q),
      relevanceScore: calculateRelevance(result, q),
    }))
    .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0));
  const filteredCounts = {
    jira: results.filter((result) => result.source === 'jira').length,
    confluence: results.filter((result) => result.source === 'confluence').length,
    jsm: results.filter((result) => result.source === 'jsm').length,
    drive: results.filter((result) => result.source === 'drive').length,
    mattermost: results.filter((result) => result.source === 'mattermost').length,
  };

  const response: SearchResponse = { results, counts: filteredCounts, errors };
  return Response.json(response);
}
