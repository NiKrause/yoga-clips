// The title cards of every film in films/, in Yoga Clips' brand (brand.js).
import { test } from '@playwright/test';
import { recordCards } from '@le-space/video-kit/record-cards';
import { cards, NIGHT, voice } from './brand.js';

recordCards(test, {
	films: new URL('./films/', import.meta.url),
	cards,
	scene: { voice, night: NIGHT }
});
