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
import { effectivePairPetGradeFromRow } from '../../shared/constants/pairPetGrade.js';
import { getPairPetSoulConvertPreview } from '../../shared/utils/pairPetSoulConvert.js';

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
    const storedGrade = item.grade ?? ItemGrade.Normal;
    const displayGrade = effectivePairPetGradeFromRow(item);
    const preview = useMemo(() => getPairPetSoulConvertPreview(item), [item]);
    const soulMeta =
        preview.materialName in MATERIAL_ITEMS
            ? MATERIAL_ITEMS[preview.materialName as keyof typeof MATERIAL_ITEMS]
            : null;
    const petLabel = getPairPetDisplayName(item);
    const gradeKo = EQUIPMENT_GRADE_LABEL_KO[displayGrade] ?? displayGrade;
    const petBg = gradeBackgrounds[storedGrade] ?? gradeBackgrounds[ItemGrade.Normal];
    const petSt = gradeStyles[storedGrade];

    if (!isOpen) return null;

    return (
        <DraggableWindow
            title="영혼변환"
            onClose={onClose}
            windowId="pair-pet-soul-convert"
            initialWidth={440}
            shrinkHeightToContent
            isTopmost={isTopmost}
            zIndex={72}
            skipSavedPosition
            variant="store"
            mobileViewportFit
            mobileViewportMaxHeightCss="min(92dvh, calc(100dvh - 16px))"
        >
            <div className="flex flex-col gap-3 px-1 pb-2 pt-1 sm:px-2">
                <div
                    className={`rounded-xl border px-3 py-2.5 ${petBg} ${petSt.border ?? ''}`}
                    style={petSt.style}
                >
                    <div className="flex items-center gap-3">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-black/35 p-1 ring-1 ring-white/15">
                            <img src={item.image} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-black text-slate-50">{petLabel}</p>
                            <p className="mt-0.5 text-xs font-semibold text-slate-300/95">{gradeKo}</p>
                        </div>
                    </div>
                </div>

                <div className="rounded-lg border border-rose-400/35 bg-rose-950/35 px-3 py-2.5 text-xs leading-relaxed text-rose-100/95">
                    <span className="font-bold text-rose-200">이 펫은 변환 후 인벤토리에서 사라집니다.</span>
                    복구되지 않으니 내용을 확인한 뒤 진행해 주세요.
                </div>

                <div className="rounded-lg border border-violet-400/25 bg-violet-950/25 px-3 py-3">
                    <p className="text-center text-xs font-semibold text-violet-200/90">변환 시 지급</p>
                    <div className="mt-3 flex flex-col items-center gap-2">
                        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-black/40 p-1 ring-1 ring-white/12">
                            <img
                                src={soulMeta?.image ?? '/images/materials/soulstone1.webp'}
                                alt=""
                                className="max-h-full max-w-full object-contain"
                                loading="lazy"
                            />
                        </div>
                        <p className="text-center text-sm font-extrabold text-violet-50">{preview.materialName}</p>
                        {preview.mythicTier ? (
                            <p className="text-center text-xs leading-relaxed text-slate-300">
                                <span className="font-bold text-fuchsia-200">{preview.fixedQty}개</span>를 받습니다. (확정)
                            </p>
                        ) : (
                            <p className="text-center text-xs leading-relaxed text-slate-300">
                                <span className="font-bold text-fuchsia-200">
                                    {preview.qtyMin}~{preview.qtyMax}개
                                </span>
                                를 무작위로 받습니다. 실제 개수는 변환 시 정해집니다.
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 pt-2">
                    <Button
                        type="button"
                        colorScheme="none"
                        className="!rounded-lg !border !border-white/20 !bg-black/40 !px-3 !py-2 !text-xs !font-bold !text-slate-200"
                        disabled={isBusy}
                        onClick={onClose}
                    >
                        취소
                    </Button>
                    <Button
                        type="button"
                        colorScheme="none"
                        className="!rounded-lg !border !border-violet-400/55 !bg-gradient-to-b !from-violet-600/90 !to-violet-950/95 !px-3 !py-2 !text-xs !font-black !text-violet-50 disabled:!opacity-45"
                        disabled={isBusy}
                        onClick={() => void onConfirm()}
                    >
                        영혼변환
                    </Button>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default PairPetSoulConvertModal;
