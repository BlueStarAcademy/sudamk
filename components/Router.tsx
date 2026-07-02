
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppGameStoreSlice, useAppRouteSlice, useAppUiSlice, useAppUserSlice } from '../hooks/useAppSlices.js';
import { mergeArenaEntranceAvailability } from '../constants/arenaEntrance.js';
import { isClientAdmin } from '../utils/clientAdmin.js';
import Login from './Login.js';
import Register from './Register.js';
import KakaoCallback from './KakaoCallback.js';
import GoogleCallback from './GoogleCallback.js';
import SetNickname from './SetNickname.js';
import Profile from './Profile.js';
import Game from '../Game.js';
import Admin from './Admin.js';
import TournamentLobby from './TournamentLobby.js';
import TournamentArena from './arenas/TournamentArena.js';
import IntentWaitingArena from './arenas/waiting/IntentWaitingArena.js';
import { arenaLobbyHash } from '../shared/utils/arenaLobbyDestination.js';
import SinglePlayerLobby from './SinglePlayerLobby.js';
import TowerLobby from './TowerLobby.js';
import HelpPage from './HelpPage.js';
import GuildHome from './guild/GuildHome.js';
import GuildBoss from './guild/GuildBoss.js';
import GuildWar from './guild/GuildWar.js';
import AdventureLobby from './adventure/AdventureLobby.js';
import AdventureStageMap from './adventure/AdventureStageMap.js';
import { replaceAppHash } from '../utils/appUtils.js';
import { APP_HOME_HASH, APP_HOME_ARENA_HASH, isAppHomeHash } from '../shared/types/navigation.js';
import InlineLoadingSpinner from './ui/InlineLoadingSpinner.js';
import {
    pairArenaLobbyHash,
    readPairArenaRestoreFromGameStateStorage,
    stashPairArenaRoomRestoreForLobbyNavigation,
} from '../shared/utils/pairArenaSessionRestore.js';
import { userMeetsGuildFeatureLevelRequirement } from '../shared/constants/guildConstants.js';
import { preloadCriticalRouteImages, scheduleRouteImagePrefetch } from '../services/assetService.js';
import type { ArenaChannel, ArenaLobbyIntent } from '../shared/types/api.js';

const routeShellClass = 'flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden';

// 게임 라우트 로더 컴포넌트 (게임이 로드될 때까지 대기, 새로고침 시 재입장 대기)
const GameRouteLoader: React.FC<{ gameId: string }> = ({ gameId }) => {
    const { t } = useTranslation(['nav', 'common']);
    const { activeGame, singlePlayerGames, towerGames, liveGames, gameRejoinFailure } = useAppGameStoreSlice();
    const { currentUser } = useAppUserSlice();
    const { handlers } = useAppUiSlice();
    const { recoverPveGameFromSessionStorage } = handlers;
    const [hasTimedOut, setHasTimedOut] = useState(false);
    const currentRejoinFailure = gameRejoinFailure?.gameId === gameId ? gameRejoinFailure : null;
    // 새로고침(F5) 시 재입장은 INITIAL_STATE 직후 지연(약 2.5초) + 네트워크 여유
    const maxWaitTime = 10000;

    // 타임아웃 처리 (게임이 스토어에 있고 참가자면 경기장 유지 — 종료/계가 후 새로고침 시에도 화면 유지)
    // 조기 return보다 위에 두어 훅 순서가 렌더마다 동일하도록 함 (도전의 탑 다음 층 등 전환 시 필수)
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (!activeGame || activeGame.id !== gameId) {
                const allGamesCheck = { ...(liveGames || {}), ...(singlePlayerGames || {}), ...(towerGames || {}) };
                const game = allGamesCheck[gameId];
                if (game && currentUser && (game.player1?.id === currentUser.id || game.player2?.id === currentUser.id)) {
                    return;
                }
                if (recoverPveGameFromSessionStorage(gameId)) {
                    return;
                }
                const pairArenaRestore = readPairArenaRestoreFromGameStateStorage(gameId);
                if (pairArenaRestore) {
                    stashPairArenaRoomRestoreForLobbyNavigation(
                        pairArenaRestore.roomId,
                        pairArenaRestore.lobbyChannel,
                    );
                    replaceAppHash(
                        pairArenaLobbyHash(
                            pairArenaRestore.lobbyChannel,
                            pairArenaRestore.lobbyIntent ?? 'pvp',
                        ),
                    );
                    return;
                }
                setHasTimedOut(true);
                if (currentRejoinFailure?.reason === 'network') {
                    return;
                }
                setTimeout(() => {
                    if (!isAppHomeHash(window.location.hash)) {
                        replaceAppHash(APP_HOME_HASH);
                    }
                }, 100);
            }
        }, maxWaitTime);

        return () => clearTimeout(timeout);
    }, [gameId, activeGame, singlePlayerGames, towerGames, liveGames, currentUser, currentRejoinFailure?.reason, recoverPveGameFromSessionStorage]);

    // activeGame이 로드되면 즉시 렌더링 (status 기반 또는 URL 폴백)
    if (activeGame && activeGame.id === gameId) {
        return <Game key={gameId} session={activeGame} />;
    }

    // 재입장으로 스토어에만 있고 activeGame 폴백 전에 올 수 있는 경우: 스토어에서 직접 세션 사용
    const allGames = { ...(liveGames || {}), ...(singlePlayerGames || {}), ...(towerGames || {}) };
    const currentGame = allGames[gameId];
    if (currentGame && currentUser && (currentGame.player1?.id === currentUser.id || currentGame.player2?.id === currentUser.id)) {
        return <Game key={gameId} session={currentGame} />;
    }

    if (currentRejoinFailure?.reason === 'network') {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <div>{currentRejoinFailure.message}</div>
                <button
                    type="button"
                    className="rounded-lg border border-color bg-primary px-4 py-2 text-sm font-semibold text-primary shadow hover:bg-opacity-90"
                    onClick={() => {
                        setHasTimedOut(false);
                        handlers.requestGameRejoinRetry(gameId);
                    }}
                >
                    {t('common:actions.retry')}
                </button>
            </div>
        );
    }

    if (hasTimedOut || currentRejoinFailure?.reason === 'notFound') {
        return <div className="flex items-center justify-center h-full">{t('nav:router.gameNotFoundRedirect')}</div>;
    }

    return (
        <div className="flex h-full flex-col items-center justify-center gap-3">
            <InlineLoadingSpinner label={t('nav:router.syncingGame')} />
        </div>
    );
};

const Router: React.FC = () => {
    const { t } = useTranslation('nav');
    const { currentRoute, arenaEntranceAvailability } = useAppRouteSlice();
    const { currentUser } = useAppUserSlice();
    const { activeGame, singlePlayerGames, towerGames, liveGames } = useAppGameStoreSlice();

    const mergedArena = useMemo(
        () => mergeArenaEntranceAvailability(arenaEntranceAvailability),
        [arenaEntranceAvailability],
    );
    const arenaAdminBypass = isClientAdmin(currentUser);

    /** 화면 전환은 즉시 — visible 이미지 우선, 나머지는 유휴 시 백그라운드 워밍 */
    useEffect(() => {
        if (!currentUser) return;
        preloadCriticalRouteImages(currentRoute.view);
        scheduleRouteImagePrefetch(currentRoute.view);
    }, [currentUser, currentRoute.view]);

    useEffect(() => {
        if (!currentUser || arenaAdminBypass) return;
        const v = currentRoute.view;
        const channel = currentRoute.params?.channel as ArenaChannel | undefined;
        if (v === 'pvp' || v === 'ai') {
            if (channel === 'strategic' && !mergedArena.strategicLobby) replaceAppHash(APP_HOME_ARENA_HASH);
            if (channel === 'playful' && !mergedArena.playfulLobby) replaceAppHash(APP_HOME_ARENA_HASH);
            if (channel === 'pair' && !mergedArena.pairLobby) replaceAppHash(APP_HOME_ARENA_HASH);
            return;
        }
        if (v === 'singleplayer' && !mergedArena.singleplayer) replaceAppHash(APP_HOME_HASH);
        if (v === 'tower' && !mergedArena.tower) replaceAppHash(APP_HOME_HASH);
        if (v === 'tournament' && !mergedArena.championship) replaceAppHash(APP_HOME_HASH);
        if (v === 'adventure' && !mergedArena.adventure) replaceAppHash(APP_HOME_HASH);
        const guildOk = userMeetsGuildFeatureLevelRequirement(currentUser);
        if (!guildOk && (v === 'guild' || v === 'guildboss' || v === 'guildwar')) replaceAppHash(APP_HOME_HASH);
    }, [currentUser, arenaAdminBypass, currentRoute.view, currentRoute.params?.channel, mergedArena]);

    if (!currentUser) {
        if (currentRoute.view === 'register') {
            return <Register />;
        }
        if (currentRoute.view === 'kakao-callback') {
            return <KakaoCallback />;
        }
        if (currentRoute.view === 'google-callback') {
            return <GoogleCallback />;
        }
        if (currentRoute.view === 'help') {
            return (
                <div className={routeShellClass}>
                    <HelpPage
                        initialCategoryId={currentRoute.params?.categoryId ?? null}
                        initialSubId={currentRoute.params?.subId ?? null}
                    />
                </div>
            );
        }
        return <Login />;
    }

    // 닉네임이 없거나 임시 닉네임인 경우 닉네임 설정 화면으로 이동
    if (currentUser && (!currentUser.nickname || currentUser.nickname.startsWith('user_'))) {
        const setNicknameShell = (
            <div className={routeShellClass}>
                <SetNickname />
            </div>
        );
        if (currentRoute.view === 'set-nickname') {
            return setNicknameShell;
        }
        window.location.hash = '#/set-nickname';
        return setNicknameShell;
    }

    // If user is logged in, but their game is still active, force them into the game view
    // 단, 라우트가 이미 게임 페이지(#/game/${gameId})로 설정되어 있으면 "재접속 중..."을 표시하지 않음
    // (새 게임을 시작한 직후 activeGame이 아직 업데이트되지 않았을 수 있음)
    // scoring 상태의 게임도 포함 (계가 진행 중)
    // 길드전 대기 화면은 #/guildwar — 진행 중인 길드전 판(#/game/...)과 별도이므로 모험처럼 예외
    const isGuildShellView =
        currentRoute.view === 'guild' ||
        currentRoute.view === 'guildboss' ||
        currentRoute.view === 'guildwar';
    if (
        activeGame &&
        currentRoute.view !== 'game' &&
        !currentRoute.params?.id &&
        currentRoute.view !== 'adventure' &&
        !isGuildShellView
    ) {
        // The logic in useApp hook will handle the redirect, we can show a loading state here
        return <div className="flex items-center justify-center h-full">{t('router.reconnecting')}</div>;
    }

    // scoring 상태의 게임이 있으면 게임 페이지로 유지 (activeGame이 null이어도)
    if (currentRoute.view === 'game' && currentRoute.params?.id) {
        const gameId = currentRoute.params.id;
        const allGames = {
            ...(liveGames || {}),
            ...(singlePlayerGames || {}),
            ...(towerGames || {}),
        };
        const currentGame = allGames[gameId];
            if (currentGame && currentGame.gameStatus === 'scoring') {
            // scoring 상태이면 게임 화면 유지 (activeGame이 null이어도)
            if (!activeGame || activeGame.id !== gameId) {
                // activeGame이 없어도 scoring 상태이면 게임 화면 표시
                return <Game key={gameId} session={currentGame} />;
            }
        }
    }

    switch (currentRoute.view) {
        case 'set-nickname':
            return (
                <div className={routeShellClass}>
                    <SetNickname />
                </div>
            );
        case 'profile':
            return (
                <div className={routeShellClass}>
                    <Profile />
                </div>
            );
        case 'arena': {
            const intent = currentRoute.params?.intent as ArenaLobbyIntent | undefined;
            if (intent === 'pvp' || intent === 'ai') {
                replaceAppHash(arenaLobbyHash({ intent, channel: 'strategic' }));
                return null;
            }
            replaceAppHash(APP_HOME_ARENA_HASH);
            return null;
        }
        case 'pvp':
        case 'ai': {
            const channel = currentRoute.params?.channel as ArenaChannel | undefined;
            const intent: ArenaLobbyIntent = currentRoute.view === 'ai' ? 'ai' : 'pvp';
            if (channel === 'strategic' || channel === 'pair' || channel === 'playful') {
                return (
                    <div className={routeShellClass}>
                        <IntentWaitingArena lobbyChannel={channel} lobbyIntent={intent} />
                    </div>
                );
            }
            replaceAppHash(APP_HOME_ARENA_HASH);
            return null;
        }
        case 'game':
            if (currentRoute.params.id) {
                const gameId = currentRoute.params.id;

                // activeGame이 있고 ID가 일치하면 즉시 렌더링
                if (activeGame && activeGame.id === gameId) {
                    return <Game key={gameId} session={activeGame} />;
                }

                // activeGame이 없으면 GameRouteLoader에서 대기
                // handleAction에서 게임을 즉시 상태에 추가하므로, 상태 업데이트를 기다림
                return <GameRouteLoader key={gameId} gameId={gameId} />;
            }
            console.warn('Router: No game ID in route. Redirecting to profile.');
            setTimeout(() => {
                if (!isAppHomeHash(window.location.hash)) {
                    window.location.hash = APP_HOME_HASH;
                }
            }, 100);
            return <div className="flex items-center justify-center h-full">{t('router.syncingGame')}</div>;
        case 'admin':
            return <Admin />;
        case 'tournament':
            if (currentRoute.params.type) {
                return <TournamentArena type={currentRoute.params.type as any} />;
            }
            return <TournamentLobby />;
        case 'singleplayer':
            return <SinglePlayerLobby />;
        case 'tower':
            return <TowerLobby />;
        case 'adventure': {
            const sid = currentRoute.params?.stageId;
            if (sid) {
                return <AdventureStageMap stageId={String(sid)} />;
            }
            return <AdventureLobby />;
        }
        case 'guild':
            return <GuildHome />;
        case 'guildboss':
            return <GuildBoss />;
        case 'guildwar':
            return <GuildWar />;
        case 'help':
            return (
                <div className={routeShellClass}>
                    <HelpPage
                        initialCategoryId={currentRoute.params?.categoryId ?? null}
                        initialSubId={currentRoute.params?.subId ?? null}
                    />
                </div>
            );
        default:
            window.location.hash = APP_HOME_HASH;
            return null;
    }
};

export default Router;
