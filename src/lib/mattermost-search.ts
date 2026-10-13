export interface MattermostSearchPlan {
  terms: string[];
  fallbackTerms: string[];
  matchesVersion: (text: string) => boolean;
}

// Keep phrases and Mattermost operators intact; only expand standalone versions.
export function getMattermostSearchPlan(query: string): MattermostSearchPlan {
  const tokens = query.match(/(?:[^\s"]*"[^"]*"|[^\s"]+)/g) ?? [];
  const versions = tokens.map((token) => {
    const unquoted = token.startsWith('"') && token.endsWith('"') ? token.slice(1, -1) : token;
    return /^v?(\d+\.\d+\.\d+(?:[-+][a-z0-9][a-z0-9.+-]*)?)(\*)?$/i.exec(unquoted);
  });
  const expand = (kind: 'plain' | 'prefixed' | 'major' | 'prefixed-major') => tokens.map((token, index) => {
    const version = versions[index];
    if (!version) return /^[가-힣]{1,2}$/.test(token) ? `${token}*` : token;
    const value = kind.includes('major') ? version[1].split('.')[0] : version[1];
    return `${kind.startsWith('prefixed') ? 'v' : ''}${value}*`;
  }).join(' ');
  const original = tokens.map((token) => /^[가-힣]{1,2}$/.test(token) ? `${token}*` : token).join(' ');
  const hasVersion = versions.some(Boolean);
  const patterns = versions.flatMap((version) => {
    if (!version) return [];
    const escaped = version[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // v-prefixes, filenames and prerelease suffixes are accepted, adjacent digits
    // and extra numeric components (3.1.01 / 3.1.0.1) are not exact matches.
    return [new RegExp(`(?:^|[^\\p{L}\\p{N}.])v?${escaped}${version[2] ? '' : '(?![\\p{L}\\p{N}]|\\.\\d)'}`, 'iu')];
  });
  return {
    terms: [...new Set(hasVersion ? [original, expand('plain'), expand('prefixed')] : [original])],
    fallbackTerms: hasVersion ? [...new Set([expand('major'), expand('prefixed-major')])] : [],
    matchesVersion: (text) => patterns.every((pattern) => pattern.test(text)),
  };
}
