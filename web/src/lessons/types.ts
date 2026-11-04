// Shapes of lesson content. Lessons are plain data; the pages render them.
//
// Text fields support two inline markers: `code` and **bold**.

import type { Row } from '../components/Waveform';
import type { CaptureSettings } from '../model/capture';

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

/** A small reference table, e.g. the bytes a protocol transaction carries. */
export interface FactTable {
  title: string;
  head: string[];
  rows: string[][];
}

export interface Lesson {
  id: string;
  track: 'learn' | 'protocols' | 'verify';
  title: string;
  summary: string;
  /** Pico pins to wire up, each to any free analyzer input. */
  gpios: number[];
  intro: string;
  parts: Part[];
  questions: Question[];
  tables?: FactTable[];
  checks?: Check[];
  tips?: string[];
}
