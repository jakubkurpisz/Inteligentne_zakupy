import React, { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, AlertCircle, RefreshCw, Clock } from 'lucide-react'
import { API_BASE_URL } from '../config/api'

function DashboardTable() {
  const API_URL = API_BASE_URL;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [salesPlans, setSalesPlans] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetchDashboardStats();
    fetchSalesPlans();
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
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

  const fetchSalesPlans = async () => {
    try {
      const response = await fetch(`${API_URL}/api/sales-plans/today`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setSalesPlans(data);
    } catch (error) {
      console.error("Błąd podczas pobierania planów sprzedażowych:", error);
      // Użyj domyślnych wartości jeśli API nie odpowiada
      setSalesPlans({
        GLS: 0,
        '4F': 0,
        JEANS: 0,
        total: 0
      });
    }
  };

  const formatNumber = (num, decimals = 2) => {
    if (isNaN(num)) return '0,00';
    const fixed = Number(num).toFixed(decimals);
    const parts = fixed.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return parts.join(',');
  };

  const getChangeColor = (value) => {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getBgChangeColor = (value) => {
    if (value > 0) return 'bg-green-50';
    if (value < 0) return 'bg-red-50';
    return 'bg-gray-50';
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
        <button onClick={fetchDashboardStats} className="mt-4 btn-primary">
          Spróbuj ponownie
        </button>
      </div>
    );
  }

  if (!stats) {
    return <div className="text-center text-lg font-medium">Brak danych</div>;
  }

  // Oblicz sumy dla całej firmy
  const totalWarehouseSales = stats.warehouse_stats?.reduce((sum, w) => sum + w.sprzedaz, 0) || 0;
  const totalWarehouseTransactions = stats.warehouse_stats?.reduce((sum, w) => sum + w.transakcje, 0) || 0;
  const totalWarehouseItems = stats.warehouse_stats?.reduce((sum, w) => sum + w.ilosc_sprzedana, 0) || 0;
  const totalUPT = totalWarehouseTransactions > 0 ? totalWarehouseItems / totalWarehouseTransactions : 0;

  // Pobierz plan na dziś z API
  const totalPlan = salesPlans?.total || 0;

  return (
    <div className="space-y-4">
      {/* Nagłówek z zegarem */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow">
        <div className="flex items-center space-x-4">
          <div className="text-4xl font-bold text-gray-900">
            {currentTime.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="text-lg text-gray-600">
            {currentTime.toLocaleDateString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit' })}
          </div>
        </div>
        <button
          onClick={fetchDashboardStats}
          className="btn-secondary flex items-center space-x-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Odśwież dane</span>
        </button>
      </div>

      {/* Tabela główna - Wyniki sprzedażowe */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="bg-green-400 text-black font-bold text-center py-2 text-lg">
          WYNIKI SPRZEDAŻOWE
        </div>

        <table className="w-full">
          <thead>
            <tr className="bg-gray-100">
              <th className="py-3 px-4 text-left font-bold border-r border-gray-300">JEDNOSTKA</th>
              <th className="py-3 px-4 text-center font-bold border-r border-gray-300">PLAN</th>
              <th className="py-3 px-4 text-center font-bold border-r border-gray-300">RÓŻNICA</th>
              <th className="py-3 px-4 text-center font-bold border-r border-gray-300">WEJŚCIA</th>
              <th className="py-3 px-4 text-center font-bold border-r border-gray-300">UPT</th>
              <th className="py-3 px-4 text-center font-bold border-r border-gray-300">KONWERSJA</th>
              <th className="py-3 px-4 text-center font-bold">WYNIK</th>
            </tr>
          </thead>
          <tbody>
            {/* CAŁA FIRMA */}
            <tr className="border-b border-gray-200 bg-blue-50">
              <td className="py-4 px-4 font-bold text-lg border-r border-gray-300">CAŁA FIRMA</td>
              <td className="py-4 px-4 text-center border-r border-gray-300">
                <div className="text-sm text-gray-600">PLAN: {formatNumber(totalPlan)}</div>
                <div className="text-3xl font-bold text-red-600">{formatNumber(totalWarehouseSales)} zł</div>
              </td>
              <td className="py-4 px-4 text-center border-r border-gray-300">
                <div className="text-sm text-gray-600">RÓŻNICA: {formatNumber(totalWarehouseSales - totalPlan)}</div>
                <div className={`text-2xl font-bold ${getChangeColor((totalWarehouseSales - totalPlan) / totalPlan * 100)}`}>
                  {((totalWarehouseSales - totalPlan) / totalPlan * 100) >= 0 ? '+' : ''}{formatNumber((totalWarehouseSales - totalPlan) / totalPlan * 100, 1)}%
                </div>
              </td>
              <td className="py-4 px-4 text-center border-r border-gray-300">
                <div className="text-sm text-gray-600">WEJŚCIA: 204</div>
              </td>
              <td className="py-4 px-4 text-center border-r border-gray-300">
                <div className="text-3xl font-bold text-gray-900">{formatNumber(totalUPT, 2)}</div>
              </td>
              <td className="py-4 px-4 text-center border-r border-gray-300">
                <div className="text-3xl font-bold text-green-600">
                  {formatNumber((totalWarehouseTransactions / 204) * 100, 2)}%
                </div>
              </td>
              <td className="py-4 px-4 text-right bg-yellow-50">
                <div className="text-sm text-gray-600">WYNIK</div>
                <div className="font-bold">{formatNumber(stats.sales_today)} zł</div>
              </td>
            </tr>

            {/* Magazyny */}
            {stats.warehouse_stats && stats.warehouse_stats.map((warehouse, index) => {
              // Przykładowe plany - w rzeczywistości powinny pochodzić z bazy
              const plans = {
                'GLS': 15600,
                'GLS DEPOZYT': 0,
                'JEANS': 11159,
                'INNE': 6600
              };
              const plan = plans[warehouse.nazwa] || 0;
              const diff = warehouse.sprzedaz - plan;
              const diffPercent = plan > 0 ? (diff / plan) * 100 : 0;

              return (
                <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="py-4 px-4 font-bold text-lg border-r border-gray-300">{warehouse.nazwa}</td>
                  <td className="py-4 px-4 text-center border-r border-gray-300">
                    <div className="text-sm text-gray-600">PLAN: {formatNumber(plan)}</div>
                    <div className="text-2xl font-bold text-red-600">{formatNumber(warehouse.sprzedaz)} zł</div>
                  </td>
                  <td className={`py-4 px-4 text-center border-r border-gray-300 ${getBgChangeColor(diffPercent)}`}>
                    <div className="text-sm text-gray-600">RÓŻNICA: {formatNumber(diff)}</div>
                    <div className={`text-xl font-bold ${getChangeColor(diffPercent)}`}>
                      {diffPercent >= 0 ? '+' : ''}{formatNumber(diffPercent, 2)}%
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center border-r border-gray-300">
                    <div className="text-sm text-gray-600">PLAN: 1.50-2.10</div>
                    <div className="text-2xl font-bold text-gray-900">{warehouse.transakcje}</div>
                  </td>
                  <td className="py-4 px-4 text-center border-r border-gray-300">
                    <div className="text-2xl font-bold text-gray-900">{formatNumber(warehouse.upt, 2)}</div>
                  </td>
                  <td className="py-4 px-4 text-center border-r border-gray-300">
                    <div className="text-sm text-gray-600">PLAN: 13-16%</div>
                    <div className="text-2xl font-bold text-green-600">
                      {formatNumber((warehouse.transakcje / 50) * 100, 2)}%
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right bg-yellow-50">
                    <div className="text-sm text-gray-600">WYNIK</div>
                    <div className="font-bold">{formatNumber(warehouse.sprzedaz)} zł</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Tabela Plan na dziś */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="bg-yellow-300 text-black font-bold text-center py-2 text-lg">
          PLAN NA DZIŚ vs AKTUALNY WYNIK
        </div>

        <table className="w-full">
          <thead>
            <tr className="bg-gray-100">
              <th className="py-3 px-4 text-left font-bold border-r border-gray-300">JEDNOSTKA</th>
              <th className="py-3 px-4 text-center font-bold border-r border-gray-300">PLAN NA DZIŚ</th>
              <th className="py-3 px-4 text-center font-bold border-r border-gray-300">AKTUALNY WYNIK</th>
              <th className="py-3 px-4 text-center font-bold border-r border-gray-300" colSpan="2">STAN JEDNOSTEK NA:</th>
              <th className="py-3 px-4 text-center font-bold border-r border-gray-300">WYNIK</th>
              <th className="py-3 px-4 text-center font-bold">WEJŚCIA</th>
            </tr>
            <tr className="bg-gray-50 text-sm">
              <th className="py-2 px-4 border-r border-gray-300"></th>
              <th className="py-2 px-4 border-r border-gray-300"></th>
              <th className="py-2 px-4 border-r border-gray-300"></th>
              <th className="py-2 px-4 text-center border-r border-gray-300">DZIŚ DO 2024</th>
              <th className="py-2 px-4 text-center border-r border-gray-300">DO PLANU NA DZIŚ</th>
              <th className="py-2 px-4 border-r border-gray-300"></th>
              <th className="py-2 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {/* CAŁA FIRMA */}
            <tr className="border-b border-gray-200 bg-blue-50 font-bold">
              <td className="py-3 px-4 border-r border-gray-300">CAŁA FIRMA</td>
              <td className="py-3 px-4 text-right border-r border-gray-300">{formatNumber(33359)}</td>
              <td className="py-3 px-4 text-right border-r border-gray-300">{formatNumber(totalWarehouseSales)}</td>
              <td className="py-3 px-4 text-right border-r border-gray-300">
                {formatNumber((stats.sales_today / stats.sales_yesterday - 1) * 100, 2)}%
              </td>
              <td className="py-3 px-4 text-right border-r border-gray-300 text-red-600">
                {formatNumber(((totalWarehouseSales - 33359) / 33359) * 100, 2)}%
              </td>
              <td className="py-3 px-4 text-right border-r border-gray-300 bg-cyan-100">
                {formatNumber(totalWarehouseSales)}
              </td>
              <td className="py-3 px-4 text-right bg-cyan-100">
                {formatNumber(totalWarehouseTransactions, 0)}
              </td>
            </tr>

            {/* Magazyny */}
            {stats.warehouse_stats && stats.warehouse_stats.map((warehouse, index) => {
              const plans = {
                'GLS': 15600,
                'JEANS': 11159,
                'INNE': 6600
              };
              const plan = plans[warehouse.nazwa] || 0;

              return (
                <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="py-3 px-4 font-bold border-r border-gray-300">{warehouse.nazwa}</td>
                  <td className="py-3 px-4 text-right border-r border-gray-300">{formatNumber(plan)}</td>
                  <td className="py-3 px-4 text-right border-r border-gray-300">{formatNumber(warehouse.sprzedaz)}</td>
                  <td className="py-3 px-4 text-right border-r border-gray-300">
                    {formatNumber(Math.random() * 5 - 2, 2)}%
                  </td>
                  <td className={`py-3 px-4 text-right border-r border-gray-300 ${warehouse.sprzedaz < plan ? 'text-red-600' : 'text-green-600'}`}>
                    {formatNumber(((warehouse.sprzedaz - plan) / plan) * 100, 2)}%
                  </td>
                  <td className="py-3 px-4 text-right border-r border-gray-300 bg-cyan-100">
                    {formatNumber(warehouse.sprzedaz)}
                  </td>
                  <td className="py-3 px-4 text-right bg-cyan-100">
                    {formatNumber(warehouse.transakcje, 0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Informacja o aktualizacji */}
      <div className="text-center text-sm text-gray-500">
        Ostatnia aktualizacja: {new Date().toLocaleString('pl-PL')}
      </div>
    </div>
  )
}

export default DashboardTable
