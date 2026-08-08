# Exercise module — integration note

1. Mount: `import { ExerciseTracker } from "./exercise";` then `<ExerciseTracker exercise="squat" onRepsChange={(n) => ...} />` (exercise: `"squat" | "jumping_jack"`).
2. Or use the hook directly: `usePoseRepCounter(exercise)` returns `{ state, reps, start, stop, videoRef, feedback }` — attach `videoRef` to your own `<video playsInline muted>`.
3. Models are vendored: `/public/models/pose_landmarker_lite.task` + `/public/models/wasm/*` must be served at `/models/...` (Vite public dir does this automatically) — no CDN at runtime.
4. `@mediapipe/tasks-vision` is dynamically imported inside `start()`, so the main bundle is unaffected; camera + model only load after the user clicks Start.
5. Requires HTTPS or localhost for `getUserMedia`; `state === "denied"` renders retry instructions automatically in `ExerciseTracker`.
