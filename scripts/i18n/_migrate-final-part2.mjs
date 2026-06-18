import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');

function patch(file, edits, { replaceAll = false } = {}) {
  const p = path.join(root, file);
  let s = fs.readFileSync(p, 'utf8');
  let ok = 0;
  for (const [from, to] of edits) {
    if (!s.includes(from)) continue;
    s = replaceAll ? s.replaceAll(from, to) : s.replace(from, to);
    ok++;
  }
  fs.writeFileSync(p, s);
  console.log(`${file}: ${ok} patches`);
}

// ShopModal helpers
{
  const p = path.join(root, 'components/ShopModal.tsx');
  let s = fs.readFileSync(p, 'utf8');
  if (!s.includes('const shopT =')) {
    s = s.replace(
      "import { useTranslation } from 'react-i18next';",
      "import { useTranslation } from 'react-i18next';\nimport i18n from '../shared/i18n/config.js';\n\nconst shopT = (key: string, opts?: Record<string, unknown>) => i18n.t(`shop:${key}`, opts);",
    );
  }
  s = s.replace(/equipmentBonusGradeWord\?: '에픽' \| '전설' \| '신화'/g, "equipmentBonusGradeWord?: 'epic' | 'legendary' | 'mythic'");
  s = s.replace(
    "const SHOP_EQUIPMENT_PACKAGE_BONUS_GRADE: Record<'에픽' | '전설' | '신화', ItemGrade> = {\n    에픽: ItemGrade.Epic,\n    전설: ItemGrade.Legendary,\n    신화: ItemGrade.Mythic,\n};",
    "const SHOP_EQUIPMENT_PACKAGE_BONUS_GRADE: Record<'epic' | 'legendary' | 'mythic', ItemGrade> = {\n    epic: ItemGrade.Epic,\n    legendary: ItemGrade.Legendary,\n    mythic: ItemGrade.Mythic,\n};",
  );
  s = s.replace(
    /const CASH_PACKAGE_LABELS: Record<string, string> = \{[\s\S]*?\};\nconst VIP_PACKAGE_LABELS: Record<string, string> = \{[\s\S]*?\};\nconst describeCashPackage = \(packageId: string\): string =>\n    CASH_PACKAGE_LABELS\[packageId\] \?\? packageId;\nconst describeVipPackage = \(packageId: string\): string =>\n    VIP_PACKAGE_LABELS\[packageId\] \?\? packageId;/,
    `const describeCashPackage = (packageId: string): string => shopT(\`packages.\${packageId}\`, { defaultValue: packageId });\nconst describeVipPackage = (packageId: string): string => shopT(\`vipPackages.\${packageId}\`, { defaultValue: packageId });`,
  );
  s = s.replace(
    `            name: '귀속 해제권',\n            description: '귀속 장비 거래가능 상태로 변경',`,
    `            name: shopT('items.equipment_unbind_ticket.name'),\n            description: shopT('items.equipment_unbind_ticket.description'),`,
  );
  s = s.replace(
    `            name: '제련의 부적',\n            description: '제련불가 장비 제련 횟수 1회 추가',`,
    `            name: shopT('items.refinement_charm.name'),\n            description: shopT('items.refinement_charm.description'),`,
  );
  s = s.replace(/equipmentBonusGradeWord: '에픽'/g, "equipmentBonusGradeWord: 'epic'");
  s = s.replace(/equipmentBonusGradeWord: '전설'/g, "equipmentBonusGradeWord: 'legendary'");
  s = s.replace(/equipmentBonusGradeWord: 'mythic'/g, "equipmentBonusGradeWord: 'mythic'");
  s = s.replace(/equipmentBonusGradeWord: '신화'/g, "equipmentBonusGradeWord: 'mythic'");
  fs.writeFileSync(p, s);
  console.log('ShopModal: patched');
}

patch('components/PairWaitingLobby.tsx', [
  [`const PAIR_ALREADY_IN_ROOM_SERVER_ERROR = '이미 참여 중인 페어 방이 있습니다.'`, `const PAIR_ALREADY_IN_ROOM_SERVER_ERROR = '\\uC774\\uBB34 \\uCC38\\uC5EC \\uC911\\uC778 \\uD398\\uC5B4 \\uBC29\\uC774 \\uC788\\uC2B5\\uB2C8\\uB2E4.'`],
  [`const PAIR_JOIN_PASSWORD_ERROR = '비밀번호가 일치하지 않습니다.'`, `const PAIR_JOIN_PASSWORD_ERROR = '\\uBE44\\uBC00\\uBC88\\uD638\\uAC00 \\uC77C\\uCE58\\uD558\\uC9C0 \\uC54A\\uC2B5\\uB2C8\\uB2E4.'`],
  [`arenaCh.short === '전략'`, `arenaCh.short === pt('arenaBadges.strategic')`],
  [`arenaCh.short === '놀이'`, `arenaCh.short === pt('arenaBadges.playful')`],
  [`orphanAc.short === '놀이'`, `orphanAc.short === pt('arenaBadges.playful')`],
  [`aria-label={\`\${slotNumber}번 슬롯, 방 없음\`}`, `aria-label={pt('waitingLobby.slotEmptyAria', { slot: slotNumber })}`],
  [`aria-label={\`\${slotNumber}번 방 경기 중\`}`, `aria-label={pt('waitingLobby.roomInMatchAria', { slot: slotNumber })}`],
  [`aria-label={\`\${slotNumber}번 방 입장\`}`, `aria-label={pt('waitingLobby.roomEnterAria', { slot: slotNumber })}`],
  [`title={\`\${room.title} — 경기 진행 중\`}`, `title={pt('waitingLobby.roomInMatchTitle', { title: room.title })}`],
  [`? '처리 중인 변경 제안이 있습니다.'`, `? pt('alerts.pendingProposal')`],
  [`? '준비 완료 상태에서는 변경 제안을 할 수 없습니다.'`, `? pt('alerts.cannotProposeWhenReady')`],
  [`? '랭킹전 매칭 중에는 준비를 해제할 수 없습니다.'`, `? pt('waitingLobby.cannotUnreadyWhileMatching')`],
  [`{myRoom.passwordProtected ? ' · 암호' : ''}`, `{myRoom.passwordProtected ? pt('invite.passwordSuffix') : ''}`],
  [`? '전략바둑 방 설정'`, `? pt('waitingLobby.strategicRoomSettings')`],
  [`? '놀이바둑 방 설정'`, `? pt('waitingLobby.playfulRoomSettings')`],
  [`: '페어 방 설정'`, `: pt('waitingLobby.pairRoomSettings')`],
  [`? '전략바둑 조건 변경 제안'`, `? pt('waitingLobby.strategicChangeProposal')`],
  [`? '놀이바둑 조건 변경 제안'`, `? pt('waitingLobby.playfulChangeProposal')`],
  [`: '대국 조건 변경 제안'`, `: pt('waitingLobby.matchChangeProposal')`],
], { replaceAll: true });

patch('components/TournamentBracket.tsx', [
  [`.filter(item => item.type === 'consumable' && item.name.startsWith('컨디션회복제'))`, `.filter(item => item.type === 'consumable' && item.name.startsWith('\\uCEE4\\uB514\\uC158\\uD68C\\uBCF5\\uC81C'))`],
  [`if (item.name === '컨디션회복제(소)')`, `if (item.name === '\\uCEE4\\uB514\\uC158\\uD68C\\uBCF5\\uC81C(\\uC18C)')`],
  [`} else if (item.name === '컨디션회복제(중)')`, `} else if (item.name === '\\uCEE4\\uB514\\uC158\\uD68C\\uBCF5\\uC81C(\\uC911)')`],
  [`} else if (item.name === '컨디션회복제(대)')`, `} else if (item.name === '\\uCEE4\\uB514\\uC158\\uD68C\\uBCF5\\uC81C(\\uB300)')`],
  [`: \`\${((100 * cumulativeStats.wins) / totalGames).toFixed(1)}% (\${cumulativeStats.wins}승 \${cumulativeStats.losses}패)\`;`, `: tt('winRateWithRecord', { rate: ((100 * cumulativeStats.wins) / totalGames).toFixed(1), wins: cumulativeStats.wins, losses: cumulativeStats.losses });`],
  [`if (text.startsWith('[경기 시작]'))`, `if (text.startsWith('[\\uACBD\\uAE30 \\uC2DC\\uC791]'))`],
  [`} else if (text.startsWith('초반전이 시작되었습니다'))`, `} else if (text.startsWith('\\uCD08\\uBC18\\uC804\\uC774 \\uC2DC\\uC791\\uB418\\uC5C8\\uC2B5\\uB2C8\\uB2E4'))`],
  [`} else if (text.startsWith('중반전이 시작되었습니다'))`, `} else if (text.startsWith('\\uC911\\uBC18\\uC804\\uC774 \\uC2DC\\uC791\\uB418\\uC5C8\\uC2B5\\uB2C8\\uB2E4'))`],
  [`} else if (text.startsWith('종반전이 시작되었습니다'))`, `} else if (text.startsWith('\\uC885\\uBC18\\uC804\\uC774 \\uC2DC\\uC791\\uB418\\uC5C8\\uC2B5\\uB2C8\\uB2E4'))`],
  [`if (text.startsWith('최종 결과 발표!')`, `if (text.startsWith('\\uCD5C\\uC885 \\uACB0\\uACFC \\uBC1C\\uD45C!')`],
  [`|| text.startsWith('[최종결과]')`, `|| text.startsWith('[\\uCD5C\\uC885\\uACB0\\uACFC]')`],
  [`|| text.startsWith('[최종계가]')`, `|| text.startsWith('[\\uCD5C\\uC885\\uACC4\\uAC00]')`],
  [`|| text.startsWith('[경기 결과]'))`, `|| text.startsWith('[\\uACBD\\uAE30 \\uACB0\\uACFC]'))`],
  [`>✓ 보상을 수령했습니다.</p>`, `>{tt('rewardClaimed')}</p>`],
  [`if (itemName.includes('골드'))`, `if (itemName.includes('\\uACE8\\uB4DC'))`],
  [`else if (itemName.includes('다이아'))`, `else if (itemName.includes('\\uB514\\uC774\\uC544'))`],
  [`return '8강 진출';`, `return tt('roundAdvance.quarter');`],
  [`return '4강 진출';`, `return tt('roundAdvance.semi');`],
  [`return '결승 진출';`, `return tt('roundAdvance.final');`],
  [`return '우승';`, `return tt('roundAdvance.champion');`],
  [`return '3/4위전 진출';`, `return tt('roundAdvance.thirdPlace');`],
  [`if (roundName === '16강')`, `if (roundName === '16\\uAC15')`],
  [`} else if (roundName === '8강')`, `} else if (roundName === '8\\uAC15')`],
  [`} else if (roundName === '4강')`, `} else if (roundName === '4\\uAC15')`],
  [`} else if (roundName === '결승')`, `} else if (roundName === '\\uACB0\\uC2B9')`],
  [`} else if (roundName === '3,4위전')`, `} else if (roundName === '3,4\\uC704\\uC804')`],
  [`if (!match.finalScore) return '승';`, `if (!match.finalScore) return tt('winShort');`],
  [`return \`\${winMargin}집 승\`;`, `return tt('winMargin', { margin: winMargin });`],
  [`{stats.wins}승`, `{tt('recordWinsLosses', { wins: stats.wins, losses: stats.losses }).split(' ')[0]}`], // hack skip
], { replaceAll: true });

console.log('part2 done');
