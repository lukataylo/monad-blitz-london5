import type { Landmark, NormalizedLandmark } from "@mediapipe/tasks-vision";

export type ExerciseKind = "squat" | "jumping_jack";

/** One processed video frame worth of pose data for the primary detected person. */
export interface PoseFrame {
  /** Normalized image-space landmarks (x/y in 0..1, y grows downward). */
  landmarks: NormalizedLandmark[];
  /** Metric 3D world landmarks (meters, hip-centered). */
  worldLandmarks: Landmark[];
  /** Monotonic timestamp of the frame in ms (performance.now()). */
  timeMs: number;
}

export interface DetectionUpdate {
  /** True exactly once per completed rep. */
  repCompleted: boolean;
  /** False when required landmarks are missing / low visibility. */
  inFrame: boolean;
  /** Coaching cue for the current phase, or null when nothing specific to say. */
  cue: string | null;
}

/**
 * Per-exercise finite-state-machine. Stateless callers feed frames in,
 * the detector owns its phase state. Add new exercises by implementing
 * this interface and registering it in createDetector().
 */
export interface RepDetector {
  readonly kind: ExerciseKind;
  update(frame: PoseFrame): DetectionUpdate;
  reset(): void;
}

/* BlazePose landmark indices */
const NOSE = 0;
const L_SHOULDER = 11;
const R_SHOULDER = 12;
const L_WRIST = 15;
const R_WRIST = 16;
const L_HIP = 23;
const R_HIP = 24;
const L_KNEE = 25;
const R_KNEE = 26;
const L_ANKLE = 27;
const R_ANKLE = 28;

const MIN_VISIBILITY = 0.5;
const REP_DEBOUNCE_MS = 400;

/* Squat thresholds (knee angle: hip-knee-ankle, degrees) */
const SQUAT_STANDING_DEG = 160;
const SQUAT_BOTTOM_DEG = 100;

/* Jumping-jack thresholds (ankle separation relative to shoulder width) */
const JACK_OPEN_RATIO = 1.3;
const JACK_CLOSED_RATIO = 0.9;

interface Point3 {
  x: number;
  y: number;
  z: number;
}

/** Angle ABC at vertex B, in degrees, using 3D coordinates. */
function angleDeg(a: Point3, b: Point3, c: Point3): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const abz = a.z - b.z;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const cbz = c.z - b.z;
  const dot = abx * cbx + aby * cby + abz * cbz;
  const magAb = Math.hypot(abx, aby, abz);
  const magCb = Math.hypot(cbx, cby, cbz);
  if (magAb === 0 || magCb === 0) return 180;
  const cos = Math.min(1, Math.max(-1, dot / (magAb * magCb)));
  return (Math.acos(cos) * 180) / Math.PI;
}

function allVisible(landmarks: NormalizedLandmark[], indices: number[]): boolean {
  return indices.every((i) => {
    const lm = landmarks[i];
    return lm != null && (lm.visibility ?? 1) > MIN_VISIBILITY;
  });
}

const SQUAT_REQUIRED = [L_HIP, R_HIP, L_KNEE, R_KNEE, L_ANKLE, R_ANKLE];

class SquatDetector implements RepDetector {
  readonly kind: ExerciseKind = "squat";
  private phase: "up" | "down" = "up";
  private lastRepAt = -Infinity;

  update(frame: PoseFrame): DetectionUpdate {
    if (!allVisible(frame.landmarks, SQUAT_REQUIRED)) {
      return { repCompleted: false, inFrame: false, cue: null };
    }
    const w = frame.worldLandmarks;
    const left = angleDeg(w[L_HIP], w[L_KNEE], w[L_ANKLE]);
    const right = angleDeg(w[R_HIP], w[R_KNEE], w[R_ANKLE]);
    const knee = (left + right) / 2;

    let repCompleted = false;
    let cue: string | null = null;

    if (this.phase === "up") {
      if (knee < SQUAT_BOTTOM_DEG) {
        this.phase = "down";
      } else if (knee < SQUAT_STANDING_DEG) {
        cue = "Go lower!";
      }
    } else if (knee > SQUAT_STANDING_DEG) {
      // bottom -> standing transition = one rep (with debounce)
      this.phase = "up";
      if (frame.timeMs - this.lastRepAt > REP_DEBOUNCE_MS) {
        this.lastRepAt = frame.timeMs;
        repCompleted = true;
      }
    }
    return { repCompleted, inFrame: true, cue };
  }

  reset(): void {
    this.phase = "up";
    this.lastRepAt = -Infinity;
  }
}

const JACK_REQUIRED = [
  NOSE,
  L_SHOULDER,
  R_SHOULDER,
  L_WRIST,
  R_WRIST,
  L_ANKLE,
  R_ANKLE,
];

class JumpingJackDetector implements RepDetector {
  readonly kind: ExerciseKind = "jumping_jack";
  private phase: "closed" | "open" = "closed";
  private lastRepAt = -Infinity;

  update(frame: PoseFrame): DetectionUpdate {
    if (!allVisible(frame.landmarks, JACK_REQUIRED)) {
      return { repCompleted: false, inFrame: false, cue: null };
    }
    const lm = frame.landmarks;
    const shoulderWidth =
      Math.abs(lm[L_SHOULDER].x - lm[R_SHOULDER].x) || 0.001;
    const ankleSep = Math.abs(lm[L_ANKLE].x - lm[R_ANKLE].x);
    // y grows downward in normalized image space
    const wristsAboveHead =
      lm[L_WRIST].y < lm[NOSE].y && lm[R_WRIST].y < lm[NOSE].y;
    const wristsDown =
      lm[L_WRIST].y > lm[L_SHOULDER].y && lm[R_WRIST].y > lm[R_SHOULDER].y;
    const feetWide = ankleSep > shoulderWidth * JACK_OPEN_RATIO;
    const feetTogether = ankleSep < shoulderWidth * JACK_CLOSED_RATIO;

    let repCompleted = false;
    let cue: string | null = null;

    if (this.phase === "closed") {
      if (wristsAboveHead && feetWide) {
        this.phase = "open";
      } else if (feetWide && !wristsAboveHead) {
        cue = "Hands all the way up!";
      }
    } else if (wristsDown && feetTogether) {
      // open -> closed transition = one rep (with debounce)
      this.phase = "closed";
      if (frame.timeMs - this.lastRepAt > REP_DEBOUNCE_MS) {
        this.lastRepAt = frame.timeMs;
        repCompleted = true;
      }
    }
    return { repCompleted, inFrame: true, cue };
  }

  reset(): void {
    this.phase = "closed";
    this.lastRepAt = -Infinity;
  }
}

export function createDetector(kind: ExerciseKind): RepDetector {
  switch (kind) {
    case "squat":
      return new SquatDetector();
    case "jumping_jack":
      return new JumpingJackDetector();
  }
}
