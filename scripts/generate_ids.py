import json
import uuid

def calcola_geohash(latitude, longitude, precision=5):
    """Calcola il geohash standard in Base32 per una coppia di coordinate."""
    base32 = "0123456789bcdefghjkmnpqrstuvwxyz"
    lat_interval = (-90.0, 90.0)
    lon_interval = (-180.0, 180.0)
    geohash = []
    bits = [16, 8, 4, 2, 1]
    bit = 0
    ch = 0
    even = True
    
    while len(geohash) < precision:
        if even:
            mid = (lon_interval[0] + lon_interval[1]) / 2
            if longitude > mid:
                ch |= bits[bit]
                lon_interval = (mid, lon_interval[1])
            else:
                lon_interval = (lon_interval[0], mid)
        else:
            mid = (lat_interval[0] + lat_interval[1]) / 2
            if latitude > mid:
                ch |= bits[bit]
                lat_interval = (mid, lat_interval[1])
            else:
                lat_interval = (lat_interval[0], mid)
        even = not even
        if bit < 4:
            bit += 1
        else:
            geohash.append(base32[ch])
            bit = 0
            ch = 0
    return "".join(geohash)

# Inserisci qui i nomi dei file separati che hai scaricato
file_sorgenti = ['timeline_garlasco.json']
record_finali = []

for nome_file in file_sorgenti:
    try:
        with open(nome_file, 'r', encoding='utf-8') as f:
            dati = json.load(f)
            # Normalizza l'input se è un oggetto singolo invece di un array
            lista_elementi = dati if isinstance(dati, list) else [dati]
            
            for item in lista_elementi:
                # 1. Iniezione ID univoco richiesto in automatico da AWS Amplify
                item['id'] = str(uuid.uuid4())
                
                # 2. Estrazione coordinate e calcolo del GeoHash
                lat = item['start_position']['latitude']
                lon = item['start_position']['longitude']
                
                # Genera il prefisso (es: "u0n35" per Garlasco)
                item['geoHash'] = calcola_geohash(lat, lon, precision=5)
                
                record_finali.append(item)
    except FileNotFoundError:
        print(f"Nota: Il file {nome_file} non è stato trovato nella cartella corrente, salto...")

# Scrittura del file unificato finale pronto per la console AWS
file_output = 'pronto_per_aws_console.json'
with open(file_output, 'w', encoding='utf-8') as f:
    json.dump(record_finali, f, indent=2, ensure_ascii=False)

print(f"\nElaborazione completata con successo!")
print(f"File generato: '{file_output}' contenente {len(record_finali)} record pronti.")
