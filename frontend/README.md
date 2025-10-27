# Gemini AI - Analiza Sprzedaży i Zakupów

Aplikacja webowa do analizy sprzedaży i zarządzania zakupami z wykorzystaniem sztucznej inteligencji.

## Funkcjonalności

### 1. Dashboard
- Przegląd kluczowych wskaźników sprzedaży
- Wykresy sprzedaży tygodniowej
- Top 5 produktów
- Rekomendacje AI na dziś

### 2. Analiza Sprzedaży
- Szczegółowe raporty sprzedaży (dzienne, tygodniowe, miesięczne, roczne)
- Identyfikacja trendów i wzorców sezonowych
- Analiza kategorii produktów
- Rozkład transakcji w ciągu dnia
- Kluczowe wskaźniki: średnia wartość transakcji, marża, konwersja

### 3. Prognozowanie Popytu
- Przewidywanie przyszłej sprzedaży na podstawie danych historycznych
- Prognozy dla poszczególnych produktów
- Uwzględnienie sezonowości i wydarzeń specjalnych
- Wizualizacja przedziałów ufności
- Dokładność modelu AI

### 4. Sugestie Zakupów i Przecen
- Inteligentne rekomendacje zamówień
- Sugestie przecen dla wolno rotujących produktów
- Analiza rotacji towarów według kategorii
- Priorytety zamówień (krytyczny, wysoki, średni, niski)
- Potencjalne oszczędności

### 5. Martwe Zapasy i Alerty
- Identyfikacja produktów o niskiej rotacji
- Analiza kosztów martwych zapasów
- Sugestie działań dla upłynnienia zalegających towarów
- Alerty i powiadomienia
- Plan działania rekomendowany przez AI

### 6. Ustawienia
- Konfiguracja integracji z systemem Subiekt
- Wybór danych do gromadzenia
- Konfiguracja alertów i powiadomień
- Ustawienia bezpieczeństwa i prywatności
- Zarządzanie modelem AI

## Technologie

- **React 18** - biblioteka do budowy interfejsu użytkownika
- **React Router** - routing po stronie klienta
- **Recharts** - biblioteka do wizualizacji danych
- **Tailwind CSS** - framework CSS do stylizacji
- **Lucide React** - ikony
- **Vite** - narzędzie do budowania projektu

## Instalacja

### Wymagania wstępne

- Node.js (wersja 18 lub nowsza)
- npm lub yarn

### Kroki instalacji

1. Przejdź do folderu frontend:
```bash
cd frontend
```

2. Zainstaluj zależności:
```bash
npm install
```

3. Uruchom serwer deweloperski:
```bash
npm run dev
```

4. Otwórz przeglądarkę i wejdź na adres:
```
http://localhost:3000
```

## Dostępne komendy

- `npm run dev` - uruchamia serwer deweloperski
- `npm run build` - buduje aplikację do produkcji
- `npm run preview` - podgląd zbudowanej aplikacji

## Struktura projektu

```
frontend/
├── src/
│   ├── components/
│   │   └── Layout/
│   │       ├── Layout.jsx      # Główny layout aplikacji
│   │       ├── Header.jsx      # Nagłówek
│   │       └── Sidebar.jsx     # Menu boczne
│   ├── pages/
│   │   ├── Dashboard.jsx           # Strona główna
│   │   ├── SalesAnalysis.jsx       # Analiza sprzedaży
│   │   ├── DemandForecast.jsx      # Prognozowanie popytu
│   │   ├── PurchaseSuggestions.jsx # Sugestie zakupów
│   │   ├── DeadStock.jsx           # Martwe zapasy
│   │   └── Settings.jsx            # Ustawienia
│   ├── App.jsx                 # Główny komponent aplikacji
│   ├── main.jsx               # Punkt wejścia
│   └── index.css              # Style globalne
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

## Integracja z Subiekt

Aplikacja jest zaprojektowana do integracji z systemem Subiekt GT. W panelu ustawień możesz skonfigurować:

- Ścieżkę do bazy danych Subiekt
- Częstotliwość synchronizacji danych
- Jakie dane mają być gromadzone

### Zalecane dane do gromadzenia:

1. **Szczegółowe dane klientów** - dla lepszej personalizacji
2. **Dokładne czasy transakcji** - analiza szczytów sprzedaży
3. **Informacje o promocjach** - efektywność akcji marketingowych
4. **Terminy ważności produktów** - zarządzanie produktami spożywczymi
5. **Koszty zakupu i marże** - analiza rentowności

## Dalszy rozwój

Projekt jest szablonem demonstracyjnym. Aby w pełni wykorzystać potencjał aplikacji, należy:

1. **Podłączyć prawdziwe API** - obecnie dane są mockowane
2. **Zaimplementować backend** - do przetwarzania danych i komunikacji z AI
3. **Skonfigurować Gemini AI** - dla rzeczywistych prognoz i rekomendacji
4. **Dodać autentykację** - system logowania użytkowników
5. **Zaimplementować rzeczywistą integrację z Subiekt** - synchronizacja danych

## Wsparcie

W razie pytań lub problemów, skontaktuj się z zespołem technicznym.

## Licencja

Aplikacja demonstracyjna - wszystkie prawa zastrzeżone.
