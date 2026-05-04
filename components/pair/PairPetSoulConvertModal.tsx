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
            initialWidth={540}
            shrinkHeightToContent
            isTopmost={isTopmost}
            zIndex={72}
            skipSavedPosition
            variant="store"
            mobileViewportFit
            mobileViewportMaxHeightCss="min(92dvh, calc(100dvh - 16px))"
            hideFooter
            bodyNoScroll
            bodyShrinkToContent
            bodyPaddingClassName="!p-0"
        >
            <div className="flex flex-col gap-1.5 px-2 pb-2 pt-1 sm:gap-4 sm:px-3 sm:pb-3.5 sm:pt-1.5">
                <div className="rounded-md border border-amber-300/40 bg-amber-950/35 px-2 py-1.5 text-center text-xs font-bold tracking-tight text-amber-100 sm:rounded-lg sm:px-4 sm:py-2.5 sm:text-base sm:font-black sm:tracking-tight sm:text-lg">
                    펫을 떠나 보냅니다
                </div>

                <div className="rounded-lg border border-amber-300/35 bg-zinc-950/90 px-2 py-2 ring-1 ring-white/[0.06] sm:rounded-xl sm:px-4 sm:py-3.5">
                    <div className="flex items-start gap-2 sm:items-center sm:gap-4">
                        <div
                            className="flex h-[3.25rem] w-[3.25rem] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black/35 p-1 ring-1 ring-white/12 sm:h-24 sm:w-24 sm:rounded-xl sm:p-1.5 sm:ring-white/15"
                            style={petCardBgStyle}
                        >
                            <img src={item.image} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                            <p className="text-xs font-bold leading-snug text-slate-50 sm:text-lg sm:font-black">
                                <span className="mr-1.5 font-black tabular-nums text-amber-100 sm:mr-2">Lv.{petLevel}</span>
                                <span className="break-words">{petLabel}</span>
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 sm:mt-1.5 sm:gap-2">
                                <span
                                    className={`rounded border border-white/20 bg-black/45 px-1.5 py-0.5 text-[0.65rem] font-extrabold leading-none sm:rounded-md sm:px-2.5 sm:py-1 sm:text-sm ${petSt.color}`}
                                >
                                    {gradeKo}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="rounded-lg border-2 border-rose-400/65 bg-gradient-to-br from-rose-950/80 via-red-950/65 to-black/70 px-2 py-2 text-[0.65rem] font-medium leading-snug text-rose-50/95 shadow-[0_0_16px_rgba(244,63,94,0.18),inset_0_1px_0_rgba(255,255,255,0.06)] sm:rounded-xl sm:px-4 sm:py-3.5 sm:text-sm sm:leading-relaxed sm:shadow-[0_0_22px_rgba(244,63,94,0.22),inset_0_1px_0_rgba(255,255,255,0.08)]">
                    <p className="text-xs font-bold tracking-tight text-rose-100 sm:text-base sm:font-black sm:text-lg">
                        주의: 영혼변환은 취소하거나 복구할 수 없습니다.
                    </p>
                    <ul className="mt-1.5 list-disc space-y-0.5 pl-3.5 font-semibold text-rose-100/92 sm:mt-2.5 sm:space-y-1.5 sm:pl-5 sm:text-rose-100/95">
                        <li>선택한 펫은 인벤토리에서 영구 삭제됩니다.</li>
                        <li>레벨, 경험치, 성향, 코어 보너스 정보가 모두 사라집니다.</li>
                        <li>영혼변환 버튼을 누르면 즉시 변환됩니다.</li>
                    </ul>
                </div>

                <div className="rounded-lg border border-violet-400/25 bg-violet-950/25 px-2 py-2 sm:rounded-lg sm:px-5 sm:py-4">
                    <p className="text-center text-xs font-semibold text-violet-200/90 sm:text-base">변환 시 지급</p>
                    <div className="mt-2 flex flex-col items-center gap-1.5 sm:mt-5 sm:gap-3">
                        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-black/40 p-1 ring-1 ring-white/10 sm:h-28 sm:w-28 sm:rounded-xl sm:p-1.5 sm:ring-white/12">
                            <img
                                src={soulMeta?.image ?? '/images/pets/soulstone1.webp'}
                                alt=""
                                className="max-h-full max-w-full object-contain"
                                loading="lazy"
                            />
                        </div>
                        <p className="max-w-full break-words px-0.5 text-center text-xs font-extrabold text-violet-50 sm:text-lg">
                            {rewardName}
                        </p>
                        {preview.mythicTier ? (
                            <p className="max-w-full break-words px-0.5 text-center text-[0.65rem] leading-snug text-slate-300 sm:text-base sm:leading-relaxed">
                                <span className="font-bold text-fuchsia-200">{preview.fixedQty}개</span>를 받습니다. (확정)
                            </p>
                        ) : (
                            <p className="max-w-full break-words px-0.5 text-center text-[0.65rem] leading-snug text-slate-300 sm:text-base sm:leading-relaxed">
                                <span className="font-bold text-fuchsia-200">
                                    {preview.qtyMin}~{preview.qtyMax}개
                                </span>
                                를 무작위로 받습니다. 실제 개수는 변환 시 정해집니다.
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex flex-row items-stretch justify-stretch gap-2 border-t border-white/10 pt-1.5 sm:flex-wrap sm:justify-center sm:gap-3 sm:pt-3">
                    <Button
                        type="button"
                        colorScheme="none"
                        className="min-w-0 flex-1 !rounded-md !border !border-rose-400/65 !bg-gradient-to-b !from-rose-600/95 !to-red-950/95 !px-2 !py-1.5 !text-xs !font-bold !text-rose-50 !shadow-[0_0_10px_rgba(244,63,94,0.22)] disabled:!opacity-45 sm:!min-w-0 sm:!flex-none sm:!rounded-lg sm:!px-6 sm:!py-2.5 sm:!text-sm sm:!font-black sm:!text-base sm:!shadow-[0_0_14px_rgba(244,63,94,0.28)]"
                        disabled={isBusy}
                        onClick={() => void onConfirm()}
                    >
                        영혼변환
                    </Button>
                    <Button
                        type="button"
                        colorScheme="none"
                        className="min-w-0 flex-1 !rounded-md !border !border-white/20 !bg-black/40 !px-2 !py-1.5 !text-xs !font-semibold !text-slate-200 sm:!flex-none sm:!rounded-lg sm:!px-6 sm:!py-2.5 sm:!text-sm sm:!font-bold sm:!text-base"
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
