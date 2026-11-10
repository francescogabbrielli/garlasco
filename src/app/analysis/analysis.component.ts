import { Component, computed, inject, signal } from '@angular/core';
import { Schema } from '../../../amplify/data/resource';

import { UserProfileService } from '../user-profile.service';

import { MainComponent } from '../main/main.component';

import { HypothesisCardComponent } from './hypothesis-card/hypothesis-card.component';
import { HypothesisListComponent } from './hypothesis-list/hypothesis-list.component';
import { HypothesisMaskComponent } from './hypothesis-mask/hypothesis-mask.component';

type Hypothesis = Schema['Hypothesis']['type']

@Component({
  selector: 'app-analysis',
  imports: [HypothesisListComponent, HypothesisMaskComponent, HypothesisCardComponent],
  templateUrl: './analysis.component.html',
  styleUrl: './analysis.component.css',
})
export class AnalysisComponent {

  userService = inject(UserProfileService)
  main = inject(MainComponent)

  isEditing = computed(() => this.userService.user().editEnabled())

  selectedHypothesis = signal<Hypothesis | null>(null)

  createNewHypothesis() {
    
  }
}
