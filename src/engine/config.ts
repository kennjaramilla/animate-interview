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

/** Skeleton proportions and limits. Local x is "forward", so the rig mirrors cleanly. */
export const RIG = {
  hipHeight: 52,
  bodyLength: 74,
  chestRise: 4,
  /** Chest → head base at rest. */
  neckRest: { x: 14, y: -36 },
  neckSegments: 3,
  neckSegmentLength: 14,
  /** Neck may stretch up to this factor when reaching for something. */
  maxNeckStretch: 1.35,
  /** How far the chest may lean out of its rest pose to extend a reach. */
  maxLean: 26,
  /** Head-local position of the mouth. */
  mouth: { x: 27, y: 9 },
  /** Local head pitch limits in radians (negative looks up). */
  headPitchUp: -1.15,
  headPitchDown: 0.75,
  headRestPitch: 0.12,
  hindLeg: { upper: 24, lower: 25 },
  frontLeg: { upper: 21, lower: 25 },
  tailSegments: 6,
  tailSegmentLength: 8,
  pupilRange: 2.3,
};

export const PALETTE = {
  skyTop: '#0b1424',
  skyBottom: '#020617',
  ground: '#0b1220',
  groundLine: '#334155',
  fur: '#d9a46c',
  furShade: '#b07c4b',
  furLight: '#efcf9f',
  ear: '#8a5a33',
  nose: '#2b1d14',
  eye: '#1c1410',
  sclera: '#fdf6ec',
  tongue: '#f472b6',
  collar: '#e11d48',
  tag: '#fbbf24',
  shadow: 'rgba(0, 0, 0, 0.35)',
  ballFelt: '#d9f035',
  ballShade: '#9bb51e',
  ballSeam: '#f8fafc',
};

export const BALL = {
  radius: 8,
  /** Share of the normal speed kept on each bounce. */
  restitution: 0.55,
  /** Exponential rolling friction rate (1/s). */
  friction: 1.6,
  /** Below this ground speed a rolling ball is considered settled. */
  restSpeed: 6,
};

/** Fetch tuning. Heights are ball-centre heights above the floor. */
export const FETCH = {
  /** Anticipation before the throw: play bow while the ball is wound up. */
  windup: 0.65,
  /** High lob: lots of hang time, caught standing as it drops. */
  lobTime: { min: 0.95, max: 1.25 },
  /** Flat, fast throw that tends to pass overhead and needs a jump. */
  lineDriveTime: { min: 0.6, max: 0.75 },
  lineDriveChance: 0.35,
  /** Keep the arc's apex at least this far below the top of the canvas. */
  apexMargin: 26,
  runSpeed: 300,
  carrySpeed: 170,
  gotItBeat: 0.35,
  reactionTime: 0.18,
  /** Hips → mouth horizontal distance when meeting the ball (measured from the rig). */
  reachOffset: 115,
  reachSlack: 22,
  standReach: 125,
  jumpReach: 235,
  jumpPatience: 0.15,
  /** Start stretching towards the planned catch point this many seconds early. */
  reachLead: 0.45,
  /** Mouth-to-ball distance (beyond the radius) that counts as a catch. */
  catchSlop: 9,
  /** Give up on a ball that can't be reached (e.g. wedged where the dog can't go). */
  giveUpAfter: 9,
};
