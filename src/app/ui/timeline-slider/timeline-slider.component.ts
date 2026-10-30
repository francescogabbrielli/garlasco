import { Component, effect, input, model, OnInit, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatSliderModule } from '@angular/material/slider';
import { CommonModule } from '@angular/common';

export interface TimelineTick {
  positionPercent: number
  label: string
  type: "day" | "sunday" | "month" | "year"
}

@Component({
  selector: 'app-timeline-slider',
  standalone: true,
  imports: [MatSliderModule, FormsModule, CommonModule],
  templateUrl: './timeline-slider.component.html',
  styleUrls: ['./timeline-slider.component.css']
})
export class TimelineSliderComponent implements OnInit {
  readonly ONE_MINUTE = 60 * 1000;
  readonly ONE_HOUR = 60 * this.ONE_MINUTE;
  readonly ONE_DAY = 24 * this.ONE_HOUR;

  currentAbsoluteMin!: number
  currentAbsoluteMax!: number
  minTimestamp!: number
  maxTimestamp!: number

  initialFrom = input<Date>()
  initialTo = input<Date>()
  initialMin = input<Date>()
  initialMax = input<Date>()
  maximum = input<Date>(new Date())
  minimum = input<Date>(new Date(0))

  readonly ZOOM_FACTOR = 0.10;
  currentStep: number = this.ONE_MINUTE;

  // Array delle tacche renderizzate sotto lo slider
  timelineTicks: TimelineTick[] = [];
  
  rangeChange = output<{from: Date, to: Date, min: Date, max: Date}>();

  active = model(true)

  ngOnInit(): void {
    this.minTimestamp = this.initialFrom()?.getTime() ?? 0
    this.maxTimestamp = this.initialTo()?.getTime() ?? Date.now()
    
    // Finestra iniziale visibile dello slider impostata a 6 mesi intorno ai valori iniziali
    this.currentAbsoluteMin = this.initialMin()?.getTime() ?? Math.max(this.minimum().getTime(), this.minTimestamp)
    this.currentAbsoluteMax = this.initialMax()?.getTime() ?? Math.min(this.maximum().getTime(), this.maxTimestamp)
    
    this.updateStep()
    this.generateTimeline()
  }

  private updateViewRange(viewHalfWidth: number): void {
    const viewCenter = (this.currentAbsoluteMin + this.currentAbsoluteMax) / 2;

    const availableMin = this.minimum().getTime();
    const availableMax = this.maximum().getTime();
    const maxHalfWidth = Math.max(0, (availableMax - availableMin) / 2);
    
    viewHalfWidth = Math.min(viewHalfWidth, maxHalfWidth);
    if (viewHalfWidth < this.ONE_DAY / 2) {
      viewHalfWidth = Math.min(this.ONE_DAY / 2, maxHalfWidth);
    }

    let newAbsoluteMin = Math.round(viewCenter - viewHalfWidth);
    let newAbsoluteMax = Math.round(viewCenter + viewHalfWidth);

    if (newAbsoluteMin < availableMin) {
      newAbsoluteMax += availableMin - newAbsoluteMin;
      newAbsoluteMin = availableMin;
    }
    if (newAbsoluteMax > availableMax) {
      newAbsoluteMin -= newAbsoluteMax - availableMax;
      newAbsoluteMax = availableMax;
    }

    this.currentAbsoluteMin = newAbsoluteMin;
    this.currentAbsoluteMax = newAbsoluteMax;

    this.updateStep();
    this.clampSelectedValues();
    this.generateTimeline();
  }

  onWheel(event: WheelEvent): void {
    if (!event.ctrlKey) return
    event.preventDefault()
    
    let viewHalfWidth = Math.abs(this.currentAbsoluteMax - this.currentAbsoluteMin) / 2;

    if (event.deltaY > 0) {
      viewHalfWidth = viewHalfWidth * (1 + this.ZOOM_FACTOR); // Zoom Out
    } else {
      viewHalfWidth = viewHalfWidth * (1 - this.ZOOM_FACTOR); // Zoom In
    }

    this.updateViewRange(viewHalfWidth)
  }

  private initialTouchDistance: number = 0
  private initialViewHalfWidth: number = 0

  onTouchStart(event: TouchEvent): void {
    if (event.touches.length === 2) {
      event.preventDefault()
      this.initialTouchDistance = this.getTouchDistance(event.touches[0], event.touches[1])
      this.initialViewHalfWidth = Math.abs(this.currentAbsoluteMax - this.currentAbsoluteMin) / 2
    }
  }

  onTouchMove(event: TouchEvent): void {
    if (event.touches.length === 2 && this.initialTouchDistance > 0) {
      event.preventDefault()

      const currentDistance = this.getTouchDistance(event.touches[0], event.touches[1])
      
      // Calcoliamo il nuovo half-width basato sul rapporto rispetto all'inizio del pinch
      const scale = this.initialTouchDistance / currentDistance
      const viewHalfWidth = this.initialViewHalfWidth * scale

      this.updateViewRange(viewHalfWidth)
    }
  }

  onTouchEnd(event: TouchEvent): void {
    // Reset opzionale quando si sollevano le dita
    if (event.touches.length < 2) {
      this.initialTouchDistance = 0
    }
  }

  // Helper geometrico per la distanza tra due dita
  private getTouchDistance(touch1: Touch, touch2: Touch): number {
    const dx = touch2.clientX - touch1.clientX
    const dy = touch2.clientY - touch1.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

 /**
   * Scansiona l'intervallo visibile e calcola i punti di inizio di ogni mese
   */
  generateTimeline(): void {
    const ticks: TimelineTick[] = [];
    const totalDuration = this.currentAbsoluteMax - this.currentAbsoluteMin;
    if (totalDuration <= 0) {
      this.timelineTicks = ticks;
      return;
    }

    const startDate = new Date(this.currentAbsoluteMin);
    const endDate = new Date(this.currentAbsoluteMax);

    // Impostiamo la scansione al primo giorno del mese corrente per allineare le tacche
    const currentScan = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

    while (currentScan.getTime() <= endDate.getTime()) {

      const tickTime = currentScan.getTime()

      if (tickTime < this.currentAbsoluteMin) {
        currentScan.setDate(currentScan.getDate() + 1)
        continue
      }

      // Calcola la percentuale di distanza dall'inizio dello slider (0% - 100%)
      const positionPercent = ((tickTime - this.currentAbsoluteMin) / totalDuration) * 100;
      
      const isDayVisible = totalDuration < this.ONE_DAY * 40
      const isFiveDayVisible = currentScan.getDate() % 5 === 0 && totalDuration < this.ONE_DAY * 120 && currentScan.getDate() < 30
      const isMonthVisible = totalDuration < this.ONE_DAY * 600
      const isSixthMonthVisible = currentScan.getMonth() === 6  && totalDuration < this.ONE_DAY * 2000
      const isFirstMonth = currentScan.getMonth() === 0 || totalDuration > this.ONE_DAY * 2000
      const isFirstOfMonth = currentScan.getDate() === 1 || totalDuration > this.ONE_DAY * 120

      let type: "day" | "sunday" | "month" | "year" = "day"
      let label = currentScan.getDate().toString().padStart(2, '0')

      if (isFirstMonth && isFirstOfMonth) {
        type = "year"
        label = currentScan.getFullYear().toString();
      } else if (isFirstOfMonth) {
        type = "month"
        label = currentScan.toLocaleString('it-IT', { month: 'short' })
      } 

      if (totalDuration > this.ONE_DAY * 2000) {
        currentScan.setFullYear(currentScan.getFullYear() + 1)
      } else if (totalDuration > this.ONE_DAY * 120) {
        currentScan.setMonth(currentScan.getMonth() + 1)
      } else {
        if (currentScan.getDay() === 0)
          type = "sunday"    
        currentScan.setDate(currentScan.getDate() + 1)
      }

      if (type === "year" || type === "month" && (isMonthVisible || isSixthMonthVisible) || type.endsWith("day") && (isDayVisible || isFiveDayVisible)) {
        ticks.push({
          positionPercent,
          label: label,
          type: type
        })
      }

    }

    this.timelineTicks = ticks

  }

  onSliderChange(): void {
    //this.updateStep()
    this.emitChange()
  }

  emitChange(): void {
    this.rangeChange.emit({
      from: new Date(this.minTimestamp),
      to: new Date(this.maxTimestamp),
      min: new Date(this.currentAbsoluteMin),
      max: new Date(this.currentAbsoluteMax)
    });
  }

  updateStep(): void {
    const totalViewWidth = this.currentAbsoluteMax - this.currentAbsoluteMin;
    if (totalViewWidth > 30 * this.ONE_DAY) this.currentStep = this.ONE_DAY;
    else if (totalViewWidth > 5 * this.ONE_DAY) this.currentStep = 6 * this.ONE_HOUR;
    else if (totalViewWidth > 1 * this.ONE_DAY) this.currentStep = this.ONE_HOUR;
    else this.currentStep = 15 * this.ONE_MINUTE;

    this.minTimestamp = Math.round(this.minTimestamp / this.currentStep) * this.currentStep;
    this.maxTimestamp = Math.round(this.maxTimestamp / this.currentStep) * this.currentStep;
  }

  private clampSelectedValues(): void {
    let changed = false;
    if (this.minTimestamp < this.currentAbsoluteMin) { this.minTimestamp = this.currentAbsoluteMin; changed = true; }
    if (this.maxTimestamp > this.currentAbsoluteMax) { this.maxTimestamp = this.currentAbsoluteMax; changed = true; }
    if (changed) this.emitChange()
  }

  getFormattedInterval(): string {
    const start = new Date(this.minTimestamp);
    const end = new Date(this.maxTimestamp);
    const options:Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', year: 'numeric' }
    return `${start.toLocaleString('it-IT', options)} — ${end.toLocaleString('it-IT', options)}`;
  }

  /*
  getFormattedInterval(): string {
    const start = new Date(this.min);
    const end = new Date(this.max);
    const width = this.max - this.min;

    let options: Intl.DateTimeFormatOptions;

    if (width > 5 * this.ONE_DAY) {
      options = { day: '2-digit', month: 'short', year: 'numeric' };
    } else if (width > 1 * this.ONE_DAY) {
      options = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', year: 'numeric' };
    } else {
      options = { hour: '2-digit', minute: '2-digit' };
    }

    return `${start.toLocaleString('it-IT', options)} — ${end.toLocaleString('it-IT', options)}`;
  }
  */
}
