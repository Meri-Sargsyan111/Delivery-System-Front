import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SPLASH_SHOWN_KEY } from '../../guards/splash-guard';

type Phase = 'falling' | 'assembling' | 'title' | 'package' | 'route' | 'truck' | 'exit' | 'fadeout';

const PHASE_ORDER: Phase[] = ['falling', 'assembling', 'title', 'package', 'route', 'truck', 'exit', 'fadeout'];

const TITLE_LINES = ['DELIVERY', 'SYSTEM'];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DECORATIVE_LETTER_COUNT = 210;

const FALL_DURATION_MS = 2000;
const ASSEMBLE_DURATION_MS = 750;

const GRAVITY = 1400;
const BOUNCE_DAMPING = 0.32;
const MAX_BOUNCES = 2;

type Hue = 'purple' | 'cyan' | 'white';

const HUE_COLORS: Record<Hue, string> = {
  purple: 'rgba(167, 139, 250, 0.95)',
  cyan: 'rgba(103, 232, 249, 0.95)',
  white: 'rgba(241, 245, 249, 0.95)',
};

interface Letter {
  char: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  vrot: number;
  size: number;
  opacity: number;
  hue: Hue;
  restY: number;
  bounces: number;
  spawnAt: number;
  settled: boolean;
  isTitleLetter: boolean;
  targetX: number;
  targetY: number;
  tweenFromX: number;
  tweenFromY: number;
  tweenFromRotation: number;
}

/**
 * Cinematic, once-per-session intro: hundreds of glowing letters fall with simple
 * gravity/bounce physics on a canvas, are attracted toward the center, and the ones
 * needed for "DELIVERY SYSTEM" settle into place while the rest fade out. The canvas
 * then crossfades into a crisp DOM title (glow/scale handled entirely by CSS), followed
 * by a package -> route -> truck sequence, then the whole thing fades and routes to
 * /login. See splash-guard.ts for how this is gated to run only once per browser session.
 */
@Component({
  selector: 'app-splash',
  standalone: true,
  templateUrl: './splash.html',
  styleUrl: './splash.css',
})
export class Splash implements AfterViewInit, OnDestroy {

  @ViewChild('lettersCanvas') private canvasRef?: ElementRef<HTMLCanvasElement>;

  private router = inject(Router);

  phase = signal<Phase>('falling');

  readonly particles = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    top: -10 + Math.random() * 26,
    delay: Math.random() * 500,
  }));

  private ctx: CanvasRenderingContext2D | null = null;
  private canvasWidth = 0;
  private canvasHeight = 0;
  private dpr = 1;

  private letters: Letter[] = [];
  private rafId: number | null = null;
  private startTime = 0;
  private assemblingStarted = false;
  private timeoutIds: ReturnType<typeof setTimeout>[] = [];
  private destroyed = false;

  private readonly reducedMotion =
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  ngAfterViewInit(): void {
    if (this.reducedMotion) {
      this.runReducedMotionSequence();
      return;
    }

    this.setupCanvas();
    this.spawnLetters();
    this.rafId = requestAnimationFrame(this.loop);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.timeoutIds.forEach(id => clearTimeout(id));
    this.timeoutIds = [];
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.canvasRef) {
      this.setupCanvas();
      this.layoutTitleTargets();
    }
  }

  atLeast(target: Phase): boolean {
    return PHASE_ORDER.indexOf(this.phase()) >= PHASE_ORDER.indexOf(target);
  }

  private setupCanvas(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) {
      return;
    }

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvasWidth = canvas.clientWidth || window.innerWidth;
    this.canvasHeight = canvas.clientHeight || window.innerHeight;

    canvas.width = this.canvasWidth * this.dpr;
    canvas.height = this.canvasHeight * this.dpr;

    this.ctx = canvas.getContext('2d');
    this.ctx?.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  private spawnLetters(): void {
    const titleChars = TITLE_LINES.join('').split('');
    this.letters = [];

    for (let i = 0; i < DECORATIVE_LETTER_COUNT; i++) {
      this.letters.push(this.createLetter(this.randomChar(), false));
    }
    for (const char of titleChars) {
      this.letters.push(this.createLetter(char, true));
    }

    this.layoutTitleTargets();
  }

  private randomChar(): string {
    return ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }

  private createLetter(char: string, isTitleLetter: boolean): Letter {
    const size = (12 + Math.random() * 20) * (this.canvasWidth < 480 ? 0.75 : 1);
    const hueRoll = Math.random();
    const hue: Hue = hueRoll < 0.4 ? 'purple' : hueRoll < 0.7 ? 'cyan' : 'white';

    return {
      char,
      x: Math.random() * this.canvasWidth,
      y: -30 - Math.random() * 220,
      vx: (Math.random() - 0.5) * 40,
      vy: 20 + Math.random() * 60,
      rotation: (Math.random() - 0.5) * 0.6,
      vrot: (Math.random() - 0.5) * 1.4,
      size,
      opacity: 0,
      hue,
      restY: this.canvasHeight * (0.55 + Math.random() * 0.3),
      bounces: 0,
      spawnAt: Math.random() * 1400,
      settled: false,
      isTitleLetter,
      targetX: 0,
      targetY: 0,
      tweenFromX: 0,
      tweenFromY: 0,
      tweenFromRotation: 0,
    };
  }

  /** Lays out target slots for the title letters (used once assembling starts). */
  private layoutTitleTargets(): void {
    if (!this.ctx) {
      return;
    }

    const titleFontSize = Math.max(32, Math.min(this.canvasWidth * 0.11, 104));
    const lineGap = titleFontSize * 1.15;
    const centerY = this.canvasHeight * 0.42;

    let letterIndex = DECORATIVE_LETTER_COUNT;

    TITLE_LINES.forEach((line, lineIndex) => {
      this.ctx!.font = `800 ${titleFontSize}px Inter, -apple-system, sans-serif`;
      const letterSpacing = titleFontSize * 0.06;
      const widths = line.split('').map(ch => this.ctx!.measureText(ch).width);
      const totalWidth = widths.reduce((sum, w) => sum + w, 0) + letterSpacing * (line.length - 1);

      let cursorX = this.canvasWidth / 2 - totalWidth / 2;
      const y = centerY + lineIndex * lineGap - (lineGap / 2);

      for (let i = 0; i < line.length; i++) {
        const letter = this.letters[letterIndex];
        if (letter) {
          letter.targetX = cursorX + widths[i] / 2;
          letter.targetY = y;
        }
        cursorX += widths[i] + letterSpacing;
        letterIndex++;
      }
    });
  }

  private loop = (now: number): void => {
    if (this.destroyed) {
      return;
    }
    if (!this.startTime) {
      this.startTime = now;
    }
    const elapsed = now - this.startTime;
    const dt = Math.min((now - (this.lastFrameTime || now)) / 1000, 0.05);
    this.lastFrameTime = now;

    if (elapsed < FALL_DURATION_MS) {
      this.updateFalling(elapsed, dt);
    } else {
      if (!this.assemblingStarted) {
        this.assemblingStarted = true;
        this.captureAssembleStart();
        this.phase.set('assembling');
      }
      const t = Math.min((elapsed - FALL_DURATION_MS) / ASSEMBLE_DURATION_MS, 1);
      this.updateAssembling(easeOutCubic(t));
    }

    this.render();

    if (elapsed < FALL_DURATION_MS + ASSEMBLE_DURATION_MS) {
      this.rafId = requestAnimationFrame(this.loop);
    } else {
      this.rafId = null;
      this.onAssembleComplete();
    }
  };

  private lastFrameTime = 0;

  private updateFalling(elapsed: number, dt: number): void {
    for (const letter of this.letters) {
      if (elapsed < letter.spawnAt) {
        continue;
      }

      letter.opacity = Math.min(letter.opacity + dt * 4, 1);

      if (letter.settled) {
        continue;
      }

      letter.vy += GRAVITY * dt;
      letter.y += letter.vy * dt;
      letter.x += letter.vx * dt;
      letter.rotation += letter.vrot * dt;

      if (letter.y >= letter.restY) {
        letter.y = letter.restY;

        if (letter.bounces < MAX_BOUNCES && Math.abs(letter.vy) > 30) {
          letter.vy *= -BOUNCE_DAMPING;
          letter.vx *= 0.6;
          letter.bounces++;
        } else {
          letter.settled = true;
          letter.vy = 0;
          letter.vx = 0;
          letter.vrot *= 0.4;
        }
      }
    }
  }

  private captureAssembleStart(): void {
    for (const letter of this.letters) {
      letter.tweenFromX = letter.x;
      letter.tweenFromY = letter.y;
      letter.tweenFromRotation = letter.rotation;
    }
  }

  private updateAssembling(t: number): void {
    const centerX = this.canvasWidth / 2;
    const centerY = this.canvasHeight * 0.42;

    for (const letter of this.letters) {
      if (letter.isTitleLetter) {
        letter.x = lerp(letter.tweenFromX, letter.targetX, t);
        letter.y = lerp(letter.tweenFromY, letter.targetY, t);
        letter.rotation = lerp(letter.tweenFromRotation, 0, t);
      } else {
        letter.x = lerp(letter.tweenFromX, centerX, t * 0.35);
        letter.y = lerp(letter.tweenFromY, centerY, t * 0.35);
        letter.opacity = Math.max(1 - t, 0) * letter.opacity;
      }
    }
  }

  private render(): void {
    if (!this.ctx) {
      return;
    }
    this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    for (const letter of this.letters) {
      if (letter.opacity <= 0.01) {
        continue;
      }
      this.ctx.save();
      this.ctx.translate(letter.x, letter.y);
      this.ctx.rotate(letter.rotation);
      this.ctx.globalAlpha = letter.opacity;
      this.ctx.font = `700 ${letter.size}px Inter, -apple-system, sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.shadowColor = HUE_COLORS[letter.hue];
      this.ctx.shadowBlur = letter.isTitleLetter ? 18 : 10;
      this.ctx.fillStyle = HUE_COLORS[letter.hue];
      this.ctx.fillText(letter.char, 0, 0);
      this.ctx.restore();
    }
  }

  private onAssembleComplete(): void {
    this.phase.set('title');
    this.schedule(() => this.phase.set('package'), 500);
    this.schedule(() => this.phase.set('route'), 1000);
    this.schedule(() => this.phase.set('truck'), 1650);
    this.schedule(() => this.phase.set('exit'), 3100);
    this.schedule(() => this.phase.set('fadeout'), 3700);
    this.schedule(() => this.finish(), 4350);
  }

  private runReducedMotionSequence(): void {
    this.phase.set('title');
    this.schedule(() => this.phase.set('package'), 150);
    this.schedule(() => this.phase.set('route'), 300);
    this.schedule(() => this.phase.set('truck'), 450);
    this.schedule(() => this.phase.set('exit'), 900);
    this.schedule(() => this.phase.set('fadeout'), 1150);
    this.schedule(() => this.finish(), 1500);
  }

  private schedule(fn: () => void, delayMs: number): void {
    this.timeoutIds.push(setTimeout(fn, delayMs));
  }

  private finish(): void {
    sessionStorage.setItem(SPLASH_SHOWN_KEY, 'true');
    this.router.navigateByUrl('/login');
  }

}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}