// Face tracking for the broadcaster. Finds the eyes and face with MediaPipe, works out
// a point just above the top of the head, and hands it to window.onHeadPosition.
import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

const video = document.getElementById("video");
const trackStatus = document.getElementById("trackStatus");

// MediaPipe face mesh landmark indices.
const EYE_OUTER_R = 33, EYE_OUTER_L = 263, FOREHEAD = 10, CHIN = 152;
// Distance from the eyes to just above the crown, as a fraction of forehead-to-chin.
const ABOVE_HEAD = 0.8;

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
      numFaces: 1,
    });
    trackStatus.textContent = "Face tracker ready";
  } catch (e) {
    trackStatus.textContent = "Face tracker failed to load";
    console.error(e);
    return;
  }
  requestAnimationFrame(loop);
}

function headPosition(lm) {
  const vw = video.videoWidth, vh = video.videoHeight;
  const px = i => ({ x: lm[i].x * vw, y: lm[i].y * vh });
  const r = px(EYE_OUTER_R), l = px(EYE_OUTER_L), top = px(FOREHEAD), chin = px(CHIN);
  const angle = Math.atan2(l.y - r.y, l.x - r.x);
  const faceH = Math.hypot(chin.x - top.x, chin.y - top.y);
  const mid = { x: (r.x + l.x) / 2, y: (r.y + l.y) / 2 };
  // "Up" is perpendicular to the line between the eyes, so the text follows head tilt.
  const up = { x: Math.sin(angle), y: -Math.cos(angle) };
  return {
    x: (mid.x + up.x * faceH * ABOVE_HEAD) / vw,
    y: (mid.y + up.y * faceH * ABOVE_HEAD) / vh,
    a: angle,
  };
}

function loop() {
  if (video.srcObject && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const res = landmarker.detectForVideo(video, performance.now());
    const face = res.faceLandmarks && res.faceLandmarks[0];
    const pos = face ? headPosition(face) : null;
    trackStatus.textContent = face ? "Tracking face" : "No face found – text is centred";
    window.onHeadPosition && window.onHeadPosition(pos);
  }
  requestAnimationFrame(loop);
}

init();
