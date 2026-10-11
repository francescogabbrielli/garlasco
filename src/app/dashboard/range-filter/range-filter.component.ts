import { Component, effect, input, OnInit, output } from '@angular/core'; // Usiamo output (funzione, non decoratore)
import { FormsModule } from '@angular/forms';
import { MatSliderModule } from '@angular/material/slider';
import { CommonModule } from '@angular/common';

export interface TimelineTick {
  positionPercent: number
  label: string
  type: "day" | "sunday" | "month" | "year"
}

@Component({
  selector: 'app-range-filter',
  standalone: true,
  imports: [MatSliderModule, FormsModule, CommonModule],
  templateUrl: './range-filter.component.html',
  styleUrls: ['./range-filter.component.css']
})
export class RangeFilterComponent implements OnInit {
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

  constructor() {
    effect(() => {
      this.minTimestamp = this.initialFrom()?.getTime() || 0
      this.maxTimestamp = this.initialTo()?.getTime() || Date.now()
      
      // Finestra iniziale visibile dello slider impostata a 6 mesi intorno ai valori iniziali
      this.currentAbsoluteMin = this.initialMin()?.getTime() || Math.max(this.minimum().getTime(), this.minTimestamp)
      this.currentAbsoluteMax = this.initialMax()?.getTime() || Math.min(this.maximum().getTime(), this.maxTimestamp)
      
      this.updateStep();
      this.generateTimeline();
    })
  }

  ngOnInit(): void {
    this.minTimestamp = this.minTimestamp ?? this.initialFrom()?.getTime()
    this.maxTimestamp = this.maxTimestamp ?? this.initialTo()?.getTime()
    this.updateStep()
    this.generateTimeline()
  }

  onWheel(event: WheelEvent): void {
    if (!event.ctrlKey) return
    event.preventDefault()

    const viewCenter = (this.minTimestamp + this.maxTimestamp) / 2;
    let viewHalfWidth = (this.currentAbsoluteMax - this.currentAbsoluteMin) / 2;

    if (event.deltaY > 0) {
      viewHalfWidth = viewHalfWidth * (1 + this.ZOOM_FACTOR); // Zoom Out
    } else {
      viewHalfWidth = viewHalfWidth * (1 - this.ZOOM_FACTOR); // Zoom In
    }

    // Non scendere sotto 1 giorno visibile totale
    if (viewHalfWidth < (this.ONE_DAY / 2)) 
      viewHalfWidth = this.ONE_DAY / 2

    // Limite massimo dello zoom (non oltre l'intervallo totale disponibile)
    const maxHalfWidth = (this.maximum().getTime() - this.minimum().getTime()) / 2
    if (viewHalfWidth > maxHalfWidth) 
      viewHalfWidth = maxHalfWidth

    let newAbsMin = Math.round(viewCenter - viewHalfWidth);
    let newAbsMax = Math.round(viewCenter + viewHalfWidth);

    /*if (newAbsMin < this.minimum().getTime()) {
      newAbsMin = this.minimum().getTime()
      newAbsMax = Math.min(this.maximum().getTime(), Math.round(newAbsMin + (viewHalfWidth * 2)))
    }
    if (newAbsMax > this.maximum().getTime()) {
      newAbsMax = this.maximum().getTime()
      newAbsMin = Math.max(this.minimum().getTime(), Math.round(newAbsMax - (viewHalfWidth * 2)))
    }*/

    this.currentAbsoluteMin = newAbsMin
    this.currentAbsoluteMax = newAbsMax

    this.updateStep()
    this.clampSelectedValues()
    this.generateTimeline() // Rigenera la timeline con i nuovi limiti zoomati
  }

 /**
   * Scansiona l'intervallo visibile e calcola i punti di inizio di ogni mese
   */
  generateTimeline(): void {
    const ticks: TimelineTick[] = [];
    const totalDuration = this.currentAbsoluteMax - this.currentAbsoluteMin;

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
      if (currentScan.getDay() === 0) {
        type = "sunday"
      }

      if (type === "year" || type === "month" && (isMonthVisible || isSixthMonthVisible) || type.endsWith("day") && (isDayVisible || isFiveDayVisible)) {
        ticks.push({
          positionPercent,
          label: label,
          type: type
        })
      }

      if (totalDuration > this.ONE_DAY * 2000)
        currentScan.setFullYear(currentScan.getFullYear() + 1)
      else if (totalDuration > this.ONE_DAY * 120)
        currentScan.setMonth(currentScan.getMonth() + 1)
      else
        currentScan.setDate(currentScan.getDate() + 1)
    
    }

    this.timelineTicks = ticks

  }

  onSliderChange(): void {
    this.updateStep()
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
    const options:Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', year: '2-digit' }
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
