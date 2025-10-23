from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import re

app = FastAPI(title="Odmiana Imion - Microserwis", version="1.0.0")

# TODO: Dodać Morfeusz 2 gdy będzie dostępny dla Python 3.13

class VocativeRequest(BaseModel):
    firstName: str
    language: str = "pl"  # pl, de, en, fr

class VocativeResponse(BaseModel):
    vocative: str
    gender: str  # M, F, U (unknown)
    greeting: str  # "Dzień dobry Panie/Pani"
    confidence: float  # 0.0 - 1.0

def polish_name_rules(firstName: str) -> tuple[str, str, float]:
    """Zaawansowane reguły dla polskich imion"""
    name = firstName.strip()
    name_lower = name.lower()
    
    # Słownik typowych polskich imion i ich odmian
    polish_names = {
        # Męskie imiona
        'piotr': ('Piotrze', 'M'),
        'jan': ('Janie', 'M'),
        'andrzej': ('Andrzeju', 'M'),
        'tomasz': ('Tomaszu', 'M'),
        'paweł': ('Pawle', 'M'),
        'michał': ('Michałe', 'M'),
        'krzysztof': ('Krzysztofie', 'M'),
        'jakub': ('Jakubie', 'M'),
        'mateusz': ('Mateuszu', 'M'),
        'adam': ('Adamie', 'M'),
        'łukasz': ('Łukaszu', 'M'),
        'szymon': ('Szymonie', 'M'),
        'bartosz': ('Bartoszu', 'M'),
        'krystian': ('Krystianie', 'M'),
        'grzegorz': ('Grzegorzu', 'M'),
        'marcin': ('Marcinie', 'M'),
        'damian': ('Damianie', 'M'),
        'michał': ('Michałe', 'M'),
        'dawid': ('Dawidzie', 'M'),
        'kamil': ('Kamilu', 'M'),
        'marcin': ('Marcinie', 'M'),
        'rafał': ('Rafale', 'M'),
        'mariusz': ('Mariuszu', 'M'),
        'robert': ('Robercie', 'M'),
        'artur': ('Arturze', 'M'),
        'przemysław': ('Przemysławie', 'M'),
        'radosław': ('Radosławie', 'M'),
        'mariusz': ('Mariuszu', 'M'),
        'paweł': ('Pawle', 'M'),  # Poprawna forma z ł
        'pawel': ('Pawle', 'M'),  # Forma bez ł (Apollo.io)
        'michal': ('Michale', 'M'),  # Michal -> Michale (bez ł)
        'lukasz': ('Łukaszu', 'M'),  # Łukasz bez ł
        
        # Żeńskie imiona
        'anna': ('Anno', 'F'),
        'maria': ('Mario', 'F'),
        'katarzyna': ('Katarzyno', 'F'),
        'małgorzata': ('Małgorzato', 'F'),
        'agnieszka': ('Agnieszko', 'F'),
        'krystyna': ('Krystyno', 'F'),
        'monika': ('Moniko', 'F'),
        'joanna': ('Joanno', 'F'),
        'magdalena': ('Magdaleno', 'F'),
        'elżbieta': ('Elżbieto', 'F'),
        'danuta': ('Danuto', 'F'),
        'ewa': ('Ewo', 'F'),
        'barbara': ('Barbaro', 'F'),
        'teresa': ('Tereso', 'F'),
        'halina': ('Halino', 'F'),
        'helena': ('Heleno', 'F'),
        'grażyna': ('Grażyno', 'F'),
        'jolanta': ('Jolanto', 'F'),
        'stanisława': ('Stanisławo', 'F'),
        'renata': ('Renato', 'F'),
        'aleksandra': ('Aleksandro', 'F'),
        'beata': ('Beato', 'F'),
        'dorota': ('Doroto', 'F'),
        'iwona': ('Iwono', 'F'),
        'justyna': ('Justyno', 'F'),
        'patrycja': ('Patrycjo', 'F'),
        'sylwia': ('Sylwio', 'F'),
        'natalia': ('Natalio', 'F'),
        'marta': ('Marto', 'F'),
        'karolina': ('Karolino', 'F'),
        'paulina': ('Paulino', 'F'),
        'marlena': ('Marleno', 'F'),
        'aleksandra': ('Aleksandro', 'F'),
        'wiktoria': ('Wiktorio', 'F'),
        'olga': ('Olgo', 'F'),
        'wanda': ('Wando', 'F'),
    }
    
    # Sprawdź w słowniku
    if name_lower in polish_names:
        vocative, gender = polish_names[name_lower]
        return vocative, gender, 0.95
    
    # Proste reguły fallback
    # Typowe końcówki żeńskie
    if name_lower.endswith('a') and len(name) > 3:
        vocative = name[:-1] + 'o'  # Anna -> Anno
        return vocative, 'F', 0.7
    
    # Typowe końcówki męskie na -ek
    if name_lower.endswith('ek') and len(name) > 3:
        vocative = name[:-2] + 'ku'  # Marek -> Marku
        return vocative, 'M', 0.7
    
    # Typowe końcówki męskie na -ek
    if name_lower.endswith('ek') and len(name) > 3:
        vocative = name[:-2] + 'ku'  # Marek -> Marku
        return vocative, 'M', 0.7
    
    # Końcówki -ski, -cki (nazwiska)
    if name_lower.endswith(('ski', 'cki', 'dzki')):
        return name, 'M', 0.8
    
    # Domyślne - traktuj jako męskie bez odmiany
    return name, 'M', 0.3

# TODO: Dodać Morfeusz 2 gdy będzie dostępny
def analyze_name(firstName: str) -> tuple[str, str, float]:
    """Analiza imienia - obecnie używamy reguł, w przyszłości Morfeusz 2"""
    return polish_name_rules(firstName)

def generate_greeting(firstName: str, vocative: str, gender: str, language: str) -> str:
    """Generuje powitanie w odpowiednim języku"""
    if language == "pl":
        if gender == 'F':
            return f"Dzień dobry Pani {vocative}"
        elif gender == 'M':
            return f"Dzień dobry Panie {vocative}"
        else:
            return f"Dzień dobry {firstName}"
    elif language == "de":
        # Niemiecki - per nazwisko (jak ustalaliśmy)
        return f"Guten Tag Herr/Frau {firstName}"
    elif language == "en":
        return f"Good day {firstName}"
    elif language == "fr":
        return f"Bonjour {firstName}"
    else:
        return f"Dzień dobry {firstName}"

@app.post("/vocative", response_model=VocativeResponse)
async def get_vocative(request: VocativeRequest):
    """Pobiera formę wołacza dla podanego imienia"""
    try:
        firstName = request.firstName.strip()
        
        if not firstName:
            raise HTTPException(status_code=400, detail="Imię nie może być puste")
        
        # Dla niemieckiego - per nazwisko
        if request.language == "de":
            vocative = firstName
            gender = 'U'
            confidence = 0.8
        else:
            # Analiza przez reguły (w przyszłości Morfeusz 2)
            vocative, gender, confidence = analyze_name(firstName)
        
        # DEBUG: Dodaj log
        print(f"DEBUG: {firstName} -> confidence: {confidence}")
        
        # Generuj powitanie - tylko jeśli mamy wysoką pewność
        if confidence >= 0.8:
            greeting = generate_greeting(firstName, vocative, gender, request.language)
        else:
            # Niska pewność - zwróć tylko "Dzień dobry"
            if request.language == "pl":
                greeting = "Dzień dobry"
            elif request.language == "de":
                greeting = "Guten Tag"
            elif request.language == "en":
                greeting = "Good day"
            elif request.language == "fr":
                greeting = "Bonjour"
            else:
                greeting = "Dzień dobry"
        
        return VocativeResponse(
            vocative=vocative,
            gender=gender,
            greeting=greeting,
            confidence=confidence
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Błąd przetwarzania: {str(e)}")

@app.get("/health")
async def health_check():
    """Sprawdzenie stanu serwisu"""
    return {"status": "healthy", "service": "morfeusz2"}

@app.get("/")
async def root():
    """Strona główna"""
    return {
        "service": "Morfeusz 2 - Odmiana Imion",
        "version": "1.0.0",
        "endpoints": {
            "POST /vocative": "Pobierz formę wołacza",
            "GET /health": "Sprawdzenie stanu",
            "GET /": "Informacje o serwisie"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
