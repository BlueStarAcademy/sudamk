import React from 'react';
import { useTranslation } from 'react-i18next';
import { GameRecord, Player } from '../../types.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../../constants/gameModes.js';
import {
    formatGameRecordInfoDate,
    formatGameRecordInfoResult,
} from '../../utils/gameRecordResultLabel.js';
import { GoStoneIcon } from '../game/arenaRoundEndShared.js';

export interface GameRecordInfoPanelProps {
    record: GameRecord | null;
    myNickname: string;
}

const STONE_CLS = 'h-4 w-4 shrink-0 sm:h-[1.125rem] sm:w-[1.125rem]';

/** 라벨 · 콜론 · 값 — 행마다 동일한 3열 그리드 */
const INFO_GRID =
    'mx-auto grid w-fit max-w-full grid-cols-[2.75rem_auto_minmax(0,max-content)] items-center gap-x-2 gap-y-2 text-xs leading-snug sm:text-sm';

const modeLabel = (mode: string) => {
    const s = SPECIAL_GAME_MODES.find((m) => m.mode === mode);
    if (s) return s.name;
    const p = PLAYFUL_GAME_MODES.find((m) => m.mode === mode);
    return p ? p.name : mode;
};

const playerStoneColor = (color: Player | undefined): 'black' | 'white' | null => {
    if (color === Player.Black) return 'black';
    if (color === Player.White) return 'white';
    return null;
};

const GameRecordInfoPanel: React.FC<GameRecordInfoPanelProps> = ({ record, myNickname }) => {
    const { t } = useTranslation('game');
    if (!record) {
        return (
            <div className="flex h-full min-h-[5rem] flex-col items-center justify-center px-3 text-center text-sm text-slate-400">
                기보를 선택하면 대국 정보가 표시됩니다.
            </div>
        );
    }

    const myColor = record.myColor;
    const opponentColor =
        myColor === Player.Black ? Player.White : myColor === Player.White ? Player.Black : undefined;
    const myStone = playerStoneColor(myColor);
    const opponentStone = playerStoneColor(opponentColor);
    const result = formatGameRecordInfoResult(record);

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain">
            <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-500/20 bg-gradient-to-br from-zinc-900/95 via-zinc-950 to-black p-3 shadow-[0_12px_32px_rgba(0,0,0,0.4)] ring-1 ring-inset ring-white/[0.06] sm:p-3.5">
                <div className="flex w-full min-w-0 items-center justify-center gap-1.5 whitespace-nowrap text-xs font-semibold text-amber-50 sm:text-sm">
                    <span className="min-w-0 max-w-[38%] truncate">{myNickname}</span>
                    {myStone && <GoStoneIcon color={myStone} className={STONE_CLS} />}
                    <span className="shrink-0 px-0.5 text-slate-500">VS</span>
                    <span className="min-w-0 max-w-[38%] truncate">{record.opponent.nickname}</span>
                    {opponentStone && <GoStoneIcon color={opponentStone} className={STONE_CLS} />}
                </div>

                <dl className={INFO_GRID}>
                    <dt className="text-right text-slate-400">{t('gameRecord.mode')}</dt>
                    <span className="text-slate-600" aria-hidden>
                        :
                    </span>
                    <dd className="whitespace-nowrap font-semibold text-amber-50">{modeLabel(record.mode)}</dd>

                    <dt className="text-right text-slate-400">{t('gameRecord.date')}</dt>
                    <span className="text-slate-600" aria-hidden>
                        :
                    </span>
                    <dd className="whitespace-nowrap font-semibold text-amber-50">
                        {formatGameRecordInfoDate(record.date)}
                    </dd>

                    <dt className="text-right text-slate-400">{t('gameRecord.score')}</dt>
                    <span className="text-slate-600" aria-hidden>
                        :
                    </span>
                    <dd className="whitespace-nowrap font-semibold text-amber-50">
                        <span className="inline-flex items-center gap-1">
                            <GoStoneIcon color="black" className={STONE_CLS} />
                            <span>{record.gameResult.blackScore}점</span>
                            <span className="font-normal text-slate-400">vs</span>
                            <GoStoneIcon color="white" className={STONE_CLS} />
                            <span>{record.gameResult.whiteScore}점</span>
                        </span>
                    </dd>

                    <dt className="text-right text-slate-400">{t('gameRecord.result')}</dt>
                    <span className="text-slate-600" aria-hidden>
                        :
                    </span>
                    <dd className="whitespace-nowrap font-semibold text-amber-50">
                        <span className="inline-flex items-center gap-1">
                            {result.userStoneColor && (
                                <GoStoneIcon color={result.userStoneColor} className={STONE_CLS} />
                            )}
                            <span className="text-amber-100">{result.text}</span>
                        </span>
                    </dd>
                </dl>
            </div>
        </div>
    );
};

export default GameRecordInfoPanel;
