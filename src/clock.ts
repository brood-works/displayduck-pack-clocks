import { Signal, type WidgetContext, type WidgetPayload, signal } from '@displayduck/base';

type ClockStyle = 'flip' | 'digital' | 'analog';
type ClockTime = { h: string; m: string; s: string };
type FlipDigitState = { current: string; next: string; flipping: boolean };

export class DisplayDuckWidget {
  private static readonly FLIP_DURATION_MS = 180;
  private static readonly ANALOG_REFRESH_MS = 50;

  private clockTimerId: ReturnType<typeof setTimeout> | null = null;
  private flipTimeouts = new Map<number, ReturnType<typeof setTimeout>>();
  private config: Record<string, unknown>;
  private widgetName = '';
  private analogMarkerRotation = 0;
  private flipDigits: FlipDigitState[] = [];

  private digitalHourEl: HTMLElement | null = null;
  private digitalMinuteEl: HTMLElement | null = null;
  private digitalSecondEl: HTMLElement | null = null;
  private analogHourEl: SVGLineElement | null = null;
  private analogMinuteEl: SVGLineElement | null = null;
  private analogMarkerEl: SVGGElement | null = null;
  private analogTickEls: SVGLineElement[] = [];
  private flipDigitEls: HTMLElement[] = [];

  public readonly analogQuarterDigits = [3, 6, 9, 12];
  public readonly analogAllDigits = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  public readonly analogTicks = Array.from({ length: 60 }, (_, index) => index);
  public readonly shadows: Signal<boolean> = signal(false);

  public constructor(private readonly ctx: WidgetContext) {
    this.config = this.extractConfig(ctx.payload);
    this.widgetName = this.extractWidgetName(ctx.payload);
    const now = this.getCurrentTime();
    this.flipDigits = this.createFlipDigits(now);
  }

  public onInit(): void {
    this.cacheDomRefs();
    this.applyTimeToDom(this.getCurrentTime(), true);
    this.scheduleNextTick();
  }

  public onUpdate(payload: WidgetPayload): void {
    this.config = this.extractConfig(payload);
    this.widgetName = this.extractWidgetName(payload);

    setTimeout(() => {
      this.cacheDomRefs();
      this.flipDigits = this.createFlipDigits(this.getCurrentTime());
      this.applyTimeToDom(this.getCurrentTime(), true);
      this.scheduleNextTick();
    }, 0);
  }

  public onDestroy(): void {
    this.stopClock();
  }

  public shadowsEnabled(): boolean {
    return this.shadows();
  }

  public isAnalog(): boolean {
    return this.styles() === 'analog';
  }

  public isDigital(): boolean {
    return this.styles() === 'digital';
  }

  public isFlip(): boolean {
    return this.styles() === 'flip';
  }

  public styles(): ClockStyle {
    const raw = String(this.config.styles ?? '').toLowerCase();
    if (raw === 'flip' || raw === 'digital' || raw === 'analog') {
      return raw;
    }
    const name = this.widgetName.toLowerCase();
    if (name.includes('flip')) return 'flip';
    if (name.includes('analog')) return 'analog';
    if (name.includes('digital')) return 'digital';
    return 'digital';
  }

  public showSeconds(): boolean {
    return Boolean(this.config.showSeconds);
  }

  public ledFont(): boolean {
    return Boolean(this.config.ledFont);
  }

  public blinkSeparator(): boolean {
    return Boolean(this.config.blinkSeparator);
  }

  public showAllNumbers(): boolean {
    return Boolean(this.config.showAllNumbers);
  }

  public analogDigits(): number[] {
    return this.showAllNumbers() ? this.analogAllDigits : this.analogQuarterDigits;
  }

  public getTickRotation(tick: number): string {
    return `rotate(${tick * 6})`;
  }

  public getDigitTransform(digit: number): string {
    return `rotate(${digit * 30}) translate(0 -55) rotate(${-digit * 30})`;
  }

  public firstFlipPair(): number[] {
    return [0, 1];
  }

  public secondFlipPair(): number[] {
    return [2, 3];
  }

  public thirdFlipPair(): number[] {
    return [4, 5];
  }

  private cacheDomRefs(): void {
    this.digitalHourEl = this.ctx.mount.querySelector('[data-clock-hour]');
    this.digitalMinuteEl = this.ctx.mount.querySelector('[data-clock-minute]');
    this.digitalSecondEl = this.ctx.mount.querySelector('[data-clock-second]');
    this.analogHourEl = this.ctx.mount.querySelector('[data-analog-hour]');
    this.analogMinuteEl = this.ctx.mount.querySelector('[data-analog-minute]');
    this.analogMarkerEl = this.ctx.mount.querySelector('[data-analog-marker]');
    this.analogTickEls = Array.from(this.ctx.mount.querySelectorAll('[data-analog-tick]'));
    this.flipDigitEls = Array.from(this.ctx.mount.querySelectorAll<HTMLElement>('[data-flip-index]'));
  }

  private scheduleNextTick(): void {
    this.stopClock();

    if (this.isAnalog()) {
      const tickAnalog = (): void => {
        const nowDate = new Date();
        this.analogMarkerRotation = (nowDate.getSeconds() + (nowDate.getMilliseconds() / 1000)) * 6;
        this.applyTimeToDom(this.getTimeForDate(nowDate), false);
        this.clockTimerId = setTimeout(tickAnalog, DisplayDuckWidget.ANALOG_REFRESH_MS);
      };
      tickAnalog();
      return;
    }

    const tick = (): void => {
      const now = Date.now();
      const leadMs = this.isFlip() ? DisplayDuckWidget.FLIP_DURATION_MS : 0;
      let delay = 1000 - (now % 1000) - leadMs;
      if (delay <= 0) delay += 1000;

      this.clockTimerId = setTimeout(() => {
        const baseNow = Date.now();
        const effectiveNow = this.isFlip() ? baseNow + DisplayDuckWidget.FLIP_DURATION_MS : baseNow;
        this.applyTimeToDom(this.getTimeForDate(new Date(effectiveNow)), false);
        tick();
      }, delay);
    };

    tick();
  }

  private stopClock(): void {
    if (this.clockTimerId) {
      clearTimeout(this.clockTimerId);
      this.clockTimerId = null;
    }
    for (const timeout of this.flipTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.flipTimeouts.clear();
  }

  private applyTimeToDom(time: ClockTime, forceInstantFlip: boolean): void {
    this.applyDigital(time);
    this.applyAnalog(time);
    this.applyFlip(time, forceInstantFlip);
  }

  private applyDigital(time: ClockTime): void {
    if (!this.digitalHourEl || !this.digitalMinuteEl) return;
    this.digitalHourEl.textContent = time.h;
    this.digitalMinuteEl.textContent = time.m;
    if (this.digitalSecondEl) {
      this.digitalSecondEl.textContent = time.s;
    }
  }

  private applyAnalog(time: ClockTime): void {
    if (!this.analogHourEl || !this.analogMinuteEl) return;

    const hourRotation = this.getAnalogHourRotation(time);
    const minuteRotation = this.getAnalogMinuteRotation(time);
    this.analogHourEl.setAttribute('transform', `rotate(${hourRotation})`);
    this.analogMinuteEl.setAttribute('transform', `rotate(${minuteRotation})`);

    if (this.analogMarkerEl) {
      this.analogMarkerEl.setAttribute('transform', `rotate(${this.analogMarkerRotation - 3} 0 0)`);
    }

    if (this.showSeconds()) {
      for (let index = 0; index < this.analogTickEls.length; index += 1) {
        const tickEl = this.analogTickEls[index];
        const distance = this.getAnalogTickDistance(index);
        tickEl.setAttribute('data-active', distance >= 0 ? String(distance) : '');
      }
    } else {
      for (const tickEl of this.analogTickEls) {
        tickEl.setAttribute('data-active', '');
      }
    }
  }

  private applyFlip(time: ClockTime, forceInstant: boolean): void {
    if (!this.flipDigitEls.length) return;
    const nextDigits = `${time.h}${time.m}${time.s}`.split('');

    for (let index = 0; index < this.flipDigitEls.length; index += 1) {
      const digitEl = this.flipDigitEls[index];
      const current = this.flipDigits[index] ?? { current: '0', next: '0', flipping: false };
      const next = nextDigits[index] ?? '0';

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
      }, DisplayDuckWidget.FLIP_DURATION_MS);

      this.flipTimeouts.set(index, timeout);
    }
  }

  private renderFlipDigit(index: number, digitEl: HTMLElement): void {
    const state = this.flipDigits[index];
    if (!state) return;

    digitEl.classList.toggle('flipping', state.flipping);

    const full = digitEl.querySelector<HTMLElement>('.digit-full');
    const staticTop = digitEl.querySelector<HTMLElement>('.digit-static.top .value');
    const staticBottom = digitEl.querySelector<HTMLElement>('.digit-static.bottom .value');
    const flipTop = digitEl.querySelector<HTMLElement>('.digit-flip.top .value');
    const flipBottom = digitEl.querySelector<HTMLElement>('.digit-flip.bottom .value');

    if (full) full.textContent = state.current;
    if (staticTop) staticTop.textContent = state.flipping ? state.next : state.current;
    if (staticBottom) staticBottom.textContent = state.current;
    if (flipTop) flipTop.textContent = state.current;
    if (flipBottom) flipBottom.textContent = state.next;
  }

  private getAnalogHourRotation(time: ClockTime): number {
    const hours = Number(time.h) % 12;
    const minutes = Number(time.m);
    return (hours + (minutes / 60)) * 30;
  }

  private getAnalogMinuteRotation(time: ClockTime): number {
    const minutes = Number(time.m);
    const seconds = Number(time.s);
    return (minutes + (seconds / 60)) * 6;
  }

  private getAnalogTickDistance(tick: number): number {
    const markerTick = ((Math.round(this.analogMarkerRotation / 6) % 60) + 60) % 60;
    if (!Number.isFinite(markerTick)) return -1;
    const distance = (markerTick - tick + 60) % 60;
    return distance <= 4 ? distance : -1;
  }

  private getCurrentTime(): ClockTime {
    return this.getTimeForDate(new Date());
  }

  private getTimeForDate(now: Date): ClockTime {
    const use24Hour = this.config.use24Hour === undefined ? true : Boolean(this.config.use24Hour);
    let hours = now.getHours();
    if (!use24Hour) {
      hours = hours % 12 || 12;
    }
    return {
      h: String(hours).padStart(2, '0'),
      m: String(now.getMinutes()).padStart(2, '0'),
      s: String(now.getSeconds()).padStart(2, '0'),
    };
  }

  private createFlipDigits(time: ClockTime): FlipDigitState[] {
    return `${time.h}${time.m}${time.s}`.split('').map((digit) => ({
      current: digit,
      next: digit,
      flipping: false,
    }));
  }

  private extractConfig(payload: WidgetPayload): Record<string, unknown> {
    const raw = (payload as { config?: unknown })?.config;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

    // @ts-ignore
    if(raw.hasOwnProperty('shadow')) this.shadows.set(Boolean(raw.shadow));
    return raw as Record<string, unknown>;
  }

  private extractWidgetName(payload: WidgetPayload): string {
    const name = (payload as { name?: unknown })?.name;
    return typeof name === 'string' ? name : '';
  }
}
