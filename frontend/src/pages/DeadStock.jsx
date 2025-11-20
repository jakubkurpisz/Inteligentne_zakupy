import React, { useState, useEffect } from 'react'
import { AlertTriangle, XCircle, TrendingDown, Calendar, DollarSign, Package, Search, Filter, Download, Warehouse, RefreshCw, Save, BookMarked, Trash2, Check } from 'lucide-react'
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { API_BASE_URL } from '../config/api'
import MultiSelect from '../components/MultiSelect'
import Toast from '../components/Toast'

function DeadStock() {
  const API_URL = API_BASE_URL;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deadStockData, setDeadStockData] = useState(null);
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

  // Listy unikalnych wartości dla filtrów
  const [availableMarki, setAvailableMarki] = useState([]);
  const [availableRodzaje, setAvailableRodzaje] = useState([]);
  const [availableGrupy, setAvailableGrupy] = useState([]);

  // Zapisane filtry
  const [savedFilters, setSavedFilters] = useState([]);
  const [filterName, setFilterName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Toast notifications
  const [toast, setToast] = useState(null);

  // Mapowanie magazynów
  const magazyny = {
    '1': 'GLS',
    '2': '4F',
    '7': 'JEANS'
  };

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
  }, []);

  useEffect(() => {
    fetchDeadStock();
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

      // Wyciągnij unikalne marki, rodzaje i grupy z danych
      if (data.items && data.items.length > 0) {
        const marki = [...new Set(data.items.map(item => item.Marka).filter(m => m && m.trim() !== ''))].sort();
        const rodzaje = [...new Set(data.items.map(item => item.Rodzaj).filter(r => r && r.trim() !== '' && r !== 'Nieznana'))].sort();
        const grupy = [...new Set(data.items.map(item => item.Grupa).filter(g => g && g.trim() !== ''))].sort();
        setAvailableMarki(marki);
        setAvailableRodzaje(rodzaje);
        setAvailableGrupy(grupy);
      }
    } catch (error) {
      setError(error);
      console.error("Błąd podczas pobierania danych o martwych stanach:", error);
    } finally {
      setLoading(false);
    }
  };

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
      'NEW': 'NOWY',
      'NEW_NO_SALES': 'NOWY BEZ SPRZEDAŻY',
      'NEW_SELLING': 'NOWY - SPRZEDAJE SIĘ',
      'NEW_SLOW': 'NOWY - WOLNY',
      'REPEATED_NO_SALES': 'BŁĄD ZAKUPU',
      'VERY_FAST': 'BARDZO SZYBKI',
      'FAST': 'SZYBKI',
      'NORMAL': 'NORMALNY',
      'SLOW': 'WOLNY',
      'VERY_SLOW': 'BARDZO WOLNY',
      'DEAD': 'KRYTYCZNY'
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

  if (loading) {
    return <div className="text-center text-lg font-medium">Ładowanie danych martwych stanów...</div>;
  }

  if (error) {
    return <div className="text-center text-lg font-medium text-red-600">Błąd: {error.message}</div>;
  }

  if (!deadStockData) {
    return <div className="text-center text-lg font-medium">Brak danych</div>;
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
              {deadStockData.total_items} produktów wymaga uwagi
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
                {deadStockData.category_stats.REPEATED_NO_SALES || 0}
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
                {deadStockData.category_stats.DEAD || 0}
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
                {deadStockData.category_stats.VERY_SLOW || 0}
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
                {formatNumber(deadStockData.total_frozen_value)} zł
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
                {formatNumber(deadStockData.avg_days_no_movement, 0)} dni
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Akcje
              </label>
              <button className="w-full btn-primary flex items-center justify-center space-x-2">
                <Download className="w-4 h-4" />
                <span>Eksportuj</span>
              </button>
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

          {/* Filtry Marki, Rodzaju i Grup - Multi-Select */}
          <div className="border-t pt-4">
            <div className="grid grid-cols-3 gap-4 mb-3">
              <MultiSelect
                label="Marki"
                options={availableMarki}
                selected={tempMarki}
                onChange={setTempMarki}
                placeholder="Wszystkie marki"
              />
              <MultiSelect
                label="Rodzaje"
                options={availableRodzaje}
                selected={tempRodzaje}
                onChange={setTempRodzaje}
                placeholder="Wszystkie rodzaje"
              />
              <MultiSelect
                label="Grupy produktowe"
                options={availableGrupy}
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
              <span className="text-sm font-medium text-gray-700">Status rotacji:</span>
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
                onClick={() => setSelectedRotationStatus('DEAD')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedRotationStatus === 'DEAD'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
              >
                Martwy (brak sprzedaży)
              </button>
              <button
                onClick={() => setSelectedRotationStatus('VERY_SLOW')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedRotationStatus === 'VERY_SLOW'
                    ? 'bg-orange-600 text-white hover:bg-orange-700'
                    : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                }`}
              >
                Bardzo wolny (&gt;365 dni zapasu)
              </button>
              <button
                onClick={() => setSelectedRotationStatus('SLOW')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedRotationStatus === 'SLOW'
                    ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                    : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                }`}
              >
                Wolny (181-365 dni zapasu)
              </button>
              <button
                onClick={() => setSelectedRotationStatus('NORMAL')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedRotationStatus === 'NORMAL'
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
              >
                Normalny (91-180 dni zapasu)
              </button>
              <button
                onClick={() => setSelectedRotationStatus('VERY_FAST')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedRotationStatus === 'VERY_FAST'
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                }`}
              >
                Bardzo szybki (0-30 dni zapasu)
              </button>
              <button
                onClick={() => setSelectedRotationStatus('FAST')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedRotationStatus === 'FAST'
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                Szybki (31-90 dni zapasu)
              </button>
              <button
                onClick={() => setSelectedRotationStatus('NEW')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedRotationStatus === 'NEW'
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                }`}
              >
                Nowy (&lt;30 dni w systemie)
              </button>
              <button
                onClick={() => setSelectedRotationStatus('REPEATED_NO_SALES')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedRotationStatus === 'REPEATED_NO_SALES'
                    ? 'bg-pink-600 text-white hover:bg-pink-700'
                    : 'bg-pink-100 text-pink-700 hover:bg-pink-200'
                }`}
              >
                Błąd zakupu (powtórny zakup bez sprzedaży)
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

      {/* Szczegółowa lista produktów */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Produkty wymagające uwagi</h2>
        <div className="space-y-4">
          {filteredItems.slice(0, 20).map((item, index) => {
            const color = getCategoryColor(item.Category);
            const severity = getCategorySeverity(item.Category);

            return (
              <div
                key={index}
                className={`border-2 rounded-lg p-6 ${
                  color === 'red' ? 'border-red-300 bg-red-50' :
                  color === 'orange' ? 'border-orange-300 bg-orange-50' :
                  color === 'yellow' ? 'border-yellow-300 bg-yellow-50' :
                  color === 'pink' ? 'border-pink-300 bg-pink-50' :
                  color === 'purple' ? 'border-purple-300 bg-purple-50' :
                  color === 'green' ? 'border-green-300 bg-green-50' :
                  color === 'emerald' ? 'border-emerald-300 bg-emerald-50' :
                  color === 'blue' ? 'border-blue-300 bg-blue-50' :
                  'border-gray-300 bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <AlertTriangle className={`w-6 h-6 ${
                        color === 'red' ? 'text-red-600' :
                        color === 'orange' ? 'text-orange-600' :
                        color === 'yellow' ? 'text-yellow-600' :
                        color === 'pink' ? 'text-pink-600' :
                        color === 'purple' ? 'text-purple-600' :
                        color === 'green' ? 'text-green-600' :
                        color === 'emerald' ? 'text-emerald-600' :
                        color === 'blue' ? 'text-blue-600' :
                        'text-gray-600'
                      }`} />
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{item.Nazwa}</h3>
                        <p className="text-sm text-gray-600">
                          {item.Symbol} | {item.Marka} | {item.Rodzaj}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
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
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Stan</p>
                    <p className="text-lg font-bold text-gray-900">{formatNumber(item.Stan, 0)} szt.</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Dni bez ruchu</p>
                    <p className="text-lg font-bold text-gray-900">{item.DaysNoMovement}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Wartość zamrożona</p>
                    <p className="text-lg font-bold text-red-600">{formatNumber(item.FrozenValue)} zł</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Sprzedaż 90 dni</p>
                    <p className="text-lg font-bold text-gray-900">{formatNumber(item.IloscSprzedana90dni, 0)} szt.</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Rotacja</p>
                    <p className="text-lg font-bold text-blue-600">{item.TurnoverRatio}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Cena</p>
                    <p className="text-lg font-bold text-gray-900">{formatNumber(item.DetalicznaNetto)} zł</p>
                  </div>
                </div>

                <div className="bg-white/70 rounded-lg p-4 mb-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <p className="text-sm text-gray-600">
                      Ostatnia zmiana stanu: <span className="font-medium text-gray-900">{item.LastStanChange || 'Brak danych'}</span>
                      {item.OstatniaSprzedaz && (
                        <> | Ostatnia sprzedaż: <span className="font-medium text-gray-900">{item.OstatniaSprzedaz}</span></>
                      )}
                    </p>
                  </div>
                </div>

                <div className="bg-white/70 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-900 mb-2">Rekomendacja:</p>
                  <p className="text-sm text-gray-700">{item.Recommendation}</p>
                </div>
              </div>
            );
          })}
        </div>
        {filteredItems.length > 20 && (
          <div className="p-4 text-center text-sm text-gray-500">
            Wyświetlono 20 z {filteredItems.length} produktów. Użyj wyszukiwarki aby zawęzić wyniki.
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
    </div>
  )
}

export default DeadStock
