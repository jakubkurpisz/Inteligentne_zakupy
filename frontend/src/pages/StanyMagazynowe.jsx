import React, { useState, useEffect, useMemo } from 'react'
import { Package, Search, Filter, TrendingUp, AlertCircle, Warehouse, ChevronDown, ChevronUp, HelpCircle, X, DollarSign, RotateCcw } from 'lucide-react'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { API_BASE_URL } from '../config/api'
import { useResizableColumns } from '../hooks/useResizableColumns'

// Cache helpers
const CACHE_KEY = 'stanyMagazynowe_cache';
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

function StanyMagazynowe() {
  const API_URL = API_BASE_URL;
  const [products, setProducts] = useState(() => getFromCache('products', []));
  const [filteredProducts, setFilteredProducts] = useState(() => getFromCache('products', []));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState(() => getFromCache('stats', null));
  const [categoryData, setCategoryData] = useState(() => getFromCache('categoryData', []));
  const [selectedMagazyny, setSelectedMagazyny] = useState(['1', '7', '9']);
  const [sortConfig, setSortConfig] = useState({ key: 'Stan', direction: 'desc' });
  const [seasonalityData, setSeasonalityData] = useState(() => getFromCache('seasonalityData', {}));
  const [seasonalityLoading, setSeasonalityLoading] = useState(true);
  const [warehouseTotals, setWarehouseTotals] = useState(() => getFromCache('warehouseTotals', null));
  const [showHelp, setShowHelp] = useState(false);

  // Resizable columns
  const { getColumnStyle, ResizeHandle, resetWidths } = useResizableColumns({
    symbol: 100, nazwa: 200, marka: 80, stan: 70, cenaZakupu: 90,
    cenaSprzedazy: 100, vat: 50, wartZakupu: 90, wartSprzedazy: 100,
    sezonowosc: 100, kategoria: 100
  }, 'stanyMagazynowe_columns', 50);

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
        // Save to cache
        saveAllToCache({
          products: productsWithStan,
          warehouseTotals: data.totals,
          stats: getFromCache('stats', null),
          seasonalityData: getFromCache('seasonalityData', {}),
          categoryData: getFromCache('categoryData', [])
        });
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
      // Update cache
      const current = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      saveAllToCache({ ...current, stats: data });
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
        // Update cache
        const current = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        saveAllToCache({ ...current, seasonalityData: data.data });
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
          <div className="flex justify-end mb-2">
            <button
              onClick={resetWidths}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
              title="Resetuj szerokość kolumn"
            >
              <RotateCcw size={12} />
              Reset kolumn
            </button>
          </div>
          <table className="min-w-full bg-white table-fixed">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3 px-3 border-b text-left text-sm font-semibold text-gray-600 relative" style={getColumnStyle('symbol')}>
                  Symbol
                  <ResizeHandle columnKey="symbol" />
                </th>
                <th className="py-3 px-3 border-b text-left text-sm font-semibold text-gray-600 relative" style={getColumnStyle('nazwa')}>
                  Nazwa
                  <ResizeHandle columnKey="nazwa" />
                </th>
                <th className="py-3 px-3 border-b text-left text-sm font-semibold text-gray-600 relative" style={getColumnStyle('marka')}>
                  Marka
                  <ResizeHandle columnKey="marka" />
                </th>
                <th
                  className="py-3 px-3 border-b text-right text-sm font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 relative"
                  onClick={() => handleSort('Stan')}
                  style={getColumnStyle('stan')}
                >
                  Stan <SortIcon columnKey="Stan" />
                  <ResizeHandle columnKey="stan" />
                </th>
                <th
                  className="py-3 px-3 border-b text-right text-sm font-semibold text-blue-600 cursor-pointer hover:bg-gray-100 relative"
                  onClick={() => handleSort('CenaZakupuNetto')}
                  style={getColumnStyle('cenaZakupu')}
                >
                  Zakup Netto <SortIcon columnKey="CenaZakupuNetto" />
                  <ResizeHandle columnKey="cenaZakupu" />
                </th>
                <th
                  className="py-3 px-3 border-b text-right text-sm font-semibold text-green-600 cursor-pointer hover:bg-gray-100 relative"
                  onClick={() => handleSort('DetalicznaBrutto')}
                  style={getColumnStyle('cenaSprzedazy')}
                >
                  Sprzedaż Brutto <SortIcon columnKey="DetalicznaBrutto" />
                  <ResizeHandle columnKey="cenaSprzedazy" />
                </th>
                <th
                  className="py-3 px-3 border-b text-center text-sm font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 relative"
                  onClick={() => handleSort('StawkaVAT')}
                  style={getColumnStyle('vat')}
                >
                  VAT <SortIcon columnKey="StawkaVAT" />
                  <ResizeHandle columnKey="vat" />
                </th>
                <th
                  className="py-3 px-3 border-b text-right text-sm font-semibold text-blue-800 cursor-pointer hover:bg-gray-100 relative"
                  onClick={() => handleSort('WartoscZakupu')}
                  style={getColumnStyle('wartZakupu')}
                >
                  Wart. zakupu <SortIcon columnKey="WartoscZakupu" />
                  <ResizeHandle columnKey="wartZakupu" />
                </th>
                <th
                  className="py-3 px-3 border-b text-right text-sm font-semibold text-green-800 cursor-pointer hover:bg-gray-100 relative"
                  onClick={() => handleSort('WartoscSprzedazy')}
                  style={getColumnStyle('wartSprzedazy')}
                >
                  Wart. sprzedaży <SortIcon columnKey="WartoscSprzedazy" />
                  <ResizeHandle columnKey="wartSprzedazy" />
                </th>
                <th className="py-3 px-3 border-b text-center text-sm font-semibold text-purple-700 relative" style={getColumnStyle('sezonowosc')}>
                  <div className="flex items-center justify-center gap-1">
                    <span>Sezonowość</span>
                    <div className="relative group/tooltip">
                      <AlertCircle className="w-4 h-4 text-gray-400 hover:text-purple-600 cursor-help" />
                      <div className="absolute top-full right-0 mt-2 hidden group-hover/tooltip:block w-64 z-[100]">
                        <div className="bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl border border-gray-700">
                          <div className="absolute -top-2 right-4">
                            <div className="border-8 border-transparent border-b-gray-900"></div>
                          </div>
                          <p className="font-semibold mb-2 text-purple-300 text-left">Zmienność popytu (CV)</p>
                          <p className="mb-3 text-gray-300 text-left leading-relaxed">Pokazuje jak bardzo sprzedaż produktu waha się w ciągu roku:</p>
                          <div className="space-y-2 text-left">
                            <div className="flex items-start gap-2">
                              <span className="text-green-400 text-base">●</span>
                              <div>
                                <span className="font-medium text-green-400">Stabilny (&lt;20%)</span>
                                <p className="text-gray-400 mt-0.5">Równomierna sprzedaż</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-yellow-400 text-base">◐</span>
                              <div>
                                <span className="font-medium text-yellow-400">Zmienny (20-50%)</span>
                                <p className="text-gray-400 mt-0.5">Sprzedaż się waha</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-red-400 text-base">◑</span>
                              <div>
                                <span className="font-medium text-red-400">Sezonowy (&gt;50%)</span>
                                <p className="text-gray-400 mt-0.5">Duże wahania sezonowe</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <ResizeHandle columnKey="sezonowosc" />
                </th>
                <th className="py-3 px-3 border-b text-left text-sm font-semibold text-gray-600 relative" style={getColumnStyle('kategoria')}>
                  Kategoria
                  <ResizeHandle columnKey="kategoria" />
                </th>
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
                    <td className="py-2 px-3 border-b text-sm text-gray-700 text-center">
                      {product.StawkaVAT ? `${formatNumber(product.StawkaVAT, 0)}%` : '-'}
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
                <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                  <HelpCircle className="w-6 h-6 text-teal-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Stany Magazynowe - Pomoc</h2>
              </div>
              <button onClick={() => setShowHelp(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Do czego sluzy ten widok?</h3>
                <p className="text-gray-600">
                  Widok Stany Magazynowe prezentuje aktualne stany produktow na wszystkich magazynach.
                  Umozliwia analize wartosci zapasow i ich rozklad wedlug kategorii.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Glowne funkcjonalnosci:</h3>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3 p-3 bg-teal-50 rounded-lg">
                    <Warehouse className="w-5 h-5 text-teal-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Filtrowanie po magazynach</p>
                      <p className="text-sm text-gray-600">Wybor jednego lub wielu magazynow do analizy (GLS, JEANS, INNE, GLS DEPOZYT).</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                    <Search className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Wyszukiwanie produktow</p>
                      <p className="text-sm text-gray-600">Szukaj po nazwie, symbolu lub marce produktu.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
                    <DollarSign className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Wartosci magazynowe</p>
                      <p className="text-sm text-gray-600">Wartosc zakupu (netto) i wartosc sprzedazy (brutto) dla kazdego produktu i laczna.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-purple-50 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Sezonowość produktów</p>
                      <p className="text-sm text-gray-600">Badge sezonowosci (STABILNY, ZMIENNY, SEZONOWY) na podstawie analizy sprzedazy.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-orange-50 rounded-lg">
                    <Package className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Sortowanie i tabela</p>
                      <p className="text-sm text-gray-600">Kliknij naglowek kolumny aby posortowac dane. Wyswietlane jest 100 produktow.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Wskazowka</h4>
                <p className="text-sm text-gray-600">
                  Uzyj wyszukiwarki aby znalezc konkretny produkt. Mozesz sortowac tabele klikajac w naglowki kolumn.
                  Wykresy pokazuja rozklad wartosci i ilosci wedlug kategorii.
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

export default StanyMagazynowe
