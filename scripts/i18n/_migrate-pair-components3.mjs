import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');

function patch(file, edits) {
    const p = path.join(root, file);
    let s = fs.readFileSync(p, 'utf8');
    let n = 0;
    for (const [from, to] of edits) {
        if (!s.includes(from)) {
            console.warn(`SKIP ${file}: ${from.slice(0, 40).replace(/\n/g, ' ')}...`);
            continue;
        }
        s = s.replaceAll(from, to);
        n++;
    }
    fs.writeFileSync(p, s);
    console.log(`patched ${file} (${n} global edits)`);
}

// PairRoomSeatGrid
{
    const p = path.join(root, 'components/pair/PairRoomSeatGrid.tsx');
    let s = fs.readFileSync(p, 'utf8');
    if (!s.includes("useTranslation")) {
        s = s.replace(
            "import React, { useMemo } from 'react';",
            "import React, { useMemo } from 'react';\nimport { useTranslation } from 'react-i18next';\nimport { tx } from '../../shared/i18n/runtimeText.js';",
        );
    }
    s = s.replace(
        `            aria-label="주최"`,
        `            aria-label={tx('pair:room.hostAria')}`,
    );
    s = s.replace(
        `            aria-label="준비 완료"`,
        `            aria-label={tx('pair:room.readyAria')}`,
    );
    s = s.replace(
        `            준비완료`,
        `            {tx('pair:room.readyBadge')}`,
    );
    s = s.replace(
        `        displayName: \`\${def.name}봇\`,\n        portraitSrc: def.image,\n        subLabel: '카타 AI',`,
        `        displayName: \`\${def.name}\${tx('pair:room.botSuffix')}\`,\n        portraitSrc: def.image,\n        subLabel: tx('pair:room.kataAi'),`,
    );
    s = s.replace(
        `            displayName: \`\${levelPrefix}\${def.name}봇\`,\n            portraitSrc: def.image,\n            subLabel: '카타 AI',`,
        `            displayName: \`\${levelPrefix}\${def.name}\${tx('pair:room.botSuffix')}\`,\n            portraitSrc: def.image,\n            subLabel: tx('pair:room.kataAi'),`,
    );
    s = s.replace(
        `        displayName: \`\${levelPrefix}\${def.name} 펫봇\`,\n        portraitSrc: def.image,\n        subLabel: '카타 AI',`,
        `        displayName: \`\${levelPrefix}\${def.name}\${tx('pair:room.petBotSuffix')}\`,\n        portraitSrc: def.image,\n        subLabel: tx('pair:room.kataAi'),`,
    );
    s = s.replace(
        `}) => {
    const viewerPetAiId = \`pet-ai-\${viewerId}\`;`,
        `}) => {
    const { t } = useTranslation('pair');
    const viewerPetAiId = \`pet-ai-\${viewerId}\`;`,
    );
    const reps = [
        [`partnerName || '파트너'`, `partnerName || t('partner')`],
        [`'빈 슬롯'`, `t('room.emptySlot')`],
        [`'터치하여 초대'`, `t('room.tapToInvite')`],
        [`'카타 AI'`, `t('room.kataAi')`],
        [`'파트너'`, `t('partner')`],
        [`'대기 중'`, `t('room.waitingShort')`],
        [`'강퇴'`, `t('room.kick')`],
        [`'위임'`, `t('room.delegate')`],
        [`label={cell.userId === viewerId ? '나' : displayName}`, `label={cell.userId === viewerId ? t('room.me') : displayName}`],
        [`'상대'`, `t('room.opponent')`],
        [`'펫 슬롯'`, `t('room.petSlot')`],
        [`'상대 펫'`, `t('room.opponentPet')`],
        [`'상대 장착 펫'`, `t('room.opponentEquippedPet')`],
        [`title="정보 보기"`, `title={t('room.viewInfo')}`],
        [`aria-label="정보 보기"`, `aria-label={t('room.viewInfoAria')}`],
        [`'대기'`, `t('room.waiting')`],
        [`subLabel={s.subLabel ?? '카타 AI'}`, `subLabel={s.subLabel ?? t('room.kataAi')}`],
        [`roomKind === 'arena_ai' ? 'AI' : '파트너'`, `roomKind === 'arena_ai' ? 'AI' : t('partner')`],
    ];
    for (const [a, b] of reps) {
        s = s.split(a).join(b);
    }
    fs.writeFileSync(p, s);
    console.log('patched PairRoomSeatGrid.tsx');
}

// PairPetLobbyPanel - add hook and mass replace
{
    const p = path.join(root, 'components/pair/PairPetLobbyPanel.tsx');
    let s = fs.readFileSync(p, 'utf8');
    if (!s.includes('useTranslation')) {
        s = s.replace(
            "import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';",
            "import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';\nimport { useTranslation, Trans } from 'react-i18next';\nimport { tx } from '../../shared/i18n/runtimeText.js';",
        );
        s = s.replace(
            `const PairPetLobbyPanel: React.FC<PairPetLobbyPanelProps> = ({ currentUser, currentUserId, isBusy, applyPetAction }) => {
    const { handlers } = useAppContext();`,
            `const PairPetLobbyPanel: React.FC<PairPetLobbyPanelProps> = ({ currentUser, currentUserId, isBusy, applyPetAction }) => {
    const { t } = useTranslation(['pair', 'common']);
    const { t: tCommon } = useTranslation('common');
    const { handlers } = useAppContext();`,
        );
    }
    s = s.replace(
        `        return <span className={cls}>펫 Lv.1</span>;`,
        `        return <span className={cls}>{tx('pair:pet.levelFormat', { level: 1 })}</span>;`,
    );
    s = s.replace(
        `        return <span className={cls}>펫 Lv.{n}</span>;`,
        `        return <span className={cls}>{tx('pair:pet.levelFormat', { level: n })}</span>;`,
    );
    s = s.replace(
        `        return <span className={cls}>펫 Lv.{lo}</span>;`,
        `        return <span className={cls}>{tx('pair:pet.levelFormat', { level: lo })}</span>;`,
    );
    s = s.replace(
        `            펫 Lv.{lo}~{hi}`,
        `            {tx('pair:pet.levelRangeFormat', { lo, hi })}`,
    );
    s = s.replace(`                    특`, `{tx('pair:lobby.specBadge')}`);
    const reps = [
        [`title="대표 펫"`, `title={t('pet.representativePetBadge')}`],
        [`>대표펫<`, `>{t('pet.representativePet')}<`],
        [`'수련 완료 — 슬롯에서 보상 수령'`, `t('training.claimReadyBadge')`],
        [`'수련 중'`, `t('training.inProgress')`],
        [`'수련완료'`, `t('training.claimReady')`],
        [`'수련중'`, `t('training.inProgress')`],
        [`title={\`레벨 \${petLevel}\`}`, `title={t('pet.levelTitle', { level: petLevel })}`],
        [`일일 한도 {remaining}/{sku.dailyLimit}`, `{t('lobby.dailyLimit', { remaining, limit: sku.dailyLimit })}`],
        [`>펫 Lv.5<`, `>{t('pet.levelFormat', { level: 5 })}<`],
        [`>부화 시작<`, `>{t('hatchery.start')}<`],
        [`'다이아가 부족합니다.'`, `t('hatchery.insufficientDiamonds')`],
        [`>즉시완료<`, `>{t('hatchery.instantComplete')}<`],
        [`>취소<`, `>{tCommon('actions.cancel')}<`],
        [`'펫 인벤토리가 가득 찼습니다. 눌러 안내를 확인하세요.'`, `t('hatchery.invFullHint')`],
        [`>펫 받기<`, `>{t('hatchery.claimPet')}<`],
        [`>기능VIP활성화<`, `>{t('training.functionVipActive')}<`],
        [`canClaim ? '부화 완료' : '부화 중') : '부화 가능'`, `canClaim ? t('hatchery.complete') : t('hatchery.inProgress')) : t('hatchery.available')`],
        [`isActive ? '적용 중' : '해금됨'`, `isActive ? t('lobby.tierActive') : t('lobby.tierUnlocked')`],
        [`>페어 {tierDef.unlockWinsRequired}승<`, `>{t('training.winsRequired', { count: tierDef.unlockWinsRequired })}<`],
        [`강화 ({tierDef.unlockGold.toLocaleString()} G)`, `{t('lobby.tierUpgrade', { gold: tierDef.unlockGold.toLocaleString() })}`],
        [`>페어 {tierDef.unlockWinsRequired}승 필요<`, `>{t('training.winsRequiredShort', { count: tierDef.unlockWinsRequired })}<`],
        [`>보유 알<`, `>{t('hatchery.ownedEggs')}<`],
        [`>부화 시 1개<`, `>{t('hatchery.onePerHatch')}<`],
        [`>합계 {eggCount}<`, `>{t('hatchery.totalEggs', { count: eggCount })}<`],
        [`>부화 시 1개 소모<`, `>{t('hatchery.consumeOnePerHatch')}<`],
        [`? '수련 완료 — 좌측 뷰어에 상세 정보'`, `? t('training.completeViewerHint')`],
        [`: '수련 중 — 좌측 뷰어에 상세 정보'`, `: t('training.inProgressViewerHint')`],
        [`? '빈 수련 슬롯을 먼저 터치한 뒤 펫을 선택하세요.'`, `? t('training.tapEmptySlotFirst')`],
        [`? '대표 펫은 수련에 보낼 수 없습니다.'`, `? t('training.repPetCannotTrain')`],
        [`? '대표 펫 — 좌측 뷰어에 상세 정보'`, `? t('training.repPetViewerHint')`],
        [`expandTarget === 'pet' ? '펫' : ''`, `expandTarget === 'pet' ? t('lobby.petTab') : ''`],
        [`>빈 슬롯 터치 후 펫 선택<`, `>{t('training.tapSlotThenPick')}<`],
        [`>펫을 슬롯에 놓으면 수련 시작<`, `>{t('training.dropToStart')}<`],
        [`title={t('training.petXpLabel')}`, `title={t('training.petXpLabel')}`],
        [`>{t('training.petXpLabel')}<`, `>{t('training.petXpLabel')}<`],
        [`>확정보상<`, `>{t('training.fixedReward')}<`],
        [`'확률(1종)'`, `t('training.probOneKind')`],
        [`'확률보상'`, `t('training.probReward')`],
        [`>기능VIP{' '}<`, `>{t('training.functionVip')}{' '}<`],
        [`>펫 Lv.{minLv}+<`, `>{t('training.petLevelMin', { level: minLv })}<`],
        [`>조건 없음<`, `>{t('training.noConditions')}<`],
        [`aria-label="수련 보상 수령"`, `aria-label={t('training.claimRewardAria')}`],
        [`aria-label="펫 상세 정보"`, `aria-label={t('training.petDetailAria')}`],
        [`aria-label={\`남은 시간 \${formatRemainHMS(remainMs)}\`}`, `aria-label={t('training.remainingTimeAria', { time: formatRemainHMS(remainMs) })}`],
        [`? '펫 선택'`, `? t('training.pickPet')`],
        [`: '터치'`, `: t('training.tap')`],
        [`: '펫 끌어넣기'`, `: t('training.dragPet')`],
        [`>수련 취소<`, `>{t('training.cancelTraining')}<`],
        [`aria-label={\`수련 소요 \${durationHhMmSs}\`}`, `aria-label={t('training.durationAria', { duration: durationHhMmSs })}`],
        [`>아래 인벤에서 펫 또는 영혼석을 선택하세요<`, `>{t('training.pickFromInvBelow')}<`],
        [`>이 카테고리에서 지원하지 않는 아이템입니다.<`, `>{t('lobby.unsupportedCategory')}<`],
        [`renderShopSkuSection('알', shopEggSkus)`, `renderShopSkuSection(t('lobby.eggTab'), shopEggSkus)`],
        [`renderShopSkuSection('영혼석', shopSoulSkus)`, `renderShopSkuSection(t('lobby.soulTab'), shopSoulSkus)`],
        [`label: '펫'`, `label: t('lobby.petTab')`],
        [`label: '영혼석'`, `label: t('lobby.soulTab')`],
        [`>정렬<`, `>{t('lobby.sortLabel')}<`],
        [`>최근 획득순<`, `>{t('lobby.sortRecent')}<`],
        [`>오래된순<`, `>{t('lobby.sortOldest')}<`],
        [`>이름순<`, `>{t('lobby.sortName')}<`],
        [`>펫 레벨순<`, `>{t('lobby.sortPetLevel')}<`],
        [`>높은 등급순<`, `>{t('lobby.sortGradeHigh')}<`],
        [`>종류순<`, `>{t('lobby.sortPetNumber')}<`],
        [`\`슬롯 밖 \${hiddenInvCount}개\``, `t('lobby.hiddenInvCount', { count: hiddenInvCount })`],
        [`title="슬롯 확장"`, `title={t('lobby.expandSlots')}`],
        [`label: '알'`, `label: t('lobby.eggTab')`],
        [`detailButtonLabel="상세보기"`, `detailButtonLabel={t('pet.viewDetail')}`],
        [`>정보<`, `>{t('lobby.infoTab')}<`],
        [`'수련 보상을 수령할 수 있습니다'`, `t('training.tabTitleClaimReady')`],
        [`>수련<`, `>{t('training.tabTitle')}<`],
        [`'부화가 완료된 슬롯이 있습니다'`, `t('hatchery.tabTitleClaimReady')`],
        [`>부화장<`, `>{t('hatchery.tabTitle')}<`],
        [`>펫 상점<`, `>{t('lobby.petShopTab')}<`],
        [`title={\`\${expandLabel} 인벤 확장\`}`, `title={t('lobby.expandInvTitle', { category: expandLabel })}`],
        [`question={\`\${expandLabel} 인벤을 확장하시겠습니까?\`}`, `question={t('lobby.expandInvQuestion', { category: expandLabel })}`],
        [`slotsHint={\`+\${PAIR_PET_LOBBY_INV_EXPAND_STEP}칸 추가 (최대 \${PAIR_PET_LOBBY_INV_MAX_SLOTS}칸)\`}`, `slotsHint={t('lobby.expandSlotsHint', { step: PAIR_PET_LOBBY_INV_EXPAND_STEP, max: PAIR_PET_LOBBY_INV_MAX_SLOTS })}`],
        [`title="펫 수련 확인"`, `title={t('training.confirmTitle')}`],
        [`petName ?? '펫'`, `petName ?? t('pet.defaultName')`],
        [`title="영혼석 정보"`, `title={t('lobby.soulInfoTitle')}`],
        [`title="수련 취소"`, `title={t('training.cancelTitle')}`],
        [`title="경고"`, `title={t('lobby.warningTitle')}`],
        [`>인벤토리에 빈 칸을 확보하세요<`, `>{t('lobby.makeInvSpace')}<`],
        [`>확인<`, `>{tCommon('actions.confirm')}<`],
        [`title="부화 시작"`, `title={t('hatchery.start')}`],
        [`>부화 펫 레벨 : 5<`, `>{t('hatchery.petLevelOnHatch')}<`],
        [`>부화 시간 : {formatHatcheryDurationHMS(confirmDurMs)}<`, `>{t('hatchery.hatchDuration', { duration: formatHatcheryDurationHMS(confirmDurMs) })}<`],
        [`>시작<`, `>{t('hatchery.startAction')}<`],
        [`title="다이아 사용 확인"`, `title={t('hatchery.diamondConfirmTitle')}`],
        [`>부화 중인 알이 없습니다. 창을 닫아 주세요.<`, `>{t('hatchery.noEggInProgress')}<`],
    ];
    for (const [a, b] of reps) {
        if (s.includes(a)) s = s.split(a).join(b);
        else console.warn('SKIP lobby:', a.slice(0, 40));
    }
    fs.writeFileSync(p, s);
    console.log('patched PairPetLobbyPanel.tsx');
}

console.log('batch3 done');
