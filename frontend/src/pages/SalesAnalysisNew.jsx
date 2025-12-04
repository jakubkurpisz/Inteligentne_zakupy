import React, { useState, useEffect } from 'react'
import { Calendar, TrendingUp, Filter, RefreshCw, Warehouse, Package, ChevronDown, ChevronUp, HelpCircle, X } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { API_BASE_URL } from '../config/api'

function SalesAnalysisNew() {
  const API_URL = API_BASE_URL;
  const [salesData, setSalesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedMagazyny, setSelectedMagazyny] = useState(['1', '7', '9']);

  // Stan dla listy towarów sprzedanych
  const [salesItems, setSalesItems] = useState([]);
  const [salesItemsLoading, setSalesItemsLoading] = useState(false);
  const [salesItemsError, setSalesItemsError] = useState(null);
  const [availableFilters, setAvailableFilters] = useState({ rodzaje: [], przeznaczenia: [], marki: [] });
  const [selectedRodzaj, setSelectedRodzaj] = useState('');
  const [selectedPrzeznaczenie, setSelectedPrzeznaczenie] = useState('');
  const [selectedMarka, setSelectedMarka] = useState('');
  const [showItemsSection, setShowItemsSection] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'WartoscBrutto', direction: 'desc' });

  // Stan dla wykresu trendu produktów
  const [trendData, setTrendData] = useState([]);
  const [trendLoading, setTrendLoading] = useState(false);

  // Filtry dla wykresu trendu (symbol i model)
  const [trendSymbol, setTrendSymbol] = useState('');
  const [trendModel, setTrendModel] = useState('');

  // Stan dla okna pomocy
  const [showHelp, setShowHelp] = useState(false);

  // Mapowanie magazynów
  const magazyny = {
    '1': 'GLS',
    '2': 'GLS DEPOZYT',
    '7': 'JEANS',
    '9': 'INNE'
  };

  useEffect(() => {
    // Ustaw domyślny zakres dat - MIESIĘCZNY = od 1-go dnia bieżącego miesiąca do dziś
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(firstDayOfMonth.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      fetchSalesHistory();
    }
  }, [period, startDate, endDate, selectedMagazyny]);

  const fetchSalesHistory = async () => {
    setLoading(true);
    try {
      const magIds = selectedMagazyny.join(',');
      // Roczny - grupuj miesięcznie, pozostałe - dziennie
      const groupBy = period === 'yearly' ? 'month' : 'day';

      // Używamy sales-items-trend (live z SQL Server) zamiast sales-history (SQLite)
      const url = `${API_URL}/api/sales-items-trend?start_date=${startDate}&end_date=${endDate}&mag_ids=${magIds}&group_by=${groupBy}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();

      // Mapowanie danych - Data -> DataSprzedazy dla kompatybilności z istniejącymi komponentami
      const mappedData = (result.data || []).map(item => ({
        DataSprzedazy: item.Data,
        IloscSprzedana: item.IloscSprzedana,
        WartoscNetto: item.WartoscNetto,
        WartoscBrutto: item.WartoscBrutto,
        LiczbaTransakcji: item.LiczbaTransakcji,
        LiczbaProduktow: item.LiczbaProduktow
      }));

      setSalesData(mappedData);
    } catch (error) {
      setError(error);
      console.error("Błąd podczas pobierania historii sprzedaży:", error);
    } finally {
      setLoading(false);
    }
  };

  // Pobierz listę sprzedanych produktów z SQL Server
  const fetchSalesItems = async () => {
    if (!startDate || !endDate) return;

    setSalesItemsLoading(true);
    setSalesItemsError(null);
    try {
      const magIds = selectedMagazyny.join(',');
      let url = `${API_URL}/api/sales-items?start_date=${startDate}&end_date=${endDate}&mag_ids=${magIds}&limit=500`;

      if (selectedRodzaj) url += `&rodzaj=${encodeURIComponent(selectedRodzaj)}`;
      if (selectedPrzeznaczenie) url += `&przeznaczenie=${encodeURIComponent(selectedPrzeznaczenie)}`;
      if (selectedMarka) url += `&marka=${encodeURIComponent(selectedMarka)}`;

      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 503) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Serwer SQL jest niedostępny');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      setSalesItems(result.items || []);
      if (result.filters) {
        setAvailableFilters(result.filters);
      }
    } catch (error) {
      console.error("Błąd podczas pobierania listy towarów:", error);
      setSalesItemsError(error.message);
    } finally {
      setSalesItemsLoading(false);
    }
  };

  // Pobierz trend sprzedaży dla wykresu
  const fetchTrendData = async () => {
    if (!startDate || !endDate) return;

    setTrendLoading(true);
    try {
      const magIds = selectedMagazyny.join(',');
      // Roczny - grupuj miesięcznie, pozostałe - dziennie
      const groupBy = period === 'yearly' ? 'month' : 'day';

      let url = `${API_URL}/api/sales-items-trend?start_date=${startDate}&end_date=${endDate}&mag_ids=${magIds}&group_by=${groupBy}`;

      if (selectedRodzaj) url += `&rodzaj=${encodeURIComponent(selectedRodzaj)}`;
      if (selectedPrzeznaczenie) url += `&przeznaczenie=${encodeURIComponent(selectedPrzeznaczenie)}`;
      if (trendSymbol) url += `&symbol=${encodeURIComponent(trendSymbol)}`;
      if (trendModel) url += `&model=${encodeURIComponent(trendModel)}`;

      const response = await fetch(url);
      if (response.ok) {
        const result = await response.json();
        setTrendData(result.data || []);
      }
    } catch (error) {
      console.error("Błąd podczas pobierania trendu:", error);
    } finally {
      setTrendLoading(false);
    }
  };

  // Pobierz filtry przy pierwszym załadowaniu
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const response = await fetch(`${API_URL}/api/sales-items/filters`);
        if (response.ok) {
          const filters = await response.json();
          setAvailableFilters(filters);
        }
      } catch (error) {
        console.error("Błąd podczas pobierania filtrów:", error);
      }
    };
    fetchFilters();
  }, [API_URL]);

  // Pobierz listę produktów gdy zmienią się daty lub filtry
  useEffect(() => {
    if (startDate && endDate) {
      fetchSalesItems();
    }
  }, [startDate, endDate, selectedMagazyny, selectedRodzaj, selectedPrzeznaczenie, selectedMarka]);

  // Pobierz trend gdy zmienią się daty lub filtry trendu
  useEffect(() => {
    if (startDate && endDate) {
      fetchTrendData();
    }
  }, [startDate, endDate, selectedMagazyny, selectedRodzaj, selectedPrzeznaczenie, trendSymbol, trendModel]);

  // Sortowanie listy towarów
  const sortedSalesItems = [...salesItems].sort((a, b) => {
    const aVal = a[sortConfig.key] || 0;
    const bVal = b[sortConfig.key] || 0;
    if (sortConfig.direction === 'asc') {
      return aVal > bVal ? 1 : -1;
    }
    return aVal < bVal ? 1 : -1;
  });

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return null;
    return sortConfig.direction === 'desc' ?
      <ChevronDown className="w-4 h-4 inline ml-1" /> :
      <ChevronUp className="w-4 h-4 inline ml-1" />;
  };

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);

    // Automatyczne ustawienie zakresu dat w zależności od okresu
    const today = new Date();
    let start = new Date(today);

    switch(newPeriod) {
      case 'daily':
        // DZIENNY = DZISIAJ
        break;
      case 'weekly':
        // TYGODNIOWY = aktualny tydzień (od poniedziałku do dziś)
        const dayOfWeek = today.getDay(); // 0 = niedziela, 1 = poniedziałek, ...
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // ile dni od poniedziałku
        start = new Date(today);
        start.setDate(today.getDate() - daysFromMonday);
        break;
      case 'monthly':
        // MIESIĘCZNY = cały bieżący miesiąc (od 1-go dnia miesiąca do dziś)
        start.setDate(1);
        break;
      case 'yearly':
        // ROCZNY = cały bieżący rok (od 1 stycznia do dziś)
        start.setMonth(0);
        start.setDate(1);
        break;
      default:
        break;
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  };

  const toggleMagazyn = (magId) => {
    setSelectedMagazyny(prev => {
      if (prev.includes(magId)) {
        // Nie pozwól na odznaczenie wszystkich magazynów
        if (prev.length === 1) return prev;
        return prev.filter(id => id !== magId);
      } else {
        return [...prev, magId];
      }
    });
  };

  // Funkcja formatowania liczb z separatorami tysięcznymi
  const formatNumber = (num, decimals = 2) => {
    if (isNaN(num)) return '0,00';

    const fixed = Number(num).toFixed(decimals);
    const parts = fixed.split('.');

    // Dodaj separator tysięczny (spacja)
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

    // Zamień kropkę na przecinek dla separatora dziesiętnego
    return parts.join(',');
  };

  const calculateTotalSales = () => {
    // Zmienione na WartoscBrutto zamiast WartoscNetto
    return salesData.reduce((sum, item) => sum + (item.WartoscBrutto || 0), 0);
  };

  const calculateTotalTransactions = () => {
    return salesData.reduce((sum, item) => sum + (item.LiczbaTransakcji || 0), 0);
  };

  const calculateTotalQuantity = () => {
    return salesData.reduce((sum, item) => sum + (item.IloscSprzedana || 0), 0);
  };

  const calculateAverageTransaction = () => {
    const total = calculateTotalSales();
    const transactions = calculateTotalTransactions();
    return transactions > 0 ? (total / transactions) : 0;
  };

  if (loading && salesData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary-600" />
          <div className="text-lg font-medium">Ładowanie danych...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card bg-red-50 border-2 border-red-200">
        <div className="flex items-start space-x-4">
          <div className="text-red-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-red-900">Błąd pobierania danych</h3>
            <p className="text-red-700 mt-1">{error.message}</p>
            <p className="text-sm text-red-600 mt-2">
              Upewnij się, że backend działa na porcie 5555 i masz dostęp do bazy danych SQL Server.
            </p>
            <button
              onClick={fetchSalesHistory}
              className="mt-4 btn-primary"
            >
              Spróbuj ponownie
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Nagłówek */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analiza Sprzedaży</h1>
          <p className="text-gray-500 mt-1">Historia transakcji i trendy sprzedażowe</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={fetchSalesHistory}
            className="btn-secondary flex items-center space-x-2"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Odśwież</span>
          </button>
        </div>
      </div>

      {/* Filtry */}
      <div className="card">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div className="flex space-x-2">
                <button
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${period === 'daily' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  onClick={() => handlePeriodChange('daily')}
                >
                  Dzienny
                </button>
                <button
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${period === 'weekly' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  onClick={() => handlePeriodChange('weekly')}
                >
                  Tygodniowy
                </button>
                <button
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${period === 'monthly' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  onClick={() => handlePeriodChange('monthly')}
                >
                  Miesięczny
                </button>
                <button
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${period === 'yearly' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  onClick={() => handlePeriodChange('yearly')}
                >
                  Roczny
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4 flex-wrap gap-2">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Od:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Do:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <button
              onClick={fetchSalesHistory}
              className="btn-secondary text-sm"
            >
              Zastosuj
            </button>
            <div className="text-sm text-gray-500 ml-auto">
              Znaleziono: {salesData.length} rekordów
            </div>
          </div>

          {/* Filtr magazynów */}
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
            <p className="text-xs text-gray-500 mt-2">
              Wybrane magazyny: {selectedMagazyny.map(id => magazyny[id]).join(', ')}
            </p>
          </div>
        </div>
      </div>

      {/* Kluczowe wskaźniki */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card bg-primary-50 border-2 border-primary-200">
          <div>
            <p className="text-sm text-gray-600 font-medium">Całkowita sprzedaż brutto</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{formatNumber(calculateTotalSales())} zł</p>
            <div className="flex items-center mt-2 text-green-600">
              <TrendingUp className="w-4 h-4 mr-1" />
              <span className="text-sm font-medium">Wybrany okres</span>
            </div>
          </div>
        </div>

        <div className="card bg-green-50 border-2 border-green-200">
          <div>
            <p className="text-sm text-gray-600 font-medium">Liczba transakcji</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{formatNumber(calculateTotalTransactions(), 0)}</p>
            <div className="flex items-center mt-2 text-green-600">
              <TrendingUp className="w-4 h-4 mr-1" />
              <span className="text-sm font-medium">Dokumenty sprzedaży</span>
            </div>
          </div>
        </div>

        <div className="card bg-purple-50 border-2 border-purple-200">
          <div>
            <p className="text-sm text-gray-600 font-medium">Sprzedana ilość</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{formatNumber(calculateTotalQuantity(), 0)} szt.</p>
            <div className="flex items-center mt-2 text-purple-600">
              <TrendingUp className="w-4 h-4 mr-1" />
              <span className="text-sm font-medium">Produkty</span>
            </div>
          </div>
        </div>

        <div className="card bg-orange-50 border-2 border-orange-200">
          <div>
            <p className="text-sm text-gray-600 font-medium">Średnia transakcja</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{formatNumber(calculateAverageTransaction())} zł</p>
            <div className="flex items-center mt-2 text-orange-600">
              <TrendingUp className="w-4 h-4 mr-1" />
              <span className="text-sm font-medium">Wartość średnia</span>
            </div>
          </div>
        </div>
      </div>

      {/* Wykresy główne */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="lg:col-span-2 card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Trend sprzedaży - {period === 'daily' ? 'Dzienny' : period === 'weekly' ? 'Tygodniowy' : period === 'monthly' ? 'Miesięczny' : 'Roczny'}
          </h2>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="DataSprzedazy" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip
                formatter={(value) => typeof value === 'number' ? formatNumber(value) : value}
              />
              <Legend />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="WartoscBrutto"
                stroke="#0ea5e9"
                fill="#0ea5e9"
                fillOpacity={0.3}
                name="Wartość Brutto (zł)"
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="IloscSprzedana"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.3}
                name="Ilość Sprzedana (szt.)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Dodatkowe wykresy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Liczba transakcji</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="DataSprzedazy" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="LiczbaTransakcji" fill="#8b5cf6" name="Liczba Transakcji" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Wartość brutto</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="DataSprzedazy" />
              <YAxis />
              <Tooltip formatter={(value) => `${value.toFixed(2)} zł`} />
              <Legend />
              <Line
                type="monotone"
                dataKey="WartoscBrutto"
                stroke="#ec4899"
                name="Wartość Brutto (zł)"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabela danych */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Szczegółowe dane sprzedaży</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3 px-4 border-b text-left text-sm font-semibold text-gray-600">Data</th>
                <th className="py-3 px-4 border-b text-right text-sm font-semibold text-gray-600">Ilość Sprzedana</th>
                <th className="py-3 px-4 border-b text-right text-sm font-semibold text-gray-600">Wartość Netto</th>
                <th className="py-3 px-4 border-b text-right text-sm font-semibold text-gray-600">Wartość Brutto</th>
                <th className="py-3 px-4 border-b text-right text-sm font-semibold text-gray-600">Transakcje</th>
                <th className="py-3 px-4 border-b text-right text-sm font-semibold text-gray-600">Produkty</th>
              </tr>
            </thead>
            <tbody>
              {salesData.slice(0, 20).map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="py-2 px-4 border-b text-sm text-gray-700">{item.DataSprzedazy}</td>
                  <td className="py-2 px-4 border-b text-sm text-gray-700 text-right">{formatNumber(item.IloscSprzedana, 0)}</td>
                  <td className="py-2 px-4 border-b text-sm text-gray-700 text-right">{formatNumber(item.WartoscNetto)} zł</td>
                  <td className="py-2 px-4 border-b text-sm text-gray-700 text-right">{formatNumber(item.WartoscBrutto)} zł</td>
                  <td className="py-2 px-4 border-b text-sm text-gray-700 text-right">{formatNumber(item.LiczbaTransakcji, 0)}</td>
                  <td className="py-2 px-4 border-b text-sm text-gray-700 text-right">{formatNumber(item.LiczbaProduktow, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {salesData.length > 20 && (
            <div className="p-4 text-center text-sm text-gray-500">
              Wyświetlono 20 z {salesData.length} rekordów
            </div>
          )}
          {salesData.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              <p className="text-lg font-medium">Brak danych dla wybranego okresu</p>
              <p className="text-sm mt-2">Spróbuj wybrać inny zakres dat lub okres</p>
            </div>
          )}
        </div>
      </div>

      {/* Insighty AI */}
      <div className="card bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Kluczowe obserwacje</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-900 mb-1">Średnia dzienna sprzedaż</p>
                <p className="text-sm text-gray-600">
                  {salesData.length > 0
                    ? `${formatNumber(calculateTotalSales() / salesData.length)} zł`
                    : 'Brak danych'}
                </p>
              </div>
              <div className="bg-white/50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-900 mb-1">Najlepsza sprzedaż</p>
                <p className="text-sm text-gray-600">
                  {salesData.length > 0
                    ? `${formatNumber(Math.max(...salesData.map(d => d.WartoscBrutto)))} zł`
                    : 'Brak danych'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lista sprzedanych towarów */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Package className="w-6 h-6 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Lista sprzedanych towarów</h2>
            <span className="text-sm text-gray-500">({salesItems.length} produktów)</span>
          </div>
          <button
            onClick={() => setShowItemsSection(!showItemsSection)}
            className="btn-secondary text-sm flex items-center space-x-1"
          >
            {showItemsSection ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span>{showItemsSection ? 'Zwiń' : 'Rozwiń'}</span>
          </button>
        </div>

        {showItemsSection && (
          <>
            {/* Filtry produktów */}
            <div className="border-t border-b py-4 mb-4 bg-gray-50 -mx-6 px-6">
              <div className="flex items-center space-x-3 mb-3">
                <Filter className="w-5 h-5 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Filtry produktów:</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Filtr Rodzaj */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rodzaj</label>
                  <select
                    value={selectedRodzaj}
                    onChange={(e) => setSelectedRodzaj(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Wszystkie rodzaje</option>
                    {availableFilters.rodzaje.map(rodzaj => (
                      <option key={rodzaj} value={rodzaj}>{rodzaj}</option>
                    ))}
                  </select>
                </div>

                {/* Filtr Przeznaczenie */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Przeznaczenie</label>
                  <select
                    value={selectedPrzeznaczenie}
                    onChange={(e) => setSelectedPrzeznaczenie(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Wszystkie przeznaczenia</option>
                    {availableFilters.przeznaczenia.map(prz => (
                      <option key={prz} value={prz}>{prz}</option>
                    ))}
                  </select>
                </div>

                {/* Filtr Marka */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Marka</label>
                  <select
                    value={selectedMarka}
                    onChange={(e) => setSelectedMarka(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Wszystkie marki</option>
                    {availableFilters.marki.map(marka => (
                      <option key={marka} value={marka}>{marka}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Aktywne filtry */}
              {(selectedRodzaj || selectedPrzeznaczenie || selectedMarka) && (
                <div className="flex items-center space-x-2 mt-3">
                  <span className="text-sm text-gray-500">Aktywne filtry:</span>
                  {selectedRodzaj && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Rodzaj: {selectedRodzaj}
                      <button onClick={() => setSelectedRodzaj('')} className="ml-1 hover:text-blue-600">&times;</button>
                    </span>
                  )}
                  {selectedPrzeznaczenie && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Przeznaczenie: {selectedPrzeznaczenie}
                      <button onClick={() => setSelectedPrzeznaczenie('')} className="ml-1 hover:text-green-600">&times;</button>
                    </span>
                  )}
                  {selectedMarka && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      Marka: {selectedMarka}
                      <button onClick={() => setSelectedMarka('')} className="ml-1 hover:text-purple-600">&times;</button>
                    </span>
                  )}
                  <button
                    onClick={() => { setSelectedRodzaj(''); setSelectedPrzeznaczenie(''); setSelectedMarka(''); }}
                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                  >
                    Wyczyść wszystkie
                  </button>
                </div>
              )}
            </div>

            {/* Wykres trendu sprzedaży produktów */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-md font-semibold text-gray-800">
                  Trend sprzedaży {selectedRodzaj ? `(${selectedRodzaj})` : ''} {selectedPrzeznaczenie ? `- ${selectedPrzeznaczenie}` : ''} {trendSymbol ? `[${trendSymbol}]` : ''} {trendModel ? `[Model: ${trendModel}]` : ''}
                </h3>
                {trendLoading && <RefreshCw className="w-4 h-4 animate-spin text-primary-600" />}
              </div>

              {/* Filtry dla wykresu trendu */}
              <div className="flex items-center space-x-4 mb-4 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-indigo-700">Symbol:</label>
                  <input
                    type="text"
                    value={trendSymbol}
                    onChange={(e) => setTrendSymbol(e.target.value)}
                    placeholder="np. NIKE-123"
                    className="p-2 border border-indigo-300 rounded-lg text-sm w-40 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-indigo-700">Model:</label>
                  <input
                    type="text"
                    value={trendModel}
                    onChange={(e) => setTrendModel(e.target.value)}
                    placeholder="np. Air Max"
                    className="p-2 border border-indigo-300 rounded-lg text-sm w-40 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                {(trendSymbol || trendModel) && (
                  <button
                    onClick={() => { setTrendSymbol(''); setTrendModel(''); }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 underline"
                  >
                    Wyczyść filtry
                  </button>
                )}
              </div>

              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="Data" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip formatter={(value) => typeof value === 'number' ? formatNumber(value) : value} />
                    <Legend />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="WartoscBrutto"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.3}
                      name="Wartość brutto (zł)"
                    />
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="IloscSprzedana"
                      stroke="#6366f1"
                      fill="#6366f1"
                      fillOpacity={0.3}
                      name="Ilość sprzedana (szt.)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">Brak danych do wyświetlenia dla wybranych filtrów</p>
                  {(trendSymbol || trendModel) && (
                    <p className="text-xs mt-1">Spróbuj zmienić kryteria wyszukiwania</p>
                  )}
                </div>
              )}
            </div>

            {/* Tabela sprzedanych towarów */}
            {salesItemsLoading ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="w-6 h-6 animate-spin text-primary-600" />
                <span className="ml-2 text-gray-600">Ładowanie listy sprzedanych towarów...</span>
              </div>
            ) : salesItemsError ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-amber-800">Nie można pobrać danych sprzedaży</p>
                    <p className="text-sm text-amber-700 mt-1">{salesItemsError}</p>
                    <p className="text-xs text-amber-600 mt-2">
                      Upewnij się, że komputer ma dostęp do sieci lokalnej i serwer SQL Server jest uruchomiony.
                    </p>
                    <button
                      onClick={() => { setSalesItemsError(null); fetchSalesItems(); }}
                      className="mt-3 text-sm text-amber-700 hover:text-amber-900 underline flex items-center"
                    >
                      <RefreshCw className="w-4 h-4 mr-1" /> Spróbuj ponownie
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="py-3 px-3 border-b text-left text-sm font-semibold text-gray-600">Symbol</th>
                      <th className="py-3 px-3 border-b text-left text-sm font-semibold text-gray-600">Nazwa</th>
                      <th className="py-3 px-3 border-b text-left text-sm font-semibold text-gray-600">Marka</th>
                      <th className="py-3 px-3 border-b text-left text-sm font-semibold text-gray-600">Rodzaj</th>
                      <th className="py-3 px-3 border-b text-left text-sm font-semibold text-gray-600">Przeznaczenie</th>
                      <th
                        className="py-3 px-3 border-b text-right text-sm font-semibold text-gray-600 cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('IloscSprzedana')}
                      >
                        Ilość <SortIcon columnKey="IloscSprzedana" />
                      </th>
                      <th
                        className="py-3 px-3 border-b text-right text-sm font-semibold text-gray-600 cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('WartoscBrutto')}
                      >
                        Wartość brutto <SortIcon columnKey="WartoscBrutto" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSalesItems.slice(0, 100).map((item, index) => (
                      <tr key={item.Symbol + index} className="hover:bg-gray-50">
                        <td className="py-2 px-3 border-b text-sm text-gray-700 font-mono">{item.Symbol}</td>
                        <td className="py-2 px-3 border-b text-sm text-gray-700 max-w-xs truncate" title={item.Nazwa}>{item.Nazwa}</td>
                        <td className="py-2 px-3 border-b text-sm text-gray-700">{item.Marka}</td>
                        <td className="py-2 px-3 border-b text-sm text-gray-700">{item.Rodzaj}</td>
                        <td className="py-2 px-3 border-b text-sm text-gray-700">{item.Przeznaczenie}</td>
                        <td className="py-2 px-3 border-b text-sm text-gray-700 text-right">{formatNumber(item.IloscSprzedana, 0)}</td>
                        <td className="py-2 px-3 border-b text-sm text-gray-700 text-right font-medium">{formatNumber(item.WartoscBrutto)} zł</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sortedSalesItems.length > 100 && (
                  <div className="p-4 text-center text-sm text-gray-500">
                    Wyświetlono 100 z {sortedSalesItems.length} produktów (sortowanie: {sortConfig.key})
                  </div>
                )}
                {sortedSalesItems.length === 0 && !salesItemsLoading && (
                  <div className="p-8 text-center text-gray-500">
                    <p className="text-lg font-medium">Brak sprzedaży w wybranym okresie</p>
                    <p className="text-sm mt-2">Spróbuj zmienić zakres dat lub filtry</p>
                  </div>
                )}
              </div>
            )}

            {/* Podsumowanie */}
            {sortedSalesItems.length > 0 && (
              <div className="border-t pt-4 mt-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-sm text-gray-600">Łączna ilość sprzedana</p>
                    <p className="text-xl font-bold text-blue-700">
                      {formatNumber(sortedSalesItems.reduce((sum, item) => sum + item.IloscSprzedana, 0), 0)} szt.
                    </p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-sm text-gray-600">Łączna wartość brutto</p>
                    <p className="text-xl font-bold text-green-700">
                      {formatNumber(sortedSalesItems.reduce((sum, item) => sum + item.WartoscBrutto, 0), 2)} zł
                    </p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3">
                    <p className="text-sm text-gray-600">Liczba produktów</p>
                    <p className="text-xl font-bold text-purple-700">{sortedSalesItems.length}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Przycisk pomocy w prawym dolnym rogu */}
      <button
        onClick={() => setShowHelp(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-primary-600 hover:bg-primary-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 z-40"
        title="Pomoc - informacje o widoku"
      >
        <HelpCircle className="w-7 h-7" />
      </button>

      {/* Modal pomocy */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                  <HelpCircle className="w-6 h-6 text-primary-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Analiza Sprzedaży - Pomoc</h2>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Do czego sluzy ten widok?</h3>
                <p className="text-gray-600">
                  Widok Analiza Sprzedazy umozliwia kompleksowa analize historii transakcji i trendow sprzedazowych.
                  Pozwala na monitorowanie wynikow sprzedazy w roznych okresach czasowych oraz filtrowanie danych
                  wedlug magazynow, rodzajow produktow, przeznaczeń i marek.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Glowne funkcjonalnosci:</h3>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                    <Calendar className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Wybor okresu analizy</p>
                      <p className="text-sm text-gray-600">Dzienny, tygodniowy, miesieczny lub roczny zakres danych z mozliwoscia recznego ustawienia dat.</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
                    <Warehouse className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Filtrowanie po magazynach</p>
                      <p className="text-sm text-gray-600">Mozliwosc wyboru jednego lub wielu magazynow (GLS, JEANS, INNE, GLS DEPOZYT).</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 p-3 bg-purple-50 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Wykresy i trendy</p>
                      <p className="text-sm text-gray-600">Interaktywne wykresy pokazujace trend sprzedazy, wartosc brutto, ilosc sprzedana i liczbe transakcji.</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 p-3 bg-orange-50 rounded-lg">
                    <Filter className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Filtry produktow</p>
                      <p className="text-sm text-gray-600">Filtrowanie listy sprzedanych towarow wedlug rodzaju, przeznaczenia i marki.</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 p-3 bg-pink-50 rounded-lg">
                    <Package className="w-5 h-5 text-pink-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Lista sprzedanych towarow</p>
                      <p className="text-sm text-gray-600">Szczegolowa tabela z produktami, ich symbolami, nazwami, markami oraz wartosciami sprzedazy. Mozliwosc sortowania po ilosci i wartosci.</p>
                    </div>
                  </div>

                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Wskazowka</h4>
                <p className="text-sm text-gray-600">
                  Aby zobaczyc trend konkretnego produktu, uzyj filtrow "Symbol" i "Model" w sekcji wykresu trendu sprzedazy produktow.
                </p>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t rounded-b-2xl">
              <button
                onClick={() => setShowHelp(false)}
                className="w-full btn-primary"
              >
                Rozumiem
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SalesAnalysisNew
