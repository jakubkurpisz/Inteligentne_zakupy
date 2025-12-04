import React, { useState, useEffect, useRef } from 'react'
import { Calendar, TrendingUp, Filter, HelpCircle, X, Package } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { API_BASE_URL } from '../config/api'

// Cache helpers
const CACHE_KEY = 'salesAnalysis_cache';
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

function SalesAnalysis() {
  const API_URL = API_BASE_URL;
  const [salesData, setSalesData] = useState(() => getFromCache('salesData', []));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [monthlyData, setMonthlyData] = useState(() => getFromCache('monthlyData', []));
  const [categoryData, setCategoryData] = useState(() => getFromCache('categoryData', []));
  const [groupData, setGroupData] = useState(() => getFromCache('groupData', []));
  const [dailyTransactionsData, setDailyTransactionsData] = useState(() => getFromCache('dailyTransactionsData', []));

  const [salesSummary, setSalesSummary] = useState(() => getFromCache('salesSummary', {
    daily: [],
    weekly: [],
    monthly: [],
    yearly: [],
  }));

  const hasFetchedRef = useRef(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    // Pobierz dane tylko raz przy montowaniu
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const fetchSalesData = async () => {
      try {
        const response = await fetch(`${API_URL}/api/sales-data`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setSalesData(data);
        const processed = processSalesData(data);
        // Update cache with processed data
        saveAllToCache({
          salesData: data,
          monthlyData: processed.monthlyData,
          categoryData: processed.categoryData,
          groupData: processed.groupData,
          dailyTransactionsData: processed.dailyTransactionsData
        });
      } catch (error) {
        setError(error);
        console.error("Błąd podczas pobierania danych sprzedażowych:", error);
      }
    };

    const fetchSalesSummary = async () => {
      try {
        const response = await fetch(`${API_URL}/api/sales-summary`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setSalesSummary(data);
        // Update cache
        const current = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        saveAllToCache({ ...current, salesSummary: data });
      } catch (error) {
        console.error("Błąd podczas pobierania podsumowania sprzedaży:", error);
      }
    };

    fetchSalesData();
    fetchSalesSummary();
  }, []);

  // Stałe kolory dla kategorii (żeby nie zmieniały się przy każdym renderze)
  const categoryColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'];

  const processSalesData = (data) => {
    // Przetwarzanie danych dla wykresu sprzedaży dziennej
    const dailySalesMap = data.reduce((acc, item) => {
      if (!item.LastUpdated && !item.DataSprzedazy) return acc;
      const date = item.LastUpdated ? item.LastUpdated.split('T')[0] : item.DataSprzedazy;
      const nettoValue = parseFloat(item.DetalicznaNetto || 0);
      if (!acc[date]) {
        acc[date] = { date: date, sprzedaz: 0 };
      }
      acc[date].sprzedaz += nettoValue * parseFloat(item.Stan || 0);
      return acc;
    }, {});
    const processedMonthlyData = Object.values(dailySalesMap).sort((a, b) => new Date(a.date) - new Date(b.date));
    setMonthlyData(processedMonthlyData);

    // Przetwarzanie danych dla wykresu kategorii
    const categorySalesMap = data.reduce((acc, item) => {
      const category = item.Rodzaj || 'Nieznana';
      const nettoValue = parseFloat(item.DetalicznaNetto || 0) * parseFloat(item.Stan || 0);
      if (!acc[category]) acc[category] = 0;
      acc[category] += nettoValue;
      return acc;
    }, {});

    const totalSales = Object.values(categorySalesMap).reduce((sum, value) => sum + value, 0);
    const processedCategoryData = Object.entries(categorySalesMap).map(([name, value], idx) => ({
      name,
      value: parseFloat(((value / totalSales) * 100).toFixed(2)),
      color: categoryColors[idx % categoryColors.length],
    }));
    setCategoryData(processedCategoryData);

    // Przetwarzanie danych dla wykresu grup
    const groupSalesMap = data.reduce((acc, item) => {
      const group = item.Grupa || 'Brak grupy';
      const nettoValue = parseFloat(item.DetalicznaNetto || 0) * parseFloat(item.Stan || 0);
      if (!acc[group]) acc[group] = 0;
      acc[group] += nettoValue;
      return acc;
    }, {});

    const totalGroupSales = Object.values(groupSalesMap).reduce((sum, value) => sum + value, 0);
    const processedGroupData = Object.entries(groupSalesMap)
      .map(([name, value], idx) => ({
        name,
        value: parseFloat(((value / totalGroupSales) * 100).toFixed(2)),
        absoluteValue: value,
        color: categoryColors[idx % categoryColors.length],
      }))
      .sort((a, b) => b.absoluteValue - a.absoluteValue)
      .slice(0, 10);
    setGroupData(processedGroupData);

    // Przetwarzanie danych dla rozkładu transakcji
    const dailyTransactionsMap = data.reduce((acc, item) => {
      if (!item.LastUpdated && !item.DataSprzedazy) return acc;
      const date = item.LastUpdated ? item.LastUpdated.split('T')[0] : item.DataSprzedazy;
      const quantity = parseFloat(item.Stan || 0);
      if (!acc[date]) {
        acc[date] = { date: date, transakcje: 0 };
      }
      acc[date].transakcje += quantity;
      return acc;
    }, {});
    const processedDailyTransactionsData = Object.values(dailyTransactionsMap).sort((a, b) => new Date(a.date) - new Date(b.date));
    setDailyTransactionsData(processedDailyTransactionsData);

    // Zwróć przetworzone dane do zapisania w cache
    return {
      monthlyData: processedMonthlyData,
      categoryData: processedCategoryData,
      groupData: processedGroupData,
      dailyTransactionsData: processedDailyTransactionsData
    };
  };

  // Funkcja pomocnicza do generowania losowych kolorów
  const getRandomColor = () => {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  };

  if (error) {
    return <div className="text-center text-lg font-medium text-red-600">Błąd: {error.message}</div>;
  }
  return (
    <div className="space-y-6">
      {/* Nagłówek */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analiza Sprzedaży</h1>
          <p className="text-gray-500 mt-1">Szczegółowe raporty i trendy sprzedażowe</p>
        </div>
        <div className="flex space-x-3">
          <button className="btn-secondary flex items-center space-x-2">
            <Filter className="w-4 h-4" />
            <span>Filtruj</span>
          </button>
        </div>
      </div>

      {/* Wybór okresu */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Calendar className="w-5 h-5 text-gray-400" />
            <div className="flex space-x-2">
              <button className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium">
                Dzienny
              </button>
              <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
                Tygodniowy
              </button>
              <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
                Miesięczny
              </button>
              <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
                Roczny
              </button>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            Okres: <span className="font-medium text-gray-900">Styczeń - Czerwiec 2024</span>
          </div>
        </div>
      </div>

      {/* Wykresy główne */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Sprzedaż dzienna</h2>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="sprzedaz" fill="#0ea5e9" name="Sprzedaż" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Kategorie produktów</h2>
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Wykres grup produktów */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Top 10 Grup produktów (wartość w magazynie)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={groupData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip
              formatter={(value, name, props) => {
                if (name === 'wartość') {
                  return [`${props.payload.absoluteValue.toFixed(2)} zł (${value}%)`, 'Wartość'];
                }
                return [value, name];
              }}
            />
            <Legend />
            <Bar dataKey="value" fill="#10b981" name="wartość">
              {groupData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Analiza dzienna (zamiast godzinowej) */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Rozkład transakcji w ciągu dnia</h2>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={dailyTransactionsData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Area type="monotone" dataKey="transakcje" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.3} name="Ilość Sprzedana" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Kluczowe wskaźniki */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card bg-primary-50 border-2 border-primary-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Całkowita sprzedaż netto</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{monthlyData.reduce((sum, item) => sum + item.sprzedaz, 0).toFixed(2)} zł</p>
              <div className="flex items-center mt-2 text-green-600">
                <TrendingUp className="w-4 h-4 mr-1" />
                <span className="text-sm font-medium">Wartość produktów w magazynie</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card bg-green-50 border-2 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Liczba transakcji</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{dailyTransactionsData.reduce((sum, item) => sum + item.transakcje, 0).toFixed(0)}</p>
              <div className="flex items-center mt-2 text-green-600">
                <TrendingUp className="w-4 h-4 mr-1" />
                <span className="text-sm font-medium">Całkowity stan magazynowy</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card bg-purple-50 border-2 border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Liczba unikalnych produktów</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{salesData.length}</p>
              <div className="flex items-center mt-2 text-green-600">
                <TrendingUp className="w-4 h-4 mr-1" />
                <span className="text-sm font-medium">Dane z bazy</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela podsumowania sprzedaży */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Podsumowanie Sprzedaży</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Podsumowanie dzienne */}
          <div>
            <h3 className="text-md font-medium text-gray-800 mb-2">Dzienne</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Data</th>
                    <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Netto</th>
                    <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Brutto</th>
                    <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Ilość</th>
                  </tr>
                </thead>
                <tbody>
                  {salesSummary.daily.slice(0, 5).map((item, index) => (
                    <tr key={index} className="hover:bg-gray-100">
                      <td className="py-2 px-4 border-b text-sm text-gray-700">{item.date}</td>
                      <td className="py-2 px-4 border-b text-sm text-gray-700">{item.totalNetto.toFixed(2)}</td>
                      <td className="py-2 px-4 border-b text-sm text-gray-700">{item.totalBrutto.toFixed(2)}</td>
                      <td className="py-2 px-4 border-b text-sm text-gray-700">{item.totalQuantity.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Podsumowanie tygodniowe */}
          <div>
            <h3 className="text-md font-medium text-gray-800 mb-2">Tygodniowe</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Tydzień</th>
                    <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Netto</th>
                    <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Brutto</th>
                    <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Ilość</th>
                  </tr>
                </thead>
                <tbody>
                  {salesSummary.weekly.slice(0, 5).map((item, index) => (
                    <tr key={index} className="hover:bg-gray-100">
                      <td className="py-2 px-4 border-b text-sm text-gray-700">{item.week}</td>
                      <td className="py-2 px-4 border-b text-sm text-gray-700">{item.totalNetto.toFixed(2)}</td>
                      <td className="py-2 px-4 border-b text-sm text-gray-700">{item.totalBrutto.toFixed(2)}</td>
                      <td className="py-2 px-4 border-b text-sm text-gray-700">{item.totalQuantity.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Podsumowanie miesięczne */}
          <div>
            <h3 className="text-md font-medium text-gray-800 mb-2">Miesięczne</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Miesiąc</th>
                    <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Netto</th>
                    <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Brutto</th>
                    <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Ilość</th>
                  </tr>
                </thead>
                <tbody>
                  {salesSummary.monthly.slice(0, 5).map((item, index) => (
                    <tr key={index} className="hover:bg-gray-100">
                      <td className="py-2 px-4 border-b text-sm text-gray-700">{item.month}</td>
                      <td className="py-2 px-4 border-b text-sm text-gray-700">{item.totalNetto.toFixed(2)}</td>
                      <td className="py-2 px-4 border-b text-sm text-gray-700">{item.totalBrutto.toFixed(2)}</td>
                      <td className="py-2 px-4 border-b text-sm text-gray-700">{item.totalQuantity.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Podsumowanie roczne */}
          <div>
            <h3 className="text-md font-medium text-gray-800 mb-2">Roczne</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Rok</th>
                    <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Netto</th>
                    <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Brutto</th>
                    <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Ilość</th>
                  </tr>
                </thead>
                <tbody>
                  {salesSummary.yearly.slice(0, 5).map((item, index) => (
                    <tr key={index} className="hover:bg-gray-100">
                      <td className="py-2 px-4 border-b text-sm text-gray-700">{item.year}</td>
                      <td className="py-2 px-4 border-b text-sm text-gray-700">{item.totalNetto.toFixed(2)}</td>
                      <td className="py-2 px-4 border-b text-sm text-gray-700">{item.totalBrutto.toFixed(2)}</td>
                      <td className="py-2 px-4 border-b text-sm text-gray-700">{item.totalQuantity.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Insighty AI */}
      <div className="card bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Kluczowe obserwacje AI</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-900 mb-1">Trend sprzedażowy</p>
                <p className="text-sm text-gray-600">
                  Analiza danych z arkusza wskazuje na bieżące trendy sprzedażowe.
                </p>
              </div>
              <div className="bg-white/50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-900 mb-1">Analiza kategorii</p>
                <p className="text-sm text-gray-600">
                  Największy udział w sprzedaży mają kategorie: {categoryData.length > 0 ? categoryData.slice(0, 2).map(c => c.name).join(', ') : 'Brak danych'}.
                </p>
              </div>
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
                <h2 className="text-xl font-bold text-gray-900">Analiza Sprzedazy - Pomoc</h2>
              </div>
              <button onClick={() => setShowHelp(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Do czego sluzy ten widok?</h3>
                <p className="text-gray-600">
                  Widok Analiza Sprzedazy prezentuje szczegolowe raporty i trendy sprzedazowe na podstawie danych
                  z systemu. Pozwala analizowac wyniki w roznych okresach czasowych.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Glowne funkcjonalnosci:</h3>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                    <Calendar className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Wybor okresu</p>
                      <p className="text-sm text-gray-600">Przeglad danych w ukladzie dziennym, tygodniowym, miesiecznym lub rocznym.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Wykresy sprzedazy</p>
                      <p className="text-sm text-gray-600">Wizualizacja sprzedazy dziennej, kategorii produktow i grup.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-purple-50 rounded-lg">
                    <Package className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Analiza kategorii</p>
                      <p className="text-sm text-gray-600">Udzial procentowy kategorii i grup produktow w sprzedazy.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Wskazowka</h4>
                <p className="text-sm text-gray-600">
                  Korzystaj z tabel podsumowania aby szybko porownac wyniki w roznych okresach.
                  Wykres kategorii pomoze zidentyfikowac najlepiej sprzedajace sie grupy produktow.
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

export default SalesAnalysis
