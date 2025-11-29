import React, { useState, useEffect, useMemo } from 'react'
import { Package, Search, Filter, Download, TrendingUp, AlertCircle, Warehouse, ChevronDown, ChevronUp } from 'lucide-react'
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
  const [sortConfig, setSortConfig] = useState({ key: 'Stan', direction: 'desc' });
  const [seasonalityData, setSeasonalityData] = useState({});
  const [seasonalityLoading, setSeasonalityLoading] = useState(true);
  const [warehouseTotals, setWarehouseTotals] = useState(null);

  // Mapowanie magazynów
  const magazyny = {
    '1': 'GLS',
    '2': 'GLS DEPOZYT',
    '7': 'JEANS',
    '9': 'INNE'
  };

  useEffect(() => {
    fetchWarehouseStocks();
    fetchStats();
    fetchSeasonality();
  }, []);

  useEffect(() => {
    // Filtrowanie produktów na podstawie wyszukiwania i wybranych magazynów
    let filtered = products;

    // Najpierw filtruj po magazynach - produkt musi mieć stan > 0 w co najmniej jednym wybranym magazynie
    filtered = filtered.filter(product => {
      const hasStockInSelected = selectedMagazyny.some(magId => {
        const stanKey = `StanMag${magId}`;
        return (product[stanKey] || 0) > 0;
      });
      return hasStockInSelected;
    });

    // Następnie filtruj po wyszukiwaniu
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.Nazwa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.Symbol?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.Marka?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Oblicz stan tylko dla wybranych magazynów
    filtered = filtered.map(product => {
      const stanFiltered = selectedMagazyny.reduce((sum, magId) => {
        return sum + (product[`StanMag${magId}`] || 0);
      }, 0);
      return { ...product, Stan: stanFiltered };
    });

    setFilteredProducts(filtered);
  }, [searchTerm, products, selectedMagazyny]);

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

  const fetchWarehouseStocks = async () => {
    try {
      const response = await fetch(`${API_URL}/api/warehouse-stocks?mag_ids=1,2,7,9`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.success) {
        // Dodaj pole Stan (total) dla kompatybilności
        const productsWithStan = data.products.map(p => ({
          ...p,
          Stan: p.StanTotal
        }));
        setProducts(productsWithStan);
        setFilteredProducts(productsWithStan);
        setWarehouseTotals(data.totals);
        processProductData(productsWithStan);
      }
    } catch (error) {
      setError(error);
      console.error("Błąd podczas pobierania stanów magazynowych:", error);
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

  const fetchSeasonality = async () => {
    try {
      setSeasonalityLoading(true);
      const response = await fetch(`${API_URL}/api/product-seasonality`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.success) {
        setSeasonalityData(data.data);
      }
    } catch (error) {
      console.error("Błąd podczas pobierania danych sezonowości:", error);
    } finally {
      setSeasonalityLoading(false);
    }
  };

  // Funkcja do wyświetlania kategorii sezonowości
  const getSeasonalityBadge = (symbol) => {
    const data = seasonalityData[symbol];
    if (!data) {
      return <span className="text-xs text-gray-400">-</span>;
    }

    const badges = {
      'STABILNY': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300', label: 'Stabilny', icon: '●' },
      'ZMIENNY': { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300', label: 'Zmienny', icon: '◐' },
      'SEZONOWY': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300', label: 'Sezonowy', icon: '◑' },
      'BRAK_DANYCH': { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300', label: 'Brak', icon: '○' },
      'BRAK_SPRZEDAZY': { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-300', label: 'Brak sprz.', icon: '○' }
    };

    const badge = badges[data.category] || badges['BRAK_DANYCH'];
    const cvText = data.cv !== null ? `CV: ${(data.cv * 100).toFixed(0)}%` : '';

    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${badge.bg} ${badge.text} ${badge.border}`}
        title={`${badge.label}\n${cvText}\nŚr. mies.: ${data.avg} szt.\nOdch. std.: ${data.std}`}
      >
        <span className="mr-1">{badge.icon}</span>
        {badge.label}
      </span>
    );
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
    // Wartość magazynu liczona po cenach zakupu netto
    return filteredProducts.reduce((sum, product) => {
      const cenaZakupu = parseFloat(product.CenaZakupuNetto || 0);
      const stan = parseFloat(product.Stan || 0);
      return sum + (cenaZakupu * stan);
    }, 0);
  };

  const calculateTotalStock = () => {
    return filteredProducts.reduce((sum, product) => {
      return sum + parseFloat(product.Stan || 0);
    }, 0);
  };

  // Oblicz wartość magazynu w cenach sprzedaży brutto
  const calculateTotalValueSales = () => {
    return filteredProducts.reduce((sum, product) => {
      const cenaSprzedazy = parseFloat(product.DetalicznaBrutto || 0);
      const stan = parseFloat(product.Stan || 0);
      return sum + (cenaSprzedazy * stan);
    }, 0);
  };

  // Funkcja sortowania
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  // Ikona sortowania
  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return null;
    return sortConfig.direction === 'desc' ?
      <ChevronDown className="w-4 h-4 inline ml-1" /> :
      <ChevronUp className="w-4 h-4 inline ml-1" />;
  };

  // Sortowane produkty
  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      let aVal, bVal;

      // Dla wartości zakupu i sprzedaży obliczamy dynamicznie
      if (sortConfig.key === 'WartoscZakupu') {
        aVal = parseFloat(a.CenaZakupuNetto || 0) * parseFloat(a.Stan || 0);
        bVal = parseFloat(b.CenaZakupuNetto || 0) * parseFloat(b.Stan || 0);
      } else if (sortConfig.key === 'WartoscSprzedazy') {
        aVal = parseFloat(a.DetalicznaBrutto || 0) * parseFloat(a.Stan || 0);
        bVal = parseFloat(b.DetalicznaBrutto || 0) * parseFloat(b.Stan || 0);
      } else {
        aVal = a[sortConfig.key] || 0;
        bVal = b[sortConfig.key] || 0;
      }

      // Konwertuj na liczby jeśli to możliwe
      if (typeof aVal === 'string') aVal = parseFloat(aVal) || aVal;
      if (typeof bVal === 'string') bVal = parseFloat(bVal) || bVal;

      if (sortConfig.direction === 'asc') {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });
  }, [filteredProducts, sortConfig]);

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card bg-blue-50 border-2 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Liczba produktów</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{formatNumber(filteredProducts.length, 0)}</p>
              <div className="flex items-center mt-2 text-blue-600">
                <Package className="w-4 h-4 mr-1" />
                <span className="text-sm font-medium">W wybranych magazynach</span>
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
                <span className="text-sm font-medium">Cena zakupu netto</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card bg-purple-50 border-2 border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Wartość sprzedaży</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{formatNumber(calculateTotalValueSales())} zł</p>
              <div className="flex items-center mt-2 text-purple-600">
                <TrendingUp className="w-4 h-4 mr-1" />
                <span className="text-sm font-medium">Cena detaliczna brutto</span>
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
                <span className="text-sm font-medium">Wybrane magazyny</span>
              </div>
            </div>
          </div>
        </div>
      </div>

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
            <p className="text-xs text-green-600">
              Kafelki i tabela pokazują dane tylko dla wybranych magazynów
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Lista Produktów</h2>
          <span className="text-sm text-gray-500">
            Sortowanie: {sortConfig.key === 'WartoscZakupu' ? 'Wartość zakupu' :
                        sortConfig.key === 'WartoscSprzedazy' ? 'Wartość sprzedaży' :
                        sortConfig.key} ({sortConfig.direction === 'desc' ? 'malejąco' : 'rosnąco'})
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3 px-3 border-b text-left text-sm font-semibold text-gray-600">Symbol</th>
                <th className="py-3 px-3 border-b text-left text-sm font-semibold text-gray-600">Nazwa</th>
                <th className="py-3 px-3 border-b text-left text-sm font-semibold text-gray-600">Marka</th>
                <th
                  className="py-3 px-3 border-b text-right text-sm font-semibold text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('Stan')}
                >
                  Stan <SortIcon columnKey="Stan" />
                </th>
                <th
                  className="py-3 px-3 border-b text-right text-sm font-semibold text-blue-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('CenaZakupuNetto')}
                >
                  Zakup Netto <SortIcon columnKey="CenaZakupuNetto" />
                </th>
                <th
                  className="py-3 px-3 border-b text-right text-sm font-semibold text-green-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('DetalicznaBrutto')}
                >
                  Sprzedaż Brutto <SortIcon columnKey="DetalicznaBrutto" />
                </th>
                <th
                  className="py-3 px-3 border-b text-right text-sm font-semibold text-blue-800 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('WartoscZakupu')}
                >
                  Wart. zakupu <SortIcon columnKey="WartoscZakupu" />
                </th>
                <th
                  className="py-3 px-3 border-b text-right text-sm font-semibold text-green-800 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('WartoscSprzedazy')}
                >
                  Wart. sprzedaży <SortIcon columnKey="WartoscSprzedazy" />
                </th>
                <th className="py-3 px-3 border-b text-center text-sm font-semibold text-purple-700" title="Sezonowość produktu na podstawie CV (Współczynnik zmienności) z ostatnich 12 miesięcy. STABILNY: CV<20%, ZMIENNY: 20-50%, SEZONOWY: >50%">
                  Sezonowość
                </th>
                <th className="py-3 px-3 border-b text-left text-sm font-semibold text-gray-600">Kategoria</th>
              </tr>
            </thead>
            <tbody>
              {sortedProducts.slice(0, 100).map((product, index) => {
                const cenaZakupuNetto = parseFloat(product.CenaZakupuNetto || 0);
                const cenaSprzedazyBrutto = parseFloat(product.DetalicznaBrutto || 0);
                const stan = parseFloat(product.Stan || 0);
                const wartoscZakupu = cenaZakupuNetto * stan;
                const wartoscSprzedazy = cenaSprzedazyBrutto * stan;

                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="py-2 px-3 border-b text-sm text-gray-700 font-mono">{product.Symbol}</td>
                    <td className="py-2 px-3 border-b text-sm text-gray-700 max-w-xs truncate" title={product.Nazwa}>{product.Nazwa}</td>
                    <td className="py-2 px-3 border-b text-sm text-gray-700">{product.Marka}</td>
                    <td className="py-2 px-3 border-b text-sm text-gray-700 text-right">{formatNumber(stan, 0)}</td>
                    <td className="py-2 px-3 border-b text-sm text-blue-700 text-right font-medium">
                      {cenaZakupuNetto > 0 ? `${formatNumber(cenaZakupuNetto)} zł` : '-'}
                    </td>
                    <td className="py-2 px-3 border-b text-sm text-green-700 text-right font-medium">
                      {formatNumber(cenaSprzedazyBrutto)} zł
                    </td>
                    <td className="py-2 px-3 border-b text-sm text-blue-800 text-right font-semibold">
                      {cenaZakupuNetto > 0 ? `${formatNumber(wartoscZakupu)} zł` : '-'}
                    </td>
                    <td className="py-2 px-3 border-b text-sm text-green-800 text-right font-semibold">
                      {formatNumber(wartoscSprzedazy)} zł
                    </td>
                    <td className="py-2 px-3 border-b text-sm text-center">
                      {getSeasonalityBadge(product.Symbol)}
                    </td>
                    <td className="py-2 px-3 border-b text-sm text-gray-700">{product.Rodzaj || 'Nieznana'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sortedProducts.length > 100 && (
            <div className="p-4 text-center text-sm text-gray-500">
              Wyświetlono 100 z {sortedProducts.length} produktów. Użyj wyszukiwarki aby zawęzić wyniki.
            </div>
          )}
        </div>

        {/* Podsumowanie wartości */}
        <div className="border-t pt-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">Liczba produktów</p>
              <p className="text-xl font-bold text-gray-700">{formatNumber(filteredProducts.length, 0)}</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">Suma stanów</p>
              <p className="text-xl font-bold text-orange-700">{formatNumber(calculateTotalStock(), 0)} szt.</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">Wartość zakupu (netto)</p>
              <p className="text-xl font-bold text-blue-700">{formatNumber(calculateTotalValue())} zł</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">Wartość sprzedaży (brutto)</p>
              <p className="text-xl font-bold text-green-700">{formatNumber(calculateTotalValueSales())} zł</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StanyMagazynowe
