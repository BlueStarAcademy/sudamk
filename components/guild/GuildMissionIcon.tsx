import React from 'react';

export type GuildMissionIconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
export type GuildMissionIconFrame = 'none' | 'guild' | 'guildHeader' | 'quest';

interface GuildMissionIconProps {
    size?: GuildMissionIconSize;
    frame?: GuildMissionIconFrame;
    className?: string;
}

const QUEST_IMAGE = '/images/quest.webp';

const IMAGE_SIZE: Record<GuildMissionIconSize, string> = {
    xs: 'h-5 w-5',
    sm: 'h-6 w-6',
    md: 'h-7 w-7',
    lg: 'h-8 w-8',
    xl: 'h-9 w-9',
    '2xl': 'h-10 w-10 sm:h-11 sm:w-11',
    '3xl': 'h-14 w-14',
};

const MARKER_SIZE: Record<GuildMissionIconSize, string> = {
    xs: 'text-[4px] px-0.5 py-px tracking-tighter',
    sm: 'text-[5px] px-0.5 py-px tracking-tighter',
    md: 'text-[6px] px-0.5 py-px tracking-tight',
    lg: 'text-[6px] px-0.5 py-px tracking-tight',
    xl: 'text-[7px] px-1 py-px tracking-tight',
    '2xl': 'text-[7px] px-1 py-0.5 tracking-wide',
    '3xl': 'text-[8px] px-1 py-0.5 tracking-wide',
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
            <img src={QUEST_IMAGE} alt="" className="h-full w-full object-contain opacity-95" />
            <span
                className={`pointer-events-none absolute left-1/2 top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded border border-amber-400/55 bg-slate-950/88 font-black uppercase leading-none text-amber-100 shadow-[0_1px_4px_rgba(0,0,0,0.75)] ${MARKER_SIZE[size]}`}
                aria-hidden
            >
                GUILD
            </span>
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
