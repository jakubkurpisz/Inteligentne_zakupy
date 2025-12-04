import React, { useState, useEffect } from 'react'
import { Package, TrendingDown, ShoppingCart, AlertCircle, RefreshCw, DollarSign, Filter, Edit2, X, Check, HelpCircle } from 'lucide-react'
import { API_BASE_URL } from '../config/api'

// Cache helpers
const CACHE_KEY = 'purchaseProposals_cache';
const getFromCache = (defaultValue) => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : defaultValue;
  } catch { return defaultValue; }
};
const saveToCache = (value) => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(value)); } catch {}
};

function PurchaseProposals() {
  const API_URL = API_BASE_URL
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState(() => getFromCache({
    summary: {
      total_products: 0,
      products_below_minimum: 0,
      products_ok: 0,
      total_purchase_value: 0
    },
    items: []
  }))
  const [minStockDays, setMinStockDays] = useState(30)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingSymbol, setEditingSymbol] = useState(null)
  const [deliveryTime, setDeliveryTime] = useState(7)
  const [orderFrequency, setOrderFrequency] = useState(14)
  const [optimalQuantity, setOptimalQuantity] = useState(0)
  const [customNotes, setCustomNotes] = useState('')
  const [sortField, setSortField] = useState('SrednieDzienneZuzycie')
  const [sortDirection, setSortDirection] = useState('desc')
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    fetchProposals()
  }, [minStockDays])

  const fetchProposals = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_URL}/api/purchase-proposals?min_stock_days=${minStockDays}`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const result = await response.json()
      setData(result)
      saveToCache(result)
    } catch (error) {
      setError(error)
      console.error("Błąd podczas pobierania propozycji zakupowych:", error)
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (num, decimals = 2) => {
    if (isNaN(num)) return '0,00'
    const fixed = Number(num).toFixed(decimals)
    const parts = fixed.split('.')
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
    return parts.join(',')
  }

  const startEditing = (item) => {
    setEditingSymbol(item.Symbol)
    setDeliveryTime(item.CzasDostawy || 7)
    setOrderFrequency(item.CzestotliwoscZamawiania || 14)
    setOptimalQuantity(item.OptymalnaWielkoscPartii || 0)
    setCustomNotes(item.CustomNotes || '')
  }

  const cancelEditing = () => {
    setEditingSymbol(null)
    setDeliveryTime(7)
    setOrderFrequency(14)
    setOptimalQuantity(0)
    setCustomNotes('')
  }

  const saveCustomPeriod = async (symbol) => {
    try {
      const params = new URLSearchParams({
        symbol: symbol,
        delivery_time_days: deliveryTime,
        order_frequency_days: orderFrequency,
        optimal_order_quantity: optimalQuantity,
        notes: customNotes || ''
      })

      const response = await fetch(`${API_URL}/api/purchase-proposals/custom-period?${params}`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Błąd podczas zapisywania parametrów')
      }

      // Odśwież dane
      await fetchProposals()
      cancelEditing()
    } catch (error) {
      console.error('Błąd podczas zapisywania:', error)
      alert('Błąd podczas zapisywania parametrów')
    }
  }

  const deleteCustomPeriod = async (symbol) => {
    try {
      const response = await fetch(`${API_URL}/api/purchase-proposals/custom-period/${symbol}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Błąd podczas usuwania niestandardowego okresu')
      }

      // Odśwież dane
      await fetchProposals()
    } catch (error) {
      console.error('Błąd podczas usuwania:', error)
      alert('Błąd podczas usuwania niestandardowego okresu')
    }
  }

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const filteredAndSortedItems = React.useMemo(() => {
    let items = data?.items.filter(item => {
      const matchesSearch = !searchTerm ||
        item.Nazwa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.Symbol?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.Marka?.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesSearch
    }) || []

    // Sortowanie: najpierw PONIŻEJ (status), potem według wybranego pola
    items.sort((a, b) => {
      // Priorytet 1: Status PONIŻEJ zawsze na górze
      if (a.Status === 'PONIŻEJ' && b.Status !== 'PONIŻEJ') return -1
      if (a.Status !== 'PONIŻEJ' && b.Status === 'PONIŻEJ') return 1

      // Priorytet 2: Sortowanie według wybranego pola
      let aVal = a[sortField]
      let bVal = b[sortField]

      // Konwersja na liczby dla pól numerycznych
      if (typeof aVal === 'number' || !isNaN(parseFloat(aVal))) {
        aVal = parseFloat(aVal) || 0
        bVal = parseFloat(bVal) || 0
      }

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
      }
    })

    return items
  }, [data, searchTerm, sortField, sortDirection])

  // Komponent tooltipa dla nagłówków
  const ColumnTooltip = ({ title, children, style, align = 'center', onClick }) => {
    const [showTooltip, setShowTooltip] = useState(false)
    const textAlign = style?.textAlign || 'right'

    // Określenie pozycji tooltipa w zależności od wyrównania
    const getTooltipPosition = () => {
      switch(align) {
        case 'left':
          return 'left-0'
        case 'right':
          return 'right-0'
        default:
          return 'left-1/2 transform -translate-x-1/2'
      }
    }

    const getArrowPosition = () => {
      switch(align) {
        case 'left':
          return 'left-8'
        case 'right':
          return 'right-8'
        default:
          return 'left-1/2 transform -translate-x-1/2'
      }
    }

    return (
      <th
        className={`relative py-2 px-2 font-bold border-r border-gray-300 cursor-pointer hover:bg-gray-200 group text-${textAlign}`}
        style={style}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={onClick}
      >
        <span className="border-b-2 border-dotted border-blue-400 group-hover:border-blue-600">{title}</span>
        {showTooltip && (
          <div className={`absolute top-full ${getTooltipPosition()} mt-2 w-72 p-4 bg-gray-900 text-white text-sm rounded-lg shadow-2xl z-[9999] pointer-events-none whitespace-normal`}>
            <div className={`absolute bottom-full ${getArrowPosition()} w-0 h-0 border-l-8 border-r-8 border-b-8 border-transparent border-b-gray-900`}></div>
            {children}
          </div>
        )}
      </th>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
        <p className="text-lg font-medium text-red-600">Błąd: {error.message}</p>
        <button onClick={fetchProposals} className="mt-4 btn-primary">
          Spróbuj ponownie
        </button>
      </div>
    )
  }


  return (
    <div className="space-y-6">
      {/* Nagłówek */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Propozycje Zakupowe - Suplementy</h1>
          <p className="text-gray-500 mt-1">Automatyczne wyliczanie stanów minimalnych na podstawie średniego zużycia</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchProposals}
            className="btn-secondary flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Odśwież</span>
          </button>
        </div>
      </div>

      {/* Podsumowanie KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card bg-blue-50 border-2 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Wszystkie produkty</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {data.summary.total_products}
              </p>
              <div className="flex items-center mt-2 text-blue-600">
                <Package className="w-4 h-4 mr-1" />
                <span className="text-sm font-medium">Suplementy</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card bg-red-50 border-2 border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Poniżej minimum</p>
              <p className="text-3xl font-bold text-red-600 mt-2">
                {data.summary.products_below_minimum}
              </p>
              <div className="flex items-center mt-2 text-red-600">
                <TrendingDown className="w-4 h-4 mr-1" />
                <span className="text-sm font-medium">Wymaga zamówienia</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card bg-green-50 border-2 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Stan OK</p>
              <p className="text-3xl font-bold text-green-600 mt-2">
                {data.summary.products_ok}
              </p>
              <div className="flex items-center mt-2 text-green-600">
                <Package className="w-4 h-4 mr-1" />
                <span className="text-sm font-medium">Wystarczający zapas</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card bg-yellow-50 border-2 border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Wartość zamówienia</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {formatNumber(data.summary.total_purchase_value)} zł
              </p>
              <div className="flex items-center mt-2 text-yellow-600">
                <DollarSign className="w-4 h-4 mr-1" />
                <span className="text-sm font-medium">Netto</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filtry */}
      <div className="card">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Okres zapasu (dni)
              </label>
              <input
                type="number"
                value={minStockDays}
                onChange={(e) => setMinStockDays(Number(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded-lg"
                min="1"
                max="180"
              />
              <p className="text-xs text-gray-500 mt-1">
                Stan minimalny = średnie dzienne zużycie × {minStockDays} dni
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Wyszukiwanie
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Szukaj po nazwie, symbolu lub marce..."
                className="w-full p-2 border border-gray-300 rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-1">
                Znaleziono: {filteredAndSortedItems.length} produktów
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela propozycji */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 px-6 pt-6">Lista produktów</h2>
        <div className="overflow-x-auto" style={{ maxWidth: '100%' }}>
          <table className="w-full text-xs" style={{ tableLayout: 'fixed', minWidth: '900px' }}>
            <thead className="bg-gray-100">
              <tr>
                <ColumnTooltip title={`Status ${sortField === 'Status' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}`} style={{ width: '70px', textAlign: 'left' }} align="left" onClick={() => handleSort('Status')}>
                  <p className="font-bold text-yellow-300 mb-2">Status produktu</p>
                  <p><span className="text-red-400 font-bold">PONIŻEJ</span> - stan poniżej minimum, trzeba zamówić</p>
                  <p><span className="text-green-400 font-bold">OK</span> - stan w normie</p>
                  <p><span className="text-blue-400 font-bold">NADMIAR</span> - stan powyżej optimum</p>
                  <p className="mt-2 text-gray-400 text-xs">Kliknij nagłówek aby sortować</p>
                </ColumnTooltip>
                <th
                  className="py-2 px-2 text-left font-bold border-r border-gray-300 cursor-pointer hover:bg-gray-200"
                  style={{ width: '100px' }}
                  onClick={() => handleSort('Symbol')}
                >
                  Symbol {sortField === 'Symbol' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="py-2 px-2 text-left font-bold border-r border-gray-300 cursor-pointer hover:bg-gray-200"
                  style={{ width: '180px' }}
                  onClick={() => handleSort('Nazwa')}
                >
                  Nazwa {sortField === 'Nazwa' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="py-2 px-2 text-left font-bold border-r border-gray-300 cursor-pointer hover:bg-gray-200"
                  style={{ width: '50px' }}
                  onClick={() => handleSort('Marka')}
                >
                  Marka {sortField === 'Marka' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <ColumnTooltip title={`Stan ${sortField === 'StanMagazynowy' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}`} style={{ width: '55px', textAlign: 'center' }} onClick={() => handleSort('StanMagazynowy')}>
                  <p className="font-bold text-yellow-300 mb-2">Stan magazynowy</p>
                  <p>Aktualna ilość produktu na magazynie (suma magazynów 1, 7, 9).</p>
                  <p className="mt-2 text-gray-400 text-xs">Kliknij nagłówek aby sortować</p>
                </ColumnTooltip>
                <ColumnTooltip title={`Śr.dz. ${sortField === 'SrednieDzienneZuzycie' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}`} style={{ width: '55px', textAlign: 'center' }} onClick={() => handleSort('SrednieDzienneZuzycie')}>
                  <p className="font-bold text-yellow-300 mb-2">Średnie dzienne zużycie</p>
                  <p>Obliczone na podstawie sprzedaży z ostatnich <span className="text-green-400 font-bold">90 dni</span>.</p>
                  <p className="mt-1">Wzór: <span className="font-mono bg-gray-700 px-1 rounded">Sprzedaż 90 dni / 90</span></p>
                  <p className="mt-2 text-gray-400 text-xs">Kliknij nagłówek aby sortować</p>
                </ColumnTooltip>
                <ColumnTooltip title={`Dost. ${sortField === 'CzasDostawy' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}`} style={{ width: '50px', textAlign: 'center' }} onClick={() => handleSort('CzasDostawy')}>
                  <p className="font-bold text-yellow-300 mb-2">Czas dostawy (dni)</p>
                  <p>Ile dni trwa dostawa od momentu złożenia zamówienia do dostawcy.</p>
                  <p className="mt-1">Domyślnie: <span className="text-green-400 font-bold">7 dni</span></p>
                  <p className="mt-2 text-blue-300">Edytowalne - kliknij ikonę edycji w kolumnie Akcje</p>
                </ColumnTooltip>
                <ColumnTooltip title={`Częst. ${sortField === 'CzestotliwoscZamawiania' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}`} style={{ width: '50px', textAlign: 'center' }} onClick={() => handleSort('CzestotliwoscZamawiania')}>
                  <p className="font-bold text-yellow-300 mb-2">Częstotliwość zamawiania (dni)</p>
                  <p>Co ile dni składasz zamówienie u dostawcy.</p>
                  <p className="mt-1">Domyślnie: <span className="text-green-400 font-bold">14 dni</span></p>
                  <p className="mt-2 text-blue-300">Edytowalne - kliknij ikonę edycji w kolumnie Akcje</p>
                </ColumnTooltip>
                <ColumnTooltip title={`Opt. ${sortField === 'OptymalnaWielkoscPartii' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}`} style={{ width: '55px', textAlign: 'center' }} onClick={() => handleSort('OptymalnaWielkoscPartii')}>
                  <p className="font-bold text-yellow-300 mb-2">Optymalna wielkość partii</p>
                  <p>Minimalna ilość do zamówienia (np. pełne kartony, palety).</p>
                  <p className="mt-1">Wartość <span className="text-green-400 font-bold">0</span> = brak ograniczenia</p>
                  <p className="mt-2 text-blue-300">Edytowalne - kliknij ikonę edycji w kolumnie Akcje</p>
                </ColumnTooltip>
                <ColumnTooltip title={`Min. ${sortField === 'StanMinimalny' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}`} style={{ width: '55px', textAlign: 'center' }} onClick={() => handleSort('StanMinimalny')}>
                  <p className="font-bold text-yellow-300 mb-2">Stan minimalny</p>
                  <p>Poziom zapasu, poniżej którego należy złożyć zamówienie.</p>
                  <p className="mt-1">Wzór:</p>
                  <p className="font-mono bg-gray-700 px-1 rounded text-xs">(Czas dostawy + Częstotliwość) × Śr. dzienne zużycie</p>
                  <p className="mt-2 text-gray-400 text-xs">Kliknij nagłówek aby sortować</p>
                </ColumnTooltip>
                <ColumnTooltip title={`Różn. ${sortField === 'Roznica' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}`} style={{ width: '55px', textAlign: 'center' }} onClick={() => handleSort('Roznica')}>
                  <p className="font-bold text-yellow-300 mb-2">Różnica</p>
                  <p>Różnica między stanem magazynowym a stanem minimalnym.</p>
                  <p className="mt-1">Wzór: <span className="font-mono bg-gray-700 px-1 rounded">Stan - Stan minimalny</span></p>
                  <p className="mt-1"><span className="text-red-400">Ujemna</span> = trzeba zamówić</p>
                  <p><span className="text-green-400">Dodatnia</span> = zapas wystarczający</p>
                </ColumnTooltip>
                <ColumnTooltip title={`Zamów ${sortField === 'IloscDoZamowienia' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}`} style={{ width: '60px', textAlign: 'right' }} align="right" onClick={() => handleSort('IloscDoZamowienia')}>
                  <p className="font-bold text-yellow-300 mb-2">Ilość do zamówienia</p>
                  <p>Sugerowana ilość do zamówienia, aby osiągnąć stan minimalny.</p>
                  <p className="mt-1">Zaokrąglone <span className="text-green-400 font-bold">w górę</span> do liczby całkowitej.</p>
                  <p className="mt-2 text-gray-400 text-xs">Kliknij nagłówek aby sortować</p>
                </ColumnTooltip>
                <ColumnTooltip title={`Wartość ${sortField === 'WartoscZamowienia' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}`} style={{ width: '70px', textAlign: 'right' }} align="right" onClick={() => handleSort('WartoscZamowienia')}>
                  <p className="font-bold text-yellow-300 mb-2">Wartość zamówienia</p>
                  <p>Szacunkowa wartość zamówienia w złotych.</p>
                  <p className="mt-1">Wzór: <span className="font-mono bg-gray-700 px-1 rounded text-xs">Ilość × Cena zakupu brutto</span></p>
                  <p className="mt-2 text-gray-400 text-xs">Kliknij nagłówek aby sortować</p>
                </ColumnTooltip>
                <th className="py-2 px-2 text-center font-bold" style={{ width: '50px' }}>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedItems.map((item, index) => {
                const statusColors = {
                  'PONIŻEJ': 'bg-red-100 text-red-800 border-red-300',
                  'OK': 'bg-green-100 text-green-800 border-green-300',
                  'NADMIAR': 'bg-blue-100 text-blue-800 border-blue-300'
                }

                const rowBg = item.Status === 'PONIŻEJ' ? 'bg-red-50' : ''

                return (
                  <tr key={index} className={`border-b border-gray-200 hover:bg-gray-50 ${rowBg}`}>
                    <td className="py-1 px-2 border-r border-gray-300">
                      <span className={`inline-flex items-center px-1 py-0.5 rounded text-xs font-bold border ${statusColors[item.Status]}`}>
                        {item.Status === 'PONIŻEJ' ? '!' : item.Status === 'OK' ? '✓' : '↑'}
                      </span>
                    </td>
                    <td className="py-1 px-2 font-mono border-r border-gray-300 truncate" title={item.Symbol}>{item.Symbol}</td>
                    <td className="py-1 px-2 border-r border-gray-300 truncate" title={item.Nazwa}>{item.Nazwa}</td>
                    <td className="py-1 px-2 border-r border-gray-300 truncate">{item.Marka}</td>
                    <td className="py-1 px-2 text-right font-medium border-r border-gray-300">{formatNumber(item.Stan, 0)}</td>
                    <td className="py-1 px-2 text-right border-r border-gray-300">{formatNumber(item.SrednieDzienneZuzycie, 2)}</td>
                    <td className="py-1 px-2 text-right border-r border-gray-300">
                      {editingSymbol === item.Symbol ? (
                        <input
                          type="number"
                          value={deliveryTime}
                          onChange={(e) => setDeliveryTime(Number(e.target.value))}
                          className="w-12 px-1 py-0.5 text-xs border border-gray-300 rounded"
                          min="1"
                          max="365"
                        />
                      ) : (
                        <span>{item.CzasDostawy}</span>
                      )}
                    </td>
                    <td className="py-1 px-2 text-right border-r border-gray-300">
                      {editingSymbol === item.Symbol ? (
                        <input
                          type="number"
                          value={orderFrequency}
                          onChange={(e) => setOrderFrequency(Number(e.target.value))}
                          className="w-12 px-1 py-0.5 text-xs border border-gray-300 rounded"
                          min="1"
                          max="365"
                        />
                      ) : (
                        <span>{item.CzestotliwoscZamawiania}</span>
                      )}
                    </td>
                    <td className="py-1 px-2 text-right border-r border-gray-300">
                      {editingSymbol === item.Symbol ? (
                        <input
                          type="number"
                          value={optimalQuantity}
                          onChange={(e) => setOptimalQuantity(Number(e.target.value))}
                          className="w-12 px-1 py-0.5 text-xs border border-gray-300 rounded"
                          min="0"
                        />
                      ) : (
                        <span>{item.OptymalnaWielkoscPartii || '-'}</span>
                      )}
                    </td>
                    <td className="py-1 px-2 text-right font-medium border-r border-gray-300">{formatNumber(item.StanMinimalny, 0)}</td>
                    <td className={`py-1 px-2 text-right font-bold border-r border-gray-300 ${item.Roznica < 0 ? 'text-red-600' : item.Roznica === 0 ? 'text-gray-600' : 'text-green-600'}`}>
                      {item.Roznica > 0 ? '+' : ''}{formatNumber(item.Roznica, 0)}
                    </td>
                    <td className="py-1 px-2 text-right font-bold border-r border-gray-300">
                      {item.IloscDoZamowienia > 0 ? <span className="text-red-600">{formatNumber(item.IloscDoZamowienia, 0)}</span> : '-'}
                    </td>
                    <td className="py-1 px-2 text-right font-medium border-r border-gray-300">
                      {item.WartoscZamowienia > 0 ? <span className="text-red-600">{formatNumber(item.WartoscZamowienia)}zł</span> : '-'}
                    </td>
                    <td className="py-1 px-2 text-center">
                      {editingSymbol === item.Symbol ? (
                        <div className="flex items-center justify-center space-x-1">
                          <button onClick={() => saveCustomPeriod(item.Symbol)} className="p-0.5 text-green-600 hover:bg-green-50 rounded" title="Zapisz">
                            <Check className="w-3 h-3" />
                          </button>
                          <button onClick={cancelEditing} className="p-0.5 text-red-600 hover:bg-red-50 rounded" title="Anuluj">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => startEditing(item)} className="p-0.5 text-blue-600 hover:bg-blue-50 rounded" title="Edytuj">
                          <Edit2 className="w-3 h-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {filteredAndSortedItems.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            Brak produktów do wyświetlenia
          </div>
        )}
      </div>

      {/* Legenda */}
      <div className="card bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Legenda statusów:</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
              PONIŻEJ
            </span>
            <span className="text-gray-600">Stan poniżej minimum - wymaga zamówienia</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-300">
              OK
            </span>
            <span className="text-gray-600">Stan OK - wystarczający zapas</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
              NADMIAR
            </span>
            <span className="text-gray-600">Stan powyżej 120% minimum - nadmiar</span>
          </div>
        </div>
      </div>

      {/* Informacja o aktualizacji */}
      <div className="text-center text-sm text-gray-500">
        Ostatnia aktualizacja: {new Date().toLocaleString('pl-PL')} | Okres: ostatnie 90 dni
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
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <HelpCircle className="w-6 h-6 text-yellow-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Propozycje Zakupowe - Pomoc</h2>
              </div>
              <button onClick={() => setShowHelp(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Do czego sluzy ten widok?</h3>
                <p className="text-gray-600">
                  Widok Propozycje Zakupowe automatycznie wylicza stany minimalne na podstawie sredniego dziennego zuzycia
                  i sugeruje ilosci do zamowienia dla produktow z grupy Suplementy.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Glowne funkcjonalnosci:</h3>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3 p-3 bg-red-50 rounded-lg">
                    <TrendingDown className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Status PONIZEJ</p>
                      <p className="text-sm text-gray-600">Produkty wymagajace natychmiastowego zamowienia - stan ponizej minimum.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                    <Package className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Stan minimalny</p>
                      <p className="text-sm text-gray-600">Wyliczany automatycznie: (Czas dostawy + Czestotliwosc) x Srednie dzienne zuzycie.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
                    <Edit2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Edycja parametrow</p>
                      <p className="text-sm text-gray-600">Mozliwosc edycji czasu dostawy, czestotliwosci zamawiania i optymalnej wielkosci partii.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-yellow-50 rounded-lg">
                    <DollarSign className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Wartosc zamowienia</p>
                      <p className="text-sm text-gray-600">Automatyczne wyliczenie wartosci zamowienia na podstawie cen zakupu.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Wskazowka</h4>
                <p className="text-sm text-gray-600">
                  Najedz myszka na naglowek kolumny aby zobaczyc szczegolowy opis. Kliknij naglowek aby sortowac.
                  Eksportuj liste do CSV aby ulatwic skladanie zamowien.
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

export default PurchaseProposals
