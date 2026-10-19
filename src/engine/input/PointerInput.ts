export interface PointerSink {
  setPointer(x: number, y: number): void;
  clearPointer(): void;
}

/**
 * DOM adapter: maps pointer events (mouse, pen, touch) to simulation
 * coordinates. Scales by the canvas's CSS size so tracking stays correct when
 * the canvas is shrunk on narrow screens.
 */
export class PointerInput {
  private readonly canvas: HTMLCanvasElement;
  private readonly width: number;
  private readonly height: number;
  private readonly sink: PointerSink;

  constructor(canvas: HTMLCanvasElement, width: number, height: number, sink: PointerSink) {
    this.canvas = canvas;
    this.width = width;
    this.height = height;
    this.sink = sink;

    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerdown', this.onMove);
    canvas.addEventListener('pointerleave', this.onLeave);
    canvas.addEventListener('pointercancel', this.onLeave);
  }

  dispose(): void {
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerdown', this.onMove);
    this.canvas.removeEventListener('pointerleave', this.onLeave);
    this.canvas.removeEventListener('pointercancel', this.onLeave);
  }

  private readonly onMove = (event: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    this.sink.setPointer(
      ((event.clientX - rect.left) * this.width) / rect.width,
      ((event.clientY - rect.top) * this.height) / rect.height,
    );
  };

  private readonly onLeave = (): void => {
    this.sink.clearPointer();
  };
}
