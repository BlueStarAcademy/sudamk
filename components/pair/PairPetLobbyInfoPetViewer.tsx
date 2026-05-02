import React, { useMemo, useState } from 'react';
import Button from '../Button.js';
import PairPetGradeUpgradeModal from './PairPetGradeUpgradeModal.js';
import PairPetDetailCardBody from './PairPetDetailCardBody.js';
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

/** `PairPetLobbyPanel` 정보 탭 본문 스크롤 — 가방과 동일한 얇은 스크롤바 */
const PET_INFO_DETAIL_SCROLLBAR_CLASS =
    '[scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.28)_transparent] [&::-webkit-scrollbar]:w-[2px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-500/40 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400/55';

export interface PairPetLobbyInfoPetViewerProps {
    currentUser: User;
    item: InventoryItem;
    isBusy: boolean;
    /** 현재 대표로 장착된 펫의 `templateId` */
    equippedTemplateId: string | null;
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
            <div
                className={`min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-1.5 pb-1.5 pt-1.5 [-webkit-overflow-scrolling:touch] sm:px-2 sm:pb-2 sm:pt-2 ${PET_INFO_DETAIL_SCROLLBAR_CLASS}`}
            >
                <div className="min-w-0 rounded-lg border border-white/10 bg-black/20 p-1.5 ring-1 ring-white/[0.04] sm:p-2">
                    <PairPetDetailCardBody
                        currentUser={currentUser}
                        item={item}
                        statsGridVariant="modal"
                        showRepresentativeBadge={isRepresentative}
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
                        disabled={isBusy || !tid}
                        onClick={() => tid && void onSetRepresentative(tid, item.id)}
                        colorScheme="none"
                        className="!min-w-0 !flex-1 !shrink !rounded-lg !border !border-cyan-400/50 !bg-cyan-950/55 !px-1 !py-2 !text-[0.7rem] !font-extrabold !leading-tight !text-cyan-50 sm:!rounded-xl sm:!px-2 sm:!text-xs"
                    >
                        대표펫
                    </Button>
                )}
                <Button
                    type="button"
                    disabled={isBusy || isRepresentative}
                    title={
                        isRepresentative
                            ? '대표펫으로 장착 중인 펫은 영혼변환할 수 없습니다. 대표펫 해제 후 이용하세요.'
                            : undefined
                    }
                    onClick={() => void onSoulConvert(item)}
                    colorScheme="none"
                    className="!min-w-0 !flex-1 !shrink !rounded-lg !border !border-violet-400/50 !bg-violet-950/50 !px-1 !py-2 !text-[0.7rem] !font-extrabold !leading-tight !text-violet-50 sm:!rounded-xl sm:!px-2 sm:!text-xs"
                >
                    영혼변환
                </Button>
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
