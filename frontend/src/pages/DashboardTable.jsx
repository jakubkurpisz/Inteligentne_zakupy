import React, { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, AlertCircle, RefreshCw, Clock } from 'lucide-react'
import { API_BASE_URL } from '../config/api'

// Klucze cache w localStorage
const CACHE_KEYS = {
  stats: 'dashboard_stats_cache',
  salesPlans: 'dashboard_salesPlans_cache',
  storeMetrics: 'dashboard_storeMetrics_cache',
  footfall: 'dashboard_footfall_cache',
  lastUpdate: 'dashboard_lastUpdate_cache'
};

// Funkcja do odczytu cache
const getFromCache = (key, defaultValue) => {
  try {
    const cached = localStorage.getItem(key);
    return cached ? JSON.parse(cached) : defaultValue;
  } catch {
    return defaultValue;
  }
};

// Funkcja do zapisu cache
const saveToCache = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('Błąd zapisu cache:', e);
  }
};

function DashboardTable() {
  const API_URL = API_BASE_URL;
  const [initialLoading, setInitialLoading] = useState(false);
  const [error, setError] = useState(null);

  // Inicjalizacja stanów z cache - od razu pokazuje ostatnie dane
  const [stats, setStats] = useState(() => getFromCache(CACHE_KEYS.stats, { warehouse_stats: [] }));
  const [salesPlans, setSalesPlans] = useState(() => getFromCache(CACHE_KEYS.salesPlans, {}));
  const [storeMetrics, setStoreMetrics] = useState(() => getFromCache(CACHE_KEYS.storeMetrics, {}));
  const [footfall, setFootfall] = useState(() => getFromCache(CACHE_KEYS.footfall, { GLS: 0, JNS: 0 }));
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastUpdate, setLastUpdate] = useState(() => {
    const cached = getFromCache(CACHE_KEYS.lastUpdate, null);
    return cached ? new Date(cached) : null;
  });
  const [nextRefresh, setNextRefresh] = useState(60);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const REFRESH_INTERVAL = 60; // sekundy

  // Funkcja do odświeżania wszystkich danych (w tle, bez przeładowania)
  const refreshAllData = async (isInitial = false) => {
    if (!isInitial) setIsRefreshing(true);

    try {
      await Promise.all([
        fetchDashboardStats(isInitial),
        fetchSalesPlans(),
        fetchStoreMetrics(),
        fetchFootfall()
      ]);
      const now = new Date();
      setLastUpdate(now);
      saveToCache(CACHE_KEYS.lastUpdate, now.toISOString());
      setNextRefresh(REFRESH_INTERVAL);
    } finally {
      if (isInitial) setInitialLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Pierwsze pobranie danych
    refreshAllData(true);

    // Zegar co sekundę
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
      setNextRefresh(prev => prev > 0 ? prev - 1 : REFRESH_INTERVAL);
    }, 1000);

    // Automatyczne odświeżanie danych co 60 sekund
    const dataInterval = setInterval(() => {
      refreshAllData();
    }, REFRESH_INTERVAL * 1000);

    return () => {
      clearInterval(clockInterval);
      clearInterval(dataInterval);
    };
  }, []);

  const fetchDashboardStats = async (isInitial = false) => {
    try {
      const response = await fetch(`${API_URL}/api/dashboard-stats`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setStats(data);
      saveToCache(CACHE_KEYS.stats, data);
      if (isInitial) setError(null);
    } catch (error) {
      if (isInitial) setError(error);
      console.error("Błąd podczas pobierania statystyk dashboardu:", error);
    }
  };

  const fetchSalesPlans = async () => {
    try {
      const response = await fetch(`${API_URL}/api/sales-plans/today`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.success && data.plan) {
        // Mapowanie nazw z API do nazw magazynów
        const plans = {
          'GLS': data.plan.gls || 0,
          '4F': data.plan.four_f || 0,
          'JEANS': data.plan.jeans || 0,
          'total': data.plan.total || 0
        };
        setSalesPlans(plans);
        saveToCache(CACHE_KEYS.salesPlans, plans);
      }
    } catch (error) {
      console.error("Błąd podczas pobierania planów sprzedażowych:", error);
    }
  };

  const fetchStoreMetrics = async () => {
    try {
      const response = await fetch(`${API_URL}/api/store-metrics`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.success) {
        setStoreMetrics(data);
        saveToCache(CACHE_KEYS.storeMetrics, data);
      }
    } catch (error) {
      console.error("Błąd podczas pobierania metryk sklepów:", error);
    }
  };

  const fetchFootfall = async () => {
    try {
      const response = await fetch(`${API_URL}/api/footfall`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.success) {
        setFootfall(data.data);
        saveToCache(CACHE_KEYS.footfall, data.data);
      }
    } catch (error) {
      console.error("Błąd podczas pobierania wejść:", error);
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

  // Pobierz metryki z Google Sheets
  const getMetrics = (key) => storeMetrics?.metrics?.[key] || null;

  // Pomocnicza funkcja do mapowania nazwy magazynu na klucz w metrykach
  const getMetricsKey = (warehouseName) => {
    if (warehouseName === 'GLS') return 'GLS';
    if (warehouseName === '4F') return '4F';
    if (warehouseName === 'JEANS') return 'GLJ';
    return warehouseName;
  };

  // Oblicz sumy dla całej firmy - uwzględniając że 4F bierze dane z Google Sheets
  const calculateTotalSales = () => {
    if (!stats?.warehouse_stats) return 0;
    return stats.warehouse_stats.reduce((sum, w) => {
      const metricsKey = getMetricsKey(w.nazwa);
      const metrics = getMetrics(metricsKey);
      const wynikGS = metrics?.wynik || 0;
      // Dla 4F użyj wyniku z Google Sheets jeśli dostępny
      const wynik = w.nazwa === '4F' && wynikGS > 0 ? wynikGS : w.sprzedaz;
      return sum + wynik;
    }, 0);
  };

  const totalWarehouseSales = calculateTotalSales();

  // Oblicz sumę transakcji (paragonów) - dla 4F weź bezpośrednio z Google Sheets (paragony)
  const calculateTotalTransactions = () => {
    if (!stats?.warehouse_stats) return 0;
    return stats.warehouse_stats.reduce((sum, w) => {
      if (w.nazwa === '4F') {
        // Dla 4F weź paragony bezpośrednio z Google Sheets
        const metrics4F = getMetrics('4F');
        return sum + (metrics4F?.paragony || 0);
      }
      return sum + w.transakcje;
    }, 0);
  };

  const totalWarehouseTransactions = calculateTotalTransactions();

  // Oblicz sumę sprzedanych sztuk - dla 4F oblicz z paragony * upt
  const calculateTotalItems = () => {
    if (!stats?.warehouse_stats) return 0;
    return stats.warehouse_stats.reduce((sum, w) => {
      if (w.nazwa === '4F') {
        // Dla 4F oblicz sztuki jako paragony * upt
        const metrics4F = getMetrics('4F');
        const paragony4F = metrics4F?.paragony || 0;
        const upt4F = metrics4F?.upt || 0;
        return sum + (paragony4F * upt4F);
      }
      return sum + w.ilosc_sprzedana;
    }, 0);
  };

  const totalWarehouseItems = calculateTotalItems();
  const totalUPT = totalWarehouseTransactions > 0 ? totalWarehouseItems / totalWarehouseTransactions : 0;

  // Pobierz plan z API - suma planów dla wszystkich jednostek
  const totalPlan = (salesPlans?.['GLS'] || 0) + (salesPlans?.['4F'] || 0) + (salesPlans?.['JEANS'] || 0);

  // Funkcja do pobierania wejść dla danej jednostki
  // GLS - z API footfall (AGIS), JNS/JEANS - z API footfall (TopReports), 4F - z Google Sheets
  const getWejscia = (warehouseName) => {
    if (warehouseName === 'GLS') {
      return footfall?.GLS || 0;
    }
    if (warehouseName === 'JEANS') {
      return footfall?.JNS || 0;
    }
    const metricsKey = getMetricsKey(warehouseName);
    return getMetrics(metricsKey)?.wejscia || 0;
  };

  // Suma wejść - GLS z AGIS, JNS z TopReports, 4F z Google Sheets
  const totalWejscia = (footfall?.GLS || 0) + (getMetrics('4F')?.wejscia || 0) + (footfall?.JNS || 0);

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
          onClick={() => refreshAllData(false)}
          className="btn-secondary flex items-center space-x-2"
          disabled={isRefreshing}
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'Odświeżam...' : 'Odśwież'}</span>
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
              <th className="py-3 px-4 text-center font-bold border-r border-gray-300">WYNIK</th>
              <th className="py-3 px-4 text-center font-bold border-r border-gray-300">REALIZACJA</th>
              <th className="py-3 px-4 text-center font-bold border-r border-gray-300">WEJŚCIA</th>
              <th className="py-3 px-4 text-center font-bold border-r border-gray-300">UPT</th>
              <th className="py-3 px-4 text-center font-bold">KONWERSJA</th>
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
                <div className={`text-2xl font-bold ${getChangeColor((totalWarehouseSales / totalPlan * 100) - 100)}`}>
                  {formatNumber(totalWarehouseSales / totalPlan * 100, 1)}%
                </div>
              </td>
              <td className="py-4 px-4 text-center border-r border-gray-300">
                <div className="text-2xl font-bold text-gray-900">{totalWejscia || '-'}</div>
              </td>
              <td className="py-4 px-4 text-center border-r border-gray-300">
                <div className="text-3xl font-bold text-gray-900">{formatNumber(totalUPT, 2)}</div>
              </td>
              <td className="py-4 px-4 text-center">
                <div className="text-3xl font-bold text-green-600">
                  {totalWejscia > 0 ? formatNumber((totalWarehouseTransactions / totalWejscia) * 100, 2) : '-'}%
                </div>
              </td>
            </tr>

            {/* Magazyny */}
            {stats.warehouse_stats && stats.warehouse_stats.map((warehouse, index) => {
              // Pobierz plan z API, z fallbackiem do hardcoded wartości
              const plan = salesPlans?.[warehouse.nazwa] || 0;
              const diff = warehouse.sprzedaz - plan;
              const diffPercent = plan > 0 ? (diff / plan) * 100 : 0;

              // Pobierz metryki z Google Sheets dla tego magazynu
              const metricsKey = getMetricsKey(warehouse.nazwa);
              const metrics = getMetrics(metricsKey);
              // Wejścia: dla GLS z AGIS, dla pozostałych z Google Sheets
              const wejscia = getWejscia(warehouse.nazwa);
              const uptGS = metrics?.upt || 0;
              const konwersjaGS = metrics?.konwersja || 0;
              const wynikGS = metrics?.wynik || 0;

              // Dla 4F użyj wyniku z Google Sheets jeśli nie ma danych z bazy
              const wynik = warehouse.nazwa === '4F' && wynikGS > 0 ? wynikGS : warehouse.sprzedaz;

              // Procent realizacji planu
              const realizacjaPercent = plan > 0 ? (wynik / plan) * 100 : 0;

              return (
                <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="py-4 px-4 font-bold text-lg border-r border-gray-300">{warehouse.nazwa}</td>
                  <td className="py-4 px-4 text-center border-r border-gray-300">
                    <div className="text-sm text-gray-600">PLAN: {formatNumber(plan)}</div>
                    <div className="text-2xl font-bold text-red-600">{formatNumber(wynik)} zł</div>
                  </td>
                  <td className={`py-4 px-4 text-center border-r border-gray-300 ${getBgChangeColor(realizacjaPercent - 100)}`}>
                    <div className="text-sm text-gray-600">RÓŻNICA: {formatNumber(wynik - plan)}</div>
                    <div className={`text-xl font-bold ${getChangeColor(realizacjaPercent - 100)}`}>
                      {formatNumber(realizacjaPercent, 2)}%
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center border-r border-gray-300">
                    <div className="text-2xl font-bold text-gray-900">{wejscia || '-'}</div>
                  </td>
                  <td className="py-4 px-4 text-center border-r border-gray-300">
                    <div className="text-2xl font-bold text-gray-900">
                      {/* Dla GLS i JEANS używaj UPT z SQL, dla 4F z Google Sheets */}
                      {warehouse.nazwa === '4F' && uptGS > 0
                        ? formatNumber(uptGS, 2)
                        : formatNumber(warehouse.upt, 2)}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {/* Dla GLS i JEANS oblicz Konwersję z SQL, dla 4F z Google Sheets */}
                      {warehouse.nazwa === '4F' && konwersjaGS > 0
                        ? formatNumber(konwersjaGS, 2)
                        : (wejscia > 0 ? formatNumber((warehouse.transakcje / wejscia) * 100, 2) : '-')}%
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Informacja o aktualizacji */}
      <div className="text-center text-sm text-gray-500">
        Ostatnia aktualizacja: {lastUpdate ? lastUpdate.toLocaleString('pl-PL') : new Date().toLocaleString('pl-PL')}
      </div>
    </div>
  )
}

export default DashboardTable
