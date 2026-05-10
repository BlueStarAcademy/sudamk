import { GameMode } from '../types/enums.js';

/** Base+Capture 믹스가 허용되므로, 과거 호환용 함수는 순서/중복만 보존한다. */
export const stripCaptureFromMixWhenBaseIncluded = (modes: GameMode[]): GameMode[] => {
    return [...new Set(modes)];
};

/**
 * 모드가 1개뿐이면 싱글 믹스가 무효가 되므로, 흔한 조합으로 보조 모드를 채운다.
 */
export const ensureMixModesMinTwoAfterBaseCaptureSanitize = (modes: GameMode[]): GameMode[] => {
    const m = stripCaptureFromMixWhenBaseIncluded(modes);
    if (m.length >= 2) return m.slice(0, 5);
    // 스피드를 맨 앞에 두면 "베이스만 남음" 같은 순간에 체크를 지워도 스피드가 다시 붙는 좀비 UI가 된다.
    // 보조 채움은 히든·미사일·스피드·베이스 순으로 한다(이미 선택된 모드는 건너뜀).
    const fillOrder: GameMode[] = [GameMode.Hidden, GameMode.Missile, GameMode.Speed, GameMode.Base];
    const out = [...m];
    for (const extra of fillOrder) {
        if (out.length >= 2) break;
        if (!out.includes(extra)) out.push(extra);
    }
    return out.slice(0, 5);
};
