import React, { useLayoutEffect, useMemo, useRef } from 'react';
import Avatar from '../Avatar.js';
import type { User } from '../../types.js';
import { ItemGrade } from '../../types/enums.js';
import { getPairPetDefinition, getPairPetDisplayName } from '../../shared/constants/petLobby.js';
import { effectivePairPetGradeFromRow, PAIR_PET_MAX_LEVEL } from '../../shared/constants/pairPetGrade.js';
import { getEquippedPairPetInventoryRow } from '../../shared/utils/pairEquippedPet.js';
import { resolvePairPetMetaFromInventoryRow } from '../../shared/utils/pairPetRoll.js';
import { computePairPetBadukTotalPower } from './PairPetCoreStatsGrid.js';
import { gradeStyles, EQUIPMENT_GRADE_LABEL_KO } from '../../shared/constants/items.js';

/** 한 줄 안에 들어가도록 줄이는 최소·최대 글자 크기(px) */
const PET_PROFILE_LINE_FONT_MIN = 6.5;
const PET_PROFILE_LINE_FONT_MAX = 13.5;

export interface PairPetProfilePanelProps {
    currentUser: User;
    currentUserId: string;
    isBusy: boolean;
    /** 대표 펫이 있을 때 상세 모달 열기 */
    onOpenEquippedPetDetail: () => void;
    /** 대표펫 미지정 시 패널 클릭 → 정보 탭 펫 인벤으로 이동 */
    onFocusPetInventory?: () => void;
    /** 홈 프로필 등 좁은 영역: 패딩·아바타·본문 글자 축소 */
    compact?: boolean;
    /** 상위 카드가 테두리·배경을 담당할 때 내부만 표시 */
    embed?: boolean;
    /** 하단에 바둑능력 스트립이 있을 때 인라인 칩 중복 방지 */
    hideInlineBadukChip?: boolean;
    /** 홈 대표펫 등: 등급 옆 대표펫 배지 */
    showRepresentativeBadge?: boolean;
    /** 홈 우측 대표펫 칸: 아바타·한 줄·상세 버튼을 더 작게 */
    homeColumn?: boolean;
    /** 페어 경기장 로비 상단: 아바타·본문 글자를 한 단계 키움( compact=false 와 함께 사용) */
    pairLobbyProminent?: boolean;
    /** 우측 상세 버튼 문구 덮어쓰기(예: 상세보기) */
    detailButtonLabel?: string;
    /** 타인 프로필 등: 상세·인벤 이동 비활성(표시만) */
    readOnly?: boolean;
    /** 펫 관리 모달 상단: compact여도 글자·아바타를 한 단계 키움 */
    petManagementModal?: boolean;
    /** 홈 좌측 하단: 좌측 펫 정보·우측 바둑능력 분리, 글자 크기 통일 */
    profileHomeFooter?: boolean;
    /** 네이티브 홈 배너 50% 칸: 아바타·한 줄 중앙 정렬 */
    profileHomeBannerAside?: boolean;
}

const PairPetProfilePanel: React.FC<PairPetProfilePanelProps> = ({
    currentUser,
    currentUserId,
    isBusy,
    onOpenEquippedPetDetail,
    onFocusPetInventory,
    compact = false,
    embed = false,
    hideInlineBadukChip = false,
    showRepresentativeBadge = false,
    homeColumn = false,
    pairLobbyProminent = false,
    detailButtonLabel,
    readOnly = false,
    petManagementModal = false,
    profileHomeFooter = false,
    profileHomeBannerAside = false,
}) => {
    const lineFontMax =
        profileHomeBannerAside
            ? 11.5
            : profileHomeFooter
              ? 14
              : pairLobbyProminent && !compact
                ? 17
                : petManagementModal && compact
                  ? 14.5
                  : homeColumn && compact
                    ? 9.75
                    : compact
                      ? 11.5
                      : PET_PROFILE_LINE_FONT_MAX;
    const lineFontMin =
        profileHomeBannerAside
            ? 7.5
            : profileHomeFooter
              ? 11.5
              : pairLobbyProminent && !compact
                ? 8
                : petManagementModal && compact
                  ? 7.5
                  : homeColumn && compact
                    ? 5.25
                    : compact
                      ? 6
                      : PET_PROFILE_LINE_FONT_MIN;
    const equippedTid = currentUser.equippedPairPetTemplateId ?? null;
    const equippedDef = equippedTid ? getPairPetDefinition(equippedTid) : null;
    const equippedItem = useMemo(
        () => (equippedTid ? getEquippedPairPetInventoryRow(currentUser) : null),
        [currentUser, equippedTid],
    );

    const petMeta = useMemo(() => {
        if (!equippedItem) return null;
        return resolvePairPetMetaFromInventoryRow(equippedItem);
    }, [equippedItem]);

    const petGrade = equippedItem ? effectivePairPetGradeFromRow(equippedItem) : ItemGrade.Normal;
    const gradeKo = EQUIPMENT_GRADE_LABEL_KO[petGrade] ?? petGrade;
    const gradeStyle = gradeStyles[petGrade] ?? gradeStyles[ItemGrade.Normal];
    const badukTotal = useMemo(() => {
        if (!petMeta || !equippedItem) return null;
        return computePairPetBadukTotalPower(
            currentUser,
            petMeta.disposition,
            petGrade,
            petMeta.levelUpCoreBonuses,
            petMeta.birthCoreBases,
        );
    }, [currentUser, petMeta, petGrade, equippedItem]);

    const petAvatarUrl = equippedDef?.image ?? null;
    const emptyTitle = '장착된 펫 없음';
    const displayName = equippedItem ? getPairPetDisplayName(equippedItem) : (equippedDef?.displayName ?? emptyTitle);
    const levelSafe =
        petMeta != null ? Math.min(PAIR_PET_MAX_LEVEL, Math.max(1, Math.floor(petMeta.level) || 1)) : null;

    const lineOuterRef = useRef<HTMLDivElement>(null);
    const lineInnerRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (!equippedItem || profileHomeFooter) return;
        const outer = lineOuterRef.current;
        const inner = lineInnerRef.current;
        if (!outer || !inner) return;

        const fitLineFont = () => {
            let px = lineFontMax;
            inner.style.fontSize = `${px}px`;
            let guard = 0;
            while (inner.offsetWidth > outer.clientWidth && px > lineFontMin && guard < 48) {
                px -= 0.4;
                inner.style.fontSize = `${px}px`;
                guard += 1;
            }
        };

        fitLineFont();
        const ro = new ResizeObserver(fitLineFont);
        ro.observe(outer);
        return () => ro.disconnect();
    }, [
        displayName,
        levelSafe,
        badukTotal,
        equippedItem,
        gradeKo,
        lineFontMax,
        lineFontMin,
        hideInlineBadukChip,
        showRepresentativeBadge,
        homeColumn,
        profileHomeFooter,
        profileHomeBannerAside,
        pairLobbyProminent,
        compact,
    ]);

    const panelClassName = embed
        ? profileHomeBannerAside
          ? 'shrink-0 rounded-lg border-0 bg-transparent p-0 shadow-none'
          : profileHomeFooter
            ? 'shrink-0 rounded-lg border-0 bg-transparent px-1 py-1.5 shadow-none'
            : 'shrink-0 rounded-lg border-0 bg-transparent p-0 shadow-none'
        : pairLobbyProminent && !compact
          ? 'shrink-0 rounded-xl border border-violet-400/35 bg-gradient-to-br from-violet-950/50 via-black/40 to-fuchsia-950/30 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] ring-1 ring-inset ring-violet-400/10 sm:p-3'
          : compact
            ? 'shrink-0 rounded-lg border border-violet-400/25 bg-gradient-to-br from-violet-950/40 via-black/35 to-fuchsia-950/25 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-1.5'
            : 'shrink-0 rounded-lg border border-violet-400/25 bg-gradient-to-br from-violet-950/40 via-black/35 to-fuchsia-950/25 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-2.5';

    const avatarSize =
        profileHomeBannerAside
            ? 34
            : profileHomeFooter
              ? 44
              : pairLobbyProminent && !compact
                ? 52
                : homeColumn && compact
                  ? 28
                  : compact
                    ? 32
                    : 40;
    const detailBtnText = detailButtonLabel ?? (homeColumn && compact ? '상세' : '상세정보');

    const identityLineClass =
        'inline-flex max-w-none flex-nowrap items-center gap-x-[0.35em] gap-y-0 whitespace-nowrap leading-none';
    const identityChipClass =
        'inline-flex shrink-0 items-center rounded-md border border-white/18 bg-black/50 px-[0.35em] py-px font-extrabold leading-none';
    const identityTextClass = 'shrink-0 font-semibold leading-none text-violet-100/95';
    const identityLevelClass = 'shrink-0 font-black tabular-nums leading-none text-amber-200';

    const badukChipClass =
        'relative inline-flex shrink-0 items-baseline gap-x-[0.3em] rounded-md border border-amber-600/45 bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 px-[0.4em] py-[0.22em] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]';
    const badukLabelClass =
        'relative shrink-0 bg-gradient-to-br from-amber-50 via-amber-100 to-amber-200/90 bg-clip-text font-bold leading-none tracking-tight text-transparent';
    const badukValueClass =
        'relative shrink-0 bg-gradient-to-br from-yellow-50 via-amber-200 to-amber-700 bg-clip-text font-mono font-black tabular-nums leading-none tracking-tight text-transparent';

    const profileHomeBadukFontPx = lineFontMax + 4;

    const renderBadukChip = (fontSizePx: number, homeFooter = false) =>
        !hideInlineBadukChip && badukTotal != null ? (
            <span
                className={
                    homeFooter
                        ? `${badukChipClass} px-[0.55em] py-[0.34em] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_14px_-8px_rgba(251,191,36,0.25)]`
                        : badukChipClass
                }
                style={{ fontSize: `${homeFooter ? profileHomeBadukFontPx : fontSizePx}px` }}
                title="6코어 표시값과 성향 보너스 합계"
            >
                <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/35 to-transparent" aria-hidden />
                <span className={badukLabelClass}>바둑능력</span>
                <span className={badukValueClass} title="6개 핵심 능력치 합계">
                    {badukTotal}
                </span>
            </span>
        ) : null;

    const renderProfileHomeIdentity = (fontSizePx: number) => (
        <div ref={lineInnerRef} className="flex min-w-0 flex-col gap-y-1" style={{ fontSize: `${fontSizePx}px` }}>
            <div className="flex flex-wrap items-center gap-x-[0.35em] leading-none">
                <span className={`${identityChipClass} ${gradeStyle.color}`}>{gradeKo}</span>
                {showRepresentativeBadge ? (
                    <span className={`${identityChipClass} border-cyan-400/55 bg-cyan-950/65 text-cyan-50`}>대표펫</span>
                ) : null}
            </div>
            <div className="flex min-w-0 items-center gap-x-[0.35em] leading-none">
                {levelSafe != null ? <span className={identityLevelClass}>Lv.{levelSafe}</span> : null}
                <span className={`min-w-0 truncate ${identityTextClass}`} title={displayName}>
                    {displayName}
                </span>
            </div>
        </div>
    );

    const renderIdentityLine = (fontSizePx: number) => (
        <div ref={lineInnerRef} className="flex min-w-0 max-w-full items-center gap-x-[0.35em] whitespace-nowrap leading-none" style={{ fontSize: `${fontSizePx}px` }}>
            <span className={`${identityChipClass} ${gradeStyle.color}`}>{gradeKo}</span>
            {showRepresentativeBadge ? (
                <span className={`${identityChipClass} border-cyan-400/55 bg-cyan-950/65 text-cyan-50`}>대표펫</span>
            ) : null}
            {levelSafe != null ? <span className={identityLevelClass}>Lv.{levelSafe}</span> : null}
            <span className={`min-w-0 truncate ${identityTextClass}`} title={displayName}>
                {displayName}
            </span>
        </div>
    );

    const body = profileHomeBannerAside ? (
        <div className="flex min-w-0 w-full flex-col items-center justify-center gap-1 px-0.5 py-0.5">
            {equippedItem && petAvatarUrl ? (
                <Avatar
                    userId={`pet-ai-${currentUserId}`}
                    userName={displayName}
                    size={avatarSize}
                    avatarUrl={petAvatarUrl}
                    className="shrink-0 ring-2 ring-violet-400/40"
                />
            ) : (
                <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-violet-300/45 bg-black/35 shadow-inner ring-2 ring-violet-400/25"
                    title={emptyTitle}
                    aria-label={emptyTitle}
                >
                    <div className="h-5 w-5 rounded-md border border-violet-200/45 bg-violet-950/35" />
                </div>
            )}
            {equippedItem ? (
                <div ref={lineOuterRef} className="flex w-full min-w-0 justify-center overflow-hidden">
                    {renderIdentityLine(lineFontMax)}
                </div>
            ) : (
                <p className="w-full text-center text-[10px] font-semibold leading-snug text-violet-200/95 sm:text-[11px]">
                    대표펫을 지정해 주세요.
                </p>
            )}
        </div>
    ) : profileHomeFooter ? (
        <div className="flex min-h-[3.75rem] min-w-0 w-full flex-nowrap items-center gap-2 overflow-visible sm:gap-2.5">
            {equippedItem && petAvatarUrl ? (
                <Avatar
                    userId={`pet-ai-${currentUserId}`}
                    userName={displayName}
                    size={avatarSize}
                    avatarUrl={petAvatarUrl}
                    className="shrink-0 self-center ring-2 ring-violet-400/40"
                />
            ) : (
                <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center self-center rounded-full border-2 border-dashed border-violet-300/45 bg-black/35 shadow-inner ring-2 ring-violet-400/25"
                    title={emptyTitle}
                    aria-label={emptyTitle}
                >
                    <div className="h-7 w-7 rounded-md border border-violet-200/45 bg-violet-950/35" />
                </div>
            )}
            {equippedItem ? (
                <>
                    <div ref={lineOuterRef} className="min-w-0 flex-1 overflow-visible">
                        {renderProfileHomeIdentity(lineFontMax)}
                    </div>
                    <div className="ml-auto flex shrink-0 self-center pl-0.5">{renderBadukChip(lineFontMax, true)}</div>
                </>
            ) : (
                <p className="min-w-0 flex-1 text-left text-sm font-semibold leading-snug text-violet-200/95 sm:text-base">
                    대표펫을 지정해 주세요.
                </p>
            )}
        </div>
    ) : (
            <div
                className={`flex min-h-0 min-w-0 flex-nowrap items-center ${
                    pairLobbyProminent && !compact ? 'gap-2 sm:gap-3' : homeColumn && compact ? 'gap-0.5' : compact ? 'gap-1' : 'gap-1.5 sm:gap-2.5'
                }`}
            >
                {equippedItem && petAvatarUrl ? (
                    <Avatar
                        userId={`pet-ai-${currentUserId}`}
                        userName={displayName}
                        size={avatarSize}
                        avatarUrl={petAvatarUrl}
                        className="shrink-0 ring-2 ring-violet-400/40"
                    />
                ) : (
                    <div
                        className={`flex shrink-0 items-center justify-center rounded-full border-2 border-dashed border-violet-300/45 bg-black/35 shadow-inner ring-2 ring-violet-400/25 ${
                            pairLobbyProminent && !compact ? 'h-14 w-14' : compact ? 'h-8 w-8' : 'h-10 w-10'
                        }`}
                        title={emptyTitle}
                        aria-label={emptyTitle}
                    >
                        <div
                            className={`rounded-md border border-violet-200/45 bg-violet-950/35 ${
                                pairLobbyProminent && !compact ? 'h-9 w-9' : compact ? 'h-5 w-5' : 'h-6 w-6'
                            }`}
                        />
                    </div>
                )}
                <div
                    ref={lineOuterRef}
                    className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                    {equippedItem ? (
                    <div
                        ref={lineInnerRef}
                        className="inline-flex max-w-none flex-nowrap items-center gap-x-[0.45em] gap-y-0 whitespace-nowrap leading-tight"
                        style={{ fontSize: `${lineFontMax}px` }}
                    >
                        <span className="inline-flex shrink-0 items-baseline gap-x-[0.35em]">
                            <span
                                className={`inline-flex shrink-0 rounded-md border border-white/18 px-[0.35em] py-px text-[0.82em] font-extrabold leading-none ${gradeStyle.color} bg-black/50`}
                            >
                                {gradeKo}
                            </span>
                            {showRepresentativeBadge ? (
                                <span
                                    className={`shrink-0 rounded-md border border-cyan-400/55 bg-cyan-950/65 font-extrabold text-cyan-50 ${
                                        homeColumn && compact
                                            ? 'px-[0.28em] py-px text-[0.65em]'
                                            : compact
                                              ? 'px-[0.35em] py-px text-[0.72em]'
                                              : 'px-[0.45em] py-px text-[0.82em]'
                                    }`}
                                >
                                    대표펫
                                </span>
                            ) : null}
                            {levelSafe != null ? (
                                <span className="font-black tabular-nums text-amber-200">Lv.{levelSafe}</span>
                            ) : null}
                            <span className="font-semibold text-violet-100/95">{displayName}</span>
                        </span>
                        {!hideInlineBadukChip && badukTotal != null ? (
                            <span
                                className="relative inline-flex shrink-0 items-baseline gap-x-[0.25em] rounded-md border border-amber-600/45 bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 px-[0.45em] py-[0.2em] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                                title="6코어 표시값과 성향 보너스 합계"
                            >
                                <span
                                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/35 to-transparent"
                                    aria-hidden
                                />
                                <span className="relative shrink-0 bg-gradient-to-br from-amber-50 via-amber-100 to-amber-200/90 bg-clip-text font-bold tracking-tight text-transparent opacity-95">
                                    바둑능력
                                </span>
                                <span
                                    className="relative bg-gradient-to-br from-yellow-50 via-amber-200 to-amber-700 bg-clip-text font-mono font-black tabular-nums leading-none tracking-tight text-transparent drop-shadow-[0_1px_0_rgba(0,0,0,0.35)]"
                                    style={{ fontSize: '1.08em' }}
                                    title="6개 핵심 능력치 합계"
                                >
                                    {badukTotal}
                                </span>
                            </span>
                        ) : null}
                    </div>
                    ) : (
                        <p
                            className={`min-w-0 pr-0.5 text-left font-semibold leading-snug text-violet-200/95 ${
                                pairLobbyProminent && !compact
                                    ? 'text-sm sm:text-base'
                                    : compact
                                      ? 'text-[0.62rem] sm:text-[0.68rem]'
                                      : 'text-[0.7rem] sm:text-sm'
                            }`}
                        >
                            대표펫을 지정해 주세요.
                        </p>
                    )}
                </div>
                {equippedItem && !embed && !readOnly ? (
                    <button
                        type="button"
                        disabled={isBusy}
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenEquippedPetDetail();
                        }}
                        title={detailBtnText}
                        className={`ml-auto shrink-0 rounded-md border border-cyan-400/40 bg-cyan-950/45 font-bold text-cyan-50 shadow-sm shadow-black/30 hover:bg-cyan-900/55 disabled:opacity-40 ${
                            pairLobbyProminent && !compact
                                ? 'px-2.5 py-1.5 text-sm sm:px-3 sm:py-2 sm:text-base'
                                : homeColumn && compact
                                  ? 'px-1 py-px text-[0.52rem] leading-tight sm:text-[0.55rem]'
                                  : compact
                                    ? 'px-1 py-0.5 text-[0.58rem] sm:px-1.5 sm:py-0.5 sm:text-[0.62rem]'
                                    : 'px-1.5 py-0.5 text-[0.65rem] sm:px-2.5 sm:py-1 sm:text-sm'
                        }`}
                    >
                        {detailBtnText}
                    </button>
                ) : null}
            </div>
    );

    if (!equippedItem && onFocusPetInventory && !readOnly) {
        return (
            <button
                type="button"
                disabled={isBusy}
                onClick={() => onFocusPetInventory()}
                aria-label="정보 탭 펫 인벤토리로 이동"
                className={`${panelClassName} w-full text-left transition hover:border-violet-300/45 hover:bg-violet-950/25 disabled:cursor-not-allowed disabled:opacity-50`}
            >
                {body}
            </button>
        );
    }

    if (embed && equippedItem && !readOnly) {
        return (
            <button
                type="button"
                disabled={isBusy}
                onClick={() => onOpenEquippedPetDetail()}
                aria-label="펫 상세 보기"
                className={`${panelClassName} w-full cursor-pointer text-left outline-none transition hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-1 focus-visible:ring-cyan-400/40`}
            >
                {body}
            </button>
        );
    }

    return <div className={panelClassName}>{body}</div>;
};

export default PairPetProfilePanel;
