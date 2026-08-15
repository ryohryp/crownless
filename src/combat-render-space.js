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
    let groundOverlayDrawn = false;
    let entityDepth = 0;
    let entityScale = 1;
    let actorMode = false;
    let actorFacingAngle = 0;
    let actorFlip = 1;
    let actorSpriteDrawn = false;
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
      actorSpriteDrawn = false;
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

    function actorPalette(fillStyle) {
      if (typeof fillStyle !== "string") return null;
      const value = fillStyle.toLowerCase();

      if (value === "#e4c997" || value === "#ef8c75" || value === "#eef2df") {
        return {
          role: "player",
          outline: "#0d0f0f",
          cloak: "#1c2325",
          cloakShade: "#111617",
          accent: "#783b35",
          skin: "#c7aa7f",
          hair: "#15181c",
          metal: "#b7ad94"
        };
      }

      if (value === "#81765e") {
        return {
          role: "guard",
          outline: "#151310",
          cloak: "#4b473d",
          cloakShade: "#302d27",
          accent: "#8c7446",
          skin: "#a98f69",
          hair: "#2c2925",
          metal: "#91856a"
        };
      }

      if (value === "#78805b") {
        return {
          role: "skirmisher",
          outline: "#121510",
          cloak: "#3d4732",
          cloakShade: "#252c20",
          accent: "#6d7b4f",
          skin: "#a78d69",
          hair: "#252821",
          metal: "#918c6e"
        };
      }

      if (value === "#a65347") {
        return {
          role: "rusher",
          outline: "#171110",
          cloak: "#56332d",
          cloakShade: "#341f1c",
          accent: "#8d4b3f",
          skin: "#af8f69",
          hair: "#2b211e",
          metal: "#967f69"
        };
      }

      if (value === "#f0b28c") {
        return {
          role: "enemy-hit",
          outline: "#18110e",
          cloak: "#6a493b",
          cloakShade: "#3d2b24",
          accent: "#b96f55",
          skin: "#d2a17d",
          hair: "#34251f",
          metal: "#b39b7f"
        };
      }

      return null;
    }

    function drawActorSpriteBase(palette) {
      raw.save();
      raw.imageSmoothingEnabled = false;
      raw.lineJoin = "miter";
      raw.lineCap = "square";

      raw.fillStyle = palette.outline;
      raw.fillRect(-16, -9, 32, 36);
      raw.fillRect(-12, 23, 9, 13);
      raw.fillRect(4, 23, 9, 13);

      raw.fillStyle = palette.cloakShade;
      raw.fillRect(-13, -7, 26, 31);
      raw.fillRect(-17, 2, 7, 20);
      raw.fillRect(10, 2, 7, 20);

      raw.fillStyle = palette.cloak;
      raw.fillRect(-10, -5, 20, 25);
      raw.fillRect(-8, 18, 8, 9);
      raw.fillRect(1, 18, 8, 9);

      raw.fillStyle = palette.accent;
      raw.fillRect(-10, -4, 20, 4);
      if (palette.role === "player") {
        raw.fillRect(-15, -2, 6, 21);
        raw.fillRect(-14, 17, 10, 4);
      } else if (palette.role === "guard") {
        raw.fillRect(-14, 8, 5, 13);
        raw.fillRect(9, 5, 5, 15);
      } else if (palette.role === "skirmisher") {
        raw.fillRect(-13, 7, 5, 12);
      } else {
        raw.fillRect(9, 7, 5, 14);
      }

      raw.fillStyle = palette.hair;
      raw.fillRect(-13, -31, 26, 16);
      raw.fillRect(-15, -27, 5, 11);
      raw.fillRect(10, -27, 5, 8);

      raw.fillStyle = palette.skin;
      raw.fillRect(-8, -24, 16, 10);
      raw.fillStyle = palette.hair;
      raw.fillRect(-8, -24, 5, 4);
      raw.fillRect(4, -24, 4, 4);

      raw.fillStyle = palette.metal;
      raw.fillRect(-12, 2, 4, 10);
      raw.fillRect(8, 2, 4, 10);

      if (palette.role === "guard") {
        raw.fillStyle = palette.outline;
        raw.fillRect(11, -4, 12, 30);
        raw.fillStyle = "#736847";
        raw.fillRect(13, -2, 8, 26);
        raw.fillStyle = "#a18d5a";
        raw.fillRect(16, 1, 2, 20);
      }

      raw.restore();
    }

    function hashCell(x, y) {
      const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      return n - Math.floor(n);
    }

    function screenPath(points) {
      raw.beginPath();
      points.forEach((point, index) => {
        const p = projection(point.x, point.y);
        if (index === 0) raw.moveTo(p.x, p.y);
        else raw.lineTo(p.x, p.y);
      });
      raw.closePath();
    }

    function drawTileField() {
      raw.save();
      raw.imageSmoothingEnabled = false;

      const tileW = 86;
      const tileH = 58;
      for (let y = 88; y < height + tileH; y += tileH) {
        for (let x = -40; x < width + tileW; x += tileW) {
          const wobble = hashCell(x, y);
          const inset = wobble > 0.72 ? 5 : 2;
          const points = [
            { x: x + inset, y: y + inset },
            { x: x + tileW - inset, y: y + inset + 2 },
            { x: x + tileW - 7, y: y + tileH - inset },
            { x: x + 5, y: y + tileH - 4 }
          ];
          screenPath(points);

          const center = x + tileW / 2;
          const road = center > width * 0.28 && center < width * 0.72;
          const alpha = road ? 0.075 + wobble * 0.035 : 0.035 + wobble * 0.025;
          raw.fillStyle = road
            ? `rgba(165, 143, 104, ${alpha})`
            : `rgba(83, 91, 70, ${alpha})`;
          raw.fill();
          raw.strokeStyle = road
            ? "rgba(216, 195, 153, .045)"
            : "rgba(171, 178, 143, .025)";
          raw.lineWidth = 1;
          raw.stroke();

          if (wobble > 0.84) {
            const chip = projection(x + 18 + wobble * 28, y + 20 + wobble * 14);
            raw.fillStyle = "rgba(13, 14, 12, .24)";
            raw.fillRect(chip.x, chip.y, 5, 3);
          }
        }
      }

      raw.restore();
    }

    function drawWallBlock(x, y, w, h, shade = 0) {
      const rect = projectedRect(x, y, w, h);
      raw.fillStyle = shade > 0 ? "rgba(91, 84, 70, .36)" : "rgba(53, 51, 45, .72)";
      raw.fillRect(rect.x, rect.y - 14, rect.w, rect.h + 14);
      raw.strokeStyle = "rgba(190, 172, 136, .12)";
      raw.lineWidth = 1;
      raw.strokeRect(rect.x, rect.y - 14, rect.w, rect.h + 14);
    }

    function drawArenaProps() {
      raw.save();
      raw.imageSmoothingEnabled = false;

      // Reusable broken wall: scenery only, deliberately outside the main fight lane.
      drawWallBlock(770, 112, 74, 42, 0);
      drawWallBlock(836, 118, 54, 34, 1);
      drawWallBlock(792, 78, 49, 38, 1);
      drawWallBlock(850, 86, 36, 30, 0);

      // Tattered banner.
      const bannerTop = projection(827, 87);
      raw.fillStyle = "rgba(54, 22, 20, .78)";
      raw.fillRect(bannerTop.x - 5, bannerTop.y - 18, 10, 70);
      raw.fillStyle = "rgba(104, 52, 43, .55)";
      raw.fillRect(bannerTop.x - 3, bannerTop.y - 12, 6, 42);

      // Broken fence and crate in the near-left corner.
      const fenceA = projection(78, 395);
      const fenceB = projection(230, 414);
      raw.strokeStyle = "rgba(73, 54, 39, .9)";
      raw.lineWidth = 6;
      raw.beginPath();
      raw.moveTo(fenceA.x, fenceA.y - 22);
      raw.lineTo(fenceA.x, fenceA.y + 28);
      raw.moveTo(fenceB.x, fenceB.y - 22);
      raw.lineTo(fenceB.x, fenceB.y + 28);
      raw.moveTo(fenceA.x, fenceA.y - 6);
      raw.lineTo(fenceB.x, fenceB.y + 5);
      raw.stroke();

      const crate = projectedRect(172, 438, 64, 50);
      raw.fillStyle = "rgba(76, 55, 39, .78)";
      raw.fillRect(crate.x, crate.y - 16, crate.w, crate.h + 16);
      raw.strokeStyle = "rgba(150, 116, 76, .22)";
      raw.lineWidth = 2;
      raw.strokeRect(crate.x, crate.y - 16, crate.w, crate.h + 16);

      // Brazier: one local warm light cue instead of a full lighting system.
      const fire = projection(724, 278);
      const glow = raw.createRadialGradient(fire.x, fire.y - 15, 3, fire.x, fire.y - 15, 54);
      glow.addColorStop(0, "rgba(255, 174, 71, .22)");
      glow.addColorStop(1, "rgba(255, 132, 43, 0)");
      raw.fillStyle = glow;
      raw.fillRect(fire.x - 60, fire.y - 75, 120, 120);
      raw.fillStyle = "rgba(83, 62, 42, .86)";
      raw.fillRect(fire.x - 10, fire.y, 20, 28);
      raw.fillStyle = "#d98038";
      raw.fillRect(fire.x - 6, fire.y - 16, 12, 18);
      raw.fillStyle = "#f2b35e";
      raw.fillRect(fire.x - 3, fire.y - 23, 6, 13);

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
          groundOverlayDrawn = false;
          cameraStage = 0;
          worldFrame = false;
          worldFrameDepth = 0;
          entityDepth = 0;
          actorMode = false;
          actorFacingAngle = 0;
          actorFlip = 1;
          actorSpriteDrawn = false;
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
          actorSpriteDrawn = false;
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
            actorSpriteDrawn = false;
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

        if (groundPass && x === 0 && y === 0 && w >= width && h >= height) {
          raw.fillRect(x, y, w, h);
          if (!groundOverlayDrawn) {
            drawTileField();
            drawArenaProps();
            groundOverlayDrawn = true;
          }
          return;
        }

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
        if (actorMode && actorSpriteDrawn && radius >= 9 && radius <= 13 && y <= -14 && y >= -24) {
          return;
        }
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

        if (actorMode && property === "fillStyle" && !actorSpriteDrawn) {
          const palette = actorPalette(value);
          if (palette) {
            drawActorSpriteBase(palette);
            actorSpriteDrawn = true;
          }
        }

        if (actorMode && property === "lineCap" && value === "round") {
          target[property] = "square";
          return true;
        }

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