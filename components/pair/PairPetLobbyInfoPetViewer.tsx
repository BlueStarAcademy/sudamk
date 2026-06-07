import React, { useMemo, useState } from 'react';
import Button from '../Button.js';
import DraggableWindow from '../DraggableWindow.js';
import PairPetGradeUpgradeModal from './PairPetGradeUpgradeModal.js';
import PairPetDetailEmbedPanel from './PairPetDetailEmbedPanel.js';
import { resolvePetInfoViewerEmbedLayout } from './pairPetHomeEmbedLayout.js';
import { PET_MGMT_ACTION_BAR_CLASS, PET_MGMT_ACTION_BTN_CLASS } from './pairPetDetailPanelUi.js';
import type { InventoryItem, ServerAction, User } from '../../types.js';
import PairPetGradeUpgradeResultModal from './PairPetGradeUpgradeResultModal.js';
import { ItemGrade } from '../../types/enums.js';
import { resolvePairPetMetaFromInventoryRow } from '../../shared/utils/pairPetRoll.js';
import {
    isPairPetUpgradeableGrade,
    nextPairPetGrade,
    PAIR_PET_MAX_LEVEL,
    pairPetGradeUpgradeSoulStoneCount,
    pairPetGradeUpgradeSoulStoneMaterialName,
    pairPetGradeUpgradeSoulTemplateId,
    pairPetMinLevelForNextGrade,
} from '../../shared/constants/pairPetGrade.js';
import { isPairSoulStoneItem } from '../../shared/constants/petLobby.js';

function mergeUserForPetGradeResult(base: User, patch?: Partial<User> | null): User {
    if (!patch) return base;
    return {
        ...base,
        ...patch,
        inventory: Array.isArray(patch.inventory) ? patch.inventory : base.inventory,
        equippedPairPetTemplateId:
            patch.equippedPairPetTemplateId !== undefined
                ? patch.equippedPairPetTemplateId
                : base.equippedPairPetTemplateId,
        equippedPairPetInventoryItemId:
            patch.equippedPairPetInventoryItemId !== undefined
                ? patch.equippedPairPetInventoryItemId
                : base.equippedPairPetInventoryItemId,
    } as User;
}

type PairPetGradeSuccessState = {
    fromGrade: ItemGrade;
    toGrade: ItemGrade;
    itemAfter: InventoryItem;
    userForStats: User;
};

export interface PairPetLobbyInfoPetViewerProps {
    currentUser: User;
    item: InventoryItem;
    isBusy: boolean;
    /** 현재 대표로 장착된 펫의 `templateId` */
    equippedTemplateId: string | null;
    /** 수련 슬롯에 올라가 있는 펫은 대표로 지정할 수 없음 */
    petInTraining?: boolean;
    onSetRepresentative: (templateId: string, inventoryItemId: string) => void;
    onClearRepresentative: () => void;
    onSoulConvert: (item: InventoryItem) => void;
    applyPetAction: (action: ServerAction) => Promise<unknown>;
    /** 펫 관리 모달: true(기본) — 남는 높이 채움. 상세보기: false — 콘텐츠 높이만 */
    fillParent?: boolean;
    /** `fillParent={false}`일 때 본문 스크롤 상한 (CSS length) */
    bodyMaxHeightCss?: string;
    /** 펫 획득 모달 — 하단 액션 바 숨김(확인만) */
    hideActionBar?: boolean;
}

const petInfoEmbed = resolvePetInfoViewerEmbedLayout();

/**
 * 펫 관리 모달 정보 탭 — 좁은 모달에 맞춘 {@link PairPetDetailCardBody} panelFit + 균등 축소.
 */
const PairPetLobbyInfoPetViewer: React.FC<PairPetLobbyInfoPetViewerProps> = ({
    currentUser,
    item,
    isBusy,
    equippedTemplateId,
    petInTraining = false,
    onSetRepresentative,
    onClearRepresentative,
    onSoulConvert,
    applyPetAction,
    fillParent = true,
    bodyMaxHeightCss,
    hideActionBar = false,
}) => {
    const tid = item.templateId ?? null;
    const eqRowId = currentUser.equippedPairPetInventoryItemId ?? null;
    const isRepresentative = Boolean(
        tid && equippedTemplateId === tid && (!eqRowId || eqRowId === item.id),
    );
    const [gradeModalOpen, setGradeModalOpen] = useState(false);
    const [gradeBlockHint, setGradeBlockHint] = useState<string | null>(null);
    const [gradeSuccess, setGradeSuccess] = useState<PairPetGradeSuccessState | null>(null);

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

    const openGradeUpgradeOrHint = () => {
        if (isBusy) return;
        if (petInTraining) {
            setGradeBlockHint('수련 중인 펫은 등급 강화할 수 없습니다. 수련을 마친 뒤 이용해 주세요.');
            return;
        }
        if (!isPairPetUpgradeableGrade(storedPetGrade)) {
            setGradeBlockHint('더 올릴 수 있는 등급이 없습니다.');
            return;
        }
        if (levelSafe < needLv) {
            setGradeBlockHint(`펫 레벨이 부족합니다. Lv.${needLv} 필요 (현재 Lv.${levelSafe})`);
            return;
        }
        if (soulNeed == null || soulTid == null) {
            setGradeBlockHint('등급 강화 조건을 확인할 수 없습니다.');
            return;
        }
        if (ownedSoul < soulNeed) {
            setGradeBlockHint(
                `${soulNameKo ?? '영혼석'}이 부족합니다. ${soulNeed}개 필요 (보유 ${ownedSoul}개)`,
            );
            return;
        }
        setGradeModalOpen(true);
    };

    const onGradeConfirm = async () => {
        const fromG = item.grade ?? ItemGrade.Normal;
        const toG = nextPairPetGrade(fromG);
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
        if (!toG) return;
        const updated =
            (res as { clientResponse?: { updatedUser?: User } })?.clientResponse?.updatedUser ??
            (res as { updatedUser?: User })?.updatedUser;
        const inv = updated?.inventory ?? currentUser.inventory;
        const rowAfter = Array.isArray(inv) ? inv.find((i) => i.id === item.id) : undefined;
        const itemAfter = rowAfter ?? { ...item, grade: toG };
        const userForStats = mergeUserForPetGradeResult(currentUser, updated ?? null);
        setGradeSuccess({ fromGrade: fromG, toGrade: toG, itemAfter, userForStats });
    };

    return (
        <div
            className={
                fillParent
                    ? 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'
                    : 'flex w-full min-w-0 flex-col overflow-hidden'
            }
            style={!fillParent && bodyMaxHeightCss ? { maxHeight: bodyMaxHeightCss } : undefined}
        >
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain [scrollbar-width:thin]">
                <PairPetDetailEmbedPanel
                    currentUser={currentUser}
                    item={item}
                    showRepresentativeBadge={isRepresentative}
                    {...petInfoEmbed}
                />
            </div>

            {hideActionBar ? null : (
            <div className={PET_MGMT_ACTION_BAR_CLASS}>
                {isRepresentative ? (
                    <Button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void onClearRepresentative()}
                        colorScheme="none"
                        className={`${PET_MGMT_ACTION_BTN_CLASS} !border !border-white/25 !bg-black/45 !text-slate-100`}
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
                        className={`${PET_MGMT_ACTION_BTN_CLASS} !border !border-cyan-400/50 !bg-cyan-950/55 !text-cyan-50`}
                    >
                        대표펫 장착
                    </Button>
                )}
                <Button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void openGradeUpgradeOrHint()}
                    title={
                        canGradeUpgrade
                            ? `${soulNameKo ?? '영혼석'} ${soulNeed ?? ''}개 소모 · 등급 상승`
                            : petInTraining
                              ? '수련 중인 펫은 등급 강화할 수 없습니다.'
                              : !isPairPetUpgradeableGrade(storedPetGrade)
                                ? '더 올릴 수 있는 등급이 없습니다.'
                                : soulNeed != null && ownedSoul < soulNeed
                                  ? `${soulNameKo ?? '영혼석'}이 부족합니다. (${soulNeed}개 필요, 보유 ${ownedSoul})`
                                  : `Lv.${needLv} 이상에서 등급 강화할 수 있습니다.`
                    }
                    colorScheme="none"
                    className={`${PET_MGMT_ACTION_BTN_CLASS} !border !border-amber-400/55 !bg-amber-950/45 !text-amber-50 disabled:!opacity-45`}
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
                    className={`${PET_MGMT_ACTION_BTN_CLASS} !border !border-rose-500/55 !bg-gradient-to-b !from-rose-700/90 !to-rose-950/95 !text-rose-50 !shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_12px_rgba(244,63,94,0.2)] hover:!border-rose-400/65 hover:!from-rose-600/95 hover:!to-rose-950 disabled:!opacity-45`}
                >
                    영혼변환
                </Button>
            </div>
            )}

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
            {gradeBlockHint ? (
                <DraggableWindow
                    title="안내"
                    onClose={() => setGradeBlockHint(null)}
                    windowId="pair-pet-grade-block-hint"
                    initialWidth={420}
                    shrinkHeightToContent
                    isTopmost
                    zIndex={73}
                    skipSavedPosition
                    variant="store"
                    hideFooter
                    bodyPaddingClassName="!p-4 sm:!p-5"
                >
                    <p className="text-center text-sm font-medium leading-relaxed text-slate-200 sm:text-[0.95rem]">
                        {gradeBlockHint}
                    </p>
                </DraggableWindow>
            ) : null}
            {gradeSuccess ? (
                <PairPetGradeUpgradeResultModal
                    isOpen
                    onClose={() => setGradeSuccess(null)}
                    currentUser={gradeSuccess.userForStats}
                    itemAfter={gradeSuccess.itemAfter}
                    fromGrade={gradeSuccess.fromGrade}
                    toGrade={gradeSuccess.toGrade}
                    isTopmost
                />
            ) : null}
        </div>
    );
};

export default PairPetLobbyInfoPetViewer;
