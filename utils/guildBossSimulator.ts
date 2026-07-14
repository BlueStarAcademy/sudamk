
// utils/guildBossSimulator.ts
import type {
    User,
    Guild,
    GuildBossInfo,
    GuildBossActiveSkill,
    GuildBossPassiveSkill,
    GuildBossSkillSubEffect,
    BattleLogEntry,
    GuildBossBattleResult,
    GuildBossDuelOutcome,
    GuildBossFxKind,
} from '../types/index.js';
import { GuildResearchId, CoreStat, ItemGrade } from '../types/enums.js';
import { GUILD_RESEARCH_PROJECTS } from '../constants/index.js';
import {
    computeGuildBossUserMaxHp,
    computeGuildBossUserBaseTurnDamage,
    computeGuildBossStabilityMitigation,
    computeGuildBossHpPercentDamage,
    computeGuildBossResearchDamagePercent,
    computeGuildBossResearchEvasionPercent,
    computeGuildBossResearchHitDamageReductionPercent,
    guildBossUserDamageStageMultiplier,
    GUILD_BOSS_CRIT_BASE_CHANCE,
    GUILD_BOSS_EXTRA_TURN_COEF,
    GUILD_BOSS_IGNITE_BASE_HP_RATIO,
    GUILD_BOSS_REGEN_STABILITY_FACTOR,
} from '../shared/constants/guildBossBalance.js';
import { calculateGuildBossBattleRewards, clampGuildBossStage, guildBossStatMultiplier } from './guildBossStageUtils.js';
import { isRewardVipActive } from '../shared/utils/rewardVip.js';
import { rollVipPlayRewardOutcome } from '../shared/utils/rewardVipPlayRoll.js';
import { CONSUMABLE_ITEMS, EQUIPMENT_POOL } from '../constants/index.js';
import {
    GUILD_RESEARCH_IGNITE_IMG,
    GUILD_RESEARCH_HEAL_BLOCK_IMG,
    GUILD_RESEARCH_REGEN_IMG,
    GUILD_RESEARCH_EVASION_IMG,
    GUILD_ATTACK_ICON,
} from '../assets.js';
import { calculateTotalStats } from './statUtils.js';
import { aggregateSpecialOptionGearFromUser } from '../shared/utils/specialOptionGearEffects.js';
import { skillIdToFxKind } from './guildBossBattleFx.js';

const normalAttackCommentaries = ['침착한 한수로 응수합니다.', '정확하게 약점을 노립니다.', '흐름을 가져오는 일격입니다.', '단단하게 지켜냅니다.'];
const criticalAttackCommentaries = ['사활문제를 풀어냈습니다!', '엄청난 집중력으로 좋은 한수를 둡니다.', '예리한 묘수로 허를 찌릅니다!', '신의 한수!'];

const getRandom = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const resolveDuelOutcome = (
    successfulDuels: number,
    totalDuels: number,
    mode: 'binary' | 'partial',
): GuildBossDuelOutcome => {
    if (mode === 'binary') {
        return successfulDuels === totalDuels ? 'full_success' : 'fail';
    }
    if (successfulDuels >= totalDuels && totalDuels > 0) return 'full_success';
    if (successfulDuels > 0) return 'partial';
    return 'fail';
};

export const runGuildBossBattle = (user: User, guild: Guild, boss: GuildBossInfo, stage: number = 1): GuildBossBattleResult => {
    const st = clampGuildBossStage(stage);
    const statMult = guildBossStatMultiplier(st);
    const stageDmgMult = guildBossUserDamageStageMultiplier(st);
    const totalStats = calculateTotalStats(user, guild, 'guildBoss');
    const gear = aggregateSpecialOptionGearFromUser(user);
    const gearDamageMult = 1 + gear.guildBossDamagePercent / 100;
    const researchLevels = guild.research;
    const researchDamagePercent = computeGuildBossResearchDamagePercent(
        researchLevels?.[GuildResearchId.boss_damage_increase]?.level || 0,
    );
    const researchDamageMult = 1 + researchDamagePercent / 100;
    const researchEvasionPercent = computeGuildBossResearchEvasionPercent(
        researchLevels?.[GuildResearchId.boss_attack_evasion]?.level || 0,
    );
    const researchHitDamageReductionPercent = computeGuildBossResearchHitDamageReductionPercent(
        researchLevels?.[GuildResearchId.boss_hit_damage_reduction]?.level || 0,
    );
    const BATTLE_TURNS = 30;

    let userHp = computeGuildBossUserMaxHp(totalStats, guild);
    const maxUserHp = userHp;

    let totalDamageDealt = 0;
    let turnsSurvived = 0;
    const battleLog: BattleLogEntry[] = [];

    let activeDebuffs: {
        [key in 'user_combat_power_reduction_percent' | 'user_heal_reduction_percent']: { value: number; turns: number }
    } = {
        user_combat_power_reduction_percent: { value: 0, turns: 0 },
        user_heal_reduction_percent: { value: 0, turns: 0 },
    };

    const tryResearchEvasion = (): boolean => {
        if (researchEvasionPercent <= 0) return false;
        return Math.random() * 100 < researchEvasionPercent;
    };

    const applyBossDamageToUser = (rawDamage: number): number => {
        if (rawDamage <= 0) return 0;
        const mitigated = computeGuildBossStabilityMitigation(totalStats[CoreStat.Stability]);
        const afterResearch = mitigated * (1 - researchHitDamageReductionPercent / 100);
        return Math.round(rawDamage * afterResearch);
    };

    const runUserTurn = (isExtra: boolean = false): boolean => {
        let userDamage = computeGuildBossUserBaseTurnDamage(totalStats);
        userDamage *= 1 + (Math.random() * 0.2 - 0.1);
        const critChance = GUILD_BOSS_CRIT_BASE_CHANCE + totalStats[CoreStat.Judgment] * 0.03;
        const isCrit = Math.random() * 100 < critChance;
        if (isCrit) {
            const critDamagePercent =
                totalStats[CoreStat.CombatPower] * 0.4 + totalStats[CoreStat.Calculation] * 0.3 + (Math.random() * 20 - 10);
            userDamage *= 1 + critDamagePercent / 100;
        }

        if (activeDebuffs.user_combat_power_reduction_percent.turns > 0) {
            userDamage *= 1 - activeDebuffs.user_combat_power_reduction_percent.value / 100;
        }

        userDamage *= stageDmgMult * gearDamageMult * researchDamageMult;
        userDamage = Math.round(userDamage);
        totalDamageDealt += userDamage;
        const overflow = totalDamageDealt - boss.hp;
        const actualThisTurn = overflow > 0 ? Math.max(0, userDamage - overflow) : userDamage;
        if (boss.hp - totalDamageDealt <= 0) totalDamageDealt = boss.hp;

        const commentary = isCrit
            ? criticalAttackCommentaries[Math.floor(Math.random() * criticalAttackCommentaries.length)]
            : normalAttackCommentaries[Math.floor(Math.random() * normalAttackCommentaries.length)];
        const extraTurnText = isExtra ? ' (추가 턴)' : '';
        const damageBuffActive = researchDamagePercent > 0;
        battleLog.push({
            turn: turnsSurvived,
            icon: GUILD_ATTACK_ICON,
            message: `[${user.nickname}] ${commentary}${extraTurnText} | 보스 HP -${actualThisTurn.toLocaleString()}${isCrit ? ' (크리티컬!)' : ''}`,
            isUserAction: true,
            isCrit,
            fxKind: 'slash',
            researchId: damageBuffActive ? GuildResearchId.boss_damage_increase : undefined,
        });

        if (boss.hp - totalDamageDealt <= 0) {
            battleLog.push({
                turn: turnsSurvived,
                icon: GUILD_ATTACK_ICON,
                message: `[${user.nickname}]의 마지막 일격!`,
                isUserAction: true,
                fxKind: 'slash',
            });
            battleLog.push({ turn: turnsSurvived, message: `[${boss.name}]이 돌을 거두었습니다.`, isUserAction: false });
            return true;
        }
        return false;
    };

    const runUserFullTurn = (): boolean => {
        let bossDefeated = runUserTurn(false);
        if (bossDefeated) return true;

        const extraTurnChance = totalStats[CoreStat.ThinkingSpeed] * GUILD_BOSS_EXTRA_TURN_COEF;
        if (Math.random() * 100 < extraTurnChance) {
            battleLog.push({
                turn: turnsSurvived,
                icon: '/images/guild/skill/userskill4.webp',
                message: `[추가공격] 빠르고 정확한 사고속도로 추가 턴을 획득합니다.`,
                isUserAction: true,
                isCrit: false,
                fxKind: 'extra_turn',
            });
            bossDefeated = runUserTurn(true);
            if (bossDefeated) return true;
        }

        const igniteLevel = researchLevels?.[GuildResearchId.boss_skill_ignite]?.level || 0;
        if (igniteLevel > 0) {
            const igniteChances = [0, 10, 25, 40, 55, 70, 85, 100];
            const damageIncreases = [0, 10, 15, 30, 45, 60, 75, 100];
            const chance = igniteChances[igniteLevel];
            if (Math.random() * 100 < chance) {
                let igniteDamage = boss.maxHp * GUILD_BOSS_IGNITE_BASE_HP_RATIO;
                const igniteDamageIncreasePercent = damageIncreases[igniteLevel];
                igniteDamage *= 1 + igniteDamageIncreasePercent / 100;
                igniteDamage = Math.round(igniteDamage * stageDmgMult * gearDamageMult * researchDamageMult);

                totalDamageDealt += igniteDamage;
                const igniteOverflow = totalDamageDealt - boss.hp;
                const actualIgniteThisTurn = igniteOverflow > 0 ? Math.max(0, igniteDamage - igniteOverflow) : igniteDamage;
                if (boss.hp - totalDamageDealt <= 0) totalDamageDealt = boss.hp;
                battleLog.push({
                    turn: turnsSurvived,
                    icon: GUILD_RESEARCH_IGNITE_IMG,
                    message: `[연구-점화] 발동! 보스 HP -${actualIgniteThisTurn.toLocaleString()}`,
                    isUserAction: true,
                    fxKind: 'research_ignite',
                    researchId: GuildResearchId.boss_skill_ignite,
                });
                if (totalDamageDealt >= boss.hp) {
                    battleLog.push({
                        turn: turnsSurvived,
                        message: `[연구-점화]의 피해로 [${boss.name}]이 돌을 거두었습니다.`,
                        isUserAction: false,
                    });
                    return true;
                }
            }
        }

        const regenLevel = researchLevels?.[GuildResearchId.boss_skill_regen]?.level || 0;
        if (regenLevel > 0) {
            const regenChances = [0, 10, 25, 40, 55, 70, 85, 100];
            const healIncreases = [0, 110, 120, 140, 160, 180, 200, 250];
            const chance = regenChances[regenLevel];
            if (Math.random() * 100 < chance) {
                let healAmount = totalStats[CoreStat.Stability] * GUILD_BOSS_REGEN_STABILITY_FACTOR;
                const healAmountIncreasePercent = healIncreases[regenLevel];
                healAmount *= 1 + healAmountIncreasePercent / 100;
                healAmount = Math.round(healAmount);
                userHp = Math.min(maxUserHp, userHp + healAmount);
                battleLog.push({
                    turn: turnsSurvived,
                    icon: GUILD_RESEARCH_REGEN_IMG,
                    message: `[연구-회복] 발동! HP +${healAmount.toLocaleString()}`,
                    isUserAction: true,
                    healingDone: healAmount,
                    fxKind: 'research_regen',
                    researchId: GuildResearchId.boss_skill_regen,
                });
            }
        }

        return false;
    };

    const runBossFullTurn = (): boolean => {
        const performDuel = (stat: CoreStat): boolean => {
            const userStat = totalStats[stat];
            const bossStat = 1000 * statMult;
            const successRate = userStat / (userStat + bossStat);
            return Math.random() < successRate;
        };

        const activeSkills = boss.skills.filter((s): s is GuildBossActiveSkill => s.type === 'active');
        if (activeSkills.length > 0) {
            const bossSkill = activeSkills[Math.floor(Math.random() * activeSkills.length)];

            let successfulDuels = 0;
            const statsToCheck = Array.isArray(bossSkill.checkStat) ? bossSkill.checkStat : [bossSkill.checkStat];

            for (const stat of statsToCheck) {
                const randomStat = Array.isArray(stat) ? stat[Math.floor(Math.random() * stat.length)] : stat;
                if (performDuel(randomStat)) successfulDuels++;
            }

            let turnBossDamage = 0;
            let turnBossHeal = 0;
            let duelResultMessage = '';
            let duelOutcome: GuildBossDuelOutcome = 'none';
            let usedHpPercent = false;
            const debuffsForLog: BattleLogEntry['debuffsApplied'] = [];

            if (bossSkill.id === '녹수_포자확산') {
                let damageRange: [number, number];
                if (successfulDuels >= 2) damageRange = [1760, 2640];
                else if (successfulDuels === 1) damageRange = [2640, 3520];
                else damageRange = [4400, 7040];
                turnBossDamage = getRandom(Math.round(damageRange[0] * statMult), Math.round(damageRange[1] * statMult));
                duelResultMessage = `방어 ${successfulDuels} / 3회 성공`;
                duelOutcome = resolveDuelOutcome(successfulDuels, 3, 'partial');
            } else if (bossSkill.id === '백광_천벌의일격') {
                let damageRange: [number, number];
                if (successfulDuels === 2) damageRange = [1760, 2640];
                else if (successfulDuels === 1) damageRange = [3520, 4400];
                else damageRange = [5280, 8800];
                turnBossDamage = getRandom(Math.round(damageRange[0] * statMult), Math.round(damageRange[1] * statMult));
                duelResultMessage = `방어 ${successfulDuels} / 2회 성공`;
                duelOutcome = resolveDuelOutcome(successfulDuels, 2, 'partial');
            } else {
                const duelSuccess = successfulDuels === statsToCheck.length;
                const skillEffectsToApply = duelSuccess ? bossSkill.onSuccess : bossSkill.onFailure;
                duelResultMessage = duelSuccess ? '방어 성공' : '방어 실패';
                duelOutcome = resolveDuelOutcome(successfulDuels, statsToCheck.length, 'binary');

                for (const effect of skillEffectsToApply) {
                    switch (effect.type) {
                        case 'damage':
                            turnBossDamage += getRandom(effect.value![0], effect.value![1]) * (effect.hits || 1);
                            break;
                        case 'hp_percent':
                            usedHpPercent = true;
                            turnBossDamage += computeGuildBossHpPercentDamage(
                                maxUserHp,
                                effect.value![0],
                                effect.value![1],
                                getRandom(effect.value![0], effect.value![1]),
                            );
                            break;
                        case 'heal':
                            turnBossHeal += getRandom(effect.value![0], effect.value![1]);
                            break;
                        case 'debuff':
                            if (
                                effect.debuffType &&
                                (effect.debuffType === 'user_combat_power_reduction_percent' ||
                                    effect.debuffType === 'user_heal_reduction_percent')
                            ) {
                                const value = getRandom(effect.debuffValue![0], effect.debuffValue![1]);
                                activeDebuffs[effect.debuffType] = { value, turns: effect.debuffDuration ?? 0 };
                                debuffsForLog.push(effect.debuffType);
                            }
                            break;
                    }
                }
            }

            const researchEvaded = turnBossDamage > 0 && tryResearchEvasion();
            if (researchEvaded) {
                battleLog.push({
                    turn: turnsSurvived,
                    icon: GUILD_RESEARCH_EVASION_IMG,
                    message: `[연구-공격회피] 발동! 보스의 공격을 회피했습니다.`,
                    isUserAction: true,
                    fxKind: 'dodge',
                    researchId: GuildResearchId.boss_attack_evasion,
                });
            }

            const finalBossDamage = researchEvaded ? 0 : applyBossDamageToUser(turnBossDamage);
            userHp -= finalBossDamage;

            let logMessage = `[${boss.name}]의 ${bossSkill.name}! (${duelResultMessage})`;
            if (researchEvaded) logMessage += ` | 회피!`;
            else if (finalBossDamage > 0) logMessage += ` | 유저 HP -${finalBossDamage.toLocaleString()}`;
            if (turnBossHeal > 0) {
                totalDamageDealt -= turnBossHeal;
                logMessage += ` | 보스 HP +${turnBossHeal.toLocaleString()}`;
            }

            let skillFx: GuildBossFxKind = skillIdToFxKind(bossSkill.id, boss.id, {
                isHeal: turnBossHeal > 0 && finalBossDamage <= 0,
                isDebuff: debuffsForLog.length > 0 && finalBossDamage <= 0,
                isHpPercent: usedHpPercent,
            });
            if (duelOutcome === 'full_success' || researchEvaded) skillFx = 'dodge';

            battleLog.push({
                turn: turnsSurvived,
                icon: bossSkill.image,
                message: logMessage,
                isUserAction: false,
                damageTaken: finalBossDamage,
                bossHealingDone: turnBossHeal,
                debuffsApplied: debuffsForLog,
                fxKind: skillFx,
                duelOutcome: researchEvaded ? 'full_success' : duelOutcome,
                skillId: bossSkill.id,
                researchId: researchEvaded ? GuildResearchId.boss_attack_evasion : undefined,
            });
        }

        if (userHp <= 0) return true;

        const passiveSkills = boss.skills.filter((s): s is GuildBossPassiveSkill => s.type === 'passive');
        for (const pSkill of passiveSkills) {
            const processPassiveEffect = (effect: GuildBossSkillSubEffect) => {
                switch (effect.type) {
                    case 'hp_percent': {
                        const rawPDamage = computeGuildBossHpPercentDamage(
                            maxUserHp,
                            effect.value![0],
                            effect.value![1],
                            getRandom(effect.value![0], effect.value![1]),
                        );
                        const researchEvaded = rawPDamage > 0 && tryResearchEvasion();
                        if (researchEvaded) {
                            battleLog.push({
                                turn: turnsSurvived,
                                icon: GUILD_RESEARCH_EVASION_IMG,
                                message: `[연구-공격회피] 발동! 보스의 공격을 회피했습니다.`,
                                isUserAction: true,
                                fxKind: 'dodge',
                                researchId: GuildResearchId.boss_attack_evasion,
                            });
                        }
                        const pDamage = researchEvaded ? 0 : applyBossDamageToUser(rawPDamage);
                        userHp -= pDamage;
                        battleLog.push({
                            turn: turnsSurvived,
                            icon: pSkill.image,
                            message: researchEvaded
                                ? `[${boss.name}]의 ${pSkill.name} 발동! | 회피!`
                                : `[${boss.name}]의 ${pSkill.name} 발동! | 유저 HP -${pDamage.toLocaleString()}`,
                            isUserAction: false,
                            damageTaken: pDamage,
                            fxKind: researchEvaded
                                ? 'dodge'
                                : skillIdToFxKind(pSkill.id, boss.id, { isHpPercent: true }),
                            skillId: pSkill.id,
                            researchId: researchEvaded ? GuildResearchId.boss_attack_evasion : undefined,
                            duelOutcome: researchEvaded ? 'full_success' : undefined,
                        });
                        break;
                    }
                    case 'debuff':
                        activeDebuffs[effect.debuffType!] = {
                            value: getRandom(effect.debuffValue![0], effect.debuffValue![1]),
                            turns: effect.debuffDuration!,
                        };
                        battleLog.push({
                            turn: turnsSurvived,
                            icon: pSkill.image,
                            message: `[${boss.name}]의 ${pSkill.name} 발동! 유저의 회복량이 감소합니다.`,
                            isUserAction: false,
                            fxKind: 'debuff',
                            skillId: pSkill.id,
                            debuffsApplied: effect.debuffType ? [effect.debuffType] : undefined,
                        });
                        break;
                    case 'heal': {
                        let passiveHeal = getRandom(effect.value![0], effect.value![1]);
                        const healBlockLevel = researchLevels?.[GuildResearchId.boss_skill_heal_block]?.level || 0;

                        if (healBlockLevel > 0 && passiveHeal > 0) {
                            const healBlockChances = [0, 10, 25, 40, 55, 70, 85, 100];
                            const healReductions = [0, 0, 10, 20, 30, 40, 50, 0];
                            const chance = healBlockChances[healBlockLevel];

                            if (Math.random() * 100 < chance) {
                                battleLog.push({
                                    turn: turnsSurvived,
                                    icon: GUILD_RESEARCH_HEAL_BLOCK_IMG,
                                    message: `[연구-회복불가] 발동! 보스의 회복이 막혔습니다.`,
                                    isUserAction: true,
                                    fxKind: 'research_heal_block',
                                    researchId: GuildResearchId.boss_skill_heal_block,
                                });
                                passiveHeal = 0;
                            } else {
                                const reduction = healReductions[healBlockLevel];
                                if (reduction > 0) {
                                    const reducedAmount = Math.round(passiveHeal * (reduction / 100));
                                    passiveHeal -= reducedAmount;
                                    battleLog.push({
                                        turn: turnsSurvived,
                                        icon: GUILD_RESEARCH_HEAL_BLOCK_IMG,
                                        message: `[연구-회복감소] 발동! 보스의 회복량이 ${reducedAmount.toLocaleString()} 감소했습니다.`,
                                        isUserAction: true,
                                        fxKind: 'research_heal_reduce',
                                        researchId: GuildResearchId.boss_skill_heal_block,
                                    });
                                }
                            }
                        }

                        if (passiveHeal > 0) {
                            totalDamageDealt -= passiveHeal;
                            battleLog.push({
                                turn: turnsSurvived,
                                icon: pSkill.image,
                                message: `[${boss.name}]의 ${pSkill.name} 발동! | 보스 HP +${passiveHeal.toLocaleString()}`,
                                isUserAction: false,
                                bossHealingDone: passiveHeal,
                                fxKind: 'heal',
                                skillId: pSkill.id,
                            });
                        }
                        break;
                    }
                }
            };

            if (pSkill.passiveTrigger === 'always') {
                pSkill.passiveEffect.forEach(processPassiveEffect);
            } else if (pSkill.passiveTrigger === 'every_turn' && pSkill.checkStat) {
                if (!performDuel(pSkill.checkStat)) {
                    pSkill.passiveEffect.forEach(processPassiveEffect);
                }
            } else if (pSkill.passiveTrigger === 'on_user_heal' && pSkill.passiveChance) {
                if (Math.random() < pSkill.passiveChance) {
                    pSkill.passiveEffect.forEach(processPassiveEffect);
                }
            }
        }

        if (userHp <= 0) return true;

        Object.keys(activeDebuffs).forEach((key) => {
            if (activeDebuffs[key as keyof typeof activeDebuffs].turns > 0) {
                activeDebuffs[key as keyof typeof activeDebuffs].turns--;
            }
        });

        return false;
    };

    for (let turn = 1; turn <= BATTLE_TURNS; turn++) {
        turnsSurvived = turn;
        if (runUserFullTurn()) break;
        if (userHp <= 0) break;
        if (runBossFullTurn()) break;
        if (userHp <= 0) break;
    }

    const finalDamage = Math.max(0, Math.round(totalDamageDealt));
    const calculatedRewards = calculateGuildBossBattleRewards(finalDamage, st, {
        rewardTierShift: gear.guildBossRewardTierShift,
        duplicateRewardCount: gear.guildBossDuplicateRewardCount,
    });

    const vipSimGranted = ((): { name: string; quantity: number; image?: string } | undefined => {
        if (!isRewardVipActive(user)) return undefined;
        const o = rollVipPlayRewardOutcome();
        if (o.type === 'gold') {
            return { name: '골드', quantity: o.amount, image: '/images/icon/Gold.webp' };
        }
        if (o.type === 'legendary_equipment') {
            const pool = EQUIPMENT_POOL.filter((e) => e.grade === ItemGrade.Legendary);
            const t = pool[Math.floor(Math.random() * Math.max(1, pool.length))]!;
            return { name: t.name, quantity: 1, image: t.image };
        }
        if (o.type === 'equipment_box') {
            const names = ['장비 상자 I', '장비 상자 II', '장비 상자 III', '장비 상자 IV'] as const;
            const n = names[o.tier];
            return { name: n, quantity: 1, image: CONSUMABLE_ITEMS.find((c) => c.name === n)?.image };
        }
        const names = ['재료 상자 I', '재료 상자 II', '재료 상자 III', '재료 상자 IV'] as const;
        const n = names[o.tier];
        return { name: n, quantity: 1, image: CONSUMABLE_ITEMS.find((c) => c.name === n)?.image };
    })();

    return {
        damageDealt: finalDamage,
        turnsSurvived,
        vipPlayRewardSlot: {
            locked: !isRewardVipActive(user),
            ...(vipSimGranted ? { grantedItem: vipSimGranted } : {}),
        },
        rewards: {
            tier: calculatedRewards.tier,
            guildXp: calculatedRewards.guildXp,
            guildCoins: calculatedRewards.guildCoins,
            researchPoints: calculatedRewards.researchPoints,
            gold: calculatedRewards.gold,
            materials: calculatedRewards.materials,
            materialsBonus: calculatedRewards.materialsBonus,
            tickets: calculatedRewards.tickets,
            equipment: calculatedRewards.equipment,
            materialBox: calculatedRewards.materialBox,
        },
        battleLog,
        bossHpBefore: boss.hp,
        bossHpAfter: Math.max(0, Math.round(boss.hp - Math.max(0, totalDamageDealt))),
        bossMaxHp: boss.maxHp,
        userHp: Math.max(0, userHp),
        maxUserHp,
    };
};
