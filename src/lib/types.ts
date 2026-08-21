export interface SearchConfig {
  jiraBaseUrl: string;
  jiraEmail: string;
  jiraToken: string;
  mattermostUrl?: string;
  mattermostToken?: string;
}

export type SearchSource = 'jira' | 'confluence' | 'jsm' | 'drive' | 'mattermost';

export type GoogleFileType = 'docs' | 'sheets' | 'slides' | 'files';

export type GoogleSearchArea = 'user' | 'sharedDrives' | 'domain';

export type MattermostConversationType = 'channel' | 'direct' | 'group';

export interface SearchComment {
  id: string;
  author: string;
  avatarUrl?: string;
  body: string;
  created: string;
  updated?: string;
}

export interface MattermostThreadMessage {
  id: string;
  author: string;
  message: string;
  date: string;
}

export interface SearchResult {
  id: string;
  source: SearchSource;
  title: string;
  snippet: string;
  content?: string;
  url: string;
  author: string;
  date: string;
  matchType?: 'title' | 'content';
  relevanceScore?: number;
  resultKind?: 'content' | 'attachment';
  // Jira specific
  key?: string;
  status?: string;
  issueType?: string;
  project?: string;
  reporter?: string;
  priority?: string;
  labels?: string[];
  comments?: SearchComment[];
  commentsTotal?: number;
  // Confluence specific
  space?: string;
  pageType?: string;
  // Drive specific
  fileType?: string;
  mimeType?: string;
  fileSize?: number;
  extension?: string;
  // Mattermost specific
  teamId?: string;
  team?: string;
  channelId?: string;
  channelName?: string;
  conversationType?: MattermostConversationType;
  threadId?: string;
  threadMessages?: MattermostThreadMessage[];
  threadMatchCount?: number;
}

export interface SearchCounts {
  jira: number;
  confluence: number;
  jsm: number;
  drive: number;
  mattermost: number;
}

export interface SearchResponse {
  results: SearchResult[];
  counts: SearchCounts;
  errors: Record<string, string>;
}

export type DateRange = 'all' | '1w' | '1m' | '3m';

export interface SearchFilters {
  sources: SearchSource[];
  googleFileTypes: GoogleFileType[];
  googleSearchAreas: GoogleSearchArea[];
  dateRange: DateRange;
}
