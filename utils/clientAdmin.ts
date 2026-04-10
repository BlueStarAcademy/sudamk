import { ADMIN_LOGIN_USERNAME, ADMIN_USER_ID } from '../shared/constants/auth.js';
import type { User } from '../types.js';

type ClientAdminPick = Pick<User, 'id' | 'isAdmin' | 'username'>;

/** 클라이언트에서 관리자 여부 (isAdmin 누락·레거시 id 불일치 시 보조 판별) */
export function isClientAdmin(user: ClientAdminPick | null | undefined): boolean {
    if (!user) return false;
    if (user.isAdmin === true) return true;
    if (user.id === ADMIN_USER_ID) return true;
    if (user.username === ADMIN_LOGIN_USERNAME) return true;
    return false;
}
