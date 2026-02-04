export type NicknameValidationResult =
  | { ok: true }
  | { ok: false; reason: 'format' | 'reserved' | 'profanity' };

/**
 * Nickname rules (v1)
 * - Korean Hangul syllables only
 * - Length: 1~6
 * - Disallow profanity and impersonation (admin/operator)
 */
export function validateNickname(raw: string): NicknameValidationResult {
  const nickname = raw.trim();

  // 한글 음절(가-힣) 1~6자
  if (!/^[가-힣]{1,6}$/.test(nickname)) {
    return { ok: false, reason: 'format' };
  }

  const normalized = normalizeForFilter(nickname);

  // 운영자/관리자 사칭 방지 (한글만 허용되므로 한글 키워드 중심)
  const reservedSubstrings = [
    '운영자',
    '운영진',
    '관리자',
    '관리팀',
    '개발자',
    '스태프',
    '스탭',
    '매니저',
    '운영팀',
  ];
  if (reservedSubstrings.some((w) => normalized.includes(w))) {
    return { ok: false, reason: 'reserved' };
  }

  // 간단 비속어 필터 (필요 시 확장)
  const profanitySubstrings = [
    '시발',
    '씨발',
    '병신',
    '지랄',
    '염병',
    '개새끼',
    '새끼',
    '좆',
    '존나',
    '썅',
    '꺼져',
  ];
  if (profanitySubstrings.some((w) => normalized.includes(w))) {
    return { ok: false, reason: 'profanity' };
  }

  return { ok: true };
}

function normalizeForFilter(input: string) {
  // 공백 제거 + 소문자(한글엔 영향 거의 없음)
  return input.replace(/\s+/g, '').toLowerCase();
}

