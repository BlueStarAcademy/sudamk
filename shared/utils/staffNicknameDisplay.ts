/**
 * 닉네임에 "관리자" / "운영자" 문구가 포함되는지(일반 유저 가입·변경 차단용).
 * 관리자 패널에서 생성·수정한 계정은 서버에서 staffNicknameDisplayEligibility로 별도 표시합니다.
 */
export const STAFF_NICKNAME_RESERVED_SUBSTRINGS = ['관리자', '운영자'] as const;

export const RESERVED_STAFF_NICKNAME_USER_MESSAGE =
    '닉네임에 "관리자", "운영자" 문구는 사용할 수 없습니다. (운영에서 부여한 계정은 예외)';

export function nicknameContainsReservedStaffTerms(nickname: string): boolean {
    const n = nickname.trim();
    if (!n) return false;
    return STAFF_NICKNAME_RESERVED_SUBSTRINGS.some((s) => n.includes(s));
}

export type StaffNicknameStyleUser = {
    nickname: string;
    isAdmin?: boolean;
    staffNicknameDisplayEligibility?: boolean;
};

/** 관리자 계정이거나, 운영 허용 + 예약 문구가 포함된 닉네임일 때 강조 스타일 */
export function shouldUseStaffNicknameDisplayStyle(user: StaffNicknameStyleUser): boolean {
    if (user.isAdmin) return true;
    if (!user.staffNicknameDisplayEligibility) return false;
    return nicknameContainsReservedStaffTerms(user.nickname);
}

/** Tailwind: 그라데이션 닉네임 (text-* 와 함께 쓰일 때 text-transparent가 우선) */
export const STAFF_NICKNAME_DISPLAY_TAILWIND =
    'bg-gradient-to-r from-sky-300 via-fuchsia-300 to-amber-200 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(251,191,36,0.35)]';

export function mergeStaffNicknameDisplayClass(user: StaffNicknameStyleUser, baseClassName: string): string {
    if (!shouldUseStaffNicknameDisplayStyle(user)) return baseClassName;
    return `${baseClassName} ${STAFF_NICKNAME_DISPLAY_TAILWIND}`.trim();
}
