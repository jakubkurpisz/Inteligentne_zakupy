import React, { useState, useEffect } from 'react'
import { RefreshCw, Calendar, TrendingUp, DollarSign, AlertCircle } from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

const API_BASE_URL = 'http://localhost:3002'

// Funkcja formatująca liczby w stylu polskim
const formatNumber = (num) => {
  if (num === null || num === undefined) return '0'
  return new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num)
}

const formatCurrency = (num) => {
  if (num === null || num === undefined) return '0,00 zł'
  return new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num) + ' zł'
}

function SalesPlans() {
  const [plans, setPlans] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    view: 'all' // 'all', 'month', 'week'
  })

  // Pobierz dane planów
  const fetchPlans = async (refresh = false) => {
    setLoading(true)
    setError(null)

    try {
      let url = `${API_BASE_URL}/api/sales-plans?refresh=${refresh}`

      if (filters.startDate) {
        url += `&start_date=${filters.startDate}`
      }
      if (filters.endDate) {
        url += `&end_date=${filters.endDate}`
      }

      const response = await fetch(url)

      if (!response.ok) {
        throw new Error('Błąd podczas pobierania danych planów')
      }

      const data = await response.json()

      if (data.success) {
        setPlans(data.plans)
        setSummary(data.summary)
      } else {
        throw new Error('Nie udało się pobrać planów')
      }
    } catch (err) {
      setError(err.message)
      console.error('Błąd:', err)
    } finally {
      setLoading(false)
    }
  }

  // Odśwież dane z Google Sheets
  const handleRefresh = async () => {
    setRefreshing(true)

    try {
      const response = await fetch(`${API_BASE_URL}/api/sales-plans/refresh`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Błąd podczas odświeżania danych')
      }

      const data = await response.json()

      if (data.success) {
        // Po odświeżeniu, pobierz nowe dane
        await fetchPlans(false)
      } else {
        throw new Error(data.message || 'Nie udało się odświeżyć danych')
      }
    } catch (err) {
      setError(err.message)
      console.error('Błąd odświeżania:', err)
    } finally {
      setRefreshing(false)
    }
  }

  // Pobierz dane przy montowaniu komponentu
  useEffect(() => {
    fetchPlans()
  }, [])

  // Przygotuj dane do wykresów
  const prepareChartData = () => {
    return plans.map(plan => ({
      date: plan.date,
      GLS: plan.gls,
      '4F': plan.four_f,
      JEANS: plan.jeans,
      RAZEM: plan.total
    }))
  }

  // Zastosuj filtry widoku
  const applyViewFilter = () => {
    const today = new Date()

    if (filters.view === 'week') {
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
      const startDate = formatDateForFilter(weekAgo)
      const endDate = formatDateForFilter(today)
      setFilters({ ...filters, startDate, endDate })
    } else if (filters.view === 'month') {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      const startDate = formatDateForFilter(monthStart)
      const endDate = formatDateForFilter(monthEnd)
      setFilters({ ...filters, startDate, endDate })
    } else {
      setFilters({ ...filters, startDate: '', endDate: '' })
    }
  }

  const formatDateForFilter = (date) => {
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}.${month}.${year}`
  }

  useEffect(() => {
    if (filters.view !== 'all') {
      applyViewFilter()
    }
  }, [filters.view])

  useEffect(() => {
    if (filters.startDate || filters.endDate) {
      fetchPlans()
    }
  }, [filters.startDate, filters.endDate])

  return (
    <div className="space-y-6">
      {/* Nagłówek */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Plany Sprzedażowe</h1>
          <p className="text-gray-600 mt-1">Zarządzanie planami sprzedaży z Google Sheets</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            refreshing
              ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
              : 'bg-primary-600 text-white hover:bg-primary-700'
          }`}
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Odświeżanie...' : 'Odśwież z Google Sheets'}</span>
        </button>
      </div>

      {/* Komunikaty o błędach */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-red-900">Błąd</h3>
            <p className="text-red-700 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Statystyki główne */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Plan GLS</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(summary.total_gls)}</p>
                <p className="text-blue-100 text-xs mt-2">
                  Średnio dziennie: {formatCurrency(summary.avg_daily_gls)}
                </p>
              </div>
              <DollarSign className="w-12 h-12 text-blue-200 opacity-50" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium">Plan 4F</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(summary.total_4f)}</p>
                <p className="text-green-100 text-xs mt-2">
                  Średnio dziennie: {formatCurrency(summary.avg_daily_4f)}
                </p>
              </div>
              <DollarSign className="w-12 h-12 text-green-200 opacity-50" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">Plan JEANS</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(summary.total_jeans)}</p>
                <p className="text-purple-100 text-xs mt-2">
                  Średnio dziennie: {formatCurrency(summary.avg_daily_jeans)}
                </p>
              </div>
              <DollarSign className="w-12 h-12 text-purple-200 opacity-50" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm font-medium">Plan Całkowity</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(summary.total_all)}</p>
                <p className="text-orange-100 text-xs mt-2">
                  Średnio dziennie: {formatCurrency(summary.avg_daily_all)}
                </p>
              </div>
              <TrendingUp className="w-12 h-12 text-orange-200 opacity-50" />
            </div>
          </div>
        </div>
      )}

      {/* Filtry */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-gray-500" />
            <span className="font-medium text-gray-700">Okres:</span>
          </div>

          <select
            value={filters.view}
            onChange={(e) => setFilters({ ...filters, view: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="all">Wszystkie dane</option>
            <option value="week">Ostatni tydzień</option>
            <option value="month">Aktualny miesiąc</option>
          </select>

          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">lub wybierz zakres:</span>
          </div>

          <input
            type="text"
            placeholder="Data od (DD.MM.YYYY)"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value, view: 'all' })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />

          <input
            type="text"
            placeholder="Data do (DD.MM.YYYY)"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value, view: 'all' })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </div>

      {/* Wykresy */}
      {plans.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Wykres liniowy - trend */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Trend Planów Sprzedażowych</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={prepareChartData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  tick={{ fontSize: 12 }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => formatCurrency(value)}
                  labelStyle={{ color: '#333' }}
                />
                <Legend />
                <Line type="monotone" dataKey="GLS" stroke="#3b82f6" strokeWidth={2} />
                <Line type="monotone" dataKey="4F" stroke="#10b981" strokeWidth={2} />
                <Line type="monotone" dataKey="JEANS" stroke="#8b5cf6" strokeWidth={2} />
                <Line type="monotone" dataKey="RAZEM" stroke="#f97316" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Wykres słupkowy - porównanie */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Porównanie Magazynów</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={prepareChartData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  tick={{ fontSize: 12 }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => formatCurrency(value)}
                  labelStyle={{ color: '#333' }}
                />
                <Legend />
                <Bar dataKey="GLS" fill="#3b82f6" />
                <Bar dataKey="4F" fill="#10b981" />
                <Bar dataKey="JEANS" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tabela z danymi */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Szczegółowe Plany Dzienne</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="text-gray-600 mt-2">Ładowanie danych...</p>
          </div>
        ) : plans.length === 0 ? (
          <div className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600">Brak danych planów sprzedażowych</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    GLS
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    4F
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    JEANS
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    RAZEM
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {plans.map((plan, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {plan.date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700">
                      {formatCurrency(plan.gls)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700">
                      {formatCurrency(plan.four_f)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700">
                      {formatCurrency(plan.jeans)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                      {formatCurrency(plan.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {summary && (
                <tfoot className="bg-gray-100 font-bold">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">SUMA</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatCurrency(summary.total_gls)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatCurrency(summary.total_4f)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatCurrency(summary.total_jeans)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatCurrency(summary.total_all)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default SalesPlans
