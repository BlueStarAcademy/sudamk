import React from 'react';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';
import { formatDateTimeKST, getGuildWarTypeFromMatchTime } from '../../utils/timeUtils.js';

const GUILD_WAR_DURATION_MS = { tue_wed: 47 * 60 * 60 * 1000, fri_sun: 71 * 60 * 60 * 1000 };

export type GuildWarMatchPresentationClient = {
    badge: string;
    tone: 'rival' | 'system' | 'demo';
    lines: string[];
};

interface GuildWarMatchingModalProps {
    onClose: () => void;
    message: string;
    /** 매칭 완료 시 표시할 이번 길드전 시작 시각 (KST 화/금 0시). 있으면 전쟁 기간 정보를 함께 표시 */
    warStartTime?: number;
    /** 서버가 내려주는 매칭 결과 연출(길드 vs 길드 / 홀수 봇 등) */
    matchPresentation?: GuildWarMatchPresentationClient | null;
    isTopmost?: boolean;
}

const toneStyles: Record<GuildWarMatchPresentationClient['tone'], { ring: string; badge: string; panel: string }> = {
    rival: {
        ring: 'from-violet-500/25 via-fuchsia-500/10 to-violet-500/25',
        badge: 'border-fuchsia-400/50 bg-gradient-to-r from-fuchsia-900/70 to-violet-900/70 text-fuchsia-100',
        panel: 'border-fuchsia-500/35 bg-fuchsia-950/40',
    },
    system: {
        ring: 'from-cyan-500/20 via-slate-500/10 to-cyan-500/20',
        badge: 'border-cyan-400/50 bg-gradient-to-r from-cyan-900/70 to-slate-900/70 text-cyan-100',
        panel: 'border-cyan-500/35 bg-slate-900/50',
    },
    demo: {
        ring: 'from-amber-500/25 via-orange-500/10 to-amber-500/25',
        badge: 'border-amber-400/50 bg-gradient-to-r from-amber-900/70 to-orange-900/70 text-amber-100',
        panel: 'border-amber-500/35 bg-amber-950/35',
    },
};

const GuildWarMatchingModal: React.FC<GuildWarMatchingModalProps> = ({
    onClose,
    message,
    warStartTime,
    matchPresentation,
    isTopmost,
}) => {
    const warInfo =
        warStartTime != null
            ? (() => {
                  const type = getGuildWarTypeFromMatchTime(warStartTime);
                  const warEndTime = warStartTime + GUILD_WAR_DURATION_MS[type];
                  const periodLabel = type === 'tue_wed' ? '화·수 47시간' : '금·토·일 71시간';
                  return { start: warStartTime, end: warEndTime, periodLabel };
              })()
            : null;

    const tone = matchPresentation?.tone ?? 'demo';
    const tStyle = toneStyles[tone];

    return (
        <DraggableWindow
            title="길드 전쟁"
            onClose={onClose}
            windowId="guild-war-matching-modal"
            initialWidth={560}
            initialHeight={520}
            isTopmost={isTopmost}
        >
            <div className="flex flex-col h-full min-h-0 relative overflow-hidden">
                <div className={`absolute inset-0 bg-gradient-to-br ${tStyle.ring} pointer-events-none rounded-b-xl`} />
                <div className="relative z-10 flex flex-col items-center flex-1 min-h-0 p-6">
                    <div className="flex-shrink-0 w-20 h-20 rounded-xl bg-gradient-to-br from-stone-800/90 to-stone-900/90 border-2 border-stone-500/40 flex items-center justify-center mb-3 shadow-lg">
                        <img src="/images/guild/button/guildwar.png" alt="길드 전쟁" className="w-14 h-14 object-contain drop-shadow-xl" />
                    </div>
                    {matchPresentation?.badge && (
                        <div
                            className={`flex-shrink-0 mb-3 px-3 py-1 rounded-full text-xs font-bold border ${tStyle.badge} shadow-md tracking-wide`}
                        >
                            {matchPresentation.badge}
                        </div>
                    )}
                    <h2 className="flex-shrink-0 text-xl font-bold text-stone-100 drop-shadow mb-2 text-center">길드 전쟁</h2>
                    <div className="flex-1 min-h-0 w-full overflow-y-auto flex flex-col items-stretch justify-center gap-3">
                        <p className="text-stone-100 text-base leading-relaxed px-1 text-center font-semibold">{message}</p>
                        {matchPresentation && matchPresentation.lines.length > 0 && (
                            <div className={`w-full rounded-xl border px-4 py-3 ${tStyle.panel}`}>
                                <ul className="text-stone-300 text-sm leading-relaxed space-y-2 list-disc pl-4 marker:text-stone-500">
                                    {matchPresentation.lines.map((line, i) => (
                                        <li key={i}>{line}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {warInfo && (
                            <div className="w-full rounded-lg bg-stone-800/80 border border-stone-600/40 px-4 py-3 text-center">
                                <div className="text-amber-200/90 text-sm font-medium mb-1">이번 길드전 진행 기간</div>
                                <div className="text-stone-300 text-xs leading-relaxed">
                                    {formatDateTimeKST(warInfo.start)} ~ {formatDateTimeKST(warInfo.end)}
                                </div>
                                <div className="text-stone-400 text-[11px] mt-1">({warInfo.periodLabel})</div>
                            </div>
                        )}
                    </div>
                    <div className="flex-shrink-0 w-full mt-5">
                        <Button
                            onClick={onClose}
                            className="w-full py-3.5 font-bold border-2 border-amber-500/60 bg-gradient-to-r from-amber-600/95 via-orange-600/95 to-amber-600/95 text-white shadow-lg hover:shadow-xl hover:from-amber-500 hover:via-orange-500 hover:to-amber-500 transition-all"
                        >
                            확인
                        </Button>
                    </div>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default GuildWarMatchingModal;
