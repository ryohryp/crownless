(() => {
  "use strict";

  /*
   * Presentation-only contact correction for actor ground shadows.
   *
   * Generated actor images retain a few transparent / non-foot pixels below
   * the visible boot sole after alpha trimming. The logical foot anchor is
   * correct, but the visible sole therefore sits slightly above it. Pull only
   * the manuscript actor shadow upward so the ellipse meets the visible foot.
   * Gameplay coordinates, actor transforms, scale, simulation order and depth
   * order remain untouched.
   */

  const originalEllipse = CanvasRenderingContext2D.prototype.ellipse;
  const CONTACT_LIFT = 17;

  CanvasRenderingContext2D.prototype.ellipse = function crownlessContactEllipse(
    x,
    y,
    radiusX,
    radiusY,
    rotation,
    startAngle,
    endAngle,
    counterclockwise
  ) {
    const style = typeof this.fillStyle === "string" ? this.fillStyle.replace(/\s+/g, "").toLowerCase() : "";
    const actorGroundShadow = Math.abs(Number(x)) < 0.001
      && Math.abs(Number(radiusX) - 16) < 0.001
      && Math.abs(Number(radiusY) - 5.5) < 0.001
      && (style === "rgba(70,64,56,0.42)" || style === "rgba(70,64,56,.42)");

    return originalEllipse.call(
      this,
      x,
      actorGroundShadow ? Number(y) - CONTACT_LIFT : y,
      radiusX,
      radiusY,
      rotation,
      startAngle,
      endAngle,
      counterclockwise
    );
  };
})();
