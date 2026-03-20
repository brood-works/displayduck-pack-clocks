var _a;
const expressionCache = /* @__PURE__ */ new Map();
const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const compileExpression = (expression) => {
  const cached = expressionCache.get(expression);
  if (cached) {
    return cached;
  }
  const transformed = expression.replace(/\bthis\b/g, "__item");
  const fn = new Function("scope", `with (scope) { return (${transformed}); }`);
  expressionCache.set(expression, fn);
  return fn;
};
const evaluate = (expression, scope) => {
  try {
    return compileExpression(expression)(scope);
  } catch {
    return "";
  }
};
const parseNodes = (template2, from = 0, stopAt) => {
  const nodes = [];
  let index = from;
  while (index < template2.length) {
    const start = template2.indexOf("{{", index);
    if (start === -1) {
      nodes.push({ type: "text", value: template2.slice(index) });
      return { nodes, index: template2.length };
    }
    if (start > index) {
      nodes.push({ type: "text", value: template2.slice(index, start) });
    }
    const close = template2.indexOf("}}", start + 2);
    if (close === -1) {
      nodes.push({ type: "text", value: template2.slice(start) });
      return { nodes, index: template2.length };
    }
    const token = template2.slice(start + 2, close).trim();
    index = close + 2;
    if (token === "/if" || token === "/each") {
      if (stopAt === token) {
        return { nodes, index };
      }
      nodes.push({ type: "text", value: `{{${token}}}` });
      continue;
    }
    if (token.startsWith("#if ")) {
      const child = parseNodes(template2, index, "/if");
      nodes.push({
        type: "if",
        condition: token.slice(4).trim(),
        children: child.nodes
      });
      index = child.index;
      continue;
    }
    if (token.startsWith("#each ")) {
      const child = parseNodes(template2, index, "/each");
      nodes.push({
        type: "each",
        source: token.slice(6).trim(),
        children: child.nodes
      });
      index = child.index;
      continue;
    }
    nodes.push({ type: "expr", value: token });
  }
  return { nodes, index };
};
const renderNodes = (nodes, scope) => {
  let output = "";
  for (const node of nodes) {
    if (node.type === "text") {
      output += node.value;
      continue;
    }
    if (node.type === "expr") {
      output += escapeHtml(evaluate(node.value, scope));
      continue;
    }
    if (node.type === "if") {
      if (Boolean(evaluate(node.condition, scope))) {
        output += renderNodes(node.children, scope);
      }
      continue;
    }
    const items = evaluate(node.source, scope);
    if (!Array.isArray(items)) {
      continue;
    }
    for (const item of items) {
      const childScope = Object.create(scope);
      childScope.__item = item;
      output += renderNodes(node.children, childScope);
    }
  }
  return output;
};
const createTemplateRenderer = (template2) => {
  const parsed = parseNodes(template2).nodes;
  return (scope) => renderNodes(parsed, scope);
};
typeof SuppressedError === "function" ? SuppressedError : function(error, suppressed, message) {
  var e = new Error(message);
  return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};
function convertFileSrc(filePath, protocol = "asset") {
  return window.__TAURI_INTERNALS__.convertFileSrc(filePath, protocol);
}
var TauriEvent;
(function(TauriEvent2) {
  TauriEvent2["WINDOW_RESIZED"] = "tauri://resize";
  TauriEvent2["WINDOW_MOVED"] = "tauri://move";
  TauriEvent2["WINDOW_CLOSE_REQUESTED"] = "tauri://close-requested";
  TauriEvent2["WINDOW_DESTROYED"] = "tauri://destroyed";
  TauriEvent2["WINDOW_FOCUS"] = "tauri://focus";
  TauriEvent2["WINDOW_BLUR"] = "tauri://blur";
  TauriEvent2["WINDOW_SCALE_FACTOR_CHANGED"] = "tauri://scale-change";
  TauriEvent2["WINDOW_THEME_CHANGED"] = "tauri://theme-changed";
  TauriEvent2["WINDOW_CREATED"] = "tauri://window-created";
  TauriEvent2["WEBVIEW_CREATED"] = "tauri://webview-created";
  TauriEvent2["DRAG_ENTER"] = "tauri://drag-enter";
  TauriEvent2["DRAG_OVER"] = "tauri://drag-over";
  TauriEvent2["DRAG_DROP"] = "tauri://drag-drop";
  TauriEvent2["DRAG_LEAVE"] = "tauri://drag-leave";
})(TauriEvent || (TauriEvent = {}));
const isSignal = (value) => {
  if (typeof value !== "function") {
    return false;
  }
  const candidate = value;
  return candidate._isSignal === true && typeof candidate.set === "function" && typeof candidate.subscribe === "function";
};
const signal = (initialValue) => {
  let current = initialValue;
  const subscribers = /* @__PURE__ */ new Set();
  const read = (() => current);
  read._isSignal = true;
  read.set = (value) => {
    current = value;
    for (const subscriber of subscribers) {
      subscriber(current);
    }
  };
  read.update = (updater) => {
    read.set(updater(current));
  };
  read.subscribe = (subscriber) => {
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
  };
  return read;
};
const bindSignals = (source, onChange) => {
  const unsubscribers = [];
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (isSignal(value)) {
      unsubscribers.push(value.subscribe(() => onChange()));
    }
  }
  return () => {
    for (const unsubscribe of unsubscribers) {
      unsubscribe();
    }
  };
};
const createScope = (instance, payload) => {
  return new Proxy(
    { payload },
    {
      get(target, property) {
        if (typeof property !== "string") {
          return void 0;
        }
        if (property in target) {
          return target[property];
        }
        const value = instance[property];
        if (typeof value === "function") {
          return value.bind(instance);
        }
        return value;
      },
      has(target, property) {
        if (typeof property !== "string") {
          return false;
        }
        return property in target || property in instance;
      }
    }
  );
};
const RELATIVE_URL_ATTRIBUTES = ["src", "href", "poster"];
const PACK_INSTALL_PATH_PLACEHOLDER = "{{pack-install-path}}/";
const ASSETS_PLACEHOLDER = "{{ASSETS}}";
const isExternalAssetUrl = (value) => {
  const trimmed = value.trim();
  return trimmed.length === 0 || trimmed.startsWith("data:") || trimmed.startsWith("blob:") || trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("file:") || trimmed.startsWith("asset:") || trimmed.startsWith("mailto:") || trimmed.startsWith("tel:") || trimmed.startsWith("javascript:") || trimmed.startsWith("//") || trimmed.startsWith("/") || trimmed.startsWith("#");
};
const extractWidgetRelativePath = (value) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (!isExternalAssetUrl(trimmed)) {
    return trimmed.replace(/^\.\/+/, "").replace(/^\/+/, "");
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const url = new URL(trimmed);
      if (url.origin === window.location.origin) {
        return `${url.pathname}${url.search}${url.hash}`.replace(/^\/+/, "");
      }
    } catch {
      return null;
    }
  }
  return null;
};
const normalizeJoinedAssetPath = (widgetDirectory, relativePath) => {
  const normalizedBase = widgetDirectory.replaceAll("\\", "/").replace(/\/+$/, "");
  const combined = `${normalizedBase}/${relativePath.trim()}`;
  const segments = combined.split("/");
  const resolved = [];
  for (const segment of segments) {
    if (!segment || segment === ".") {
      if (resolved.length === 0 && combined.startsWith("/")) {
        resolved.push("");
      }
      continue;
    }
    if (segment === "..") {
      if (resolved.length > 1 || resolved.length === 1 && resolved[0] !== "") {
        resolved.pop();
      }
      continue;
    }
    resolved.push(segment);
  }
  return resolved.join("/") || normalizedBase;
};
const resolveAssetUrl = (widgetDirectory, value) => {
  const relativePath = extractWidgetRelativePath(value);
  if (!widgetDirectory || !relativePath) {
    return value;
  }
  try {
    return convertFileSrc(normalizeJoinedAssetPath(widgetDirectory, relativePath));
  } catch {
    return value;
  }
};
const resolveAssetsBaseUrl = (widgetDirectory) => {
  const normalizedDirectory = widgetDirectory.trim().replaceAll("\\", "/").replace(/\/+$/, "");
  if (!normalizedDirectory) {
    return "";
  }
  try {
    return convertFileSrc(normalizedDirectory);
  } catch {
    return normalizedDirectory;
  }
};
const rewriteSrcset = (value, widgetDirectory) => {
  return value.split(",").map((entry) => {
    const trimmed = entry.trim();
    if (!trimmed) {
      return trimmed;
    }
    const [url, descriptor] = trimmed.split(/\s+/, 2);
    const nextUrl = resolveAssetUrl(widgetDirectory, url);
    return descriptor ? `${nextUrl} ${descriptor}` : nextUrl;
  }).join(", ");
};
const rewriteInlineStyleUrls = (value, widgetDirectory) => {
  return value.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (full, quote, urlValue) => {
    const nextUrl = resolveAssetUrl(widgetDirectory, urlValue);
    if (nextUrl === urlValue) {
      return full;
    }
    return `url("${nextUrl}")`;
  });
};
const rewriteElementAssetUrls = (element, widgetDirectory) => {
  for (const attribute of RELATIVE_URL_ATTRIBUTES) {
    const currentValue = element.getAttribute(attribute);
    if (!currentValue) {
      continue;
    }
    const nextValue = resolveAssetUrl(widgetDirectory, currentValue);
    if (nextValue !== currentValue) {
      element.setAttribute(attribute, nextValue);
    }
  }
  const currentSrcset = element.getAttribute("srcset");
  if (currentSrcset) {
    const nextSrcset = rewriteSrcset(currentSrcset, widgetDirectory);
    if (nextSrcset !== currentSrcset) {
      element.setAttribute("srcset", nextSrcset);
    }
  }
  const currentStyle = element.getAttribute("style");
  if (currentStyle) {
    const nextStyle = rewriteInlineStyleUrls(currentStyle, widgetDirectory);
    if (nextStyle !== currentStyle) {
      element.setAttribute("style", nextStyle);
    }
  }
};
const rewriteTreeAssetUrls = (root, widgetDirectory) => {
  if (!widgetDirectory) {
    return;
  }
  if (root instanceof Element) {
    rewriteElementAssetUrls(root, widgetDirectory);
  }
  for (const element of Array.from(root.querySelectorAll("*"))) {
    rewriteElementAssetUrls(element, widgetDirectory);
  }
};
const rewriteInstallPathPlaceholders = (input, widgetDirectory) => {
  if (!widgetDirectory) {
    return input;
  }
  let output = input;
  const assetsBaseUrl = resolveAssetsBaseUrl(widgetDirectory);
  if (assetsBaseUrl && output.includes(ASSETS_PLACEHOLDER)) {
    output = output.replaceAll(ASSETS_PLACEHOLDER, assetsBaseUrl);
  }
  if (!output.includes(PACK_INSTALL_PATH_PLACEHOLDER)) {
    return output;
  }
  return output.replace(/\{\{pack-install-path\}\}\/([^"')\s]+)/g, (full, relativePath) => {
    return resolveAssetUrl(widgetDirectory, relativePath);
  });
};
const createWidgetClass = (WidgetImpl, options) => {
  return class RuntimeWidget {
    constructor({
      mount,
      payload,
      setLoading
    }) {
      this.cleanups = [];
      this.widgetDirectory = "";
      this.mount = mount;
      this.payload = payload ?? {};
      this.setLoading = typeof setLoading === "function" ? setLoading : (() => {
      });
      this.assetObserver = new MutationObserver((mutations) => {
        if (!this.widgetDirectory) {
          return;
        }
        for (const mutation of mutations) {
          if (mutation.type === "attributes" && mutation.target instanceof Element) {
            rewriteElementAssetUrls(mutation.target, this.widgetDirectory);
            continue;
          }
          for (const node of Array.from(mutation.addedNodes)) {
            if (node instanceof Element) {
              rewriteTreeAssetUrls(node, this.widgetDirectory);
            }
          }
        }
      });
      this.logic = new WidgetImpl({
        mount,
        payload: this.payload,
        setLoading: (loading) => this.setLoading(Boolean(loading)),
        on: (eventName, selector, handler) => this.on(eventName, selector, handler)
      });
      this.cleanupSignalSubscriptions = bindSignals(this.logic, () => this.render());
      this.assetObserver.observe(this.mount, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["src", "href", "poster", "srcset", "style"]
      });
    }
    onInit() {
      this.render();
      this.logic.onInit?.();
    }
    onUpdate(payload) {
      this.payload = payload ?? {};
      this.logic.onUpdate?.(this.payload);
      this.render();
    }
    onDestroy() {
      this.cleanupSignalSubscriptions();
      while (this.cleanups.length > 0) {
        const cleanup = this.cleanups.pop();
        cleanup?.();
      }
      this.assetObserver.disconnect();
      this.logic.onDestroy?.();
      this.mount.innerHTML = "";
    }
    render() {
      const scope = createScope(this.logic, this.payload);
      this.widgetDirectory = String(
        this.payload?.widgetDirectory ?? this.payload?.directory ?? ""
      ).trim();
      const finalTemplate = rewriteInstallPathPlaceholders(options.template, this.widgetDirectory);
      const finalStyles = rewriteInstallPathPlaceholders(options.styles, this.widgetDirectory);
      const renderTemplate = createTemplateRenderer(finalTemplate);
      const html = renderTemplate(scope);
      this.mount.innerHTML = `<style>${finalStyles}</style>${html}`;
      this.mount.setAttribute("data-displayduck-render-empty", html.trim().length === 0 ? "true" : "false");
      rewriteTreeAssetUrls(this.mount, this.widgetDirectory);
      this.logic.afterRender?.();
    }
    on(eventName, selector, handler) {
      const listener = (event) => {
        const target = event.target;
        const matched = target?.closest(selector);
        if (!matched || !this.mount.contains(matched)) {
          return;
        }
        handler(event, matched);
      };
      this.mount.addEventListener(eventName, listener);
      const cleanup = () => this.mount.removeEventListener(eventName, listener);
      this.cleanups.push(cleanup);
      return cleanup;
    }
  };
};
let DisplayDuckWidget$1 = (_a = class {
  constructor(ctx) {
    this.ctx = ctx;
    this.clockTimerId = null;
    this.flipTimeouts = /* @__PURE__ */ new Map();
    this.widgetName = "";
    this.analogMarkerRotation = 0;
    this.flipDigits = [];
    this.digitalHourEl = null;
    this.digitalMinuteEl = null;
    this.digitalSecondEl = null;
    this.analogHourEl = null;
    this.analogMinuteEl = null;
    this.analogMarkerEl = null;
    this.analogTickEls = [];
    this.flipDigitEls = [];
    this.analogQuarterDigits = [3, 6, 9, 12];
    this.analogAllDigits = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    this.analogTicks = Array.from({ length: 60 }, (_, index) => index);
    this.shadows = signal(false);
    this.config = this.extractConfig(ctx.payload);
    this.widgetName = this.extractWidgetName(ctx.payload);
    const now = this.getCurrentTime();
    this.flipDigits = this.createFlipDigits(now);
  }
  onInit() {
    this.cacheDomRefs();
    this.applyTimeToDom(this.getCurrentTime(), true);
    this.scheduleNextTick();
  }
  onUpdate(payload) {
    this.config = this.extractConfig(payload);
    this.widgetName = this.extractWidgetName(payload);
    setTimeout(() => {
      this.cacheDomRefs();
      this.flipDigits = this.createFlipDigits(this.getCurrentTime());
      this.applyTimeToDom(this.getCurrentTime(), true);
      this.scheduleNextTick();
    }, 0);
  }
  onDestroy() {
    this.stopClock();
  }
  shadowsEnabled() {
    return this.shadows();
  }
  isAnalog() {
    return this.styles() === "analog";
  }
  isDigital() {
    return this.styles() === "digital";
  }
  isFlip() {
    return this.styles() === "flip";
  }
  styles() {
    const raw = String(this.config.styles ?? "").toLowerCase();
    if (raw === "flip" || raw === "digital" || raw === "analog") {
      return raw;
    }
    const name = this.widgetName.toLowerCase();
    if (name.includes("flip")) return "flip";
    if (name.includes("analog")) return "analog";
    if (name.includes("digital")) return "digital";
    return "digital";
  }
  showSeconds() {
    return Boolean(this.config.showSeconds);
  }
  ledFont() {
    return Boolean(this.config.ledFont);
  }
  blinkSeparator() {
    return Boolean(this.config.blinkSeparator);
  }
  showAllNumbers() {
    return Boolean(this.config.showAllNumbers);
  }
  analogDigits() {
    return this.showAllNumbers() ? this.analogAllDigits : this.analogQuarterDigits;
  }
  getTickRotation(tick) {
    return `rotate(${tick * 6})`;
  }
  getDigitTransform(digit) {
    return `rotate(${digit * 30}) translate(0 -55) rotate(${-digit * 30})`;
  }
  firstFlipPair() {
    return [0, 1];
  }
  secondFlipPair() {
    return [2, 3];
  }
  thirdFlipPair() {
    return [4, 5];
  }
  cacheDomRefs() {
    this.digitalHourEl = this.ctx.mount.querySelector("[data-clock-hour]");
    this.digitalMinuteEl = this.ctx.mount.querySelector("[data-clock-minute]");
    this.digitalSecondEl = this.ctx.mount.querySelector("[data-clock-second]");
    this.analogHourEl = this.ctx.mount.querySelector("[data-analog-hour]");
    this.analogMinuteEl = this.ctx.mount.querySelector("[data-analog-minute]");
    this.analogMarkerEl = this.ctx.mount.querySelector("[data-analog-marker]");
    this.analogTickEls = Array.from(this.ctx.mount.querySelectorAll("[data-analog-tick]"));
    this.flipDigitEls = Array.from(this.ctx.mount.querySelectorAll("[data-flip-index]"));
  }
  scheduleNextTick() {
    this.stopClock();
    if (this.isAnalog()) {
      const tickAnalog = () => {
        const nowDate = /* @__PURE__ */ new Date();
        this.analogMarkerRotation = (nowDate.getSeconds() + nowDate.getMilliseconds() / 1e3) * 6;
        this.applyTimeToDom(this.getTimeForDate(nowDate), false);
        this.clockTimerId = setTimeout(tickAnalog, _a.ANALOG_REFRESH_MS);
      };
      tickAnalog();
      return;
    }
    const tick = () => {
      const now = Date.now();
      const leadMs = this.isFlip() ? _a.FLIP_DURATION_MS : 0;
      let delay = 1e3 - now % 1e3 - leadMs;
      if (delay <= 0) delay += 1e3;
      this.clockTimerId = setTimeout(() => {
        const baseNow = Date.now();
        const effectiveNow = this.isFlip() ? baseNow + _a.FLIP_DURATION_MS : baseNow;
        this.applyTimeToDom(this.getTimeForDate(new Date(effectiveNow)), false);
        tick();
      }, delay);
    };
    tick();
  }
  stopClock() {
    if (this.clockTimerId) {
      clearTimeout(this.clockTimerId);
      this.clockTimerId = null;
    }
    for (const timeout of this.flipTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.flipTimeouts.clear();
  }
  applyTimeToDom(time, forceInstantFlip) {
    this.applyDigital(time);
    this.applyAnalog(time);
    this.applyFlip(time, forceInstantFlip);
  }
  applyDigital(time) {
    if (!this.digitalHourEl || !this.digitalMinuteEl) return;
    this.digitalHourEl.textContent = time.h;
    this.digitalMinuteEl.textContent = time.m;
    if (this.digitalSecondEl) {
      this.digitalSecondEl.textContent = time.s;
    }
  }
  applyAnalog(time) {
    if (!this.analogHourEl || !this.analogMinuteEl) return;
    const hourRotation = this.getAnalogHourRotation(time);
    const minuteRotation = this.getAnalogMinuteRotation(time);
    this.analogHourEl.setAttribute("transform", `rotate(${hourRotation})`);
    this.analogMinuteEl.setAttribute("transform", `rotate(${minuteRotation})`);
    if (this.analogMarkerEl) {
      this.analogMarkerEl.setAttribute("transform", `rotate(${this.analogMarkerRotation - 3} 0 0)`);
    }
    if (this.showSeconds()) {
      for (let index = 0; index < this.analogTickEls.length; index += 1) {
        const tickEl = this.analogTickEls[index];
        const distance = this.getAnalogTickDistance(index);
        tickEl.setAttribute("data-active", distance >= 0 ? String(distance) : "");
      }
    } else {
      for (const tickEl of this.analogTickEls) {
        tickEl.setAttribute("data-active", "");
      }
    }
  }
  applyFlip(time, forceInstant) {
    if (!this.flipDigitEls.length) return;
    const nextDigits = `${time.h}${time.m}${time.s}`.split("");
    for (let index = 0; index < this.flipDigitEls.length; index += 1) {
      const digitEl = this.flipDigitEls[index];
      const current = this.flipDigits[index] ?? { current: "0", next: "0", flipping: false };
      const next = nextDigits[index] ?? "0";
      const pending = this.flipTimeouts.get(index);
      if (pending) {
        clearTimeout(pending);
        this.flipTimeouts.delete(index);
      }
      if (forceInstant || current.current === next) {
        current.current = next;
        current.next = next;
        current.flipping = false;
        this.flipDigits[index] = current;
        this.renderFlipDigit(index, digitEl);
        continue;
      }
      current.next = next;
      current.flipping = true;
      this.flipDigits[index] = current;
      this.renderFlipDigit(index, digitEl);
      const timeout = setTimeout(() => {
        const state = this.flipDigits[index];
        if (!state) return;
        state.current = state.next;
        state.flipping = false;
        this.flipDigits[index] = state;
        this.renderFlipDigit(index, digitEl);
        this.flipTimeouts.delete(index);
      }, _a.FLIP_DURATION_MS);
      this.flipTimeouts.set(index, timeout);
    }
  }
  renderFlipDigit(index, digitEl) {
    const state = this.flipDigits[index];
    if (!state) return;
    digitEl.classList.toggle("flipping", state.flipping);
    const full = digitEl.querySelector(".digit-full");
    const staticTop = digitEl.querySelector(".digit-static.top .value");
    const staticBottom = digitEl.querySelector(".digit-static.bottom .value");
    const flipTop = digitEl.querySelector(".digit-flip.top .value");
    const flipBottom = digitEl.querySelector(".digit-flip.bottom .value");
    if (full) full.textContent = state.current;
    if (staticTop) staticTop.textContent = state.flipping ? state.next : state.current;
    if (staticBottom) staticBottom.textContent = state.current;
    if (flipTop) flipTop.textContent = state.current;
    if (flipBottom) flipBottom.textContent = state.next;
  }
  getAnalogHourRotation(time) {
    const hours = Number(time.h) % 12;
    const minutes = Number(time.m);
    return (hours + minutes / 60) * 30;
  }
  getAnalogMinuteRotation(time) {
    const minutes = Number(time.m);
    const seconds = Number(time.s);
    return (minutes + seconds / 60) * 6;
  }
  getAnalogTickDistance(tick) {
    const markerTick = (Math.round(this.analogMarkerRotation / 6) % 60 + 60) % 60;
    if (!Number.isFinite(markerTick)) return -1;
    const distance = (markerTick - tick + 60) % 60;
    return distance <= 4 ? distance : -1;
  }
  getCurrentTime() {
    return this.getTimeForDate(/* @__PURE__ */ new Date());
  }
  getTimeForDate(now) {
    const use24Hour = this.config.use24Hour === void 0 ? true : Boolean(this.config.use24Hour);
    let hours = now.getHours();
    if (!use24Hour) {
      hours = hours % 12 || 12;
    }
    return {
      h: String(hours).padStart(2, "0"),
      m: String(now.getMinutes()).padStart(2, "0"),
      s: String(now.getSeconds()).padStart(2, "0")
    };
  }
  createFlipDigits(time) {
    return `${time.h}${time.m}${time.s}`.split("").map((digit) => ({
      current: digit,
      next: digit,
      flipping: false
    }));
  }
  extractConfig(payload) {
    const raw = payload?.config;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    if (raw.hasOwnProperty("shadow")) this.shadows.set(Boolean(raw.shadow));
    return raw;
  }
  extractWidgetName(payload) {
    const name = payload?.name;
    return typeof name === "string" ? name : "";
  }
}, _a.FLIP_DURATION_MS = 180, _a.ANALOG_REFRESH_MS = 50, _a);
const template = `<div class="clock {{#if shadowsEnabled()}}shadows{{/if}}">
  {{#if isAnalog()}}
    <div class="analog-wrapper">
      <svg class="analog-clock" viewBox="-60 -60 120 120" aria-label="Analog clock">
        <circle class="dial" cx="0" cy="0" r="46"></circle>
        <g class="second-ticks">
          {{#each analogTicks}}
            <line
              class="tick"
              data-analog-tick="true"
              data-active="{{ showSeconds() ? getAnalogTickDistance(this) : '' }}"
              x1="0"
              y1="-38"
              x2="0"
              y2="-42"
              transform="{{ getTickRotation(this) }}">
            </line>
          {{/each}}
        </g>
        <g class="hour-labels">
          {{#each analogDigits()}}
            <text
              class="digit"
              x="0"
              y="0"
              text-anchor="middle"
              dominant-baseline="middle"
              transform="{{ getDigitTransform(this) }}">
              {{ this }}
            </text>
          {{/each}}
        </g>
        <g class="hands">
          <line class="hand hour" data-analog-hour="true" x1="0" y1="5" x2="0" y2="-17"></line>
          <line class="hand minute" data-analog-minute="true" x1="0" y1="8" x2="0" y2="-26"></line>
        </g>
        {{#if showSeconds()}}
          <g class="seconds-marker" data-analog-marker="true">
            <path d="M -3 -31 L 3 -31 L 0 -36 Z"></path>
          </g>
        {{/if}}
        <circle class="pivot" cx="0" cy="0" r="2.4"></circle>
      </svg>
    </div>
  {{/if}}

  {{#if isDigital()}}
    <div class="digital-clock">
      {{#if ledFont()}}
        <div class="background">
          <div class="digits led">88</div>
          <div class="separator led">:</div>
          <div class="digits led">88</div>
          {{#if showSeconds()}}
            <div class="separator led">:</div>
            <div class="digits led">88</div>
          {{/if}}
        </div>
      {{/if}}

      <div class="digits{{ ledFont() ? ' led' : '' }}" data-clock-hour="true">00</div>
      <div class="separator{{ ledFont() ? ' led' : '' }}{{ blinkSeparator() ? ' blink' : '' }}">:</div>
      <div class="digits{{ ledFont() ? ' led' : '' }}" data-clock-minute="true">00</div>
      {{#if showSeconds()}}
        <div class="separator{{ ledFont() ? ' led' : '' }}{{ blinkSeparator() ? ' blink' : '' }}">:</div>
        <div class="digits{{ ledFont() ? ' led' : '' }}" data-clock-second="true">00</div>
      {{/if}}
    </div>
  {{/if}}

  {{#if isFlip()}}
    <div class="flipclock">
      <div class="digit-group">
        {{#each firstFlipPair()}}
          <div class="digit" data-flip-index="{{ this }}">
            <span class="digit-full">0</span>
            <span class="digit-static top"><span class="value">0</span></span>
            <span class="digit-static bottom"><span class="value">0</span></span>
            <span class="digit-flip top"><span class="value">0</span></span>
            <span class="digit-flip bottom"><span class="value">0</span></span>
          </div>
        {{/each}}
      </div>
      <div class="separator{{ blinkSeparator() ? ' blink' : '' }}">:</div>
      <div class="digit-group">
        {{#each secondFlipPair()}}
          <div class="digit" data-flip-index="{{ this }}">
            <span class="digit-full">0</span>
            <span class="digit-static top"><span class="value">0</span></span>
            <span class="digit-static bottom"><span class="value">0</span></span>
            <span class="digit-flip top"><span class="value">0</span></span>
            <span class="digit-flip bottom"><span class="value">0</span></span>
          </div>
        {{/each}}
      </div>
      {{#if showSeconds()}}
        <div class="separator{{ blinkSeparator() ? ' blink' : '' }}">:</div>
        <div class="digit-group">
          {{#each thirdFlipPair()}}
            <div class="digit" data-flip-index="{{ this }}">
              <span class="digit-full">0</span>
              <span class="digit-static top"><span class="value">0</span></span>
              <span class="digit-static bottom"><span class="value">0</span></span>
              <span class="digit-flip top"><span class="value">0</span></span>
              <span class="digit-flip bottom"><span class="value">0</span></span>
            </div>
          {{/each}}
        </div>
      {{/if}}
    </div>
  {{/if}}
</div>
`;
const styles = '.clock {\n  width: 100%;\n  height: 100%;\n}\n.clock.shadows {\n  filter: drop-shadow(-1px 1px 1px #000000);\n}\n.clock .blink {\n  animation: blink 0.75s ease-out infinite alternate;\n}\n.clock .analog-wrapper {\n  --clock-size: min(var(--host-width, 200px), var(--host-height, 200px));\n  --clock-padding: calc(var(--clock-size) / 15);\n  width: 100%;\n  height: 100%;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n}\n.clock .analog-clock {\n  width: calc(var(--clock-size) - var(--clock-padding) * 2);\n  height: calc(var(--clock-size) - var(--clock-padding) * 2);\n  overflow: visible;\n  color: rgb(from var(--color-text) r g b/0.88);\n}\n.clock .analog-clock .dial {\n  fill: transparent;\n  stroke: rgb(from var(--color-text) r g b/0.68);\n  stroke-width: 1.2px;\n}\n.clock .analog-clock .second-ticks .tick {\n  stroke: rgb(from var(--color-text) r g b/0.3);\n  stroke-width: 0.8px;\n  stroke-linecap: round;\n  opacity: 1;\n  transition: stroke 1s linear, stroke-width 1s linear, opacity 1s linear;\n}\n.clock .analog-clock .second-ticks .tick[data-active="0"] {\n  stroke: rgb(from var(--color-text) r g b/0.95);\n  stroke-width: 1.8px;\n  opacity: 1;\n}\n.clock .analog-clock .second-ticks .tick[data-active="1"] {\n  stroke: rgb(from var(--color-text) r g b/0.8);\n  stroke-width: 1.5px;\n  opacity: 0.82;\n}\n.clock .analog-clock .second-ticks .tick[data-active="2"] {\n  stroke: rgb(from var(--color-text) r g b/0.62);\n  stroke-width: 1.25px;\n  opacity: 0.64;\n}\n.clock .analog-clock .second-ticks .tick[data-active="3"] {\n  stroke: rgb(from var(--color-text) r g b/0.48);\n  stroke-width: 1.05px;\n  opacity: 0.5;\n}\n.clock .analog-clock .second-ticks .tick[data-active="4"] {\n  stroke: rgb(from var(--color-text) r g b/0.44);\n  stroke-width: 0.9px;\n  opacity: 0.7;\n}\n.clock .analog-clock .hour-labels .digit {\n  fill: currentColor;\n  font-size: 0.53rem;\n  font-weight: 500;\n  font-family: sans-serif;\n}\n.clock .analog-clock .hands .hand {\n  stroke-linecap: round;\n}\n.clock .analog-clock .hands .hour {\n  stroke: rgb(from var(--color-text) r g b/0.58);\n  stroke-width: 2.4px;\n}\n.clock .analog-clock .hands .minute {\n  stroke: rgb(from var(--color-text) r g b/0.88);\n  stroke-width: 1.35px;\n}\n.clock .analog-clock .seconds-marker path {\n  fill: rgb(from var(--color-text) r g b/0.96);\n}\n.clock .analog-clock .pivot {\n  fill: var(--color-primary);\n  stroke: var(--color-text);\n  stroke-width: 1.2px;\n}\n.clock .digital-clock {\n  width: 100%;\n  height: 100%;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  font-size: calc(var(--host-width, 200px) / 5);\n  position: relative;\n}\n.clock .digital-clock .separator {\n  display: flex;\n  align-items: center;\n  transform: translateY(-0.1em);\n}\n.clock .digital-clock .separator.led {\n  transform: translateY(-15%);\n}\n.clock .digital-clock .digits {\n  font-variant-numeric: tabular-nums lining-nums;\n}\n.clock .digital-clock .digits.led {\n  font-family: "digi-mono", monospace, sans-serif;\n}\n.clock .digital-clock .background {\n  display: flex;\n  position: absolute;\n  opacity: 0.2;\n}\n.clock .flipclock {\n  --clock-size: calc(var(--host-width, 200px) / 24);\n  --digit-width: calc(var(--clock-size) * 3);\n  --digit-height: calc(var(--clock-size) * 4.2);\n  --digit-font-size: calc(var(--clock-size) * 3);\n  --digit-radius: calc(var(--clock-size) * 0.4);\n  --flip-duration: 0.25s;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: calc(var(--clock-size) * 0.65);\n  width: 100%;\n  height: 100%;\n}\n.clock .flipclock .digit-group {\n  display: flex;\n  gap: calc(var(--clock-size) * 0.3);\n}\n.clock .flipclock .separator {\n  color: #eeeeee;\n  font-size: calc(var(--clock-size) * 2.4);\n  font-weight: 700;\n  line-height: 1;\n  text-shadow: 0 calc(var(--clock-size) * 0.05) calc(var(--clock-size) * 0.12) #333;\n}\n.clock .flipclock .digit {\n  position: relative;\n  width: var(--digit-width);\n  height: var(--digit-height);\n  perspective: calc(var(--clock-size) * 28);\n  border-radius: var(--digit-radius);\n  box-shadow: 0 calc(var(--clock-size) * 0.15) calc(var(--clock-size) * 0.45) #111;\n}\n.clock .flipclock .digit .digit-full {\n  position: absolute;\n  inset: 0;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  color: #eeeeee;\n  font-size: var(--digit-font-size);\n  font-weight: 700;\n  line-height: 1;\n  text-shadow: 0 calc(var(--clock-size) * 0.05) calc(var(--clock-size) * 0.12) #333;\n  z-index: 2;\n}\n.clock .flipclock .digit::after {\n  content: "";\n  position: absolute;\n  left: 0;\n  top: 50%;\n  width: 100%;\n  height: calc(var(--clock-size) * 0.08);\n  transform: translateY(calc(var(--clock-size) * -0.04));\n  background: black;\n  z-index: 4;\n}\n.clock .flipclock .digit-static,\n.clock .flipclock .digit-flip {\n  position: absolute;\n  left: 0;\n  width: 100%;\n  height: 50%;\n  overflow: hidden;\n  backface-visibility: hidden;\n  z-index: 1;\n}\n.clock .flipclock .digit-static .value,\n.clock .flipclock .digit-flip .value {\n  position: absolute;\n  left: 50%;\n  width: 100%;\n  height: var(--digit-height);\n  display: block;\n  color: #eeeeee;\n  font-size: var(--digit-font-size);\n  font-weight: 700;\n  line-height: var(--digit-height);\n  text-align: center;\n  transform: translateX(-50%);\n  text-shadow: 0 calc(var(--clock-size) * 0.05) calc(var(--clock-size) * 0.12) #333;\n}\n.clock .flipclock .digit-static.top,\n.clock .flipclock .digit-flip.top {\n  top: 0;\n  background: #181818;\n  border-top: 1px solid black;\n  border-radius: var(--digit-radius) var(--digit-radius) 0 0;\n  box-shadow: inset 0 calc(var(--clock-size) * 0.5) calc(var(--clock-size) * 1.2) #111111;\n}\n.clock .flipclock .digit-static.top .value,\n.clock .flipclock .digit-flip.top .value {\n  top: 0;\n}\n.clock .flipclock .digit-static.bottom,\n.clock .flipclock .digit-flip.bottom {\n  bottom: 0;\n  background: #2a2a2a;\n  border-bottom: 1px solid #444444;\n  border-radius: 0 0 var(--digit-radius) var(--digit-radius);\n  box-shadow: inset 0 calc(var(--clock-size) * 0.5) calc(var(--clock-size) * 1.2) #202020;\n}\n.clock .flipclock .digit-static.bottom .value,\n.clock .flipclock .digit-flip.bottom .value {\n  top: calc(var(--digit-height) * -0.5);\n}\n.clock .flipclock .digit-static .value {\n  opacity: 0;\n}\n.clock .flipclock .digit-flip {\n  opacity: 0;\n  pointer-events: none;\n  z-index: 3;\n}\n.clock .flipclock .digit-flip.top {\n  transform-origin: 50% 100%;\n  transform: rotateX(0deg);\n}\n.clock .flipclock .digit-flip.bottom {\n  display: none;\n}\n.clock .flipclock .digit.flipping .digit-flip.top {\n  opacity: 1;\n  animation: flipTop var(--flip-duration) ease-out forwards;\n}\n\n@keyframes flipTop {\n  0% {\n    transform: rotateX(0deg);\n  }\n  100% {\n    transform: rotateX(-90deg);\n  }\n}\n@keyframes blink {\n  0% {\n    opacity: 1;\n  }\n  49% {\n    opacity: 1;\n  }\n  50% {\n    opacity: 0;\n  }\n  100% {\n    opacity: 0;\n  }\n}\n.text-shadows .analog-clock {\n  filter: drop-shadow(1px 1px 0.25em rgba(0, 0, 0, 0.5));\n}';
const DisplayDuckWidget = createWidgetClass(DisplayDuckWidget$1, { template, styles });
const Widget = DisplayDuckWidget;
const displayduckPackClocks_clock_entry = { DisplayDuckWidget, Widget };
export {
  DisplayDuckWidget,
  Widget,
  displayduckPackClocks_clock_entry as default
};
//# sourceMappingURL=clock.js.map
