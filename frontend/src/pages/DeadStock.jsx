import React, { useState, useEffect } from 'react'
import { AlertTriangle, XCircle, TrendingDown, Calendar, DollarSign, Package, Search, Filter, Download, Warehouse, RefreshCw } from 'lucide-react'
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { API_BASE_URL } from '../config/api'

function DeadStock() {
  const API_URL = API_BASE_URL;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deadStockData, setDeadStockData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [minDays, setMinDays] = useState(0);
  const [minValue, setMinValue] = useState(0);
  const [sortBy, setSortBy] = useState('days_no_movement');
  const [selectedMagazyny, setSelectedMagazyny] = useState(['1', '7', '9']);

  // Mapowanie magazynów
  const magazyny = {
    '1': 'GLS',
    '2': 'GLS DEPOZYT',
    '7': 'JEANS',
    '9': 'INNE'
  };

  useEffect(() => {
    fetchDeadStock();
  }, [minDays, minValue, selectedCategory, sortBy, selectedMagazyny]);

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

      const response = await fetch(`${API_URL}/api/dead-stock?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setDeadStockData(data);
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
      'DEAD': 'red',
      'VERY_SLOW': 'orange',
      'SLOW': 'yellow',
      'NORMAL': 'blue',
      'FAST': 'green'
    };
    return colors[category] || 'gray';
  };

  const getCategorySeverity = (category) => {
    const severity = {
      'DEAD': 'KRYTYCZNY',
      'VERY_SLOW': 'BARDZO WOLNY',
      'SLOW': 'WOLNY',
      'NORMAL': 'NORMALNY',
      'FAST': 'SZYBKI'
    };
    return severity[category] || 'NIEZNANY';
  };

  const filteredItems = deadStockData?.items.filter(item =>
    item.Nazwa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.Symbol?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.Marka?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Przygotuj dane do wykresów
  const categoryChartData = deadStockData ? Object.entries(deadStockData.category_stats).map(([key, value]) => ({
    name: getCategorySeverity(key),
    value: value,
    fill: getCategoryColor(key) === 'red' ? '#ef4444' :
          getCategoryColor(key) === 'orange' ? '#f97316' :
          getCategoryColor(key) === 'yellow' ? '#eab308' :
          getCategoryColor(key) === 'blue' ? '#3b82f6' : '#22c55e'
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
    </div>
  )
}

export default DeadStock
