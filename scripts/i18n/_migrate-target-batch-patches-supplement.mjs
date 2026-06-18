/** Supplement patches with corrected literals from partially-migrated source files */
const I18N = "import { useTranslation } from 'react-i18next';\n";

export const supplementPatches = [
  {
    file: 'components/MannerGradeChangeModal.tsx',
    replacements: [
      [
        "? '바른 매너를 유지하면 혜택이 늘어납니다. 계속 좋은 대국 부탁드립니다.'",
        "? t('mannerGradeChange.upHint')",
      ],
      [
        ": '매너 점수가 낮아지면 보상·능력치에 불리할 수 있습니다. 건전한 플레이를 권장합니다.'}",
        ": t('mannerGradeChange.downHint')}",
      ],
    ],
  },
  {
    file: 'components/AppModalLayer.tsx',
    replacements: [
      [
        '<span className="block">다른 곳에서 로그인 되었습니다.</span>',
        "<span className=\"block\">{t('disconnectNotice.otherLogin')}</span>",
      ],
    ],
  },
  {
    file: 'components/CurlingStartConfirmationModal.tsx',
    replacements: [
      ['title="룰렛으로 선공/후공이 결정되었습니다"', "title={t('startConfirm.rouletteDoneShort')}"],
      ['subtitle="가위바위보 대신 자동 룰렛으로 흑과 백이 배정됩니다."', "subtitle={t('startConfirm.autoRouletteShort')}"],
      [
        "{hasConfirmed ? '상대방 확인 대기 중...' : !rouletteDone ? '룰렛 결과 확인 중...' : `대국 시작 (${countdown})`}",
        "{hasConfirmed ? t('startConfirm.waitingConfirm') : !rouletteDone ? t('startConfirm.checkingRoulette') : t('startConfirm.startCountdown', { count: countdown })}",
      ],
    ],
  },
  {
    file: 'components/AlkkagiStartConfirmationModal.tsx',
    replacements: [
      ['title="룰렛으로 선공/후공이 결정되었습니다"', "title={t('startConfirm.rouletteDoneShort')}"],
      ['subtitle="가위바위보 대신 자동 룰렛으로 흑과 백이 배정됩니다."', "subtitle={t('startConfirm.autoRouletteShort')}"],
      [
        "{hasConfirmed ? '상대방 확인 대기 중...' : !rouletteDone ? '룰렛 결과 확인 중...' : `대국 시작 (${countdown})`}",
        "{hasConfirmed ? t('startConfirm.waitingConfirm') : !rouletteDone ? t('startConfirm.checkingRoulette') : t('startConfirm.startCountdown', { count: countdown })}",
      ],
    ],
  },
  {
    file: 'components/championship/ChampionshipShopPanel.tsx',
    ensureImport: [I18N],
    hooks: [{ marker: 'const ChampionshipShopPanel', line: "    const { t } = useTranslation('tournament');\n" }],
    replacements: [
      [
        "? `주간 남은 구매 0/${limit}회 (이번 주 한도 소진)`",
        "? t('championship.shop.weeklyLimitUsed', { limit })",
      ],
      [
        "`주간 남은 구매 ${remaining}/${limit}회 (이번 주 ${used}회 구매)`",
        "t('championship.shop.weeklyLimit', { remaining, limit, used })",
      ],
    ],
  },
  {
    file: 'components/gameRecord/GameRecordReplayNav.tsx',
    ensureImport: [I18N],
    hooks: [{ marker: 'const GameRecordReplayNav', line: "    const { t } = useTranslation('common');\n" }],
    replacements: [
      ["back1: '한 수 뒤로',", "back1: t('replayBack1'),"],
      ["forward1: '한 수 앞으로',", "forward1: t('replayForward1'),"],
    ],
  },
  {
    file: 'components/MythicSubsPartitioned.tsx',
    ensureImport: [I18N],
    hooks: [{ marker: 'export const MythicSubsPartitioned', line: "    const { t } = useTranslation('game');\n" }],
    replacements: [
      ['>신화 스페셜 옵션<', ">{t('mythicPartition.mythic')}<"],
      ['>초월 스페셜 옵션<', ">{t('mythicPartition.transcendent')}<"],
    ],
  },
];
