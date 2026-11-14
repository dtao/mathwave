/** Tiny bit of music theory shared by the beat and the melody generator. */

export const midiToFreq = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

export const MAJOR = [0, 2, 4, 5, 7, 9, 11];
/** Harmonic minor: flat 3rd and 6th, but the leading tone stays. Used for the "after a miss" bass colour. */
export const MINOR_COLOR = [0, 2, 3, 5, 7, 8, 11];
export const MAJOR_PENTATONIC = [0, 2, 4, 7, 9];

/**
 * MIDI note for a scale degree. Degree 0 is the root, degrees past the end of
 * the scale wrap into the next octave, negative degrees go below the root.
 */
export function scaleNote(rootMidi: number, scale: readonly number[], degree: number): number {
  const n = scale.length;
  const octave = Math.floor(degree / n);
  return rootMidi + 12 * octave + scale[((degree % n) + n) % n];
}
