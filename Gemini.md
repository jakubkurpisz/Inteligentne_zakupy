# Gemini AI w Analizie Sprzedaży i Zakupów

## Cel Aplikacji:
Nasza aplikacja, "Gemini AI w Analizie Sprzedaży i Zakupów", ma na celu zrewolucjonizowanie sposobu, w jaki firmy podejmują decyzje handlowe. Wykorzystując zaawansowane algorytmy sztucznej inteligencji, narzędzie to dostarcza codziennego, zautomatyzowanego wsparcia w kluczowych obszarach działalności: od analizy sprzedaży, przez prognozowanie popytu, aż po optymalizację zapasów. Chcemy pokazać, że AI może być intuicyjnym i nieocenionym partnerem w dążeniu do maksymalizacji zysków i minimalizacji strat.

## Kluczowe Funkcjonalności:

### 1. Automatyczne Analizy Sprzedaży i Trendów
*   **Cel:** Dostarczanie kompleksowych raportów i identyfikacja wzorców sprzedażowych.
*   **Wymagane Dane:** `DataSprzedazy`, `IloscSprzedana`, `WartoscNetto`, `WartoscBrutto`, `Rodzaj`, `TowarId`, `Marka`, `Sezon`.
*   **1.1. Raporty Sprzedaży:**
    *   **1.1.1. Raport Dzienny:** Prezentacja sumarycznej sprzedaży netto/brutto, liczby transakcji, średniej wartości transakcji dla wybranego dnia. Wizualizacja: Wykres słupkowy sprzedaży netto/brutto w podziale na dni.
    *   **1.1.2. Raport Okresowy (Tygodniowy, Miesięczny, Sezonowy, Roczny):** Agregacja danych dziennych, porównanie z poprzednim analogicznym okresem (wartość bezwzględna i procentowa zmiana). Wizualizacja: Wykres liniowy trendu sprzedaży netto/brutto w danym okresie.
*   **1.2. Identyfikacja Trendów i Wzorców:**
    *   **1.2.1. Wzorce Sezonowe:** Automatyczne wykrywanie cyklicznych wzrostów/spadków sprzedaży dla poszczególnych produktów/kategorii/marek.
    *   **1.2.2. Anomalie:** Definicja anomalii jako odchylenie sprzedaży o >X% (konfigurowalne przez użytkownika) od średniej lub prognozy dla danego okresu. System alertów w przypadku wykrycia anomalii.
*   **1.3. Wizualizacje:** Interaktywne wykresy i dashboardy umożliwiające filtrowanie i drążenie danych (drill-down) według daty, produktu, kategorii, marki, sezonu, płci, koloru, rozmiaru.

### 2. Prognozowanie Popytu
*   **Cel:** Precyzyjne przewidywanie przyszłego popytu na produkty w celu optymalizacji zatowarowania.
*   **Wymagane Dane:** Minimum 2 lata historycznych danych sprzedażowych (`DataSprzedazy`, `TowarId`, `IloscSprzedana`), opcjonalnie dane o akcjach promocyjnych, świętach.
*   **Logika:** Wykorzystanie zaawansowanych modeli szeregów czasowych (np. ARIMA, Prophet, Exponential Smoothing) do predykcji popytu na horyzoncie 30/60/90 dni dla poszczególnych produktów/kategorii. Modele uwzględniają sezonowość, trendy i czynniki zewnętrzne.
*   **Wyjście:** Tabela z prognozowanym popytem na każdy produkt na wybrany okres, wraz z przedziałem ufności. Wskazanie produktów, dla których prognoza jest najbardziej/najmniej stabilna.
*   **Wizualizacja:** Wykres liniowy przedstawiający historyczny popyt i prognozę na przyszłość.
*   **Interakcja:** Użytkownik może wybrać horyzont prognozy (30/60/90 dni) oraz poziom agregacji (produkt, kategoria).
*   **Obsługa Błędów:** W przypadku braku wystarczających danych historycznych, system wyświetli komunikat informacyjny i zaproponuje alternatywne metody (np. prognoza na podstawie podobnych produktów lub kategorii).

### 3. Inteligentne Sugestie Zakupów i Przecen
*   **Cel:** Optymalizacja poziomu zapasów i maksymalizacja marży poprzez inteligentne rekomendacje.
*   **Wymagane Dane:** `TowarId`, `IloscSprzedana`, `DataSprzedazy`, `StanMagazynowy`, `KosztZakupu`, `CenaSprzedazy`, `DataOstatniejSprzedazy`, `Sezon`, `Rodzaj`.
*   **Logika:**
    *   **Sugestie Zakupów:** Analiza rotacji towarów, prognozowanego popytu (z funkcjonalności 2) i aktualnego stanu magazynowego. Rekomendacja optymalnej ilości zamówienia, aby utrzymać pożądany poziom zapasów i uniknąć braków/nadmiaru.
    *   **Sugestie Przecen:** Identyfikacja produktów o niskiej rotacji (brak sprzedaży >X dni, konfigurowalne), zbliżającym się końcu sezonu lub terminie ważności. Rekomendacja sugerowanej obniżki ceny (procentowej lub kwotowej) w celu upłynnienia towaru.
*   **Wyjście:** Lista rekomendacji zakupowych (produkt, sugerowana ilość, data zamówienia, przewidywany koszt) i rekomendacji przecen (produkt, sugerowana obniżka, powód, przewidywany wzrost sprzedaży).
*   **Interakcja:** Użytkownik może ustawić progi dla niskiej rotacji (np. 30, 60, 90 dni bez sprzedaży), zdefiniować długość sezonu dla produktów sezonowych.

### 4. Wykrywanie "Martwych Zapasów" i Alerty
*   **Cel:** Proaktywne identyfikowanie i zarządzanie produktami o zerowej rotacji w celu minimalizacji strat.
*   **Wymagane Dane:** `TowarId`, `Nazwa`, `StanMagazynowy`, `DataOstatniejSprzedazy`, `KosztZakupu`, `MagID`.
*   **Logika:** Identyfikacja produktów, które nie miały żadnej sprzedaży przez okres dłuższy niż X dni (konfigurowalne przez użytkownika). Obliczenie potencjalnego kosztu utrzymania martwych zapasów.
*   **Wyjście:** Lista produktów zakwalifikowanych jako "martwe zapasy" z informacją o dacie ostatniej sprzedaży, aktualnym stanie magazynowym, koszcie zakupu i potencjalnym koszcie utrzymania. Rekomendacje dotyczące działań upłynniających.
*   **Alerty:** Automatyczne powiadomienia (np. e-mail, powiadomienie w aplikacji) o wykryciu nowych martwych zapasów lub przekroczeniu zdefiniowanego progu wartości martwych zapasów.
*   **Interakcja:** Użytkownik może zdefiniować próg braku sprzedaży (np. 60, 90, 120 dni) oraz preferowany kanał alertów.

### 5. Maksymalizacja Wykorzystania Danych z Subiekta
*   **Cel:** Pełne wykorzystanie potencjału danych zgromadzonych w systemie Subiekt i doradztwo w zakresie ich gromadzenia.
*   **Wymagania Integracyjne:**
    *   Integracja z systemem Subiekt poprzez dedykowane API (jeśli dostępne) lub mechanizm eksportu/importu danych (np. CSV, XML).
    *   Możliwość konfiguracji harmonogramu pobierania danych (np. codziennie o określonej godzinie).
*   **Doradztwo w Zakresie Gromadzenia Danych:**
    *   System doradza, jakie dodatkowe informacje warto systematycznie gromadzić w Subiekcie (np. szczegółowe dane demograficzne klientów, kanał sprzedaży, dokładne czasy transakcji z dokładnością do minuty), aby w przyszłości analizy AI były jeszcze bardziej precyzyjne.
    *   Raporty jakości danych, wskazujące na potencjalne braki lub niespójności w danych źródłowych.
*   **Transformacja Danych:** Pokazuje, jak przekształcić surowe dane transakcyjne w strategiczną wiedzę, która napędza rozwój biznesu.

### 6. Wymagania Techniczne i Dane

*   **Źródło Danych:** System Subiekt (integracja poprzez API lub eksport/import danych).
*   **Wymagane Pola Danych (przykładowe, dla każdej transakcji):**
    *   `DataWystawienia` (YYYY-MM-DD)
    *   `DataSprzedazy` (YYYY-MM-DD)
    *   `NumerDokumentu`
    *   `TowarId`
    *   `Symbol`
    *   `Nazwa`
    *   `Marka`
    *   `Rodzaj` (Kategoria produktu)
    *   `IloscSprzedana` (liczba, np. 1, 1.00)
    *   `WartoscNetto` (liczba, np. 293,42)
    *   `WartoscBrutto` (liczba, np. 360,91)
    *   `Sezon`
    *   `Plec`
    *   `Kolor`
    *   `Rozmiar`
    *   `MagID` (ID Magazynu)
*   **Technologie Backendu:** Node.js, Express.js, Google Sheets API.
*   **Technologie Frontendu:** React, Recharts (do wizualizacji danych).
*   **Baza Danych:** (Do uzupełnienia, jeśli dane będą przechowywane lokalnie, np. PostgreSQL, MongoDB).

---

**Podsumowując,** "Gemini AI w Analizie Sprzedaży i Zakupów" to kompleksowe narzędzie analityczne, które przekształca dane w konkretne, inteligentne rekomendacje, wspierając firmy w podejmowaniu lepszych decyzji każdego dnia.

---

## Plan Wdrożenia Aplikacji "Gemini AI w Analizie Sprzedaży i Zakupów"

**Cel:** Wdrożenie w pełni funkcjonalnej aplikacji webowej, która integruje dane sprzedażowe, wykorzystuje AI do analizy i prognozowania, oraz prezentuje wyniki w intuicyjny sposób.

**Technologie:**
*   **Backend:** Node.js (Express.js), Google Sheets API (lub dedykowane API Subiekta), (opcjonalnie: baza danych np. PostgreSQL/MongoDB).
*   **Frontend:** React, Recharts, Tailwind CSS.
*   **AI/ML:** Biblioteki do analizy szeregów czasowych, detekcji anomalii (np. TensorFlow.js, scikit-learn - jeśli backend w Pythonie, lub dedykowane biblioteki JS).

---

#### **Faza 0: Przygotowanie i Konfiguracja (Setup & Configuration)**

**Cel:** Ustanowienie środowiska deweloperskiego i podstawowej infrastruktury.

*   **0.1. Środowisko Deweloperskie:**
    *   Instalacja Node.js, npm/yarn.
    *   Konfiguracja edytora kodu (np. VS Code z odpowiednimi rozszerzeniami).
*   **0.2. Konfiguracja Google Cloud:**
    *   Utworzenie/konfiguracja projektu Google Cloud.
    *   Włączenie Google Sheets API.
    *   Generowanie i zabezpieczenie danych uwierzytelniających (klucz API / konto usługi).
*   **0.3. Inicjalizacja Projektów:**
    *   Stworzenie struktury katalogów (`backend`, `frontend`).
    *   Inicjalizacja projektu Node.js w `backend` (`npm init -y`).
    *   Instalacja `express`, `googleapis` w `backend`.
    *   Inicjalizacja projektu React w `frontend` (`npx create-vite@latest frontend --template react`).
    *   Instalacja zależności frontendowych (`npm install`).
*   **0.4. Kontrola Wersji:**
    *   Inicjalizacja repozytorium Git.
    *   Konfiguracja `.gitignore` dla `node_modules`, `.env`, kluczy API.

---

#### **Faza 1: Moduł Integracji Danych (Data Integration Module)**

**Cel:** Zapewnienie stabilnego i bezpiecznego przepływu danych z Subiekta (lub Google Sheets) do aplikacji.

*   **1.1. Połączenie z Źródłem Danych:**
    *   **Opcja A (Google Sheets - bieżąca implementacja):**
        *   Potwierdzenie dostępu do arkusza `SPRZEDAZ_DZIENNA`.
        *   Testowanie pobierania danych z API Google Sheets.
    *   **Opcja B (Subiekt - docelowa):**
        *   Analiza dostępnych metod integracji z Subiektem (API, eksport plików, bezpośredni dostęp do bazy danych).
        *   Implementacja adaptera/serwisu do pobierania danych z Subiekta.
*   **1.2. Mechanizm Pobierania Danych:**
    *   Implementacja funkcji pobierania danych w `backend` (np. `fetchSalesData`).
    *   Konfiguracja harmonogramu pobierania (np. cron job na serwerze, jeśli dane mają być cyklicznie aktualizowane).
*   **1.3. Walidacja i Transformacja Danych:**
    *   Implementacja logiki walidacji danych (sprawdzanie typów, kompletności).
    *   Transformacja surowych danych do ujednoliconego formatu JSON, zgodnego z potrzebami aplikacji.
    *   Obsługa brakujących lub niepoprawnych wartości (np. domyślne wartości, logowanie błędów).
*   **1.4. (Opcjonalnie) Persystencja Danych:**
    *   Jeśli dane mają być przechowywane lokalnie, konfiguracja bazy danych (np. PostgreSQL/MongoDB).
    *   Implementacja logiki zapisu i odczytu danych z bazy.

---

#### **Faza 2: Moduł Backend API (Backend API Module)**

**Cel:** Udostępnienie danych i logiki biznesowej dla frontendu poprzez RESTful API.

*   **2.1. Definicja Endpointów API:**
    *   `/api/sales-data`: Pobieranie przetworzonych danych sprzedażowych.
    *   `/api/sales-analysis/trends`: Pobieranie trendów i anomalii.
    *   `/api/sales-analysis/forecast`: Pobieranie prognoz popytu.
    *   `/api/suggestions/purchases`: Pobieranie sugestii zakupowych.
    *   `/api/suggestions/discounts`: Pobieranie sugestii przecen.
    *   `/api/dead-stock`: Pobieranie listy martwych zapasów.
*   **2.2. Logika Biznesowa:**
    *   Implementacja logiki agregacji i wstępnego przetwarzania danych dla każdego endpointu.
    *   Filtrowanie i sortowanie danych na podstawie parametrów zapytania (np. zakres dat, kategoria).
*   **2.3. Obsługa Błędów i Walidacja:**
    *   Implementacja globalnej obsługi błędów.
    *   Walidacja parametrów wejściowych dla endpointów.
*   **2.4. Zabezpieczenia:**
    *   Konfiguracja CORS (Cross-Origin Resource Sharing).
    *   (Opcjonalnie) Implementacja uwierzytelniania i autoryzacji (np. JWT) dla dostępu do API.

---

#### **Faza 3: Moduł Analityczny AI (AI Analytics Module)**

**Cel:** Implementacja algorytmów AI do generowania prognoz, wykrywania wzorców i dostarczania inteligentnych sugestii.

*   **3.1. Prognozowanie Popytu:**
    *   Wybór i implementacja modeli szeregów czasowych (np. ARIMA, Prophet) w backendzie.
    *   Trening modeli na historycznych danych sprzedażowych.
    *   Implementacja logiki generowania prognoz na wybrany horyzont.
*   **3.2. Identyfikacja Trendów i Anomalii:**
    *   Implementacja algorytmów do wykrywania wzorców sezonowych i anomalii w danych sprzedażowych.
    *   Definicja konfigurowalnych progów dla anomalii.
*   **3.3. Sugestie Zakupów i Przecen:**
    *   Implementacja logiki analizującej rotację towarów, prognozowany popyt i stany magazynowe.
    *   Algorytmy generujące rekomendacje dotyczące ilości zamówień i sugerowanych przecen.
*   **3.4. Wykrywanie Martwych Zapasów:**
    *   Implementacja algorytmu identyfikującego produkty bez sprzedaży przez określony czas.
    *   Obliczanie kosztów utrzymania martwych zapasów.
*   **3.5. Konfigurowalne Parametry:**
    *   Implementacja mechanizmu do zarządzania parametrami AI (np. horyzont prognozy, progi anomalii, okres braku sprzedaży dla martwych zapasów).

---

#### **Faza 4: Moduł Frontend (Frontend Module)**

**Cel:** Stworzenie intuicyjnego interfejsu użytkownika do prezentacji analiz i interakcji z aplikacją.

*   **4.1. Struktura Aplikacji i Nawigacja:**
    *   Implementacja routingu (np. React Router DOM).
    *   Stworzenie głównego layoutu (Header, Sidebar, Content).
    *   Implementacja nawigacji do poszczególnych sekcji (Analiza Sprzedaży, Prognozowanie Popytu, Sugestie Zakupów, Martwe Zapasy, Ustawienia).
*   **4.2. Strona "Analiza Sprzedaży":**
    *   Integracja z endpointem `/api/sales-data`.
    *   Implementacja wykresów (BarChart, PieChart, AreaChart) przy użyciu Recharts.
    *   Wyświetlanie kluczowych wskaźników (KPI) z danych.
    *   Implementacja filtrów (zakres dat, kategoria, marka).
*   **4.3. Strony dla Pozostałych Funkcjonalności:**
    *   **Prognozowanie Popytu:** Wyświetlanie prognoz, wykresów historycznych vs prognozowanych.
    *   **Sugestie Zakupów/Przecen:** Prezentacja rekomendacji w formie tabelarycznej, z możliwością filtrowania i sortowania.
    *   **Martwe Zapasy:** Lista martwych zapasów, szczegóły, sugerowane działania.
    *   **Ustawienia:** Interfejs do konfiguracji parametrów AI (progi, horyzonty), zarządzania alertami.
*   **4.4. Komponenty UI:**
    *   Stworzenie reużywalnych komponentów UI (przyciski, karty, inputy, tabele).
    *   Stylizacja przy użyciu Tailwind CSS.
*   **4.5. Obsługa Stanu:**
    *   Zarządzanie stanem aplikacji (np. React Context API, Redux, Zustand).
    *   Obsługa stanów ładowania i błędów.

---

#### **Faza 5: Testowanie i Wdrożenie (Testing & Deployment)**

**Cel:** Zapewnienie jakości, stabilności i dostępności aplikacji w środowisku produkcyjnym.

*   **5.1. Testy Jednostkowe i Integracyjne:**
    *   Pisanie testów jednostkowych dla logiki backendu (np. funkcje przetwarzania danych, algorytmy AI).
    *   Pisanie testów jednostkowych dla komponentów React.
    *   Testy integracyjne dla połączeń backend-frontend i integracji z Subiektem.
*   **5.2. Testy Funkcjonalne i Akceptacyjne:**
    *   Testowanie wszystkich funkcjonalności zgodnie ze specyfikacją.
    *   Testy end-to-end (E2E) symulujące interakcje użytkownika.
    *   Testy akceptacyjne z udziałem użytkowników biznesowych.
*   **5.3. Testy Wydajnościowe:**
    *   Sprawdzenie wydajności API i czasu ładowania frontendu pod obciążeniem.
*   **5.4. Wdrożenie (Deployment):**
    *   Wybór platformy hostingowej (np. Heroku, Vercel, AWS, Google Cloud Platform).
    *   Konfiguracja środowiska produkcyjnego (zmienne środowiskowe, domeny).
    *   Automatyzacja procesu CI/CD (Continuous Integration/Continuous Deployment).
*   **5.5. Monitoring i Utrzymanie:**
    *   Konfiguracja narzędzi do monitorowania wydajności aplikacji i błędów (np. Sentry, Prometheus, Grafana).
    *   Plan regularnych aktualizacji i utrzymania.
    *   Dokumentacja techniczna i użytkownika.

