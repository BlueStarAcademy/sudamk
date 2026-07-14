import { describe, expect, it } from 'vitest';
import { adventureMapTreasureChestImage } from '../../../shared/utils/adventureMapTreasureSchedule.js';

describe('adventureMapTreasureChestImage', () => {
    it('maps each chapter stageId to its treasure art path', () => {
        expect(adventureMapTreasureChestImage('neighborhood_hill')).toBe(
            '/images/adventure/treasure/neighborhood_hill.webp',
        );
        expect(adventureMapTreasureChestImage('lake_park')).toBe('/images/adventure/treasure/lake_park.webp');
        expect(adventureMapTreasureChestImage('aquarium')).toBe('/images/adventure/treasure/aquarium.webp');
        expect(adventureMapTreasureChestImage('zoo')).toBe('/images/adventure/treasure/zoo.webp');
        expect(adventureMapTreasureChestImage('amusement_park')).toBe(
            '/images/adventure/treasure/amusement_park.webp',
        );
    });

    it('falls back to neighborhood_hill for unknown stageId', () => {
        expect(adventureMapTreasureChestImage('unknown_stage')).toBe(
            '/images/adventure/treasure/neighborhood_hill.webp',
        );
    });
});
