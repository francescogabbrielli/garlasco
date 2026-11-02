export interface BotError {
  source: 'BEDROCK' | 'TAVILY' | 'APPLICATION' | 'UNKNOWN';
  code: string;
  message: string;
  retryable: boolean;
  retryAfterSeconds?: number;
  requestId?: string;
}

export class BotServiceError extends Error {
  constructor(readonly details: BotError) {
    super(JSON.stringify(details));
    this.name = 'BotServiceError';
  }
}

export interface BotDefinition {
  definition: string;
  name: string;
  capabilities: string;
  // Aggiungi gli altri campi presenti nel catalogo.
}

export const bots = [
    { 
        name: 'Archivista', 
        capabilities: 'Analizza eventi nel database', 
        definition: 'analyst'
    },
    { 
        name: 'Ricercatore', 
        capabilities: 'Cerca riscontri sul web', 
        definition: 'researcher'
    },
    { 
        name: 'Investigatore', 
        capabilities: 'Analizza eventi e cerca riscontri sul web', 
        definition: 'detective'
    }
] as const satisfies readonly BotDefinition[]
