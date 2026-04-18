import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { UserWithStatus } from '../types.js';
import type { MannerGradeChangePayload } from '../types/mannerGradeChangeModal.js';
import { AVATAR_POOL, BORDER_POOL } from '../constants.js';
import { getMannerRank } from '../services/manner.js';
import Avatar from './Avatar.js';
import Button from './Button.js';

type MannerGradeChangeModalProps = {
    user: UserWithStatus;
    payload: MannerGradeChangePayload;
    onClose: () => void;
    isTopmost?: boolean;
};

const MannerGradeChangeModal: React.FC<MannerGradeChangeModalProps> = ({ user, payload, onClose, isTopmost = true }) => {
    const avatarUrl = useMemo(() => AVATAR_POOL.find((a) => a.id === user.avatarId)?.url, [user.avatarId]);
    const borderUrl = useMemo(() => BORDER_POOL.find((b) => b.id === user.borderId)?.url, [user.borderId]);
    const displayName = user.nickname || user.username || user.id;

    const prevStyle = getMannerRank(payload.previousScore);
    const nextStyle = getMannerRank(payload.newScore);
    const delta = payload.newScore - payload.previousScore;
    const isUp = payload.direction === 'up';

    const overlayZ = isTopmost ? 'z-[12060]' : 'z-[12045]';

    const chrome = isUp
        ? {
              frame: 'from-teal-400/55 via-emerald-400/30 to-cyan-400/50',
              inner: 'from-[#0f1820] via-[#0a1018] to-[#05080c]',
              headline: 'from-teal-100 via-white to-emerald-200',
              badge: 'border-emerald-400/35 bg-emerald-950/50 text-emerald-100',
              caption: '매너 등급이 상승했습니다',
          }
        : {
              frame: 'from-rose-500/45 via-amber-500/25 to-stone-500/40',
              inner: 'from-[#1a1214] via-[#100c0e] to-[#080506]',
              headline: 'from-rose-100 via-amber-50 to-stone-200',
              badge: 'border-rose-500/35 bg-rose-950/45 text-rose-100',
              caption: '매너 등급이 하락했습니다',
          };

    const node = (
        <div
            className={`fixed inset-0 ${overlayZ} flex items-center justify-center overscroll-contain px-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="manner-grade-change-title"
        >
            <button type="button" className="absolute inset-0 bg-[#030508]/88 backdrop-blur-md" aria-label="배경 닫기" onClick={onClose} />
            <div
                className="relative w-full max-w-md animate-[mannerGradePop_0.42s_cubic-bezier(0.22,1,0.36,1)_both]"
                onClick={(e) => e.stopPropagation()}
            >
                <style>{`
                  @keyframes mannerGradePop {
                    from { opacity: 0; transform: translateY(12px) scale(0.96); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                  }
                `}</style>
                <div
                    className={`pointer-events-none absolute -inset-px rounded-[1.35rem] bg-gradient-to-br opacity-90 blur-[1px] ${chrome.frame}`}
                    aria-hidden
                />
                <div className="relative overflow-hidden rounded-3xl border border-white/[0.12] bg-gradient-to-b p-[1px] shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_32px_64px_-24px_rgba(0,0,0,0.9)]">
                    <div className={`relative overflow-hidden rounded-[1.2rem] bg-gradient-to-b ${chrome.inner}`}>
                        <div
                            className="pointer-events-none absolute inset-0 opacity-[0.15]"
                            style={{
                                background: isUp
                                    ? 'radial-gradient(ellipse 85% 50% at 50% -5%, rgba(45, 212, 191, 0.4), transparent 55%), radial-gradient(ellipse 60% 45% at 90% 100%, rgba(34, 211, 238, 0.15), transparent 55%)'
                                    : 'radial-gradient(ellipse 85% 50% at 50% -5%, rgba(251, 113, 133, 0.38), transparent 55%), radial-gradient(ellipse 55% 40% at 10% 100%, rgba(251, 191, 36, 0.12), transparent 50%)',
                            }}
                            aria-hidden
                        />
                        <div className="relative px-5 pb-5 pt-6 sm:px-7 sm:pb-6 sm:pt-7">
                            <div className="mb-1 text-center">
                                <span
                                    className={`inline-flex rounded-full border px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.22em] ${chrome.badge}`}
                                >
                                    Manner
                                </span>
                            </div>
                            <h2
                                id="manner-grade-change-title"
                                className={`mt-3 bg-gradient-to-r bg-clip-text text-center text-2xl font-black tracking-tight text-transparent sm:text-3xl ${chrome.headline}`}
                            >
                                {isUp ? '매너 등급 상승' : '매너 등급 하락'}
                            </h2>
                            <p className="mt-2 text-center text-sm leading-relaxed text-slate-300/95">{chrome.caption}</p>

                            <div className="my-6 flex flex-col items-center gap-3">
                                <div className="relative">
                                    <div
                                        className={`absolute -inset-3 rounded-full blur-xl ${isUp ? 'bg-teal-400/20' : 'bg-rose-500/25'}`}
                                        aria-hidden
                                    />
                                    <Avatar
                                        userId={user.id}
                                        userName={displayName}
                                        avatarUrl={avatarUrl}
                                        borderUrl={borderUrl}
                                        size={88}
                                        className="drop-shadow-[0_12px_28px_rgba(0,0,0,0.65)]"
                                    />
                                </div>
                                <p className="text-base font-bold text-white">{displayName}</p>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 ring-1 ring-inset ring-white/[0.06] sm:p-5">
                                <div className="flex flex-col items-center gap-3 text-center">
                                    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                                        <span className={`text-lg font-bold sm:text-xl ${prevStyle.color}`}>{payload.previousRank}</span>
                                        <span className="text-sm font-medium text-white/35">→</span>
                                        <span className={`text-lg font-bold sm:text-xl ${nextStyle.color}`}>{payload.newRank}</span>
                                    </div>
                                    <div className="w-full border-t border-white/10 pt-3">
                                        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">매너 점수</p>
                                        <p className="mt-1 tabular-nums text-base text-slate-200 sm:text-lg">
                                            <span className="text-slate-500">{payload.previousScore.toLocaleString()}점</span>
                                            <span className="mx-2 text-slate-600">→</span>
                                            <span className="font-bold text-white">{payload.newScore.toLocaleString()}점</span>
                                            <span className={`ml-2 text-sm font-bold ${delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                ({delta >= 0 ? '+' : ''}
                                                {delta.toLocaleString()})
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <p className="mt-4 text-center text-xs leading-relaxed text-slate-500">
                                {isUp
                                    ? '바른 매너를 유지하면 혜택이 늘어납니다. 계속 좋은 대국 부탁드립니다.'
                                    : '매너 점수가 낮아지면 보상·능력치에 불리할 수 있습니다. 건전한 플레이를 권장합니다.'}
                            </p>

                            <div className="mt-6 flex justify-center">
                                <Button
                                    onClick={onClose}
                                    colorScheme={isUp ? 'blue' : 'gray'}
                                    className="min-h-[2.75rem] w-full max-w-xs font-bold"
                                >
                                    확인
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    if (typeof document === 'undefined') return node;
    return createPortal(node, document.body);
};

export default MannerGradeChangeModal;
