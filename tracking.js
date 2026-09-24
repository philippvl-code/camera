// Face tracking for the broadcaster. Finds up to MAX_FACES faces with MediaPipe and, for
// each, works out a point just above the head, its size, and which way it is facing.
// Results go to window.onHeads as a list of { x, y, s, m } (see headPose).
import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

const video = document.getElementById("video");
const trackStatus = document.getElementById("trackStatus");

const MAX_FACES = 6;
// MediaPipe face mesh landmark indices.
const EYE_OUTER_R = 33, EYE_OUTER_L = 263, FOREHEAD = 10, CHIN = 152;

let landmarker = null;
let lastVideoTime = -1;

async function init() {
  trackStatus.textContent = "Loading face tracker…";
  try {
    const fileset = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );
    landmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numFaces: MAX_FACES,
    });
    trackStatus.textContent = "Face tracker ready";
  } catch (e) {
    trackStatus.textContent = "Face tracker failed to load";
    console.error(e);
    return;
  }
  requestAnimationFrame(loop);
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const norm = a => scale(a, 1 / Math.hypot(...a));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const r3 = v => Math.round(v * 1000) / 1000;

// x, y: anchor just above the head (0..1 of the video frame)
// s: forehead-to-chin length as a fraction of the video height (sets text size)
// m: head rotation as a 3x3 matrix, column-major, in CSS axes (x right, y down, z to viewer)
function headPose(lm, height) {
  const vw = video.videoWidth, vh = video.videoHeight;
  // Landmark z has roughly x's scale and grows away from the camera; CSS z points at the viewer.
  const p = i => [lm[i].x * vw, lm[i].y * vh, -lm[i].z * vw];
  const eyeR = p(EYE_OUTER_R), eyeL = p(EYE_OUTER_L), top = p(FOREHEAD), chin = p(CHIN);

  const ex = norm(sub(eyeL, eyeR));
  let ey = sub(chin, top);
  ey = norm(sub(ey, scale(ex, dot(ey, ex))));
  const ez = cross(ex, ey);
  const faceH = Math.hypot(...sub(chin, top));

  // Step up from the top of the forehead along the head's own "up", so tilts are followed.
  const up2d = Math.hypot(ey[0], ey[1]) || 1;
  const lift = faceH * height;
  const x = top[0] - (ey[0] / up2d) * lift;
  const y = top[1] - (ey[1] / up2d) * lift;

  return {
    x: r3(x / vw),
    y: r3(y / vh),
    s: r3(faceH / vh),
    m: [...ex, ...ey, ...ez].map(r3),
  };
}

function loop() {
  if (video.srcObject && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const res = landmarker.detectForVideo(video, performance.now());
    const faces = res.faceLandmarks || [];
    const height = window.headLift ? window.headLift() : 0.15;
    const heads = faces.map(f => headPose(f, height));
    trackStatus.textContent = heads.length
      ? `Tracking ${heads.length} ${heads.length === 1 ? "head" : "heads"}`
      : "No face found – text is centred";
    window.onHeads && window.onHeads(heads);
  }
  requestAnimationFrame(loop);
}

init();
