import React, { useMemo, useEffect, useRef, useState } from 'react';
import { LiveGameSession, User, Player, WinReason, StatChange, AnalysisResult, GameMode, GameSummary, InventoryItem, AvatarInfo, BorderInfo, AlkkagiStone, ServerAction, AlkkagiRoundHistoryEntry } from '../types.js';
import Avatar from './Avatar.js';
import { audioService } from '../services/audioService.js';
import Button from './Button.js';
import DraggableWindow from './DraggableWindow.js';
import { PLAYFUL_GAME_MODES, AVATAR_POOL, BORDER_POOL, CONSUMABLE_ITEMS, SPECIAL_GAME_MODES } from '../constants';
import { canSaveStrategicPvpGameRecord, GAME_RECORD_SLOT_FULL_MESSAGE } from '../utils/strategicPvpGameRecord.js';
import { useGameRecordSaveLock } from '../hooks/useGameRecordSaveLock.js';
import { TOWER_STAGES } from '../constants/towerConstants.js';
import { SINGLE_PLAYER_STAGES } from '../constants/singlePlayerConstants.js';
import { getMannerRank as getMannerRankShared } from '../services/manner.js';
import {
    getGuildWarBoardMode,
    isGuildWarLiveSession,
    GUILD_WAR_STAR_CAPTURE_TIER2_MIN,
    GUILD_WAR_STAR_CAPTURE_TIER3_MIN,
    getGuildWarStarScoreTier2MinDiff,
    getGuildWarStarScoreTier3MinDiff,
} from '../shared/constants/guildConstants.js';
import { computeGuildWarAttemptMetrics } from '../shared/utils/guildWarAttemptMetrics.js';

interface GameSummaryModalProps {
    session: LiveGameSession;
    currentUser: User;
    onConfirm: () => void;
    onAction?: (action: ServerAction) => void | Promise<unknown>;
    /** 저장된 기보 목록·삭제(기보 관리) */
    onOpenGameRecordList?: () => void;
    isSpectator?: boolean;
}

const getIsWinner = (session: LiveGameSession, currentUser: User): boolean | null => {
    const { winner, blackPlayerId, whitePlayerId, player1, player2 } = session;
    if (winner === null || winner === Player.None) return null;
    const isPlayer = currentUser.id === player1.id || currentUser.id === player2.id;
    if (!isPlayer) return null; // Spectators don't have a win/loss status

    return (winner === Player.Black && currentUser.id === blackPlayerId) || 
           (winner === Player.White && currentUser.id === whitePlayerId);
};

const getMannerRank = (score: number) => {
    return getMannerRankShared(score).rank;
};


const XpBar: React.FC<{ initial: number; final: number; max: number; levelUp: boolean; xpGain: number; finalLevel: number; isMobile?: boolean; mobileTextScale?: number }> = ({ initial, final, max, levelUp, xpGain, finalLevel, isMobile = false, mobileTextScale = 1 }) => {
    // Width of the yellow bar, animates from initial to final
    const [barWidth, setBarWidth] = useState(0); 
    // Opacity of the green "flash" element
    const [gainFlashOpacity, setGainFlashOpacity] = useState(0); 
    const [showGainText, setShowGainText] = useState(false);

    const initialPercent = max > 0 ? (initial / max) * 100 : 0;
    const finalPercent = max > 0 ? (levelUp ? 100 : (final / max) * 100) : 0;
    const gainPercent = finalPercent - initialPercent;

    useEffect(() => {
        // Set initial state without animation
        setBarWidth(initialPercent);
        setGainFlashOpacity(0);
        setShowGainText(false);

        // Start animation after a short delay
        const startTimer = setTimeout(() => {
            setShowGainText(true);
            setGainFlashOpacity(1); // Show the green flash
            setBarWidth(finalPercent); // Start the yellow bar animation

            // After the yellow bar animation starts, fade out the green flash
            const fadeTimer = setTimeout(() => {
                setGainFlashOpacity(0);
            }, 500);

            return () => clearTimeout(fadeTimer);
        }, 500);

        return () => clearTimeout(startTimer);
    }, [initial, final, max, levelUp, initialPercent, finalPercent]);
    
    const gainTextKey = `${xpGain}-${initial}`;

    return (
        <div className={`flex items-center ${isMobile ? 'gap-1.5' : 'gap-3'}`}>
             <span className={`${isMobile ? 'text-xs w-12' : 'text-sm w-16'} font-bold text-right`} style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}>Lv.{finalLevel}</span>
            <div className={`w-full bg-gray-700/50 rounded-full ${isMobile ? 'h-3' : 'h-4'} relative border border-gray-900/50 overflow-hidden`}>
                <div 
                    className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${barWidth}%` }}
                ></div>
                
                <div 
                    className="absolute top-0 h-full bg-gradient-to-r from-green-400 to-green-500 rounded-r-full transition-opacity duration-500 ease-out pointer-events-none"
                    style={{ 
                        left: `${initialPercent}%`, 
                        width: `${gainPercent}%`,
                        opacity: gainFlashOpacity
                    }}
                ></div>

                <span className={`absolute inset-0 flex items-center justify-center ${isMobile ? 'text-[9px]' : 'text-xs'} font-bold text-black/80 drop-shadow-sm`} style={{ fontSize: isMobile ? `${8 * mobileTextScale}px` : undefined }}>
                   {initial} +{xpGain} / {max} XP
                </span>

                {levelUp && (
                    <span className={`absolute inset-0 flex items-center justify-center ${isMobile ? 'text-[9px]' : 'text-xs'} font-bold text-white animate-pulse`} style={{textShadow: '0 0 5px black', fontSize: isMobile ? `${8 * mobileTextScale}px` : undefined}}>
                        LEVEL UP!
                    </span>
                )}
            </div>
             {showGainText && xpGain > 0 && (
                <span key={gainTextKey} className={`${isMobile ? 'text-xs w-14' : 'text-sm w-20'} font-bold text-green-400 whitespace-nowrap animate-fade-in-xp`} style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}>
                    +{xpGain} XP
                </span>
             )}
             <style>{`
                @keyframes fadeInXp {
                    from { opacity: 0; transform: scale(0.8); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-fade-in-xp {
                    animation: fadeInXp 0.5s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

const ScoreDetailsComponent: React.FC<{ analysis: AnalysisResult, session: LiveGameSession, isMobile?: boolean, mobileTextScale?: number }> = ({ analysis, session, isMobile = false, mobileTextScale = 1 }) => {
    const { scoreDetails } = analysis;
    const { mode, settings } = session;

    if (!scoreDetails) return <p className={`text-center text-gray-400 ${isMobile ? 'text-xs' : ''}`} style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}>점수 정보가 없습니다.</p>;
    
    const isSpeedMode = mode === GameMode.Speed || (mode === GameMode.Mix && settings.mixedModes?.includes(GameMode.Speed));
    const isBaseMode = mode === GameMode.Base || (mode === GameMode.Mix && settings.mixedModes?.includes(GameMode.Base));
    const isHiddenMode = mode === GameMode.Hidden || (mode === GameMode.Mix && settings.mixedModes?.includes(GameMode.Hidden));

    return (
        <div className={`space-y-2 sm:space-y-3 ${isMobile ? 'text-[10px]' : 'text-xs md:text-sm'}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                <div className={`space-y-0.5 sm:space-y-1 bg-gray-800/50 ${isMobile ? 'p-1.5' : 'p-2'} rounded-md`}>
                    <h3 className={`font-bold text-center mb-0.5 sm:mb-1 ${isMobile ? 'text-xs' : ''}`} style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}>흑</h3>
                    <div className="flex justify-between" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : undefined }}><span>영토:</span> <span>{scoreDetails.black.territory.toFixed(0)}</span></div>
                    <div className="flex justify-between" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : undefined }}><span>따낸 돌:</span> <span>{scoreDetails.black.liveCaptures ?? 0}</span></div>
                    <div className="flex justify-between" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : undefined }}><span>사석:</span> <span>{Math.round(Number(scoreDetails.black.deadStones ?? 0))}</span></div>
                    {isBaseMode && <div className="flex justify-between text-blue-300" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : undefined }}><span>베이스 보너스:</span> <span>{scoreDetails.black.baseStoneBonus}</span></div>}
                    {isHiddenMode && <div className="flex justify-between text-purple-300" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : undefined }}><span>히든 보너스:</span> <span>{scoreDetails.black.hiddenStoneBonus}</span></div>}
                    {isSpeedMode && <div className="flex justify-between text-green-300" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : undefined }}><span>시간 보너스:</span> <span>{scoreDetails.black.timeBonus.toFixed(1)}</span></div>}
                    <div className={`flex justify-between border-t border-gray-600 pt-0.5 sm:pt-1 mt-0.5 sm:mt-1 font-bold ${isMobile ? 'text-xs' : 'text-base'}`} style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}><span>총점:</span> <span className="text-yellow-300">{scoreDetails.black.total.toFixed(1)}</span></div>
                </div>
                <div className={`space-y-0.5 sm:space-y-1 bg-gray-800/50 ${isMobile ? 'p-1.5' : 'p-2'} rounded-md`}>
                    <h3 className={`font-bold text-center mb-0.5 sm:mb-1 ${isMobile ? 'text-xs' : ''}`} style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}>백</h3>
                    <div className="flex justify-between" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : undefined }}><span>영토:</span> <span>{scoreDetails.white.territory.toFixed(0)}</span></div>
                    <div className="flex justify-between" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : undefined }}><span>따낸 돌:</span> <span>{scoreDetails.white.liveCaptures ?? 0}</span></div>
                    <div className="flex justify-between" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : undefined }}><span>사석:</span> <span>{Math.round(Number(scoreDetails.white.deadStones ?? 0))}</span></div>
                    <div className="flex justify-between" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : undefined }}><span>덤:</span> <span>{scoreDetails.white.komi}</span></div>
                    {isBaseMode && <div className="flex justify-between text-blue-300" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : undefined }}><span>베이스 보너스:</span> <span>{scoreDetails.white.baseStoneBonus}</span></div>}
                    {isHiddenMode && <div className="flex justify-between text-purple-300" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : undefined }}><span>히든 보너스:</span> <span>{scoreDetails.white.hiddenStoneBonus}</span></div>}
                    {isSpeedMode && <div className="flex justify-between text-green-300" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : undefined }}><span>시간 보너스:</span> <span>{scoreDetails.white.timeBonus.toFixed(1)}</span></div>}
                    <div className={`flex justify-between border-t border-gray-600 pt-0.5 sm:pt-1 mt-0.5 sm:mt-1 font-bold ${isMobile ? 'text-xs' : 'text-base'}`} style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}><span>총점:</span> <span className="text-yellow-300">{scoreDetails.white.total.toFixed(1)}</span></div>
                </div>
            </div>
        </div>
    );
};

const PlayfulScoreDetailsComponent: React.FC<{ gameSession: LiveGameSession, isMobile?: boolean, mobileTextScale?: number }> = ({ gameSession, isMobile = false, mobileTextScale = 1 }) => {
    const { scores, player1, player2, diceGoBonuses } = gameSession;
    const p1Id = player1.id;
    const p2Id = player2.id;

    const p1TotalScore = scores[p1Id] || 0;
    const p2TotalScore = scores[p2Id] || 0;

    const p1Bonus = diceGoBonuses?.[p1Id] || 0;
    const p2Bonus = diceGoBonuses?.[p2Id] || 0;

    const p1CaptureScore = p1TotalScore - p1Bonus;
    const p2CaptureScore = p2TotalScore - p2Bonus;

    const hasBonus = p1Bonus > 0 || p2Bonus > 0;

    if (!hasBonus) {
        return (
            <div className="text-center">
                <p className={`text-gray-300 ${isMobile ? 'text-xs' : ''}`} style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}>최종 점수</p>
                <p className={`${isMobile ? 'text-3xl' : 'text-5xl'} font-mono my-2`} style={{ fontSize: isMobile ? `${28 * mobileTextScale}px` : undefined }}>{p1TotalScore} : {p2TotalScore}</p>
            </div>
        );
    }
    
    return (
        <div className={`space-y-2 sm:space-y-3 ${isMobile ? 'text-[10px]' : 'text-xs md:text-sm'}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                <div className={`space-y-0.5 sm:space-y-1 bg-gray-800/50 ${isMobile ? 'p-1.5' : 'p-2'} rounded-md`}>
                    <h3 className={`font-bold text-center mb-0.5 sm:mb-1 ${isMobile ? 'text-xs' : ''}`} style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}>{player1.nickname}</h3>
                    <div className="flex justify-between" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : undefined }}><span>포획 점수:</span> <span>{p1CaptureScore}</span></div>
                    {p1Bonus > 0 && <div className="flex justify-between" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : undefined }}><span>마지막 더미 보너스:</span> <span className="text-green-400">+{p1Bonus}</span></div>}
                    <div className={`flex justify-between border-t border-gray-600 pt-0.5 sm:pt-1 mt-0.5 sm:mt-1 font-bold ${isMobile ? 'text-xs' : 'text-base'}`} style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}>
                        <span>총점:</span> <span className="text-yellow-300">{p1TotalScore}</span>
                    </div>
                </div>
                <div className={`space-y-0.5 sm:space-y-1 bg-gray-800/50 ${isMobile ? 'p-1.5' : 'p-2'} rounded-md`}>
                    <h3 className={`font-bold text-center mb-0.5 sm:mb-1 ${isMobile ? 'text-xs' : ''}`} style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}>{player2.nickname}</h3>
                    <div className="flex justify-between" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : undefined }}><span>포획 점수:</span> <span>{p2CaptureScore}</span></div>
                    {p2Bonus > 0 && <div className="flex justify-between" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : undefined }}><span>마지막 더미 보너스:</span> <span className="text-green-400">+{p2Bonus}</span></div>}
                    <div className={`flex justify-between border-t border-gray-600 pt-0.5 sm:pt-1 mt-0.5 sm:mt-1 font-bold ${isMobile ? 'text-xs' : 'text-base'}`} style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}>
                        <span>총점:</span> <span className="text-yellow-300">{p2TotalScore}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const CaptureScoreDetailsComponent: React.FC<{ session: LiveGameSession, isMobile?: boolean, mobileTextScale?: number, mobileImageScale?: number }> = ({ session, isMobile = false, mobileTextScale = 1, mobileImageScale = 1 }) => {
    const { captures, blackPlayerId, whitePlayerId, player1, player2, winner } = session;
    const blackCaptures = captures[Player.Black] || 0;
    const whiteCaptures = captures[Player.White] || 0;
    
    const blackPlayer = blackPlayerId === player1.id ? player1 : player2;
    const whitePlayer = whitePlayerId === player1.id ? player1 : player2;
    
    const blackAvatarUrl = AVATAR_POOL.find((a: AvatarInfo) => a.id === blackPlayer.avatarId)?.url;
    const blackBorderUrl = BORDER_POOL.find((b: BorderInfo) => b.id === blackPlayer.borderId)?.url;
    const whiteAvatarUrl = AVATAR_POOL.find((a: AvatarInfo) => a.id === whitePlayer.avatarId)?.url;
    const whiteBorderUrl = BORDER_POOL.find((b: BorderInfo) => b.id === whitePlayer.borderId)?.url;
    
    const blackWon = winner === Player.Black;
    const whiteWon = winner === Player.White;
    
    return (
        <div className="text-center space-y-3 sm:space-y-4">
            <p
                className={`text-gray-300 mb-2 sm:mb-4 ${isMobile ? 'text-sm' : 'text-base'}`}
                style={{ fontSize: isMobile ? `${12 * mobileTextScale}px` : undefined }}
            >
                최종 스코어
            </p>
            <div className="flex items-center justify-center gap-2 sm:gap-4">
                <div
                    className={`flex flex-col items-center gap-1 sm:gap-2 ${
                        isMobile ? 'w-20' : 'w-32'
                    } flex-shrink-0`}
                >
                    <Avatar
                        userId={blackPlayer.id}
                        userName={blackPlayer.nickname}
                        size={isMobile ? Math.round(40 * mobileImageScale) : 64}
                        avatarUrl={blackAvatarUrl}
                        borderUrl={blackBorderUrl}
                    />
                    <span
                        className={`font-bold mt-0.5 sm:mt-1 w-full truncate ${
                            isMobile ? 'text-[10px]' : ''
                        }`}
                        style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : undefined }}
                    >
                        {blackPlayer.nickname} (흑)
                    </span>
                </div>
                <div className="flex items-center gap-2 sm:gap-4 flex-grow justify-center">
                    <span
                        className={`font-mono font-bold ${
                            isMobile ? 'text-3xl' : 'text-5xl'
                        } ${blackWon ? 'text-green-400' : 'text-white'}`}
                        style={{ fontSize: isMobile ? `${26 * mobileTextScale}px` : undefined }}
                    >
                        {blackCaptures}
                    </span>
                    <span
                        className={`${isMobile ? 'text-2xl' : 'text-4xl'} font-bold text-gray-400`}
                        style={{ fontSize: isMobile ? `${22 * mobileTextScale}px` : undefined }}
                    >
                        :
                    </span>
                    <span
                        className={`font-mono font-bold ${
                            isMobile ? 'text-3xl' : 'text-5xl'
                        } ${whiteWon ? 'text-green-400' : 'text-white'}`}
                        style={{ fontSize: isMobile ? `${26 * mobileTextScale}px` : undefined }}
                    >
                        {whiteCaptures}
                    </span>
                </div>
                <div
                    className={`flex flex-col items-center gap-1 sm:gap-2 ${
                        isMobile ? 'w-20' : 'w-32'
                    } flex-shrink-0`}
                >
                    <Avatar
                        userId={whitePlayer.id}
                        userName={whitePlayer.nickname}
                        size={isMobile ? Math.round(40 * mobileImageScale) : 64}
                        avatarUrl={whiteAvatarUrl}
                        borderUrl={whiteBorderUrl}
                    />
                    <span
                        className={`font-bold mt-0.5 sm:mt-1 w-full truncate ${
                            isMobile ? 'text-[10px]' : ''
                        }`}
                        style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : undefined }}
                    >
                        {whitePlayer.nickname} (백)
                    </span>
                </div>
            </div>
            {blackWon && (
                <p
                    className={`${isMobile ? 'text-base' : 'text-xl'} font-bold text-green-400`}
                    style={{ fontSize: isMobile ? `${14 * mobileTextScale}px` : undefined }}
                >
                    {blackPlayer.nickname} 승리!
                </p>
            )}
            {whiteWon && (
                <p
                    className={`${isMobile ? 'text-base' : 'text-xl'} font-bold text-green-400`}
                    style={{ fontSize: isMobile ? `${14 * mobileTextScale}px` : undefined }}
                >
                    {whitePlayer.nickname} 승리!
                </p>
            )}
        </div>
    );
};

const CurlingScoreDetailsComponent: React.FC<{ gameSession: LiveGameSession, isMobile?: boolean, mobileTextScale?: number, mobileImageScale?: number }> = ({ gameSession, isMobile = false, mobileTextScale = 1, mobileImageScale = 1 }) => {
    const { curlingScores, player1, player2, blackPlayerId, whitePlayerId } = gameSession;
    if (!curlingScores) return <p className={`text-center text-gray-400 ${isMobile ? 'text-xs' : ''}`} style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}>점수 정보가 없습니다.</p>;

    const blackPlayer = blackPlayerId === player1.id ? player1 : player2;
    const whitePlayer = whitePlayerId === player1.id ? player1 : player2;
    
    const blackScore = curlingScores[Player.Black] || 0;
    const whiteScore = curlingScores[Player.White] || 0;
    
    const blackAvatarUrl = AVATAR_POOL.find((a: AvatarInfo) => a.id === blackPlayer.avatarId)?.url;
    const blackBorderUrl = BORDER_POOL.find((b: BorderInfo) => b.id === blackPlayer.borderId)?.url;
    const whiteAvatarUrl = AVATAR_POOL.find((a: AvatarInfo) => a.id === whitePlayer.avatarId)?.url;
    const whiteBorderUrl = BORDER_POOL.find((b: BorderInfo) => b.id === whitePlayer.borderId)?.url;

    // 라운드별 점수 히스토리 가져오기
    const roundHistory = (gameSession as any).curlingRoundHistory || [];
    const totalRounds = gameSession.settings?.curlingRounds || 3;

    return (
        <div className="text-center space-y-3 sm:space-y-4">
            {/* 대국자 프로필과 점수 표시 */}
            <div className="flex items-center justify-center gap-2 sm:gap-4">
                <div className={`flex flex-col items-center gap-1 sm:gap-2 ${isMobile ? 'w-20' : 'w-32'} flex-shrink-0`}>
                    <Avatar userId={blackPlayer.id} userName={blackPlayer.nickname} size={isMobile ? Math.round(40 * mobileImageScale) : 64} avatarUrl={blackAvatarUrl} borderUrl={blackBorderUrl} />
                    <span className={`font-bold mt-0.5 sm:mt-1 w-full truncate ${isMobile ? 'text-[10px]' : 'text-sm'}`} style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : undefined }}>{blackPlayer.nickname} (흑)</span>
                </div>
                <div className={`flex-shrink-0 ${isMobile ? 'text-2xl' : 'text-4xl'} font-mono font-bold whitespace-nowrap`} style={{ fontSize: isMobile ? `${24 * mobileTextScale}px` : `${36 * mobileTextScale}px` }}>
                    <span className="text-white">{blackScore}</span>
                    <span className="mx-2 text-gray-400">:</span>
                    <span className="text-white">{whiteScore}</span>
                </div>
                <div className={`flex flex-col items-center gap-1 sm:gap-2 ${isMobile ? 'w-20' : 'w-32'} flex-shrink-0`}>
                    <Avatar userId={whitePlayer.id} userName={whitePlayer.nickname} size={isMobile ? Math.round(40 * mobileImageScale) : 64} avatarUrl={whiteAvatarUrl} borderUrl={whiteBorderUrl}/>
                    <span className={`font-bold mt-0.5 sm:mt-1 w-full truncate ${isMobile ? 'text-[10px]' : 'text-sm'}`} style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : undefined }}>{whitePlayer.nickname} (백)</span>
                </div>
            </div>
            
            {/* 상세 점수 내역 표 */}
            <div className={`mt-4 bg-gray-800/50 ${isMobile ? 'p-2' : 'p-4'} rounded-lg`}>
                <h3 className={`font-bold mb-3 ${isMobile ? 'text-xs' : 'text-base'} text-left`} style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}>상세 점수 내역</h3>
                <div className={`overflow-x-auto ${isMobile ? 'text-[9px]' : 'text-xs'}`} style={{ fontSize: isMobile ? `${8 * mobileTextScale}px` : undefined }}>
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="border-b-2 border-gray-600">
                                <th className={`text-left ${isMobile ? 'p-1.5' : 'p-2'} bg-gray-800/50`}>라운드</th>
                                <th className={`text-center ${isMobile ? 'p-1.5' : 'p-2'} bg-gray-700/50 border-l-2 border-gray-600`} colSpan={2}>{blackPlayer.nickname} (흑)</th>
                                <th className={`text-center ${isMobile ? 'p-1.5' : 'p-2'} bg-gray-700/50 border-l-2 border-gray-600`} colSpan={2}>{whitePlayer.nickname} (백)</th>
                            </tr>
                            <tr className="border-b border-gray-600">
                                <th className={`text-left ${isMobile ? 'p-1.5' : 'p-2'} bg-gray-800/50`}></th>
                                <th className={`text-center ${isMobile ? 'p-1.5' : 'p-2'} text-gray-400 bg-gray-700/30 border-l-2 border-gray-600`}>하우스</th>
                                <th className={`text-center ${isMobile ? 'p-1.5' : 'p-2'} text-gray-400 bg-gray-700/30`}>넉아웃</th>
                                <th className={`text-center ${isMobile ? 'p-1.5' : 'p-2'} text-gray-400 bg-gray-700/30 border-l-2 border-gray-600`}>하우스</th>
                                <th className={`text-center ${isMobile ? 'p-1.5' : 'p-2'} text-gray-400 bg-gray-700/30`}>넉아웃</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Array.from({ length: totalRounds }, (_, i) => i + 1).map(roundNum => {
                                const roundData = roundHistory.find((r: any) => r.round === roundNum);
                                const blackHouse = roundData ? roundData.black.houseScore : 0;
                                const blackKnockout = roundData ? roundData.black.knockoutScore : 0;
                                const blackPreviousKnockout = roundData?.black?.previousKnockoutScore ?? 0;
                                const blackTotal = roundData ? roundData.black.total : 0;
                                const whiteHouse = roundData ? roundData.white.houseScore : 0;
                                const whiteKnockout = roundData ? roundData.white.knockoutScore : 0;
                                const whitePreviousKnockout = roundData?.white?.previousKnockoutScore ?? 0;
                                const whiteTotal = roundData ? roundData.white.total : 0;
                                
                                return (
                                    <tr key={roundNum} className="border-b border-gray-700/50">
                                        <td className={`font-semibold ${isMobile ? 'p-1.5' : 'p-2'} bg-gray-800/30`}>{roundNum}라운드</td>
                                        <td className={`text-center ${isMobile ? 'p-1.5' : 'p-2'} bg-gray-700/20 border-l-2 border-gray-600`}>{blackHouse}</td>
                                        <td className={`text-center ${isMobile ? 'p-1.5' : 'p-2'} bg-gray-700/20`}>
                                            <div className="flex flex-col items-center">
                                                <span className="font-semibold">{blackKnockout}</span>
                                                {blackPreviousKnockout > 0 && (
                                                    <span className={`text-gray-400 ${isMobile ? 'text-[7px]' : 'text-[9px]'}`} style={{ fontSize: isMobile ? `${7 * mobileTextScale}px` : undefined }}>
                                                        (이전: {blackPreviousKnockout})
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className={`text-center ${isMobile ? 'p-1.5' : 'p-2'} bg-gray-700/20 border-l-2 border-gray-600`}>{whiteHouse}</td>
                                        <td className={`text-center ${isMobile ? 'p-1.5' : 'p-2'} bg-gray-700/20`}>
                                            <div className="flex flex-col items-center">
                                                <span className="font-semibold">{whiteKnockout}</span>
                                                {whitePreviousKnockout > 0 && (
                                                    <span className={`text-gray-400 ${isMobile ? 'text-[7px]' : 'text-[9px]'}`} style={{ fontSize: isMobile ? `${7 * mobileTextScale}px` : undefined }}>
                                                        (이전: {whitePreviousKnockout})
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            <tr className="border-t-2 border-gray-500 font-bold">
                                <td className={`${isMobile ? 'p-1.5' : 'p-2'} bg-gray-800/50`}>합계</td>
                                <td className={`text-center text-yellow-300 ${isMobile ? 'p-1.5' : 'p-2'} bg-gray-700/30 border-l-2 border-gray-600`} colSpan={2}>{blackScore}</td>
                                <td className={`text-center text-yellow-300 ${isMobile ? 'p-1.5' : 'p-2'} bg-gray-700/30 border-l-2 border-gray-600`} colSpan={2}>{whiteScore}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const AlkkagiScoreDetailsComponent: React.FC<{ gameSession: LiveGameSession; isMobile?: boolean; mobileTextScale?: number }> = ({ gameSession, isMobile = false, mobileTextScale = 1 }) => {
    const { player1, player2, blackPlayerId, whitePlayerId, winner, alkkagiRoundHistory, settings } = gameSession;
    const blackPlayer = blackPlayerId === player1.id ? player1 : player2;
    const whitePlayer = whitePlayerId === player1.id ? player1 : player2;
    const totalRounds = settings?.alkkagiRounds || 1;
    const history: AlkkagiRoundHistoryEntry[] = alkkagiRoundHistory || [];
    const blackWins = history.filter((r: AlkkagiRoundHistoryEntry) => r.winnerId === blackPlayerId).length;
    const whiteWins = history.filter((r: AlkkagiRoundHistoryEntry) => r.winnerId === whitePlayerId).length;

    return (
        <div className="text-center space-y-2 sm:space-y-3">
            <div className={`overflow-x-auto ${isMobile ? 'text-[9px]' : 'text-xs'}`} style={{ fontSize: isMobile ? `${8 * mobileTextScale}px` : undefined }}>
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="border-b-2 border-gray-600">
                            <th className={`text-left ${isMobile ? 'p-1.5' : 'p-2'} bg-gray-800/50`}>라운드</th>
                            <th className={`text-center ${isMobile ? 'p-1.5' : 'p-2'} bg-gray-700/50 border-l-2 border-gray-600`} colSpan={3}>{blackPlayer.nickname} (흑)</th>
                            <th className={`text-center ${isMobile ? 'p-1.5' : 'p-2'} bg-gray-700/50 border-l-2 border-gray-600`} colSpan={3}>{whitePlayer.nickname} (백)</th>
                        </tr>
                        <tr className="border-b border-gray-600">
                            <th className={`text-left ${isMobile ? 'p-1.5' : 'p-2'} bg-gray-800/50`}></th>
                            <th className={`text-center ${isMobile ? 'p-1.5' : 'p-2'} text-gray-400 bg-gray-700/30 border-l-2 border-gray-600`}>공격성공</th>
                            <th className={`text-center ${isMobile ? 'p-1.5' : 'p-2'} text-gray-400 bg-gray-700/30`}>넉아웃</th>
                            <th className={`text-center ${isMobile ? 'p-1.5' : 'p-2'} text-gray-400 bg-gray-700/30`}>점수</th>
                            <th className={`text-center ${isMobile ? 'p-1.5' : 'p-2'} text-gray-400 bg-gray-700/30 border-l-2 border-gray-600`}>공격성공</th>
                            <th className={`text-center ${isMobile ? 'p-1.5' : 'p-2'} text-gray-400 bg-gray-700/30`}>넉아웃</th>
                            <th className={`text-center ${isMobile ? 'p-1.5' : 'p-2'} text-gray-400 bg-gray-700/30`}>점수</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: totalRounds }, (_, i) => i + 1).map(roundNum => {
                            const roundData = history.find((r: AlkkagiRoundHistoryEntry) => r.round === roundNum);
                            const blackWin = roundData ? roundData.winnerId === blackPlayerId : false;
                            const whiteWin = roundData ? roundData.winnerId === whitePlayerId : false;
                            const blackKnockout = roundData?.blackKnockout ?? 0;
                            const whiteKnockout = roundData?.whiteKnockout ?? 0;
                            return (
                                <tr key={roundNum} className="border-b border-gray-700/50">
                                    <td className={`font-semibold ${isMobile ? 'p-1.5' : 'p-2'} bg-gray-800/30`}>{roundNum}R</td>
                                    <td className={`text-center ${isMobile ? 'p-1.5' : 'p-2'} bg-gray-700/20 border-l-2 border-gray-600 text-gray-500`}>-</td>
                                    <td className={`text-center ${isMobile ? 'p-1.5' : 'p-2'} bg-gray-700/20`}>{blackKnockout}</td>
                                    <td className={`text-center ${isMobile ? 'p-1.5' : 'p-2'} bg-gray-700/20`}>{blackWin ? 1 : 0}</td>
                                    <td className={`text-center ${isMobile ? 'p-1.5' : 'p-2'} bg-gray-700/20 border-l-2 border-gray-600 text-gray-500`}>-</td>
                                    <td className={`text-center ${isMobile ? 'p-1.5' : 'p-2'} bg-gray-700/20`}>{whiteKnockout}</td>
                                    <td className={`text-center ${isMobile ? 'p-1.5' : 'p-2'} bg-gray-700/20`}>{whiteWin ? 1 : 0}</td>
                                </tr>
                            );
                        })}
                        <tr className="border-t-2 border-gray-500 font-bold">
                            <td className={`${isMobile ? 'p-1.5' : 'p-2'} bg-gray-800/50`}>최종</td>
                            <td className={`text-center ${isMobile ? 'p-1.5' : 'p-2'} bg-gray-700/30 border-l-2 border-gray-600 text-gray-500`} colSpan={2}>-</td>
                            <td className={`text-center text-yellow-300 ${isMobile ? 'p-1.5' : 'p-2'} bg-gray-700/30`}>{blackWins}승</td>
                            <td className={`text-center ${isMobile ? 'p-1.5' : 'p-2'} bg-gray-700/30 border-l-2 border-gray-600 text-gray-500`} colSpan={2}>-</td>
                            <td className={`text-center text-yellow-300 ${isMobile ? 'p-1.5' : 'p-2'} bg-gray-700/30`}>{whiteWins}승</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            {winner !== null && winner !== Player.None && (
                <p className={`${isMobile ? 'text-sm' : 'text-base'} font-bold text-green-400`} style={{ fontSize: isMobile ? `${12 * mobileTextScale}px` : undefined }}>
                    {winner === Player.Black ? blackPlayer.nickname : whitePlayer.nickname} 승리!
                </p>
            )}
        </div>
    );
};


const GameSummaryModal: React.FC<GameSummaryModalProps> = ({ session, currentUser, onConfirm, onAction, onOpenGameRecordList, isSpectator = false }) => {
    const { winner, player1, player2, blackPlayerId, whitePlayerId, winReason } = session;
    const soundPlayed = useRef(false);
    // PC 레이아웃을 기준으로 렌더링합니다.
    const isMobile = false;

    const isWinner = getIsWinner(session, currentUser);
    const mySummary = session.summary?.[currentUser.id];
    const isGuildWar = isGuildWarLiveSession(session as any);
    const guildWarStars = mySummary?.guildWarStars ?? 0;
    const guildWarHouseScore = useMemo(() => {
        if (!isGuildWar) return undefined;
        const humanEnum = currentUser.id === blackPlayerId ? Player.Black : Player.White;
        const s = computeGuildWarAttemptMetrics(session as any, humanEnum, isWinner === true).score;
        return typeof s === 'number' && !Number.isNaN(s) ? s : undefined;
    }, [isGuildWar, currentUser.id, blackPlayerId, session, isWinner]);
    const blackTurnLimit = Number((session.settings as any)?.blackTurnLimit ?? 0);
    const blackMoves = (session.moveHistory || []).filter(m => m.player === Player.Black && m.x !== -1 && m.y !== -1).length;
    const isGuildWarCaptureTurnLimitLoss =
        isGuildWar &&
        session.mode === GameMode.Capture &&
        blackTurnLimit > 0 &&
        blackMoves >= blackTurnLimit &&
        winner === Player.White;
    const isPlayful = PLAYFUL_GAME_MODES.some((m: {mode: GameMode}) => m.mode === session.mode);
    const isStrategic = SPECIAL_GAME_MODES.some((m: {mode: GameMode}) => m.mode === session.mode);
    const canUseGameRecordUi = canSaveStrategicPvpGameRecord(session) && !isSpectator;
    const { recordAlreadySaved, setSavedOptimistic } = useGameRecordSaveLock(session.id, currentUser.savedGameRecords);
    const recordCount = currentUser.savedGameRecords?.length ?? 0;
    const [savingRecord, setSavingRecord] = useState(false);

    const avatarUrl = useMemo(() => AVATAR_POOL.find((a: AvatarInfo) => a.id === currentUser.avatarId)?.url, [currentUser.avatarId]);
    const borderUrl = useMemo(() => BORDER_POOL.find((b: BorderInfo) => b.id === currentUser.borderId)?.url, [currentUser.borderId]);
    
    // 모바일 텍스트 크기 조정
    const mobileTextScale = isMobile ? 1.15 : 1;
    const mobileImageScale = isMobile ? 0.7 : 1;

    useEffect(() => {
        if (soundPlayed.current) return;
        
        if (isWinner === true) audioService.gameWin();
        else if (isWinner === false) audioService.gameLose();
        
        if (mySummary) {
            if (mySummary.level && mySummary.level.initial < mySummary.level.final) {
                setTimeout(() => audioService.levelUp(), 800);
            }
            if (mySummary.manner && getMannerRank(mySummary.manner.initial) !== getMannerRank(mySummary.manner.final)) {
                 setTimeout(() => audioService.levelUp(), 900);
            }
        }
        
        soundPlayed.current = true;
    }, [isWinner, mySummary]);
    
    const isDraw = winner === Player.None;
    const winnerUser = winner === Player.Black 
        ? (player1.id === blackPlayerId ? player1 : player2)
        : (winner === Player.White ? (player1.id === whitePlayerId ? player1 : player2) : null);

    const { title, color } = useMemo(() => {
        if (isDraw) return { title: "무승부", color: 'text-yellow-400' };

        // For spectators or when winner info is not yet available
        if (isWinner === null) {
            if (winnerUser) {
                return { title: `${winnerUser.nickname} 승리`, color: "text-gray-300" };
            }
            return { title: "게임 종료", color: 'text-gray-300' };
        }

        // For players
        if (isWinner) {
            let title = '승리';
            if (winReason === 'resign') title = '기권승';
            if (winReason === 'capture_limit' && isGuildWarCaptureTurnLimitLoss) title = '턴승';
            if (winReason === 'timeout') title = isGuildWarCaptureTurnLimitLoss ? '턴승' : '시간승';
            return { title, color: 'text-green-400' };
        } else {
            let title = '패배';
            if (winReason === 'resign') title = '기권패';
            if (winReason === 'capture_limit' && isGuildWarCaptureTurnLimitLoss) title = '턴패';
            if (winReason === 'timeout') title = isGuildWarCaptureTurnLimitLoss ? '턴패' : '시간패';
            return { title, color: 'text-red-400' };
        }
    }, [isWinner, isDraw, winReason, winnerUser, isGuildWarCaptureTurnLimitLoss]);
    
    const analysisResult = session.analysisResult?.['system']; // System analysis is used for final scores

    // 경기 결과 모달이 열린 뒤에는 경기장 쪽 시간 초기화나 상태 변경이 있더라도
    // "경기 시간/소요 시간"이 변하지 않도록, 처음 계산한 값을 ref에 고정한다.
    const gameDurationRef = useRef<string | null>(null);
    if (gameDurationRef.current === null) {
        const startTime = session.gameStartTime ?? (session as any).startTime ?? session.createdAt;
        const inferredEndTime = (session.gameStatus === 'ended' || session.gameStatus === 'no_contest')
            ? ((session as any).endTime ?? session.turnStartTime ?? Date.now())
            : Date.now();
        const elapsedMs = Math.max(0, inferredEndTime - startTime);
        const totalSeconds = Math.floor(elapsedMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        gameDurationRef.current = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    const renderGameContent = () => {
        const totalMoves = session.moveHistory?.length ?? 0;
        const formattedElapsed = gameDurationRef.current!;
        const isAiOrPve = !!session.isAiGame || !!session.isSinglePlayer || session.gameCategory === 'tower' || session.gameCategory === 'singleplayer';
        const timeLabel = isAiOrPve ? '소요 시간' : '경기 시간';
        const blackPlayer = player1.id === blackPlayerId ? player1 : player2;
        const whitePlayer = player1.id === whitePlayerId ? player1 : player2;

        if (isPlayful && winReason === 'resign') {
            const message = isWinner ? "상대방의 기권으로 승리했습니다." : "기권 패배했습니다.";
            return <p className={`text-center ${isMobile ? 'text-sm' : 'text-lg'}`} style={{ fontSize: isMobile ? `${12 * mobileTextScale}px` : undefined }}>{message}</p>;
        }

        if (winReason === 'capture_limit' && isGuildWarCaptureTurnLimitLoss) {
            if (isWinner) {
                return <p className={`text-center ${isMobile ? 'text-sm' : 'text-lg'} text-green-400`} style={{ fontSize: isMobile ? `${12 * mobileTextScale}px` : undefined }}>상대방의 제한 턴이 모두 소진되어 승리했습니다.</p>;
            }
            return <p className={`text-center ${isMobile ? 'text-sm' : 'text-lg'} text-red-400`} style={{ fontSize: isMobile ? `${12 * mobileTextScale}px` : undefined }}>제한 턴이 다 되어 패배했습니다.</p>;
        }
        
        // 시간 패배/승리 처리
        if (winReason === 'timeout') {
            if (!isWinner) {
                if (isGuildWarCaptureTurnLimitLoss) {
                    return <p className={`text-center ${isMobile ? 'text-sm' : 'text-lg'} text-red-400`} style={{ fontSize: isMobile ? `${12 * mobileTextScale}px` : undefined }}>제한 턴이 다 되어 패배했습니다.</p>;
                }
                // 패배한 경우
                if (session.stageId) {
                    // stageId가 있으면 제한 턴 체크
                    const isTower = session.gameCategory === 'tower';
                    if (isTower) {
                        try {
                            const currentStage = TOWER_STAGES.find((s: any) => s.id === session.stageId);
                            if (currentStage?.blackTurnLimit) {
                                return <p className={`text-center ${isMobile ? 'text-sm' : 'text-lg'} text-red-400`} style={{ fontSize: isMobile ? `${12 * mobileTextScale}px` : undefined }}>제한 턴이 다 되어 패배했습니다.</p>;
                            }
                        } catch (e) {
                            console.error('[GameSummaryModal] Error loading TOWER_STAGES:', e);
                        }
                    } else if (session.isSinglePlayer) {
                        try {
                            const currentStage = SINGLE_PLAYER_STAGES.find((s: any) => s.id === session.stageId);
                            if (currentStage?.blackTurnLimit) {
                                return <p className={`text-center ${isMobile ? 'text-sm' : 'text-lg'} text-red-400`} style={{ fontSize: isMobile ? `${12 * mobileTextScale}px` : undefined }}>제한 턴이 다 되어 패배했습니다.</p>;
                            }
                        } catch (e) {
                            console.error('[GameSummaryModal] Error loading SINGLE_PLAYER_STAGES:', e);
                        }
                    }
                }
                // 일반 게임에서 시간 패배한 경우
                return <p className={`text-center ${isMobile ? 'text-sm' : 'text-lg'} text-red-400`} style={{ fontSize: isMobile ? `${12 * mobileTextScale}px` : undefined }}>시간이 다 되어 패배했습니다.</p>;
            } else {
                if (isGuildWarCaptureTurnLimitLoss) {
                    return <p className={`text-center ${isMobile ? 'text-sm' : 'text-lg'} text-green-400`} style={{ fontSize: isMobile ? `${12 * mobileTextScale}px` : undefined }}>상대방의 제한 턴이 모두 소진되어 승리했습니다.</p>;
                }
                // 승리한 경우
                return <p className={`text-center ${isMobile ? 'text-sm' : 'text-lg'} text-green-400`} style={{ fontSize: isMobile ? `${12 * mobileTextScale}px` : undefined }}>상대방의 시간이 다 되어 승리했습니다.</p>;
            }
        }
        
        // 따내기 바둑: 따낸 점수를 이미지로 표시
        const isCaptureMode = session.mode === GameMode.Capture;
        const isMixWithCapture = session.mode === GameMode.Mix && session.settings.mixedModes && 
            session.settings.mixedModes.includes(GameMode.Capture);
        
        if (isCaptureMode || isMixWithCapture) {
            return <CaptureScoreDetailsComponent session={session} isMobile={isMobile} mobileTextScale={mobileTextScale} mobileImageScale={mobileImageScale} />;
        }
        
        // 스피드 바둑, 베이스 바둑, 히든 바둑, 미사일 바둑, 믹스룰 바둑: 계가 결과 표시
        const strategicModesWithScoring = [GameMode.Speed, GameMode.Base, GameMode.Hidden, GameMode.Missile];
        const isMixWithStrategic = session.mode === GameMode.Mix && session.settings.mixedModes && 
            session.settings.mixedModes.some((m: GameMode) => strategicModesWithScoring.includes(m));
        
        if (strategicModesWithScoring.includes(session.mode) || isMixWithStrategic || session.mode === GameMode.Mix) {
            if (winReason === 'score' && analysisResult) {
                return (
                    <div className="w-full">
                        <ScoreDetailsComponent analysis={analysisResult} session={session} isMobile={isMobile} mobileTextScale={mobileTextScale} />
                    </div>
                );
            }
            if (winReason === 'score') {
                return <p className={`text-center text-gray-400 animate-pulse ${isMobile ? 'text-xs' : ''}`} style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}>점수 계산 중...</p>;
            }
        }
        
        if (winReason === 'score') {
            if (analysisResult) {
                return (
                    <div className="w-full">
                        <ScoreDetailsComponent analysis={analysisResult} session={session} isMobile={isMobile} mobileTextScale={mobileTextScale} />
                    </div>
                );
            }
            return <p className={`text-center text-gray-400 animate-pulse ${isMobile ? 'text-xs' : ''}`} style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}>점수 계산 중...</p>;
        }
        if (session.mode === GameMode.Dice || session.mode === GameMode.Thief) return <PlayfulScoreDetailsComponent gameSession={session} isMobile={isMobile} mobileTextScale={mobileTextScale} />;
        if (session.mode === GameMode.Curling) return <CurlingScoreDetailsComponent gameSession={session} isMobile={isMobile} mobileTextScale={mobileTextScale} mobileImageScale={mobileImageScale} />;
        if (session.mode === GameMode.Omok || session.mode === GameMode.Ttamok) {
            let message = '';
            if (winReason === 'omok_win') {
                message = isWinner ? '오목 완성' : '상대방 오목 완성';
            } else if (winReason === 'capture_limit') {
                message = isWinner ? '목표 따내기 완료' : '상대방 목표 따내기 완료';
            }
            if (message) {
                return <p className={`text-center ${isMobile ? 'text-lg' : 'text-2xl'} font-bold`} style={{ fontSize: isMobile ? `${16 * mobileTextScale}px` : undefined }}>{message}</p>;
            }
        }
        if (session.mode === GameMode.Alkkagi) {
            return <AlkkagiScoreDetailsComponent gameSession={session} isMobile={isMobile} mobileTextScale={mobileTextScale} />;
        }
        return (
            <div className="flex flex-col gap-2 sm:gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-2 text-sm sm:text-base">
                    <div className="bg-gray-800/40 rounded-md px-2 py-1.5 flex justify-between items-center">
                        <span className="text-gray-300" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : undefined }}>흑</span>
                        <span className="font-semibold" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : undefined }}>{blackPlayer.nickname}</span>
                    </div>
                    <div className="bg-gray-800/40 rounded-md px-2 py-1.5 flex justify-between items-center">
                        <span className="text-gray-300" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : undefined }}>백</span>
                        <span className="font-semibold" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : undefined }}>{whitePlayer.nickname}</span>
                    </div>
                    <div className="bg-gray-800/40 rounded-md px-2 py-1.5 flex justify-between items-center">
                        <span className="text-gray-300" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : undefined }}>총 수순</span>
                        <span className="font-semibold" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : undefined }}>{totalMoves}수</span>
                    </div>
                    <div className="bg-gray-800/40 rounded-md px-2 py-1.5 flex justify-between items-center">
                        <span className="text-gray-300" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : undefined }}>{timeLabel}</span>
                        <span className="font-semibold" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : undefined }}>{formattedElapsed}</span>
                    </div>
                </div>
                <p className={`text-center text-gray-400 ${isMobile ? 'text-xs' : ''}`} style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}>
                    특별한 경기 내용이 없습니다.
                </p>
            </div>
        );
    }

    const renderGuildWarStarConditions = () => {
        if (!isGuildWar) return null;
        const boardId = (session as any).guildWarBoardId as string | undefined;
        const mode = getGuildWarBoardMode(boardId ?? 'top-left');
        const humanWon = isWinner === true;
        const humanEnum = currentUser.id === blackPlayerId ? Player.Black : Player.White;
        const metrics = computeGuildWarAttemptMetrics(session as any, humanEnum as any, humanWon);
        const maxSingleCapture = metrics.maxSingleCapture ?? 0;
        const scoreDiff = metrics.scoreDiff ?? 0;
        const scoreT2 = getGuildWarStarScoreTier2MinDiff(boardId);
        const scoreT3 = getGuildWarStarScoreTier3MinDiff(boardId);

        const rows =
            mode === 'capture'
                ? [
                    { label: '승리', ok: humanWon },
                    { label: `한 번에 ${GUILD_WAR_STAR_CAPTURE_TIER2_MIN}돌 따내기`, ok: humanWon && maxSingleCapture >= GUILD_WAR_STAR_CAPTURE_TIER2_MIN },
                    { label: `한 번에 ${GUILD_WAR_STAR_CAPTURE_TIER3_MIN}돌 따내기`, ok: humanWon && maxSingleCapture >= GUILD_WAR_STAR_CAPTURE_TIER3_MIN },
                ]
                : [
                    { label: '승리', ok: humanWon },
                    { label: `집차이 ${scoreT2}집 이상`, ok: humanWon && scoreDiff >= scoreT2 },
                    { label: `집차이 ${scoreT3}집 이상`, ok: humanWon && scoreDiff >= scoreT3 },
                ];

        return (
            <div className="mt-2 rounded-md border border-amber-500/35 bg-amber-900/10 p-2">
                <p className="text-[11px] text-amber-200/90 font-semibold mb-1">별 달성 조건</p>
                <div className="space-y-1">
                    {rows.map((row) => (
                        <div key={row.label} className="flex items-center justify-between text-xs">
                            <span className="text-gray-200">{row.label}</span>
                            <span className={row.ok ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                                {row.ok ? '성공' : '실패'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const initialMannerRank = mySummary ? getMannerRank(mySummary.manner.initial) : '';
    const finalMannerRank = mySummary ? getMannerRank(mySummary.manner.final) : '';

    const recordBtnBase =
        'relative overflow-hidden rounded-xl text-sm font-semibold tracking-wide transition-all duration-200 border focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0f14] disabled:opacity-45 disabled:pointer-events-none disabled:cursor-not-allowed';
    const recordSaveClass =
        `${recordBtnBase} px-4 py-2.5 border-amber-500/40 bg-gradient-to-br from-slate-800 via-slate-900 to-zinc-950 text-amber-50/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_8px_28px_-10px_rgba(251,191,36,0.2)] hover:border-amber-400/55 hover:shadow-[0_12px_32px_-12px_rgba(251,191,36,0.28)] active:translate-y-px focus-visible:ring-amber-400/45`;
    const recordManageClass =
        `${recordBtnBase} px-4 py-2.5 border-cyan-500/35 bg-gradient-to-br from-slate-900/95 via-slate-950 to-[#06080d] text-cyan-50/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_6px_22px_-8px_rgba(34,211,238,0.12)] hover:border-cyan-400/45 hover:shadow-[0_10px_28px_-10px_rgba(34,211,238,0.18)] active:translate-y-px focus-visible:ring-cyan-400/40`;

    return (
        <DraggableWindow title={isGuildWar ? '길드 전쟁 결과' : '대국 결과'} onClose={onConfirm} initialWidth={isMobile ? 600 : 1000} windowId="game-summary">
            <div className={`text-white ${isMobile ? 'text-xs' : 'text-[clamp(0.75rem,2.5vw,1rem)]'} flex flex-col`}>
                <h1 className={`${isMobile ? 'text-lg' : 'text-2xl'} font-black text-center mb-2 sm:mb-3 tracking-widest ${color} flex-shrink-0`} style={{ fontSize: isMobile ? `${16 * mobileTextScale}px` : undefined }}>{title}</h1>
                {isGuildWar && (
                    <div className="flex flex-col items-center gap-1.5 mb-3 flex-shrink-0">
                        <div className="flex justify-center items-center gap-1.5" aria-label={`획득 별 ${guildWarStars}개`}>
                            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mr-1">획득 별</span>
                            {[0, 1, 2].map((i) => (
                                <img
                                    key={i}
                                    src={i < guildWarStars ? '/images/guild/guildwar/clearstar.png' : '/images/guild/guildwar/emptystar.png'}
                                    alt=""
                                    className="w-9 h-9 sm:w-10 sm:h-10 object-contain drop-shadow"
                                />
                            ))}
                            <span className="text-sm font-bold text-amber-100/95 tabular-nums ml-1">{guildWarStars}/3</span>
                        </div>
                        {guildWarHouseScore !== undefined && (
                            <div className="flex items-baseline justify-center gap-1.5 text-sm">
                                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">획득 집점수</span>
                                <span className="font-bold text-cyan-200/95 tabular-nums">
                                    {Number.isInteger(guildWarHouseScore) ? guildWarHouseScore : guildWarHouseScore.toFixed(1)}집
                                </span>
                            </div>
                        )}
                    </div>
                )}
                
                <div className={`flex flex-row gap-2 sm:gap-3`}>
                    {/* Left Panel: Game Content */}
                    <div className={`w-1/2 bg-gray-900/50 ${isMobile ? 'p-2' : 'p-3'} rounded-lg flex flex-col`}>
                        <h2 className={`${isMobile ? 'text-xs' : 'text-base'} font-bold text-center text-gray-200 mb-2 border-b border-gray-700 pb-1 flex-shrink-0`} style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}>경기 내용</h2>
                        <div>
                            {renderGameContent()}
                            {renderGuildWarStarConditions()}
                        </div>
                    </div>
                    
                    {/* Right Panel: 내 대국 결과 & 보상 (전략/놀이바둑 공통 항상 표시, 보상 없을 때도 동일 UI) */}
                    <div className={`w-1/2 flex flex-col gap-2 sm:gap-3`}>
                            <div className={`bg-gray-900/50 ${isMobile ? 'p-2' : 'p-3'} rounded-lg flex flex-col gap-1`}>
                                <h2 className={`${isMobile ? 'text-xs' : 'text-base'} font-bold text-center text-gray-200 mb-2 border-b border-gray-700 pb-1`} style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}>{isGuildWar ? '보상·기록' : '내 대국 결과'}</h2>
                                <div className="flex items-center gap-1.5 sm:gap-2">
                                    <Avatar userId={currentUser.id} userName={currentUser.nickname} size={isMobile ? Math.round(24 * mobileImageScale) : 48} avatarUrl={avatarUrl} borderUrl={borderUrl} />
                                    <div>
                                        <p className={`font-bold`} style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}>{currentUser.nickname}</p>
                                        <p className={`text-gray-400`} style={{ fontSize: isMobile ? `${8 * mobileTextScale}px` : undefined }}>
                                            {isPlayful ? '놀이' : '전략'} Lv.{mySummary?.level ? mySummary.level.final : (isPlayful ? currentUser.playfulLevel : currentUser.strategyLevel)}
                                        </p>
                                    </div>
                                </div>
                                {mySummary?.level ? (
                                    <div className="flex-shrink-0">
                                        <XpBar
                                            initial={mySummary.level.progress.initial}
                                            final={mySummary.level.progress.final}
                                            max={mySummary.level.progress.max}
                                            levelUp={mySummary.level.initial < mySummary.level.final}
                                            xpGain={mySummary.xp?.change ?? 0}
                                            finalLevel={mySummary.level.final}
                                            isMobile={isMobile}
                                            mobileTextScale={mobileTextScale}
                                        />
                                    </div>
                                ) : (
                                    <div className="flex-shrink-0">
                                        <div className={`flex items-center ${isMobile ? 'gap-1.5' : 'gap-3'}`}>
                                            <span className={`${isMobile ? 'text-xs w-12' : 'text-sm w-16'} font-bold text-right`} style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}>경험치</span>
                                            <div className={`w-full bg-gray-700/50 rounded-full ${isMobile ? 'h-3' : 'h-4'} relative border border-gray-900/50 overflow-hidden flex items-center justify-center`}>
                                                <span className={`${isMobile ? 'text-[9px]' : 'text-xs'} font-bold text-gray-400`} style={{ fontSize: isMobile ? `${8 * mobileTextScale}px` : undefined }}>
                                                    0 XP
                                                </span>
                                            </div>
                                            <span className={`${isMobile ? 'text-xs w-14' : 'text-sm w-20'} font-bold text-gray-400 whitespace-nowrap`} style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}>
                                                +0 XP
                                            </span>
                                        </div>
                                    </div>
                                )}
                                {isGuildWar ? (
                                    <p className="text-center text-[11px] text-slate-400 leading-snug px-1">
                                        길드 전쟁 AI 대국은 랭킹·매너 변동이 없으며, 별과 모드에 따라 골드만 지급됩니다.
                                    </p>
                                ) : mySummary ? (
                                    <div className={`grid grid-cols-2 gap-1 text-center`}>
                                        <div className={`bg-gray-800 ${isMobile ? 'p-1' : 'p-2'} rounded-md flex flex-col gap-0.5 leading-tight`}>
                                            <p className="text-gray-400" style={{ fontSize: isMobile ? `${7 * mobileTextScale}px` : undefined }}>랭킹 점수</p>
                                            <p className={`font-semibold text-white`} style={{ fontSize: isMobile ? `${8 * mobileTextScale}px` : undefined }}>
                                                {mySummary.rating.final}{' '}
                                                <span className={mySummary.rating.change >= 0 ? 'text-green-400' : 'text-red-400'}>
                                                    ({mySummary.rating.change > 0 ? '+' : ''}{mySummary.rating.change})
                                                </span>
                                            </p>
                                        </div>
                                        <div className={`bg-gray-800 ${isMobile ? 'p-1' : 'p-2'} rounded-md flex flex-col gap-0.5 leading-tight`}>
                                            <p className="text-gray-400" style={{ fontSize: isMobile ? `${7 * mobileTextScale}px` : undefined }}>매너 점수 변동</p>
                                            <p className={`font-semibold ${mySummary.manner.change === 0 ? 'text-white' : mySummary.manner.change > 0 ? 'text-green-400' : 'text-red-400'}`} style={{ fontSize: isMobile ? `${8 * mobileTextScale}px` : undefined }}>
                                                {mySummary.manner.change > 0 ? '+' : ''}{mySummary.manner.change}
                                            </p>
                                        </div>
                                        <div className={`bg-gray-800 ${isMobile ? 'p-1' : 'p-2'} rounded-md flex flex-col gap-0.5 leading-tight`}>
                                            <p className="text-gray-400" style={{ fontSize: isMobile ? `${7 * mobileTextScale}px` : undefined }}>통산 전적</p>
                                            <p className={`font-semibold text-white`} style={{ fontSize: isMobile ? `${8 * mobileTextScale}px` : undefined }}>{mySummary.overallRecord?.wins}승 {mySummary.overallRecord?.losses}패</p>
                                        </div>
                                        <div className={`bg-gray-800 ${isMobile ? 'p-1' : 'p-2'} rounded-md flex flex-col gap-0.5 leading-tight`}>
                                            <p className="text-gray-400" style={{ fontSize: isMobile ? `${7 * mobileTextScale}px` : undefined }}>매너 등급</p>
                                            <p className={`font-semibold text-white`} style={{ fontSize: isMobile ? `${8 * mobileTextScale}px` : undefined }}>{initialMannerRank} &rarr; {finalMannerRank}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className={`grid grid-cols-2 gap-1 text-center opacity-70`}>
                                        <div className={`bg-gray-800 ${isMobile ? 'p-1' : 'p-2'} rounded-md flex flex-col gap-0.5 leading-tight`}>
                                            <p className="text-gray-400" style={{ fontSize: isMobile ? `${7 * mobileTextScale}px` : undefined }}>랭킹 점수</p>
                                            <p className={`font-semibold text-gray-500`} style={{ fontSize: isMobile ? `${8 * mobileTextScale}px` : undefined }}>-</p>
                                        </div>
                                        <div className={`bg-gray-800 ${isMobile ? 'p-1' : 'p-2'} rounded-md flex flex-col gap-0.5 leading-tight`}>
                                            <p className="text-gray-400" style={{ fontSize: isMobile ? `${7 * mobileTextScale}px` : undefined }}>매너 점수</p>
                                            <p className={`font-semibold text-gray-500`} style={{ fontSize: isMobile ? `${8 * mobileTextScale}px` : undefined }}>-</p>
                                        </div>
                                        <div className={`bg-gray-800 ${isMobile ? 'p-1' : 'p-2'} rounded-md flex flex-col gap-0.5 leading-tight col-span-2`}>
                                            <p className="text-gray-400" style={{ fontSize: isMobile ? `${7 * mobileTextScale}px` : undefined }}>통산 전적</p>
                                            <p className={`font-semibold text-gray-500`} style={{ fontSize: isMobile ? `${8 * mobileTextScale}px` : undefined }}>-</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className={`bg-gray-900/50 ${isMobile ? 'p-2' : 'p-3'} rounded-lg space-y-2 flex-shrink-0`}>
                                <h2 className={`${isMobile ? 'text-xs' : 'text-base'} font-bold text-center text-gray-200 border-b border-gray-700 pb-1 mb-2`} style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}>{isGuildWar ? '길드 전쟁 보상' : '획득 보상'}</h2>
                                <div className={`flex gap-1.5 sm:gap-3 justify-center items-stretch`}>
                                    <div className={`${isMobile ? 'w-16 h-16' : 'w-32 h-32'} bg-gradient-to-br from-yellow-600/30 to-yellow-800/30 border-2 border-yellow-500/50 rounded-lg flex flex-col items-center justify-center ${isMobile ? 'p-1' : 'p-2'} shadow-lg`}>
                                        <img src="/images/icon/Gold.png" alt="골드" className={`${isMobile ? 'w-5 h-5' : 'w-12 h-12'} mb-0.5`} />
                                        <p className={`font-bold text-yellow-300 text-center`} style={{ fontSize: isMobile ? `${7 * mobileTextScale}px` : undefined }}>
                                            {(mySummary?.gold ?? 0).toLocaleString()}
                                        </p>
                                    </div>
                                    {mySummary?.items && mySummary.items.length > 0 ? (
                                        <div className={`flex flex-wrap gap-1 ${isMobile ? 'w-16' : 'w-32'} justify-center`}>
                                            {mySummary.items.slice(0, 3).map((item: InventoryItem, idx: number) => {
                                                const itemTemplate = CONSUMABLE_ITEMS.find((ci: { name: string; }) => ci.name === item.name);
                                                return (
                                                    <div key={idx} className={`${isMobile ? 'w-14 h-14' : 'w-28 h-28'} bg-gradient-to-br from-purple-600/30 to-purple-800/30 border-2 border-purple-500/50 rounded-lg flex flex-col items-center justify-center ${isMobile ? 'p-1' : 'p-2'} shadow-lg`}>
                                                        {itemTemplate?.image && (
                                                            <img src={itemTemplate.image} alt={item.name} className={`${isMobile ? 'w-6 h-6' : 'w-12 h-12'} mb-0.5 object-contain`} />
                                                        )}
                                                        <p className={`font-semibold text-purple-300 text-center leading-tight`} style={{ fontSize: isMobile ? `${5 * mobileTextScale}px` : undefined }}>{item.name}</p>
                                                    </div>
                                                );
                                            })}
                                            {mySummary.items.length > 3 && (
                                                <div className={`${isMobile ? 'w-14 h-14' : 'w-28 h-28'} bg-gray-800/50 border-2 border-gray-700/50 rounded-lg flex items-center justify-center ${isMobile ? 'p-1' : 'p-2'}`}>
                                                    <p className={`text-gray-400 text-center`} style={{ fontSize: isMobile ? `${5 * mobileTextScale}px` : undefined }}>+{mySummary.items.length - 3}</p>
                                                </div>
                                            )}
                                        </div>
                                    ) : isGuildWar && (mySummary?.gold ?? 0) > 0 ? null : (
                                        <div className={`${isMobile ? 'w-16 h-16' : 'w-32 h-32'} bg-gray-800/50 border-2 border-gray-700/50 rounded-lg flex flex-col items-center justify-center ${isMobile ? 'p-1' : 'p-2'} shadow-lg gap-1`}>
                                            <p className={`text-gray-500 text-center font-semibold ${isMobile ? 'text-[8px]' : 'text-xs'}`} style={{ fontSize: isMobile ? `${7 * mobileTextScale}px` : undefined }}>보상 없음</p>
                                            <p className={`text-gray-500 text-center ${isMobile ? 'text-[6px]' : 'text-[10px]'}`} style={{ fontSize: isMobile ? `${6 * mobileTextScale}px` : undefined }}>
                                                {isGuildWar
                                                    ? '별을 획득하지 못해 골드가 지급되지 않았습니다.'
                                                    : (session.isAiGame || !session.gameCategory)
                                                      ? 'AI 대국·친선전은 보상이 지급되지 않습니다.'
                                                      : '이 경기에서는 보상이 없습니다.'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                </div>
                 
                <div className="mt-4 flex w-full flex-shrink-0 flex-row flex-wrap items-center justify-center gap-2 sm:gap-3">
                    {canUseGameRecordUi && onAction && (
                        <button
                            type="button"
                            className={`${recordSaveClass} ${isMobile ? '!text-xs !py-2 !px-3' : ''}`}
                            style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}
                            disabled={savingRecord || recordAlreadySaved}
                            onClick={async () => {
                                if (savingRecord || recordAlreadySaved) return;
                                if (recordCount >= 10) {
                                    alert(GAME_RECORD_SLOT_FULL_MESSAGE);
                                    return;
                                }
                                setSavingRecord(true);
                                try {
                                    const out = await onAction({ type: 'SAVE_GAME_RECORD', payload: { gameId: session.id } });
                                    if (out && typeof out === 'object' && 'error' in out && (out as { error?: string }).error) {
                                        alert((out as { error?: string }).error);
                                        return;
                                    }
                                    setSavedOptimistic(true);
                                } catch (error) {
                                    console.error('Failed to save game record:', error);
                                } finally {
                                    setSavingRecord(false);
                                }
                            }}
                        >
                            {savingRecord ? '저장 중...' : recordAlreadySaved ? '이미 저장됨' : '기보 저장'}
                        </button>
                    )}
                    {canUseGameRecordUi && onOpenGameRecordList && (
                        <button
                            type="button"
                            className={`${recordManageClass} ${isMobile ? '!text-xs !py-2 !px-3' : ''}`}
                            style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}
                            onClick={() => onOpenGameRecordList()}
                        >
                            기보 관리
                        </button>
                    )}
                    <Button
                        onClick={onConfirm}
                        className={`shrink-0 rounded-xl font-bold shadow-[0_6px_20px_-6px_rgba(251,191,36,0.35)] ${isMobile ? 'min-w-[6.5rem] py-2 text-xs' : 'min-w-[8.5rem] py-2.5 text-sm'}`}
                        style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}
                    >
                        확인
                    </Button>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default GameSummaryModal;
