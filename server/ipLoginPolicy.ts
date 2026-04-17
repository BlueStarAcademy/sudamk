import type { Request, Response } from 'express';
import type { IpLoginSlot, VolatileState } from '../types/index.js';
import { OTHER_DEVICE_LOGIN_SHARED_PC_REASON } from '../shared/constants/auth.js';
import { randomUUID } from 'crypto';

function normalizeClientIp(raw: string): string {
    const t = raw.trim();
    if (t.startsWith('::ffff:')) return t.slice(7);
    return t;
}

function isLocalOrPrivateIp(ip: string): boolean {
    const v = ip.trim();
    if (!v) return true;
    if (v === '::1' || v === '127.0.0.1' || v === 'localhost') return true;
    if (v.startsWith('10.')) return true;
    if (v.startsWith('192.168.')) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(v)) return true;
    if (v.startsWith('fc') || v.startsWith('fd')) return true; // IPv6 ULA
    if (v.startsWith('fe80:')) return true; // IPv6 link-local
    return false;
}

export function getRequestClientIp(req: Pick<Request, 'headers' | 'socket' | 'ip'>): string {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.trim()) {
        const ip = normalizeClientIp(xff.split(',')[0]);
        if (!isLocalOrPrivateIp(ip)) return ip;
        return '';
    }
    if (Array.isArray(xff) && xff[0]) {
        const ip = normalizeClientIp(String(xff[0]).split(',')[0]);
        if (!isLocalOrPrivateIp(ip)) return ip;
        return '';
    }
    // 프록시/인프라 IP(req.ip, remoteAddress)를 클라이언트 IP로 오인하면
    // 서로 다른 유저를 같은 IP로 묶어 강제 로그아웃시키는 오탐이 생길 수 있다.
    // 신뢰 가능한 XFF가 없는 요청은 동일-IP 선점 정책에서 제외한다.
    return '';
}

const DEVICE_COOKIE_NAME = 'sudamr_device_id';
const DEVICE_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365 * 5; // 5 years

function parseCookie(headerValue: string | undefined, key: string): string {
    if (!headerValue) return '';
    const parts = headerValue.split(';');
    for (const p of parts) {
        const [k, ...rest] = p.trim().split('=');
        if (k === key) return decodeURIComponent(rest.join('=').trim());
    }
    return '';
}

function getOrSetDeviceId(
    req: Pick<Request, 'headers'>,
    res?: Pick<Response, 'append' | 'setHeader'>,
): string {
    const fromCookie = parseCookie(typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined, DEVICE_COOKIE_NAME);
    if (fromCookie) return fromCookie;

    if (!res) return '';
    const newId = randomUUID();
    const cookie = `${DEVICE_COOKIE_NAME}=${encodeURIComponent(newId)}; Path=/; Max-Age=${DEVICE_COOKIE_MAX_AGE_SEC}; HttpOnly; SameSite=Lax`;
    if (typeof res.append === 'function') {
        res.append('Set-Cookie', cookie);
    } else {
        const prev = (res as any).getHeader?.('Set-Cookie');
        if (Array.isArray(prev)) {
            res.setHeader('Set-Cookie', [...prev, cookie]);
        } else if (typeof prev === 'string' && prev.length > 0) {
            res.setHeader('Set-Cookie', [prev, cookie]);
        } else {
            res.setHeader('Set-Cookie', cookie);
        }
    }
    return newId;
}

function getClientBindingKey(
    req: Pick<Request, 'headers' | 'socket' | 'ip'>,
    res?: Pick<Response, 'append' | 'setHeader'>,
): string {
    const ip = getRequestClientIp(req);
    if (!ip) return '';
    const deviceId = getOrSetDeviceId(req, res);
    if (!deviceId) return '';
    return `${ip}::${deviceId}`;
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
    bindingKey: string,
    incomingUserId: string,
): Promise<void> {
    const slot = volatileState.ipLoginSlots?.[bindingKey];
    const displaced = slot?.regularUserId;
    if (!displaced || displaced === incomingUserId) return;

    const { getCachedUser } = await import('./gameCache.js');
    const displacedUser = await getCachedUser(displaced);
    if (!displacedUser) {
        const s = volatileState.ipLoginSlots?.[bindingKey];
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
    res: Pick<Response, 'append' | 'setHeader'> | undefined,
    userId: string,
    isAdmin: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
    const bindingKey = getClientBindingKey(req, res);
    if (!bindingKey) {
        return { ok: true };
    }

    if (!volatileState.ipLoginSlots) volatileState.ipLoginSlots = {};
    if (!volatileState.connectionIpByUserId) volatileState.connectionIpByUserId = {};

    const ipByUser = volatileState.connectionIpByUserId;
    const oldIp = ipByUser[userId];
    const existingSlot = volatileState.ipLoginSlots[bindingKey];

    if (oldIp === bindingKey && slotHasBinding(existingSlot, userId, isAdmin)) {
        return { ok: true };
    }

    releaseIpBindingForUser(volatileState, userId);

    if (!isAdmin) {
        await preemptSharedPcRegularUser(volatileState, bindingKey, userId);
    }

    const slot: IpLoginSlot = volatileState.ipLoginSlots[bindingKey] ?? { adminIds: {} };
    if (!slot.adminIds) slot.adminIds = {};

    if (isAdmin) {
        slot.adminIds[userId] = true;
        volatileState.ipLoginSlots[bindingKey] = slot;
        ipByUser[userId] = bindingKey;
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
    volatileState.ipLoginSlots[bindingKey] = slot;
    ipByUser[userId] = bindingKey;
    return { ok: true };
}
