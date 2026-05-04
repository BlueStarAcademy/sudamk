import React, { useMemo, useState } from 'react';
import Button from '../Button.js';
import PairPetGradeUpgradeModal from './PairPetGradeUpgradeModal.js';
import PairPetDetailEmbedPanel from './PairPetDetailEmbedPanel.js';
import type { InventoryItem, ServerAction, User } from '../../types.js';
import { ItemGrade } from '../../types/enums.js';
import { resolvePairPetMetaFromInventoryRow } from '../../shared/utils/pairPetRoll.js';
import {
    isPairPetUpgradeableGrade,
    PAIR_PET_MAX_LEVEL,
    pairPetGradeUpgradeSoulStoneCount,
    pairPetGradeUpgradeSoulStoneMaterialName,
    pairPetGradeUpgradeSoulTemplateId,
    pairPetMinLevelForNextGrade,
} from '../../shared/constants/pairPetGrade.js';
import { isPairSoulStoneItem } from '../../shared/constants/petLobby.js';

export interface PairPetLobbyInfoPetViewerProps {
    currentUser: User;
    item: InventoryItem;
    isBusy: boolean;
    /** 현재 대표로 장착된 펫의 `templateId` */
    equippedTemplateId: string | null;
    /** 수련 슬롯에 올라가 있는 펫은 대표로 지정할 수 없음 */
    petInTraining?: boolean;
    /**
     * 로비 정보 패널: `panelFit`(기본). 전역 펫 상세 모달 등: `modal` — {@link PairPetDetailCardBody} 타이포를 획득/상세 모달과 동일하게.
     */
    embedDetailVariant?: 'modal' | 'panelFit';
    onSetRepresentative: (templateId: string, inventoryItemId: string) => void;
    onClearRepresentative: () => void;
    onSoulConvert: (item: InventoryItem) => void;
    applyPetAction: (action: ServerAction) => Promise<unknown>;
}

const PairPetLobbyInfoPetViewer: React.FC<PairPetLobbyInfoPetViewerProps> = ({
    currentUser,
    item,
    isBusy,
    equippedTemplateId,
    petInTraining = false,
    embedDetailVariant = 'panelFit',
    onSetRepresentative,
    onClearRepresentative,
    onSoulConvert,
    applyPetAction,
}) => {
    const tid = item.templateId ?? null;
    const eqRowId = currentUser.equippedPairPetInventoryItemId ?? null;
    const isRepresentative = Boolean(
        tid && equippedTemplateId === tid && (!eqRowId || eqRowId === item.id),
    );
    const [gradeModalOpen, setGradeModalOpen] = useState(false);

    const meta = useMemo(() => resolvePairPetMetaFromInventoryRow(item), [item]);
    const levelSafe = Math.min(PAIR_PET_MAX_LEVEL, Math.max(1, Math.floor(meta.level) || 1));
    const storedPetGrade = item.grade ?? ItemGrade.Normal;
    const needLv = pairPetMinLevelForNextGrade(storedPetGrade);
    const soulTid = pairPetGradeUpgradeSoulTemplateId(storedPetGrade);
    const soulNeed = pairPetGradeUpgradeSoulStoneCount(storedPetGrade);
    const soulNameKo = pairPetGradeUpgradeSoulStoneMaterialName(storedPetGrade);
    const ownedSoul = useMemo(() => {
        if (!soulTid) return 0;
        return (currentUser.inventory || []).reduce((sum, it) => {
            if (!isPairSoulStoneItem(it) || it.templateId !== soulTid) return sum;
            return sum + (it.quantity ?? 1);
        }, 0);
    }, [currentUser.inventory, soulTid]);
    const canGradeUpgrade =
        isPairPetUpgradeableGrade(storedPetGrade) &&
        levelSafe >= needLv &&
        soulNeed != null &&
        soulTid != null &&
        ownedSoul >= soulNeed;

    const onGradeConfirm = async () => {
        const res = await applyPetAction({
            type: 'PAIR_PET_UPGRADE_GRADE',
            payload: { mainItemId: item.id },
        });
        const err = (res as { error?: string })?.error;
        if (err) {
            window.alert(err);
            return;
        }
        setGradeModalOpen(false);
    };

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-1.5 pb-1.5 pt-1.5 sm:px-2 sm:pb-2 sm:pt-2">
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-white/10 bg-black/20 p-1 ring-1 ring-white/[0.04] sm:p-1.5">
                    <PairPetDetailEmbedPanel
                        currentUser={currentUser}
                        item={item}
                        showRepresentativeBadge={isRepresentative}
                        detailVariant={embedDetailVariant}
                    />
                </div>
            </div>

            <div className="flex min-w-0 shrink-0 flex-nowrap gap-1.5 border-t border-white/10 bg-black/45 px-1.5 py-2 backdrop-blur-sm supports-[backdrop-filter]:bg-black/35 sm:gap-2 sm:px-2 sm:pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]">
                {isRepresentative ? (
                    <Button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void onClearRepresentative()}
                        colorScheme="none"
                        className="!min-w-0 !flex-1 !shrink !rounded-lg !border !border-white/25 !bg-black/45 !px-1 !py-2 !text-[0.7rem] !font-extrabold !leading-tight !text-slate-100 sm:!rounded-xl sm:!px-2 sm:!text-xs"
                    >
                        대표펫 해제
                    </Button>
                ) : (
                    <Button
                        type="button"
                        disabled={isBusy || !tid || petInTraining}
                        title={
                            petInTraining
                                ? '수련 중인 펫은 대표펫으로 지정할 수 없습니다. 수련을 마친 뒤 지정해 주세요.'
                                : undefined
                        }
                        onClick={() => {
                            if (tid) void onSetRepresentative(tid, item.id);
                        }}
                        colorScheme="none"
                        className="!min-w-0 !flex-1 !shrink !rounded-lg !border !border-cyan-400/50 !bg-cyan-950/55 !px-1 !py-2 !text-[0.7rem] !font-extrabold !leading-tight !text-cyan-50 sm:!rounded-xl sm:!px-2 sm:!text-xs"
                    >
                        대표펫
                    </Button>
                )}
                <Button
                    type="button"
                    disabled={isBusy || !canGradeUpgrade}
                    onClick={() => setGradeModalOpen(true)}
                    title={
                        canGradeUpgrade
                            ? `${soulNameKo ?? '영혼석'} ${soulNeed ?? ''}개 소모 · 등급 상승`
                            : soulNeed != null && ownedSoul < soulNeed
                              ? `${soulNameKo ?? '영혼석'}이 부족합니다. (${soulNeed}개 필요, 보유 ${ownedSoul})`
                              : `Lv.${needLv} 이상에서 등급 강화할 수 있습니다.`
                    }
                    colorScheme="none"
                    className="!min-w-0 !flex-1 !shrink !rounded-lg !border !border-amber-400/55 !bg-amber-950/45 !px-1 !py-2 !text-[0.7rem] !font-extrabold !leading-tight !text-amber-50 disabled:!opacity-45 sm:!rounded-xl sm:!px-2 sm:!text-xs"
                >
                    등급 강화
                </Button>
                <Button
                    type="button"
                    disabled={isBusy || isRepresentative || petInTraining}
                    title={
                        petInTraining
                            ? '수련 중인 펫은 영혼변환할 수 없습니다. 수련을 마친 뒤 이용하세요.'
                            : isRepresentative
                              ? '대표펫으로 장착 중인 펫은 영혼변환할 수 없습니다. 대표펫 해제 후 이용하세요.'
                              : undefined
                    }
                    onClick={() => void onSoulConvert(item)}
                    colorScheme="none"
                    className="!min-w-0 !flex-1 !shrink !rounded-lg !border !border-rose-500/55 !bg-gradient-to-b !from-rose-700/90 !to-rose-950/95 !px-1 !py-2 !text-[0.7rem] !font-extrabold !leading-tight !text-rose-50 !shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_12px_rgba(244,63,94,0.2)] hover:!border-rose-400/65 hover:!from-rose-600/95 hover:!to-rose-950 disabled:!opacity-45 sm:!rounded-xl sm:!px-2 sm:!text-xs"
                >
                    영혼변환
                </Button>
            </div>

            {gradeModalOpen ? (
                <PairPetGradeUpgradeModal
                    isOpen={gradeModalOpen}
                    onClose={() => setGradeModalOpen(false)}
                    currentUser={currentUser}
                    mainItem={item}
                    isBusy={isBusy}
                    onConfirm={onGradeConfirm}
                    isTopmost
                />
            ) : null}
        </div>
    );
};

export default PairPetLobbyInfoPetViewer;
