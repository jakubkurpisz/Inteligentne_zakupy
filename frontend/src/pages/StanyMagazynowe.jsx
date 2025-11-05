import React, { useState, useEffect } from 'react'
import { Package, Search, Filter, Download, TrendingUp, AlertCircle, Warehouse } from 'lucide-react'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { API_BASE_URL } from '../config/api'

function StanyMagazynowe() {
  const API_URL = API_BASE_URL;
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState(null);
  const [categoryData, setCategoryData] = useState([]);
  const [selectedMagazyny, setSelectedMagazyny] = useState(['1', '7', '9']);

  // Mapowanie magazynów
  const magazyny = {
    '1': 'GLS',
    '2': 'GLS DEPOZYT',
    '7': 'JEANS',
    '9': 'INNE'
  };

  useEffect(() => {
    fetchProducts();
    fetchStats();
  }, []);

  useEffect(() => {
    // Filtrowanie produktów na podstawie wyszukiwania
    if (searchTerm) {
      const filtered = products.filter(product =>
        product.Nazwa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.Symbol?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.Marka?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts(products);
    }
  }, [searchTerm, products]);

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

  const fetchProducts = async () => {
    try {
      const response = await fetch(`${API_URL}/api/sales-data`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setProducts(data);
      setFilteredProducts(data);
      processProductData(data);
    } catch (error) {
      setError(error);
      console.error("Błąd podczas pobierania danych produktów:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/stats`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Błąd podczas pobierania statystyk:", error);
    }
  };

  const processProductData = (data) => {
    // Przetwarzanie danych dla wykresu kategorii
    const categorySalesMap = data.reduce((acc, item) => {
      const category = item.Rodzaj || 'Nieznana';
      const value = parseFloat(item.DetalicznaNetto || 0) * parseFloat(item.Stan || 0);
      if (!acc[category]) {
        acc[category] = { value: 0, count: 0 };
      }
      acc[category].value += value;
      acc[category].count += 1;
      return acc;
    }, {});

    const processedCategoryData = Object.entries(categorySalesMap)
      .map(([name, data]) => ({
        name,
        value: data.value,
        count: data.count,
        color: getRandomColor()
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10 kategorii

    setCategoryData(processedCategoryData);
  };

  const getRandomColor = () => {
    const colors = [
      '#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
      '#6366f1', '#f43f5e', '#14b8a6', '#f97316', '#8b5cf6'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
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

  const calculateTotalValue = () => {
    return filteredProducts.reduce((sum, product) => {
      return sum + (parseFloat(product.DetalicznaNetto || 0) * parseFloat(product.Stan || 0));
    }, 0);
  };

  const calculateTotalStock = () => {
    return filteredProducts.reduce((sum, product) => {
      return sum + parseFloat(product.Stan || 0);
    }, 0);
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
          <h1 className="text-3xl font-bold text-gray-900">Stany Magazynowe</h1>
          <p className="text-gray-500 mt-1">Bieżący stan produktów w magazynie</p>
        </div>
        <div className="flex space-x-3">
          <button className="btn-secondary flex items-center space-x-2">
            <Filter className="w-4 h-4" />
            <span>Filtruj</span>
          </button>
          <button className="btn-primary flex items-center space-x-2">
            <Download className="w-4 h-4" />
            <span>Eksportuj</span>
          </button>
        </div>
      </div>

      {/* Statystyki */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="card bg-blue-50 border-2 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Całkowita liczba produktów</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{formatNumber(stats.total_products, 0)}</p>
                <div className="flex items-center mt-2 text-blue-600">
                  <Package className="w-4 h-4 mr-1" />
                  <span className="text-sm font-medium">W bazie danych</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card bg-green-50 border-2 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Wartość magazynu</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{formatNumber(calculateTotalValue())} zł</p>
                <div className="flex items-center mt-2 text-green-600">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  <span className="text-sm font-medium">Netto</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card bg-purple-50 border-2 border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Nowe produkty</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{formatNumber(stats.new_products, 0)}</p>
                <div className="flex items-center mt-2 text-purple-600">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  <span className="text-sm font-medium">Ostatni cykl</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card bg-orange-50 border-2 border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Całkowity stan</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{formatNumber(calculateTotalStock(), 0)} szt.</p>
                <div className="flex items-center mt-2 text-orange-600">
                  <Package className="w-4 h-4 mr-1" />
                  <span className="text-sm font-medium">Wszystkie magazyny</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filtry magazynowe */}
      <div className="card">
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <Warehouse className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Filtry magazynów:</span>
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
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Wybrane magazyny: {selectedMagazyny.map(id => magazyny[id]).join(', ')}
            </p>
            <p className="text-xs text-amber-600 italic">
              Uwaga: Filtrowanie magazynów dostępne po integracji z SQL Server
            </p>
          </div>
        </div>
      </div>

      {/* Wykresy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top 10 Kategorii (wartość)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={categoryData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip formatter={(value) => `${formatNumber(value)} zł`} />
              <Bar dataKey="value" name="Wartość">
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Rozkład kategorii</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, count }) => `${name} (${count})`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${formatNumber(value)} zł`} />
            </PieChart>
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
            Znaleziono: {filteredProducts.length} produktów
          </span>
        </div>
      </div>

      {/* Tabela produktów */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Lista Produktów</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3 px-4 border-b text-left text-sm font-semibold text-gray-600">Symbol</th>
                <th className="py-3 px-4 border-b text-left text-sm font-semibold text-gray-600">Nazwa</th>
                <th className="py-3 px-4 border-b text-left text-sm font-semibold text-gray-600">Marka</th>
                <th className="py-3 px-4 border-b text-left text-sm font-semibold text-gray-600">Stan</th>
                <th className="py-3 px-4 border-b text-left text-sm font-semibold text-gray-600">Cena Netto</th>
                <th className="py-3 px-4 border-b text-left text-sm font-semibold text-gray-600">Cena Brutto</th>
                <th className="py-3 px-4 border-b text-left text-sm font-semibold text-gray-600">Wartość</th>
                <th className="py-3 px-4 border-b text-left text-sm font-semibold text-gray-600">Kategoria</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.slice(0, 50).map((product, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="py-2 px-4 border-b text-sm text-gray-700">{product.Symbol}</td>
                  <td className="py-2 px-4 border-b text-sm text-gray-700">{product.Nazwa}</td>
                  <td className="py-2 px-4 border-b text-sm text-gray-700">{product.Marka}</td>
                  <td className="py-2 px-4 border-b text-sm text-gray-700">{formatNumber(parseFloat(product.Stan || 0), 0)}</td>
                  <td className="py-2 px-4 border-b text-sm text-gray-700">{formatNumber(parseFloat(product.DetalicznaNetto || 0))} zł</td>
                  <td className="py-2 px-4 border-b text-sm text-gray-700">{formatNumber(parseFloat(product.DetalicznaBrutto || 0))} zł</td>
                  <td className="py-2 px-4 border-b text-sm text-gray-700 font-semibold">
                    {formatNumber(parseFloat(product.DetalicznaNetto || 0) * parseFloat(product.Stan || 0))} zł
                  </td>
                  <td className="py-2 px-4 border-b text-sm text-gray-700">{product.Rodzaj || 'Nieznana'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredProducts.length > 50 && (
            <div className="p-4 text-center text-sm text-gray-500">
              Wyświetlono 50 z {filteredProducts.length} produktów. Użyj wyszukiwarki aby zawęzić wyniki.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StanyMagazynowe
