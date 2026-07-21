import { NextRequest } from 'next/server';
import type { SearchResult, SearchResponse, DateRange } from '@/lib/types';

// ─── Text extraction ──────────────────────────────────────────────────────────

function extractAdfText(description: unknown): string {
  if (!description) return '';
  if (typeof description === 'string') return description.slice(0, 300);
  if (typeof description === 'object' && description !== null) {
    const adf = description as Record<string, unknown>;
    if (Array.isArray(adf.content)) {
      const texts: string[] = [];
      function traverse(nodes: unknown[]) {
        for (const node of nodes) {
          if (typeof node === 'object' && node !== null) {
            const n = node as Record<string, unknown>;
            if (n.type === 'text' && typeof n.text === 'string') texts.push(n.text);
            if (Array.isArray(n.content)) traverse(n.content as unknown[]);
          }
        }
      }
      traverse(adf.content as unknown[]);
      return texts.join(' ').slice(0, 300);
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
  source: 'jira' | 'jsm' = 'jira'
): Promise<SearchResult[]> {
  const safeQ = q.replace(/"/g, '\\"').split(/\s+/).filter(Boolean).map(t => `${t}*`).join(' ');
  const projectFilter = projectKey ? `project="${projectKey.replace(/"/g, '')}" AND ` : '';
  const jql = `${projectFilter}text~"${safeQ}"${getJiraDateFilter(dateRange)} ORDER BY updated DESC`;

  const params = new URLSearchParams({
    jql,
    maxResults: '20',
    fields: 'summary,description,status,assignee,updated,issuetype,project',
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
    const status = fields.status as Record<string, string> | null;
    const issueType = fields.issuetype as Record<string, string> | null;
    const project = fields.project as Record<string, string> | null;

    return {
      id: issue.id as string,
      source,
      title: fields.summary as string,
      snippet: extractAdfText(fields.description),
      url: `${authConfig.baseUrl}/browse/${issue.key}`,
      key: issue.key as string,
      author: assignee?.displayName ?? '미배정',
      date: fields.updated as string,
      status: status?.name ?? '',
      issueType: issueType?.name ?? '',
      project: project?.name ?? '',
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
    const container = item.resultParentContainer as Record<string, string> | null;

    return {
      id: (content?.id as string) ?? String(Math.random()),
      source: 'confluence' as const,
      title: item.title as string,
      snippet: stripHtmlAndMarkers((item.excerpt as string) ?? ''),
      url: `${authConfig.baseUrl}/wiki${item.url as string}`,
      author: lastModifier?.displayName ?? '',
      date: item.lastModified as string,
      space: container?.title ?? '',
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
  dateRange: DateRange
): Promise<SearchResult[]> {
  const safeQ = q.replace(/'/g, "\\'");
  const query = `fullText contains '${safeQ}' and trashed = false${getDriveDateFilter(dateRange)}`;

  const params = new URLSearchParams({
    q: query,
    fields: 'files(id,name,mimeType,webViewLink,modifiedTime,owners)',
    pageSize: '20',
    orderBy: 'modifiedTime desc',
  });

  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Drive 오류 (${response.status}): ${text.slice(0, 200)}`);
  }

  const data = await response.json();

  return (data.files ?? []).map((file: Record<string, unknown>) => {
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
    };
  });
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get('q')?.trim();
  const sourcesParam = searchParams.get('sources');
  const dateRange = (searchParams.get('dateRange') as DateRange) ?? 'all';

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

  const googleToken = request.headers.get('x-google-token');
  
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
      searchJira(q, atlassianConfig, dateRange, jiraProjectKey, 'jsm')
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
      searchGoogleDrive(q, googleToken, dateRange)
        .then((r) => { allResults.push(...r); counts.drive = r.length; })
        .catch((e: Error) => { errors.drive = e.message; })
    );
  }

  await Promise.all(tasks);

  const response: SearchResponse = { results: allResults, counts, errors };
  return Response.json(response);
}
