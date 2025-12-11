import React, { useState, useEffect, useRef, useCallback } from 'react'
import { AlertTriangle, XCircle, TrendingDown, Calendar, DollarSign, Package, Search, Filter, Warehouse, RefreshCw, Save, BookMarked, Trash2, Check, HelpCircle, X, RotateCcw } from 'lucide-react'
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { API_BASE_URL } from '../config/api'
import MultiSelect from '../components/MultiSelect'
import Toast from '../components/Toast'
import { useResizableColumns } from '../hooks/useResizableColumns'

// Cache helpers
const CACHE_KEY = 'deadStock_cache';
const getFromCache = (defaultValue) => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : defaultValue;
  } catch { return defaultValue; }
};
const saveToCache = (value) => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(value)); } catch {}
};

function DeadStock() {
  const API_URL = API_BASE_URL;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deadStockData, setDeadStockData] = useState(() => getFromCache({
    total_items: 0,
    total_frozen_value: 0,
    avg_days_no_movement: 0,
    category_stats: {},
    items: [],
    filters: { marki: [], rodzaje: [], grupy: [] }
  }));
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Filtry tymczasowe (przed zastosowaniem)
  const [tempMarki, setTempMarki] = useState([]);
  const [tempRodzaje, setTempRodzaje] = useState([]);
  const [tempGrupy, setTempGrupy] = useState([]);

  // Filtry aktywne (zastosowane)
  const [selectedMarki, setSelectedMarki] = useState([]);
  const [selectedRodzaje, setSelectedRodzaje] = useState([]);
  const [selectedGrupy, setSelectedGrupy] = useState([]);

  const [selectedRotationStatus, setSelectedRotationStatus] = useState(null);
  const [minDays, setMinDays] = useState(0);
  const [minValue, setMinValue] = useState(0);
  const [sortBy, setSortBy] = useState('days_no_movement');
  const [selectedMagazyny, setSelectedMagazyny] = useState(['1', '2', '7']);

  // Listy unikalnych wartości dla filtrów (inicjalne z danych)
  const [availableMarki, setAvailableMarki] = useState([]);
  const [availableRodzaje, setAvailableRodzaje] = useState([]);
  const [availableGrupy, setAvailableGrupy] = useState([]);

  // Dynamiczne opcje filtrów (zawężone na podstawie wybranych wartości)
  const [dynamicOptions, setDynamicOptions] = useState({
    marka: [],
    rodzaj: [],
    grupa: []
  });
  const [loadingDynamicOptions, setLoadingDynamicOptions] = useState(false);

  // Zapisane filtry
  const [savedFilters, setSavedFilters] = useState([]);
  const [filterName, setFilterName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Toast notifications
  const [toast, setToast] = useState(null);

  // Stan dla okna pomocy
  const [showHelp, setShowHelp] = useState(false);

  // Resizable columns
  const { getColumnStyle, ResizeHandle, resetWidths } = useResizableColumns({
    status: 100,
    produkt: 250,
    kategoria: 120,
    wartosc: 120,
    stan: 80,
    dniRuchu: 100,
    sprz90: 80,
    dniZapasu: 100,
    ostatniaSprz: 100,
    rekomendacja: 200
  }, 'deadStock_columns', 50);

  // Mapowanie magazynów
  const magazyny = {
    '1': 'GLS',
    '2': '4F',
    '7': 'JEANS'
  };

  // Ref do śledzenia czy już pobrano dane
  const hasFetchedRef = useRef(false);
  const lastFetchParamsRef = useRef('');

  // Wczytaj zapisane filtry z localStorage przy montowaniu komponentu
  useEffect(() => {
    const saved = localStorage.getItem('deadStockFilters');
    if (saved) {
      try {
        setSavedFilters(JSON.parse(saved));
      } catch (e) {
        console.error('Błąd wczytywania zapisanych filtrów:', e);
      }
    }
    // Pobierz dane tylko raz przy pierwszym montowaniu
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchDeadStock();
    }
  }, []);

  // Pobierz dane gdy zmienią się filtry (ale nie przy pierwszym montowaniu)
  useEffect(() => {
    const params = `${minDays}-${minValue}-${selectedCategory}-${selectedMarki.join(',')}-${selectedRodzaje.join(',')}-${selectedRotationStatus}-${sortBy}-${selectedMagazyny.join(',')}`;
    if (hasFetchedRef.current && params !== lastFetchParamsRef.current) {
      lastFetchParamsRef.current = params;
      fetchDeadStock();
    }
  }, [minDays, minValue, selectedCategory, selectedMarki, selectedRodzaje, selectedRotationStatus, sortBy, selectedMagazyny]);

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

  const fetchDeadStock = async () => {
    try {
      setLoading(true);
      const magIds = selectedMagazyny.join(',');
      const params = new URLSearchParams({
        min_days: minDays,
        min_value: minValue,
        sort_by: sortBy,
        mag_ids: magIds
      });

      if (selectedCategory) {
        params.append('category', selectedCategory);
      }

      if (selectedRotationStatus) {
        params.append('rotation_status', selectedRotationStatus);
      }

      const response = await fetch(`${API_URL}/api/dead-stock?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setDeadStockData(data);
      saveToCache(data);

      // Wyciągnij unikalne marki, rodzaje i grupy z danych (jako inicjalne opcje)
      if (data.items && data.items.length > 0) {
        const marki = [...new Set(data.items.map(item => item.Marka).filter(m => m && m.trim() !== ''))].sort();
        const rodzaje = [...new Set(data.items.map(item => item.Rodzaj).filter(r => r && r.trim() !== '' && r !== 'Nieznana'))].sort();
        const grupy = [...new Set(data.items.map(item => item.Grupa).filter(g => g && g.trim() !== ''))].sort();
        setAvailableMarki(marki);
        setAvailableRodzaje(rodzaje);
        setAvailableGrupy(grupy);
        // Ustaw też jako początkowe dynamiczne opcje
        setDynamicOptions({
          marka: marki,
          rodzaj: rodzaje,
          grupa: grupy
        });
      }
    } catch (error) {
      setError(error);
      console.error("Błąd podczas pobierania danych o martwych stanach:", error);
    } finally {
      setLoading(false);
    }
  };

  // Pobierz dynamiczne opcje filtrów na podstawie wybranych wartości
  const fetchDynamicOptions = useCallback(async () => {
    try {
      setLoadingDynamicOptions(true);
      const response = await fetch(`${API_URL}/api/products/filter-options-dynamic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marka: tempMarki,
          rodzaj: tempRodzaje,
          grupa: tempGrupy
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setDynamicOptions({
            marka: result.data.marka || availableMarki,
            rodzaj: result.data.rodzaj || availableRodzaje,
            grupa: result.data.grupa || availableGrupy
          });
        }
      }
    } catch (error) {
      console.error('Błąd pobierania dynamicznych opcji:', error);
    } finally {
      setLoadingDynamicOptions(false);
    }
  }, [tempMarki, tempRodzaje, tempGrupy, availableMarki, availableRodzaje, availableGrupy, API_URL]);

  // Debounce - pobierz dynamiczne opcje po 300ms od ostatniej zmiany
  useEffect(() => {
    const hasAnyFilter = tempMarki.length > 0 || tempRodzaje.length > 0 || tempGrupy.length > 0;
    if (hasAnyFilter) {
      const timer = setTimeout(() => {
        fetchDynamicOptions();
      }, 300);
      return () => clearTimeout(timer);
    } else {
      // Jeśli nie ma filtrów, pokaż wszystkie opcje
      setDynamicOptions({
        marka: availableMarki,
        rodzaj: availableRodzaje,
        grupa: availableGrupy
      });
    }
  }, [tempMarki, tempRodzaje, tempGrupy, availableMarki, availableRodzaje, availableGrupy]);

  // Funkcja formatowania liczb z separatorami tysięcznymi
  const formatNumber = (num, decimals = 2) => {
    if (isNaN(num)) return '0,00';
    const fixed = Number(num).toFixed(decimals);
    const parts = fixed.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return parts.join(',');
  };

  const getCategoryColor = (category) => {
    const colors = {
      'NEW': 'purple',
      'NEW_NO_SALES': 'pink',
      'NEW_SELLING': 'green',
      'NEW_SLOW': 'yellow',
      'REPEATED_NO_SALES': 'pink',
      'VERY_FAST': 'emerald',
      'FAST': 'green',
      'NORMAL': 'blue',
      'SLOW': 'yellow',
      'VERY_SLOW': 'orange',
      'DEAD': 'red'
    };
    return colors[category] || 'gray';
  };

  const getCategorySeverity = (category) => {
    const severity = {
      'NEW': 'NOWY (<30d)',
      'NEW_NO_SALES': 'NOWY 0 SPRZ.',
      'NEW_SELLING': 'NOWY OK',
      'NEW_SLOW': 'NOWY WOLNY',
      'REPEATED_NO_SALES': 'BŁĄD ZAKUPU',
      'VERY_FAST': '<30d zapasu',
      'FAST': '30-90d zapasu',
      'NORMAL': '90-180d zapasu',
      'SLOW': '180-365d zapasu',
      'VERY_SLOW': '>365d zapasu',
      'DEAD': 'BRAK ROTACJI'
    };
    return severity[category] || 'NIEZNANY';
  };

  // Funkcja zastosowania filtrów multi-select
  const applyFilters = () => {
    setSelectedMarki(tempMarki);
    setSelectedRodzaje(tempRodzaje);
    setSelectedGrupy(tempGrupy);
    setToast({ message: 'Filtry zastosowane', type: 'success' });
  };

  // Funkcje zarządzania zapisanymi filtrami
  const saveCurrentFilter = () => {
    if (!filterName.trim()) {
      setToast({ message: 'Podaj nazwę filtru', type: 'warning' });
      return;
    }

    const filterConfig = {
      name: filterName,
      minDays,
      minValue,
      selectedCategory,
      selectedMarki,
      selectedRodzaje,
      selectedGrupy,
      selectedRotationStatus,
      sortBy,
      selectedMagazyny,
      createdAt: new Date().toISOString()
    };

    const newFilters = [...savedFilters, filterConfig];
    setSavedFilters(newFilters);
    localStorage.setItem('deadStockFilters', JSON.stringify(newFilters));

    setFilterName('');
    setShowSaveDialog(false);
    setToast({ message: `Filtr "${filterConfig.name}" został zapisany`, type: 'success' });
  };

  const loadFilter = (filter) => {
    setMinDays(filter.minDays);
    setMinValue(filter.minValue);
    setSelectedCategory(filter.selectedCategory);
    setSelectedMarki(filter.selectedMarki || []);
    setSelectedRodzaje(filter.selectedRodzaje || []);
    setSelectedGrupy(filter.selectedGrupy || []);
    setTempMarki(filter.selectedMarki || []);
    setTempRodzaje(filter.selectedRodzaje || []);
    setTempGrupy(filter.selectedGrupy || []);
    setSelectedRotationStatus(filter.selectedRotationStatus);
    setSortBy(filter.sortBy);
    setSelectedMagazyny(filter.selectedMagazyny);
    setToast({ message: `Wczytano filtr "${filter.name}"`, type: 'success' });
  };

  const deleteFilter = (index) => {
    const filterName = savedFilters[index].name;
    const newFilters = savedFilters.filter((_, i) => i !== index);
    setSavedFilters(newFilters);
    localStorage.setItem('deadStockFilters', JSON.stringify(newFilters));
    setToast({ message: `Usunięto filtr "${filterName}"`, type: 'success' });
  };

  const clearAllFilters = () => {
    setMinDays(0);
    setMinValue(0);
    setSelectedCategory(null);
    setSelectedMarki([]);
    setSelectedRodzaje([]);
    setSelectedGrupy([]);
    setTempMarki([]);
    setTempRodzaje([]);
    setTempGrupy([]);
    setSelectedRotationStatus(null);
    setSortBy('days_no_movement');
    setSelectedMagazyny(['1', '2', '7']);
    setToast({ message: 'Wyczyszczono wszystkie filtry', type: 'success' });
  };

  const filteredItems = deadStockData?.items.filter(item => {
    // Filtr wyszukiwania tekstowego
    const matchesSearch = !searchTerm ||
      item.Nazwa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.Symbol?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.Marka?.toLowerCase().includes(searchTerm.toLowerCase());

    // Filtr marek (multi-select)
    const matchesMarka = selectedMarki.length === 0 || selectedMarki.includes(item.Marka);

    // Filtr rodzajów (multi-select)
    const matchesRodzaj = selectedRodzaje.length === 0 || selectedRodzaje.includes(item.Rodzaj);

    // Filtr grup (multi-select)
    const matchesGrupa = selectedGrupy.length === 0 || selectedGrupy.includes(item.Grupa);

    return matchesSearch && matchesMarka && matchesRodzaj && matchesGrupa;
  }) || [];

  // Przygotuj dane do wykresów
  const categoryChartData = deadStockData ? Object.entries(deadStockData.category_stats).map(([key, value]) => ({
    name: getCategorySeverity(key),
    value: value,
    fill: getCategoryColor(key) === 'purple' ? '#a855f7' :
          getCategoryColor(key) === 'pink' ? '#ec4899' :
          getCategoryColor(key) === 'emerald' ? '#10b981' :
          getCategoryColor(key) === 'green' ? '#22c55e' :
          getCategoryColor(key) === 'blue' ? '#3b82f6' :
          getCategoryColor(key) === 'yellow' ? '#eab308' :
          getCategoryColor(key) === 'orange' ? '#f97316' :
          getCategoryColor(key) === 'red' ? '#ef4444' : '#6b7280'
  })) : [];

  const topCategoriesData = deadStockData ?
    Object.entries(
      deadStockData.items.reduce((acc, item) => {
        const cat = item.Rodzaj || 'Nieznana';
        if (!acc[cat]) acc[cat] = { value: 0, count: 0 };
        acc[cat].value += item.FrozenValue;
        acc[cat].count += 1;
        return acc;
      }, {})
    )
    .map(([name, data]) => ({ name, value: data.value, count: data.count }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10) : [];

  if (error) {
    return <div className="text-center text-lg font-medium text-red-600">Błąd: {error.message}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Nagłówek */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Martwe Stany Magazynowe</h1>
          <p className="text-gray-500 mt-1">Analiza rotacji zapasów i identyfikacja produktów o niskiej sprzedaży</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 px-4 py-2 bg-red-100 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="text-sm font-medium text-red-900">
              {deadStockData?.total_items || 0} produktów wymaga uwagi
            </span>
          </div>
          <button
            onClick={fetchDeadStock}
            className="btn-secondary flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Odśwież</span>
          </button>
        </div>
      </div>

      {/* Podsumowanie KPI */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="card bg-pink-50 border-2 border-pink-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Błąd zakupu</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {deadStockData?.category_stats?.REPEATED_NO_SALES || 0}
              </p>
              <div className="flex items-center mt-2 text-pink-600">
                <AlertTriangle className="w-4 h-4 mr-1" />
                <span className="text-sm font-medium">Powtórne zakupy</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card bg-red-50 border-2 border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Produkty DEAD</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {deadStockData?.category_stats?.DEAD || 0}
              </p>
              <div className="flex items-center mt-2 text-red-600">
                <XCircle className="w-4 h-4 mr-1" />
                <span className="text-sm font-medium">&gt;180 dni</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card bg-orange-50 border-2 border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Bardzo wolne</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {deadStockData?.category_stats?.VERY_SLOW || 0}
              </p>
              <div className="flex items-center mt-2 text-orange-600">
                <TrendingDown className="w-4 h-4 mr-1" />
                <span className="text-sm font-medium">90-180 dni</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card bg-green-50 border-2 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Zamrożony kapitał</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {formatNumber(deadStockData?.total_frozen_value || 0)} zł
              </p>
              <div className="flex items-center mt-2 text-green-600">
                <DollarSign className="w-4 h-4 mr-1" />
                <span className="text-sm font-medium">Wartość netto</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card bg-purple-50 border-2 border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Średni wiek</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {formatNumber(deadStockData?.avg_days_no_movement || 0, 0)} dni
              </p>
              <div className="flex items-center mt-2 text-purple-600">
                <Calendar className="w-4 h-4 mr-1" />
                <span className="text-sm font-medium">Bez ruchu</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filtry */}
      <div className="card">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Min. dni bez ruchu
              </label>
              <input
                type="number"
                value={minDays}
                onChange={(e) => setMinDays(Number(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded-lg"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Min. wartość zamrożona (zł)
              </label>
              <input
                type="number"
                value={minValue}
                onChange={(e) => setMinValue(Number(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded-lg"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sortuj według
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg"
              >
                <option value="days_no_movement">Dni bez ruchu</option>
                <option value="frozen_value">Wartość zamrożona</option>
                <option value="turnover_ratio">Wskaźnik rotacji</option>
              </select>
            </div>

          </div>

          {/* Filtry magazynowe */}
          <div className="border-t pt-4">
            <div className="flex items-center space-x-3 mb-3">
              <Warehouse className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Magazyny:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(magazyny).map(([id, name]) => (
                <button
                  key={id}
                  onClick={() => toggleMagazyn(id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedMagazyny.includes(id)
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Filtry Marki, Rodzaju i Grup - Multi-Select z dynamicznym zawężaniem */}
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">Filtry produktów</span>
              {loadingDynamicOptions && (
                <span className="ml-2 text-xs text-blue-600 flex items-center gap-1">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                  Aktualizuję opcje...
                </span>
              )}
              <span className="text-xs text-blue-600 ml-auto">Listy zawężają się automatycznie</span>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-3">
              <MultiSelect
                label="Marki"
                options={dynamicOptions.marka}
                selected={tempMarki}
                onChange={setTempMarki}
                placeholder="Wszystkie marki"
              />
              <MultiSelect
                label="Rodzaje"
                options={dynamicOptions.rodzaj}
                selected={tempRodzaje}
                onChange={setTempRodzaje}
                placeholder="Wszystkie rodzaje"
              />
              <MultiSelect
                label="Grupy produktowe"
                options={dynamicOptions.grupa}
                selected={tempGrupy}
                onChange={setTempGrupy}
                placeholder="Wszystkie grupy"
              />
            </div>
            <button
              onClick={applyFilters}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
            >
              <Check className="w-4 h-4" />
              <span>Zastosuj filtry</span>
            </button>
          </div>

          {/* Zarządzanie zapisanymi filtrami */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <BookMarked className="w-5 h-5 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Zapisane filtry:</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={clearAllFilters}
                  className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Wyczyść wszystko
                </button>
                <button
                  onClick={() => setShowSaveDialog(true)}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-1"
                >
                  <Save className="w-4 h-4" />
                  <span>Zapisz filtr</span>
                </button>
              </div>
            </div>

            {/* Lista rozwijana z zapisanymi filtrami */}
            {savedFilters.length > 0 && (
              <div className="mt-3">
                <select
                  onChange={(e) => {
                    const index = parseInt(e.target.value);
                    if (!isNaN(index)) {
                      loadFilter(savedFilters[index]);
                    }
                  }}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white"
                  defaultValue=""
                >
                  <option value="" disabled>Wybierz zapisany filtr ({savedFilters.length})</option>
                  {savedFilters.map((filter, index) => (
                    <option key={index} value={index}>
                      {filter.name} - {new Date(filter.createdAt).toLocaleDateString('pl-PL')}
                    </option>
                  ))}
                </select>

                {/* Lista zapisanych filtrów z przyciskami usuń */}
                <div className="mt-2 space-y-2">
                  {savedFilters.map((filter, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200 text-sm"
                    >
                      <span className="text-gray-700 font-medium">{filter.name}</span>
                      <button
                        onClick={() => deleteFilter(index)}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Usuń filtr"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Filtry statusu rotacji */}
          <div className="border-t pt-4">
            <div className="flex items-center space-x-3 mb-3">
              <Filter className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Rotacja (dni zapasu):</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedRotationStatus(null)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  !selectedRotationStatus
                    ? 'bg-gray-600 text-white hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Wszystkie
              </button>
              <button
                onClick={() => setSelectedRotationStatus('REPEATED_NO_SALES')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedRotationStatus === 'REPEATED_NO_SALES'
                    ? 'bg-pink-600 text-white hover:bg-pink-700'
                    : 'bg-pink-100 text-pink-700 hover:bg-pink-200'
                }`}
              >
                BŁĄD ZAKUPU
              </button>
              <button
                onClick={() => setSelectedRotationStatus('DEAD')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedRotationStatus === 'DEAD'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
              >
                BRAK ROTACJI (0 sprz.)
              </button>
              <button
                onClick={() => setSelectedRotationStatus('VERY_SLOW')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedRotationStatus === 'VERY_SLOW'
                    ? 'bg-orange-600 text-white hover:bg-orange-700'
                    : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                }`}
              >
                &gt;365 dni zapasu
              </button>
              <button
                onClick={() => setSelectedRotationStatus('SLOW')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedRotationStatus === 'SLOW'
                    ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                    : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                }`}
              >
                180-365 dni zapasu
              </button>
              <button
                onClick={() => setSelectedRotationStatus('NORMAL')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedRotationStatus === 'NORMAL'
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
              >
                90-180 dni zapasu
              </button>
              <button
                onClick={() => setSelectedRotationStatus('FAST')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedRotationStatus === 'FAST'
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                30-90 dni zapasu
              </button>
              <button
                onClick={() => setSelectedRotationStatus('VERY_FAST')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedRotationStatus === 'VERY_FAST'
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                }`}
              >
                &lt;30 dni zapasu
              </button>
              <button
                onClick={() => setSelectedRotationStatus('NEW')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedRotationStatus === 'NEW'
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                }`}
              >
                Nowy (&lt;30d w systemie)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Wykresy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Rozkład kategorii rotacji</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={100}
                dataKey="value"
              >
                {categoryChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top 10 kategorii (wartość zamrożona)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topCategoriesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip formatter={(value) => `${formatNumber(value)} zł`} />
              <Bar dataKey="value" fill="#ef4444" name="Wartość zamrożona" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Wyszukiwarka */}
      <div className="card">
        <div className="flex items-center space-x-4">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Szukaj produktu po nazwie, symbolu lub marce..."
            className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="text-sm text-gray-500">
            Znaleziono: {filteredItems.length} produktów
          </span>
        </div>
      </div>

      {/* Tabela produktów - priorytetyzowana */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Produkty wymagające uwagi</h2>
          <div className="text-sm text-gray-500">
            Priorytet: dni bez ruchu + dni zapasu (rotacja) + wartość zamrożona
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="flex justify-end mb-2">
            <button
              onClick={resetWidths}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
              title="Resetuj szerokości kolumn"
            >
              <RotateCcw className="w-3 h-3" />
              Reset kolumn
            </button>
          </div>
          <table className="min-w-full table-fixed">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider sticky left-0 bg-gray-100 relative" style={getColumnStyle('status')}>
                  Status
                  <ResizeHandle columnKey="status" />
                </th>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider relative" style={getColumnStyle('produkt')}>
                  Produkt
                  <ResizeHandle columnKey="produkt" />
                </th>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider relative" style={getColumnStyle('kategoria')}>
                  Kategoria
                  <ResizeHandle columnKey="kategoria" />
                </th>
                <th className="px-3 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider relative" style={getColumnStyle('wartosc')}>
                  Wartość zamrożona
                  <ResizeHandle columnKey="wartosc" />
                </th>
                <th className="px-3 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider relative" style={getColumnStyle('stan')}>
                  Stan
                  <ResizeHandle columnKey="stan" />
                </th>
                <th className="px-3 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider relative" style={getColumnStyle('dniRuchu')}>
                  Dni bez ruchu
                  <ResizeHandle columnKey="dniRuchu" />
                </th>
                <th className="px-3 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider relative" style={getColumnStyle('sprz90')}>
                  Sprz. 90d
                  <ResizeHandle columnKey="sprz90" />
                </th>
                <th className="px-3 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider relative" style={getColumnStyle('dniZapasu')}>
                  Dni zapasu
                  <ResizeHandle columnKey="dniZapasu" />
                </th>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider relative" style={getColumnStyle('ostatniaSprz')}>
                  Ostatnia sprz.
                  <ResizeHandle columnKey="ostatniaSprz" />
                </th>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider relative" style={getColumnStyle('rekomendacja')}>
                  Rekomendacja
                  <ResizeHandle columnKey="rekomendacja" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredItems
                // Sortowanie priorytetowe: dni bez ruchu + dni zapasu (rotacja) + wartość
                .sort((a, b) => {
                  // 1. Najpierw błędy zakupu (powtórne zakupy bez sprzedaży)
                  if (a.Category === 'REPEATED_NO_SALES' && b.Category !== 'REPEATED_NO_SALES') return -1;
                  if (b.Category === 'REPEATED_NO_SALES' && a.Category !== 'REPEATED_NO_SALES') return 1;

                  // 2. Dni bez ruchu (malejąco) - im więcej dni bez ruchu, tym wyżej
                  const daysNoMovA = a.DaysNoMovement || 0;
                  const daysNoMovB = b.DaysNoMovement || 0;
                  if (Math.abs(daysNoMovA - daysNoMovB) > 30) {
                    return daysNoMovB - daysNoMovA;
                  }

                  // 3. Dni zapasu / rotacja (malejąco) - im więcej dni zapasu, tym gorzej
                  const daysStockA = a.DniZapasu === null || a.DniZapasu === undefined ? 99999 : a.DniZapasu;
                  const daysStockB = b.DniZapasu === null || b.DniZapasu === undefined ? 99999 : b.DniZapasu;
                  if (daysStockA !== daysStockB) {
                    return daysStockB - daysStockA;
                  }

                  // 4. Na końcu wartość zamrożona (malejąco)
                  const valueA = a.FrozenValue || 0;
                  const valueB = b.FrozenValue || 0;
                  return valueB - valueA;
                })
                .slice(0, 50)
                .map((item, index) => {
                  const color = getCategoryColor(item.Category);
                  const severity = getCategorySeverity(item.Category);

                  // Określ kolor tła wiersza na podstawie dni bez ruchu i rotacji
                  const dniZapasu = item.DniZapasu === null || item.DniZapasu === undefined ? 99999 : item.DniZapasu;
                  const dniBezRuchu = item.DaysNoMovement || 0;

                  let rowBgClass = 'hover:bg-gray-50';
                  if (item.Category === 'REPEATED_NO_SALES') {
                    rowBgClass = 'bg-pink-100 hover:bg-pink-200'; // Błąd zakupu - różowy
                  } else if (dniBezRuchu >= 180 || dniZapasu >= 9999) {
                    rowBgClass = 'bg-red-50 hover:bg-red-100'; // Krytyczny - czerwony
                  } else if (dniBezRuchu >= 90 || dniZapasu >= 365) {
                    rowBgClass = 'bg-orange-50 hover:bg-orange-100'; // Bardzo wolny - pomarańczowy
                  } else if (dniBezRuchu >= 60 || dniZapasu >= 180) {
                    rowBgClass = 'bg-yellow-50 hover:bg-yellow-100'; // Wolny - żółty
                  }

                  return (
                    <tr key={index} className={rowBgClass}>
                      {/* Status */}
                      <td className={`px-3 py-2 whitespace-nowrap sticky left-0 ${rowBgClass}`}>
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${
                          color === 'red' ? 'bg-red-200 text-red-900' :
                          color === 'orange' ? 'bg-orange-200 text-orange-900' :
                          color === 'yellow' ? 'bg-yellow-200 text-yellow-900' :
                          color === 'pink' ? 'bg-pink-200 text-pink-900' :
                          color === 'purple' ? 'bg-purple-200 text-purple-900' :
                          color === 'green' ? 'bg-green-200 text-green-900' :
                          color === 'emerald' ? 'bg-emerald-200 text-emerald-900' :
                          color === 'blue' ? 'bg-blue-200 text-blue-900' :
                          'bg-gray-200 text-gray-900'
                        }`}>
                          {severity}
                        </span>
                      </td>

                      {/* Produkt */}
                      <td className="px-3 py-2">
                        <div className="max-w-xs">
                          <p className="text-sm font-medium text-gray-900 truncate" title={item.Nazwa}>
                            {item.Nazwa}
                          </p>
                          <p className="text-xs text-gray-500">
                            {item.Symbol} | {item.Marka}
                          </p>
                        </div>
                      </td>

                      {/* Kategoria/Rodzaj */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="text-sm text-gray-700">{item.Rodzaj || '-'}</span>
                      </td>

                      {/* Wartość zamrożona */}
                      <td className="px-3 py-2 whitespace-nowrap text-right">
                        <span className={`text-sm font-bold ${
                          item.FrozenValue >= 5000 ? 'text-red-700' :
                          item.FrozenValue >= 1000 ? 'text-orange-600' :
                          'text-gray-900'
                        }`}>
                          {formatNumber(item.FrozenValue)} zł
                        </span>
                      </td>

                      {/* Stan */}
                      <td className="px-3 py-2 whitespace-nowrap text-right">
                        <span className="text-sm text-gray-900">{formatNumber(item.Stan, 0)} szt.</span>
                      </td>

                      {/* Dni bez ruchu */}
                      <td className="px-3 py-2 whitespace-nowrap text-right">
                        <span className={`text-sm font-medium ${
                          item.DaysNoMovement >= 180 ? 'text-red-700' :
                          item.DaysNoMovement >= 90 ? 'text-orange-600' :
                          item.DaysNoMovement >= 60 ? 'text-yellow-600' :
                          'text-gray-900'
                        }`}>
                          {item.DaysNoMovement}
                        </span>
                      </td>

                      {/* Sprzedaż 90 dni */}
                      <td className="px-3 py-2 whitespace-nowrap text-right">
                        <span className={`text-sm ${
                          item.IloscSprzedana90dni === 0 ? 'text-red-600 font-medium' : 'text-gray-900'
                        }`}>
                          {formatNumber(item.IloscSprzedana90dni || 0, 0)}
                        </span>
                      </td>

                      {/* Dni zapasu */}
                      <td className="px-3 py-2 whitespace-nowrap text-right">
                        <span className={`text-sm font-medium ${
                          item.DniZapasu === null || item.DniZapasu === undefined ? 'text-red-600' :
                          item.DniZapasu >= 365 ? 'text-red-600' :
                          item.DniZapasu >= 180 ? 'text-orange-600' :
                          item.DniZapasu >= 90 ? 'text-yellow-600' :
                          'text-green-600'
                        }`}>
                          {item.DniZapasu !== null && item.DniZapasu !== undefined
                            ? (item.DniZapasu >= 9999 ? '∞' : formatNumber(item.DniZapasu, 0))
                            : '∞'}
                        </span>
                      </td>

                      {/* Ostatnia sprzedaż */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="text-xs text-gray-600">
                          {item.OstatniaSprzedaz
                            ? item.OstatniaSprzedaz
                            : (item.DaysNoMovement >= 365 ? 'Ponad rok temu' : 'Brak')}
                        </span>
                      </td>

                      {/* Rekomendacja */}
                      <td className="px-3 py-2">
                        <p className="text-xs text-gray-700 max-w-xs" title={item.Recommendation}>
                          {item.Recommendation?.length > 80
                            ? item.Recommendation.substring(0, 80) + '...'
                            : item.Recommendation}
                        </p>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {filteredItems.length > 50 && (
          <div className="p-4 text-center text-sm text-gray-500 border-t">
            Wyświetlono 50 z {filteredItems.length} produktów. Użyj filtrów lub wyszukiwarki aby zawęzić wyniki.
          </div>
        )}

        {filteredItems.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>Brak produktów spełniających kryteria</p>
          </div>
        )}
      </div>

      {/* Dialog zapisywania filtru */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Zapisz bieżący filtr</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nazwa filtru
              </label>
              <input
                type="text"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                placeholder="np. Martwe buty sportowe"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyPress={(e) => e.key === 'Enter' && saveCurrentFilter()}
              />
            </div>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm text-gray-600">
              <p className="font-medium mb-2">Aktualny filtr zawiera:</p>
              <ul className="list-disc list-inside space-y-1">
                {minDays > 0 && <li>Min. dni bez ruchu: {minDays}</li>}
                {minValue > 0 && <li>Min. wartość: {minValue} zł</li>}
                {selectedMarki.length > 0 && <li>Marki: {selectedMarki.join(', ')}</li>}
                {selectedRodzaje.length > 0 && <li>Rodzaje: {selectedRodzaje.join(', ')}</li>}
                {selectedGrupy.length > 0 && <li>Grupy: {selectedGrupy.join(', ')}</li>}
                {selectedRotationStatus && <li>Status: {getCategorySeverity(selectedRotationStatus)}</li>}
                <li>Magazyny: {selectedMagazyny.map(id => magazyny[id]).join(', ')}</li>
              </ul>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowSaveDialog(false);
                  setFilterName('');
                }}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Anuluj
              </button>
              <button
                onClick={saveCurrentFilter}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>Zapisz</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

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
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <HelpCircle className="w-6 h-6 text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Martwe Stany - Pomoc</h2>
              </div>
              <button onClick={() => setShowHelp(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Do czego sluzy ten widok?</h3>
                <p className="text-gray-600">
                  Widok Martwe Stany Magazynowe pozwala identyfikowac produkty o niskiej rotacji, ktore zamrazaja kapital
                  i zajmuja miejsce w magazynie. Pomaga podejmowac decyzje o promocjach, wyprzedazach lub likwidacji zapasow.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Glowne funkcjonalnosci:</h3>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3 p-3 bg-red-50 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Kategorie rotacji</p>
                      <p className="text-sm text-gray-600">DEAD (brak sprzedazy), VERY_SLOW (ponad 365 dni zapasu), SLOW (180-365 dni), NORMAL, FAST, VERY_FAST.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-pink-50 rounded-lg">
                    <XCircle className="w-5 h-5 text-pink-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Bledy zakupu</p>
                      <p className="text-sm text-gray-600">Identyfikacja produktow kupionych ponownie mimo braku sprzedazy.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
                    <DollarSign className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Zamrozony kapital</p>
                      <p className="text-sm text-gray-600">Wartosc produktow bez rotacji - kapital, ktory mozna odzyskac.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                    <Filter className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Zaawansowane filtry</p>
                      <p className="text-sm text-gray-600">Filtrowanie po markach, rodzajach, grupach, magazynach. Mozliwosc zapisywania filtrow.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-purple-50 rounded-lg">
                    <Calendar className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Dni bez ruchu</p>
                      <p className="text-sm text-gray-600">Liczba dni od ostatniej sprzedazy - kluczowy wskaznik rotacji.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Wskazowka</h4>
                <p className="text-sm text-gray-600">
                  Skup sie najpierw na produktach oznaczonych jako "BLAD ZAKUPU" i "DEAD" - to one generuja najwieksze straty.
                  Uzyj filtra "Min. wartość zamrożona" aby znalezc najdrozsze produkty do likwidacji.
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
  )
}

export default DeadStock
