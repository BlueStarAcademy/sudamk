import { ADMIN_LOGIN_USERNAME, ADMIN_USER_ID } from '../constants/auth.js';

/** `isAdmin` 플래그와 레거시 관리자 id·username(주석: `clientAdmin.ts`와 동일 규칙) */
export type AdminRecognitionPick = {
    id?: string;
    username?: string | null;
    isAdmin?: boolean;
};

export function isRecognizedAdminUser(user: AdminRecognitionPick | null | undefined): boolean {
    if (!user) return false;
    if (user.isAdmin === true) return true;
    if (user.id === ADMIN_USER_ID) return true;
    if (user.username === ADMIN_LOGIN_USERNAME) return true;
    return false;
}
