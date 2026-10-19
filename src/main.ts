import './style.css';
import { PetAnimationEngine, type PetBehavior } from './engine/PetEngine';

const appDiv = document.getElementById('app') as HTMLDivElement;

// Shared button chrome; aria-pressed drives the "active" ring so state and styling can't drift.
const btn =
  'px-5 py-2 rounded-lg font-semibold transition shadow outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ' +
  'aria-pressed:ring-2 aria-pressed:ring-white/80 aria-pressed:ring-offset-2 aria-pressed:ring-offset-slate-800';
const kbd = 'px-1.5 py-0.5 rounded border border-slate-600 bg-slate-900 font-mono text-slate-300';

// 1. Render the application container UI
appDiv.innerHTML = `
  <div class="flex flex-col items-center gap-6 bg-slate-800 p-6 sm:p-8 rounded-2xl shadow-2xl border border-slate-700">
    <div class="text-center">
      <h1 class="text-2xl font-bold tracking-tight text-white">Pet Interactive Canvas</h1>
      <p class="text-sm text-slate-400 mt-1">Move your cursor inside the box or toggle actions below</p>
    </div>

    <!-- The WebGL/Canvas Workspace viewport -->
    <div class="relative bg-slate-950 rounded-xl overflow-hidden border-2 border-slate-600 shadow-inner">
      <canvas id="pet-viewport" width="600" height="400" class="block cursor-crosshair"></canvas>
    </div>

    <!-- Controller Panel Buttons -->
    <div class="flex flex-col items-center gap-3">
      <div class="flex flex-wrap justify-center gap-3 sm:gap-4">
        <button id="btn-idle" data-behavior="idle" aria-pressed="false" class="${btn} bg-slate-700 hover:bg-slate-600 text-white border border-slate-600">
          Idle State 💤
        </button>
        <button id="btn-walk" data-behavior="walk" aria-pressed="false" class="${btn} bg-emerald-600 hover:bg-emerald-500 text-white">
          Go for Walk 🐾
        </button>
        <button id="btn-fetch" data-behavior="fetch" aria-pressed="false" class="${btn} bg-amber-500 hover:bg-amber-400 text-slate-950">
          Play Fetch 🎾
        </button>
        <button id="btn-debug" aria-pressed="false" class="${btn} bg-slate-900 hover:bg-slate-700 text-cyan-300 border border-cyan-700/60 aria-pressed:bg-cyan-500 aria-pressed:text-slate-950 aria-pressed:border-cyan-400">
          Skeleton 🦴
        </button>
      </div>
      <p class="text-xs text-slate-500 text-center leading-6">
        Shortcuts:
        <kbd class="${kbd}">1</kbd> idle ·
        <kbd class="${kbd}">2</kbd> walk ·
        <kbd class="${kbd}">3</kbd> fetch ·
        <kbd class="${kbd}">D</kbd> skeleton
      </p>
    </div>
  </div>
`;

// 2. Initialize the Canvas Orchestration Engine
const canvas = document.getElementById('pet-viewport') as HTMLCanvasElement;
const engine = new PetAnimationEngine(canvas);

// 3. Wire the controls; the engine's listener keeps the highlight right even when a behavior ends itself.
const behaviorButtons = document.querySelectorAll<HTMLButtonElement>('button[data-behavior]');
const debugButton = document.getElementById('btn-debug') as HTMLButtonElement;

const showBehavior = (active: PetBehavior): void => {
  for (const b of behaviorButtons) b.setAttribute('aria-pressed', String(b.dataset.behavior === active));
};
const showDebug = (enabled: boolean): void => debugButton.setAttribute('aria-pressed', String(enabled));

engine.onBehaviorChange(showBehavior);
showBehavior(engine.behavior);

for (const b of behaviorButtons) {
  b.addEventListener('click', () => engine.setBehavior(b.dataset.behavior as PetBehavior));
}
debugButton.addEventListener('click', () => showDebug(engine.toggleDebug()));

const shortcuts: Record<string, PetBehavior> = { '1': 'idle', '2': 'walk', '3': 'fetch' };

window.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
  const target = event.target as HTMLElement | null;
  if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;

  const behavior = shortcuts[event.key];
  if (behavior) engine.setBehavior(behavior);
  else if (event.key === 'd' || event.key === 'D') showDebug(engine.toggleDebug());
});
