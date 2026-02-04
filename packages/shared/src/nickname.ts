export type NicknameValidationResult =
  | { ok: true }
  | { ok: false; reason: 'format' | 'reserved' | 'profanity' };

/**
 * Nickname rules (v2)
 * - Korean Hangul syllables only
 * - Length: 1~6
 * - Disallow profanity and impersonation (admin/operator)
 * - Normalization to mitigate bypasses (spaces / repeated characters)
 */
export function validateNickname(raw: string): NicknameValidationResult {
  const nickname = raw.trim();

  // 한글 음절(가-힣) 1~6자
  if (!/^[가-힣]{1,6}$/.test(nickname)) {
    return { ok: false, reason: 'format' };
  }

  const normalized = normalizeForFilter(nickname);
  const normalizedCollapsed = collapseRepeats(normalized);

  // 운영자/관리자 사칭 방지
  const reservedSubstrings = [
    // 운영/관리 계열 (부분 문자열도 차단)
    '운영',
    '관리',
    '운영자',
    '운영진',
    '운영팀',
    '관리자',
    '관리팀',
    '총관리',
    '부관리',
    // 스태프/관리 역할
    '개발자',
    '스태프',
    '스탭',
    '스텝',
    '매니저',
    '마스터',
    // 외래/표기 변형
    '어드민',
    '에드민',
    '지엠', // GM
  ];

  const reservedRegexes: RegExp[] = [
    // "운영자" 변형 대응: 운영쟈/운영짜 등
    /운영[자쟈짜]/,
    /관리[자쟈짜]/,
  ];

  if (
    reservedSubstrings.some(
      (w) => normalized.includes(w) || normalizedCollapsed.includes(w)
    ) ||
    reservedRegexes.some((re) => re.test(normalizedCollapsed))
  ) {
    return { ok: false, reason: 'reserved' };
  }

  // 비속어 필터 (확장 버전)
  const profanitySubstrings = [
    '시발',
    '씨발',
    '시바',
    '씨바',
    '병신',
    '븅신',
    '지랄',
    '염병',
    '엿먹',
    '개새끼',
    '개새',
    '새끼',
    '애미',
    '느금',
    '니애미',
    '니엄',
    '좆',
    '좃',
    '존나',
    '썅',
    '쌍',
    '꺼져',
    '죽어',
  ];

  if (
    profanitySubstrings.some(
      (w) => normalized.includes(w) || normalizedCollapsed.includes(w)
    )
  ) {
    return { ok: false, reason: 'profanity' };
  }

  return { ok: true };
}

function normalizeForFilter(input: string) {
  // 공백 제거 + 소문자(한글엔 영향 거의 없음)
  return input.replace(/\s+/g, '').toLowerCase();
}

function collapseRepeats(input: string) {
  // 같은 글자 반복으로 우회하는 케이스를 완화: "시이발" -> "시발"
  let out = '';
  let prev = '';
  for (const ch of input) {
    if (ch === prev) continue;
    out += ch;
    prev = ch;
  }
  return out;
}

