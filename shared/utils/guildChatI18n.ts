import type { TFunction } from 'i18next';
import { translateGuildBossName } from './translateGuildBossName.js';
import { translateGuildDisplayName } from './guildDisplayName.js';

export type GuildChatHistoryEntry = {
    id?: string;
    authorId?: string;
    user?: { id: string; nickname: string };
    content?: string;
    text?: string;
    system?: boolean;
    timestamp?: number;
    createdAt?: number | string;
    i18nKey?: string;
    i18nParams?: Record<string, string | number | boolean | undefined>;
};

export type GuildChatI18nParams = Record<string, string | number | boolean | undefined>;

function translateGuildMissionTitle(progressKey: string | undefined, fallback: string | undefined, t: TFunction): string {
    if (!progressKey) return fallback ?? '';
    return t(`guild:missions.titles.${progressKey}`, { defaultValue: fallback ?? progressKey });
}

function resolveGuildChatI18nParams(params: GuildChatI18nParams | undefined, t: TFunction): Record<string, string | number> {
    if (!params) return {};
    const next: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) continue;
        next[key] = value as string | number;
    }
    if (typeof params.missionProgressKey === 'string') {
        next.missionTitle = translateGuildMissionTitle(
            params.missionProgressKey,
            typeof params.missionTitle === 'string' ? params.missionTitle : undefined,
            t,
        );
    }
    if (typeof params.bossId === 'string') {
        next.bossName = translateGuildBossName(
            params.bossId,
            typeof params.bossName === 'string' ? params.bossName : undefined,
            t,
        );
    }
    if (typeof params.opponentGuildId === 'string' || typeof params.opponentGuildName === 'string') {
        next.opponentGuildName = translateGuildDisplayName(
            {
                id: typeof params.opponentGuildId === 'string' ? params.opponentGuildId : undefined,
                name: typeof params.opponentGuildName === 'string' ? params.opponentGuildName : undefined,
            },
            t,
        );
    }
    if (typeof params.statusKey === 'string') {
        const percent = params.statusPercent;
        if (params.statusKey === 'defeated') {
            next.status = t('guild:homeChat.systemMessages.bossWeeklySettlementDefeated');
        } else if (params.statusKey === 'remainingHp' && percent !== undefined) {
            next.status = t('guild:homeChat.systemMessages.bossWeeklySettlementRemainingHp', {
                percent,
            });
        }
    }
    return next;
}

function translateLegacyGuildChatText(raw: string, t: TFunction): string | null {
    const missionMatch = /^주간 임무 \[(.+?)\]을\(를\) 달성했습니다!/.exec(raw);
    if (missionMatch) {
        return t('guild:homeChat.systemMessages.missionComplete', { missionTitle: missionMatch[1] });
    }

    const bossSettlementMatch =
        /^주간 길드 보스 정산\((.+?), (.+?)\): 길드 경험치 \+([\d,]+), 연구 포인트 \+([\d,]+)이 길드에 적립되었습니다\.$/.exec(raw);
    if (bossSettlementMatch) {
        return t('guild:homeChat.systemMessages.bossWeeklySettlement', {
            bossName: bossSettlementMatch[1],
            status: bossSettlementMatch[2],
            guildXp: bossSettlementMatch[3].replace(/,/g, ''),
            researchPoints: bossSettlementMatch[4].replace(/,/g, ''),
        });
    }

    const warJoinMatching = /^\[(.+?)\][이가] 길드 전쟁에 참여했습니다\. 매칭을 진행합니다\.$/.exec(raw);
    if (warJoinMatching) {
        return t('guild:homeChat.systemMessages.warJoinMatching', {
            nickname: warJoinMatching[1],
            subjectParticle: '',
        });
    }

    const warJoinBot = /^\[(.+?)\][이가] 길드 전쟁에 참여했습니다\. 홀수 대기로 시스템 봇 길드와 매칭되었습니다\.$/.exec(raw);
    if (warJoinBot) {
        return t('guild:homeChat.systemMessages.warJoinBotMatch', {
            nickname: warJoinBot[1],
            subjectParticle: '',
        });
    }

    const warJoinOpponent = /^\[(.+?)\][이가] 길드 전쟁에 참여했습니다\. 상대: 「(.+?)」$/.exec(raw);
    if (warJoinOpponent) {
        const opponentName = warJoinOpponent[2];
        return t('guild:homeChat.systemMessages.warJoinOpponent', {
            nickname: warJoinOpponent[1],
            subjectParticle: '',
            opponentGuildName: translateGuildDisplayName({ name: opponentName }, t),
        });
    }

    const warCancel = /^\[(.+?)\][이가] 길드 전쟁 매칭을 취소했습니다\.$/.exec(raw);
    if (warCancel) {
        return t('guild:homeChat.systemMessages.warCancelMatching', {
            nickname: warCancel[1],
            subjectParticle: '',
        });
    }

    const bossDamage = /^\[(.+?)\][이가] (.+?)에게 ([\d,]+)의 피해를 입혔습니다\.$/.exec(raw);
    if (bossDamage) {
        return t('guild:homeChat.systemMessages.bossDamage', {
            nickname: bossDamage[1],
            subjectParticle: '',
            bossName: bossDamage[2],
            damage: bossDamage[3].replace(/,/g, ''),
        });
    }

    return null;
}

export function translateGuildChatText(msg: GuildChatHistoryEntry, t: TFunction): string {
    const raw = msg.text || msg.content || '';
    if (msg.i18nKey) {
        return t(msg.i18nKey, resolveGuildChatI18nParams(msg.i18nParams, t));
    }
    const legacy = translateLegacyGuildChatText(raw, t);
    return legacy ?? raw;
}
