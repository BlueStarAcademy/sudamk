import type { Guild } from '../types/entities.js';
import { GuildResearchId } from '../types/enums.js';
import { GUILD_RESEARCH_PROJECTS } from '../constants/guildConstants.js';

/** 길드 연구 「행동력 회복속도 증가」: 레벨당 `baseEffect`초씩 누적 감소(기본 5초×레벨). */
export function getGuildApRegenResearchSecReduction(guild: Guild | null | undefined): number {
    if (!guild?.research) return 0;
    const data = guild.research[GuildResearchId.ap_regen_boost];
    const project = GUILD_RESEARCH_PROJECTS[GuildResearchId.ap_regen_boost];
    if (!data || !project || data.level <= 0) return 0;
    return project.baseEffect * data.level;
}
