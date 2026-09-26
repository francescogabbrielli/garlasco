import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { generateClient } from 'aws-amplify/data';

import type { Schema } from '../../../../amplify/data/resource'; 

const client = generateClient<Schema>();

@Component({
  selector: 'app-import',
  imports: [CommonModule, FormsModule],
  templateUrl: './import.component.html',
  styleUrl: './import.component.css',
})
export class ImportComponent {

  @Input() ownerId:string = "";

  jsonInput = signal<string>('');
  isLoading = signal<boolean>(false);

  async eseguiUploadDaTextarea() {
    const rawText = this.jsonInput().trim();
    
    if (!rawText) {
      alert("⚠️ L'area di testo è vuota. Incolla prima un JSON valido.");
      return;
    }

    let dataset: Schema['Event']['type'][];
    
    // 1. Validazione sintattica del JSON inserito
    try {
      const parsing = JSON.parse(rawText);
      dataset = Array.isArray(parsing) ? parsing : [parsing];
    } catch (e) {
      alert("❌ Errore di sintassi nel JSON. Verifica che le virgolette e le virgole siano corrette.");
      console.error(e);
      return;
    }

    this.isLoading.set(true);
    console.log(`Avvio importazione di ${dataset.length} elementi da textarea...`);

    let contatoreSuccessi = 0;

    try {
      for (const event of dataset) {
        // Valida la presenza dei campi minimi prima dell'invio
        if (!event.name || !event.start_date || !event.start_position) {
          console.warn("Elemento saltato per mancanza di campi obbligatori:", event);
          continue;
        }

        // AWS Amplify inserisce automaticamente l'ID univoco mancante
        await client.models['Event'].create({
          owner: this.ownerId,
          name: event.name,
          description: event.description || '',
          start_date: event.start_date,
          start_position: {
            latitude: Number(event.start_position.latitude),
            longitude: Number(event.start_position.longitude),
            radius: Number(event.start_position.radius ?? 0)
          },
          center_position: {
            latitude: Number(event.start_position.latitude),
            longitude: Number(event.start_position.longitude),
            radius: Number(event.start_position.radius ?? 0)
          },
          geoHash: event.geoHash,
          relevance: 0,
          reliability: 0
        });
        
        contatoreSuccessi++;
      }
      
      alert(`🎉 Importazione completata! Caricati con successo ${contatoreSuccessi} su ${dataset.length} eventi.`);
      this.cleanInputData();
    } catch (errore) {
      console.error("Errore durante l'invio a DynamoDB:", errore);
      alert("Ops! Si è verificato un errore di comunicazione con AWS. Controlla la console degli sviluppatori.");
    } finally {
      this.isLoading.set(false);
    }
  }

  cleanInputData() {
    this.jsonInput.set('');
  }
}
