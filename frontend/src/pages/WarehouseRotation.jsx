import React, { useState, useEffect } from 'react'
import { DollarSign, Package, TrendingUp, TrendingDown, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, HelpCircle, X, Clock } from 'lucide-react'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { API_BASE_URL } from '../config/api'

// Cache helpers
const CACHE_KEY = 'warehouseRotation_cache';
const getFromCache = (defaultValue) => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : defaultValue;
  } catch { return defaultValue; }
};
const saveToCache = (value) => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(value)); } catch {}
};

function WarehouseRotation() {
  const API_URL = API_BASE_URL;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rotationData, setRotationData] = useState(() => getFromCache({
    total_warehouse_value: 0,
    total_products: 0,
    categories: [],
    recommendations: [],
    top_products_by_category: {}
  }));
  const [expandedCategories, setExpandedCategories] = useState(['DEAD', 'VERY_SLOW', 'SLOW']);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    fetchRotationData();
  }, []);

  const fetchRotationData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/warehouse-rotation-value`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setRotationData(data);
      saveToCache(data);
      setError(null);
    } catch (err) {
      console.error('Błąd podczas pobierania danych rotacji:', err);
      setError('Nie udało się pobrać danych rotacji magazynu');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category) => {
    const colors = {
      'NEW': '#9333ea',
      'NEW_NO_SALES': '#dc2626',
      'NEW_SLOW': '#ea580c',
      'NEW_SELLING': '#84cc16',
      'VERY_FAST': '#10b981',
      'FAST': '#22c55e',
      'NORMAL': '#3b82f6',
      'SLOW': '#eab308',
      'VERY_SLOW': '#f97316',
      'DEAD': '#ef4444'
    };
    return colors[category] || '#6b7280';
  };

  const getCategoryLabel = (category) => {
    const labels = {
      'NEW': 'NOWY',
      'NEW_NO_SALES': 'NOWY BEZ SPRZEDAŻY',
      'NEW_SLOW': 'NOWY WOLNY',
      'NEW_SELLING': 'NOWY SPRZEDAJĄCY SIĘ',
      'VERY_FAST': 'BARDZO SZYBKI',
      'FAST': 'SZYBKI',
      'NORMAL': 'NORMALNY',
      'SLOW': 'WOLNY',
      'VERY_SLOW': 'BARDZO WOLNY',
      'DEAD': 'MARTWY'
    };
    return labels[category] || category;
  };

  const getCategoryPriority = (category) => {
    const priorities = {
      'DEAD': { label: 'KRYTYCZNY', color: 'red' },
      'NEW_NO_SALES': { label: 'BARDZO WYSOKI', color: 'red' },
      'VERY_SLOW': { label: 'WYSOKI', color: 'orange' },
      'SLOW': { label: 'ŚREDNI', color: 'yellow' },
      'NEW_SLOW': { label: 'ŚREDNI', color: 'yellow' },
      'NORMAL': { label: 'NISKI', color: 'blue' },
      'FAST': { label: 'POZYTYWNY', color: 'green' },
      'VERY_FAST': { label: 'POZYTYWNY', color: 'emerald' },
      'NEW': { label: 'NEUTRALNY', color: 'purple' },
      'NEW_SELLING': { label: 'POZYTYWNY', color: 'lime' }
    };
    return priorities[category] || { label: 'NIEZNANY', color: 'gray' };
  };

  const toggleCategory = (category) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 2
    }).format(value);
  };

  const formatNumber = (value) => {
    return new Intl.NumberFormat('pl-PL').format(value);
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertTriangle className="w-6 h-6 text-red-600 mr-3" />
          <div>
            <h3 className="text-red-800 font-semibold">Błąd</h3>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }


  // Przygotowanie danych dla wykresu kołowego
  const pieData = rotationData.categories.map(cat => ({
    name: getCategoryLabel(cat.category),
    value: cat.total_value,
    percentage: cat.value_percentage,
    color: getCategoryColor(cat.category)
  }));

  // Przygotowanie danych dla wykresu słupkowego
  const barData = rotationData.categories.map(cat => ({
    category: getCategoryLabel(cat.category),
    value: cat.total_value,
    products: cat.product_count,
    color: getCategoryColor(cat.category)
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <DollarSign className="w-8 h-8 mr-3 text-primary-600" />
              Rotacja Magazynu - Analiza Wartości
            </h1>
            <p className="text-gray-600 mt-2">
              Kompleksowa analiza wartości zapasów według kategorii rotacji
            </p>
          </div>
          <button
            onClick={fetchRotationData}
            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Odśwież
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Całkowita Wartość Magazynu</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {formatCurrency(rotationData.total_warehouse_value)}
              </p>
            </div>
            <DollarSign className="w-12 h-12 text-primary-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Liczba Produktów</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {formatNumber(rotationData.total_products)}
              </p>
            </div>
            <Package className="w-12 h-12 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Zamrożony Kapitał (DEAD + VERY_SLOW)</p>
              <p className="text-3xl font-bold text-red-600 mt-2">
                {formatCurrency(
                  rotationData.categories
                    .filter(c => ['DEAD', 'VERY_SLOW'].includes(c.category))
                    .reduce((sum, c) => sum + c.total_value, 0)
                )}
              </p>
            </div>
            <AlertTriangle className="w-12 h-12 text-red-600" />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Rozkład Wartości według Kategorii
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(value)} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Bar Chart */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Wartość Kapitału według Kategorii
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" angle={-45} textAnchor="end" height={100} />
              <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Bar dataKey="value" fill="#3b82f6">
                {barData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Rekomendacje Działań
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rotationData.recommendations.map((rec, index) => {
            const priority = getCategoryPriority(rec.category);
            return (
              <div
                key={index}
                className={`border-l-4 p-4 rounded-lg bg-${priority.color}-50 border-${priority.color}-500`}
              >
                <div className="flex items-start">
                  <div className="flex-1">
                    <div className={`text-xs font-semibold text-${priority.color}-700 uppercase mb-1`}>
                      {priority.label}
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">{getCategoryLabel(rec.category)}</h3>
                    <p className="text-sm text-gray-700 mb-1">{rec.action}</p>
                    <p className="text-xs text-gray-600 italic">{rec.impact}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category Details */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-900">
          Szczegóły Kategorii
        </h2>
        {rotationData.categories.map((category) => {
          const isExpanded = expandedCategories.includes(category.category);
          const priority = getCategoryPriority(category.category);
          const topProducts = rotationData.top_products_by_category[category.category] || [];

          return (
            <div key={category.category} className="bg-white rounded-lg shadow-sm overflow-hidden">
              {/* Category Header */}
              <div
                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleCategory(category.category)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: getCategoryColor(category.category) }}
                    />
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {getCategoryLabel(category.category)}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {formatNumber(category.product_count)} produktów • {formatCurrency(category.total_value)} • {category.value_percentage.toFixed(1)}% wartości magazynu
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold bg-${priority.color}-100 text-${priority.color}-700`}>
                      {priority.label}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                  </div>
                </div>
              </div>

              {/* Category Details - Expanded */}
              {isExpanded && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-600">Wartość</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {formatCurrency(category.total_value)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Ilość</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {formatNumber(category.total_quantity)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Średnio dni bez ruchu</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {category.avg_days_no_movement.toFixed(0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Średnio dni zapasu</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {category.avg_days_of_stock ? category.avg_days_of_stock.toFixed(0) : 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Top Products Table */}
                  {topProducts.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">
                        Top 10 produktów według wartości:
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Symbol</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nazwa</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Marka</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Stan</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Wartość</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Dni bez ruchu</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Data dostawy</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {topProducts.map((product, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-sm text-gray-900">{product.symbol}</td>
                                <td className="px-3 py-2 text-sm text-gray-600 max-w-xs truncate">{product.nazwa}</td>
                                <td className="px-3 py-2 text-sm text-gray-600">{product.marka}</td>
                                <td className="px-3 py-2 text-sm text-right text-gray-900">{product.stan}</td>
                                <td className="px-3 py-2 text-sm text-right font-semibold text-gray-900">
                                  {formatCurrency(product.frozen_value)}
                                </td>
                                <td className="px-3 py-2 text-sm text-right text-gray-600">{product.days_no_movement}</td>
                                <td className="px-3 py-2 text-sm text-gray-600">
                                  {product.date_added ? new Date(product.date_added).toLocaleDateString('pl-PL') : 'N/A'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
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
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <HelpCircle className="w-6 h-6 text-indigo-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Rotacja Magazynu - Pomoc</h2>
              </div>
              <button onClick={() => setShowHelp(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Do czego sluzy ten widok?</h3>
                <p className="text-gray-600">
                  Widok Rotacja Magazynu analizuje szybkosc sprzedazy produktow i identyfikuje zamrozony kapital.
                  Pomaga optymalizowac zapasy i podejmowac decyzje o przecenach.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Kategorie rotacji:</h3>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">VERY_FAST / FAST</p>
                      <p className="text-sm text-gray-600">Produkty o wysokiej rotacji - zapas na mniej niz 90 dni. Idealna sytuacja.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                    <Package className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">NORMAL</p>
                      <p className="text-sm text-gray-600">Produkty ze standardowa rotacja - zapas na 90-180 dni.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-yellow-50 rounded-lg">
                    <Clock className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">SLOW / VERY_SLOW</p>
                      <p className="text-sm text-gray-600">Produkty o niskiej rotacji - zapas na ponad 180 dni. Rozważ promocje.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-red-50 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">DEAD</p>
                      <p className="text-sm text-gray-600">Produkty bez sprzedazy - calkowicie zamrozony kapital. Wymagaja natychmiastowej akcji.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-purple-50 rounded-lg">
                    <DollarSign className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Zamrozony kapital</p>
                      <p className="text-sm text-gray-600">Wartosc produktow o niskiej rotacji - pieniadze "zamrozone" w magazynie.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Wskazowka</h4>
                <p className="text-sm text-gray-600">
                  Kliknij na kategorie aby rozwinac liste produktow. Skup sie na produktach DEAD i VERY_SLOW -
                  to one generuja najwieksze straty. Rozważ przeceny lub likwidacje.
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

export default WarehouseRotation;
