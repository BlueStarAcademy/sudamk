import type { Request } from 'express';
import type { IpLoginSlot, VolatileState } from '../types/index.js';
import { OTHER_DEVICE_LOGIN_SHARED_PC_REASON } from '../shared/constants/auth.js';

function normalizeClientIp(raw: string): string {
    const t = raw.trim();
    if (t.startsWith('::ffff:')) return t.slice(7);
    return t;
}

export function getRequestClientIp(req: Pick<Request, 'headers' | 'socket' | 'ip'>): string {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.trim()) {
        return normalizeClientIp(xff.split(',')[0]);
    }
    if (Array.isArray(xff) && xff[0]) {
        return normalizeClientIp(String(xff[0]).split(',')[0]);
    }
    if (req.ip) return normalizeClientIp(req.ip);
    const rip = req.socket?.remoteAddress;
    if (rip) return normalizeClientIp(rip);
    return '';
}

function slotHasBinding(slot: IpLoginSlot | undefined, userId: string, isAdmin: boolean): boolean {
    if (!slot) return false;
    if (isAdmin) return !!slot.adminIds?.[userId];
    return slot.regularUserId === userId;
}

export function releaseIpBindingForUser(volatileState: VolatileState, userId: string): void {
    const ipMap = volatileState.connectionIpByUserId;
    if (!ipMap) return;
    const ip = ipMap[userId];
    if (!ip) return;

    const slots = volatileState.ipLoginSlots;
    const slot = slots?.[ip];
    if (slot) {
        if (slot.regularUserId === userId) {
            delete slot.regularUserId;
        }
        if (slot.adminIds?.[userId]) {
            delete slot.adminIds[userId];
        }
        const noRegular = !slot.regularUserId;
        const noAdmins = !slot.adminIds || Object.keys(slot.adminIds).length === 0;
        if (noRegular && noAdmins && slots) {
            delete slots[ip];
        }
    }
    delete ipMap[userId];
}

/**
 * 동일 IP에서 다른 일반 계정이 로그인하면 기존 일반 세션을 끊는다. 관리자는 regular 슬롯에 없으므로 여기서 제거되지 않는다.
 */
async function preemptSharedPcRegularUser(
    volatileState: VolatileState,
    clientIp: string,
    incomingUserId: string,
): Promise<void> {
    const slot = volatileState.ipLoginSlots?.[clientIp];
    const displaced = slot?.regularUserId;
    if (!displaced || displaced === incomingUserId) return;

    const { getCachedUser } = await import('./gameCache.js');
    const displacedUser = await getCachedUser(displaced);
    if (!displacedUser) {
        const s = volatileState.ipLoginSlots?.[clientIp];
        if (s?.regularUserId === displaced) {
            delete s.regularUserId;
        }
        return;
    }
    if (displacedUser.isAdmin) {
        return;
    }

    try {
        const { applyPvpInGameDisconnect } = await import('./actions/socialActions.js');
        await applyPvpInGameDisconnect(volatileState, displaced);
    } catch {
        // ignore
    }

    const { sendToUser, broadcast } = await import('./socket.js');
    try {
        sendToUser(displaced, {
            type: 'OTHER_DEVICE_LOGIN',
            payload: {
                reason: OTHER_DEVICE_LOGIN_SHARED_PC_REASON,
                message: '동일 PC(동일 네트워크)에서 다른 계정으로 로그인되어 로그아웃되었습니다.',
            },
        });
    } catch {
        // ignore
    }

    delete volatileState.userConnections[displaced];
    delete volatileState.userStatuses[displaced];
    releaseIpBindingForUser(volatileState, displaced);

    try {
        broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });
    } catch {
        // ignore
    }
}

/**
 * 동일 IP에서 일반 계정은 1명만 세션 점유. 다른 일반 계정이 들어오면 기존 일반 세션은 강제 로그아웃된다.
 * 관리자는 별도 슬롯이라 일반 계정과 동시 접속 가능하며, 일반 계정이 관리자를 끊지 않는다.
 * 비밀번호 로그인 직후(/api/state 전) IP만 예약한 상태에서도 동일 IP로 재호출되면 성공 처리한다.
 */
export async function ensureClientIpAllowsSession(
    volatileState: VolatileState,
    req: Pick<Request, 'headers' | 'socket' | 'ip'>,
    userId: string,
    isAdmin: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
    const clientIp = getRequestClientIp(req);
    if (!clientIp) {
        return { ok: true };
    }

    if (!volatileState.ipLoginSlots) volatileState.ipLoginSlots = {};
    if (!volatileState.connectionIpByUserId) volatileState.connectionIpByUserId = {};

    const ipByUser = volatileState.connectionIpByUserId;
    const oldIp = ipByUser[userId];
    const existingSlot = volatileState.ipLoginSlots[clientIp];

    if (oldIp === clientIp && slotHasBinding(existingSlot, userId, isAdmin)) {
        return { ok: true };
    }

    releaseIpBindingForUser(volatileState, userId);

    if (!isAdmin) {
        await preemptSharedPcRegularUser(volatileState, clientIp, userId);
    }

    const slot: IpLoginSlot = volatileState.ipLoginSlots[clientIp] ?? { adminIds: {} };
    if (!slot.adminIds) slot.adminIds = {};

    if (isAdmin) {
        slot.adminIds[userId] = true;
        volatileState.ipLoginSlots[clientIp] = slot;
        ipByUser[userId] = clientIp;
        return { ok: true };
    }

    if (slot.regularUserId && slot.regularUserId !== userId) {
        return {
            ok: false,
            message:
                '이미 이 네트워크(동일 IP)에서 다른 일반 계정으로 접속 중입니다. 해당 계정을 로그아웃한 뒤 다시 시도해주세요.',
        };
    }

    slot.regularUserId = userId;
    volatileState.ipLoginSlots[clientIp] = slot;
    ipByUser[userId] = clientIp;
    return { ok: true };
}
