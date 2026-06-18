import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LiveGameSession, ServerAction, UserWithStatus } from '../../types.js';
import Avatar from '../Avatar.js';
import { MAX_GAME_INTEGER_INPUT } from '../../shared/constants/numericLimits.js';
import { clampDigitsOnlyInputString } from '../../shared/utils/gameIntegerField.js';
import {
    type WaitingLobbyPanelTone,
    pairLobbyQuickJoinRoomNumberGoBtnClass,
    pairLobbyQuickJoinRoomNumberInputClass,
    pairLobbyQuickJoinRoomNumberRowClass,
    pairLobbyRoomJoinButtonClass,
    waitingLobbyGameListAdminFieldClass,
    waitingLobbyGameListAdminPopoverClass,
    waitingLobbyGameListDescriptionSnippetClass,
    waitingLobbyGameListEmptyHintClass,
    waitingLobbyGameListHeaderDividerClass,
    waitingLobbyGameListHeadingTextClass,
    waitingLobbyGameListOngoingRowClass,
    waitingLobbyGameListPanelRootClass,
    waitingLobbyGameListRoomIndexBadgeClass,
    waitingLobbyGameListVsTextClass,
} from './waitingLobbyHomePanelStyles.js';

interface GameListProps {
    games: LiveGameSession[];
    onAction: (a: ServerAction) => void;
    currentUser: UserWithStatus;
    /** 전략(시안) / 페어(바이올렛) / 놀이(앰버) — 지정 시 진행 대국 패널·행·버튼이 경기장 톤에 맞춤 */
    lobbyTone?: WaitingLobbyPanelTone;
    /** 전략·놀이 대기실 등: 패널 루트에 추가 클래스(예: backdrop-blur) */
    panelExtraClassName?: string;
    /** PC 홈형 패널 안에 넣을 때: 외곽 카드와 이중 테두리 방지 */
    embedInHomeLobbyPanel?: boolean;
    /** 네이티브 전략·놀이 대기실: 페어 경기장 모바일과 유사한 본문 글자 크기 */
    pairAlignedNativeCompact?: boolean;
}

const GameList: React.FC<GameListProps> = ({
    games,
    onAction,
    currentUser,
    lobbyTone,
    panelExtraClassName = '',
    embedInHomeLobbyPanel = false,
    pairAlignedNativeCompact = false,
}) => {
    const { t } = useTranslation('lobby');
    const [spectateRoomNumber, setSpectateRoomNumber] = useState('');
    const [adminMenuGameId, setAdminMenuGameId] = useState<string | null>(null);
    const [adminSearchQuery, setAdminSearchQuery] = useState('');
    const [selectedGameIds, setSelectedGameIds] = useState<string[]>([]);
    const adminMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (adminMenuRef.current && !adminMenuRef.current.contains(event.target as Node)) {
                setAdminMenuGameId(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleSpectateByNumber = () => {
        const roomNum = parseInt(spectateRoomNumber, 10);
        if (isNaN(roomNum) || roomNum < 1 || roomNum > games.length) {
            alert(t('gameList.invalidRoomNumber'));
            return;
        }
        const gameToSpectate = games[roomNum - 1];
        if (gameToSpectate) {
            onAction({ type: 'SPECTATE_GAME', payload: { gameId: gameToSpectate.id } });
        }
        setSpectateRoomNumber('');
    };
    
    const handleAdminMenu = (gameId: string) => {
        setAdminMenuGameId(prev => (prev === gameId ? null : gameId));
    };

    const handleSetDescription = (game: LiveGameSession) => {
        const newDescription = prompt(t('gameList.roomDescriptionPrompt'), game.description || "");
        if (newDescription !== null) {
            if (newDescription.length > 50) {
                alert(t('gameList.roomDescriptionTooLong'));
                return;
            }
            onAction({ type: 'ADMIN_SET_GAME_DESCRIPTION', payload: { gameId: game.id, description: newDescription } });
        }
        setAdminMenuGameId(null);
    };

    const handleDeleteGame = (game: LiveGameSession) => {
        if (window.confirm(t('gameList.forceEndConfirm', { player1: game.player1.nickname, player2: game.player2.nickname }))) {
            onAction({ type: 'ADMIN_FORCE_DELETE_GAME', payload: { gameId: game.id } });
            setSelectedGameIds(prev => prev.filter(id => id !== game.id));
        }
        setAdminMenuGameId(null);
    };

    const toggleSelectedGame = (gameId: string) => {
        setSelectedGameIds(prev => prev.includes(gameId) ? prev.filter(id => id !== gameId) : [...prev, gameId]);
    };

    const displayedGames = games.filter((game) => {
        if (!currentUser.isAdmin || !adminSearchQuery.trim()) return true;
        const q = adminSearchQuery.trim().toLowerCase();
        return (
            game.player1.nickname.toLowerCase().includes(q) ||
            game.player2.nickname.toLowerCase().includes(q) ||
            game.mode.toLowerCase().includes(q) ||
            game.id.toLowerCase().includes(q)
        );
    });

    const handleBatchDelete = () => {
        if (selectedGameIds.length === 0) {
            alert(t('gameList.selectGamesToEnd'));
            return;
        }
        if (!window.confirm(t('gameList.batchForceEndConfirm', { count: selectedGameIds.length }))) return;
        for (const gameId of selectedGameIds) {
            onAction({ type: 'ADMIN_FORCE_DELETE_GAME', payload: { gameId } });
        }
        setSelectedGameIds([]);
    };

    const rootShell = lobbyTone
        ? waitingLobbyGameListPanelRootClass(lobbyTone, embedInHomeLobbyPanel, pairAlignedNativeCompact)
        : embedInHomeLobbyPanel
          ? `rounded-xl border border-white/[0.08] bg-black/28 text-on-panel shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] flex flex-col min-h-0 h-full ${
                pairAlignedNativeCompact ? 'p-2 sm:p-3' : 'p-3 sm:p-4'
            }`
          : `bg-panel border border-color text-on-panel rounded-lg shadow-lg flex flex-col min-h-0 h-full ${
                pairAlignedNativeCompact ? 'p-2 sm:p-3' : 'p-4'
            }`;

    const headerDivider = lobbyTone ? waitingLobbyGameListHeaderDividerClass(lobbyTone) : 'border-color';
    const headingTitleClass = lobbyTone
        ? `${waitingLobbyGameListHeadingTextClass(lobbyTone)} ${pairAlignedNativeCompact ? 'text-sm sm:text-base' : 'text-xl'}`
        : `font-semibold ${pairAlignedNativeCompact ? 'text-sm sm:text-base' : 'text-xl'}`;

    const roomRowClass = lobbyTone ? waitingLobbyGameListOngoingRowClass(lobbyTone) : 'flex items-center justify-between p-2.5 bg-tertiary/50 rounded-lg';
    const vsClass = lobbyTone ? waitingLobbyGameListVsTextClass(lobbyTone) : 'text-tertiary font-bold';
    const avatarRing =
        lobbyTone === 'strategic'
            ? 'border-cyan-400/40'
            : lobbyTone === 'pair'
              ? 'border-violet-400/42'
              : lobbyTone === 'playful'
                ? 'border-amber-400/40'
                : 'border-color';

    return (
      <div
        className={[rootShell, embedInHomeLobbyPanel ? '' : panelExtraClassName].filter(Boolean).join(' ').trim()}
      >
        <div
            className={`flex flex-shrink-0 items-center justify-between border-b ${headerDivider} ${pairAlignedNativeCompact ? 'mb-2 pb-1.5' : 'mb-3 pb-2'}`}
        >
            <h2 className={headingTitleClass}>{t('gameList.ongoingGames')}</h2>
            <div className="flex items-center gap-1.5 sm:gap-2">
                {lobbyTone ? (
                    <div className={`${pairLobbyQuickJoinRoomNumberRowClass(lobbyTone)} overflow-hidden`}>
                        <input
                            type="number"
                            min={1}
                            max={MAX_GAME_INTEGER_INPUT}
                            placeholder={t('gameList.roomNumberPlaceholder')}
                            value={spectateRoomNumber}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === '') {
                                    setSpectateRoomNumber('');
                                    return;
                                }
                                setSpectateRoomNumber(clampDigitsOnlyInputString(val));
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSpectateByNumber();
                            }}
                            className={pairLobbyQuickJoinRoomNumberInputClass(lobbyTone, pairAlignedNativeCompact)}
                        />
                        <button
                            type="button"
                            onClick={handleSpectateByNumber}
                            className={pairLobbyQuickJoinRoomNumberGoBtnClass(lobbyTone, pairAlignedNativeCompact)}
                        >
                            {t('gameList.join')}
                        </button>
                    </div>
                ) : (
                    <>
                        <input
                            type="number"
                            min={1}
                            max={MAX_GAME_INTEGER_INPUT}
                            placeholder={t('gameList.roomNumberPlaceholder')}
                            value={spectateRoomNumber}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === '') {
                                    setSpectateRoomNumber('');
                                    return;
                                }
                                setSpectateRoomNumber(clampDigitsOnlyInputString(val));
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSpectateByNumber();
                            }}
                            className={`w-[5.5rem] bg-tertiary border border-color rounded-md text-center focus:ring-accent focus:border-accent sm:w-24 ${
                                pairAlignedNativeCompact ? 'p-1.5 text-[0.65rem] sm:text-xs' : 'p-2 text-sm'
                            }`}
                        />
                        <button
                            onClick={handleSpectateByNumber}
                            className={`shrink-0 rounded-lg bg-purple-600 px-2 py-1.5 font-bold text-white transition-colors hover:bg-purple-500 sm:px-4 sm:py-2 ${
                                pairAlignedNativeCompact ? 'text-[0.65rem] sm:text-xs' : 'text-sm'
                            }`}
                        >
                            {t('gameList.join')}
                        </button>
                    </>
                )}
            </div>
        </div>
        {currentUser.isAdmin && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
                <input
                    type="text"
                    value={adminSearchQuery}
                    onChange={(e) => setAdminSearchQuery(e.target.value)}
                    placeholder={t('gameList.adminSearchPlaceholder')}
                    className={
                        lobbyTone
                            ? waitingLobbyGameListAdminFieldClass(lobbyTone, pairAlignedNativeCompact)
                            : `flex-1 min-w-[220px] bg-tertiary border border-color rounded-md ${
                                  pairAlignedNativeCompact ? 'p-1.5 text-[0.65rem] sm:text-xs' : 'p-2 text-sm'
                              }`
                    }
                />
                <button
                    onClick={handleBatchDelete}
                    className={`rounded-md bg-red-700 px-3 py-2 font-bold text-white transition-colors hover:bg-red-600 ${
                        pairAlignedNativeCompact ? 'text-[0.65rem] sm:text-xs' : 'text-xs'
                    }`}
                >
                    {t('gameList.batchForceEndSelected', { count: selectedGameIds.length })}
                </button>
            </div>
        )}
        <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
          {displayedGames.length > 0 ? displayedGames.map((game, index) => {
            if (!game || !game.player1 || !game.player2) {
              return null;
            }
            return (
              <li key={game.id} className="relative">
                <div className={roomRowClass}>
                  <div className="flex items-center gap-3 flex-1 overflow-hidden">
                    {currentUser.isAdmin && (
                        <input
                            type="checkbox"
                            checked={selectedGameIds.includes(game.id)}
                            onChange={() => toggleSelectedGame(game.id)}
                            className="w-4 h-4"
                            title={t('gameList.batchForceEndTitle')}
                        />
                    )}
                    <div
                        className={
                            lobbyTone
                                ? waitingLobbyGameListRoomIndexBadgeClass(lobbyTone, currentUser.isAdmin)
                                : `flex-shrink-0 w-8 h-8 flex items-center justify-center bg-secondary rounded-full font-bold text-sm ${
                                      currentUser.isAdmin ? 'cursor-pointer hover:bg-tertiary transition-colors' : ''
                                  }`
                        }
                        onClick={currentUser.isAdmin ? () => handleAdminMenu(game.id) : undefined}
                        title={currentUser.isAdmin ? t('gameList.adminMenuTitle') : t('gameList.roomNumberTitle', { number: index + 1 })}
                    >
                        {index + 1}
                    </div>
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="text-center truncate">
                        <Avatar userId={game.player1.id} userName={game.player1.nickname} size={36} className={`border-2 mx-auto ${avatarRing}`} />
                        <span
                            className={`block truncate font-semibold ${
                                pairAlignedNativeCompact ? 'text-[0.65rem] sm:text-xs' : 'text-xs'
                            }`}
                        >
                            {game.player1.nickname}
                        </span>
                      </div>
                      <span className={vsClass}>vs</span>
                      <div className="text-center truncate">
                        <Avatar userId={game.player2.id} userName={game.player2.nickname} size={36} className={`border-2 mx-auto ${avatarRing}`} />
                        <span
                            className={`block truncate font-semibold ${
                                pairAlignedNativeCompact ? 'text-[0.65rem] sm:text-xs' : 'text-xs'
                            }`}
                        >
                            {game.player2.nickname}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {game.description && (
                        <div className={lobbyTone ? waitingLobbyGameListDescriptionSnippetClass(lobbyTone) : 'text-sm text-highlight truncate max-w-xs hidden md:block'} title={game.description}>
                            {game.description}
                        </div>
                    )}
                    <button
                        onClick={() => onAction({ type: 'SPECTATE_GAME', payload: { gameId: game.id } })}
                        className={
                            lobbyTone
                                ? `ml-2 shrink-0 ${pairLobbyRoomJoinButtonClass(lobbyTone, true)} ${
                                      pairAlignedNativeCompact ? 'px-2 py-1 text-[0.65rem] sm:text-xs' : 'px-3 py-1.5 text-sm'
                                  }`
                                : `ml-2 shrink-0 rounded-lg bg-purple-600 px-2 py-1 font-bold text-white transition-colors hover:bg-purple-500 sm:px-3 sm:py-1.5 ${
                                      pairAlignedNativeCompact ? 'text-[0.65rem] sm:text-xs' : 'text-sm'
                                  }`
                        }
                    >
                      {t('gameList.spectateAction')}
                    </button>
                    {currentUser.isAdmin && (
                        <>
                            <button onClick={() => handleSetDescription(game)} className="px-3 py-1.5 bg-yellow-700 hover:bg-yellow-600 text-white font-bold rounded-lg text-xs transition-colors shrink-0">
                                {t('gameList.roomContent')}
                            </button>
                            <button onClick={() => handleDeleteGame(game)} className="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white font-bold rounded-lg text-xs transition-colors shrink-0">
                                {t('gameList.forceEnd')}
                            </button>
                        </>
                    )}
                  </div>
                </div>
                {currentUser.isAdmin && adminMenuGameId === game.id && (
                    <div
                        ref={adminMenuRef}
                        className={lobbyTone ? waitingLobbyGameListAdminPopoverClass(lobbyTone) : 'absolute top-12 left-2 z-10 bg-secondary rounded-md shadow-lg p-2 space-y-2 w-48 border border-color'}
                    >
                        <button onClick={() => handleSetDescription(game)} className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-accent transition-colors">
                            {t('gameList.editRoomContent')}
                        </button>
                        <button onClick={() => handleDeleteGame(game)} className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-danger text-red-300 transition-colors">
                            {t('gameList.forceDeleteRoom')}
                        </button>
                    </div>
                )}
              </li>
            );
          }) : (
            <p className={lobbyTone ? waitingLobbyGameListEmptyHintClass(lobbyTone) : 'text-center text-tertiary pt-8'}>
                {currentUser.isAdmin && adminSearchQuery.trim() ? t('gameList.noSearchResults') : t('gameList.noOngoingGames')}
            </p>
          )}
        </ul>
      </div>
    );
};

export default GameList;