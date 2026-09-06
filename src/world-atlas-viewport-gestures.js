(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessWorldAtlasViewportGestures = api;
  if (root && root.document) api.install(root.document, root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createWorldAtlasViewportGestures() {
  "use strict";

  const MIN_SCALE = 1;
  const MAX_SCALE = 4;
  const DRAG_THRESHOLD_PX = 5;
  const CLICK_SUPPRESS_MS = 320;
  const OVERLAY_SELECTOR = ".world-atlas-nearby-caption, .world-atlas-next-actions";

  function clamp(value, min, max) {
    const result = Math.max(min, Math.min(max, Number(value) || 0));
    return Object.is(result, -0) ? 0 : result;
  }

  function distance(left, right) {
    return Math.hypot(right.x - left.x, right.y - left.y);
  }

  function midpoint(left, right) {
    return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
  }

  function clampTransform(transform, viewport) {
    const width = Math.max(0, Number(viewport && viewport.width) || 0);
    const height = Math.max(0, Number(viewport && viewport.height) || 0);
    const scale = clamp(transform && transform.scale, MIN_SCALE, MAX_SCALE);
    const maxX = width * (scale - 1) / 2;
    const maxY = height * (scale - 1) / 2;
    return {
      scale,
      x: clamp(transform && transform.x, -maxX, maxX),
      y: clamp(transform && transform.y, -maxY, maxY)
    };
  }

  function pinchTransform(start, current, viewport) {
    const safeStartDistance = Math.max(1, Number(start && start.distance) || 1);
    const safeCurrentDistance = Math.max(1, Number(current && current.distance) || 1);
    const startScale = clamp(start && start.scale, MIN_SCALE, MAX_SCALE);
    const scale = clamp(startScale * (safeCurrentDistance / safeStartDistance), MIN_SCALE, MAX_SCALE);
    const width = Math.max(0, Number(viewport && viewport.width) || 0);
    const height = Math.max(0, Number(viewport && viewport.height) || 0);
    const centreX = width / 2;
    const centreY = height / 2;
    const startMid = start && start.midpoint ? start.midpoint : { x: centreX, y: centreY };
    const currentMid = current && current.midpoint ? current.midpoint : startMid;
    const startX = Number(start && start.x) || 0;
    const startY = Number(start && start.y) || 0;
    const localX = (startMid.x - centreX - startX) / startScale;
    const localY = (startMid.y - centreY - startY) / startScale;

    return clampTransform({
      scale,
      x: currentMid.x - centreX - localX * scale,
      y: currentMid.y - centreY - localY * scale
    }, viewport);
  }

  function installStyles(document) {
    if (!document || document.getElementById("world-atlas-viewport-gesture-styles")) return;
    const style = document.createElement("style");
    style.id = "world-atlas-viewport-gesture-styles";
    style.textContent = `
      .world-atlas-map.world-atlas-map--interactive {
        touch-action:none;
        overscroll-behavior:contain;
        cursor:grab;
      }
      .world-atlas-map.world-atlas-map--interactive.is-interacting { cursor:grabbing; }
      .world-atlas-panzoom-content {
        position:absolute;
        inset:0;
        transform-origin:50% 50%;
        will-change:transform;
      }
    `;
    document.head.appendChild(style);
  }

  function isFixedOverlay(node) {
    return Boolean(node && node.nodeType === 1 && typeof node.matches === "function" && node.matches(OVERLAY_SELECTOR));
  }

  function mapViewport(map) {
    const rect = map.getBoundingClientRect ? map.getBoundingClientRect() : null;
    return {
      width: Math.max(0, Number(rect && rect.width) || Number(map.clientWidth) || 0),
      height: Math.max(0, Number(rect && rect.height) || Number(map.clientHeight) || 0)
    };
  }

  function mapPoint(map, event) {
    const rect = map.getBoundingClientRect ? map.getBoundingClientRect() : { left: 0, top: 0 };
    return {
      x: Number(event.clientX) - (Number(rect.left) || 0),
      y: Number(event.clientY) - (Number(rect.top) || 0)
    };
  }

  function ensurePanzoomContent(document, map) {
    let content = Array.from(map.children || []).find((child) => child.classList && child.classList.contains("world-atlas-panzoom-content"));
    if (!content) {
      content = document.createElement("div");
      content.className = "world-atlas-panzoom-content";
      map.prepend(content);
    }

    Array.from(map.childNodes || []).forEach((node) => {
      if (node === content || isFixedOverlay(node)) return;
      content.appendChild(node);
    });
    return content;
  }

  function createController(document, root, map) {
    const content = ensurePanzoomContent(document, map);
    const pointers = new Map();
    let transform = { scale: MIN_SCALE, x: 0, y: 0 };
    let gesture = null;
    let gestureMoved = false;
    let suppressClickUntil = 0;
    let destroyed = false;

    map.classList.add("world-atlas-map--interactive");
    map.setAttribute("aria-description", "1本指で地図を移動し、2本指のピンチで拡大・縮小できます。");

    function render() {
      transform = clampTransform(transform, mapViewport(map));
      content.style.transform = `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`;
      map.dataset.atlasScale = transform.scale.toFixed(2);
    }

    function firstTwoPointers() {
      return Array.from(pointers.values()).slice(0, 2);
    }

    function beginPan(point) {
      gesture = {
        type: "pan",
        startPoint: point,
        x: transform.x,
        y: transform.y
      };
    }

    function beginPinch() {
      const [left, right] = firstTwoPointers();
      if (!left || !right) return;
      gesture = {
        type: "pinch",
        distance: Math.max(1, distance(left, right)),
        midpoint: midpoint(left, right),
        scale: transform.scale,
        x: transform.x,
        y: transform.y
      };
      gestureMoved = true;
      map.classList.add("is-interacting");
    }

    function onPointerDown(event) {
      if (destroyed || (event.pointerType === "mouse" && event.button !== 0)) return;
      const point = mapPoint(map, event);
      pointers.set(event.pointerId, point);
      try { map.setPointerCapture(event.pointerId); } catch (_) {}
      if (pointers.size >= 2) beginPinch();
      else beginPan(point);
    }

    function onPointerMove(event) {
      if (!pointers.has(event.pointerId) || destroyed) return;
      const point = mapPoint(map, event);
      pointers.set(event.pointerId, point);

      if (pointers.size >= 2) {
        if (!gesture || gesture.type !== "pinch") beginPinch();
        const [left, right] = firstTwoPointers();
        transform = pinchTransform(gesture, {
          distance: distance(left, right),
          midpoint: midpoint(left, right)
        }, mapViewport(map));
        gestureMoved = true;
        event.preventDefault();
        render();
        return;
      }

      if (!gesture || gesture.type !== "pan") beginPan(point);
      const dx = point.x - gesture.startPoint.x;
      const dy = point.y - gesture.startPoint.y;
      const next = clampTransform({
        scale: transform.scale,
        x: gesture.x + dx,
        y: gesture.y + dy
      }, mapViewport(map));
      const changed = Math.abs(next.x - transform.x) > 0.1 || Math.abs(next.y - transform.y) > 0.1;
      transform = next;
      if (changed) {
        if (Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) gestureMoved = true;
        map.classList.add("is-interacting");
        event.preventDefault();
        render();
      }
    }

    function finishPointer(event) {
      if (!pointers.has(event.pointerId) || destroyed) return;
      pointers.delete(event.pointerId);
      try { map.releasePointerCapture(event.pointerId); } catch (_) {}

      if (pointers.size >= 2) {
        beginPinch();
        return;
      }
      if (pointers.size === 1) {
        beginPan(Array.from(pointers.values())[0]);
        return;
      }

      if (gestureMoved) suppressClickUntil = Date.now() + CLICK_SUPPRESS_MS;
      gesture = null;
      gestureMoved = false;
      map.classList.remove("is-interacting");
    }

    function onClick(event) {
      if (Date.now() >= suppressClickUntil) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }

    function onResize() {
      if (!destroyed) render();
    }

    const childObserver = typeof root.MutationObserver === "function"
      ? new root.MutationObserver((records) => {
        records.forEach((record) => Array.from(record.addedNodes || []).forEach((node) => {
          if (node === content || node.parentNode !== map || isFixedOverlay(node)) return;
          content.appendChild(node);
        }));
      })
      : null;
    childObserver?.observe(map, { childList: true });

    const resizeObserver = typeof root.ResizeObserver === "function" ? new root.ResizeObserver(onResize) : null;
    if (resizeObserver) resizeObserver.observe(map);
    else root.addEventListener?.("resize", onResize);

    map.addEventListener("pointerdown", onPointerDown, { passive: true });
    map.addEventListener("pointermove", onPointerMove, { passive: false });
    map.addEventListener("pointerup", finishPointer, { passive: true });
    map.addEventListener("pointercancel", finishPointer, { passive: true });
    map.addEventListener("click", onClick, true);
    render();

    return {
      map,
      get transform() { return { ...transform }; },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        childObserver?.disconnect();
        resizeObserver?.disconnect();
        if (!resizeObserver) root.removeEventListener?.("resize", onResize);
        map.removeEventListener("pointerdown", onPointerDown);
        map.removeEventListener("pointermove", onPointerMove);
        map.removeEventListener("pointerup", finishPointer);
        map.removeEventListener("pointercancel", finishPointer);
        map.removeEventListener("click", onClick, true);
      }
    };
  }

  function install(document, root) {
    if (!document || !document.body || !root) return false;
    if (document.__crownlessAtlasViewportGesturesInstalled) return true;
    document.__crownlessAtlasViewportGesturesInstalled = true;
    installStyles(document);

    const controllers = new Set();
    const knownMaps = new WeakSet();

    function scan() {
      controllers.forEach((controller) => {
        if (!controller.map.isConnected) {
          controller.destroy();
          controllers.delete(controller);
        }
      });
      document.querySelectorAll(".world-atlas-map").forEach((map) => {
        if (knownMaps.has(map)) return;
        knownMaps.add(map);
        controllers.add(createController(document, root, map));
      });
    }

    scan();
    if (typeof root.MutationObserver === "function") {
      const observer = new root.MutationObserver(scan);
      observer.observe(document.body, { childList: true, subtree: true });
      document.__crownlessAtlasViewportGesturesObserver = observer;
    }
    return true;
  }

  return {
    MIN_SCALE,
    MAX_SCALE,
    clampTransform,
    pinchTransform,
    install
  };
});
