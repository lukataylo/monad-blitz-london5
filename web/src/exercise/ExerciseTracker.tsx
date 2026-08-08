import { useEffect } from "react";
import { usePoseRepCounter } from "./usePoseRepCounter";
import type { ExerciseKind } from "./detectors";
import "./exercise.css";

const LABELS: Record<ExerciseKind, string> = {
  squat: "Squats",
  jumping_jack: "Jumping jacks",
};

export interface ExerciseTrackerProps {
  exercise: ExerciseKind;
  onRepsChange?: (reps: number) => void;
  /**
   * Hero mode (kind-1 leaderboard): taller stage, bigger rep counter, and a
   * prominent centered "Start camera 🎥" pill when the camera is off.
   */
  hero?: boolean;
  /** Caption under the hero camera-off pill, e.g. how reps sync on-chain. */
  offCaption?: string;
}

export function ExerciseTracker({
  exercise,
  onRepsChange,
  hero = false,
  offCaption,
}: ExerciseTrackerProps) {
  const { state, reps, start, stop, videoRef, feedback } = usePoseRepCounter(exercise);

  useEffect(() => {
    onRepsChange?.(reps);
  }, [reps, onRepsChange]);

  const live = state === "tracking";
  const busy = state === "loading";
  // Hero off-state: the start CTA lives centered in the stage itself.
  const stagePill = hero && !live && state !== "denied";

  return (
    <div className={hero ? "ex-card ex-card--hero" : "ex-card"}>
      <div className="ex-stage">
        <video
          ref={videoRef}
          className="ex-video"
          playsInline
          muted
          data-live={live || undefined}
        />

        {!live && (
          <div className="ex-placeholder">
            {state === "denied" ? (
              <div className="ex-denied">
                <span className="ex-caption">Camera blocked</span>
                <p className="ex-denied-text">
                  Enable camera access in your browser&apos;s site settings
                  (the icon by the address bar), then try again.
                </p>
              </div>
            ) : stagePill ? (
              <div className="ex-off">
                {state === "error" && (
                  <span className="ex-caption">Camera error — try again</span>
                )}
                <button
                  type="button"
                  className="ex-start-pill"
                  disabled={busy}
                  onClick={() => void start()}
                >
                  {busy ? "Starting…" : "Start camera 🎥"}
                </button>
                {offCaption && (
                  <p className="ex-off-caption">{offCaption}</p>
                )}
              </div>
            ) : (
              <span className="ex-caption">
                {busy
                  ? "Warming up camera…"
                  : state === "error"
                    ? "Camera error — try again"
                    : "Camera off"}
              </span>
            )}
          </div>
        )}

        {live && (
          <>
            <span className="ex-caption ex-badge">{LABELS[exercise]}</span>
            <div className="ex-counter">
              <span className="ex-reps">{reps}</span>
              <span className="ex-caption ex-reps-label">reps</span>
            </div>
          </>
        )}
      </div>

      {/* hero off-state puts the CTA in the stage — skip the empty footer */}
      {(!hero || live) && (
      <div className="ex-footer">
        <p className="ex-feedback">{live ? feedback : " "}</p>
        <button
          type="button"
          className="ex-btn"
          disabled={busy}
          onClick={() => (live ? stop() : void start())}
        >
          {live ? "Stop camera" : busy ? "Starting…" : "Start camera"}
        </button>
      </div>
      )}
    </div>
  );
}
