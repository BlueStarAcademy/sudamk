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
              frame: 'from-teal-300/50 via-emerald-400/28 to-cyan-300/45',
              inner: 'from-[#0c141c] via-[#080f16] to-[#04070a]',
              headline: 'from-teal-100 via-white to-emerald-200',
              badge: 'border-teal-400/40 bg-teal-950/55 text-teal-50 shadow-[0_0_24px_-4px_rgba(45,212,191,0.35)]',
              caption: '매너 등급이 상승했습니다',
              glowA: 'bg-teal-400/22',
              meshGradient:
                  'linear-gradient(165deg, rgba(45,212,191,0.1), transparent 42%, rgba(34,211,238,0.07)), radial-gradient(ellipse 100% 60% at 50% -15%, rgba(45, 212, 191, 0.22), transparent 55%)',
              scorePanel: 'border-teal-500/25 bg-teal-950/18 ring-teal-400/12',
          }
        : {
              frame: 'from-rose-400/48 via-amber-400/22 to-stone-500/38',
              inner: 'from-[#181014] via-[#0e0a0c] to-[#060405]',
              headline: 'from-rose-100 via-amber-50 to-stone-200',
              badge: 'border-rose-400/40 bg-rose-950/50 text-rose-50 shadow-[0_0_24px_-4px_rgba(251,113,133,0.3)]',
              caption: '매너 등급이 하락했습니다',
              glowA: 'bg-rose-500/24',
              meshGradient:
                  'linear-gradient(165deg, rgba(251,113,133,0.1), transparent 42%, rgba(251,191,36,0.06)), radial-gradient(ellipse 100% 60% at 50% -15%, rgba(251, 113, 133, 0.2), transparent 55%)',
              scorePanel: 'border-rose-500/25 bg-rose-950/18 ring-rose-400/12',
          };

    const node = (
        <div
            className={`fixed inset-0 ${overlayZ} flex items-center justify-center overscroll-contain px-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="manner-grade-change-title"
        >
            <button type="button" className="absolute inset-0 bg-[#020408]/90 backdrop-blur-md" aria-label="배경 닫기" onClick={onClose} />
            <div
                className="relative w-full max-w-md animate-[mannerGradePop_0.48s_cubic-bezier(0.22,1,0.36,1)_both]"
                onClick={(e) => e.stopPropagation()}
            >
                <style>{`
                  @keyframes mannerGradePop {
                    from { opacity: 0; transform: translateY(16px) scale(0.94); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                  }
                `}</style>
                <div
                    className={`pointer-events-none absolute -inset-[2px] rounded-[1.4rem] bg-gradient-to-br opacity-95 blur-[1.5px] ${chrome.frame}`}
                    aria-hidden
                />
                <div className="relative overflow-hidden rounded-[1.35rem] border border-white/[0.14] bg-gradient-to-b p-px shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_40px_80px_-32px_rgba(0,0,0,0.92),0_0_60px_-20px_rgba(255,255,255,0.04)]">
                    <div className={`relative overflow-hidden rounded-[1.28rem] bg-gradient-to-b ${chrome.inner}`}>
                        <div
                            className="pointer-events-none absolute inset-0 opacity-[0.38]"
                            style={{ backgroundImage: chrome.meshGradient }}
                            aria-hidden
                        />
                        <div
                            className="pointer-events-none absolute inset-0 opacity-[0.04]"
                            style={{
                                backgroundImage:
                                    'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
                                backgroundSize: '28px 28px',
                            }}
                            aria-hidden
                        />
                        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" aria-hidden />

                        <div className="relative px-5 pb-5 pt-6 sm:px-8 sm:pb-7 sm:pt-8">
                            <div className="mb-1 flex justify-center">
                                <span
                                    className={`inline-flex rounded-full border px-3.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.26em] ${chrome.badge}`}
                                >
                                    Manner
                                </span>
                            </div>
                            <h2
                                id="manner-grade-change-title"
                                className={`mt-3 bg-gradient-to-r bg-clip-text text-center text-2xl font-black tracking-tight text-transparent sm:text-[1.75rem] ${chrome.headline}`}
                            >
                                {isUp ? '매너 등급 상승' : '매너 등급 하락'}
                            </h2>
                            <p className="mx-auto mt-2 max-w-[22rem] text-center text-sm leading-relaxed text-slate-400">{chrome.caption}</p>

                            <div className="my-6 flex flex-col items-center gap-4">
                                <div className="relative">
                                    <div className={`absolute -inset-6 rounded-full blur-2xl ${chrome.glowA}`} aria-hidden />
                                    <div className="relative rounded-full ring-2 ring-white/10 ring-offset-2 ring-offset-black/40">
                                        <Avatar
                                            userId={user.id}
                                            userName={displayName}
                                            avatarUrl={avatarUrl}
                                            borderUrl={borderUrl}
                                            size={92}
                                            className="drop-shadow-[0_16px_36px_rgba(0,0,0,0.72)]"
                                        />
                                    </div>
                                </div>
                                <p className="text-center text-base font-bold tracking-tight text-white drop-shadow-sm sm:text-lg">{displayName}</p>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch sm:gap-2">
                                <div className={`rounded-2xl border bg-black/35 p-4 text-center ring-1 ring-inset sm:p-4 ${chrome.scorePanel}`}>
                                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-slate-500">이전</p>
                                    <p className={`mt-2 text-lg font-black tracking-tight sm:text-xl ${prevStyle.color}`}>{payload.previousRank}</p>
                                </div>

                                <div className="hidden items-center justify-center sm:flex" aria-hidden>
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-lg text-white/40 shadow-inner">
                                        →
                                    </div>
                                </div>
                                <div className="flex justify-center sm:hidden" aria-hidden>
                                    <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-1 text-xs text-white/35">변경</div>
                                </div>

                                <div className={`rounded-2xl border bg-black/35 p-4 text-center ring-1 ring-inset sm:p-4 ${chrome.scorePanel}`}>
                                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-slate-500">현재</p>
                                    <p className={`mt-2 text-lg font-black tracking-tight sm:text-xl ${nextStyle.color}`}>{payload.newRank}</p>
                                </div>
                            </div>

                            <div
                                className={`mt-3 rounded-2xl border border-white/10 bg-black/40 p-4 ring-1 ring-inset ring-white/[0.06] sm:p-5 ${isUp ? 'shadow-[inset_0_1px_0_rgba(45,212,191,0.08)]' : 'shadow-[inset_0_1px_0_rgba(251,113,133,0.06)]'}`}
                            >
                                <p className="text-center text-[0.65rem] font-bold uppercase tracking-[0.22em] text-slate-500">매너 점수</p>
                                <p className="mt-2 text-center tabular-nums text-base text-slate-200 sm:text-lg">
                                    <span className="text-slate-500">{payload.previousScore.toLocaleString()}점</span>
                                    <span className="mx-2 text-slate-600">→</span>
                                    <span className="font-bold text-white">{payload.newScore.toLocaleString()}점</span>
                                    <span className={`ml-2 text-sm font-bold ${delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        ({delta >= 0 ? '+' : ''}
                                        {delta.toLocaleString()})
                                    </span>
                                </p>
                            </div>

                            <p className="mt-5 text-center text-xs leading-relaxed text-slate-500 sm:text-[0.8125rem]">
                                {isUp
                                    ? '바른 매너를 유지하면 혜택이 늘어납니다. 계속 좋은 대국 부탁드립니다.'
                                    : '매너 점수가 낮아지면 보상·능력치에 불리할 수 있습니다. 건전한 플레이를 권장합니다.'}
                            </p>

                            <div className="mt-7 flex justify-center">
                                <Button
                                    onClick={onClose}
                                    colorScheme={isUp ? 'blue' : 'gray'}
                                    className="min-h-[2.85rem] w-full max-w-xs font-bold shadow-[0_12px_32px_-12px_rgba(0,0,0,0.65)]"
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
