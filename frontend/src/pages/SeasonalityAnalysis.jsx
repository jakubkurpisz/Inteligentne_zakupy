import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Calendar, TrendingUp, TrendingDown, Minus, RefreshCw, Filter, ChevronLeft, ChevronRight, Search, ChevronDown, ChevronUp, Package, EyeOff, Eye, ArrowUpDown, ArrowUp, ArrowDown, Settings, Info, HelpCircle, X } from 'lucide-react'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import { API_BASE_URL } from '../config/api'

// Cache helpers
const CACHE_KEY = 'seasonality_cache';
const getFromCache = (key, defaultValue) => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return defaultValue;
    const parsed = JSON.parse(cached);
    return parsed[key] !== undefined ? parsed[key] : defaultValue;
  } catch { return defaultValue; }
};
const saveAllToCache = (values) => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(values)); } catch {}
};

function SeasonalityAnalysis() {
  const API_URL = API_BASE_URL;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(() => getFromCache('data', []));
  const [filters, setFilters] = useState(() => getFromCache('filters', { rodzaje: [], marki: [] }));
  const [period, setPeriod] = useState(() => getFromCache('period', { start: '', end: '' }));
  const [totalProducts, setTotalProducts] = useState(() => getFromCache('totalProducts', 0));
  const [weeksList, setWeeksList] = useState(() => getFromCache('weeksList', [])); // Lista 52 tygodni z API

  // Filtry
  const [selectedRodzaj, setSelectedRodzaj] = useState('');
  const [selectedMarka, setSelectedMarka] = useState('');
  const [searchSymbol, setSearchSymbol] = useState('');
  const [selectedMagazyny, setSelectedMagazyny] = useState(['1', '7', '9']);

  // Paginacja tygodni
  const [weekStartIndex, setWeekStartIndex] = useState(0);
  const weeksToShow = 8; // Zmniejszone z 12 na 8 dla lepszego dopasowania

  // Rozwinięty wiersz
  const [expandedRow, setExpandedRow] = useState(null);

  // Zwijanie sekcji
  const [showSeasonalitySection, setShowSeasonalitySection] = useState(true);
  const [showMinStockSection, setShowMinStockSection] = useState(true);

  // Filtry dla sekcji stanów minimalnych
  const [showOnlyMissing, setShowOnlyMissing] = useState(false);
  const [hideIgnored, setHideIgnored] = useState(true);
  const [minStockSearchSymbol, setMinStockSearchSymbol] = useState('');
  const [minStockSelectedRodzaj, setMinStockSelectedRodzaj] = useState('');

  // Sortowanie dla sekcji stanów minimalnych
  const [sortColumn, setSortColumn] = useState('toOrder'); // domyślnie sortuj po "Do uzupełnienia"
  const [sortDirection, setSortDirection] = useState('desc'); // desc = malejąco

  // Paginacja dla sekcji stanów minimalnych
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Produkty ignorowane (nie do zamawiania) - zapisywane w bazie danych
  const [ignoredProducts, setIgnoredProducts] = useState([]);
  const [ignoredLoading, setIgnoredLoading] = useState(false);

  // Parametry obliczania stanu minimalnego (w tygodniach)
  const [stockWeeks, setStockWeeks] = useState(1); // Zapas na ile tygodni
  const [deliveryWeeks, setDeliveryWeeks] = useState(1); // Czas dostawy w tygodniach
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);

  // Stan dla okna pomocy
  const [showHelp, setShowHelp] = useState(false);

  // Pobierz ignorowane produkty z API przy starcie
  const fetchIgnoredProducts = async () => {
    try {
      const response = await fetch(`${API_URL}/api/ignored-products`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setIgnoredProducts(result.data || []);
        }
      }
    } catch (err) {
      console.error('Błąd pobierania ignorowanych produktów:', err);
    }
  };

  // Ref do śledzenia czy już pobrano dane
  const hasFetchedRef = useRef(false);
  const lastMagazynyRef = useRef('');

  useEffect(() => {
    fetchIgnoredProducts();
    // Pobierz dane tylko raz przy pierwszym montowaniu
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      lastMagazynyRef.current = selectedMagazyny.join(',');
      fetchSeasonalityData();
    }
  }, []);

  // Funkcja do przełączania ignorowania produktu (zapisuje do bazy)
  const toggleIgnoreProduct = async (symbol) => {
    setIgnoredLoading(true);
    try {
      const isIgnored = ignoredProducts.includes(symbol);

      if (isIgnored) {
        // Usuń z ignorowanych
        const response = await fetch(`${API_URL}/api/ignored-products/${encodeURIComponent(symbol)}`, {
          method: 'DELETE'
        });
        if (response.ok) {
          setIgnoredProducts(prev => prev.filter(s => s !== symbol));
        }
      } else {
        // Dodaj do ignorowanych
        const response = await fetch(`${API_URL}/api/ignored-products/${encodeURIComponent(symbol)}`, {
          method: 'POST'
        });
        if (response.ok) {
          setIgnoredProducts(prev => [...prev, symbol]);
        }
      }
    } catch (err) {
      console.error('Błąd zapisywania ignorowania produktu:', err);
    } finally {
      setIgnoredLoading(false);
    }
  };

  // Funkcja do czyszczenia wszystkich ignorowanych
  const clearAllIgnored = async () => {
    if (!confirm('Czy na pewno chcesz usunąć wszystkie produkty z listy ignorowanych?')) {
      return;
    }
    setIgnoredLoading(true);
    try {
      // Usuń każdy produkt z listy
      for (const symbol of ignoredProducts) {
        await fetch(`${API_URL}/api/ignored-products/${encodeURIComponent(symbol)}`, {
          method: 'DELETE'
        });
      }
      setIgnoredProducts([]);
    } catch (err) {
      console.error('Błąd czyszczenia ignorowanych:', err);
    } finally {
      setIgnoredLoading(false);
    }
  };

  // Mapowanie magazynów
  const magazyny = {
    '1': 'GLS',
    '2': 'GLS DEPOZYT',
    '7': 'JEANS',
    '9': 'INNE'
  };

  // Funkcja obliczająca datę początku i końca tygodnia ISO
  const getWeekDateRange = (weekNumber, year) => {
    // Metoda: znajdź 4 stycznia danego roku (zawsze jest w tygodniu 1 ISO)
    // i oblicz poniedziałek tego tygodnia
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const dayOfWeek = jan4.getUTCDay() || 7; // 1=pon, 7=niedz

    // Poniedziałek tygodnia 1
    const mondayWeek1 = new Date(jan4);
    mondayWeek1.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);

    // Poniedziałek żądanego tygodnia
    const weekStartDate = new Date(mondayWeek1);
    weekStartDate.setUTCDate(mondayWeek1.getUTCDate() + (weekNumber - 1) * 7);

    // Niedziela żądanego tygodnia
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setUTCDate(weekStartDate.getUTCDate() + 6);

    const formatDate = (date) => {
      const day = date.getUTCDate().toString().padStart(2, '0');
      const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
      return `${day}.${month}`;
    };

    return `${formatDate(weekStartDate)}-${formatDate(weekEndDate)}`;
  };

  const fetchSeasonalityData = async () => {
    setLoading(true);
    setError(null);
    try {
      const magIds = selectedMagazyny.join(',');
      let url = `${API_URL}/api/seasonality-index?mag_ids=${magIds}`;

      if (selectedRodzaj) url += `&rodzaj=${encodeURIComponent(selectedRodzaj)}`;
      if (selectedMarka) url += `&marka=${encodeURIComponent(selectedMarka)}`;
      if (searchSymbol) url += `&symbol=${encodeURIComponent(searchSymbol)}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();

      if (result.success) {
        const newData = result.data || [];
        const newFilters = result.filters || { rodzaje: [], marki: [] };
        const newPeriod = result.period || { start: '', end: '' };
        const newTotalProducts = result.total_products || 0;
        const newWeeksList = result.weeks || [];

        setData(newData);
        setFilters(newFilters);
        setPeriod(newPeriod);
        setTotalProducts(newTotalProducts);
        setWeeksList(newWeeksList);

        saveAllToCache({
          data: newData,
          filters: newFilters,
          period: newPeriod,
          totalProducts: newTotalProducts,
          weeksList: newWeeksList
        });
      }
    } catch (err) {
      console.error('Błąd podczas pobierania danych sezonowości:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Pobierz dane gdy zmienią się magazyny (ale nie przy pierwszym montowaniu)
  useEffect(() => {
    const currentMagazyny = selectedMagazyny.join(',');
    if (hasFetchedRef.current && currentMagazyny !== lastMagazynyRef.current) {
      lastMagazynyRef.current = currentMagazyny;
      fetchSeasonalityData();
    }
  }, [selectedMagazyny]);

  const handleFilterApply = () => {
    fetchSeasonalityData();
  };

  const toggleMagazyn = (magId) => {
    setSelectedMagazyny(prev => {
      if (prev.includes(magId)) {
        if (prev.length === 1) return prev;
        return prev.filter(id => id !== magId);
      } else {
        return [...prev, magId];
      }
    });
  };

  // Formatowanie liczb
  const formatNumber = (num, decimals = 0) => {
    if (isNaN(num)) return '0';
    return Number(num).toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  // Renderowanie ikony trendu
  const renderTrendIcon = (trend) => {
    if (!trend) return null;
    const { kierunek, zmiana_procent, lata } = trend;
    const currentYear = new Date().getFullYear();

    const trendColor = kierunek === 'up' ? 'text-green-600' : kierunek === 'down' ? 'text-red-600' : 'text-gray-500';
    const bgColor = kierunek === 'up' ? 'bg-green-50' : kierunek === 'down' ? 'bg-red-50' : 'bg-gray-50';

    const tooltipText = `${currentYear-2}: ${formatNumber(lata[String(currentYear-2)] || 0)} | ${currentYear-1}: ${formatNumber(lata[String(currentYear-1)] || 0)} | ${currentYear}: ${formatNumber(lata[String(currentYear)] || 0)}`;

    return (
      <div className={`flex items-center space-x-1 px-1 py-0.5 rounded ${bgColor}`} title={tooltipText}>
        {kierunek === 'up' && <TrendingUp className={`w-3 h-3 ${trendColor}`} />}
        {kierunek === 'down' && <TrendingDown className={`w-3 h-3 ${trendColor}`} />}
        {kierunek === 'stable' && <Minus className={`w-3 h-3 ${trendColor}`} />}
        <span className={`text-[10px] font-medium ${trendColor}`}>
          {zmiana_procent > 0 ? '+' : ''}{zmiana_procent}%
        </span>
      </div>
    );
  };

  // Kolor indeksu sezonowości
  const getIndexColor = (index) => {
    if (index >= 2.5) return 'bg-red-500 text-white';
    if (index >= 1.5) return 'bg-orange-400 text-white';
    if (index >= 1.0) return 'bg-green-500 text-white';
    if (index >= 0.5) return 'bg-yellow-400 text-gray-800';
    if (index > 0) return 'bg-blue-300 text-gray-800';
    return 'bg-gray-200 text-gray-500';
  };

  // Przygotuj dane dla wykresu wybranego produktu
  const getChartData = (product) => {
    if (!product || !product.DaneTygodniowe) return [];

    return Object.entries(product.DaneTygodniowe).map(([week, data]) => ({
      week: `T${data.tydzien}`,
      sprzedaz: data.sprzedaz,
      poprzedniRok: data.poprzedni_rok || 0,
      indeks: data.indeks
    }));
  };

  // Nawigacja tygodni - teraz używamy indeksu w tablicy weeksList
  const goToPrevWeeks = () => {
    setWeekStartIndex(prev => Math.max(0, prev - weeksToShow));
  };

  const goToNextWeeks = () => {
    setWeekStartIndex(prev => Math.min(Math.max(0, weeksList.length - weeksToShow), prev + weeksToShow));
  };

  // Generowanie nagłówków tygodni z datami - używamy weeksList z API
  const visibleWeeks = weeksList.slice(weekStartIndex, weekStartIndex + weeksToShow);
  const weekHeaders = visibleWeeks.map(w => ({
    key: w.key,  // np. "2024-49"
    week: w.week, // numer tygodnia
    year: w.year, // rok
    label: `T${w.week}`,
    dateRange: getWeekDateRange(w.week, w.year)
  }));

  // Oblicz proponowany stan minimalny na podstawie sezonowości
  // Wzór: Średnia tygodniowa × Indeks sezonowy × (zapas X tygodni + dostawa Y tygodni)
  const calculateMinStock = (product) => {
    if (!product || !product.SredniaTygodniowa) return 0;

    // Łączna liczba tygodni do pokrycia
    const totalWeeks = stockWeeks + deliveryWeeks;

    // Pobierz maksymalny indeks dla najbliższych tygodni (zapas + dostawa)
    let maxIndex = 1;

    // Bierzemy ostatnie N tygodni z weeksList (najbliższe dziś)
    const recentWeeks = weeksList.slice(-totalWeeks);
    for (const w of recentWeeks) {
      const weekData = product.DaneTygodniowe?.[w.key];
      if (weekData && weekData.indeks > maxIndex) {
        maxIndex = weekData.indeks;
      }
    }

    // Stan minimalny = średnia tygodniowa × indeks sezonowy × (zapas + dostawa)
    const minStock = product.SredniaTygodniowa * maxIndex * totalWeeks;

    return Math.ceil(minStock);
  };

  // Oblicz ile trzeba uzupełnić
  const calculateToOrder = (product) => {
    const minStock = calculateMinStock(product);
    const currentStock = product.StanAktualny || 0;
    const toOrder = minStock - currentStock;
    return toOrder > 0 ? Math.ceil(toOrder) : 0;
  };

  // Funkcja zmiany sortowania
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
    setCurrentPage(1); // Reset do pierwszej strony przy zmianie sortowania
  };

  // Ikona sortowania
  const SortIcon = ({ column }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-3 h-3 ml-1 text-gray-400" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3 h-3 ml-1 text-blue-600" />
      : <ArrowDown className="w-3 h-3 ml-1 text-blue-600" />;
  };

  // Przefiltrowane i posortowane dane dla sekcji stanów minimalnych
  const filteredAndSortedData = useMemo(() => {
    let filtered = data.filter(product => {
      const toOrder = calculateToOrder(product);
      const isIgnored = ignoredProducts.includes(product.Symbol);

      // Filtr: tylko brakujące
      if (showOnlyMissing && toOrder <= 0) return false;

      // Filtr: ukryj ignorowane
      if (hideIgnored && isIgnored) return false;

      // Filtr: symbol
      if (minStockSearchSymbol && !product.Symbol.toLowerCase().includes(minStockSearchSymbol.toLowerCase())) {
        return false;
      }

      // Filtr: rodzaj
      if (minStockSelectedRodzaj && product.Rodzaj !== minStockSelectedRodzaj) {
        return false;
      }

      return true;
    });

    // Sortowanie
    filtered.sort((a, b) => {
      let valA, valB;

      switch (sortColumn) {
        case 'symbol':
          valA = a.Symbol || '';
          valB = b.Symbol || '';
          break;
        case 'nazwa':
          valA = a.Nazwa || '';
          valB = b.Nazwa || '';
          break;
        case 'rodzaj':
          valA = a.Rodzaj || '';
          valB = b.Rodzaj || '';
          break;
        case 'avgWeekly':
          valA = a.SredniaTygodniowa || 0;
          valB = b.SredniaTygodniowa || 0;
          break;
        case 'currentStock':
          valA = a.StanAktualny || 0;
          valB = b.StanAktualny || 0;
          break;
        case 'minStock':
          valA = calculateMinStock(a);
          valB = calculateMinStock(b);
          break;
        case 'toOrder':
          valA = calculateToOrder(a);
          valB = calculateToOrder(b);
          break;
        default:
          valA = calculateToOrder(a);
          valB = calculateToOrder(b);
      }

      // Dla stringów
      if (typeof valA === 'string') {
        const comparison = valA.localeCompare(valB, 'pl');
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      // Dla liczb
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });

    return filtered;
  }, [data, showOnlyMissing, hideIgnored, minStockSearchSymbol, minStockSelectedRodzaj, sortColumn, sortDirection, ignoredProducts, weeksList, stockWeeks, deliveryWeeks]);

  // Paginacja
  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);
  const paginatedData = filteredAndSortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset strony przy zmianie filtrów
  useEffect(() => {
    setCurrentPage(1);
  }, [showOnlyMissing, hideIgnored, minStockSearchSymbol, minStockSelectedRodzaj]);

  return (
    <div className="space-y-6">
      {/* Nagłówek */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analiza Sezonowości</h1>
          <p className="text-gray-500 mt-1">Indeks sezonowości produktów na podstawie ostatnich 12 miesięcy</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={fetchSeasonalityData}
            className="btn-secondary flex items-center space-x-2"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Odśwież</span>
          </button>
        </div>
      </div>

      {/* Info o okresie */}
      <div className="card bg-blue-50 border border-blue-200">
        <div className="flex items-center space-x-4">
          <Calendar className="w-6 h-6 text-blue-600" />
          <div>
            <p className="text-sm font-medium text-blue-900">Okres analizy</p>
            <p className="text-lg font-bold text-blue-700">
              {period.start} - {period.end}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-sm text-blue-600">Znaleziono produktów</p>
            <p className="text-2xl font-bold text-blue-700">{formatNumber(totalProducts)}</p>
          </div>
        </div>
      </div>

      {/* Filtry */}
      <div className="card">
        <div className="space-y-4">
          {/* Magazyny */}
          <div className="flex items-center space-x-3">
            <Filter className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Magazyny:</span>
            <div className="flex flex-wrap gap-2">
              {Object.entries(magazyny).map(([id, name]) => (
                <button
                  key={id}
                  onClick={() => toggleMagazyn(id)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    selectedMagazyny.includes(id)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Filtry produktów */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Symbol</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchSymbol}
                  onChange={(e) => setSearchSymbol(e.target.value)}
                  placeholder="Szukaj symbolu..."
                  className="w-full pl-9 p-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rodzaj</label>
              <select
                value={selectedRodzaj}
                onChange={(e) => setSelectedRodzaj(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Wszystkie rodzaje</option>
                {filters.rodzaje.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Marka</label>
              <select
                value={selectedMarka}
                onChange={(e) => setSelectedMarka(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Wszystkie marki</option>
                {filters.marki.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleFilterApply}
                className="btn-primary w-full"
              >
                Zastosuj filtry
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Legenda */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Legenda indeksu sezonowości</h3>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-red-500 rounded"></div>
            <span className="text-sm text-gray-600">≥ 2.5 (Bardzo wysoki)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-orange-400 rounded"></div>
            <span className="text-sm text-gray-600">1.5 - 2.5 (Wysoki)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-green-500 rounded"></div>
            <span className="text-sm text-gray-600">1.0 - 1.5 (Normalny)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-yellow-400 rounded"></div>
            <span className="text-sm text-gray-600">0.5 - 1.0 (Niski)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-blue-300 rounded"></div>
            <span className="text-sm text-gray-600">&lt; 0.5 (Bardzo niski)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-gray-200 rounded"></div>
            <span className="text-sm text-gray-600">0 (Brak sprzedaży)</span>
          </div>
        </div>
      </div>

      {/* Wykres dla rozwiniętego produktu */}
      {expandedRow !== null && data[expandedRow] && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Wykres sezonowości: {data[expandedRow].Symbol}
          </h3>
          <p className="text-sm text-gray-500 mb-4">{data[expandedRow].Nazwa}</p>
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={getChartData(data[expandedRow])}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="left" label={{ value: 'Sprzedaż (szt.)', angle: -90, position: 'insideLeft', fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" label={{ value: 'Indeks', angle: 90, position: 'insideRight', fontSize: 12 }} />
              <Tooltip
                formatter={(value, name) => {
                  if (name === 'Indeks') return [value.toFixed(2), name];
                  return [Math.round(value), name];
                }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="sprzedaz" fill="#3b82f6" name="Bieżący rok (szt.)" barSize={20} />
              <Line yAxisId="left" type="monotone" dataKey="poprzedniRok" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 3 }} name="Poprzedni rok (szt.)" />
              <Line yAxisId="right" type="monotone" dataKey="indeks" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} name="Indeks sezonowości" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* SEKCJA 1: Współczynniki sezonowości (zwijana) */}
      <div className="card">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setShowSeasonalitySection(!showSeasonalitySection)}
        >
          <div className="flex items-center space-x-3">
            <TrendingUp className="w-6 h-6 text-primary-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Współczynniki sezonowości ({data.length} produktów)
            </h3>
          </div>
          <div className="flex items-center space-x-4">
            {/* Nawigacja tygodni */}
            {showSeasonalitySection && weeksList.length > 0 && (
              <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={goToPrevWeeks}
                  disabled={weekStartIndex === 0}
                  className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm font-medium text-gray-600">
                  {weekHeaders.length > 0 && (
                    <>T{weekHeaders[0]?.week}/{weekHeaders[0]?.year} - T{weekHeaders[weekHeaders.length-1]?.week}/{weekHeaders[weekHeaders.length-1]?.year}</>
                  )}
                </span>
                <button
                  onClick={goToNextWeeks}
                  disabled={weekStartIndex + weeksToShow >= weeksList.length}
                  className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              {showSeasonalitySection ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {showSeasonalitySection && (
          <div className="mt-4">
            {error ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700">{error}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm table-fixed">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="py-2 px-1 text-left font-semibold text-gray-600 w-[90px]">Symbol</th>
                      <th className="py-2 px-1 text-left font-semibold text-gray-600 w-[130px]">Nazwa</th>
                      <th className="py-2 px-1 text-right font-semibold text-gray-600 w-[45px]">Suma</th>
                      <th className="py-2 px-1 text-center font-semibold text-gray-600 w-[60px]">Trend</th>
                      <th className="py-2 px-1 text-center font-semibold text-gray-600 w-[40px]">Szcz.</th>
                      {weekHeaders.map(({ key, label, year, dateRange }) => (
                        <th key={key} className="py-2 px-1 text-center font-semibold text-gray-600 w-[55px] min-w-[55px]">
                          <div className="text-[11px]">{label}</div>
                          <div className="text-[9px] text-gray-400 font-normal whitespace-nowrap">{dateRange}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.slice(0, 100).map((product, idx) => (
                      <tr
                        key={product.Symbol}
                        className={`border-b hover:bg-gray-50 cursor-pointer ${expandedRow === idx ? 'bg-blue-50' : ''}`}
                        onClick={() => setExpandedRow(expandedRow === idx ? null : idx)}
                      >
                        <td className="py-1 px-1 font-mono text-xs truncate" title={product.Symbol}>{product.Symbol}</td>
                        <td className="py-1 px-1 text-gray-700 text-xs truncate" title={product.Nazwa}>
                          {product.Nazwa}
                        </td>
                        <td className="py-1 px-1 text-right font-medium text-xs">{formatNumber(product.SumaRoczna)}</td>
                        <td className="py-1 px-1 text-center">
                          {renderTrendIcon(product.Trend)}
                        </td>
                        <td className="py-1 px-1 text-center">
                          {product.TydzienSzczytu && (
                            <span className="px-1 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-medium">
                              {product.TydzienSzczytu.split('-')[1]}
                            </span>
                          )}
                        </td>
                        {weekHeaders.map(({ key }) => {
                          const weekData = product.DaneTygodniowe?.[key];
                          const indeks = weekData?.indeks || 0;
                          const trendPct = weekData?.trend_procent || 0;
                          const prevYear = weekData?.poprzedni_rok || 0;
                          const prevYear2 = weekData?.poprzedni_rok_2 || 0;
                          const currSales = weekData?.sprzedaz || 0;
                          const currYear = weekData?.rok || new Date().getFullYear();

                          // Ikona trendu tygodniowego
                          let trendIndicator = '';
                          let trendClass = '';
                          if (trendPct > 20) {
                            trendIndicator = '▲';
                            trendClass = 'text-green-600';
                          } else if (trendPct < -20) {
                            trendIndicator = '▼';
                            trendClass = 'text-red-600';
                          }

                          const tooltipText = `${currYear}: ${currSales} szt.\n${currYear-1}: ${prevYear} szt.\n${currYear-2}: ${prevYear2} szt.\nTrend: ${trendPct > 0 ? '+' : ''}${trendPct}%`;

                          return (
                            <td key={key} className="py-1 px-0.5 text-center">
                              <div
                                className={`text-[10px] font-medium rounded px-0.5 py-0.5 ${getIndexColor(indeks)} relative`}
                                title={tooltipText}
                              >
                                {indeks > 0 ? indeks.toFixed(1) : '-'}
                                {trendIndicator && (
                                  <span className={`absolute -top-1 -right-1 text-[8px] ${trendClass}`}>
                                    {trendIndicator}
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {data.length > 100 && (
                  <div className="p-4 text-center text-sm text-gray-500">
                    Wyświetlono 100 z {data.length} produktów
                  </div>
                )}

                {data.length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    <p className="text-lg font-medium">Brak danych</p>
                    <p className="text-sm mt-2">Spróbuj zmienić filtry</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* SEKCJA 2: Proponowane stany minimalne (zwijana) */}
      <div className="card">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setShowMinStockSection(!showMinStockSection)}
        >
          <div className="flex items-center space-x-3">
            <Package className="w-6 h-6 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Proponowane stany minimalne
            </h3>
            <span className="text-sm text-gray-500 bg-green-100 px-2 py-1 rounded">
              zapas {stockWeeks} tyg. + dostawa {deliveryWeeks} tyg. = {stockWeeks + deliveryWeeks} tyg.
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSettingsPanel(!showSettingsPanel);
              }}
              className={`p-2 rounded-lg transition-colors ${showSettingsPanel ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-500'}`}
              title="Ustawienia parametrów"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              {showMinStockSection ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Panel ustawień parametrów */}
        {showSettingsPanel && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start space-x-4">
              <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-blue-900 mb-3">Parametry obliczania stanu minimalnego</h4>
                <p className="text-xs text-blue-700 mb-4">
                  Wzór: <strong>Stan MIN = Średnia tygodniowa × Indeks sezonowy × (Zapas + Dostawa)</strong>
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-blue-800 mb-1">
                      Zapas na ile tygodni?
                    </label>
                    <select
                      value={stockWeeks}
                      onChange={(e) => setStockWeeks(Number(e.target.value))}
                      className="w-full p-2 border border-blue-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                    >
                      {[1, 2, 3, 4, 5, 6].map(n => (
                        <option key={n} value={n}>{n} {n === 1 ? 'tydzień' : n < 5 ? 'tygodnie' : 'tygodni'}</option>
                      ))}
                    </select>
                    <p className="text-xs text-blue-600 mt-1">Ile tygodni sprzedaży chcesz mieć na stanie</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-800 mb-1">
                      Czas dostawy
                    </label>
                    <select
                      value={deliveryWeeks}
                      onChange={(e) => setDeliveryWeeks(Number(e.target.value))}
                      className="w-full p-2 border border-blue-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                    >
                      {[1, 2, 3, 4, 5, 6].map(n => (
                        <option key={n} value={n}>{n} {n === 1 ? 'tydzień' : n < 5 ? 'tygodnie' : 'tygodni'}</option>
                      ))}
                    </select>
                    <p className="text-xs text-blue-600 mt-1">Ile tygodni trwa dostawa od zamówienia</p>
                  </div>
                  <div className="flex items-center">
                    <div className="p-3 bg-white rounded-lg border border-blue-300">
                      <p className="text-xs text-blue-700">Łączny czas pokrycia:</p>
                      <p className="text-2xl font-bold text-blue-900">{stockWeeks + deliveryWeeks} tyg.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showMinStockSection && (
          <div className="mt-4">
            {/* Filtry dla sekcji stanów minimalnych */}
            <div className="mb-4 grid grid-cols-1 md:grid-cols-5 gap-4">
              {/* Checkbox: tylko brakujące */}
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOnlyMissing}
                  onChange={(e) => setShowOnlyMissing(e.target.checked)}
                  className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
                />
                <span className="text-sm font-medium text-gray-700">Tylko brakujące</span>
              </label>

              {/* Checkbox: ukryj ignorowane */}
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideIgnored}
                  onChange={(e) => setHideIgnored(e.target.checked)}
                  className="w-4 h-4 text-gray-600 rounded border-gray-300 focus:ring-gray-500"
                />
                <span className="text-sm font-medium text-gray-700">Ukryj ignorowane ({ignoredProducts.length})</span>
              </label>

              {/* Filtr: Symbol */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={minStockSearchSymbol}
                  onChange={(e) => setMinStockSearchSymbol(e.target.value)}
                  placeholder="Szukaj symbolu..."
                  className="w-full pl-9 p-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              {/* Filtr: Rodzaj */}
              <select
                value={minStockSelectedRodzaj}
                onChange={(e) => setMinStockSelectedRodzaj(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Wszystkie rodzaje</option>
                {filters.rodzaje.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              {/* Wyczyść ignorowane */}
              {ignoredProducts.length > 0 && (
                <button
                  onClick={clearAllIgnored}
                  disabled={ignoredLoading}
                  className="text-sm text-red-600 hover:text-red-700 underline disabled:opacity-50"
                >
                  {ignoredLoading ? 'Czyszczenie...' : 'Wyczyść ignorowane'}
                </button>
              )}
            </div>

            {/* Info o liczbie produktów */}
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Znaleziono: <strong>{filteredAndSortedData.length}</strong> produktów
                {showOnlyMissing && <span className="ml-2 text-orange-600">(tylko brakujące)</span>}
              </div>
              <div className="text-sm text-gray-500">
                Strona {currentPage} z {totalPages || 1}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3 px-2 text-center font-semibold text-gray-600 w-10" title="Nie zamawiaj więcej">
                      <EyeOff className="w-4 h-4 mx-auto text-gray-400" />
                    </th>
                    <th
                      className="py-3 px-3 text-left font-semibold text-gray-600 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('symbol')}
                    >
                      <div className="flex items-center">
                        Symbol
                        <SortIcon column="symbol" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-3 text-left font-semibold text-gray-600 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('nazwa')}
                    >
                      <div className="flex items-center">
                        Nazwa
                        <SortIcon column="nazwa" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-3 text-left font-semibold text-gray-600 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('rodzaj')}
                    >
                      <div className="flex items-center">
                        Rodzaj
                        <SortIcon column="rodzaj" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-3 text-right font-semibold text-gray-600 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('avgWeekly')}
                    >
                      <div className="flex items-center justify-end">
                        Śr. tyg.
                        <SortIcon column="avgWeekly" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-3 text-right font-semibold text-gray-600 bg-blue-50 cursor-pointer hover:bg-blue-100"
                      onClick={() => handleSort('currentStock')}
                    >
                      <div className="flex items-center justify-end">
                        Stan aktualny
                        <SortIcon column="currentStock" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-3 text-right font-semibold text-gray-600 bg-green-50 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort('minStock')}
                    >
                      <div className="flex items-center justify-end">
                        Stan MIN
                        <SortIcon column="minStock" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-3 text-right font-semibold text-gray-600 bg-orange-50 cursor-pointer hover:bg-orange-100"
                      onClick={() => handleSort('toOrder')}
                    >
                      <div className="flex items-center justify-end">
                        Do uzupełnienia
                        <SortIcon column="toOrder" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((product) => {
                    const minStock = calculateMinStock(product);
                    const currentStock = product.StanAktualny || 0;
                    const toOrder = calculateToOrder(product);
                    const needsRestock = toOrder > 0;
                    const isIgnored = ignoredProducts.includes(product.Symbol);

                    return (
                      <tr
                        key={product.Symbol}
                        className={`border-b hover:bg-gray-50 ${needsRestock && !isIgnored ? 'bg-orange-50/50' : ''} ${isIgnored ? 'bg-gray-100 opacity-60' : ''}`}
                      >
                        <td className="py-2 px-2 text-center">
                          <button
                            onClick={() => toggleIgnoreProduct(product.Symbol)}
                            disabled={ignoredLoading}
                            className={`p-1 rounded hover:bg-gray-200 transition-colors disabled:opacity-50 ${isIgnored ? 'text-red-500' : 'text-gray-400'}`}
                            title={isIgnored ? 'Przywróć do zamawiania' : 'Nie zamawiaj więcej'}
                          >
                            {isIgnored ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="py-2 px-3 font-mono text-xs">{product.Symbol}</td>
                        <td className="py-2 px-3 text-gray-700 max-w-[250px] truncate" title={product.Nazwa}>
                          {product.Nazwa}
                        </td>
                        <td className="py-2 px-3 text-gray-600">{product.Rodzaj}</td>
                        <td className="py-2 px-3 text-right">{formatNumber(product.SredniaTygodniowa, 1)}</td>
                        <td className="py-2 px-3 text-right bg-blue-50">
                          <span className="font-medium text-blue-700">{formatNumber(currentStock)}</span>
                        </td>
                        <td className="py-2 px-3 text-right bg-green-50">
                          <span className="font-bold text-green-700">{formatNumber(minStock)}</span>
                        </td>
                        <td className="py-2 px-3 text-right bg-orange-50">
                          {isIgnored ? (
                            <span className="text-gray-400 line-through">{formatNumber(toOrder)}</span>
                          ) : needsRestock ? (
                            <span className="font-bold text-orange-600">{formatNumber(toOrder)}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Paginacja */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t">
                  <div className="text-sm text-gray-500">
                    Wyświetlono {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredAndSortedData.length)} z {filteredAndSortedData.length}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Pierwsza
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-3 py-1 text-sm font-medium">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Ostatnia
                    </button>
                  </div>
                </div>
              )}

              {filteredAndSortedData.length === 0 && (
                <div className="p-4 text-center text-sm text-gray-500">
                  Brak produktów spełniających kryteria filtrów
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="card bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Jak interpretować indeks sezonowości?</h3>
            <div className="text-sm text-gray-700 space-y-1">
              <p><strong>Indeks = 1.0</strong> - sprzedaż w danym tygodniu równa średniej rocznej</p>
              <p><strong>Indeks &gt; 1.0</strong> - sprzedaż powyżej średniej (sezon wysoki)</p>
              <p><strong>Indeks &lt; 1.0</strong> - sprzedaż poniżej średniej (sezon niski)</p>
              <p className="mt-2 text-gray-600">
                Przykład: Indeks 2.5 oznacza, że sprzedaż w tym tygodniu była 2.5x wyższa niż średnia tygodniowa.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Przycisk pomocy */}
      <button
        onClick={() => setShowHelp(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-primary-600 hover:bg-primary-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 z-40"
        title="Pomoc"
      >
        <HelpCircle className="w-7 h-7" />
      </button>

      {/* Modal pomocy */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <HelpCircle className="w-6 h-6 text-purple-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Analiza Sezonowosci - Pomoc</h2>
              </div>
              <button onClick={() => setShowHelp(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Do czego sluzy ten widok?</h3>
                <p className="text-gray-600">
                  Widok Analiza Sezonowosci pozwala identyfikowac wzorce sezonowe w sprzedazy produktow.
                  Na podstawie tych danych mozna planowac zapasy i unikac brakow w okresach wysokiego popytu.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Glowne funkcjonalnosci:</h3>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3 p-3 bg-purple-50 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Indeks sezonowosci</p>
                      <p className="text-sm text-gray-600">Wskaznik pokazujacy jak sprzedaz w danym tygodniu ma sie do sredniej. Indeks 2.0 = dwukrotnie wyzsza sprzedaz.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
                    <Package className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Proponowane stany minimalne</p>
                      <p className="text-sm text-gray-600">Automatyczne wyliczenie minimalnych stanow na podstawie sezonowosci i parametrow dostawy.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                    <Calendar className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Mapa cieplna tygodni</p>
                      <p className="text-sm text-gray-600">Kolorowa tabela pokazujaca sezonowość w ukladzie tygodniowym - latwiejsze wykrywanie wzorcow.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-orange-50 rounded-lg">
                    <EyeOff className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Ignorowanie produktow</p>
                      <p className="text-sm text-gray-600">Mozliwosc oznaczenia produktow jako "nie do zamawiania" (np. wycofane z oferty).</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-pink-50 rounded-lg">
                    <Settings className="w-5 h-5 text-pink-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Parametry obliczen</p>
                      <p className="text-sm text-gray-600">Mozliwosc ustawienia zapasu tygodniowego i czasu dostawy dla dokladniejszych obliczen.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Wskazowka</h4>
                <p className="text-sm text-gray-600">
                  Kliknij wiersz produktu w tabeli sezonowosci, aby zobaczyc szczegolowy wykres trendu.
                  Uzyj filtru "Tylko brakujące" aby szybko znalezc produkty wymagające uzupelnienia.
                </p>
              </div>
            </div>
            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t rounded-b-2xl">
              <button onClick={() => setShowHelp(false)} className="w-full btn-primary">Rozumiem</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SeasonalityAnalysis;
