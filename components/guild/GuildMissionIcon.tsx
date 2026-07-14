import React from 'react';

export type GuildMissionIconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
export type GuildMissionIconFrame = 'none' | 'guild' | 'guildHeader' | 'quest';

interface GuildMissionIconProps {
    size?: GuildMissionIconSize;
    frame?: GuildMissionIconFrame;
    className?: string;
}

const GUILD_MISSION_IMAGE = '/images/guild/button/guildmission.webp';

const IMAGE_SIZE: Record<GuildMissionIconSize, string> = {
    xs: 'h-5 w-5',
    sm: 'h-6 w-6',
    md: 'h-7 w-7',
    lg: 'h-8 w-8',
    xl: 'h-9 w-9',
    '2xl': 'h-10 w-10 sm:h-11 sm:w-11',
    '3xl': 'h-14 w-14',
};

const FRAME_SIZE: Record<GuildMissionIconSize, string> = {
    xs: 'h-8 w-8',
    sm: 'h-10 w-10',
    md: 'h-10 w-10',
    lg: 'h-10 w-10',
    xl: 'h-11 w-11',
    '2xl': 'h-14 w-14 sm:h-[3.75rem] sm:w-[3.75rem]',
    '3xl': 'h-16 w-16',
};

const FRAME_CLASS: Record<Exclude<GuildMissionIconFrame, 'none'>, string> = {
    guild: 'rounded-xl border border-amber-500/35 bg-gradient-to-b from-amber-950/50 to-stone-950/80 shadow-inner',
    guildHeader: 'rounded-xl border border-amber-400/35 bg-gradient-to-br from-amber-600/30 to-amber-950/40 shadow-md',
    quest: 'rounded-xl border border-amber-500/30 bg-slate-950/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-amber-400/10',
};

const GuildMissionIcon: React.FC<GuildMissionIconProps> = ({ size = 'md', frame = 'guild', className = '' }) => {
    const icon = (
        <div className={`relative flex shrink-0 items-center justify-center ${IMAGE_SIZE[size]}`}>
            <img src={GUILD_MISSION_IMAGE} alt="" className="h-full w-full object-contain drop-shadow-md opacity-95" />
        </div>
    );

    if (frame === 'none') {
        return <div className={`relative flex shrink-0 items-center justify-center ${className}`.trim()}>{icon}</div>;
    }

    return (
        <div
            className={`flex shrink-0 items-center justify-center ${FRAME_SIZE[size]} ${FRAME_CLASS[frame]} ${className}`.trim()}
            aria-hidden
        >
            {icon}
        </div>
    );
};

export default GuildMissionIcon;
