import { createContext } from 'preact';
import { defaultPreset, type PresetId } from '../model/presets';

/** The preset the page shows, so pin labels name GP10-GP22 the way that preset uses them. */
export const PresetContext = createContext<PresetId>(defaultPreset);

/** True on a mystery lesson: pin labels leave out what each pin carries. */
export const MysteryContext = createContext(false);
