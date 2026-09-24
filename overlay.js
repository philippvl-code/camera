// Places the text overlay on the video: centred, or anchored above a tracked head.
// Head positions arrive in normalised video coordinates (0..1) so they map onto any
// screen size; this converts them through the video's object-fit: cover crop.
window.createOverlay = function (el, video) {
  const stage = el.parentElement;
  let target = null;
  let cur = null;

  function toStage(p) {
    const W = stage.clientWidth, H = stage.clientHeight;
    const vw = video.videoWidth || 16, vh = video.videoHeight || 9;
    const s = Math.max(W / vw, H / vh);
    return {
      x: p.x * vw * s + (W - vw * s) / 2,
      y: p.y * vh * s + (H - vh * s) / 2,
      a: p.a || 0,
    };
  }

  function frame() {
    if (target) {
      const t = toStage(target);
      // Ease towards the latest position so 15 Hz updates look smooth.
      cur = cur
        ? { x: cur.x + (t.x - cur.x) * 0.35, y: cur.y + (t.y - cur.y) * 0.35, a: cur.a + (t.a - cur.a) * 0.35 }
        : t;
      el.style.transform = `translate(${cur.x}px, ${cur.y}px) translate(-50%, -100%) rotate(${cur.a}rad)`;
    } else {
      cur = null;
      el.style.transform = `translate(${stage.clientWidth / 2}px, ${stage.clientHeight / 2}px) translate(-50%, -50%)`;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    setTarget(p) { target = p; },
  };
};
