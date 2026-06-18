/**
 * Patch game UI components to use i18n keys added by _migrate-game-components-batch.mjs
 * Run: node scripts/i18n/_migrate-game-components-files.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function write(rel, content) {
  fs.writeFileSync(path.join(root, rel), content, 'utf8');
}

function ensureImport(content, importLine) {
  if (content.includes(importLine.trim())) return content;
  const idx = content.indexOf('\n');
  return content.slice(0, idx + 1) + importLine + content.slice(idx + 1);
}

function ensureHookInComponent(content, componentMarker, hookLine) {
  const idx = content.indexOf(componentMarker);
  if (idx < 0 || content.includes(hookLine.trim())) return content;
  const brace = content.indexOf('{', idx);
  const nl = content.indexOf('\n', brace);
  return content.slice(0, nl + 1) + hookLine + content.slice(nl + 1);
}

// --- GameRankingBoard ---
{
  let f = read('components/GameRankingBoard.tsx');
  f = ensureImport(f, "import { useTranslation } from 'react-i18next';\n");
  f = f.replace(
    `}) => {
    const displayLevel = resolveRankingRowUserLevel(user, currentUserId, currentUserLevel);`,
    `}) => {
    const { t } = useTranslation('game');
    const displayLevel = resolveRankingRowUserLevel(user, currentUserId, currentUserLevel);`,
  );
  f = f.replaceAll('`${user.nickname} 프로필 보기`', "t('rankingBoard.viewProfile', { name: user.nickname })");
  f = ensureHookInComponent(f, 'const GameRankingBoard: React.FC', "    const { t } = useTranslation('game');\n");
  f = f.replace("{panelTitle ?? '게임 랭킹'}", "{panelTitle ?? t('rankingBoard.title')}");
  f = f.replace('>바둑능력<', ">{t('rankingBoard.tabAbility')}<");
  f = f.replace('>모험<', ">{t('rankingBoard.tabAdventure')}<");
  f = f.replace('>매너<', ">{t('rankingBoard.tabManner')}<");
  f = f.replaceAll('데이터 로딩 중...', "{t('rankingBoard.loading')}");
  f = f.replaceAll('랭킹을 불러오는데 실패했습니다.', "{t('rankingBoard.loadFailed')}");
  f = f.replaceAll('랭킹 데이터가 없습니다.', "{t('rankingBoard.empty')}");
  f = f.replaceAll('로딩 중...', "{t('rankingBoard.loadingMore')}");
  write('components/GameRankingBoard.tsx', f);
}

// --- BadukRankingBoard ---
{
  let f = read('components/BadukRankingBoard.tsx');
  f = ensureImport(f, "import { useTranslation } from 'react-i18next';\n");
  f = f.replace(
    `}) => {
    const avatarUrl = useMemo(() => AVATAR_POOL.find`,
    `}) => {
    const { t } = useTranslation('game');
    const avatarUrl = useMemo(() => AVATAR_POOL.find`,
  );
  f = f.replaceAll('`${user.nickname} 프로필 보기`', "t('rankingBoard.viewProfile', { name: user.nickname })");
  f = ensureHookInComponent(f, 'const BadukRankingBoard: React.FC', "    const { t } = useTranslation('game');\n");
  f = f.replace('>바둑 랭킹<', ">{t('rankingBoard.badukTitle')}<");
  f = f.replace('>전략바둑<', ">{t('rankingBoard.tabStrategic')}<");
  f = f.replace('>페어<', ">{t('rankingBoard.tabPair')}<");
  f = f.replaceAll('데이터 로딩 중...', "{t('rankingBoard.loading')}");
  f = f.replaceAll('랭킹을 불러오는데 실패했습니다.', "{t('rankingBoard.loadFailed')}");
  f = f.replaceAll('랭킹 데이터가 없습니다.', "{t('rankingBoard.empty')}");
  f = f.replaceAll('로딩 중...', "{t('rankingBoard.loadingMore')}");
  write('components/BadukRankingBoard.tsx', f);
}

// --- Game.tsx message constants ---
{
  let f = read('Game.tsx');
  if (!f.includes("from './shared/i18n/runtimeText.js'")) {
    f = f.replace(
      "import { InGameModalLayoutProvider } from './contexts/InGameModalLayoutContext.js';",
      "import { InGameModalLayoutProvider } from './contexts/InGameModalLayoutContext.js';\nimport { tx } from './shared/i18n/runtimeText.js';",
    );
  }
  if (!f.includes("from 'react-i18next'")) {
    f = f.replace(
      "import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';",
      "import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';\nimport { useTranslation } from 'react-i18next';",
    );
  }
  const pairs = [
    ["const BOARD_SYNC_OVERLAY_MESSAGE = '바둑판 정보를 불러오는 중입니다. 잠시만 기다려주세요';", "const boardSyncOverlayMessage = () => tx('game:messages.boardSyncLoading');"],
    ["const KO_RULE_FLASH_MESSAGE = '패 모양입니다. 바로 다시 따낼 수 없습니다.';", "const koRuleFlashMessage = () => tx('game:messages.koRuleFlash');"],
    ["const HIDDEN_PLACEMENT_DELAY_MESSAGE = '화면에 상대에게 안보이는 한 수를 두세요';", "const hiddenPlacementDelayMessage = () => tx('game:messages.hiddenPlacementDelay');"],
    ["const MISSILE_DIRECTION_DELAY_MESSAGE = '바둑돌을 원하는 방향으로 날려보내세요';", "const missileDirectionDelayMessage = () => tx('game:messages.missileDirectionDelay');"],
    ["const SCAN_TARGET_DELAY_MESSAGE = '상대방의 히든 돌이 있을만한 지점을 찍어보세요';", "const scanTargetDelayMessage = () => tx('game:messages.scanTargetDelay');"],
    ["const CHESS_PIECE_ALREADY_MOVED_MESSAGE = '기물돌은 한 턴에 한 번만 움직일 수 있습니다.';", "const chessPieceAlreadyMovedMessage = () => tx('game:messages.chessPieceAlreadyMoved');"],
    ["const CHESS_GO_START_MESSAGE =\n    '자신의 턴에 체스 기물돌을 1회 이동 가능합니다. 킹 기물을 잡거나 잡히면 경기가 종료됩니다.';", "const chessGoStartMessage = () => tx('game:messages.chessPieceMoveHint');"],
    ["    seatId === 'black1' ? '흑1' : seatId === 'black2' ? '흑2' : seatId === 'white1' ? '백1' : seatId === 'white2' ? '백2' : seatId;", "    seatId === 'black1' ? tx('game:messages.seatBlack1') : seatId === 'black2' ? tx('game:messages.seatBlack2') : seatId === 'white1' ? tx('game:messages.seatWhite1') : seatId === 'white2' ? tx('game:messages.seatWhite2') : seatId;"],
  ];
  for (const [from, to] of pairs) f = f.replace(from, to);
  f = f.replaceAll('KO_RULE_FLASH_MESSAGE', 'koRuleFlashMessage()');
  f = f.replaceAll('HIDDEN_PLACEMENT_DELAY_MESSAGE', 'hiddenPlacementDelayMessage()');
  f = f.replaceAll('MISSILE_DIRECTION_DELAY_MESSAGE', 'missileDirectionDelayMessage()');
  f = f.replaceAll('SCAN_TARGET_DELAY_MESSAGE', 'scanTargetDelayMessage()');
  f = f.replaceAll('CHESS_GO_START_MESSAGE', 'chessGoStartMessage()');
  f = f.replaceAll('CHESS_PIECE_ALREADY_MOVED_MESSAGE', 'chessPieceAlreadyMovedMessage()');
  f = f.replace('{BOARD_SYNC_OVERLAY_MESSAGE}', '{boardSyncOverlayMessage()}');
  f = f.replaceAll("flashBoardRuleMessage('둘 수 없는 자리입니다.')", "flashBoardRuleMessage(tx('game:messages.invalidPlacement'))");
  f = f.replaceAll("flashBoardRuleMessage('배치할 수 없는 위치입니다.')", "flashBoardRuleMessage(tx('game:messages.invalidBasePlacement'))");
  f = f.replace(
    'return <div className="flex items-center justify-center min-h-screen">플레이어 정보를 불러오는 중...</div>;',
    "return <div className=\"flex items-center justify-center min-h-screen\">{tx('game:messages.loadingPlayers')}</div>;",
  );
  write('Game.tsx', f);
}

// --- GoBoard.tsx ---
{
  let f = read('components/GoBoard.tsx');
  if (!f.includes('runtimeText')) {
    f = f.replace(
      "import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';",
      "import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';\nimport { tx } from '../shared/i18n/runtimeText.js';",
    );
  }
  f = f.replaceAll("onBoardRuleFlash?.('둘 수 없는 자리입니다.')", "onBoardRuleFlash?.(tx('game:messages.invalidPlacement'))");
  f = f.replace('                                상대 배치 중', "                                {tx('game:messages.opponentPlacing')}");
  write('components/GoBoard.tsx', f);
}

console.log('Patched: GameRankingBoard, BadukRankingBoard, Game.tsx, GoBoard.tsx');
