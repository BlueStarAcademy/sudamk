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
    const petBg = gradeBackgrounds[displayGrade] ?? gradeBackgrounds[ItemGrade.Normal];
    const petSt = gradeStyles[displayGrade] ?? gradeStyles[ItemGrade.Normal];

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
                <div className="rounded-lg border border-amber-300/45 bg-amber-950/35 px-3 py-2 text-center text-sm font-black tracking-tight text-amber-100">
                    펫을 떠나 보냅니다
                </div>

                <div
                    className={`rounded-xl border px-3 py-2.5 ${petBg} ${petSt.border ?? ''}`}
                    style={petSt.style}
                >
                    <div className="flex items-center gap-3">
                        <div
                            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-lg p-1 ring-1 ring-white/15 ${petBg}`}
                            style={petSt.style}
                        >
                            <img src={item.image} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-black text-slate-50">
                                <span className="mr-1.5 font-black tabular-nums text-amber-100">Lv.{petLevel}</span>
                                {petLabel}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className={`rounded-md border border-white/20 bg-black/45 px-2 py-0.5 text-[0.7rem] font-extrabold leading-none ${petSt.color}`}>
                                    {gradeKo}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border-2 border-rose-400/70 bg-gradient-to-br from-rose-950/80 via-red-950/65 to-black/70 px-3 py-3 text-xs leading-relaxed text-rose-50 shadow-[0_0_22px_rgba(244,63,94,0.22),inset_0_1px_0_rgba(255,255,255,0.08)]">
                    <p className="text-sm font-black tracking-tight text-rose-100">
                        주의: 영혼변환은 취소하거나 복구할 수 없습니다.
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-4 font-semibold text-rose-100/95">
                        <li>선택한 펫은 인벤토리에서 영구 삭제됩니다.</li>
                        <li>레벨, 경험치, 성향, 코어 보너스 정보가 모두 사라집니다.</li>
                        <li>영혼변환 버튼을 누르면 즉시 변환됩니다.</li>
                    </ul>
                </div>

                <div className="rounded-lg border border-violet-400/25 bg-violet-950/25 px-3 py-3">
                    <p className="text-center text-xs font-semibold text-violet-200/90">변환 시 지급</p>
                    <div className="mt-3 flex flex-col items-center gap-2">
                        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-black/40 p-1 ring-1 ring-white/12">
                            <img
                                src={soulMeta?.image ?? '/images/pets/soulstone1.webp'}
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

                <div className="flex flex-wrap justify-center gap-2 border-t border-white/10 pt-2">
                    <Button
                        type="button"
                        colorScheme="none"
                        className="!rounded-lg !border !border-rose-400/70 !bg-gradient-to-b !from-rose-600/95 !to-red-950/95 !px-4 !py-2 !text-xs !font-black !text-rose-50 !shadow-[0_0_14px_rgba(244,63,94,0.28)] disabled:!opacity-45"
                        disabled={isBusy}
                        onClick={() => void onConfirm()}
                    >
                        영혼변환
                    </Button>
                    <Button
                        type="button"
                        colorScheme="none"
                        className="!rounded-lg !border !border-white/20 !bg-black/40 !px-4 !py-2 !text-xs !font-bold !text-slate-200"
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
