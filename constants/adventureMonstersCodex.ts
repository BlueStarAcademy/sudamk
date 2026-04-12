import { CoreStat } from '../types/enums.js';

/** 챕터 보스 전용: 이해도 레벨마다 +5% (최대 Lv10 → +50%). 일반 도감 보너스와는 별도 합산 */
export type AdventureCodexPercentBossBonus =
    | { target: 'core'; stat: CoreStat }
    | { target: 'adventureGold' }
    | { target: 'itemDrop' }
    | { target: 'materialDrop' }
    | { target: 'highGradeEquipment' }
    | { target: 'highGradeMaterial' };

/** 모험 맵 몬스터 도감 — 개별 webp 경로 + 이름 + 설명 (챕터별 폴더: public/images/monster/<stageId>/) */
export type AdventureMonsterCodexEntry = {
    /** 도감 이해도·전적 연동용 고정 ID */
    codexId: string;
    imageWebp: string;
    name: string;
    codexDescription: string;
    /** 챕터당 2마리(놀이동산 3마리): % 보너스 담당 보스 */
    codexPercentBossBonus?: AdventureCodexPercentBossBonus;
    /** 놀이동산 19줄 판·고보상 전용 유니크 보스 (`shared/utils/adventureBattleBoard`의 `ADVENTURE_BOSS_CODEX_IDS`와 id 일치) */
    isAdventureBoss?: boolean;
};

const hill = '/images/monster/neighborhood_hill';
const lake = '/images/monster/lake_park';
const aqua = '/images/monster/aquarium';
const zoo = '/images/monster/zoo';
const amuse = '/images/monster/amusement_park';

export const ADVENTURE_MONSTERS_NEIGHBORHOOD_HILL = [
    {
        codexId: 'hill_01',
        imageWebp: `${hill}/forestmon_01.webp`,
        name: '목돌이',
        codexDescription: '나무 그늘에 몸을 맡긴 듯 단단한 목질 껍질을 두른 친구예요. 지나가는 사람이 스칠 때만 살짝 구르는 척하며 장난을 즐깁니다.',
    },
    {
        codexId: 'hill_02',
        imageWebp: `${hill}/forestmon_02.webp`,
        name: '하얀이',
        codexDescription: '눈 덮인 밤길처럼 하얀 몸빛이 특징이에요. 숨바꼭질 대회에서 “어디 있지?”를 가장 오래 들어본 기록 보유자입니다.'
    },
    {
        codexId: 'hill_03',
        imageWebp: `${hill}/forestmon_03.webp`,
        name: '판부엉',
        codexDescription: '넓은 판 얼굴에 부엉부엉 분위기가 배어 있는 타입이에요. 밤이 되면 나뭇가지 위에서 방향만 틀려도 진지하게 서성입니다.'
    },
    {
        codexId: 'hill_04',
        imageWebp: `${hill}/forestmon_04.webp`,
        name: '검돌이',
        codexDescription: '겉은 시커멓게 묻었는데 속은 따뜻한 돌덩이 기질이에요. 말 걸면 한참 뒤에야 천천히 고개를 끄덕이는 느긋함이 매력입니다.'
    },
    {
        codexId: 'hill_05',
        imageWebp: `${hill}/forestmon_05.webp`,
        name: '흰둥판이',
        codexDescription: '통통한 흰 덩어리에 납작한 판 무늬가 겹쳐 귀여움이 두 배예요. 비 온 뒤 웅덩이에서 거울놀이하다가 스스로에게 반해버리곤 합니다.'
    },
    {
        codexId: 'hill_06',
        imageWebp: `${hill}/forestmon_06.webp`,
        name: '검둥판이',
        codexDescription: '흰둥판이의 그림자 버전처럼 보이지만 성격은 더 담백하고 츤츤해요. 진흙탕에서 굴러도 표정이 안 변하는 프로페셔널입니다.'
    },
    {
        codexId: 'hill_07',
        imageWebp: `${hill}/forestmon_07.webp`,
        name: '새싹돌이',
        codexDescription: '머리에 새싹을 꽂은 줄 알았더니 진짜 돌인데 잎이 나는 타입이에요. 봄이 오면 흥이 올라 산책로를 따라 동동 굴러다닙니다.'
    },
    {
        codexId: 'hill_08',
        imageWebp: `${hill}/forestmon_08.webp`,
        name: '돌숨이',
        codexDescription: '숨 쉴 때마다 자갈이 바스락거린다는 헛소문이 돌아요. 실제로는 조용히 숲바람만 훔쳐보는 소심한 관찰자입니다.'
    },
    {
        codexId: 'hill_09',
        imageWebp: `${hill}/forestmon_09.webp`,
        name: '돌지기',
        codexDescription: '산길을 지키는 돌 지킴이 느낌이 물씬 나요. 지도 앱이 틀려도 이 친구만 따라가면 덤불은 대체로 피할 수 있습니다.',
        codexPercentBossBonus: { target: 'core', stat: CoreStat.Concentration },
    },
    {
        codexId: 'hill_10',
        imageWebp: `${hill}/forestmon_10.webp`,
        name: '돌줍이',
        codexDescription: '예쁜 돌맹이만 골라 주머니에 넣는 수집가예요. 다른 몬스터에게도 “이거 네 얼굴 닮았다”며 선물하는 친절함이 있습니다.'
    },
    {
        codexId: 'hill_11',
        imageWebp: `${hill}/forestmon_11.webp`,
        name: '토판이',
        codexDescription: '흙과 돌이 한데 뭉쳐 태어난 납작이예요. 비 피할 때 나무 뒤에 딱 붙어 위장술이 특기입니다.'
    },
    {
        codexId: 'hill_12',
        imageWebp: `${hill}/forestmon_12.webp`,
        name: '이끼판왕',
        codexDescription: '숲 끝자락에서 군림하는 이끼 왕관의 주인이에요. 천천히 기어가도 위엄만큼은 빠릅니다.',
        codexPercentBossBonus: { target: 'adventureGold' },
    },
] as const satisfies readonly AdventureMonsterCodexEntry[];

export const ADVENTURE_MONSTERS_LAKE_PARK = [
    {
        codexId: 'lake_01',
        imageWebp: `${lake}/lakesideparkmon_01.webp`,
        name: '수호판이',
        codexDescription: '연못가 수초 사이를 순찰하는 수호 형이에요. 물방울이 튀어도 표정은 경비원 그 자체입니다.',
        codexPercentBossBonus: { target: 'core', stat: CoreStat.Stability },
    },
    {
        codexId: 'lake_02',
        imageWebp: `${lake}/lakesideparkmon_02.webp`,
        name: '방울돌',
        codexDescription: '몸에서 잔잔한 방울 소리가 난다고 믿는 아이들이 많아요. 사실은 발 구르는 박자가 리듬을 만드는 타입입니다.'
    },
    {
        codexId: 'lake_03',
        imageWebp: `${lake}/lakesideparkmon_03.webp`,
        name: '오리판이',
        codexDescription: '물 위를 걷지 않고 납작하게 미끄러지는 게 특기예요. 떡 하나 주면 하루 종일 따라오는 의리파입니다.'
    },
    {
        codexId: 'lake_04',
        imageWebp: `${lake}/lakesideparkmon_04.webp`,
        name: '낚돌이',
        codexDescription: '낚싯바늘만 보이면 반사적으로 달려가 물고기인 척해요. 낚시꾼은 환호하고 돌만 덜렁 건지는 코미디가 자주 열립니다.'
    },
    {
        codexId: 'lake_05',
        imageWebp: `${lake}/lakesideparkmon_05.webp`,
        name: '개굴판이',
        codexDescription: '개구리와 납작판의 조합 같은 분위기예요. 밤에 울음 대신 물컹한 “쿠루루”를 보내는 루머가 있습니다.'
    },
    {
        codexId: 'lake_06',
        imageWebp: `${lake}/lakesideparkmon_06.webp`,
        name: '꽃판이',
        codexDescription: '연못가 꽃밭에서 색을 빌려 입는 패셔니스타예요. 바람 불면 꽃잎 대신 몸이 펄럭이는 착각을 일으킵니다.'
    },
    {
        codexId: 'lake_07',
        imageWebp: `${lake}/lakesideparkmon_07.webp`,
        name: '조개돌이',
        codexDescription: '조개껍질처럼 반짝이는 등을 가졌지만 속은 순한 돌하트예요. 조약돌 친구들과 모래사장에서 소소하게 모입니다.'
    },
    {
        codexId: 'lake_08',
        imageWebp: `${lake}/lakesideparkmon_08.webp`,
        name: '호수판왕',
        codexDescription: '이 구역 호수의 대장 포지션이에요. 물결 무늬 망토를 두르고 은은하게 반짝입니다.',
        codexPercentBossBonus: { target: 'materialDrop' },
    },
    {
        codexId: 'lake_09',
        imageWebp: `${lake}/lakesideparkmon_09.webp`,
        name: '흑물돌',
        codexDescription: '깊은 물빛을 머금은 듯 어둑한 몸빛이에요. 가까이 가면 물고기 냄새 대신 산뜻한 이슬 냄새가 난다고 합니다.'
    },
    {
        codexId: 'lake_10',
        imageWebp: `${lake}/lakesideparkmon_10.webp`,
        name: '달팽판이',
        codexDescription: '천천히, 그러나 확실히 목표를 향해 미끄러져요. 껍질 대신 납작한 판이 등을 덮었다는 설정이 귀엽습니다.'
    },
    {
        codexId: 'lake_11',
        imageWebp: `${lake}/lakesideparkmon_11.webp`,
        name: '겹판이',
        codexDescription: '판이 여러 겹이라 그림자도 겹쳐 보여요. 햇살 아래서 무지개 얇은 막이 생기는 마법 같은 아이입니다.',
    },
] as const satisfies readonly AdventureMonsterCodexEntry[];

export const ADVENTURE_MONSTERS_AQUARIUM = [
    {
        codexId: 'aqua_01',
        imageWebp: `${aqua}/aquariummon_01.webp`,
        name: '젤리판이',
        codexDescription: '투명에 가까운 몸과 통통한 탄력이 매력이에요. 콕 찌르면 도로아미타불이지만 기분은 좋다는 후기가 많습니다.'
    },
    {
        codexId: 'aqua_02',
        imageWebp: `${aqua}/aquariummon_02.webp`,
        name: '샤크돌',
        codexDescription: '상어의 기세를 빌린 돌덩이예요. 이빨은 없지만 눈빛만으로 압도하는 연출이 특기입니다.'
    },
    {
        codexId: 'aqua_03',
        imageWebp: `${aqua}/aquariummon_03.webp`,
        name: '코랄판이',
        codexDescription: '산호 가지처럼 삐죽한 윤곽이지만 만지면 부드러워요. 수조 불빛에 따라 색이 바뀌는 변신 쇼를 보여 줍니다.'
    },
    {
        codexId: 'aqua_04',
        imageWebp: `${aqua}/aquariummon_04.webp`,
        name: '집게판이',
        codexDescription: '집게발이 달린 줄 알았더니 장난스럽게 꼬인 판이에요. 장난감 바닥에 떨어진 집게랑 영원한 단짝이라는 소문이 있습니다.',
        codexPercentBossBonus: { target: 'core', stat: CoreStat.Judgment },
    },
    {
        codexId: 'aqua_05',
        imageWebp: `${aqua}/aquariummon_5.webp`,
        name: '수달돌',
        codexDescription: '장난기 넘치는 수달의 영혼을 담은 돌이에요. 물장구만 생각하고 공부는 내일로 미루는 타입입니다.'
    },
    {
        codexId: 'aqua_06',
        imageWebp: `${aqua}/aquariummon_6.webp`,
        name: '조개판이',
        codexDescription: '조개를 연상시키는 반짝 라인이 몸 전체를 감싸요. 해변가 노래를 흥얼거리며 산책하는 기분을 낸다고 합니다.'
    },
    {
        codexId: 'aqua_07',
        imageWebp: `${aqua}/aquariummon_7.webp`,
        name: '물판이',
        codexDescription: '물방울이 얼어붙은 형태처럼 보이는 매끈한 표면이에요. 습기 많은 날 더 반짝이는 계절 한정 스킨을 가졌습니다.'
    },
    {
        codexId: 'aqua_08',
        imageWebp: `${aqua}/aquariummon_8.webp`,
        name: '등분판이',
        codexDescription: '등 쪽 줄무늬가 자연스럽게 반반 무늬를 만들어요. 옆에서 보면 작은 물고기 같기도 한 착시의 달인입니다.'
    },
    {
        codexId: 'aqua_09',
        imageWebp: `${aqua}/aquariummon_9.webp`,
        name: '복돌이',
        codexDescription: '복스러운 통통함과 돌의 묵직함이 공존해요. 배를 두드리면 물방울이 튀어나올 것 같은 착각을 선물합니다.'
    },
    {
        codexId: 'aqua_10',
        imageWebp: `${aqua}/aquariummon_10.webp`,
        name: '전복판이',
        codexDescription: '전복 껍질 무늬를 두른 납작이예요. 천천히 기어가도 맛은 없으니 안심하라는 공식 안내가 붙어 있습니다.'
    },
    {
        codexId: 'aqua_11',
        imageWebp: `${aqua}/aquariummon_11.webp`,
        name: '스타판이',
        codexDescription: '다섯 갈래 별처럼 빛나는 윤곽이에요. 밤 수조에서는 길 잃은 손님에게 별빛 안내등 노릇을 합니다.',
        codexPercentBossBonus: { target: 'itemDrop' },
    },
] as const satisfies readonly AdventureMonsterCodexEntry[];

export const ADVENTURE_MONSTERS_AMUSEMENT_PARK = [
    {
        codexId: 'amuse_01',
        imageWebp: `${amuse}/amusementmon_01.webp`,
        name: '회전목돌',
        codexDescription: '돌아가는 목마의 영혼이 들어간 듯한 원형 기세예요. 서 있기만 해도 어지러운 친구라 멀리서 응원하는 게 안전합니다.'
    },
    {
        codexId: 'amuse_02',
        imageWebp: `${amuse}/amusementmon_02.webp`,
        name: '찻잔판이',
        codexDescription: '찻잔 받침처럼 단정한 몸선이 특징이에요. 티타임이 종목이었다면 금메달 후보라는 농담이 따라붙습니다.'
    },
    {
        codexId: 'amuse_03',
        imageWebp: `${amuse}/amusementmon_03.webp`,
        name: '범퍼판이',
        codexDescription: '부딪히면 튕겨 나가는 대신 웃음이 튕겨 나와요. 줄 서 있는 건 싫어하고 곡선만 달리는 자유 영혼입니다.'
    },
    {
        codexId: 'amuse_04',
        imageWebp: `${amuse}/amusementmon_04.webp`,
        name: '조커돌',
        codexDescription: '장난 카드 한 장이 튀어나올 것 같은 분위기예요. 진지한 대화 중에 갑자기 딴소리를 권하는 장난꾸러기입니다.'
    },
    {
        codexId: 'amuse_05',
        imageWebp: `${amuse}/amusementmon_05.webp`,
        name: '뽑기돌',
        codexDescription: '뽑기 기계 앞에서만큼은 운명을 믿는 낙관주의자예요. 꽝이 나와도 “다음엔 대박”이라 외치며 줄을 다시 섭니다.',
        codexPercentBossBonus: { target: 'core', stat: CoreStat.Calculation },
    },
    {
        codexId: 'amuse_06',
        imageWebp: `${amuse}/amusementmon_06.webp`,
        name: '풍선판이',
        codexDescription: '둥둥 뜨는 기분을 몸 전체로 표현해요. 바람 불면 따라 흔들리며 멜로디를 상상합니다.'
    },
    {
        codexId: 'amuse_07',
        imageWebp: `${amuse}/amusementmon_07.webp`,
        name: '카니발돌',
        codexDescription: '불꽃과 리본이 머릿속에서 터지는 타입이에요. 밤에 네온만 보면 저절로 박자를 탑니다.',
        codexPercentBossBonus: { target: 'core', stat: CoreStat.ThinkingSpeed },
    },
    {
        codexId: 'amuse_08',
        imageWebp: `${amuse}/amusementmon_08.webp`,
        name: '두들돌',
        codexDescription: '리듬감 좋은 돌이에요. 지나가다 발에 밟히면 “탁탁” 인사하고 지나갑니다.'
    },
    {
        codexId: 'amuse_09',
        imageWebp: `${amuse}/amusementmon_09.webp`,
        name: '스타돌',
        codexDescription: '무대 조명을 한 몸에 받은 듯한 반짝임이에요. 사인펜으로 낙서하면 화내지 않고 웃긴 낙서로 바꿔 준다는 전설이 있습니다.',
        codexPercentBossBonus: { target: 'highGradeEquipment' },
        isAdventureBoss: true,
    },
] as const satisfies readonly AdventureMonsterCodexEntry[];

export const ADVENTURE_MONSTERS_ZOO = [
    {
        codexId: 'zoo_01',
        imageWebp: `${zoo}/zoomon_01.webp`,
        name: '롱목돌',
        codexDescription: '목이 길어서 멀리 구경하기 좋아요. 안 본 척해도 다 보고 있는 스파이 감성입니다.'
    },
    {
        codexId: 'zoo_02',
        imageWebp: `${zoo}/zoomon_02.webp`,
        name: '사자판이',
        codexDescription: '갈기처럼 삐죽한 윤곽이 당당함을 말해 줘요. 사실 속은 초식 성향으로 배려 깊은 반전이 있습니다.',
        codexPercentBossBonus: { target: 'core', stat: CoreStat.CombatPower },
    },
    {
        codexId: 'zoo_03',
        imageWebp: `${zoo}/zoomon_03.webp`,
        name: '판판이',
        codexDescription: '‘판’자가 두 번이라 더 납작해야 할 압박이 있어요. 그래도 자존감은 지구 반쪽입니다.'
    },
    {
        codexId: 'zoo_04',
        imageWebp: `${zoo}/zoomon_04.webp`,
        name: '코판이',
        codexDescription: '후각에 자신 있는 코가 포인트예요. 지나가는 간식 냄새는 절대 놓치지 않습니다.'
    },
    {
        codexId: 'zoo_05',
        imageWebp: `${zoo}/zoomon_05.webp`,
        name: '숭이판이',
        codexDescription: '장난꾸러기 기질과 납작한 매력이 공존해요. 나무 위에서 바나나 냄새만 맡아도 신납니다.'
    },
    {
        codexId: 'zoo_06',
        imageWebp: `${zoo}/zoomon_06.webp`,
        name: '하마판이',
        codexDescription: '묵직하게 앉아 있으면 벤치처럼 보여요. 진짜 벤치 대신 이 친구 옆에 앉으면 분위기가 삽니다.'
    },
    {
        codexId: 'zoo_07',
        imageWebp: `${zoo}/zoomon_07.webp`,
        name: '빙판이',
        codexDescription: '차가운 반짝임이 아니라 시원한 미소의 빙수 같은 아이예요. 여름에 인기가 폭발합니다.'
    },
    {
        codexId: 'zoo_08',
        imageWebp: `${zoo}/zoomon_08.webp`,
        name: '야행돌',
        codexDescription: '밤 행성이 끌리는 타입이에요. 달이 뜨면 산책 코스를 혼자 개척합니다.',
        codexPercentBossBonus: { target: 'highGradeMaterial' },
    },
    {
        codexId: 'zoo_09',
        imageWebp: `${zoo}/zoomon_09.webp`,
        name: '장수돌',
        codexDescription: '오래도록 옆에 두고 싶은 묵직한 인연을 상징해요. 말은 적어도 배려는 깊습니다.'
    },
    {
        codexId: 'zoo_10',
        imageWebp: `${zoo}/zoomon_10.webp`,
        name: '거북판이',
        codexDescription: '천천히, 그러나 끝까지 가는 끈기가 있어요. 등 껍질이 판처럼 넓어 작은 친구를 그늘에 태워 줍니다.'
    },
    {
        codexId: 'zoo_11',
        imageWebp: `${zoo}/zoomon_11.webp`,
        name: '별판이',
        codexDescription: '동물원 밤하늘의 별을 닮은 몸빛이에요. 가이드가 없어도 길 잃으면 이 친구를 찾으면 된다는 농담이 있습니다.',
    },
] as const satisfies readonly AdventureMonsterCodexEntry[];

const ALL_ADVENTURE_CODEX_MONSTERS: readonly AdventureMonsterCodexEntry[] = [
    ...ADVENTURE_MONSTERS_NEIGHBORHOOD_HILL,
    ...ADVENTURE_MONSTERS_LAKE_PARK,
    ...ADVENTURE_MONSTERS_AQUARIUM,
    ...ADVENTURE_MONSTERS_ZOO,
    ...ADVENTURE_MONSTERS_AMUSEMENT_PARK,
];

/** 대국 UI·결과 모달: 출현 몬스터 도감 정보 */
export function getAdventureCodexMonsterById(codexId: string): AdventureMonsterCodexEntry | undefined {
    return ALL_ADVENTURE_CODEX_MONSTERS.find((m) => m.codexId === codexId);
}

/** 도감 `codexPercentBossBonus` 보유 = 챕터 보스(맵 공격 AP·도감 보스 보너스 기준) */
export function isAdventureChapterBossCodexId(codexId: string): boolean {
    const row = ALL_ADVENTURE_CODEX_MONSTERS.find((m) => m.codexId === codexId);
    return !!(row && 'codexPercentBossBonus' in row && row.codexPercentBossBonus);
}

/**
 * 모험 맵에서 해당 몬스터와 대국 시 소모 행동력.
 * Ch1 일반 2·보스 3 / Ch2–3 일반 3·보스 4 / Ch4–5 일반 3·보스 5
 */
export function getAdventureMonsterAttackActionPointCost(stageIndex: number, codexId: string): number {
    const boss = isAdventureChapterBossCodexId(codexId);
    const ch = Math.max(1, Math.floor(stageIndex));
    if (ch <= 1) return boss ? 3 : 2;
    if (ch <= 3) return boss ? 4 : 3;
    return boss ? 5 : 3;
}
