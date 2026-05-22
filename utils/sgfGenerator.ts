import { LiveGameSession, User, Player, GameMode, WinReason, Point } from '../types/index.js';
import { SPECIAL_GAME_MODES } from '../constants/gameModes.js';
import {
    applyMoveToBoard,
    cloneBoard,
    collectCapturedPoints,
    createEmptyBoard,
} from './sgfBoardLogic.js';

/**
 * 좌표를 SGF 형식(a-s)으로 변환
 */
const coordToSgf = (x: number, y: number): string => {
    const sgfX = String.fromCharCode('a'.charCodeAt(0) + x);
    const sgfY = String.fromCharCode('a'.charCodeAt(0) + y);
    return sgfX + sgfY;
};

/**
 * SGF 문자열 이스케이프 처리
 */
const escapeSgfString = (str: string): string => {
    return str.replace(/\\/g, '\\\\').replace(/\]/g, '\\]');
};

/**
 * 게임 모드 이름 가져오기
 */
const getGameModeName = (mode: GameMode): string => {
    const modeInfo = SPECIAL_GAME_MODES.find((m) => m.mode === mode);
    return modeInfo ? modeInfo.name : mode;
};

const formatSgfResult = (winner: Player | null | undefined, winReason: WinReason | null | undefined): string => {
    if (winner === Player.Black) {
        if (winReason === 'resign' || winReason === 'disconnect') return 'B+R';
        if (winReason === 'timeout') return 'B+T';
        return 'B+';
    }
    if (winner === Player.White) {
        if (winReason === 'resign' || winReason === 'disconnect') return 'W+R';
        if (winReason === 'timeout') return 'W+T';
        return 'W+';
    }
    return '0';
};

/**
 * 게임에서 SGF 파일 생성
 */
export const generateSgfFromGame = (
    game: LiveGameSession,
    player1: User,
    player2: User,
    analysisResult?: any,
): string => {
    const boardSize = game.settings.boardSize;
    const blackPlayer = game.player1.id === game.blackPlayerId ? player1 : player2;
    const whitePlayer = game.player1.id === game.whitePlayerId ? player1 : player2;
    const blackName = escapeSgfString(blackPlayer.nickname);
    const whiteName = escapeSgfString(whitePlayer.nickname);

    const gameDate = new Date(game.createdAt);
    const dateStr = gameDate.toISOString().split('T')[0].replace(/-/g, '');

    const result = formatSgfResult(game.winner, game.winReason);
    const komi = game.finalKomi ?? game.settings.komi ?? 0.5;
    const gameMode = getGameModeName(game.mode);

    let sgf = `(;FF[4]CA[UTF-8]SZ[${boardSize}]KM[${komi}]PB[${blackName}]PW[${whiteName}]DT[${dateStr}]RE[${result}]GN[${escapeSgfString(gameMode)}]`;

    if (game.captures) {
        sgf += `C[최종따낸돌: 흑 ${game.captures[Player.Black] ?? 0}, 백 ${game.captures[Player.White] ?? 0}]`;
    }

    if (analysisResult?.scoreDetails) {
        const blackDetails = analysisResult.scoreDetails.black;
        const whiteDetails = analysisResult.scoreDetails.white;

        if (blackDetails.timeBonus > 0 || whiteDetails.timeBonus > 0) {
            sgf += `C[시간보너스: 흑 ${blackDetails.timeBonus}점, 백 ${whiteDetails.timeBonus}점]`;
        }
        if (blackDetails.baseStoneBonus > 0 || whiteDetails.baseStoneBonus > 0) {
            sgf += `C[베이스보너스: 흑 ${blackDetails.baseStoneBonus}점, 백 ${whiteDetails.baseStoneBonus}점]`;
        }
        if (blackDetails.hiddenStoneBonus > 0 || whiteDetails.hiddenStoneBonus > 0) {
            sgf += `C[히든보너스: 흑 ${blackDetails.hiddenStoneBonus}점, 백 ${whiteDetails.hiddenStoneBonus}점]`;
        }
        if (blackDetails.itemBonus > 0 || whiteDetails.itemBonus > 0) {
            sgf += `C[미사용아이템보너스: 흑 ${blackDetails.itemBonus}점, 백 ${whiteDetails.itemBonus}점]`;
        }
        sgf += `C[최종점수: 흑 ${blackDetails.total}점, 백 ${whiteDetails.total}점]`;
    }

    const isHiddenMode =
        game.mode === GameMode.Hidden || (game.mode === GameMode.Mix && game.settings.mixedModes?.includes(GameMode.Hidden));
    const isMissileMode =
        game.mode === GameMode.Missile || (game.mode === GameMode.Mix && game.settings.mixedModes?.includes(GameMode.Missile));

    if (isHiddenMode || isMissileMode) {
        const blackUnusedItems: string[] = [];
        const whiteUnusedItems: string[] = [];

        if (isHiddenMode) {
            const blackHiddenUsed = game.hidden_stones_used_p1 ?? 0;
            const blackHiddenTotal = game.settings.hiddenStoneCount ?? 0;
            const blackHiddenUnused = blackHiddenTotal - blackHiddenUsed;
            if (blackHiddenUnused > 0) blackUnusedItems.push(`히든 ${blackHiddenUnused}개`);

            const blackScansUsed = (game.settings.scanCount ?? 0) - (game.scans_p1 ?? game.settings.scanCount ?? 0);
            if (blackScansUsed > 0) blackUnusedItems.push(`스캔 ${blackScansUsed}개`);
        }

        if (isMissileMode) {
            const blackMissilesUsed = (game.settings.missileCount ?? 0) - (game.missiles_p1 ?? game.settings.missileCount ?? 0);
            if (blackMissilesUsed > 0) blackUnusedItems.push(`미사일 ${blackMissilesUsed}개`);
        }

        if (isHiddenMode) {
            const whiteHiddenUsed = game.hidden_stones_used_p2 ?? 0;
            const whiteHiddenTotal = game.settings.hiddenStoneCount ?? 0;
            const whiteHiddenUnused = whiteHiddenTotal - whiteHiddenUsed;
            if (whiteHiddenUnused > 0) whiteUnusedItems.push(`히든 ${whiteHiddenUnused}개`);

            const whiteScansUsed = (game.settings.scanCount ?? 0) - (game.scans_p2 ?? game.settings.scanCount ?? 0);
            if (whiteScansUsed > 0) whiteUnusedItems.push(`스캔 ${whiteScansUsed}개`);
        }

        if (isMissileMode) {
            const whiteMissilesUsed = (game.settings.missileCount ?? 0) - (game.missiles_p2 ?? game.settings.missileCount ?? 0);
            if (whiteMissilesUsed > 0) whiteUnusedItems.push(`미사일 ${whiteMissilesUsed}개`);
        }

        if (blackUnusedItems.length > 0 || whiteUnusedItems.length > 0) {
            const blackStr = blackUnusedItems.length > 0 ? `흑(${blackUnusedItems.join(', ')})` : '흑(없음)';
            const whiteStr = whiteUnusedItems.length > 0 ? `백(${whiteUnusedItems.join(', ')})` : '백(없음)';
            sgf += `C[미사용아이템: ${blackStr}, ${whiteStr}]`;
        }
    }

    sgf += '\n';

    const moveHistory = game.moveHistory || [];
    let currentNode = sgf;
    const board = createEmptyBoard(boardSize);

    for (let i = 0; i < moveHistory.length; i++) {
        const move = moveHistory[i];

        if (move.x === -1 && move.y === -1) {
            continue;
        }

        const player = move.player === Player.Black ? 'B' : 'W';
        const coord = coordToSgf(move.x, move.y);

        const before = cloneBoard(board);
        const after = cloneBoard(board);
        applyMoveToBoard(after, { player: move.player, x: move.x, y: move.y }, boardSize);
        const captured = collectCapturedPoints(before, after, { player: move.player, x: move.x, y: move.y }, boardSize);

        for (let y = 0; y < boardSize; y++) {
            board[y] = after[y];
        }

        currentNode += `;${player}[${coord}]`;
        if (captured.length > 0) {
            for (const p of captured) {
                currentNode += `AE[${coordToSgf(p.x, p.y)}]`;
            }
        }

        if (game.hiddenMoves?.[i]) {
            currentNode += `C[히든 아이템 사용]`;
        }

        if (game.permanentlyRevealedStones?.some((p) => p.x === move.x && p.y === move.y)) {
            currentNode += `C[히든 돌 공개: (${move.x},${move.y})]`;
        }

        if (i > 0 && game.animation) {
            const prevMove = moveHistory[i - 1];
            if (prevMove && prevMove.x !== -1 && prevMove.y !== -1) {
                const anim = game.animation as { type?: string; from?: Point; to?: Point };
                if (anim.type === 'missile' || anim.type === 'hidden_missile') {
                    if (anim.from && anim.to) {
                        currentNode += `C[미사일: (${anim.from.x},${anim.from.y}) -> (${anim.to.x},${anim.to.y})]`;
                    }
                }
            }
        }

        if (game.revealedHiddenMoves) {
            for (const revealedIndices of Object.values(game.revealedHiddenMoves)) {
                if (revealedIndices.includes(i)) {
                    currentNode += `C[스캔 성공: (${move.x},${move.y})]`;
                }
            }
        }

        currentNode += '\n';
    }

    sgf = currentNode;
    sgf += ')';

    return sgf;
};
