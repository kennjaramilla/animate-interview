/** Tuning constants shared by the simulation and renderer (pixels, seconds). */

export const LOOP = {
  /** Longest frame we simulate; anything longer (tab switch, breakpoint) is dropped. */
  maxFrameTime: 0.1,
  /** Long frames are split into sub-steps no bigger than this. */
  maxStep: 1 / 120,
};

export const WORLD = {
  /** Distance from the bottom of the canvas to the ground line. */
  groundInset: 60,
  /** Horizontal margin the pet keeps from the canvas edges. */
  edgeMargin: 70,
  gravity: 1400,
};
