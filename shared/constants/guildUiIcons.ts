/** Guild dashboard section / chrome header icons (soft-3D WebP, not CTA button art). */
export const GUILD_UI_ICONS = {
    activities: '/images/guild/ui/activities.webp',
    checkin: '/images/guild/ui/checkin.webp',
    announcement: '/images/guild/ui/announcement.webp',
    donation: '/images/guild/ui/donation.webp',
    boss: '/images/guild/ui/boss.webp',
    war: '/images/guild/ui/war.webp',
    members: '/images/guild/ui/members.webp',
    applications: '/images/guild/ui/applications.webp',
    chat: '/images/guild/ui/chat.webp',
    edit: '/images/guild/ui/edit.webp',
    tip: '/images/guild/ui/tip.webp',
    specialStar: '/images/guild/ui/special-star.webp',
    guideBook: '/images/guild/ui/guide-book.webp',
    guidePower: '/images/guild/ui/guide-power.webp',
    guideLab: '/images/guild/ui/guide-lab.webp',
    /** Boss guide “main skills” section (shares boss chrome motif). */
    guideSkills: '/images/guild/ui/boss.webp',
} as const;

export type GuildUiIconKey = keyof typeof GUILD_UI_ICONS;

/** Default sizing for section title prefix icons. */
export const GUILD_UI_ICON_CLASS = 'h-5 w-5 shrink-0 object-contain drop-shadow sm:h-6 sm:w-6';
