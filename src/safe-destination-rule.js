"use strict";

const BLOCKED_FIELDS = Object.freeze([
  "latitude", "longitude", "lat", "lng", "route", "routeHistory", "exactRouteHistory",
  "address", "street", "poi", "destination", "coordinates"
]);

const DIRECTION_LABELS = Object.freeze({
  home: "いつもの地域を離れて、別の土地の気配を探す",
  nearby: "隣の地域へ広がる道筋を探す",
  faraway: "遠く離れた土地で、新しい痕跡を探す"
});

function safeDestination(location = {}) {
  const id = typeof location.id === "string" ? location.id : null;
  const label = typeof location.label === "string" ? location.label : "未知の地域";
  const visit = location.visit === "revisit" ? "revisit" : "first";
  const direction = DIRECTION_LABELS[id] || (visit === "first"
    ? "安全に立ち止まれる別の地域で、新しい痕跡を探す"
    : "安全に立ち止まれる場所で、周囲の変化を確かめる");

  return Object.freeze({
    kind: "abstract-region",
    label,
    visit,
    direction,
    requiresExactDestination: false,
    requiresContinuousScreenUse: false
  });
}

function containsPreciseDestination(value) {
  if (!value || typeof value !== "object") return false;
  return BLOCKED_FIELDS.some(field => Object.prototype.hasOwnProperty.call(value, field));
}

function assertSafeDestination(value) {
  if (containsPreciseDestination(value)) throw new Error("Safe destination rule: precise destination data is not allowed");
  if (value?.requiresExactDestination === true || value?.requiresContinuousScreenUse === true) {
    throw new Error("Safe destination rule: unsafe movement requirement is not allowed");
  }
  return true;
}

module.exports = { BLOCKED_FIELDS, safeDestination, containsPreciseDestination, assertSafeDestination };
