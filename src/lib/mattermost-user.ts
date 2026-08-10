export interface MattermostUserName {
  username?: string;
  first_name?: string;
  last_name?: string;
  nickname?: string;
}

const HANGUL_NAME_PART = /^[가-힣]+$/;

export function formatMattermostUserName(user?: MattermostUserName): string {
  const firstName = user?.first_name?.trim() ?? '';
  const lastName = user?.last_name?.trim() ?? '';

  if (firstName && lastName) {
    const isKoreanName = HANGUL_NAME_PART.test(firstName) && HANGUL_NAME_PART.test(lastName);
    return isKoreanName ? `${lastName} ${firstName}` : `${firstName} ${lastName}`;
  }

  return firstName || lastName || user?.nickname?.trim() || user?.username?.trim() || '';
}
