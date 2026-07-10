export interface SearchConfig {
  jiraBaseUrl: string;
  jiraEmail: string;
  jiraToken: string;
  mattermostUrl?: string;
  mattermostToken?: string;
}

export type SearchSource = 'jira' | 'confluence' | 'drive' | 'mattermost';

export interface SearchResult {
  id: string;
  source: SearchSource;
  title: string;
  snippet: string;
  url: string;
  author: string;
  date: string;
  // Jira specific
  key?: string;
  status?: string;
  issueType?: string;
  project?: string;
  // Confluence specific
  space?: string;
  pageType?: string;
  // Drive specific
  fileType?: string;
  mimeType?: string;
  // Mattermost specific
  team?: string;
  channelName?: string;
}

export interface SearchCounts {
  jira: number;
  confluence: number;
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
  dateRange: DateRange;
}
