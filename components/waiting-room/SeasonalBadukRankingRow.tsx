import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AVATAR_POOL, BORDER_POOL } from '../../constants';
import Avatar from '../Avatar.js';
import { translateRankingTierName } from '../../shared/i18n/rankingTierText.js';

export interface SeasonalBadukRankingRowUser {
    id: string;
    nickname: string;
    avatarId: string;
    borderId: string;
    avgScore: number;
    totalGames: number;
    wins: number;
    losses: number;
    userLevel?: number;
}

export interface SeasonalBadukRankingTier {
    name: string;
    icon: string;
    color: string;
}

interface SeasonalBadukRankingRowProps {
    user: SeasonalBadukRankingRowUser;
    rank: number;
    isMyRankDisplay: boolean;
    dashPlaceholder?: boolean;
    rankSmall: boolean;
    tier: SeasonalBadukRankingTier;
    onViewUser: (userId: string) => void;
    currentUserId: string;
    currentUserLevel: number;
}

const SeasonalBadukRankingRow: React.FC<SeasonalBadukRankingRowProps> = ({
    user,
    rank,
    isMyRankDisplay,
    dashPlaceholder = false,
    rankSmall,
    tier,
    onViewUser,
    currentUserId,
    currentUserLevel,
}) => {
    const { t } = useTranslation('lobby');
    const tierDisplayName = translateRankingTierName(tier.name);
    const wins = user.wins || 0;
    const losses = user.losses || 0;
    const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
    const score = user.avgScore;

    const displayLevel =
        user.userLevel != null && Number.isFinite(Number(user.userLevel))
            ? Math.max(1, Math.floor(Number(user.userLevel)))
            : user.id === currentUserId
              ? Math.max(1, Math.floor(Number(currentUserLevel) || 1))
              : null;

    const isCurrentUserInList = !isMyRankDisplay && user.id === currentUserId;
    const isTopThree = rank <= 3 && !isMyRankDisplay;

    const rankStyle = useMemo(() => {
        if (isMyRankDisplay) {
            return {
                container:
                    'group relative overflow-hidden bg-gradient-to-r from-yellow-900/50 via-amber-900/40 to-yellow-900/50 border-2 border-yellow-500/60 shadow-[0_4px_20px_rgba(234,179,8,0.3)]',
                rankText: 'text-yellow-400 font-bold',
                glow: 'absolute inset-0 bg-gradient-to-r from-yellow-500/20 via-transparent to-yellow-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300',
            };
        }
        if (rank === 1) {
            return {
                container:
                    'group relative overflow-hidden bg-gradient-to-r from-amber-900/40 via-yellow-900/30 to-amber-900/40 border-2 border-amber-400/70 shadow-[0_4px_20px_rgba(251,191,36,0.4)]',
                rankText: 'text-amber-300 font-bold text-lg',
                glow: 'absolute inset-0 bg-gradient-to-r from-amber-500/30 via-transparent to-amber-500/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300',
            };
        }
        if (rank === 2) {
            return {
                container:
                    'group relative overflow-hidden bg-gradient-to-r from-slate-700/40 via-slate-600/30 to-slate-700/40 border-2 border-slate-400/70 shadow-[0_4px_20px_rgba(148,163,184,0.3)]',
                rankText: 'text-slate-300 font-bold text-lg',
                glow: 'absolute inset-0 bg-gradient-to-r from-slate-400/20 via-transparent to-slate-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300',
            };
        }
        if (rank === 3) {
            return {
                container:
                    'group relative overflow-hidden bg-gradient-to-r from-orange-900/40 via-amber-900/30 to-orange-900/40 border-2 border-orange-500/70 shadow-[0_4px_20px_rgba(249,115,22,0.3)]',
                rankText: 'text-orange-300 font-bold text-lg',
                glow: 'absolute inset-0 bg-gradient-to-r from-orange-500/20 via-transparent to-orange-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300',
            };
        }
        if (isCurrentUserInList) {
            return {
                container:
                    'group relative overflow-hidden bg-gradient-to-r from-blue-900/50 via-indigo-900/40 to-blue-900/50 border-2 border-blue-500/60 shadow-[0_4px_15px_rgba(59,130,246,0.3)]',
                rankText: 'text-blue-300 font-semibold',
                glow: 'absolute inset-0 bg-gradient-to-r from-blue-500/20 via-transparent to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300',
            };
        }
        return {
            container:
                'group relative overflow-hidden bg-gradient-to-br from-gray-800/40 via-gray-900/30 to-gray-800/40 border border-gray-700/50 shadow-[0_2px_8px_rgba(0,0,0,0.3)] hover:border-gray-600/70 hover:shadow-[0_4px_12px_rgba(0,0,0,0.4)]',
            rankText: 'text-gray-300 font-semibold',
            glow: 'absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300',
        };
    }, [isMyRankDisplay, rank, isCurrentUserInList]);

    const isClickable = !isMyRankDisplay && user.id !== currentUserId;
    const avatarUrl = AVATAR_POOL.find((a) => a.id === user.avatarId)?.url;
    const borderUrl = BORDER_POOL.find((b) => b.id === user.borderId)?.url;

    const rankDisplay = () => {
        const medalSeasonal = rankSmall ? 'text-3xl leading-none sm:text-4xl' : 'text-4xl leading-none sm:text-5xl';
        const numSeasonal = rankSmall ? 'text-base sm:text-lg tabular-nums' : 'text-lg sm:text-xl lg:text-2xl tabular-nums';

        if (dashPlaceholder) {
            return <span className={`${rankStyle.rankText} ${numSeasonal} tabular-nums`}>-</span>;
        }
        if (rank === 1) {
            return (
                <span className={medalSeasonal} role="img" aria-label="Gold Medal">
                    🥇
                </span>
            );
        }
        if (rank === 2) {
            return (
                <span className={medalSeasonal} role="img" aria-label="Silver Medal">
                    🥈
                </span>
            );
        }
        if (rank === 3) {
            return (
                <span className={medalSeasonal} role="img" aria-label="Bronze Medal">
                    🥉
                </span>
            );
        }
        return <span className={`${rankStyle.rankText} ${numSeasonal}`}>{rank}</span>;
    };

    const winRateClass = winRate >= 60 ? 'text-green-400' : winRate >= 50 ? 'text-yellow-400' : 'text-gray-400';

    const rowPad = rankSmall ? 'gap-1.5 p-1.5 sm:gap-2 sm:p-2' : 'gap-2 p-2 sm:gap-2.5 sm:p-2.5';
    const tierIconCls = rankSmall ? 'h-9 w-9 sm:h-10 sm:w-10' : 'h-11 w-11 sm:h-12 sm:w-12';
    const avatarSz = rankSmall ? (isTopThree ? 40 : 38) : isTopThree ? 48 : 46;
    const lineCls = rankSmall ? 'text-xs sm:text-sm' : 'text-sm sm:text-base lg:text-lg';

    return (
        <li
            key={user.id}
            className={`flex min-w-0 items-center ${rowPad} rounded-lg transition-all duration-300 ${rankStyle.container} ${isClickable ? 'cursor-pointer hover:scale-[1.01] hover:-translate-y-0.5' : ''}`}
            onClick={isClickable ? () => onViewUser(user.id) : undefined}
            title={isClickable ? t('ranked.viewProfile', { name: user.nickname }) : ''}
        >
            <div className={rankStyle.glow} />
            <div className={`relative z-10 flex shrink-0 items-center justify-center ${rankSmall ? 'w-10 sm:w-11' : 'w-12 sm:w-14'}`}>
                {rankDisplay()}
            </div>
            <div className={`relative z-10 flex shrink-0 flex-col items-center ${rankSmall ? 'w-[3.5rem] sm:w-[3.75rem]' : 'w-[3.75rem] sm:w-16'}`}>
                <div className="relative flex justify-center">
                    <img
                        src={tier.icon}
                        alt={tierDisplayName}
                        className={`flex-shrink-0 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] transition-transform duration-300 group-hover:scale-105 ${tierIconCls}`}
                        title={tierDisplayName}
                    />
                    {(isTopThree || isMyRankDisplay) && (
                        <div className="pointer-events-none absolute inset-0 rounded-lg bg-gradient-to-br from-white/20 to-transparent blur-sm" />
                    )}
                </div>
                <span
                    className={`mt-0.5 max-w-full text-center font-extrabold leading-tight text-gray-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)] ${
                        rankSmall ? 'text-[9px] sm:text-[10px]' : 'text-[10px] sm:text-xs'
                    }`}
                >
                    {tierDisplayName}
                </span>
            </div>
            <Avatar
                userId={user.id}
                userName={user.nickname}
                size={avatarSz}
                avatarUrl={avatarUrl}
                borderUrl={borderUrl}
                fixedFrameSize
                className="relative z-10 shrink-0 transition-transform duration-300 group-hover:scale-105"
            />
            <div className={`relative z-10 flex min-w-0 flex-1 flex-col gap-0.5 leading-tight ${lineCls}`}>
                <span className="shrink-0 font-extrabold tabular-nums text-amber-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]">
                    Lv.{displayLevel ?? '—'}
                </span>
                <span
                    className={`min-w-0 truncate font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] ${
                        isTopThree || isMyRankDisplay ? 'text-white' : 'text-gray-100'
                    }`}
                >
                    {user.nickname}
                </span>
            </div>
            <div className="relative z-10 flex shrink-0 flex-col items-end gap-0.5 text-right">
                <span
                    className={`font-mono font-black tabular-nums leading-none tracking-tight drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)] ${
                        isTopThree || isMyRankDisplay ? 'text-yellow-100' : 'text-yellow-300'
                    } ${rankSmall ? 'text-base sm:text-lg' : 'text-lg sm:text-2xl lg:text-3xl'}`}
                >
                    {dashPlaceholder ? '—' : t('ranked.scorePoints', { score: Math.round(score) })}
                </span>
                <div className={`font-semibold tabular-nums text-gray-200 ${rankSmall ? 'text-[9px] sm:text-[11px]' : 'text-xs sm:text-sm'}`}>
                    {dashPlaceholder ? (
                        <span>—</span>
                    ) : (
                        <>
                            <span>{t('ranked.winsLosses', { wins, losses })}</span>
                            <span className={`ml-1.5 font-bold ${winRateClass}`}>{winRate}%</span>
                        </>
                    )}
                </div>
            </div>
        </li>
    );
};

export default SeasonalBadukRankingRow;
