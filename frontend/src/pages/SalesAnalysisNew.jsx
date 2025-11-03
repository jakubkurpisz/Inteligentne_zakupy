import React, { useState, useEffect } from 'react'
import { Calendar, TrendingUp, Download, Filter, RefreshCw, Warehouse } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

function SalesAnalysisNew() {
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';
  const [salesData, setSalesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('daily');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedMagazyny, setSelectedMagazyny] = useState(['1', '7', '9']);

  // Mapowanie magazynów
  const magazyny = {
    '1': 'GLS',
    '2': 'GLS DEPOZYT',
    '7': 'JEANS',
    '9': 'INNE'
  };

  useEffect(() => {
    // Ustaw domyślny zakres dat - DZIENNY = DZISIAJ (nie ostatnie 30 dni)
    const today = new Date();
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(today.toISOString().split('T')[0]);
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
      const url = `${API_URL}/api/sales-history?period=${period}&start_date=${startDate}&end_date=${endDate}&mag_ids=${magIds}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      setSalesData(result.data || []);
    } catch (error) {
      setError(error);
      console.error("Błąd podczas pobierania historii sprzedaży:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);

    // Automatyczne ustawienie zakresu dat w zależności od okresu
    const today = new Date();
    const start = new Date(today);

    switch(newPeriod) {
      case 'daily':
        // DZIENNY = DZISIAJ
        start.setDate(today.getDate());
        break;
      case 'weekly':
        // TYGODNIOWY = ostatnie 7 dni
        start.setDate(today.getDate() - 7);
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
        start.setDate(today.getDate());
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
              Upewnij się, że backend działa na porcie 3002 i masz dostęp do bazy danych SQL Server.
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
          <button className="btn-primary flex items-center space-x-2">
            <Download className="w-4 h-4" />
            <span>Eksportuj raport</span>
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
    </div>
  )
}

export default SalesAnalysisNew
