import React, { useState, useEffect } from 'react'
import { Package, TrendingDown, ShoppingCart, AlertCircle, RefreshCw, DollarSign, Filter, Download, Edit2, X, Check } from 'lucide-react'
import { API_BASE_URL } from '../config/api'

function PurchaseProposals() {
  const API_URL = API_BASE_URL
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)
  const [minStockDays, setMinStockDays] = useState(30)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingSymbol, setEditingSymbol] = useState(null)
  const [customPeriod, setCustomPeriod] = useState('')
  const [customNotes, setCustomNotes] = useState('')

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
    setCustomPeriod(item.CustomPeriodDays || item.ActualPeriodDays || minStockDays)
    setCustomNotes(item.CustomNotes || '')
  }

  const cancelEditing = () => {
    setEditingSymbol(null)
    setCustomPeriod('')
    setCustomNotes('')
  }

  const saveCustomPeriod = async (symbol) => {
    try {
      const params = new URLSearchParams({
        symbol: symbol,
        custom_period_days: customPeriod,
        notes: customNotes || ''
      })

      const response = await fetch(`${API_URL}/api/purchase-proposals/custom-period?${params}`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Błąd podczas zapisywania niestandardowego okresu')
      }

      // Odśwież dane
      await fetchProposals()
      setEditingSymbol(null)
      setCustomPeriod('')
      setCustomNotes('')
    } catch (error) {
      console.error('Błąd podczas zapisywania:', error)
      alert('Błąd podczas zapisywania niestandardowego okresu')
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

  const exportToCSV = () => {
    if (!data || !data.items) return

    const headers = ['Symbol', 'Nazwa', 'Marka', 'Stan', 'Stan Min.', 'Różnica', 'Do Zamówienia', 'Wartość', 'Status']
    const rows = data.items.map(item => [
      item.Symbol,
      item.Nazwa,
      item.Marka,
      item.Stan,
      item.StanMinimalny,
      item.Roznica,
      item.IloscDoZamowienia,
      item.WartoscZamowienia,
      item.Status
    ])

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n')

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `propozycje_zakupowe_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const filteredItems = data?.items.filter(item => {
    const matchesSearch = !searchTerm ||
      item.Nazwa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.Symbol?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.Marka?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  }) || []

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Ładowanie propozycji zakupowych...</p>
        </div>
      </div>
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

  if (!data) {
    return <div className="text-center text-lg font-medium">Brak danych</div>
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
            onClick={exportToCSV}
            className="btn-secondary flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Eksportuj CSV</span>
          </button>
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
                Znaleziono: {filteredItems.length} produktów
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela propozycji */}
      <div className="card overflow-hidden">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 px-6 pt-6">Lista produktów</h2>
        <div className="overflow-x-auto" style={{ maxWidth: '100%' }}>
          <table className="w-full text-xs" style={{ tableLayout: 'fixed', minWidth: '900px' }}>
            <thead className="bg-gray-100">
              <tr>
                <th className="py-2 px-2 text-left font-bold border-r border-gray-300" style={{ width: '70px' }}>Status</th>
                <th className="py-2 px-2 text-left font-bold border-r border-gray-300" style={{ width: '100px' }}>Symbol</th>
                <th className="py-2 px-2 text-left font-bold border-r border-gray-300" style={{ width: '180px' }}>Nazwa</th>
                <th className="py-2 px-2 text-left font-bold border-r border-gray-300" style={{ width: '50px' }}>Marka</th>
                <th className="py-2 px-2 text-right font-bold border-r border-gray-300" style={{ width: '55px' }}>Stan</th>
                <th className="py-2 px-2 text-right font-bold border-r border-gray-300" style={{ width: '55px' }}>Śr.dz.</th>
                <th className="py-2 px-2 text-right font-bold border-r border-gray-300" style={{ width: '50px' }}>Okres</th>
                <th className="py-2 px-2 text-right font-bold border-r border-gray-300" style={{ width: '55px' }}>Min.</th>
                <th className="py-2 px-2 text-right font-bold border-r border-gray-300" style={{ width: '55px' }}>Różn.</th>
                <th className="py-2 px-2 text-right font-bold border-r border-gray-300" style={{ width: '60px' }}>Zamów</th>
                <th className="py-2 px-2 text-right font-bold border-r border-gray-300" style={{ width: '70px' }}>Wartość</th>
                <th className="py-2 px-2 text-center font-bold" style={{ width: '50px' }}>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item, index) => {
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
                          value={customPeriod}
                          onChange={(e) => setCustomPeriod(e.target.value)}
                          className="w-12 px-1 py-0.5 text-xs border border-gray-300 rounded"
                          min="1"
                          max="365"
                        />
                      ) : (
                        <span className={item.CustomPeriodDays ? 'font-bold text-blue-600' : ''}>
                          {item.ActualPeriodDays}
                        </span>
                      )}
                    </td>
                    <td className="py-1 px-2 text-right font-medium border-r border-gray-300">{formatNumber(item.StanMinimalny, 0)}</td>
                    <td className={`py-1 px-2 text-right font-bold border-r border-gray-300 ${item.Roznica < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {item.Roznica >= 0 ? '+' : ''}{formatNumber(item.Roznica, 0)}
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

        {filteredItems.length === 0 && (
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
    </div>
  )
}

export default PurchaseProposals
