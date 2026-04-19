import React, { useMemo, useState } from 'react';
import type { ServerAction, User, UserWithStatus } from '../../types/index.js';
import AdminPageHeader from './AdminPageHeader.js';
import { adminCard, adminCardTitle, adminCheckRow, adminInput, adminPageNarrow, adminShell } from './adminChrome.js';
import Button from '../Button.js';

interface AdminVipGrantPanelProps {
    currentUser: UserWithStatus;
    allUsers: User[];
    onAction: (action: ServerAction) => Promise<void | { error?: string; clientResponse?: unknown } | undefined>;
    onBack: () => void;
}

const DURATION_PRESETS = [7, 30, 90, 365] as const;

const AdminVipGrantPanel: React.FC<AdminVipGrantPanelProps> = ({ currentUser, allUsers, onAction, onBack }) => {
    const [scope, setScope] = useState<'single' | 'all'>('single');
    const [targetUserId, setTargetUserId] = useState('');
    const [grantReward, setGrantReward] = useState(true);
    const [grantFunction, setGrantFunction] = useState(false);
    const [grantVvip, setGrantVvip] = useState(false);
    const [durationDays, setDurationDays] = useState(30);
    const [busy, setBusy] = useState(false);
    const [statusMsg, setStatusMsg] = useState<string | null>(null);

    const sortedUsers = useMemo(() => {
        const list = Array.isArray(allUsers) ? [...allUsers] : [];
        list.sort((a, b) => (a.nickname || '').localeCompare(b.nickname || '', 'ko'));
        return list;
    }, [allUsers]);

    const onPickUser = (id: string) => {
        setTargetUserId(id);
        setStatusMsg(null);
    };

    const submit = async () => {
        setStatusMsg(null);
        if (!grantReward && !grantFunction && !grantVvip) {
            setStatusMsg('VIP 종류를 하나 이상 선택해 주세요.');
            return;
        }
        const days = Math.floor(Number(durationDays));
        if (!Number.isFinite(days) || days < 1 || days > 3650) {
            setStatusMsg('기간은 1~3650일 사이의 정수로 입력해 주세요.');
            return;
        }
        if (scope === 'single') {
            const tid = targetUserId.trim();
            if (!tid) {
                setStatusMsg('대상 사용자를 선택하거나 사용자 ID를 입력해 주세요.');
                return;
            }
        } else {
            const ok = window.confirm(
                `등록된 전체 사용자(${sortedUsers.length}명)에게 선택한 VIP를 ${days}일 연장 부여합니다.\n` +
                    '서버에 사용자가 많으면 완료까지 시간이 걸릴 수 있습니다. 계속할까요?',
            );
            if (!ok) return;
        }

        setBusy(true);
        try {
            const res = await onAction({
                type: 'ADMIN_GRANT_VIP_DURATION',
                payload: {
                    scope,
                    targetUserId: scope === 'single' ? targetUserId.trim() : undefined,
                    grantRewardVip: grantReward,
                    grantFunctionVip: grantFunction,
                    grantVvip: grantVvip,
                    durationDays: days,
                },
            });
            if (res && typeof res === 'object' && 'error' in res && res.error) {
                setStatusMsg(String(res.error));
                return;
            }
            const flat = res as Record<string, unknown> | undefined;
            const ok = typeof flat?.affectedCount === 'number' ? flat.affectedCount : undefined;
            const fail = typeof flat?.failureCount === 'number' ? flat.failureCount : undefined;
            const total = typeof flat?.totalUsers === 'number' ? flat.totalUsers : undefined;
            const nick = typeof flat?.targetNickname === 'string' ? flat.targetNickname : undefined;
            if (scope === 'all' && ok !== undefined) {
                setStatusMsg(
                    `완료: 성공 ${ok}명` +
                        (fail !== undefined && fail > 0 ? `, 실패 ${fail}명` : '') +
                        (total !== undefined ? ` (대상 ${total}명)` : ''),
                );
            } else if (scope === 'single' && nick) {
                setStatusMsg(`「${nick}」님에게 ${days}일분 VIP를 부여했습니다.`);
            } else {
                setStatusMsg('처리했습니다.');
            }
        } catch (e) {
            console.error('[AdminVipGrantPanel]', e);
            setStatusMsg('요청 중 오류가 발생했습니다.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className={`${adminShell} ${adminPageNarrow}`}>
            <AdminPageHeader
                title="VIP 기간 부여"
                subtitle="보상 VIP·기능 VIP·VVIP 중 선택한 항목만, 현재 만료일(또는 오늘) 이후로 기간을 연장합니다."
                onBack={onBack}
            />

            <div className="mt-6 space-y-6">
                <div className={adminCard}>
                    <h2 className={adminCardTitle}>부여 범위</h2>
                    <div className="flex flex-wrap gap-3">
                        <label className={adminCheckRow}>
                            <input
                                type="radio"
                                name="vip-grant-scope"
                                checked={scope === 'single'}
                                onChange={() => setScope('single')}
                                disabled={busy}
                            />
                            특정 사용자
                        </label>
                        <label className={adminCheckRow}>
                            <input
                                type="radio"
                                name="vip-grant-scope"
                                checked={scope === 'all'}
                                onChange={() => setScope('all')}
                                disabled={busy}
                            />
                            전체 사용자 ({sortedUsers.length}명)
                        </label>
                    </div>
                </div>

                {scope === 'single' ? (
                    <div className={adminCard}>
                        <h2 className={adminCardTitle}>대상 선택</h2>
                        <p className="mb-2 text-sm text-gray-400">목록에서 고르거나 아래에 사용자 ID를 직접 입력할 수 있습니다.</p>
                        <select
                            className={adminInput}
                            value={sortedUsers.some((u) => u.id === targetUserId) ? targetUserId : ''}
                            onChange={(e) => onPickUser(e.target.value)}
                            disabled={busy}
                        >
                            <option value="">— 사용자 선택 —</option>
                            {sortedUsers.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.nickname} ({u.username || u.id.slice(0, 8)}…)
                                </option>
                            ))}
                        </select>
                        <p className="my-2 text-center text-xs text-gray-500">또는</p>
                        <input
                            className={adminInput}
                            placeholder="사용자 ID (UUID)"
                            value={targetUserId}
                            onChange={(e) => setTargetUserId(e.target.value)}
                            disabled={busy}
                            autoComplete="off"
                        />
                    </div>
                ) : null}

                <div className={adminCard}>
                    <h2 className={adminCardTitle}>VIP 종류 (복수 선택 가능)</h2>
                    <div className="space-y-2">
                        <label className={adminCheckRow}>
                            <input
                                type="checkbox"
                                checked={grantReward}
                                onChange={(e) => setGrantReward(e.target.checked)}
                                disabled={busy}
                            />
                            보상 VIP (승리 시 VIP 슬롯 등)
                        </label>
                        <label className={adminCheckRow}>
                            <input
                                type="checkbox"
                                checked={grantFunction}
                                onChange={(e) => setGrantFunction(e.target.checked)}
                                disabled={busy}
                            />
                            기능 VIP (강화·분해 보너스 등)
                        </label>
                        <label className={adminCheckRow}>
                            <input
                                type="checkbox"
                                checked={grantVvip}
                                onChange={(e) => setGrantVvip(e.target.checked)}
                                disabled={busy}
                            />
                            VVIP (보상+기능 통합 등급)
                        </label>
                    </div>
                </div>

                <div className={adminCard}>
                    <h2 className={adminCardTitle}>연장 기간 (일)</h2>
                    <div className="mb-3 flex flex-wrap gap-2">
                        {DURATION_PRESETS.map((d) => (
                            <button
                                key={d}
                                type="button"
                                disabled={busy}
                                onClick={() => setDurationDays(d)}
                                className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
                                    durationDays === d
                                        ? 'border-amber-400/60 bg-amber-900/40 text-amber-100'
                                        : 'border-color/50 bg-secondary/40 text-gray-300 hover:border-amber-400/35'
                                }`}
                            >
                                {d}일
                            </button>
                        ))}
                    </div>
                    <input
                        type="number"
                        min={1}
                        max={3650}
                        className={adminInput}
                        value={durationDays}
                        onChange={(e) => setDurationDays(Number(e.target.value))}
                        disabled={busy}
                    />
                    <p className="mt-2 text-xs text-gray-500">
                        각 선택 항목마다 «max(현재 시각, 기존 만료 시각) + 입력 일수»로 만료 시각이 설정됩니다. 이미 유효한 구독이 있으면
                        그 끝에서 이어집니다.
                    </p>
                </div>

                {statusMsg ? (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-950/35 px-4 py-3 text-sm text-amber-50/95">{statusMsg}</div>
                ) : null}

                <div className="flex flex-wrap items-center gap-3">
                    <Button type="button" colorScheme="orange" disabled={busy} onClick={() => void submit()}>
                        {busy ? '처리 중…' : 'VIP 부여 실행'}
                    </Button>
                    <span className="text-xs text-gray-500">실행 관리자: {currentUser.nickname}</span>
                </div>
            </div>
        </div>
    );
};

export default AdminVipGrantPanel;
