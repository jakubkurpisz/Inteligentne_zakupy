import React, { useState, useEffect } from 'react'
import { Calendar, TrendingUp, Download, Filter } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { API_BASE_URL } from '../config/api'

function SalesAnalysis() {
  const API_URL = API_BASE_URL;
  const [salesData, setSalesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [monthlyData, setMonthlyData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [dailyTransactionsData, setDailyTransactionsData] = useState([]);

  const [salesSummary, setSalesSummary] = useState({
    daily: [],
    weekly: [],
    monthly: [],
    yearly: [],
  });

  useEffect(() => {
    const fetchSalesData = async () => {
      try {
        const response = await fetch(`${API_URL}/api/sales-data`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setSalesData(data);
        processSalesData(data);
      } catch (error) {
        setError(error);
        console.error("Błąd podczas pobierania danych sprzedażowych:", error);
      } finally {
        setLoading(false);
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
      } catch (error) {
        console.error("Błąd podczas pobierania podsumowania sprzedaży:", error);
      }
    };

    fetchSalesData();
    fetchSalesSummary();
  }, []);

  const processSalesData = (data) => {
    // Przetwarzanie danych dla wykresu sprzedaży dziennej (zamiast miesięcznej)
    const dailySalesMap = data.reduce((acc, item) => {
      // Pomijamy elementy bez daty sprzedaży
      if (!item.LastUpdated && !item.DataSprzedazy) return acc;

      const date = item.LastUpdated ? item.LastUpdated.split('T')[0] : item.DataSprzedazy;
      const nettoValue = parseFloat(item.DetalicznaNetto || 0);

      if (!acc[date]) {
        acc[date] = { date: date, sprzedaz: 0 };
      }
      acc[date].sprzedaz += nettoValue * parseFloat(item.Stan || 0);
      return acc;
    }, {});
        const processedDailySales = Object.values(dailySalesMap).sort((a, b) => new Date(a.date) - new Date(b.date));
        setMonthlyData(processedDailySales); // Używamy monthlyData do wyświetlania danych dziennych
    
        // Przetwarzanie danych dla wykresu kategorii
        const categorySalesMap = data.reduce((acc, item) => {
          const category = item.Rodzaj || 'Nieznana';
          const nettoValue = parseFloat(item.DetalicznaNetto || 0) * parseFloat(item.Stan || 0);
          if (!acc[category]) {
            acc[category] = 0;
          }
          acc[category] += nettoValue;
          return acc;
        }, {});
    
        const totalSales = Object.values(categorySalesMap).reduce((sum, value) => sum + value, 0);
        const processedCategoryData = Object.entries(categorySalesMap).map(([name, value]) => ({
          name,
          value: parseFloat(((value / totalSales) * 100).toFixed(2)),
          color: getRandomColor(), // Funkcja do generowania losowych kolorów
        }));
        setCategoryData(processedCategoryData);
    
        // Przetwarzanie danych dla rozkładu transakcji w ciągu dnia (teraz dziennego)
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
    const processedDailyTransactions = Object.values(dailyTransactionsMap).sort((a, b) => new Date(a.date) - new Date(b.date));
    setDailyTransactionsData(processedDailyTransactions);
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

  if (loading) {
    return <div className="text-center text-lg font-medium">Ładowanie danych...</div>;
  }

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
          <button className="btn-primary flex items-center space-x-2">
            <Download className="w-4 h-4" />
            <span>Eksportuj raport</span>
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
    </div>
  )
}

export default SalesAnalysis
