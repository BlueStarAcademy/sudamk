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
        >
            <div className="flex flex-col gap-4 px-2 pb-3 pt-1.5 sm:gap-4 sm:px-3 sm:pb-3.5">
                <div className="rounded-lg border border-amber-300/45 bg-amber-950/35 px-4 py-2.5 text-center text-base font-black tracking-tight text-amber-100 sm:text-lg">
                    펫을 떠나 보냅니다
                </div>

                <div className="rounded-xl border border-amber-300/35 bg-zinc-950/90 px-4 py-3 ring-1 ring-white/[0.06] sm:px-4 sm:py-3.5">
                    <div className="flex items-center gap-4">
                        <div
                            className="flex h-[5.25rem] w-[5.25rem] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black/35 p-1.5 ring-1 ring-white/15 sm:h-24 sm:w-24"
                            style={petCardBgStyle}
                        >
                            <img src={item.image} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-base font-black text-slate-50 sm:text-lg">
                                <span className="mr-2 font-black tabular-nums text-amber-100">Lv.{petLevel}</span>
                                {petLabel}
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                <span
                                    className={`rounded-md border border-white/20 bg-black/45 px-2.5 py-1 text-xs font-extrabold leading-none sm:text-sm ${petSt.color}`}
                                >
                                    {gradeKo}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border-2 border-rose-400/70 bg-gradient-to-br from-rose-950/80 via-red-950/65 to-black/70 px-4 py-3.5 text-sm leading-relaxed text-rose-50 shadow-[0_0_22px_rgba(244,63,94,0.22),inset_0_1px_0_rgba(255,255,255,0.08)] sm:px-4 sm:py-4">
                    <p className="text-base font-black tracking-tight text-rose-100 sm:text-lg">
                        주의: 영혼변환은 취소하거나 복구할 수 없습니다.
                    </p>
                    <ul className="mt-2.5 list-disc space-y-1.5 pl-5 font-semibold text-rose-100/95 sm:mt-3 sm:space-y-2">
                        <li>선택한 펫은 인벤토리에서 영구 삭제됩니다.</li>
                        <li>레벨, 경험치, 성향, 코어 보너스 정보가 모두 사라집니다.</li>
                        <li>영혼변환 버튼을 누르면 즉시 변환됩니다.</li>
                    </ul>
                </div>

                <div className="rounded-lg border border-violet-400/25 bg-violet-950/25 px-4 py-3.5 sm:px-5 sm:py-4">
                    <p className="text-center text-sm font-semibold text-violet-200/90 sm:text-base">변환 시 지급</p>
                    <div className="mt-4 flex flex-col items-center gap-2.5 sm:mt-5 sm:gap-3">
                        <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-black/40 p-1.5 ring-1 ring-white/12 sm:h-28 sm:w-28">
                            <img
                                src={soulMeta?.image ?? '/images/pets/soulstone1.webp'}
                                alt=""
                                className="max-h-full max-w-full object-contain"
                                loading="lazy"
                            />
                        </div>
                        <p className="text-center text-base font-extrabold text-violet-50 sm:text-lg">{preview.materialName}</p>
                        {preview.mythicTier ? (
                            <p className="max-w-md text-center text-sm leading-relaxed text-slate-300 sm:text-base">
                                <span className="font-bold text-fuchsia-200">{preview.fixedQty}개</span>를 받습니다. (확정)
                            </p>
                        ) : (
                            <p className="max-w-md text-center text-sm leading-relaxed text-slate-300 sm:text-base">
                                <span className="font-bold text-fuchsia-200">
                                    {preview.qtyMin}~{preview.qtyMax}개
                                </span>
                                를 무작위로 받습니다. 실제 개수는 변환 시 정해집니다.
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap justify-center gap-2.5 border-t border-white/10 pt-2.5 sm:gap-3 sm:pt-3">
                    <Button
                        type="button"
                        colorScheme="none"
                        className="!rounded-lg !border !border-rose-400/70 !bg-gradient-to-b !from-rose-600/95 !to-red-950/95 !px-6 !py-2.5 !text-sm !font-black !text-rose-50 !shadow-[0_0_14px_rgba(244,63,94,0.28)] disabled:!opacity-45 sm:!text-base"
                        disabled={isBusy}
                        onClick={() => void onConfirm()}
                    >
                        영혼변환
                    </Button>
                    <Button
                        type="button"
                        colorScheme="none"
                        className="!rounded-lg !border !border-white/20 !bg-black/40 !px-6 !py-2.5 !text-sm !font-bold !text-slate-200 sm:!text-base"
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
