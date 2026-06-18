/**
 * Part 3: PairWaitingLobby + TournamentBracket bulk patches.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');

function patch(file, edits) {
  const p = path.join(root, file);
  let s = fs.readFileSync(p, 'utf8');
  let applied = 0;
  let skipped = 0;
  for (const [from, to] of edits) {
    if (!s.includes(from)) {
      console.warn(`SKIP ${file}: ${from.slice(0, 60)}...`);
      skipped++;
      continue;
    }
    s = s.includes(from) && from === to ? s : s.replace(from, to);
    if (s.includes(to) || from === to) applied++;
    else skipped++;
  }
  fs.writeFileSync(p, s);
  console.log(`patched ${file}: ${applied} edits attempted, ${skipped} skipped`);
}

// PairWaitingLobby: add i18n helper import
patch('components/PairWaitingLobby.tsx', [
  [
    `import { useTranslation } from 'react-i18next';`,
    `import { useTranslation } from 'react-i18next';\nimport i18n from '../shared/i18n/config.js';\n\nconst pt = (key: string, opts?: Record<string, unknown>) => i18n.t(\`pair:\${key}\`, opts);`,
  ],
  [
    `const PAIR_ALREADY_IN_ROOM_SERVER_ERROR = '이미 참여 중인 페어 방이 있습니다.';`,
    `const PAIR_ALREADY_IN_ROOM_SERVER_ERROR = '이미 참여 중인 페어 방이 있습니다.'; // server message match`,
  ],
  [
    `const PAIR_JOIN_PASSWORD_ERROR = '비밀번호가 일치하지 않습니다.';`,
    `const PAIR_JOIN_PASSWORD_ERROR = '비밀번호가 일치하지 않습니다.'; // server message match`,
  ],
  [
    `if (!stored || stored === '미참여' || !tierOrder.includes(stored)) continue;`,
    `if (!stored || stored === pt('notParticipated') || !tierOrder.includes(stored)) continue;`,
  ],
  [
    `if (isPairAiDuoTeamLobbyContext(room, lobbyIntent, lobbyChannel)) return '파트너';`,
    `if (isPairAiDuoTeamLobbyContext(room, lobbyIntent, lobbyChannel)) return pt('partner');`,
  ],
  [
    `return \`\${room.code}번방\`;`,
    `return pt('roomNumber', { code: room.code });`,
  ],
  [
    `const lineName = viewerPetName || '내 펫';`,
    `const lineName = viewerPetName || pt('myPet');`,
  ],
  [
    `subLabel: '장착 펫',`,
    `subLabel: pt('equippedPet'),`,
  ],
  [
    `{ value: 'friendly_4p', label: '4인 친선' },`,
    `{ value: 'friendly_4p', label: pt('roomKinds.friendly4p') },`,
  ],
  [
    `{ value: 'friendly_2p', label: '2인 친선' },`,
    `{ value: 'friendly_2p', label: pt('roomKinds.friendly2p') },`,
  ],
  [
    `{ value: 'duo_match', label: '2인 AI대전' },`,
    `{ value: 'duo_match', label: pt('roomKinds.duoAi') },`,
  ],
  [
    `const STRATEGIC_PLAYFUL_CREATE_ROOM_KIND_OPTIONS: { value: RoomKind; label: string }[] = [{ value: 'duo_match', label: '친선전' }];`,
    `const STRATEGIC_PLAYFUL_CREATE_ROOM_KIND_OPTIONS: { value: RoomKind; label: string }[] = [{ value: 'duo_match', label: pt('roomKinds.friendly') }];`,
  ],
  [`if (kind === 'arena_ai') return 'AI와 대결';`, `if (kind === 'arena_ai') return pt('roomKinds.arenaAi');`],
  [`if (kind === 'ai_duel') return '펫 페어';`, `if (kind === 'ai_duel') return pt('roomKinds.petPair');`],
  [
    `if (lobbyChannel === 'pair' && kind === 'duo_match') return '2인 AI대전';`,
    `if (lobbyChannel === 'pair' && kind === 'duo_match') return pt('roomKinds.duoAi');`,
  ],
  [`if (kind === 'duo_match') return '친선전';`, `if (kind === 'duo_match') return pt('roomKinds.friendly');`],
  [`if (kind === 'friendly_4p') return '4인 친선';`, `if (kind === 'friendly_4p') return pt('roomKinds.friendly4p');`],
  [`if (kind === 'friendly_2p') return '2인 친선';`, `if (kind === 'friendly_2p') return pt('roomKinds.friendly2p');`],
  [
    `if (ch === 'strategic') return { short: '전략', badgeClass: 'border-cyan-400/50 bg-cyan-950/55 text-cyan-100' };`,
    `if (ch === 'strategic') return { short: pt('arenaBadges.strategic'), badgeClass: 'border-cyan-400/50 bg-cyan-950/55 text-cyan-100' };`,
  ],
  [
    `if (ch === 'playful') return { short: '놀이', badgeClass: 'border-amber-400/50 bg-amber-950/55 text-amber-100' };`,
    `if (ch === 'playful') return { short: pt('arenaBadges.playful'), badgeClass: 'border-amber-400/50 bg-amber-950/55 text-amber-100' };`,
  ],
  [
    `return { short: '페어', badgeClass: 'border-violet-400/50 bg-violet-950/55 text-violet-100' };`,
    `return { short: pt('arenaBadges.pair'), badgeClass: 'border-violet-400/50 bg-violet-950/55 text-violet-100' };`,
  ],
  [
    `const all = { value: 'all' as const, label: '전체(방 종류)' };`,
    `const all = { value: 'all' as const, label: pt('filters.allRoomKinds') };`,
  ],
  [
    `const allGameModes = { value: 'all' as const, label: '전체(게임 모드)' };`,
    `const allGameModes = { value: 'all' as const, label: pt('filters.allGameModes') };`,
  ],
]);

// TournamentBracket: add i18n helper
patch('components/TournamentBracket.tsx', [
  [
    `import { useTranslation } from 'react-i18next';`,
    `import { useTranslation } from 'react-i18next';\nimport i18n from '../shared/i18n/config.js';\n\nconst tt = (key: string, opts?: Record<string, unknown>) => i18n.t(\`tournament:\${key}\`, opts);`,
  ],
  [`nickname: p.nickname ?? '선수',`, `nickname: p.nickname ?? tt('defaultPlayer'),`],
  [
    `{panelView === 'match' ? '최종 결과' : '경기결과'}`,
    `{panelView === 'match' ? tt('finalResult') : tt('matchResult')}`,
  ],
  [`userName={userInMatch?.nickname ?? '나'}`, `userName={userInMatch?.nickname ?? tt('me')}`],
  [`{userInMatch?.nickname ?? '나'}`, `{userInMatch?.nickname ?? tt('me')}`],
  [`userName={opponentInMatch?.nickname ?? '상대'}`, `userName={opponentInMatch?.nickname ?? tt('opponent')}`],
  [`{opponentInMatch?.nickname ?? '상대'}`, `{opponentInMatch?.nickname ?? tt('opponent')}`],
  [`{userWonThisMatch ? '승리' : '패배'}`, `{userWonThisMatch ? tt('victory') : tt('defeat')}`],
  [
    `{finishedScoreLeadAbs > 0 ? \`\${finishedScoreLeadAbs.toFixed(1)}집 차\` : '백병전'}`,
    `{finishedScoreLeadAbs > 0 ? tt('scoreLead', { points: finishedScoreLeadAbs.toFixed(1) }) : tt('jigo')}`,
  ],
  [
    `{ key: 'opening' as const, label: '초반', ply19: 1, ply13: 1, ply9: 1 },`,
    `{ key: 'opening' as const, label: tt('phases.opening'), ply19: 1, ply13: 1, ply9: 1 },`,
  ],
  [
    `{ key: 'midgame' as const, label: '중반', ply19: 61, ply13: 31, ply9: 15 },`,
    `{ key: 'midgame' as const, label: tt('phases.midgame'), ply19: 61, ply13: 31, ply9: 15 },`,
  ],
  [
    `{ key: 'endgame' as const, label: '종반', ply19: 121, ply13: 61, ply9: 29 },`,
    `{ key: 'endgame' as const, label: tt('phases.endgame'), ply19: 121, ply13: 61, ply9: 29 },`,
  ],
  [
    `{splitPairAbilities ? '유저 · 펫 능력치' : \`\${player?.nickname ?? '선수'} 능력치\`}`,
    `{splitPairAbilities ? tt('userPetAbility') : tt('playerAbility', { name: player?.nickname ?? tt('defaultPlayer') })}`,
  ],
  [
    `{currentPhase === 'early' ? '초반' : currentPhase === 'mid' ? '중반' : currentPhase === 'end' ? '종반' : '대기'}`,
    `{currentPhase === 'early' ? tt('phases.opening') : currentPhase === 'mid' ? tt('phases.midgame') : currentPhase === 'end' ? tt('phases.endgame') : tt('phases.waiting')}`,
  ],
  [`sideLabel="챔피언십 능력치"`, `sideLabel={tt('championshipAbility')}`],
  [
    `return <div className="flex h-full items-center justify-center rounded-lg border border-gray-600/50 bg-slate-950/90 p-2 text-center text-gray-500">선수 대기 중...</div>;`,
    `return <div className="flex h-full items-center justify-center rounded-lg border border-gray-600/50 bg-slate-950/90 p-2 text-center text-gray-500">{tt('playerWaiting')}</div>;`,
  ],
  [
    `return <div className="flex h-full items-center justify-center rounded-lg border border-gray-600/50 bg-slate-950/90 p-2 text-center text-gray-500">선수 정보를 불러올 수 없습니다.</div>;`,
    `return <div className="flex h-full items-center justify-center rounded-lg border border-gray-600/50 bg-slate-950/90 p-2 text-center text-gray-500">{tt('playerLoadFailed')}</div>;`,
  ],
  [`? '전적 없음'`, `? tt('noRecord')`],
  [
    `['status', '상태정보'],`,
    `['status', tt('statusInfo')],`,
  ],
  [
    `['abilities', '능력수치'],`,
    `['abilities', tt('abilityStats')],`,
  ],
  [
    `<span className="shrink-0 text-[10px] font-semibold text-gray-400">컨디션</span>`,
    `<span className="shrink-0 text-[10px] font-semibold text-gray-400">{tt('condition')}</span>`,
  ],
  [
    `? '컨디션이 이미 최대입니다'`,
    `? tt('conditionMax')`,
  ],
  [
    `? '지금은 컨디션 회복제를 사용할 수 없습니다'`,
    `? tt('conditionPotionUnavailable')`,
  ],
  [
    `: '컨디션 회복제 사용'`,
    `: tt('useConditionPotion')`,
  ],
  [
    `<span className="shrink-0 font-semibold text-gray-300">바둑능력</span>`,
    `<span className="shrink-0 font-semibold text-gray-300">{tt('badukAbility')}</span>`,
  ],
  [
    `<span className="shrink-0 font-semibold text-gray-300">승률</span>`,
    `<span className="shrink-0 font-semibold text-gray-300">{tt('winRate')}</span>`,
  ],
  [
    `const label = pk === 'early' ? '초반능력' : pk === 'mid' ? '중반능력' : '종반능력';`,
    `const label = pk === 'early' ? tt('earlyAbility') : pk === 'mid' ? tt('midAbility') : tt('endAbility');`,
  ],
  [
    `{isCurrent ? <div className="text-[10px] font-semibold text-amber-300/90">나</div> : null}`,
    `{isCurrent ? <div className="text-[10px] font-semibold text-amber-300/90">{tt('me')}</div> : null}`,
  ],
  [
    `{isCurrent ? <span className="text-[0.82em] font-semibold text-amber-300/90">나</span> : null}`,
    `{isCurrent ? <span className="text-[0.82em] font-semibold text-amber-300/90">{tt('me')}</span> : null}`,
  ],
  [`title="초반전"`, `title={tt('openingMatch')}`],
  [`title="중반전"`, `title={tt('midgameMatch')}`],
  [`title="끝내기"`, `title={tt('endgameMatch')}`],
  [
    `<div className="text-[9px] text-gray-500">흑</div>`,
    `<div className="text-[9px] text-gray-500">{tt('black')}</div>`,
  ],
  [
    `<div className="text-[9px] text-gray-500">백</div>`,
    `<div className="text-[9px] text-gray-500">{tt('white')}</div>`,
  ],
  [
    `<div className="text-[9px] text-gray-400">흑</div>`,
    `<div className="text-[9px] text-gray-400">{tt('black')}</div>`,
  ],
  [
    `<div className="text-[9px] text-gray-400">백</div>`,
    `<div className="text-[9px] text-gray-400">{tt('white')}</div>`,
  ],
  [
    `<div className="truncate text-xs font-bold text-gray-200">흑: {p1Nickname}</div>`,
    `<div className="truncate text-xs font-bold text-gray-200">{tt('blackColon')} {p1Nickname}</div>`,
  ],
  [
    `<div className="truncate text-xs font-bold text-gray-200">백: {p2Nickname}</div>`,
    `<div className="truncate text-xs font-bold text-gray-200">{tt('whiteColon')} {p2Nickname}</div>`,
  ],
  [
    `{row.rank}위`,
    `{tt('rankSuffix', { rank: row.rank })}`,
  ],
  [
    `{row.wins}승 {row.losses}패`,
    `{tt('recordWinsLosses', { wins: row.wins, losses: row.losses })}`,
  ],
  [
    `대회 {userRecord.wins}승 <span className="text-rose-200/85">{userRecord.losses}패</span>`,
    `{tt('tournamentRecord', { wins: userRecord.wins, losses: userRecord.losses })}`,
  ],
  [
    `대회 {opponentRecord.wins}승 <span className="text-rose-200/85">{opponentRecord.losses}패</span>`,
    `{tt('tournamentRecord', { wins: opponentRecord.wins, losses: opponentRecord.losses })}`,
  ],
]);

console.log('Part 3 done.');
