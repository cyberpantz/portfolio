// Sound configuration with volume control
export interface SoundConfig {
    url: string;
    vol: number; // Volume from 0.0 to 1.0
}


export const interactionSounds: Record<string, SoundConfig> = {
    pointsSubtracted: { url: "/sounds/interactions/trash.wav", vol: 0.3 },
    pointsAdded: { url: "/sounds/interactions/subtle_points.wav", vol: 0.2 }, // Subtle, pleasant sound instead of coins=
    unlockFailed: { url: "/sounds/interactions/subtract_points.wav", vol: 0.3 },
    unlocked: { url: "/sounds/interactions/level_completion.wav", vol: 0.3 },
}

export const chooserSounds: Record<string, SoundConfig> = {
    club: { url: "/sounds/chooser/club.mp3", vol: 0.6 },
    disco: { url: "/sounds/chooser/disco.mp3", vol: 0.6 },
    badToTheBone: { url: "/sounds/chooser/bad_to_the_bone.mp3", vol: 0.6 },
}   


export const gameSounds: Record<string, SoundConfig> = {
    chicken_boss: { url: "/sounds/game/chicken_boss.wav", vol: 0.6 },
}   

