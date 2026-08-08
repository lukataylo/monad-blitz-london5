import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DrawingUtils,
  Landmark,
  NormalizedLandmark,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";
import { createDetector, type ExerciseKind } from "./detectors";

export type TrackerState = "idle" | "loading" | "tracking" | "denied" | "error";

export interface PoseRepCounter {
  state: TrackerState;
  reps: number;
  start: () => Promise<void>;
  stop: () => void;
  videoRef: React.RefObject<HTMLVideoElement>;
  /** Overlay canvas — pose skeleton is drawn here every processed frame. */
  canvasRef: React.RefObject<HTMLCanvasElement>;
  feedback: string;
  /** Live measurement readout ("Knee 132°" / "Arms up · feet wide"). */
  debug: string;
}

const WASM_PATH = "/models/wasm";
const MODEL_PATH = "/models/pose_landmarker_lite.task";

/** No pose for this long while tracking -> "step back" cue. */
const NO_POSE_TIMEOUT_MS = 2000;

/* Overlay palette (matches exercise.css) */
const SKELETON_COLOR = "#D9E856"; // lime connections
const JOINT_COLOR = "#111111"; // ink dots
const SQUAT_JOINT_COLOR = "#F373AC"; // pink hip/knee/ankle highlight
/* hip, knee, ankle — the joints that decide a squat */
const SQUAT_JOINTS = [23, 24, 25, 26, 27, 28];

/**
 * Webcam rep counter backed by MediaPipe Pose (vendored under /public/models,
 * no CDN at runtime). The heavy @mediapipe/tasks-vision bundle is loaded via
 * dynamic import inside start(), so it stays out of the main chunk.
 */
export function usePoseRepCounter(exercise: ExerciseKind): PoseRepCounter {
  const [state, setState] = useState<TrackerState>("idle");
  const [reps, setReps] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [debug, setDebug] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const drawingUtilsRef = useRef<DrawingUtils | null>(null);
  const poseConnectionsRef = useRef<
    { start: number; end: number }[] | null
  >(null);
  /** Rebuilds the landmarker with the given delegate (set in start()). */
  const createLandmarkerRef = useRef<
    ((delegate: "GPU" | "CPU") => Promise<PoseLandmarker>) | null
  >(null);
  const delegateRef = useRef<"GPU" | "CPU">("GPU");
  const rebuildingRef = useRef(false);

  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const runningRef = useRef(false);
  const repsRef = useRef(0);
  const lastVideoTimeRef = useRef(-1);
  const lastPoseAtRef = useRef(0);
  const detectorRef = useRef(createDetector(exercise));

  // Swap the FSM (and reset counts) when the exercise changes.
  useEffect(() => {
    detectorRef.current = createDetector(exercise);
    repsRef.current = 0;
    setReps(0);
    setFeedback("");
    setDebug("");
  }, [exercise]);

  const stop = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    drawingUtilsRef.current?.close();
    drawingUtilsRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    }
    lastVideoTimeRef.current = -1;
    setDebug("");
    setState("idle");
  }, []);

  const start = useCallback(async () => {
    if (runningRef.current) return;
    setState("loading");
    setFeedback("");
    setDebug("");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      setState(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "error");
      return;
    }
    streamRef.current = stream;

    try {
      // Lazy-load MediaPipe so it never lands in the main bundle.
      const vision = await import("@mediapipe/tasks-vision");
      const { FilesetResolver, PoseLandmarker } = vision;
      const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
      poseConnectionsRef.current = PoseLandmarker.POSE_CONNECTIONS;
      createLandmarkerRef.current = (delegate: "GPU" | "CPU") =>
        PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_PATH, delegate },
          runningMode: "VIDEO" as const,
          numPoses: 1,
        });
      // GPU first; some devices/browsers reject the GPU delegate -> retry CPU.
      try {
        landmarkerRef.current = await createLandmarkerRef.current("GPU");
        delegateRef.current = "GPU";
      } catch {
        landmarkerRef.current = await createLandmarkerRef.current("CPU");
        delegateRef.current = "CPU";
      }

      const video = videoRef.current;
      if (!video) throw new Error("video element not mounted");
      video.srcObject = stream;
      await video.play();

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (ctx) {
        drawingUtilsRef.current = new vision.DrawingUtils(ctx);
      }
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      setState("error");
      return;
    }

    runningRef.current = true;
    lastPoseAtRef.current = performance.now();
    setState("tracking");
    setFeedback("Get in frame");

    /** GPU inference blew up mid-loop — rebuild once on CPU and carry on. */
    const fallBackToCpu = () => {
      if (rebuildingRef.current || delegateRef.current === "CPU") return;
      rebuildingRef.current = true;
      const broken = landmarkerRef.current;
      landmarkerRef.current = null;
      void (async () => {
        try {
          broken?.close();
        } catch {
          /* already dead */
        }
        try {
          const cpu = await createLandmarkerRef.current?.("CPU");
          if (!runningRef.current) {
            cpu?.close();
            return;
          }
          landmarkerRef.current = cpu ?? null;
          delegateRef.current = "CPU";
          lastVideoTimeRef.current = -1;
        } catch {
          if (runningRef.current) {
            runningRef.current = false;
            setState("error");
          }
        } finally {
          rebuildingRef.current = false;
        }
      })();
    };

    const drawOverlay = (pose: NormalizedLandmark[] | undefined) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const du = drawingUtilsRef.current;
      if (!video || !canvas) return;
      // Match the video's pixel grid, upscaled for devicePixelRatio sharpness.
      // The element itself mirrors + object-fit:covers exactly like the video.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(video.videoWidth * dpr);
      const h = Math.round(video.videoHeight * dpr);
      if (w === 0 || h === 0) return;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      if (!pose || !du || !poseConnectionsRef.current) return;
      du.drawConnectors(pose, poseConnectionsRef.current, {
        color: SKELETON_COLOR,
        lineWidth: 2.5 * dpr,
      });
      du.drawLandmarks(pose, {
        color: JOINT_COLOR,
        fillColor: JOINT_COLOR,
        lineWidth: 1,
        radius: 3 * dpr,
      });
      if (detectorRef.current.kind === "squat") {
        // Highlight the joints that decide the rep: hip-knee-ankle.
        const joints = SQUAT_JOINTS.map((i) => pose[i]).filter(
          (lm): lm is NormalizedLandmark => lm != null
        );
        du.drawLandmarks(joints, {
          color: JOINT_COLOR,
          fillColor: SQUAT_JOINT_COLOR,
          lineWidth: 1.5 * dpr,
          radius: 5 * dpr,
        });
      }
    };

    const tick = () => {
      if (!runningRef.current) return;
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;
      if (
        video &&
        landmarker &&
        !rebuildingRef.current &&
        video.readyState >= 2 &&
        video.currentTime !== lastVideoTimeRef.current
      ) {
        lastVideoTimeRef.current = video.currentTime;
        const now = performance.now();
        let pose: NormalizedLandmark[] | undefined;
        let world: Landmark[] | undefined;
        let detectFailed = false;
        try {
          const result = landmarker.detectForVideo(video, now);
          pose = result.landmarks[0];
          world = result.worldLandmarks[0];
        } catch {
          detectFailed = true;
          fallBackToCpu();
        }

        if (!detectFailed) {
          drawOverlay(pose);
          if (!pose || !world) {
            setDebug("");
            setFeedback(
              now - lastPoseAtRef.current > NO_POSE_TIMEOUT_MS
                ? "Step back so your whole body is in frame"
                : "Get in frame"
            );
          } else {
            const u = detectorRef.current.update({
              landmarks: pose,
              worldLandmarks: world,
              timeMs: now,
            });
            if (u.repCompleted) {
              repsRef.current += 1;
              setReps(repsRef.current);
            }
            setDebug(u.debug ?? "");
            if (u.inFrame) lastPoseAtRef.current = now;
            if (!u.inFrame) {
              setFeedback(
                now - lastPoseAtRef.current > NO_POSE_TIMEOUT_MS
                  ? "Step back so your whole body is in frame"
                  : "Get in frame"
              );
            } else if (u.cue) {
              setFeedback(u.cue);
            } else if (repsRef.current > 0) {
              setFeedback(`Nice — ${repsRef.current} reps`);
            } else {
              setFeedback("Ready when you are");
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // Tear everything down on unmount.
  useEffect(() => stop, [stop]);

  return { state, reps, start, stop, videoRef, canvasRef, feedback, debug };
}
