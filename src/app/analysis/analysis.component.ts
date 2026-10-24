import { Component, inject } from '@angular/core';
import { MainComponent } from '../main/main.component';

@Component({
  selector: 'app-analysis',
  imports: [],
  templateUrl: './analysis.component.html',
  styleUrl: './analysis.component.css',
})
export class AnalysisComponent {

  main = inject(MainComponent)

}
