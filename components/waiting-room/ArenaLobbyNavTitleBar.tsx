import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ArenaLobbyIntent } from '../../shared/types/api.js';

export type ArenaLobbyNavKind = 'pair' | 'strategic' | 'playful' | 'friendly';

type TitleBarProps = {
    kind: ArenaLobbyNavKind;
    lobbyIntent?: ArenaLobbyIntent;
    /** @deprecated 큐 탭은 대국 설정 패널 좌열로 이동됨 — 무시됨 */
    matchQueueKind?: 'ranked' | 'normal';
    /** @deprecated 큐 탭은 대국 설정 패널 좌열로 이동됨 — 무시됨 */
    onSelectMatchQueue?: (queue: 'ranked' | 'normal') => void;
    /** 프로필로 이동(대기실 이탈 로직은 부모에서 비동기 처리) */
    onBackToProfile: () => void;
    titleHeadingClass: string;
    className?: string;
};

function destinationTitleKey(kind: ArenaLobbyNavKind, intent: ArenaLobbyIntent): string {
    const suffix = intent === 'pvp' ? 'Pvp' : 'Ai';
    return `${kind}${suffix}`;
}

/** 뒤로가기 + 현재 경기장 제목. (홈 입장카드 정렬 후 로비 내 채널 전환 그리드는 제거됨) */
export const ArenaLobbyNavTitleBar: React.FC<TitleBarProps> = ({
    kind,
    lobbyIntent = 'pvp',
    onBackToProfile,
    className,
    titleHeadingClass,
}) => {
    const { t } = useTranslation('lobby');
    const titleStripChrome =
        kind === 'playful'
            ? 'border-amber-400/45 bg-black/20'
            : kind === 'pair'
              ? 'border-violet-400/50 bg-violet-950/20'
              : kind === 'friendly'
                ? 'border-emerald-400/45 bg-emerald-950/20'
                : 'border-cyan-400/45 bg-black/25';

    const displayTitle = t(`arenaLobby.destinationTitle.${destinationTitleKey(kind, lobbyIntent)}`);

    return (
        <div className={className ?? ''}>
            <div
                className={`flex w-full min-w-0 shrink-0 items-center gap-1.5 rounded-xl border p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] sm:gap-2 sm:p-2 ${titleStripChrome}`}
            >
                <button
                    type="button"
                    onClick={onBackToProfile}
                    className="relative z-[1] shrink-0 transition-transform active:scale-90 hover:drop-shadow-lg"
                    aria-label={t('arenaLobby.back')}
                >
                    <img src="/images/button/back.webp" alt="" className="h-9 w-9 sm:h-10 sm:w-10" />
                </button>
                <h1 className={`min-w-0 flex-1 truncate ${titleHeadingClass}`}>{displayTitle}</h1>
            </div>
        </div>
    );
};
