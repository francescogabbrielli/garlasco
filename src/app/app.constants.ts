export const LABEL_MAP = (l: string, v: number) => {return {label: l, value: v}}

export const RELIABILITY_LABELS:string[] = [
    'Da revisionare',
    'Voci / rumors',
    'Alcune fonti',
    'Contestato da alcune fonti',
    'Affidabile',
]

export const RELEVANCE_LABELS:string[] = [
    'Irrilevante',
    'Marginale',
    'Vagamente',
    'Fortemente collegato',
    'Rilevante'
]

export const DEFAULT_COORDINATES = {
    latitude: 45.1974,
    longitude: 8.9247,
    radius: 1000,
}