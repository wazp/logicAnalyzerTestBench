// Shapes of lesson content. Lessons are plain data; the pages render them.
//
// Text fields support two inline markers: `code` and **bold**.

import type { Row } from '../components/Waveform';
import type { CaptureSettings } from '../model/capture';
import type { PresetId } from '../model/presets';

/** A waveform view: a time window around the trigger, optionally sampled like an analyzer would. */
export interface View {
  title: string;
  startNs: number;
  endNs: number;
  /** Draw what an analyzer at this rate records. Omit for the ideal signal. */
  sampleRateHz?: number;
  /** Let the reader switch between these sample rates. */
  sampleRateOptions?: number[];
  /** Traces to draw. Omitted: every pin the lesson wires, as its repeating basic signal. */
  rows?: Row[];
  caption: string;
}

/** One capture: the settings, the steps, and what it should look like. */
export interface Part {
  title: string;
  intro?: string;
  settings: CaptureSettings;
  steps: string[];
  views: View[];
}

export interface Question {
  q: string;
  a: string;
}

/** A pass/fail item for the verify track. */
export interface Check {
  id: string;
  gpio: number;
  measure: string;
  expected: string;
}

/** A small reference table, e.g. the bytes a protocol transaction carries. Cells support the inline markers. */
export interface FactTable {
  title: string;
  head: string[];
  rows: string[][];
}

/** Diagrams a section can show. */
export type Figure = 'thresholds';

/** An explanation section: paragraphs, then optional bullets, a table or a figure. */
export interface Section {
  title: string;
  body: string[];
  bullets?: string[];
  table?: FactTable;
  figure?: Figure;
  /** A program or file to copy, shown as a code block after the bullets. */
  code?: string;
}

export interface Lesson {
  id: string;
  track: 'concepts' | 'learn' | 'protocols' | 'video' | 'faults' | 'verify' | 'hardware';
  /** The signal preset GP10-GP22 must play. Omitted: the default, protocols. */
  preset?: PresetId;
  /** Finding out what the pins carry is the exercise: the page hides their names, and parts show no waveforms. */
  mystery?: boolean;
  /**
   * Set for a lesson not everyone can follow (it needs a feature some analyzer software lacks): who can skip
   * it, shown at the top of the lesson. The lesson list tags it as optional, and no other lesson may rely on it.
   */
  optional?: string;
  title: string;
  summary: string;
  /** Pico pins to wire up, each to any free analyzer input. Empty for a reading-only lesson. */
  gpios: number[];
  intro: string;
  /** Explanation, shown before any hands-on part. */
  sections?: Section[];
  /** Hands-on captures. May be empty for a reading-only lesson. */
  parts: Part[];
  questions: Question[];
  tables?: FactTable[];
  checks?: Check[];
  tips?: string[];
}
