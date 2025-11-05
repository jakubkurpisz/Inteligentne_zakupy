import React, { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, AlertCircle, Package, DollarSign, ShoppingBag, RefreshCw, Calendar, Target } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { API_BASE_URL } from '../config/api'

function DashboardCharts() {
  const API_URL = API_BASE_URL;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [todayPlan, setTodayPlan] = useState(null);

  useEffect(() => {
    fetchDashboardStats();
    fetchTodayPlan();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/dashboard-stats`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setStats(data);
    } catch (error) {
      setError(error);
      console.error("Błąd podczas pobierania statystyk dashboardu:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayPlan = async () => {
    try {
      const response = await fetch(`${API_URL}/api/sales-plans/today`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.success) {
        setTodayPlan(data.plan);
      }
    } catch (error) {
      console.error("Błąd podczas pobierania planu na dziś:", error);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Ładowanie danych dashboardu...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
        <p className="text-lg font-medium text-red-600">Błąd: {error.message}</p>
        <button
          onClick={fetchDashboardStats}
          className="mt-4 btn-primary"
        >
          Spróbuj ponownie
        </button>
      </div>
    );
  }

  if (!stats) {
    return <div className="text-center text-lg font-medium">Brak danych</div>;
  }

  return (
    <div className="space-y-6">
      {/* Nagłówek */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard - Wykresy</h1>
          <p className="text-gray-500 mt-1">Przegląd kluczowych wskaźników i analiz</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className="text-sm text-gray-500">Ostatnia aktualizacja</p>
            <p className="text-sm font-medium text-gray-900">{new Date().toLocaleString('pl-PL')}</p>
          </div>
          <button
            onClick={fetchDashboardStats}
            className="btn-secondary flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Odśwież</span>
          </button>
        </div>
      </div>

      {/* Statystyki */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="stat-card border-primary-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Sprzedaż dziś</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(stats.sales_today)} zł</p>
              <div className={`flex items-center mt-2 ${stats.sales_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stats.sales_change >= 0 ? (
                  <TrendingUp className="w-4 h-4 mr-1" />
                ) : (
                  <TrendingDown className="w-4 h-4 mr-1" />
                )}
                <span className="text-sm font-medium">{stats.sales_change >= 0 ? '+' : ''}{formatNumber(stats.sales_change, 1)}%</span>
                <span className="text-xs text-gray-500 ml-1">vs wczoraj</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </div>

        <div className="stat-card border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Transakcje dziś</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.transactions_today}</p>
              <div className={`flex items-center mt-2 ${stats.transactions_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stats.transactions_change >= 0 ? (
                  <TrendingUp className="w-4 h-4 mr-1" />
                ) : (
                  <TrendingDown className="w-4 h-4 mr-1" />
                )}
                <span className="text-sm font-medium">{stats.transactions_change >= 0 ? '+' : ''}{formatNumber(stats.transactions_change, 1)}%</span>
                <span className="text-xs text-gray-500 ml-1">vs wczoraj</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="stat-card border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Poziom zapasów</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(stats.inventory_count, 0)}</p>
              <div className="flex items-center mt-2 text-orange-600">
                <Package className="w-4 h-4 mr-1" />
                <span className="text-sm font-medium">{formatNumber(stats.inventory_value)} zł</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="stat-card border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Wartość magazynu</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(stats.inventory_value)} zł</p>
              <div className="flex items-center mt-2 text-blue-600">
                <DollarSign className="w-4 h-4 mr-1" />
                <span className="text-sm font-medium">{formatNumber(stats.inventory_count, 0)} produktów</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Wykresy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Sprzedaż tygodniowa</h2>
          {stats.weekly_sales && stats.weekly_sales.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.weekly_sales}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => `${formatNumber(value)} zł`} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="sprzedaz"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  name="Sprzedaż"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              Brak danych sprzedaży z ostatnich 7 dni
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top 5 produktów (ostatnie 30 dni)</h2>
          {stats.top_products && stats.top_products.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.top_products}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nazwa" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip formatter={(value) => `${formatNumber(value)} zł`} />
                <Legend />
                <Bar dataKey="sprzedaz" fill="#0ea5e9" name="Sprzedaż (zł)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              Brak danych o najlepszych produktach
            </div>
          )}
        </div>
      </div>

      {/* Szczegółowa tabela top produktów */}
      {stats.top_products && stats.top_products.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Szczegółowe dane - Top produkty</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-700 border-b">Lp.</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-700 border-b">Symbol</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-700 border-b">Nazwa</th>
                  <th className="py-3 px-4 text-right text-sm font-medium text-gray-700 border-b">Ilość sprzedana</th>
                  <th className="py-3 px-4 text-right text-sm font-medium text-gray-700 border-b">Wartość sprzedaży</th>
                </tr>
              </thead>
              <tbody>
                {stats.top_products.map((product, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="py-2 px-4 border-b text-sm text-gray-700">{index + 1}</td>
                    <td className="py-2 px-4 border-b text-sm text-gray-700">{product.symbol}</td>
                    <td className="py-2 px-4 border-b text-sm text-gray-700">{product.nazwa}</td>
                    <td className="py-2 px-4 border-b text-sm text-gray-700 text-right">{formatNumber(product.ilosc, 0)} szt.</td>
                    <td className="py-2 px-4 border-b text-sm font-medium text-gray-900 text-right">{formatNumber(product.sprzedaz)} zł</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Plan sprzedażowy na dziś */}
      {todayPlan && todayPlan.total > 0 && (
        <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">Plan sprzedażowy na dziś</h3>
                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="w-4 h-4 mr-1" />
                  <span>{todayPlan.date}</span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white/80 rounded-lg p-4 border border-green-200">
                  <p className="text-xs text-gray-600 mb-1">Plan GLS</p>
                  <p className="text-xl font-bold text-gray-900">{formatNumber(todayPlan.gls)} zł</p>
                  {stats && stats.sales_today && (
                    <div className="mt-2 text-xs">
                      <span className={`font-medium ${(stats.sales_today / todayPlan.total * 100) >= 100 ? 'text-green-600' : 'text-orange-600'}`}>
                        {formatNumber((stats.sales_today / todayPlan.gls * 100), 0)}% realizacji
                      </span>
                    </div>
                  )}
                </div>
                <div className="bg-white/80 rounded-lg p-4 border border-green-200">
                  <p className="text-xs text-gray-600 mb-1">Plan 4F</p>
                  <p className="text-xl font-bold text-gray-900">{formatNumber(todayPlan.four_f)} zł</p>
                </div>
                <div className="bg-white/80 rounded-lg p-4 border border-green-200">
                  <p className="text-xs text-gray-600 mb-1">Plan JEANS</p>
                  <p className="text-xl font-bold text-gray-900">{formatNumber(todayPlan.jeans)} zł</p>
                </div>
                <div className="bg-white/80 rounded-lg p-4 border-2 border-green-300">
                  <p className="text-xs text-gray-600 mb-1">Plan RAZEM</p>
                  <p className="text-2xl font-bold text-green-700">{formatNumber(todayPlan.total)} zł</p>
                  {stats && stats.sales_today && (
                    <div className="mt-2 text-xs">
                      <span className={`font-medium ${(stats.sales_today / todayPlan.total * 100) >= 100 ? 'text-green-600' : 'text-orange-600'}`}>
                        {formatNumber((stats.sales_today / todayPlan.total * 100), 0)}% realizacji
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Podsumowanie statystyk */}
      <div className="card bg-gradient-to-br from-primary-50 to-blue-50 border-2 border-primary-200">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Podsumowanie dnia</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/70 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Sprzedaż dzisiaj</p>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.sales_today)} zł</p>
                <p className="text-sm text-gray-600 mt-1">
                  {stats.transactions_today} transakcji
                </p>
              </div>
              <div className="bg-white/70 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Sprzedaż wczoraj</p>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.sales_yesterday)} zł</p>
                <p className="text-sm text-gray-600 mt-1">
                  {stats.transactions_yesterday} transakcji
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardCharts
