import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-tickbar',
  imports: [],
  templateUrl: './tickbar.component.html',
  styleUrl: './tickbar.component.scss',
})
export class TickbarComponent {
  // Input per definire il livello corrente (valore da 0 a 4)
  level = input(0)

  // Array per le 4 tacche totali
  protected readonly ticks = [1, 2, 3, 4];

  // Calcola lo stato cromatico del componente
  protected statusColor = computed(() => {
    if (this.level() === 0) return 'empty';
    if (this.level() === 1) return 'critical';
    if (this.level() === 2) return 'low';
    return 'healthy';
  });
}
