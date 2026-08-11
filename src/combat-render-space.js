(() => {
  "use strict";

  const originalGetContext = HTMLCanvasElement.prototype.getContext;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function createArenaContextProxy(canvas, raw) {
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    let saveDepth = 0;
    let cameraStage = 0;
    let worldFrame = false;
    let worldFrameDepth = 0;
    let groundPass = false;
    let entityDepth = 0;
    let entityScale = 1;
    let actorMode = false;
    let actorFacingAngle = 0;
    let actorFlip = 1;
    let pendingRotate = null;
    let shakeX = 0;
    let shakeY = 0;

    const methods = new Map();

    function projection(x, y) {
      const t = clamp(y / height, 0, 1);
      const horizontal = 0.72 + t * 0.29;
      const vertical = 0.74;
      return {
        x: centerX + (x - centerX) * horizontal + shakeX,
        y: 72 + y * vertical + shakeY,
        scale: 0.78 + t * 0.28,
        horizontal
      };
    }

    function projectedRect(x, y, w, h) {
      const p1 = projection(x, y);
      const p2 = projection(x + w, y + h);
      return {
        x: p1.x,
        y: p1.y,
        w: p2.x - p1.x,
        h: p2.y - p1.y
      };
    }

    function flushPendingRotate() {
      if (pendingRotate === null) return;
      raw.rotate(pendingRotate);
      pendingRotate = null;
    }

    function beginProjectedEntity(x, y) {
      const point = projection(x, y);
      entityDepth = saveDepth;
      entityScale = point.scale;
      actorMode = false;
      actorFacingAngle = 0;
      actorFlip = 1;
      raw.translate(point.x, point.y);
      raw.scale(entityScale, entityScale);
    }

    function drawActorShadow() {
      raw.save();
      raw.globalAlpha *= 0.34;
      raw.fillStyle = "rgba(0, 0, 0, .78)";
      raw.beginPath();
      raw.ellipse(0, 26, 24, 7.5, 0, 0, Math.PI * 2);
      raw.fill();
      raw.restore();
    }

    function projectedActorRayPoint(x) {
      const dx = Math.cos(actorFacingAngle) * x;
      const dy = Math.sin(actorFacingAngle) * x * 0.42;
      return { x: dx / actorFlip, y: dy + 13 };
    }

    function isOuterCameraTranslate(x, y) {
      return saveDepth === 1
        && !worldFrame
        && Math.abs(x - centerX) < 90
        && Math.abs(y - centerY) < 90;
    }

    function isOuterCameraReset(x, y) {
      return cameraStage === 1
        && saveDepth === 1
        && Math.abs(x + centerX) < 4
        && Math.abs(y + centerY) < 4;
    }

    function isWorldPoint(x, y) {
      return worldFrame
        && entityDepth === 0
        && x >= -80
        && x <= width + 80
        && y >= -160
        && y <= height + 120;
    }

    const custom = {
      clearRect(x, y, w, h) {
        flushPendingRotate();
        if (x === 0 && y === 0 && w >= width && h >= height) {
          groundPass = true;
          cameraStage = 0;
          worldFrame = false;
          worldFrameDepth = 0;
          entityDepth = 0;
          actorMode = false;
          actorFacingAngle = 0;
          actorFlip = 1;
          shakeX = 0;
          shakeY = 0;
        }
        raw.clearRect(x, y, w, h);
      },

      save() {
        flushPendingRotate();
        raw.save();
        saveDepth += 1;
      },

      restore() {
        flushPendingRotate();
        const leavingEntity = entityDepth > 0 && saveDepth === entityDepth;
        const leavingWorld = worldFrame && saveDepth === worldFrameDepth;
        raw.restore();
        if (leavingEntity) {
          entityDepth = 0;
          entityScale = 1;
          actorMode = false;
          actorFacingAngle = 0;
          actorFlip = 1;
        }
        if (leavingWorld) {
          worldFrame = false;
          worldFrameDepth = 0;
          cameraStage = 0;
          shakeX = 0;
          shakeY = 0;
        }
        saveDepth = Math.max(0, saveDepth - 1);
      },

      translate(x, y) {
        flushPendingRotate();
        if (isOuterCameraTranslate(x, y)) {
          shakeX = x - centerX;
          shakeY = y - centerY;
          groundPass = false;
          cameraStage = 1;
          return;
        }
        if (isOuterCameraReset(x, y)) {
          worldFrame = true;
          worldFrameDepth = saveDepth;
          cameraStage = 2;
          return;
        }
        if (entityDepth > 0) {
          raw.translate(x, y);
          return;
        }
        if (isWorldPoint(x, y)) {
          beginProjectedEntity(x, y);
          return;
        }
        raw.translate(x, y);
      },

      scale(x, y) {
        if (cameraStage === 1 && !worldFrame && saveDepth === 1) {
          return;
        }
        if (pendingRotate !== null && entityDepth > 0) {
          const angle = pendingRotate;
          pendingRotate = null;
          const actorLike = x >= 0.8 && x <= 1.8 && y >= 0.55 && y <= 1.8;
          if (actorLike) {
            actorMode = true;
            actorFacingAngle = angle;
            actorFlip = Math.cos(angle) < 0 ? -1 : 1;
            drawActorShadow();
            if (y / Math.max(0.001, x) < 0.82) {
              actorFlip = 1;
              raw.rotate(angle);
            } else {
              raw.scale(actorFlip, 1);
            }
          } else {
            raw.rotate(angle);
          }
        }
        raw.scale(x, y);
      },

      rotate(angle) {
        flushPendingRotate();
        if (entityDepth > 0) {
          pendingRotate = angle;
          return;
        }
        raw.rotate(angle);
      },

      fillRect(x, y, w, h) {
        flushPendingRotate();
        if (worldFrame && entityDepth === 0) {
          const rect = projectedRect(x, y, w, h);
          raw.fillRect(rect.x, rect.y, rect.w, rect.h);
          return;
        }
        if (groundPass && !(x === 0 && y === 0 && w >= width && h >= height) && h > 18) {
          const rect = projectedRect(x, y, w, h);
          raw.fillRect(rect.x, rect.y, rect.w, rect.h);
          return;
        }
        raw.fillRect(x, y, w, h);
      },

      strokeRect(x, y, w, h) {
        flushPendingRotate();
        if (worldFrame && entityDepth === 0) {
          const rect = projectedRect(x, y, w, h);
          raw.strokeRect(rect.x, rect.y, rect.w, rect.h);
          return;
        }
        raw.strokeRect(x, y, w, h);
      },

      moveTo(x, y) {
        flushPendingRotate();
        if (actorMode && Math.abs(y) < 1 && x >= 19) {
          const p = projectedActorRayPoint(x);
          raw.moveTo(p.x, p.y);
          return;
        }
        if ((worldFrame && entityDepth === 0) || groundPass) {
          const p = projection(x, y);
          raw.moveTo(p.x, p.y);
          return;
        }
        raw.moveTo(x, y);
      },

      lineTo(x, y) {
        flushPendingRotate();
        if (actorMode && Math.abs(y) < 1 && x >= 19) {
          const p = projectedActorRayPoint(x);
          raw.lineTo(p.x, p.y);
          return;
        }
        if ((worldFrame && entityDepth === 0) || groundPass) {
          const p = projection(x, y);
          raw.lineTo(p.x, p.y);
          return;
        }
        raw.lineTo(x, y);
      },

      bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
        flushPendingRotate();
        if ((worldFrame && entityDepth === 0) || groundPass) {
          const a = projection(c1x, c1y);
          const b = projection(c2x, c2y);
          const c = projection(x, y);
          raw.bezierCurveTo(a.x, a.y, b.x, b.y, c.x, c.y);
          return;
        }
        raw.bezierCurveTo(c1x, c1y, c2x, c2y, x, y);
      },

      arc(x, y, radius, start, end, counterclockwise) {
        flushPendingRotate();
        if (worldFrame && entityDepth === 0) {
          const p = projection(x, y);
          raw.ellipse(p.x, p.y, radius * p.scale, radius * p.scale * 0.42, 0, start, end, counterclockwise);
          return;
        }
        if (actorMode && radius >= 24 && Math.abs(x) <= 8 && Math.abs(y) <= 12) {
          raw.ellipse(x, y + 13, radius, radius * 0.38, 0, start, end, counterclockwise);
          return;
        }
        raw.arc(x, y, radius, start, end, counterclockwise);
      },

      ellipse(x, y, radiusX, radiusY, rotation, start, end, counterclockwise) {
        flushPendingRotate();
        if (worldFrame && entityDepth === 0) {
          const p = projection(x, y);
          raw.ellipse(p.x, p.y, radiusX * p.scale, radiusY * p.scale * 0.55, rotation, start, end, counterclockwise);
          return;
        }
        raw.ellipse(x, y, radiusX, radiusY, rotation, start, end, counterclockwise);
      },

      fillText(text, x, y, maxWidth) {
        flushPendingRotate();
        if (worldFrame && entityDepth === 0) {
          const p = projection(x, y);
          if (maxWidth === undefined) raw.fillText(text, p.x, p.y);
          else raw.fillText(text, p.x, p.y, maxWidth);
          return;
        }
        if (maxWidth === undefined) raw.fillText(text, x, y);
        else raw.fillText(text, x, y, maxWidth);
      },

      strokeText(text, x, y, maxWidth) {
        flushPendingRotate();
        if (worldFrame && entityDepth === 0) {
          const p = projection(x, y);
          if (maxWidth === undefined) raw.strokeText(text, p.x, p.y);
          else raw.strokeText(text, p.x, p.y, maxWidth);
          return;
        }
        if (maxWidth === undefined) raw.strokeText(text, x, y);
        else raw.strokeText(text, x, y, maxWidth);
      },

      createLinearGradient(x0, y0, x1, y1) {
        flushPendingRotate();
        if (worldFrame && entityDepth === 0) {
          const a = projection(x0, y0);
          const b = projection(x1, y1);
          return raw.createLinearGradient(a.x, a.y, b.x, b.y);
        }
        return raw.createLinearGradient(x0, y0, x1, y1);
      },

      createRadialGradient(x0, y0, r0, x1, y1, r1) {
        flushPendingRotate();
        if (worldFrame && entityDepth === 0) {
          const a = projection(x0, y0);
          const b = projection(x1, y1);
          return raw.createRadialGradient(a.x, a.y, r0 * a.scale, b.x, b.y, r1 * b.scale);
        }
        return raw.createRadialGradient(x0, y0, r0, x1, y1, r1);
      }
    };

    return new Proxy(raw, {
      get(target, property) {
        if (property === "__crownlessRenderSpace") return { projection };
        if (Object.prototype.hasOwnProperty.call(custom, property)) return custom[property];
        const value = target[property];
        if (typeof value !== "function") return value;
        if (!methods.has(property)) {
          methods.set(property, (...args) => {
            flushPendingRotate();
            return value.apply(target, args);
          });
        }
        return methods.get(property);
      },
      set(target, property, value) {
        flushPendingRotate();
        target[property] = value;
        return true;
      }
    });
  }

  HTMLCanvasElement.prototype.getContext = function patchedGetContext(type, options) {
    const raw = originalGetContext.call(this, type, options);
    if (type !== "2d" || !raw || this.id !== "arena") return raw;
    if (!this.__crownlessRenderSpaceContext) {
      this.__crownlessRenderSpaceContext = createArenaContextProxy(this, raw);
    }
    return this.__crownlessRenderSpaceContext;
  };
})();
