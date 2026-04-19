import type { User } from '../types.js';
import { isRecognizedAdminUser } from '../shared/utils/adminRecognition.js';

type ClientAdminPick = Pick<User, 'id' | 'isAdmin' | 'username'>;

/** 클라이언트에서 관리자 여부 (isAdmin 누락·레거시 id 불일치 시 보조 판별) */
export function isClientAdmin(user: ClientAdminPick | null | undefined): boolean {
    return isRecognizedAdminUser(user);
}
