import { useCallback, useEffect, useRef, useState } from "react";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import { createDetector, type ExerciseKind } from "./detectors";

export type TrackerState = "idle" | "loading" | "tracking" | "denied" | "error";

export interface PoseRepCounter {
  state: TrackerState;
  reps: number;
  start: () => Promise<void>;
  stop: () => void;
  videoRef: React.RefObject<HTMLVideoElement>;
  feedback: string;
}

const WASM_PATH = "/models/wasm";
const MODEL_PATH = "/models/pose_landmarker_lite.task";

/**
 * Webcam rep counter backed by MediaPipe Pose (vendored under /public/models,
 * no CDN at runtime). The heavy @mediapipe/tasks-vision bundle is loaded via
 * dynamic import inside start(), so it stays out of the main chunk.
 */
export function usePoseRepCounter(exercise: ExerciseKind): PoseRepCounter {
  const [state, setState] = useState<TrackerState>("idle");
  const [reps, setReps] = useState(0);
  const [feedback, setFeedback] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);

  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const runningRef = useRef(false);
  const repsRef = useRef(0);
  const lastVideoTimeRef = useRef(-1);
  const detectorRef = useRef(createDetector(exercise));

  // Swap the FSM (and reset counts) when the exercise changes.
  useEffect(() => {
    detectorRef.current = createDetector(exercise);
    repsRef.current = 0;
    setReps(0);
    setFeedback("");
  }, [exercise]);

  const stop = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    lastVideoTimeRef.current = -1;
    setState("idle");
  }, []);

  const start = useCallback(async () => {
    if (runningRef.current) return;
    setState("loading");
    setFeedback("");

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
      const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
      const makeOptions = (delegate: "GPU" | "CPU") => ({
        baseOptions: { modelAssetPath: MODEL_PATH, delegate },
        runningMode: "VIDEO" as const,
        numPoses: 1,
      });
      try {
        landmarkerRef.current = await PoseLandmarker.createFromOptions(fileset, makeOptions("GPU"));
      } catch {
        landmarkerRef.current = await PoseLandmarker.createFromOptions(fileset, makeOptions("CPU"));
      }

      const video = videoRef.current;
      if (!video) throw new Error("video element not mounted");
      video.srcObject = stream;
      await video.play();
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      setState("error");
      return;
    }

    runningRef.current = true;
    setState("tracking");
    setFeedback("Get in frame");

    const tick = () => {
      if (!runningRef.current) return;
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;
      if (
        video &&
        landmarker &&
        video.readyState >= 2 &&
        video.currentTime !== lastVideoTimeRef.current
      ) {
        lastVideoTimeRef.current = video.currentTime;
        const now = performance.now();
        const result = landmarker.detectForVideo(video, now);
        const pose = result.landmarks[0];
        const world = result.worldLandmarks[0];
        if (!pose || !world) {
          setFeedback("Get in frame");
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
          if (!u.inFrame) {
            setFeedback("Get in frame");
          } else if (u.cue) {
            setFeedback(u.cue);
          } else if (repsRef.current > 0) {
            setFeedback(`Nice — ${repsRef.current} reps`);
          } else {
            setFeedback("Ready when you are");
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // Tear everything down on unmount.
  useEffect(() => stop, [stop]);

  return { state, reps, start, stop, videoRef, feedback };
}
