import React, { useMemo } from 'react';
import Button from '../Button.js';
import DraggableWindow from '../DraggableWindow.js';
import type { InventoryItem } from '../../types.js';
import {
    EQUIPMENT_GRADE_LABEL_KO,
    MATERIAL_ITEMS,
    gradeBackgrounds,
    gradeStyles,
} from '../../shared/constants/items.js';
import { getPairPetDisplayName } from '../../shared/constants/petLobby.js';
import { ItemGrade } from '../../types/enums.js';
import { effectivePairPetGradeFromRow, PAIR_PET_MAX_LEVEL } from '../../shared/constants/pairPetGrade.js';
import { getPairPetSoulConvertPreview } from '../../shared/utils/pairPetSoulConvert.js';
import { resolvePairPetMetaFromInventoryRow } from '../../shared/utils/pairPetRoll.js';
import {
    PAIR_PET_MODAL_MOBILE_BOTTOM_GAP_PX,
    PAIR_PET_MODAL_MOBILE_MAX_HEIGHT_CSS,
} from '../../shared/constants/pairPetModal.js';

export interface PairPetSoulConvertModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: InventoryItem;
    isBusy: boolean;
    onConfirm: () => void | Promise<void>;
    isTopmost?: boolean;
}

const PairPetSoulConvertModal: React.FC<PairPetSoulConvertModalProps> = ({
    isOpen,
    onClose,
    item,
    isBusy,
    onConfirm,
    isTopmost = true,
}) => {
    const displayGrade = effectivePairPetGradeFromRow(item);
    const petMeta = useMemo(() => resolvePairPetMetaFromInventoryRow(item), [item]);
    const preview = useMemo(() => getPairPetSoulConvertPreview(item), [item]);
    const soulMeta =
        preview.materialName in MATERIAL_ITEMS
            ? MATERIAL_ITEMS[preview.materialName as keyof typeof MATERIAL_ITEMS]
            : null;
    const petLabel = getPairPetDisplayName(item);
    const gradeKo = EQUIPMENT_GRADE_LABEL_KO[displayGrade] ?? displayGrade;
    const petLevel = Math.min(PAIR_PET_MAX_LEVEL, Math.max(1, Math.floor(petMeta.level) || 1));
    const petSt = gradeStyles[displayGrade] ?? gradeStyles[ItemGrade.Normal];
    const petBgUrl = gradeBackgrounds[displayGrade] ?? gradeBackgrounds[ItemGrade.Normal];
    const petCardBgStyle: React.CSSProperties | undefined = petBgUrl
        ? { backgroundImage: `url(${petBgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
        : undefined;
    const rewardName = soulMeta?.name ?? preview.materialName;

    if (!isOpen) return null;

    return (
        <DraggableWindow
            title="영혼변환"
            onClose={onClose}
            windowId="pair-pet-soul-convert"
            initialWidth={420}
            shrinkHeightToContent
            isTopmost={isTopmost}
            zIndex={72}
            skipSavedPosition
            variant="store"
            mobileViewportFit
            mobileViewportMaxHeightCss={PAIR_PET_MODAL_MOBILE_MAX_HEIGHT_CSS}
            mobileViewportDvhBottomGapPx={PAIR_PET_MODAL_MOBILE_BOTTOM_GAP_PX}
            hideFooter
            bodyNoScroll
            bodyShrinkToContent
            bodyPaddingClassName="!p-0"
        >
            <div className="flex flex-col gap-2 px-2.5 pb-2.5 pt-1.5 sm:px-3 sm:pb-3 sm:pt-2">
                <div className="rounded-md border border-amber-300/40 bg-amber-950/35 px-2.5 py-1.5 text-center text-xs font-bold tracking-tight text-amber-100 sm:rounded-lg sm:px-3 sm:py-2 sm:text-sm">
                    펫을 떠나 보냅니다
                </div>

                <div className="rounded-lg border border-amber-300/35 bg-zinc-950/90 px-2.5 py-2 ring-1 ring-white/[0.06] sm:px-3 sm:py-2.5">
                    <div className="flex items-start gap-2 sm:items-center sm:gap-2.5">
                        <div
                            className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black/35 p-1 ring-1 ring-white/12 sm:h-[4.5rem] sm:w-[4.5rem] sm:rounded-xl sm:p-1.5"
                            style={petCardBgStyle}
                        >
                            <img src={item.image} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                            <p className="text-xs font-bold leading-snug text-slate-50 sm:text-sm">
                                <span className="mr-1.5 font-black tabular-nums text-amber-100">Lv.{petLevel}</span>
                                <span className="break-words">{petLabel}</span>
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span
                                    className={`rounded border border-white/20 bg-black/45 px-1.5 py-0.5 text-[0.65rem] font-extrabold leading-none sm:px-2 sm:py-0.5 sm:text-xs ${petSt.color}`}
                                >
                                    {gradeKo}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="rounded-lg border border-rose-400/55 bg-gradient-to-br from-rose-950/80 via-red-950/65 to-black/70 px-2.5 py-2 text-[0.65rem] font-medium leading-snug text-rose-50/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:px-3 sm:py-2.5 sm:text-xs sm:leading-relaxed">
                    <p className="text-xs font-bold tracking-tight text-rose-100 sm:text-sm">
                        주의: 영혼변환은 취소하거나 복구할 수 없습니다.
                    </p>
                    <ul className="mt-1.5 list-disc space-y-0.5 pl-3.5 font-semibold text-rose-100/92 sm:mt-2 sm:space-y-1 sm:pl-4">
                        <li>선택한 펫은 인벤토리에서 영구 삭제됩니다.</li>
                        <li>레벨, 경험치, 성향, 코어 보너스 정보가 모두 사라집니다.</li>
                        <li>영혼변환 버튼을 누르면 즉시 변환됩니다.</li>
                    </ul>
                </div>

                <div className="rounded-lg border border-violet-400/25 bg-violet-950/25 px-2.5 py-2 sm:px-3 sm:py-2.5">
                    <p className="text-center text-xs font-semibold text-violet-200/90 sm:text-sm">변환 시 지급</p>
                    <div className="mt-2 flex items-center gap-2.5 sm:gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-black/40 p-1 ring-1 ring-white/10 sm:h-14 sm:w-14">
                            <img
                                src={soulMeta?.image ?? '/images/pets/soulstone1.webp'}
                                alt=""
                                className="max-h-full max-w-full object-contain"
                                loading="lazy"
                            />
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                            <p className="break-words text-xs font-extrabold text-violet-50 sm:text-sm">{rewardName}</p>
                            {preview.mythicTier ? (
                                <p className="mt-0.5 text-[0.65rem] leading-snug text-slate-300 sm:text-xs">
                                    <span className="font-bold text-fuchsia-200">{preview.fixedQty}개</span>를 받습니다. (확정)
                                </p>
                            ) : (
                                <p className="mt-0.5 text-[0.65rem] leading-snug text-slate-300 sm:text-xs">
                                    <span className="font-bold text-fuchsia-200">
                                        {preview.qtyMin}~{preview.qtyMax}개
                                    </span>
                                    를 무작위로 받습니다. 실제 개수는 변환 시 정해집니다.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-row items-stretch justify-stretch gap-2 border-t border-white/10 pt-2 sm:justify-center sm:gap-2.5">
                    <Button
                        type="button"
                        colorScheme="none"
                        className="min-w-0 flex-1 !rounded-md !border !border-rose-400/65 !bg-gradient-to-b !from-rose-600/95 !to-red-950/95 !px-2 !py-1.5 !text-xs !font-bold !text-rose-50 disabled:!opacity-45 sm:!min-w-[7.5rem] sm:!flex-none sm:!rounded-lg sm:!px-5 sm:!py-2 sm:!text-sm"
                        disabled={isBusy}
                        onClick={() => void onConfirm()}
                    >
                        영혼변환
                    </Button>
                    <Button
                        type="button"
                        colorScheme="none"
                        className="min-w-0 flex-1 !rounded-md !border !border-white/20 !bg-black/40 !px-2 !py-1.5 !text-xs !font-semibold !text-slate-200 sm:!flex-none sm:!rounded-lg sm:!px-5 sm:!py-2 sm:!text-sm"
                        disabled={isBusy}
                        onClick={onClose}
                    >
                        취소
                    </Button>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default PairPetSoulConvertModal;
