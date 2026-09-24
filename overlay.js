// Draws the text overlay on the video. With no tracked heads it shows one centred label;
// with heads it puts a label above each one, sized and turned in 3D to match that head.
// Head data is in normalised video coordinates so it maps onto any screen size.
(function () {
  const DEPTH_LAYERS = 14;
  const DEPTH_STEP_EM = 0.018;
  const EASE = 0.35;

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${((n >> 16) & 255) * f | 0}, ${((n >> 8) & 255) * f | 0}, ${(n & 255) * f | 0})`;
  }

  window.createOverlay = function (container, video) {
    const stage = container.parentElement;
    let style = { text: "", size: 8, color: "#ffffff", visible: true, depth: false };
    let heads = null;
    let active = true;
    const labels = [];

    // A label is the front text plus, in 3D mode, darker copies pushed back along z.
    function fill(label) {
      label.el.replaceChildren();
      const n = style.depth ? DEPTH_LAYERS : 0;
      for (let i = n; i >= 0; i--) {
        const span = document.createElement("span");
        span.textContent = style.text;
        span.style.color = i ? shade(style.color, 0.7 - 0.4 * (i / n)) : style.color;
        if (i) {
          span.className = "back";
          span.style.transform = `translateZ(${-i * DEPTH_STEP_EM}em)`;
        }
        label.el.appendChild(span);
      }
    }

    function addLabel() {
      const el = document.createElement("div");
      el.className = "overlay";
      container.appendChild(el);
      const label = { el, cur: null };
      fill(label);
      labels.push(label);
    }

    function toStage(h, W, H) {
      const vw = video.videoWidth || 16, vh = video.videoHeight || 9;
      const s = Math.max(W / vw, H / vh);
      return {
        x: h.x * vw * s + (W - vw * s) / 2,
        y: h.y * vh * s + (H - vh * s) / 2,
        f: h.s * vh * s,
        m: h.m,
      };
    }

    // Keep each label on the same person between frames by pairing with the nearest head.
    function match(targets) {
      const out = labels.map(() => -1);
      const free = new Set(targets.map((_, i) => i));
      labels.forEach((l, li) => {
        if (!l.cur || !targets[0]) return;
        let best = -1, bestD = Infinity;
        free.forEach(i => {
          const d = Math.hypot(targets[i].x - l.cur.x, targets[i].y - l.cur.y);
          if (d < bestD) { bestD = d; best = i; }
        });
        if (best >= 0) { out[li] = best; free.delete(best); }
      });
      labels.forEach((_, li) => {
        if (out[li] < 0) { out[li] = free.values().next().value; free.delete(out[li]); }
      });
      return out;
    }

    function frame() {
      container.hidden = !style.visible || !active;
      const W = stage.clientWidth, H = stage.clientHeight;
      const targets = heads && heads.length ? heads.map(h => toStage(h, W, H)) : [null];
      while (labels.length < targets.length) addLabel();
      while (labels.length > targets.length) labels.pop().el.remove();

      const pairs = match(targets);
      labels.forEach((l, li) => {
        const t = targets[pairs[li]];
        if (!t) {
          l.cur = null;
          l.el.style.fontSize = style.size + "cqw";
          l.el.style.transform = `translate(${W / 2}px, ${H / 2}px) translate(-50%, -50%)` +
            (style.depth ? " perspective(40em) rotateX(16deg) rotateY(-24deg)" : "");
          return;
        }
        if (!l.cur) {
          l.cur = { x: t.x, y: t.y, f: t.f, m: t.m.slice() };
        } else {
          l.cur.x += (t.x - l.cur.x) * EASE;
          l.cur.y += (t.y - l.cur.y) * EASE;
          l.cur.f += (t.f - l.cur.f) * EASE;
          for (let i = 0; i < 9; i++) l.cur.m[i] += (t.m[i] - l.cur.m[i]) * EASE;
        }
        const m = l.cur.m; // columns: head's right, down and forward axes
        const px = l.cur.f * style.size / 16;
        l.el.style.fontSize = px + "px";
        l.el.style.transform =
          `translate(${l.cur.x}px, ${l.cur.y}px) translate(-50%, -100%) perspective(${px * 25}px) ` +
          `matrix3d(${m[0]},${m[1]},${m[2]},0,${m[3]},${m[4]},${m[5]},0,${m[6]},${m[7]},${m[8]},0,0,0,0,1)`;
      });
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    return {
      setStyle(s) {
        const refill = s.text !== style.text || s.color !== style.color || !!s.depth !== !!style.depth;
        style = { ...style, ...s };
        if (refill) labels.forEach(fill);
      },
      setHeads(h) { heads = h; },
      setActive(a) { active = a; },
    };
  };
})();
