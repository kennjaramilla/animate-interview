import type { Leg, PetRig } from '../core/PetRig';
import type { Vec2 } from '../math/vec2';
import { PALETTE, RIG } from '../config';
import type { TexturedBody } from './TexturedBody';

/**
 * Draws the rig. Everything is built from the solved joints each frame, so
 * there are no sprite sheets: the shapes are skinned straight onto the bones.
 * Caller has already applied the turn transform about the hips.
 */
export function drawPet(ctx: CanvasRenderingContext2D, rig: PetRig, texturedBody: TexturedBody | null = null): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const leg of rig.legs) if (leg.far) drawLeg(ctx, leg, PALETTE.furShade);
  drawTail(ctx, rig.tail);
  // Textured mode warps the body image over the mesh; falls back to vectors until it has loaded.
  if (texturedBody?.ready) texturedBody.draw(ctx, rig.bodyMesh);
  else drawBody(ctx, rig.bodyRing);
  drawNeck(ctx, rig);
  for (const leg of rig.legs) if (!leg.far) drawLeg(ctx, leg, PALETTE.fur);
  drawHead(ctx, rig);
}

function drawLeg(ctx: CanvasRenderingContext2D, leg: Leg, color: string): void {
  if (leg.hind) {
    // Haunch: a thick thigh mass over the socket so the hind leg reads as a dog's, not a stick.
    const angle = Math.atan2(leg.knee.y - leg.socket.y, leg.knee.x - leg.socket.x);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(
      (leg.socket.x * 2 + leg.knee.x) / 3,
      (leg.socket.y * 2 + leg.knee.y) / 3,
      15,
      11,
      angle,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = leg.hind ? 14 : 11;
  ctx.beginPath();
  ctx.moveTo(leg.socket.x, leg.socket.y);
  ctx.lineTo(leg.knee.x, leg.knee.y);
  ctx.stroke();

  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(leg.knee.x, leg.knee.y);
  ctx.lineTo(leg.foot.x, leg.foot.y - 2);
  ctx.stroke();

  // Paw points the way the knee isn't folded: forward for both leg types.
  const forward = Math.sign(leg.foot.x - leg.knee.x) || 1;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(leg.foot.x + forward * (leg.hind ? 4 : 3), leg.foot.y - 3, 7.5, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawTail(ctx: CanvasRenderingContext2D, tail: Vec2[]): void {
  ctx.strokeStyle = PALETTE.furShade;
  // Taper by drawing each segment a little thinner than the last.
  for (let i = 0; i < tail.length - 1; i++) {
    ctx.lineWidth = 9 - i * 1.1;
    ctx.beginPath();
    ctx.moveTo(tail[i].x, tail[i].y);
    ctx.lineTo(tail[i + 1].x, tail[i + 1].y);
    ctx.stroke();
  }
}

/** Smooth closed curve through the ring: quadratic segments between edge midpoints. */
function drawBody(ctx: CanvasRenderingContext2D, ring: Vec2[]): void {
  const n = ring.length;
  ctx.fillStyle = PALETTE.fur;
  ctx.beginPath();
  ctx.moveTo((ring[n - 1].x + ring[0].x) / 2, (ring[n - 1].y + ring[0].y) / 2);
  for (let i = 0; i < n; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % n];
    ctx.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2);
  }
  ctx.closePath();
  ctx.fill();
}

function drawNeck(ctx: CanvasRenderingContext2D, rig: PetRig): void {
  const joints = rig.neck.joints;
  ctx.strokeStyle = PALETTE.fur;
  ctx.lineWidth = 21;
  ctx.beginPath();
  ctx.moveTo(joints[0].x, joints[0].y + 6);
  for (let i = 1; i < joints.length; i++) ctx.lineTo(joints[i].x, joints[i].y);
  ctx.stroke();

  // Collar: a band across the neck near its base, plus a swinging tag.
  const a = joints[0];
  const b = joints[1];
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  ctx.save();
  ctx.translate(a.x + (b.x - a.x) * 0.55, a.y + (b.y - a.y) * 0.55);
  ctx.rotate(angle);
  ctx.fillStyle = PALETTE.collar;
  ctx.fillRect(-3, -12, 6, 24);
  ctx.restore();

  const side = rig.facing;
  ctx.fillStyle = PALETTE.tag;
  ctx.beginPath();
  ctx.arc(a.x + (b.x - a.x) * 0.55 + side * 9, a.y + (b.y - a.y) * 0.55 + 6, 3.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawHead(ctx: CanvasRenderingContext2D, rig: PetRig): void {
  ctx.save();
  ctx.translate(rig.head.x, rig.head.y);
  ctx.scale(rig.facing, 1);
  ctx.rotate(rig.headAngle);

  // Skull and snout (head-local: +x is forward).
  ctx.fillStyle = PALETTE.fur;
  ctx.beginPath();
  ctx.ellipse(2, -3, 17, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.furLight;
  ctx.beginPath();
  ctx.ellipse(17, 5, 13, 8.5, 0.08, 0, Math.PI * 2);
  ctx.fill();

  // Panting tongue grows in with excitement.
  if (rig.excitement > 0.45) {
    const t = Math.min((rig.excitement - 0.45) / 0.4, 1);
    ctx.fillStyle = PALETTE.tongue;
    ctx.beginPath();
    ctx.ellipse(RIG.mouth.x - 9, RIG.mouth.y + 3 + 3 * t + rig.breath * 2, 4, 3 + 4 * t, 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = PALETTE.nose;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(RIG.mouth.x - 2, RIG.mouth.y + 1);
  ctx.quadraticCurveTo(RIG.mouth.x - 8, RIG.mouth.y + 4, RIG.mouth.x - 15, RIG.mouth.y + 1);
  ctx.stroke();

  ctx.fillStyle = PALETTE.nose;
  ctx.beginPath();
  ctx.ellipse(29, 1.5, 4.4, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eye: sclera squashes shut on blink; pupil is offset by the tracking spring.
  const open = 1 - rig.blink * 0.92;
  ctx.fillStyle = PALETTE.sclera;
  ctx.beginPath();
  ctx.ellipse(8, -6, 5, 5.6 * open, 0, 0, Math.PI * 2);
  ctx.fill();
  if (open > 0.3) {
    const px = 8 + rig.pupil.pos.x;
    const py = -6 + rig.pupil.pos.y * open;
    ctx.fillStyle = PALETTE.eye;
    ctx.beginPath();
    ctx.ellipse(px, py, 3.1, 3.3 * open, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.sclera;
    ctx.beginPath();
    ctx.arc(px - 1, py - 1.3 * open, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ear hangs from the back of the skull and swings on its own spring.
  ctx.save();
  ctx.translate(-6, -13);
  ctx.rotate(0.35 + rig.ear.value);
  ctx.fillStyle = PALETTE.ear;
  ctx.beginPath();
  ctx.moveTo(-5, 0);
  ctx.quadraticCurveTo(-9, 16, -1, 24);
  ctx.quadraticCurveTo(8, 18, 6, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.restore();
}
