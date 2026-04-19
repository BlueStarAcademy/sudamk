
import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../hooks/useAppContext.js';
import { mergeArenaEntranceAvailability } from '../constants/arenaEntrance.js';
import { isClientAdmin } from '../utils/clientAdmin.js';
import { LiveGameSession } from '../types.js';
import { GameMode } from '../types.js';
import Login from './Login.js';
import Register from './Register.js';
import KakaoCallback from './KakaoCallback.js';
import GoogleCallback from './GoogleCallback.js';
import SetNickname from './SetNickname.js';
import Profile from './Profile.js';
import Lobby from './Lobby.js';
import WaitingRoom from './waiting-room/WaitingRoom.js';
import Game from '../Game.js';
import Admin from './Admin.js';
import TournamentLobby from './TournamentLobby.js';
import TournamentArena from './arenas/TournamentArena.js';
import SinglePlayerLobby from './SinglePlayerLobby.js';
import TowerLobby from './TowerLobby.js';
import GuildHome from './guild/GuildHome.js';
import GuildBoss from './guild/GuildBoss.js';
import GuildWar from './guild/GuildWar.js';
import AdventureLobby from './adventure/AdventureLobby.js';
import AdventureStageMap from './adventure/AdventureStageMap.js';
import { replaceAppHash } from '../utils/appUtils.js';
import { userMeetsGuildFeatureLevelRequirement } from '../shared/constants/guildConstants.js';

// 게임 라우트 로더 컴포넌트 (게임이 로드될 때까지 대기, 새로고침 시 재입장 대기)
const GameRouteLoader: React.FC<{ gameId: string }> = ({ gameId }) => {
    const { activeGame, singlePlayerGames, towerGames, liveGames, currentUser } = useAppContext();
    const [hasTimedOut, setHasTimedOut] = useState(false);
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
                setHasTimedOut(true);
                setTimeout(() => {
                    if (window.location.hash !== '#/profile') {
                        replaceAppHash('#/profile');
                    }
                }, 100);
            }
        }, maxWaitTime);

        return () => clearTimeout(timeout);
    }, [gameId, activeGame, singlePlayerGames, towerGames, liveGames, currentUser]);

    // activeGame이 로드되면 즉시 렌더링 (status 기반 또는 URL 폴백)
    if (activeGame && activeGame.id === gameId) {
        return <Game session={activeGame} />;
    }

    // 재입장으로 스토어에만 있고 activeGame 폴백 전에 올 수 있는 경우: 스토어에서 직접 세션 사용
    const allGames = { ...(liveGames || {}), ...(singlePlayerGames || {}), ...(towerGames || {}) };
    const currentGame = allGames[gameId];
    if (currentGame && currentUser && (currentGame.player1?.id === currentUser.id || currentGame.player2?.id === currentUser.id)) {
        return <Game session={currentGame} />;
    }

    if (hasTimedOut) {
        return <div className="flex items-center justify-center h-full">게임을 찾을 수 없습니다. 프로필로 이동합니다...</div>;
    }

    return <div className="flex items-center justify-center h-full">게임 정보 동기화 중...</div>;
};

const Router: React.FC = () => {
    const { currentRoute, currentUser, activeGame, singlePlayerGames, towerGames, liveGames, arenaEntranceAvailability } = useAppContext();

    const mergedArena = useMemo(
        () => mergeArenaEntranceAvailability(arenaEntranceAvailability),
        [arenaEntranceAvailability],
    );
    const arenaAdminBypass = isClientAdmin(currentUser);

    useEffect(() => {
        if (!currentUser || arenaAdminBypass) return;
        const v = currentRoute.view;
        if (v === 'lobby') {
            const t = currentRoute.params?.type === 'playful' ? 'playful' : 'strategic';
            const ok = t === 'playful' ? mergedArena.playfulLobby : mergedArena.strategicLobby;
            if (!ok) replaceAppHash('#/profile');
            return;
        }
        if (v === 'waiting') {
            const m = currentRoute.params?.mode;
            if (m === 'strategic' && !mergedArena.strategicLobby) replaceAppHash('#/profile');
            if (m === 'playful' && !mergedArena.playfulLobby) replaceAppHash('#/profile');
            return;
        }
        if (v === 'singleplayer' && !mergedArena.singleplayer) replaceAppHash('#/profile');
        if (v === 'tower' && !mergedArena.tower) replaceAppHash('#/profile');
        if (v === 'tournament' && !mergedArena.championship) replaceAppHash('#/profile');
        if (v === 'adventure' && !mergedArena.adventure) replaceAppHash('#/profile');
        const guildOk = userMeetsGuildFeatureLevelRequirement(currentUser);
        if (!guildOk && (v === 'guild' || v === 'guildboss' || v === 'guildwar')) replaceAppHash('#/profile');
    }, [currentUser, arenaAdminBypass, currentRoute.view, currentRoute.params?.type, currentRoute.params?.mode, mergedArena]);

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
        return <Login />;
    }
    
    // 닉네임이 없거나 임시 닉네임인 경우 닉네임 설정 화면으로 이동
    if (currentUser && (!currentUser.nickname || currentUser.nickname.startsWith('user_'))) {
        const setNicknameShell = (
            <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
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
        return <div className="flex items-center justify-center h-full">재접속 중...</div>;
    }
    
    // scoring 상태의 게임이 있으면 게임 페이지로 유지 (activeGame이 null이어도)
    if (currentRoute.view === 'game' && currentRoute.params?.id) {
        const gameId = currentRoute.params.id;
        const allGames = { 
            ...(liveGames || {}), 
            ...(singlePlayerGames || {}), 
            ...(towerGames || {}) 
        };
        const currentGame = allGames[gameId];
        if (currentGame && currentGame.gameStatus === 'scoring') {
            // scoring 상태이면 게임 화면 유지 (activeGame이 null이어도)
            if (!activeGame || activeGame.id !== gameId) {
                // activeGame이 없어도 scoring 상태이면 게임 화면 표시
                return <Game session={currentGame} />;
            }
        }
    }

    switch (currentRoute.view) {
        case 'set-nickname':
            return (
                <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
                    <SetNickname />
                </div>
            );
        case 'profile':
            return (
                <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
                    <Profile />
                </div>
            );
        case 'lobby':
            const lobbyType = currentRoute.params.type === 'playful' ? 'playful' : 'strategic';
            return <Lobby lobbyType={lobbyType} />;
        case 'waiting':
            if (currentRoute.params.mode) {
                const mode = currentRoute.params.mode;
                // 통합 대기실(strategic/playful)만 허용, 개별 게임 모드는 프로필로 리다이렉트
                if (mode === 'strategic' || mode === 'playful') {
                    return <WaitingRoom mode={mode as 'strategic' | 'playful'} />;
                } else {
                    console.warn('Router: Individual game mode waiting room access denied, redirecting to profile:', mode);
                    window.location.hash = '#/profile';
                    return null;
                }
            }
            // Fallback if mode is missing
            window.location.hash = '#/profile';
            return null;
        case 'game':
            if (currentRoute.params.id) {
                const gameId = currentRoute.params.id;
                
                // activeGame이 있고 ID가 일치하면 즉시 렌더링
                if (activeGame && activeGame.id === gameId) {
                    return <Game session={activeGame} />;
                }
                
                // activeGame이 없으면 GameRouteLoader에서 대기
                // handleAction에서 게임을 즉시 상태에 추가하므로, 상태 업데이트를 기다림
                return <GameRouteLoader key={gameId} gameId={gameId} />;
            }
            console.warn("Router: No game ID in route. Redirecting to profile.");
            setTimeout(() => {
                if (window.location.hash !== '#/profile') {
                    window.location.hash = '#/profile';
                }
            }, 100);
            return <div className="flex items-center justify-center h-full">게임 정보 동기화 중...</div>;
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
        default:
            window.location.hash = '#/profile';
            return null;
    }
};

export default Router;