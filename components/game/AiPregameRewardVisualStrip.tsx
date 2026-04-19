import React from 'react';
import type { AiPregameRewardSlot, AiPregameRewardVisual } from '../../utils/estimateAiPregameRewardSummary.js';
import { ItemGrade } from '../../types/enums.js';
import { ResultModalXpRewardBadge } from './ResultModalXpRewardBadge.js';
import {
  RESULT_MODAL_BOX_GOLD_CLASS,
  RESULT_MODAL_ADVENTURE_UNIFIED_SLOT_CLASS,
  RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS,
  equipmentGradeRewardIconShellClassNames,
} from './ResultModalRewardSlot.js';

const GOLD_BOX_COMPACT = `${RESULT_MODAL_BOX_GOLD_CLASS} ${RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS} flex items-center justify-center`;
const MAT_BOX_COMPACT = `${RESULT_MODAL_ADVENTURE_UNIFIED_SLOT_CLASS} ${RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS} flex items-center justify-center`;

function formatQtyRange(min: number, max: number): string {
  if (min === max) return String(min);
  return `${min}~${max}`;
}

function formatGoldRange(min: number, max: number): string {
  if (min === max) return min.toLocaleString();
  return `${min.toLocaleString()}~${max.toLocaleString()}`;
}

const GoldRangeSlot: React.FC<{ min: number; max: number; highlight?: 'boss' }> = ({ min, max, highlight }) => (
  <div className="flex flex-col items-center gap-0.5">
    <div
      className={`${GOLD_BOX_COMPACT} ${
        highlight === 'boss' ? 'ring-1 ring-rose-400/40' : 'ring-1 ring-amber-400/20'
      }`}
      aria-hidden
    >
      <img
        src="/images/icon/Gold.png"
        alt=""
        className="h-7 w-7 min-[360px]:h-8 min-[360px]:w-8 object-contain p-0.5"
      />
    </div>
    <span className="max-w-[6.5rem] text-center text-[0.7rem] font-bold tabular-nums leading-tight text-amber-100 sm:text-xs">
      {formatGoldRange(min, max)}
    </span>
  </div>
);

const GoldPointSlot: React.FC<{ amount: number; tone: 'win' | 'loss' }> = ({ amount, tone }) => {
  const ring = tone === 'win' ? 'ring-1 ring-emerald-400/35' : 'ring-1 ring-rose-400/35 opacity-[0.9]';
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className={`${GOLD_BOX_COMPACT} ${ring}`} aria-hidden>
        <img src="/images/icon/Gold.png" alt="" className="h-7 w-7 object-contain p-0.5 sm:h-8 sm:w-8" />
      </div>
      <span className="text-[0.7rem] font-bold tabular-nums text-amber-100 sm:text-xs">{amount.toLocaleString()}</span>
    </div>
  );
};

const MaterialQtySlot: React.FC<{ image: string; qtyMin: number; qtyMax: number }> = ({ image, qtyMin, qtyMax }) => (
  <div className="flex flex-col items-center gap-0.5">
    <div className={MAT_BOX_COMPACT} aria-hidden>
      <img src={image} alt="" className="h-7 w-7 object-contain p-0.5 sm:h-8 sm:w-8" />
    </div>
    <span className="text-[0.68rem] font-bold tabular-nums text-slate-200 sm:text-xs">{formatQtyRange(qtyMin, qtyMax)}</span>
  </div>
);

const EquipmentGradeSlot: React.FC<{ gradeLabel: string; grade: ItemGrade; image: string }> = ({ gradeLabel, grade, image }) => {
  const shell = equipmentGradeRewardIconShellClassNames(grade);
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className={`${shell.outer} ${RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS} overflow-hidden`}>
        <div
          className={`pointer-events-none absolute inset-0 ${shell.transcendentClass}`}
          style={shell.bgStyle}
          aria-hidden
        />
        <div className="relative z-[1] flex h-full w-full items-center justify-center p-0.5">
          <img src={image} alt="" className="h-7 w-7 object-contain sm:h-8 sm:w-8" />
        </div>
      </div>
      <span className="max-w-[7rem] text-center text-[0.65rem] font-bold leading-tight text-violet-100/95 sm:max-w-[8rem] sm:text-xs">
        {gradeLabel}
      </span>
    </div>
  );
};

const IconMysterySlot: React.FC<{ image: string }> = ({ image }) => (
  <div className="flex flex-col items-center gap-0.5">
    <div className={`${MAT_BOX_COMPACT} opacity-90`} aria-hidden>
      <img src={image} alt="" className="h-7 w-7 object-contain p-0.5 sm:h-8 sm:w-8" />
    </div>
    <span className="text-[0.7rem] font-bold tabular-nums text-zinc-500 sm:text-xs">—</span>
  </div>
);

const VipInlineCompactSlot: React.FC<{ locked: boolean }> = ({ locked }) => {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className={`${MAT_BOX_COMPACT} relative overflow-hidden rounded-lg border ${
          locked
            ? 'border-amber-300/45 bg-gradient-to-br from-[#3a2610]/95 via-[#21160c]/95 to-[#120d08]/95 ring-1 ring-amber-300/30 shadow-[inset_0_1px_0_rgba(255,245,200,0.14),0_0_14px_rgba(251,191,36,0.18)]'
            : 'border-fuchsia-300/55 bg-gradient-to-br from-[#3a1437]/95 via-[#251129]/95 to-[#120914]/95 ring-1 ring-fuchsia-300/35 shadow-[inset_0_1px_0_rgba(255,230,255,0.16),0_0_18px_rgba(217,70,239,0.3)]'
        }`}
        aria-hidden
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-35"
          style={{
            background:
              locked
                ? 'radial-gradient(circle at 20% 18%, rgba(255,220,140,0.45), transparent 42%), radial-gradient(circle at 82% 80%, rgba(250,204,21,0.22), transparent 46%)'
                : 'radial-gradient(circle at 20% 18%, rgba(250,232,255,0.45), transparent 42%), radial-gradient(circle at 82% 80%, rgba(232,121,249,0.25), transparent 46%)',
          }}
        />
        <div className="relative z-[1] flex flex-col items-center justify-center leading-none">
          <span
            className={`text-[0.64rem] font-black tracking-[0.11em] sm:text-[0.68rem] ${
              locked ? 'text-amber-100' : 'text-fuchsia-100'
            }`}
          >
            VIP
          </span>
          <span
            className={`mt-[2px] text-[0.64rem] font-black tracking-[0.11em] sm:text-[0.68rem] ${
              locked ? 'text-amber-50' : 'text-fuchsia-50'
            }`}
          >
            보상
          </span>
        </div>
      </div>
      <span className="text-[0.62rem] font-semibold leading-tight text-fuchsia-100/90 sm:text-[0.66rem]">보상 VIP</span>
    </div>
  );
};

function renderSlot(
  slot: AiPregameRewardSlot,
  idx: number,
  isMobileSheet: boolean,
  layout: 'card' | 'headerInline' = 'card',
  onVipLockedClick?: () => void,
): React.ReactNode {
  const density = layout === 'headerInline' ? 'compact' : isMobileSheet ? 'compact' : 'comfortable';
  switch (slot.kind) {
    case 'xp_win_loss':
      if (layout === 'headerInline') {
        return (
          <div key={`xp-${idx}`} className="flex shrink-0 items-end gap-1">
            <ResultModalXpRewardBadge variant={slot.xpVariant} amount={slot.winXp} density="compact" />
            {slot.lossXp > 0 ? (
              <ResultModalXpRewardBadge variant={slot.xpVariant} amount={slot.lossXp} density="compact" />
            ) : null}
          </div>
        );
      }
      return (
        <div key={`xp-${idx}`} className="flex w-full flex-wrap items-end justify-center gap-4 sm:gap-6">
          <div className="rounded-xl p-0.5 ring-2 ring-emerald-400/35 ring-offset-1 ring-offset-zinc-950/80">
            <ResultModalXpRewardBadge variant={slot.xpVariant} amount={slot.winXp} density={density} />
          </div>
          <div className="rounded-xl p-0.5 ring-2 ring-rose-400/35 ring-offset-1 ring-offset-zinc-950/80">
            <ResultModalXpRewardBadge variant={slot.xpVariant} amount={slot.lossXp} density={density} />
          </div>
        </div>
      );
    case 'xp_adventure_win':
      if (layout === 'headerInline') {
        return (
          <div key={`advxp-${idx}`} className="flex shrink-0 justify-end">
            <ResultModalXpRewardBadge variant="strategy" amount={slot.winXp} density="compact" />
          </div>
        );
      }
      return (
        <div key={`advxp-${idx}`} className="flex w-full justify-center">
          <div className="rounded-xl p-0.5 ring-2 ring-emerald-400/30 ring-offset-1 ring-offset-zinc-950/80">
            <ResultModalXpRewardBadge variant="strategy" amount={slot.winXp} density={density} />
          </div>
        </div>
      );
    case 'gold_range':
      return <GoldRangeSlot key={`g-${idx}`} min={slot.min} max={slot.max} highlight={slot.highlight} />;
    case 'gold_point':
      return <GoldPointSlot key={`gp-${idx}`} amount={slot.amount} tone={slot.tone} />;
    case 'equipment_grade_box':
      return (
        <EquipmentGradeSlot key={`eq-${idx}`} gradeLabel={slot.gradeLabel} grade={slot.grade} image={slot.image} />
      );
    case 'material_qty_box':
      return <MaterialQtySlot key={`m-${idx}`} image={slot.image} qtyMin={slot.qtyMin} qtyMax={slot.qtyMax} />;
    case 'icon_only':
      return <IconMysterySlot key={`i-${idx}`} image={slot.image} />;
    case 'vip_play_reward': {
      if (layout === 'headerInline') {
        return <VipInlineCompactSlot key={`vip-${idx}`} locked={slot.locked} />;
      }
      return (
        <VipInlineCompactSlot key={`vip-${idx}`} locked={slot.locked} />
      );
    }
    default:
      return null;
  }
}

/** AI 대국 시작 전: 이미지 박스 + 하단 수치·등급 범위(긴 문장 없음) */
export const AiPregameRewardVisualStrip: React.FC<{
  visual: AiPregameRewardVisual;
  isMobileSheet: boolean;
  placement?: 'default' | 'titlePanel' | 'headerInline';
  onVipLockedClick?: () => void;
}> = ({ visual, isMobileSheet, placement = 'default', onVipLockedClick }) => {
  if (placement === 'headerInline') {
    return (
      <div className="flex max-w-full min-w-0 flex-nowrap items-end justify-end overflow-x-auto pb-0.5 [scrollbar-width:thin]">
        <div className="flex shrink-0 flex-nowrap items-end gap-2">
          {visual.slots.map((s, i) => renderSlot(s, i, isMobileSheet, 'headerInline', onVipLockedClick))}
        </div>
      </div>
    );
  }

  if (placement === 'titlePanel') {
    type TitlePanelUniformSlot = {
      key: string;
      image: string | null;
      line: string;
      isExp: boolean;
      expTopLabel?: string;
      isVipText?: boolean;
    };

    const uniformSlots: TitlePanelUniformSlot[] = visual.slots
      .map((slot, idx): TitlePanelUniformSlot | null => {
      switch (slot.kind) {
        case 'xp_win_loss':
          return {
            key: `xpwl-${idx}`,
            image: null as string | null,
            isExp: true,
            expTopLabel: slot.xpVariant === 'playful' ? '놀이' : '전략',
            line: `+${Math.max(slot.winXp, slot.lossXp).toLocaleString()}`,
          };
        case 'xp_adventure_win':
          return {
            key: `xpaw-${idx}`,
            image: null as string | null,
            isExp: true,
            expTopLabel: '전략',
            line: `+${slot.winXp.toLocaleString()}`,
          };
        case 'gold_range':
          return {
            key: `gr-${idx}`,
            image: '/images/icon/Gold.png',
            isExp: false,
            line: formatGoldRange(slot.min, slot.max),
          };
        case 'gold_point':
          return {
            key: `gp-${idx}`,
            image: '/images/icon/Gold.png',
            isExp: false,
            line: slot.amount.toLocaleString(),
          };
        case 'equipment_grade_box':
          return {
            key: `eq-${idx}`,
            image: slot.image,
            isExp: false,
            line: slot.gradeLabel,
          };
        case 'material_qty_box':
          return {
            key: `mat-${idx}`,
            image: slot.image,
            isExp: false,
            line: formatQtyRange(slot.qtyMin, slot.qtyMax),
          };
        case 'icon_only':
          return {
            key: `icon-${idx}`,
            image: slot.image,
            isExp: false,
            line: '보상',
          };
        case 'vip_play_reward':
          return {
            key: `vip-${idx}`,
            image: null as string | null,
            isExp: false,
            line: 'VIP 보상',
            isVipText: true,
          };
        default:
          return null;
      }
    })
      .filter((s): s is TitlePanelUniformSlot => s !== null);

    if (uniformSlots.length === 0) return null;

    /** 모험 시작 모달: 최대 6칸은 한 뷰포트 너비에 균등 배치, 7개 이상은 같은 줄 가로 스크롤 */
    const n = uniformSlots.length;
    const tileBoxClass =
      'relative flex aspect-square w-full max-h-[2.35rem] max-w-[2.35rem] shrink-0 items-center justify-center rounded-lg border p-0.5 ring-1 ring-inset sm:max-h-10 sm:max-w-10';

    return (
      <div className="mt-2.5 w-full rounded-lg border border-violet-400/18 bg-black/25 p-2 ring-1 ring-inset ring-white/[0.04] sm:mt-3 sm:p-2.5">
        <h3 className="mb-1.5 flex items-center gap-2 border-b border-violet-400/18 pb-1 text-[0.7rem] font-bold text-violet-100/95 sm:mb-2 sm:pb-1.5 sm:text-xs">
          획득 가능한 보상
        </h3>
        <div className="overflow-x-auto overflow-y-visible pb-0.5 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]">
          <div
            className={`flex min-w-full flex-nowrap items-stretch gap-1 sm:gap-1.5 ${n > 6 ? 'w-max pr-0.5' : ''}`}
          >
            {uniformSlots.map((slot) => (
              <div
                key={slot.key}
                className={`flex min-w-0 flex-col items-center gap-0.5 ${
                  n <= 6 ? 'min-w-0 flex-[1_1_0] basis-0' : 'w-[2.65rem] shrink-0 sm:w-[2.85rem]'
                }`}
              >
                <div
                  className={`${tileBoxClass} ${
                    slot.isVipText
                      ? 'overflow-hidden border-fuchsia-300/55 bg-gradient-to-br from-[#3a1437]/95 via-[#251129]/95 to-[#120914]/95 shadow-[inset_0_1px_0_rgba(255,230,255,0.16),0_0_18px_rgba(217,70,239,0.3)] ring-fuchsia-300/35'
                      : 'border-violet-300/30 bg-gradient-to-br from-zinc-900/95 via-zinc-950 to-black/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-violet-400/20'
                  }`}
                >
                  {slot.isVipText ? (
                    <div
                      className="pointer-events-none absolute inset-0 opacity-35"
                      style={{
                        background:
                          'radial-gradient(circle at 20% 18%, rgba(250,232,255,0.45), transparent 42%), radial-gradient(circle at 82% 80%, rgba(232,121,249,0.25), transparent 46%)',
                      }}
                    />
                  ) : null}
                  {slot.image ? (
                    <img src={slot.image} alt="" className="h-full w-full max-h-[1.65rem] max-w-[1.65rem] object-contain sm:max-h-[1.85rem] sm:max-w-[1.85rem]" />
                  ) : slot.isVipText ? (
                    <div className="relative z-[1] flex flex-col items-center leading-none">
                      <span className="text-[0.52rem] font-black tracking-[0.1em] text-fuchsia-100 sm:text-[0.56rem]">VIP</span>
                      <span className="mt-px text-[0.52rem] font-black tracking-[0.1em] text-fuchsia-50 sm:text-[0.56rem]">보상</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center leading-none">
                      <span className="text-[0.52rem] font-black tracking-[0.06em] text-emerald-100 sm:text-[0.56rem]">
                        {slot.expTopLabel ?? '전략'}
                      </span>
                      <span className="mt-px text-[0.52rem] font-black tracking-[0.06em] text-emerald-50 sm:text-[0.56rem]">EXP</span>
                    </div>
                  )}
                </div>
                <span className="w-full truncate text-center text-[0.58rem] font-bold tabular-nums leading-tight text-zinc-100 sm:text-[0.62rem]">
                  {slot.line}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3 mt-4 rounded-xl border border-violet-400/22 bg-zinc-950/45 p-3 shadow-inner ring-1 ring-inset ring-white/[0.04] sm:mb-4 sm:mt-5 sm:p-4">
      <h3 className="mb-2.5 flex items-center gap-2 border-b border-violet-400/18 pb-2 text-sm font-bold text-violet-100/95 sm:text-base">
        획득 가능한 보상
      </h3>
      <div className="flex flex-wrap items-end justify-center gap-x-3 gap-y-4 sm:gap-x-4 sm:gap-y-5">
        {visual.slots.map((s, i) => renderSlot(s, i, isMobileSheet, 'card', onVipLockedClick))}
      </div>
    </div>
  );
};
