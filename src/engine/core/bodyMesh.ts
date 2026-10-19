import { RIG } from '../config';

/**
 * Layout of the textured body mesh, shared by the rig (which deforms it) and
 * the renderer (which maps the texture onto it).
 *
 * The mesh is a grid in "spine space": columns run from the rump cap, along
 * the spine samples, to the chest cap; rows sit a fixed distance above the
 * spine, on it, and below it. The texture is authored in the same space, so a
 * vertex's rest position doubles as its texture coordinate.
 */
export const SPINE_SAMPLES = 9;
export const MESH_COLS = SPINE_SAMPLES + 2;
export const MESH_ROWS = 3;
/** Distance from the spine to the top / bottom rows; covers the deepest chest. */
export const MESH_HALF_HEIGHT = 22;
export const MESH_REAR_CAP = 16;
export const MESH_FRONT_CAP = 15;

/** Rest x of a column along the straightened spine (texture space units). */
export function meshRestX(col: number): number {
  if (col === 0) return -MESH_REAR_CAP;
  if (col === MESH_COLS - 1) return RIG.bodyLength + MESH_FRONT_CAP;
  return ((col - 1) / (SPINE_SAMPLES - 1)) * RIG.bodyLength;
}

/** Rest y of a row: negative is above the spine. */
export const meshRestY = (row: number): number => (row - 1) * MESH_HALF_HEIGHT;
