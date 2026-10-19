import type { PetSimulation } from '../core/PetSimulation';
import type { PetRig } from '../core/PetRig';
import { type Vec2, vec2 } from '../math/vec2';
import { MESH_COLS, MESH_ROWS } from '../core/bodyMesh';

const COLORS = {
  bone: 'rgba(34, 211, 238, 0.9)',
  boneFar: 'rgba(34, 211, 238, 0.45)',
  joint: '#e0f2fe',
  root: '#22d3ee',
  target: 'rgba(251, 191, 36, 0.95)',
  mesh: 'rgba(244, 114, 182, 0.85)',
  head: 'rgba(163, 230, 53, 0.95)',
  look: 'rgba(163, 230, 53, 0.35)',
  legend: '#94a3b8',
};

const LEGEND: ReadonlyArray<readonly [string, string]> = [
  ['bones / joints', COLORS.bone],
  ['IK targets', COLORS.target],
  ['body mesh', COLORS.mesh],
  ['head / gaze', COLORS.head],
];

const DASH = [4, 4];
const SOLID: number[] = [];
const HEAD_RAY = 26;

/**
 * Skeleton view for inspecting the rig: bones, joints, IK targets, mesh
 * vertices and gaze. Rig-space points go through `rig.toDisplay`, so the
 * overlay follows the turn animation while dots and line widths stay crisp.
 */
export class DebugOverlay {
  private readonly a = vec2();
  private readonly b = vec2();

  draw(ctx: CanvasRenderingContext2D, sim: PetSimulation, textured = false): void {
    const rig = sim.rig;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (textured) this.drawTextureMesh(ctx, rig);
    else this.drawMesh(ctx, rig);

    // Far legs first and dimmer, mirroring the draw order of the pet itself.
    for (const leg of rig.legs) if (leg.far) this.drawLeg(ctx, rig, leg.socket, leg.knee, leg.foot, COLORS.boneFar);
    this.drawChain(ctx, rig, rig.tail, COLORS.boneFar);
    this.drawChain(ctx, rig, rig.spine.joints, COLORS.bone);
    this.drawChain(ctx, rig, rig.neck.joints, COLORS.bone);
    for (const leg of rig.legs) if (!leg.far) this.drawLeg(ctx, rig, leg.socket, leg.knee, leg.foot, COLORS.bone);

    for (const leg of rig.legs) this.crosshair(ctx, rig.toDisplay(this.a, leg.target), 4);
    this.crosshair(ctx, rig.toDisplay(this.a, rig.chestIkTarget), 5);
    this.crosshair(ctx, rig.toDisplay(this.a, rig.neckIkTarget), 5);
    // Behavior targets are already in world space, so they skip toDisplay.
    const reach = sim.controls.reachFor;
    if (reach) this.crosshair(ctx, reach, 8);

    this.drawHead(ctx, sim);
    this.drawLegend(ctx, sim.width);
    ctx.restore();
  }

  private drawMesh(ctx: CanvasRenderingContext2D, rig: PetRig): void {
    ctx.fillStyle = COLORS.mesh;
    for (const p of rig.bodyRing) {
      rig.toDisplay(this.a, p);
      ctx.fillRect(this.a.x - 1.25, this.a.y - 1.25, 2.5, 2.5);
    }
  }

  /** Wireframe of the texture mesh: grid lines plus the diagonal each quad is split along. */
  private drawTextureMesh(ctx: CanvasRenderingContext2D, rig: PetRig): void {
    const mesh = rig.bodyMesh;
    ctx.strokeStyle = COLORS.mesh;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let row = 0; row < MESH_ROWS; row++) {
      for (let col = 0; col < MESH_COLS; col++) {
        const i = row * MESH_COLS + col;
        rig.toDisplay(this.a, mesh[i]);
        if (col < MESH_COLS - 1) {
          rig.toDisplay(this.b, mesh[i + 1]);
          ctx.moveTo(this.a.x, this.a.y);
          ctx.lineTo(this.b.x, this.b.y);
        }
        if (row < MESH_ROWS - 1) {
          rig.toDisplay(this.b, mesh[i + MESH_COLS]);
          ctx.moveTo(this.a.x, this.a.y);
          ctx.lineTo(this.b.x, this.b.y);
          if (col < MESH_COLS - 1) {
            rig.toDisplay(this.b, mesh[i + MESH_COLS + 1]);
            ctx.moveTo(this.a.x, this.a.y);
            ctx.lineTo(this.b.x, this.b.y);
          }
        }
      }
    }
    ctx.stroke();
  }

  /** Polyline through the joints with a dot per joint; the root gets a ring. */
  private drawChain(ctx: CanvasRenderingContext2D, rig: PetRig, joints: readonly Vec2[], color: string): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < joints.length; i++) {
      rig.toDisplay(this.a, joints[i]);
      if (i === 0) ctx.moveTo(this.a.x, this.a.y);
      else ctx.lineTo(this.a.x, this.a.y);
    }
    ctx.stroke();

    for (let i = 1; i < joints.length; i++) this.dot(ctx, rig.toDisplay(this.a, joints[i]), 2.5, COLORS.joint);
    this.ring(ctx, rig.toDisplay(this.a, joints[0]), 4.5, COLORS.root);
  }

  private drawLeg(ctx: CanvasRenderingContext2D, rig: PetRig, socket: Vec2, knee: Vec2, foot: Vec2, color: string): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    rig.toDisplay(this.a, socket);
    ctx.moveTo(this.a.x, this.a.y);
    rig.toDisplay(this.a, knee);
    ctx.lineTo(this.a.x, this.a.y);
    rig.toDisplay(this.a, foot);
    ctx.lineTo(this.a.x, this.a.y);
    ctx.stroke();

    this.ring(ctx, rig.toDisplay(this.a, socket), 3.5, COLORS.root);
    this.dot(ctx, rig.toDisplay(this.a, knee), 2.5, COLORS.joint);
    this.dot(ctx, rig.toDisplay(this.a, foot), 2.5, COLORS.joint);
  }

  /** Facing ray from the head, plus a faint dashed line to whatever the pet is looking at. */
  private drawHead(ctx: CanvasRenderingContext2D, sim: PetSimulation): void {
    const rig = sim.rig;
    const head = rig.toDisplay(this.a, rig.head);

    const look = sim.controls.lookAt;
    if (look) {
      ctx.strokeStyle = COLORS.look;
      ctx.lineWidth = 1;
      ctx.setLineDash(DASH);
      ctx.beginPath();
      ctx.moveTo(head.x, head.y);
      ctx.lineTo(look.x, look.y);
      ctx.stroke();
      ctx.setLineDash(SOLID);
      this.ring(ctx, look, 3, COLORS.look);
    }

    // Head-local +x in rig space is (facing·cos, sin); map the ray tip like any joint.
    this.b.x = rig.head.x + rig.facing * Math.cos(rig.headAngle) * HEAD_RAY;
    this.b.y = rig.head.y + Math.sin(rig.headAngle) * HEAD_RAY;
    rig.toDisplay(this.b, this.b);
    ctx.strokeStyle = COLORS.head;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(head.x, head.y);
    ctx.lineTo(this.b.x, this.b.y);
    ctx.stroke();
    this.dot(ctx, head, 3, COLORS.head);
    this.dot(ctx, rig.toDisplay(this.a, rig.mouth), 2, COLORS.head);
  }

  private drawLegend(ctx: CanvasRenderingContext2D, width: number): void {
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < LEGEND.length; i++) {
      const y = 22 + i * 15;
      ctx.fillStyle = COLORS.legend;
      ctx.fillText(LEGEND[i][0], width - 28, y);
      ctx.fillStyle = LEGEND[i][1];
      ctx.fillRect(width - 22, y - 1.5, 10, 3);
    }
  }

  private dot(ctx: CanvasRenderingContext2D, p: Vec2, r: number, color: string): void {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  private ring(ctx: CanvasRenderingContext2D, p: Vec2, r: number, color: string): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  private crosshair(ctx: CanvasRenderingContext2D, p: Vec2, r: number): void {
    ctx.strokeStyle = COLORS.target;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(p.x - r, p.y);
    ctx.lineTo(p.x + r, p.y);
    ctx.moveTo(p.x, p.y - r);
    ctx.lineTo(p.x, p.y + r);
    ctx.stroke();
  }
}
