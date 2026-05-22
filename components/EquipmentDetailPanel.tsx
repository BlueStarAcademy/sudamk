import React from 'react';
import { InventoryItem, ItemGrade } from '../types.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { GRADE_LEVEL_REQUIREMENTS, formatEquipLevelRequirement } from '../constants';
import { isActionPointConsumable } from '../constants/items';
import { MythicSubsPartitioned } from './MythicSubsPartitioned.js';
import { formatSpecialSubLineForPanel } from '../shared/utils/specialStatMilestones.js';
import {
    AP_CONSUMABLE_LIGHTNING_FONT_SIZE_CQ,
    AP_CONSUMABLE_PLUS_FONT_SIZE_CQ,
    apConsumableLightningEmojiPx,
    apConsumableLightningPlusLabelPx,
    getBagConsumableUsageHint,
    getMaterialBagUsageLines,
    resolveBagItemDetailImagePath,
} from '../shared/utils/bagItemDetailHelpers.js';
import { resolveBagItemAcquireLines } from '../shared/utils/itemAcquireSourceLines.js';

/** ItemDetailModal과 동일 — 등급별 프레임·배경 (구매 모달 등에서 재사용 가능) */
export const equipmentDetailGradeStyles: Record<ItemGrade, { name: string; color: string; background: string; frame: string }> = {
    normal: { name: '일반', color: 'text-zinc-300', background: '/images/equipments/normalbgi.webp', frame: 'from-zinc-500/15 to-zinc-700/5 ring-zinc-500/25' },
    uncommon: { name: '고급', color: 'text-emerald-400', background: '/images/equipments/uncommonbgi.webp', frame: 'from-emerald-500/20 to-emerald-900/10 ring-emerald-500/30' },
    rare: { name: '희귀', color: 'text-sky-400', background: '/images/equipments/rarebgi.webp', frame: 'from-sky-500/20 to-blue-950/15 ring-sky-500/35' },
    epic: { name: '에픽', color: 'text-violet-400', background: '/images/equipments/epicbgi.webp', frame: 'from-violet-500/25 to-purple-950/15 ring-violet-500/40' },
    legendary: { name: '전설', color: 'text-rose-500', background: '/images/equipments/legendarybgi.webp', frame: 'from-rose-500/25 to-red-950/15 ring-rose-500/40' },
    mythic: { name: '신화', color: 'text-amber-400', background: '/images/equipments/mythicbgi.webp', frame: 'from-amber-500/25 to-orange-950/20 ring-amber-400/45' },
    transcendent: {
        name: '초월',
        color: 'text-cyan-300',
        background: '/images/equipments/transcendentbgi.webp',
        frame: 'from-cyan-500/30 via-teal-600/20 to-cyan-950/25 ring-cyan-400/50',
    },
};

const renderStarDisplay = (stars: number, comfortableTypography?: boolean) => {
    if (stars === 0) return null;

    let starImage = '';
    let numberColor = '';

    if (stars >= 10) {
        starImage = '/images/equipments/Star4.webp';
        numberColor = 'prism-text-effect';
    } else if (stars >= 7) {
        starImage = '/images/equipments/Star3.webp';
        numberColor = 'text-purple-400';
    } else if (stars >= 4) {
        starImage = '/images/equipments/Star2.webp';
        numberColor = 'text-amber-400';
    } else if (stars >= 1) {
        starImage = '/images/equipments/Star1.webp';
        numberColor = 'text-white';
    }

    const starImgCls = comfortableTypography ? 'h-3.5 w-3.5' : 'h-3 w-3';
    const starNumCls = comfortableTypography ? 'text-[13px] font-bold leading-none' : 'text-[12px] font-bold leading-none';

    return (
        <div
            className="absolute right-1.5 top-0.5 z-10 flex items-center gap-0.5 rounded-bl-md bg-black/45 px-1 py-0.5 backdrop-blur-[2px]"
            style={{ textShadow: '1px 1px 2px black' }}
        >
            <img src={starImage} alt="" className={starImgCls} />
            <span className={`${starNumCls} ${numberColor}`}>{stars}</span>
        </div>
    );
};

function resolveNoWrapTextFontPx(
    text: string | null | undefined,
    preferredPx: number,
    minPx = 7,
    shrinkStartLength = 10,
    shrinkPerChar = 0.58,
): number {
    const length = Array.from(text ?? '').length;
    const shrink = Math.max(0, length - shrinkStartLength) * shrinkPerChar;
    return Math.max(minPx, Math.round(preferredPx - shrink));
}

export interface EquipmentDetailPanelProps {
    item: InventoryItem;
    /** 가방 상세: 옵션 영역만 스크롤. 획득 팝업: 본문 높이에 맞춰 내부 스크롤 없음 */
    optionsScrollable?: boolean;
    /** 장비만: 거래상태(귀속/거래가능)를 이미지 하단에 표시. 소모품·재료는 거래 불가라 미표시 */
    showTradeStatusUnderImage?: boolean;
    /** 본문·부옵션 글자를 한 단계 키움(거래소 모바일 구매 상세 등) */
    comfortableTypography?: boolean;
    /** 각 부옵션 줄을 줄바꿈 없이 한 줄로(길면 가로 스크롤) */
    optionRowsSingleLine?: boolean;
    /**
     * 가방 PC 한 칸 등: 아이콘 슬롯을 px로 고정(LocalItemDetailDisplay `imgBox`와 동기).
     * 지정 시 sm/md 반응형 슬롯 크기 대신 이 값을 사용합니다.
     */
    iconSlotPx?: number;
    /** 설명·사용처 아래에 획득처(정적 요약) 표시 — 상점 구매 미리보기 등 */
    showAcquireSources?: boolean;
    /** 상점 미리보기 등에서 「보유 수량」 행 숨김 */
    hideOwnedQuantity?: boolean;
    /** `obtained`: 획득 모달 등 — 스냅샷 수량을 「획득 수량」으로 표시 (가방 보유와 구분) */
    materialQuantityCaption?: 'owned' | 'obtained';
    /** 소모품·재료 카드의 「설명」 블록을 통째로 교체(길드 장비 상자 등) */
    descriptionSlot?: React.ReactNode;
}

/**
 * 장비 상세 정보 모달(ItemDetailModal)과 동일한 본문 레이아웃(상단 카드 + 부옵션 영역).
 */
export const EquipmentDetailPanel: React.FC<EquipmentDetailPanelProps> = ({
    item,
    optionsScrollable = true,
    showTradeStatusUnderImage = false,
    comfortableTypography = false,
    optionRowsSingleLine = false,
    iconSlotPx,
    showAcquireSources = false,
    hideOwnedQuantity = false,
    materialQuantityCaption = 'owned',
    descriptionSlot,
}) => {
    const { currentUserWithStatus } = useAppContext();
    const styles = equipmentDetailGradeStyles[item.grade];

    const requiredLevel = GRADE_LEVEL_REQUIREMENTS[item.grade];
    const userLevelSum = currentUserWithStatus?.userLevel ?? 0;
    const canEquip = userLevelSum >= requiredLevel;

    const refinementCount = (item as { refinementCount?: number }).refinementCount ?? 0;
    const isTranscendent = item.grade === ItemGrade.Transcendent;
    const nameLength = (item.name ?? '').length;

    /** 소모품·재료: 장비와 동일 상단 카드 + 하단(부옵션 자리)에 설명·사용처 */
    if (item.type === 'consumable' || item.type === 'material') {
        const imagePath = resolveBagItemDetailImagePath(item);
        const usageLines = item.type === 'material' ? getMaterialBagUsageLines(item.name) : [];
        const usageHint = item.type === 'consumable' ? getBagConsumableUsageHint(item.name) : null;
        const usageFallback =
            item.type === 'consumable' ? '가방에서 사용할 수 있습니다.' : '이 재료는 현재 어떤 장비 강화에도 사용되지 않습니다.';
        const typeLabel = item.type === 'consumable' ? '소모품' : '재료';
        const acquireLines = showAcquireSources ? resolveBagItemAcquireLines(item) : [];

        const mainBodyPx = comfortableTypography ? 13 : 12;
        const computedNameFontPx = Math.max(
            mainBodyPx + 1,
            Math.min(mainBodyPx + 4, Math.round(mainBodyPx + 3 - Math.max(0, nameLength - 14) * 0.22))
        );
        const metaText = comfortableTypography ? 'text-[13px] font-medium leading-snug' : 'text-[12px] font-medium leading-snug';
        const metaSemi = comfortableTypography ? 'text-[13px] font-semibold leading-snug' : 'text-[12px] font-semibold leading-snug';
        const optsBlock = comfortableTypography
            ? 'w-full space-y-2 text-left text-[13px] leading-snug'
            : 'w-full space-y-2 text-left text-[12px] leading-snug';
        const sectionLabelClass = comfortableTypography ? 'text-[11px] font-bold uppercase tracking-wide text-slate-500' : 'text-[10px] font-bold uppercase tracking-wide text-slate-500';

        const iconSlotBoxClass = iconSlotPx
            ? `relative overflow-hidden rounded-lg shadow-inner ring-1 ring-black/40 ${isTranscendent ? 'transcendent-grade-slot' : ''}`
            : `relative h-16 w-16 overflow-hidden rounded-lg shadow-inner ring-1 ring-black/40 sm:h-20 sm:w-20 md:h-24 md:w-24 ${isTranscendent ? 'transcendent-grade-slot' : ''}`;
        const iconSlotBoxStyle: React.CSSProperties = {
            ...(iconSlotPx ? { width: iconSlotPx, height: iconSlotPx, flexShrink: 0 } : {}),
            containerType: 'size',
        };
        const bagNamePx =
            iconSlotPx != null
                ? Math.max(12, Math.round(13 * (iconSlotPx / Math.max(52, 80))))
                : computedNameFontPx;

        const optionsSectionClass = optionsScrollable
            ? 'min-h-0 flex-1 overflow-y-auto rounded-xl border border-white/[0.08] bg-gradient-to-b from-zinc-900/80 to-zinc-950/90 p-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] ring-1 ring-inset ring-black/30'
            : 'shrink-0 overflow-visible rounded-xl border border-white/[0.08] bg-gradient-to-b from-zinc-900/80 to-zinc-950/90 p-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] ring-1 ring-inset ring-black/30';

        return (
            <div className={optionsScrollable ? 'flex h-full min-h-0 flex-col' : 'flex flex-col'}>
                <div
                    className={`relative mb-2.5 overflow-hidden rounded-xl bg-gradient-to-br p-[1px] shadow-[0_12px_32px_-8px_rgba(0,0,0,0.55)] ${styles.frame}`}
                >
                    <div className="flex items-start justify-between rounded-[11px] bg-zinc-950/90 px-2.5 py-2 ring-1 ring-inset ring-white/[0.06]">
                        <div className="flex shrink-0 flex-col items-center">
                            <div className={iconSlotBoxClass} style={iconSlotBoxStyle}>
                                <img src={styles.background} alt={item.grade} className="absolute inset-0 h-full w-full rounded-lg object-cover" />
                                {isActionPointConsumable(item.name) ? (
                                    (() => {
                                        const match = item.name.match(/\+(\d+)/);
                                        const apValue = match ? match[1] : null;
                                        const side = iconSlotPx ?? 64;
                                        const emojiFs =
                                            iconSlotPx != null
                                                ? `${apConsumableLightningEmojiPx(side)}px`
                                                : AP_CONSUMABLE_LIGHTNING_FONT_SIZE_CQ;
                                        const plusFs =
                                            iconSlotPx != null
                                                ? `${apConsumableLightningPlusLabelPx(side)}px`
                                                : AP_CONSUMABLE_PLUS_FONT_SIZE_CQ;
                                        return (
                                            <span
                                                className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden px-[min(4px,8%)] leading-none"
                                                aria-hidden
                                                style={{ fontSize: emojiFs }}
                                            >
                                                <span className="leading-none">⚡</span>
                                                {apValue && (
                                                    <span
                                                        className="mt-0.5 max-w-full whitespace-nowrap font-bold leading-none text-cyan-300 drop-shadow-[0_0_4px_rgba(34,211,238,0.8)]"
                                                        style={{ fontSize: plusFs }}
                                                    >
                                                        +{apValue}
                                                    </span>
                                                )}
                                            </span>
                                        );
                                    })()
                                ) : imagePath ? (
                                    <img
                                        src={imagePath}
                                        alt={item.name}
                                        className="relative z-[2] object-contain p-2"
                                        style={{ width: '80%', height: '80%', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
                                    />
                                ) : null}
                            </div>
                        </div>
                        <div className="ml-2 min-w-0 flex-grow text-right sm:ml-3 md:ml-4">
                            <div className="flex items-baseline justify-end gap-1">
                                <h3
                                    className={`max-w-full whitespace-nowrap text-right font-bold leading-tight tracking-tight ${styles.color}`}
                                    title={item.name}
                                    style={{
                                        fontSize: `${resolveNoWrapTextFontPx(item.name, bagNamePx, 8, 9, 0.62)}px`,
                                        letterSpacing: '-0.02em',
                                    }}
                                >
                                    {item.name}
                                </h3>
                            </div>
                            <p className={`${metaText} text-slate-400`}>{typeLabel}</p>
                            <p className={`${metaText} ${styles.color}`}>[{styles.name}]</p>
                            {!hideOwnedQuantity ? (
                                <p className={`${metaSemi} text-slate-300`}>
                                    {materialQuantityCaption === 'obtained' ? '획득 수량' : '보유 수량'}:{' '}
                                    {typeof item.quantity === 'number' && Number.isFinite(item.quantity)
                                        ? Math.max(0, Math.floor(item.quantity))
                                        : materialQuantityCaption === 'obtained'
                                          ? 0
                                          : (item.quantity as number | undefined) ?? 0}
                                </p>
                            ) : null}
                        </div>
                    </div>
                </div>

                <div className={optionsSectionClass}>
                    <div className={`${optsBlock} ${optionRowsSingleLine ? 'min-w-0 overflow-x-auto' : ''}`}>
                        <div>
                            <p className={sectionLabelClass}>설명</p>
                            {descriptionSlot != null ? (
                                <div className={`mt-1 ${metaText} text-slate-200/95`}>{descriptionSlot}</div>
                            ) : (
                                <p className="mt-1 text-slate-200/95">{item.description?.trim() ? item.description : '—'}</p>
                            )}
                        </div>
                        <div className="my-2 h-px w-full shrink-0 bg-gradient-to-r from-transparent via-white/12 to-transparent" aria-hidden />
                        <div>
                            <p className={sectionLabelClass}>사용처</p>
                            <div className="mt-1 space-y-1.5 text-slate-200/95">
                                {item.type === 'material' ? (
                                    usageLines.length > 0 ? (
                                        usageLines.map((line, i) => (
                                            <p key={i} className="leading-relaxed">
                                                {line}
                                            </p>
                                        ))
                                    ) : (
                                        <p className="leading-relaxed text-slate-400">{usageFallback}</p>
                                    )
                                ) : (
                                    <p className="leading-relaxed">{usageHint ?? usageFallback}</p>
                                )}
                            </div>
                        </div>
                        {acquireLines.length > 0 ? (
                            <>
                                <div className="my-2 h-px w-full shrink-0 bg-gradient-to-r from-transparent via-white/12 to-transparent" aria-hidden />
                                <div>
                                    <p className={sectionLabelClass}>획득처</p>
                                    <div className="mt-1 space-y-1.5 text-slate-200/95">
                                        {acquireLines.map((line, i) => (
                                            <p key={`acq-${i}`} className="leading-relaxed">
                                                {line}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            </>
                        ) : null}
                    </div>
                </div>
            </div>
        );
    }
    /** 주옵션·부옵션·메타 공통 본문 크기(px). 이름만 이보다 항상 조금 더 크게 */
    const mainBodyPx = comfortableTypography ? 13 : 12;
    const computedNameFontPx = Math.max(
        mainBodyPx + 1,
        Math.min(
            mainBodyPx + 4,
            Math.round(mainBodyPx + 3 - Math.max(0, nameLength - 14) * 0.22)
        )
    );
    const metaText = comfortableTypography ? 'text-[13px] font-medium leading-snug' : 'text-[12px] font-medium leading-snug';
    const metaSemi = comfortableTypography ? 'text-[13px] font-semibold leading-snug' : 'text-[12px] font-semibold leading-snug';
    const optsBlock = comfortableTypography
        ? 'w-full space-y-1.5 text-left text-[13px] leading-snug'
        : 'w-full space-y-1.5 text-left text-[12px] leading-snug';
    /** 귀속·거래가능만 본문보다 한 단계 작게 */
    const tradeStatusBadgeClass = 'text-[11px] font-semibold leading-none';
    const tradeStatusLineClass = 'text-[11px] font-semibold leading-snug';
    const optLine = optionRowsSingleLine ? 'whitespace-nowrap' : '';
    const equipSectionLabelClass = comfortableTypography
        ? 'text-[11px] font-bold uppercase tracking-wide text-slate-500'
        : 'text-[10px] font-bold uppercase tracking-wide text-slate-500';
    const acquireEquipLines = showAcquireSources ? resolveBagItemAcquireLines(item) : [];

    const optionsSectionClass = optionsScrollable
        ? 'min-h-0 flex-1 overflow-y-auto rounded-xl border border-white/[0.08] bg-gradient-to-b from-zinc-900/80 to-zinc-950/90 p-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] ring-1 ring-inset ring-black/30'
        : 'shrink-0 overflow-visible rounded-xl border border-white/[0.08] bg-gradient-to-b from-zinc-900/80 to-zinc-950/90 p-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] ring-1 ring-inset ring-black/30';

    const equipIconSlotClass = iconSlotPx
        ? `relative overflow-hidden rounded-lg shadow-inner ring-1 ring-black/40 ${isTranscendent ? 'transcendent-grade-slot' : ''}`
        : `relative h-16 w-16 overflow-hidden rounded-lg shadow-inner ring-1 ring-black/40 sm:h-20 sm:w-20 md:h-24 md:w-24 ${isTranscendent ? 'transcendent-grade-slot' : ''}`;
    const equipIconSlotStyle: React.CSSProperties = {
        ...(iconSlotPx ? { width: iconSlotPx, height: iconSlotPx, flexShrink: 0 } : {}),
        containerType: 'size',
    };
    const equipNamePx =
        iconSlotPx != null
            ? Math.max(12, Math.round(13 * (iconSlotPx / Math.max(52, 80))))
            : computedNameFontPx;

    return (
        <div className={optionsScrollable ? 'flex h-full min-h-0 flex-col' : 'flex flex-col'}>
            <div
                className={`relative mb-2.5 overflow-hidden rounded-xl bg-gradient-to-br p-[1px] shadow-[0_12px_32px_-8px_rgba(0,0,0,0.55)] ${styles.frame}`}
            >
                <div className="flex items-start justify-between rounded-[11px] bg-zinc-950/90 px-2.5 py-2 ring-1 ring-inset ring-white/[0.06]">
                    <div className="flex shrink-0 flex-col items-center">
                        <div className={equipIconSlotClass} style={equipIconSlotStyle}>
                            <img src={styles.background} alt={item.grade} className="absolute inset-0 h-full w-full rounded-lg object-cover" />
                            {isActionPointConsumable(item.name) ? (
                                <span
                                    className="absolute inset-0 flex items-center justify-center leading-none"
                                    style={{
                                        fontSize:
                                            iconSlotPx != null
                                                ? `${apConsumableLightningEmojiPx(iconSlotPx)}px`
                                                : AP_CONSUMABLE_LIGHTNING_FONT_SIZE_CQ,
                                    }}
                                    aria-hidden
                                >
                                    ⚡
                                </span>
                            ) : item.image ? (
                                <img
                                    src={item.image}
                                    alt={item.name}
                                    className="relative z-[2] object-contain p-2"
                                    style={{ width: '80%', height: '80%', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
                                />
                            ) : null}
                            {renderStarDisplay(item.stars, comfortableTypography)}
                        </div>
                        {showTradeStatusUnderImage && item.type === 'equipment' && (
                            <div
                                className={`mt-1 rounded border px-1.5 py-0.5 ${tradeStatusBadgeClass} ${
                                    item.isBound
                                        ? 'border-rose-500/40 bg-rose-900/30 text-rose-200'
                                        : 'border-emerald-500/40 bg-emerald-900/25 text-emerald-200'
                                }`}
                            >
                                {item.isBound ? '귀속' : '거래가능'}
                            </div>
                        )}
                    </div>
                    <div className="ml-2 min-w-0 flex-grow text-right sm:ml-3 md:ml-4">
                        <div className="flex items-baseline justify-end gap-1">
                            <h3
                                className={`max-w-full whitespace-nowrap text-right font-bold leading-tight tracking-tight ${styles.color}`}
                                style={{
                                    fontSize: `${resolveNoWrapTextFontPx(item.name, equipNamePx, 8, 9, 0.62)}px`,
                                    letterSpacing: '-0.02em',
                                }}
                            >
                                {item.name}
                            </h3>
                        </div>
                        <p className={`${metaText} ${styles.color}`}>[{styles.name}]</p>
                        {!showTradeStatusUnderImage && (
                            <p className={`${tradeStatusLineClass} ${item.isBound ? 'text-rose-300' : 'text-emerald-300'}`}>
                                {item.isBound ? '귀속' : '거래가능'}
                            </p>
                        )}
                        <p className={`${comfortableTypography ? 'text-[13px] leading-snug' : 'text-[12px] leading-snug'} ${canEquip ? 'text-gray-500' : 'text-red-500'}`}>
                            ({formatEquipLevelRequirement(requiredLevel)})
                        </p>
                        {item.type === 'equipment' && item.grade !== 'normal' && (
                            <p className={`${metaSemi} ${refinementCount > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                                제련 가능: {refinementCount > 0 ? `${refinementCount}회` : '제련불가'}
                            </p>
                        )}
                        {item.options?.main && (
                            <p
                                className={`mt-0.5 min-w-0 max-w-full ${metaSemi} text-amber-300/95 drop-shadow-sm ${optLine} ${
                                    optionRowsSingleLine ? 'overflow-x-auto' : ''
                                }`}
                            >
                                {item.options.main.display}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <div className={optionsSectionClass}>
                <div className={`${optsBlock} ${optionRowsSingleLine ? 'min-w-0 overflow-x-auto' : ''}`}>
                    {item.options?.combatSubs && item.options.combatSubs.length > 0 && (
                        <div className="space-y-0.5">
                            {item.options.combatSubs.map((opt, i) => (
                                <p key={i} className={`text-blue-300 ${optLine}`}>
                                    {opt.display}
                                </p>
                            ))}
                        </div>
                    )}
                    {item.options?.specialSubs && item.options.specialSubs.length > 0 && (
                        <div className="space-y-0.5">
                            {item.options.specialSubs.map((opt, i) => (
                                <p key={i} className={`text-green-300 ${optLine}`}>
                                    {formatSpecialSubLineForPanel(opt, item.stars ?? 0)}
                                </p>
                            ))}
                        </div>
                    )}
                    {item.options?.mythicSubs && item.options.mythicSubs.length > 0 ? (
                        <MythicSubsPartitioned
                            subs={item.options.mythicSubs}
                            enlargeBody={comfortableTypography}
                            rowsNoWrap={optionRowsSingleLine}
                        />
                    ) : null}
                    {showAcquireSources && item.description?.trim() ? (
                        <div className="mt-2 border-t border-white/10 pt-2">
                            <p className={equipSectionLabelClass}>설명</p>
                            <p className={`mt-1 text-slate-200/95 ${comfortableTypography ? 'text-[13px] leading-snug' : 'text-[12px] leading-snug'}`}>
                                {item.description.trim()}
                            </p>
                        </div>
                    ) : null}
                    {acquireEquipLines.length > 0 ? (
                        <div className="mt-2 border-t border-white/10 pt-2">
                            <p className={equipSectionLabelClass}>획득처</p>
                            <div className="mt-1 space-y-1.5 text-slate-200/95">
                                {acquireEquipLines.map((line, i) => (
                                    <p key={`eq-acq-${i}`} className="leading-relaxed">
                                        {line}
                                    </p>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
};
