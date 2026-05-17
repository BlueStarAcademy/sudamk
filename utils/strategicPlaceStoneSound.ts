import { audioService } from '../services/audioService.js';
import { GameMode } from '../types.js';
import { SPECIAL_GAME_MODES } from '../constants/gameModes.js';

export function isStrategicPlaceStoneSoundMode(mode: GameMode): boolean {
    if (mode === GameMode.Dice || mode === GameMode.Thief) return false;
    return (
        SPECIAL_GAME_MODES.some((m) => m.mode === mode) ||
        mode === GameMode.Omok ||
        mode === GameMode.Ttamok
    );
}

/** 보드 클릭·착수 확정 등 사용자 제스처 스택 안에서 호출 */
export function playPlaceStoneSoundFromUserGesture(): void {
    audioService.unlockFromUserGesture();
    void audioService.initialize();
    audioService.placeStone();
}
