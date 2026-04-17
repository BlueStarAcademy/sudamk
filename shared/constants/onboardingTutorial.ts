import type { User } from '../types/index.js';
import type { ArenaEntranceKey } from '../../constants/arenaEntrance.js';

/** 입문-1 온보딩 첫 클리어 축하 보상 부채(`singlePlayerConstants` firstClear itemId와 동일) */
export const ONBOARDING_INTRO1_FAN_ITEM_ID = '푸른 바람 부채' as const;

/** 입문-1 승리 직후(결과 모달) — 부채 수령 전 안내 */
export const ONBOARDING_INTRO1_POST_VICTORY_RESULT_BODY_PC =
    '목표를 달성하여 승리했습니다. 승리 결과 정보를 확인하세요.';
export const ONBOARDING_INTRO1_POST_VICTORY_RESULT_BODY_MOBILE = ONBOARDING_INTRO1_POST_VICTORY_RESULT_BODY_PC;

/** phase 7(step 0): 결과 모달 보상 패널 안내 */
export const ONBOARDING_INTRO1_RESULT_REWARD_BODY_PC =
    '보상으로 부채를 획득했습니다. 대기실로 이동해 보겠습니다.';
export const ONBOARDING_INTRO1_RESULT_REWARD_BODY_MOBILE = ONBOARDING_INTRO1_RESULT_REWARD_BODY_PC;

/** 입문-1 고정 포석: 백(3,3) 마지막 활로 — 온보딩에서 이 교차점만 착수 허용 */
export const ONBOARDING_INTRO1_FORCED_CAPTURE_POINT = { x: 4, y: 3 } as const;

/** 싱글 인게임 phase 6 서브 — `Game` 등이 `detail`로 동기화 */
export const ONBOARDING_INGAME_SP_STEP_EVENT = 'sudamr-onboarding-ingame-sp-step';

/** 입문-1 강제 착수 완료 → 오버레이가 자유 플레이(phase 6 후반) 안내로 전환 */
export const ONBOARDING_INGAME_SP_INTRO1_DEMO_DONE_EVENT = 'sudamr-onboarding-ingame-sp-intro1-demo-done';

/** 튜토리얼 완료(또는 스킵) 시 이 값 이상 */
export const ONBOARDING_PHASE_COMPLETE = 100;

/** 마지막 튜토리얼 단계 인덱스(0-based). `튜토리얼 종료` 후 완료 보상 처리 */
export const ONBOARDING_LAST_TUTORIAL_PHASE = 14;

export function isOnboardingTutorialActive(user: User | null | undefined): boolean {
    if (!user) return false;
    const p = user.onboardingTutorialPhase;
    return typeof p === 'number' && p >= 0 && p < ONBOARDING_PHASE_COMPLETE;
}

export function getOnboardingCombinedLevel(user: User): number {
    return (user.strategyLevel ?? 1) + (user.playfulLevel ?? 1);
}

/** `data-onboarding-target` 값 — 스포트라이트·측정용 */
export type OnboardingSpotlightTargetId =
    | 'onboarding-home-profile'
    | 'onboarding-sp-home-card'
    | 'onboarding-dock-sp'
    | 'onboarding-sp-stage-1'
    | 'onboarding-header-ap'
    | 'onboarding-sp-pregame-winlose'
    | 'onboarding-sp-pregame-rest'
    | 'onboarding-sp-pregame-body'
    | 'onboarding-sp-game-start'
    | 'onboarding-sp-ingame-user-panel'
    | 'onboarding-sp-ingame-scores-bar'
    | 'onboarding-sp-ingame-demo-point'
    /** 싱글 결과 모달 전체(입문-1 온보딩) */
    | 'onboarding-sp-summary-modal'
    /** 싱글 결과 모달 하단 4버튼 줄 */
    | 'onboarding-sp-summary-footer'
    | 'onboarding-sp-summary-rewards'
    | 'onboarding-sp-summary-lobby'
    | 'onboarding-sp-training-quest-1-card'
    | 'onboarding-sp-training-quest-1-start'
    | 'onboarding-sp-training-quest-2-card'
    | 'onboarding-sp-lobby-back'
    | 'onboarding-dock-home'
    | 'onboarding-quick-bag'
    | 'onboarding-quick-forge'
    | 'onboarding-tower-card'
    | 'onboarding-dock-tower'
    | 'onboarding-inv-fan-slot'
    | 'onboarding-inv-equip-button'
    | 'onboarding-inv-equipped-stats-preset'
    | 'onboarding-inv-modal-close'
    /** 가방 튜토리얼: 닫기 안내 시 모달 전체를 밝게(마스크 구멍) */
    | 'onboarding-inv-equipment-modal-shell'
    | 'onboarding-home-championship-card'
    | 'onboarding-home-pvp-arenas'
    | 'onboarding-home-adventure-card';

/** 경기 설명 모달(phase 5) 튜토리얼 — 모달이 `detail`을 구독 */
export const ONBOARDING_PREGAME_DESC_STEP_EVENT = 'sudamr-onboarding-pregame-desc-step';

/** phase 5 서브: 0 승패, 1 점수·시간·아이템·특수, 2 본문 전체+시작만 */
export const ONBOARDING_PHASE_5_PREGAME_SUBSTEP_COPY = [
    {
        bodyPc:
            '승리 조건과 패배 조건을 확인하세요. 15턴 내에 1점을 획득해야하고 15턴이 넘거나 상대방이 99점을 획득하면 패배합니다.',
        bodyMobile:
            '승리·패배 조건을 확인하세요. 15턴 내 1점 획득, 15턴 초과 또는 상대 99점이면 패배합니다.',
    },
    {
        bodyPc: '점수 요인과 시간규칙, 일부 경기에서는 아이템도 사용할 수 있습니다.',
        bodyMobile: '점수 요인·시간규칙, 일부 경기에서는 아이템도 사용할 수 있습니다.',
    },
    {
        bodyPc: '이제 시작하기 버튼을 클릭하여 경기를 시작해보세요.',
        bodyMobile: '이제 「시작하기」를 눌러 경기를 시작해보세요.',
    },
] as const;

/** phase 6(인게임 입문-1): 정보 패널 → 점수·턴 → 강제 착수 안내 */
export const ONBOARDING_PHASE_6_INGAME_SUBSTEP_COPY = [
    {
        bodyPc:
            '시간이 흘러가기 시작했습니다. 싱글플레이에서는 시간이 무제한이지만 다른 종류의 경기에서는 시간제한이 생길 수 있습니다.',
        bodyMobile:
            '시간이 흘러가기 시작했습니다. 싱글은 무제한이나, 다른 경기에서는 제한이 생길 수 있습니다.',
    },
    {
        bodyPc: '목표 점수가 표시되고 남은 턴이 표시됩니다.',
        bodyMobile: '목표 점수와 남은 턴이 표시됩니다.',
    },
    {
        bodyPc: '흰 돌의 마지막 활로를 막아서 따내며 1점을 획득해 보세요.',
        bodyMobile: '흰 돌 마지막 활로를 막아 따내고 1점을 획득하세요.',
    },
] as const;

/** phase 7(인게임 입문-1 결과 모달): 0=보상 패널 안내, 1=대기실로 버튼만 */
export const ONBOARDING_PHASE_7_SP_RESULT_MODAL_SUBSTEP_COPY = [
    {
        title: '대기실로',
        bodyPc: ONBOARDING_INTRO1_RESULT_REWARD_BODY_PC,
        bodyMobile: ONBOARDING_INTRO1_RESULT_REWARD_BODY_MOBILE,
    },
    {
        title: '대기실로',
        bodyPc: '대기실로 이동해 보세요.',
        bodyMobile: '대기실로 이동해 보세요.',
        omitPrimary: true,
    },
] as const;

/** 입문-1 + 온보딩 phase 6 서브 2: 첫 한 수를 강제 교차점으로 제한 */
export function shouldRestrictIntro1OnboardingFirstMove(args: {
    stageId?: string;
    gameStatus: string;
    userPhase: number;
    ingameSubStep: number;
    demoMoveDone: boolean;
    moveHistoryLength: number;
}): boolean {
    const { stageId, gameStatus, userPhase, ingameSubStep, demoMoveDone, moveHistoryLength } = args;
    return (
        stageId === '입문-1' &&
        gameStatus === 'playing' &&
        userPhase === 6 &&
        ingameSubStep === 2 &&
        !demoMoveDone &&
        moveHistoryLength === 0
    );
}

/**
 * 튜토리얼 단계별로 강조할 DOM 타깃.
 * - 네이티브 모바일: 하단 독(바둑학원·탑) 등 셸 전용 타깃
 * - 그 외: 프로필 카드·스테이지 그리드 등
 *
 * phase 8(수련과제) 서브: 0=출석 카드 설명, 1=시작 버튼, 2=다음 과제 카드, 3=홈 이동(뒤로/홈)
 */
export const ONBOARDING_PHASE_8_TRAINING_SUBSTEP_COPY = [
    {
        title: '수련과제',
        bodyPc:
            '대기실에서 수련과제를 눌러 「시작하기」를 하면 시간이 지남에 따라 골드가 생산됩니다.',
        bodyMobile:
            '대기실에서 수련과제를 눌러 「시작하기」를 하면 시간이 지남에 따라 골드가 생산됩니다.',
    },
    {
        title: '수련과제',
        bodyPc: '「시작하기」 버튼을 눌러보세요.',
        bodyMobile: '「시작하기」 버튼을 눌러보세요.',
    },
    {
        title: '수련과제',
        bodyPc: '다음 과제는 입문 스테이지 20 클리어 후 열립니다.',
        bodyMobile: '다음 과제는 입문 스테이지 20 클리어 후 열립니다.',
    },
    {
        title: '수련과제',
        bodyPc: '홈 화면으로 이동해보세요. 상단의 뒤로가기를 누르면 됩니다.',
        bodyMobile: '홈 화면으로 이동해보세요. 하단의 「홈」을 누르면 됩니다.',
    },
] as const;

/** phase 9(가방): 0=퀵 가방, 1=부채 칸, 2=장착, 3=능력치·프리셋, 4=닫기 */
export const ONBOARDING_PHASE_9_BAG_SUBSTEP_COPY = [
    {
        title: '가방',
        bodyPc: '가방이 열렸습니다. 가방 아이콘을 눌러보세요.',
        bodyMobile: '가방이 열렸습니다. 가방 아이콘을 눌러보세요.',
    },
    {
        title: '가방',
        bodyPc: '가방에 들어와 있는 부채 장비를 클릭하세요.',
        bodyMobile: '가방에 들어와 있는 부채 장비를 클릭하세요.',
    },
    {
        title: '가방',
        bodyPc: '장비를 장착해 보세요.',
        bodyMobile: '장비를 장착해 보세요.',
    },
    {
        title: '가방',
        bodyPc:
            '능력치가 올라간 것을 확인해 보세요. 바둑에 필요한 이 여섯 가지 능력치는 챔피언십 경기장에서 자동 시뮬레이션 경기를 진행할 때 능력을 발휘합니다.',
        bodyMobile:
            '능력치가 올라간 것을 확인해 보세요. 이 여섯 가지 능력치는 챔피언십 경기장의 자동 시뮬레이션에서 발휘됩니다.',
    },
    {
        title: '가방',
        bodyPc: '닫기 버튼으로 가방을 닫아 보세요.',
        bodyMobile: '닫기 버튼으로 가방을 닫아 보세요.',
    },
] as const;

export function resolveOnboardingSpotlightTarget(
    phase: number,
    opts: {
        isNativeMobile: boolean;
        phase5GameDescSubStep?: number;
        phase6IngameSubStep?: number;
        /** phase 7 + 싱글 결과 모달 튜토리얼 (0~2) */
        spResultTutorialStep?: number;
        /** phase 8 수련과제 튜토리얼 서브스텝 (0~3) */
        phase8TrainingSubStep?: number;
        /** phase 9 가방 튜토리얼 서브스텝 (0~4) */
        phase9BagSubStep?: number;
    },
): OnboardingSpotlightTargetId | null {
    const {
        isNativeMobile,
        phase5GameDescSubStep = 0,
        phase6IngameSubStep = 0,
        spResultTutorialStep,
        phase8TrainingSubStep = 0,
        phase9BagSubStep = 0,
    } = opts;
    switch (phase) {
        case 0:
            return 'onboarding-home-profile';
        case 1:
            return isNativeMobile ? 'onboarding-dock-sp' : 'onboarding-sp-home-card';
        case 2:
            return 'onboarding-sp-stage-1';
        case 3:
            return 'onboarding-header-ap';
        case 4:
            return 'onboarding-sp-stage-1';
        case 5: {
            if (phase5GameDescSubStep === 0) return 'onboarding-sp-pregame-winlose';
            if (phase5GameDescSubStep === 1) return 'onboarding-sp-pregame-rest';
            return 'onboarding-sp-pregame-body';
        }
        case 6: {
            if (phase6IngameSubStep === 0) return 'onboarding-sp-ingame-user-panel';
            if (phase6IngameSubStep === 1) return 'onboarding-sp-ingame-scores-bar';
            return null;
        }
        case 7: {
            const s = spResultTutorialStep;
            if (s === 0) return 'onboarding-sp-summary-rewards';
            if (s === 1) return 'onboarding-sp-summary-lobby';
            return null;
        }
        case 8: {
            if (phase8TrainingSubStep <= 1) {
                return phase8TrainingSubStep === 0
                    ? 'onboarding-sp-training-quest-1-card'
                    : 'onboarding-sp-training-quest-1-start';
            }
            if (phase8TrainingSubStep === 2) return 'onboarding-sp-training-quest-2-card';
            return isNativeMobile ? 'onboarding-dock-home' : 'onboarding-sp-lobby-back';
        }
        case 9: {
            switch (phase9BagSubStep) {
                case 0:
                    return 'onboarding-quick-bag';
                case 1:
                    return 'onboarding-inv-fan-slot';
                case 2:
                    return 'onboarding-inv-equip-button';
                case 3:
                    return 'onboarding-inv-equipped-stats-preset';
                case 4:
                    return 'onboarding-inv-equipment-modal-shell';
                default:
                    return 'onboarding-quick-bag';
            }
        }
        case 10:
            return 'onboarding-home-championship-card';
        case 11:
            return isNativeMobile ? 'onboarding-dock-tower' : 'onboarding-tower-card';
        case 12:
            return 'onboarding-home-pvp-arenas';
        case 13:
            return 'onboarding-home-adventure-card';
        case 14:
            return null;
        default:
            return null;
    }
}

export function canAdvanceOnboardingTutorialPhase(user: User, target: number): boolean {
    if (user.isAdmin && Number.isFinite(target) && target >= 0 && target <= ONBOARDING_PHASE_COMPLETE) {
        return true;
    }
    if (!isOnboardingTutorialActive(user)) return false;
    const cur = user.onboardingTutorialPhase ?? 0;
    if (target === ONBOARDING_PHASE_COMPLETE) {
        if (user.isAdmin) return cur >= ONBOARDING_LAST_TUTORIAL_PHASE;
        /** 일반 유저는 `FINISH_ONBOARDING_TUTORIAL_WITH_REWARD`로만 완료 처리 */
        return false;
    }
    if (cur === 7 && target === 8) {
        return (user.onboardingSpResultTutorialStep ?? -1) === 1;
    }
    if (target === cur + 1 && target < ONBOARDING_PHASE_COMPLETE) {
        return true;
    }
    return false;
}

/**
 * 신규 튜토리얼 중에는 홈·독에서 일부 경기장 입장을 막는다 (서버 KV와 AND).
 */
export function applyOnboardingArenaEntranceTutorialLocks(
    merged: Record<ArenaEntranceKey, boolean>,
    user: User,
): Record<ArenaEntranceKey, boolean> {
    if (!isOnboardingTutorialActive(user)) return merged;
    const p = user.onboardingTutorialPhase ?? 0;
    const out: Record<ArenaEntranceKey, boolean> = { ...merged };

    const lockTowerStrategicPlayfulAdventure = () => {
        out.tower = false;
        out.strategicLobby = false;
        out.playfulLobby = false;
        out.adventure = false;
    };

    if (p < 9) {
        lockTowerStrategicPlayfulAdventure();
        out.championship = false;
    } else if (p < 14) {
        lockTowerStrategicPlayfulAdventure();
        out.championship = merged.championship;
    } else {
        return { ...merged };
    }

    out.singleplayer = merged.singleplayer;
    return out;
}

export type OnboardingTutorialStepCopy = {
    title: string;
    bodyPc: string;
    bodyMobile: string;
    /** 주 버튼 없이 닫기만 */
    omitPrimary?: boolean;
};

/** 0단계(프로필 확인): 두 화면 각각 「다음」으로 진행 */
export const ONBOARDING_PHASE_0_PROFILE_SUBSTEPS = [
    {
        bodyPc:
            '프로필 영역에서 프로필 이미지 및 프로필 테두리, MBTI 설정을 할 수 있습니다. 특히 MBTI 설정을 하면 다이아 보상을 받을 수 있으니 꼭 설정해보세요.',
        bodyMobile:
            '프로필 영역에서 이미지·테두리·MBTI를 설정할 수 있습니다. MBTI를 설정하면 다이아 보상이 있으니 꼭 설정해보세요.',
    },
    {
        bodyPc:
            '레벨 및 경험치, 매너 등급과 레벨이 오르면 길드에 가입하여 각종 콘텐츠에 참여할 수 있으니 레벨을 올려보세요. 매너 점수는 추후 전략바둑 PVP를 하며 매너 액션을 통해 올리거나 감점될 수 있습니다. 매너 점수가 낮으면 불이익이 많고 매너 점수가 높으면 추가 효과가 생기니 매너 점수를 꼭 관리해보세요.',
        bodyMobile:
            '레벨·경험치·매너가 오르면 길드 가입 후 콘텐츠에 참여할 수 있으니 레벨을 올려보세요. 추후 전략바둑 PVP에서 매너 액션으로 매너 점수가 오르거나 줄어듭니다. 낮으면 불이익, 높으면 이점이 있으니 꼭 관리해보세요.',
    },
] as const;

export const ONBOARDING_TUTORIAL_PROFILE_INTRO_TITLE = '프로필 확인';

export const ONBOARDING_TUTORIAL_STEP_COPY: Record<number, OnboardingTutorialStepCopy> = {
    0: {
        title: ONBOARDING_TUTORIAL_PROFILE_INTRO_TITLE,
        bodyPc: ONBOARDING_PHASE_0_PROFILE_SUBSTEPS[0].bodyPc,
        bodyMobile: ONBOARDING_PHASE_0_PROFILE_SUBSTEPS[0].bodyMobile,
    },
    1: {
        title: '바둑학원으로',
        bodyPc:
            '이제 싱글플레이(바둑학원)을 플레이하며 기본적인 플레이 방식을 익혀봅시다. [바둑학원] 입장 카드를 눌러 이동해보세요.',
        bodyMobile:
            '이제 싱글플레이(바둑학원)을 플레이하며 기본적인 플레이 방식을 익혀봅시다. 하단 [바둑학원] 탭을 눌러 이동해보세요.',
        omitPrimary: true,
    },
    2: {
        title: '행동력(입장)',
        bodyPc:
            '스테이지 카드의 입장 버튼에 표시된 숫자는 소모 행동력입니다. 첫 클리어 전에만 차감되고, 이미 클리어한 스테이지는 무료로 다시 도전할 수 있습니다. 단, 보상은 추가로 수령할 수 없습니다.',
        bodyMobile:
            '입장 버튼 옆 숫자가 필요 행동력입니다. 최초 클리어 전에만 소모됩니다. 단, 보상은 추가로 수령할 수 없습니다.',
    },
    3: {
        title: '행동력(헤더)',
        bodyPc:
            '화면 상단 헤더에서 현재 행동력과 최대치를 확인할 수 있습니다. 시간이 지나면 서서히 회복됩니다. 추후 장비나 매너등급, VIP 기능을 통해 최대치를 늘리거나 행동력 회복속도를 빠르게 할 수 있습니다.',
        bodyMobile:
            '상단 헤더에서 행동력과 최대치를 확인할 수 있습니다. 시간이 지나면 회복됩니다. 추후 장비·매너등급·VIP로 최대치를 늘리거나 회복 속도를 높일 수 있습니다.',
    },
    4: {
        title: '싱글플레이(바둑학원)입장',
        bodyPc: '첫 스테이지에 입장해보겠습니다.',
        bodyMobile: '첫 스테이지에 입장해보겠습니다.',
        omitPrimary: true,
    },
    5: {
        title: '경기 설명 창',
        bodyPc: '입장하면 경기 규칙·목표가 정리된 설명 창이 뜹니다. 내용을 훑은 뒤 「경기 시작」을 눌러 첫 수를 두세요.',
        bodyMobile: '설명 창에서 규칙을 확인한 뒤 「경기 시작」을 누르세요.',
    },
    6: {
        title: '첫 승리',
        bodyPc: '목표 점수를 달성해 승리하면 결과 창이 열립니다.',
        bodyMobile: '목표 점수를 달성해 승리하면 결과 창이 열립니다.',
        /** 판 조작을 막지 않음 */
        omitPrimary: true,
    },
    7: {
        title: '대기실로',
        bodyPc: '결과를 확인한 뒤 「나가기」로 바둑학원 대기실로 돌아가세요. 곧 수련과제가 열립니다.',
        bodyMobile: '「나가기」로 대기실로 돌아가세요.',
    },
    8: {
        title: ONBOARDING_PHASE_8_TRAINING_SUBSTEP_COPY[0].title,
        bodyPc: ONBOARDING_PHASE_8_TRAINING_SUBSTEP_COPY[0].bodyPc,
        bodyMobile: ONBOARDING_PHASE_8_TRAINING_SUBSTEP_COPY[0].bodyMobile,
    },
    9: {
        title: ONBOARDING_PHASE_9_BAG_SUBSTEP_COPY[0].title,
        bodyPc: ONBOARDING_PHASE_9_BAG_SUBSTEP_COPY[0].bodyPc,
        bodyMobile: ONBOARDING_PHASE_9_BAG_SUBSTEP_COPY[0].bodyMobile,
    },
    10: {
        title: '챔피언십',
        bodyPc:
            '챔피언십 경기장에서 바둑 능력치를 이용한 대회에 참가하여 골드 및 강화 재료, 장비 등을 얻을 수 있습니다. (3개의 경기장, 하루에 각각 1회 참여 가능)',
        bodyMobile:
            '챔피언십에서 능력치 기반 대회에 참가해 보상을 얻으세요. 3개 경기장, 하루 각 1회 참여 가능합니다.',
    },
    11: {
        title: '도전의 탑',
        bodyPc: '매월 1일 초기화되는 도전의 탑에 도전하여 보상을 획득하세요.',
        bodyMobile: '매월 1일 초기화되는 도전의 탑에 도전하여 보상을 획득하세요.',
    },
    12: {
        title: '전략·놀이 바둑',
        bodyPc:
            'PVP 경기장으로 친선전 및 랭킹전을 할 수 있고 AI와 대결도 할 수 있습니다. 전략 바둑에는 클래식 바둑뿐만 아니라 각종 아이템을 활용하는 아이템전이 있습니다. 놀이 바둑에서는 알까기, 바둑 컬링, 오목, 따목, 주사위를 이용한 게임 등 바둑으로 할 수 있는 놀이 게임을 즐기실 수 있습니다.',
        bodyMobile:
            'PVP·랭킹·AI 대국, 전략(클래식·아이템전), 놀이(알까기·컬링·오목·따목·주사위 등)를 즐기실 수 있습니다.',
    },
    13: {
        title: '모험',
        bodyPc:
            '모험을 통해 각종 맵에서 몬스터와 바둑 시합을 하며 골드 및 장비, 재료를 얻고, 이해도에 따라 추가 능력치 성장을 할 수 있습니다.',
        bodyMobile: '맵에서 몬스터와 바둑 시합으로 재화·장비·재료와 이해도 기반 능력치 성장을 노리세요.',
    },
    14: {
        title: 'SUDAM을 즐겨 주세요',
        bodyPc:
            '다양한 게임을 AI와 즐기거나 PVP를 즐기며 SUDAM에서 행복한 시간 보내세요!',
        bodyMobile:
            '다양한 게임을 AI와 즐기거나 PVP를 즐기며 SUDAM에서 행복한 시간 보내세요!',
    },
};
