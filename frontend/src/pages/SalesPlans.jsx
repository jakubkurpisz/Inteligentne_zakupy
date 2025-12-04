import React, { useState, useEffect, useRef } from 'react'
import { Calendar, TrendingUp, DollarSign, AlertCircle, HelpCircle, X, Warehouse } from 'lucide-react'
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
import { API_BASE_URL } from '../config/api'

// Cache helpers
const CACHE_KEYS = { plans: 'salesPlans_plans_cache', summary: 'salesPlans_summary_cache' };
const getFromCache = (key, defaultValue) => {
  try {
    const cached = localStorage.getItem(key);
    return cached ? JSON.parse(cached) : defaultValue;
  } catch { return defaultValue; }
};
const saveToCache = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
};

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
  const [plans, setPlans] = useState(() => getFromCache(CACHE_KEYS.plans, []))
  const [summary, setSummary] = useState(() => getFromCache(CACHE_KEYS.summary, {
    total_gls: 0,
    total_4f: 0,
    total_jeans: 0,
    total_all: 0,
    avg_daily_gls: 0,
    avg_daily_4f: 0,
    avg_daily_jeans: 0,
    avg_daily_all: 0
  }))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    view: 'month' // 'all', 'month', 'week' - domyślnie aktualny miesiąc
  })
  const hasFetchedRef = useRef(false)
  const lastFetchParamsRef = useRef('')
  const [showHelp, setShowHelp] = useState(false)

  // Pobierz dane planów z konkretnymi parametrami (bez użycia stanu filters)
  const fetchPlansWithParams = async (startDate, endDate, sync = false) => {
    setLoading(true)
    setError(null)

    try {
      let url = `${API_BASE_URL}/api/sales-plans?sync=${sync}`

      if (startDate) {
        url += `&start_date=${startDate}`
      }
      if (endDate) {
        url += `&end_date=${endDate}`
      }

      const response = await fetch(url)

      if (!response.ok) {
        throw new Error('Błąd podczas pobierania danych planów')
      }

      const data = await response.json()

      if (data.success) {
        setPlans(data.plans)
        setSummary(data.summary)
        saveToCache(CACHE_KEYS.plans, data.plans)
        saveToCache(CACHE_KEYS.summary, data.summary)
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

  // Pobierz dane planów (używa aktualnych filtrów)
  const fetchPlans = async (sync = false) => {
    await fetchPlansWithParams(filters.startDate, filters.endDate, sync)
  }

  // Przy montowaniu komponentu - zastosuj domyślny filtr (aktualny miesiąc) i pobierz dane
  useEffect(() => {
    const today = new Date()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    const formatDate = (d) => {
      const day = String(d.getDate()).padStart(2, '0')
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const year = d.getFullYear()
      return `${day}.${month}.${year}`
    }
    const startDate = formatDate(monthStart)
    const endDate = formatDate(monthEnd)
    setFilters(prev => ({ ...prev, startDate, endDate }))

    // Pobierz dane tylko raz przy montowaniu (jeśli nie ma cache lub w tle)
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true
      lastFetchParamsRef.current = `${startDate}-${endDate}`
      fetchPlansWithParams(startDate, endDate)
    }
  }, [])

  // Przygotuj dane do wykresów (posortowane rosnąco po dacie)
  const prepareChartData = () => {
    // Parsuj datę z formatu DD.MM.YYYY
    const parseDate = (dateStr) => {
      const [day, month, year] = dateStr.split('.')
      return new Date(year, month - 1, day)
    }

    // Sortuj rosnąco po dacie
    const sortedPlans = [...plans].sort((a, b) => parseDate(a.date) - parseDate(b.date))

    return sortedPlans.map(plan => ({
      date: plan.date,
      GLS: plan.gls,
      '4F': plan.four_f,
      JEANS: plan.jeans,
      RAZEM: plan.total
    }))
  }

  const formatDateForFilter = (date) => {
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}.${month}.${year}`
  }

  // Reaguj na zmianę widoku (tydzień/miesiąc/wszystkie) - tylko gdy użytkownik zmienia filtr
  const handleViewChange = (newView) => {
    const today = new Date()
    let startDate = ''
    let endDate = ''

    if (newView === 'week') {
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
      startDate = formatDateForFilter(weekAgo)
      endDate = formatDateForFilter(today)
    } else if (newView === 'month') {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      startDate = formatDateForFilter(monthStart)
      endDate = formatDateForFilter(monthEnd)
    }

    setFilters({ view: newView, startDate, endDate })

    // Pobierz dane tylko jeśli parametry się zmieniły
    const newParams = `${startDate}-${endDate}`
    if (newParams !== lastFetchParamsRef.current) {
      lastFetchParamsRef.current = newParams
      fetchPlansWithParams(startDate, endDate)
    }
  }

  // Reaguj na ręczną zmianę dat - tylko gdy użytkownik wpisuje daty
  const handleDateChange = (field, value) => {
    const newFilters = { ...filters, [field]: value, view: 'all' }
    setFilters(newFilters)

    // Pobierz dane po zmianie dat (z debounce przez setTimeout)
    const newStartDate = field === 'startDate' ? value : filters.startDate
    const newEndDate = field === 'endDate' ? value : filters.endDate
    const newParams = `${newStartDate}-${newEndDate}`

    if (newParams !== lastFetchParamsRef.current && (newStartDate || newEndDate)) {
      lastFetchParamsRef.current = newParams
      // Użyj setTimeout żeby nie fetchować przy każdym naciśnięciu klawisza
      setTimeout(() => {
        if (lastFetchParamsRef.current === newParams) {
          fetchPlansWithParams(newStartDate, newEndDate)
        }
      }, 500)
    }
  }

  return (
    <div className="space-y-6">
      {/* Nagłówek */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Plany Sprzedażowe</h1>
          <p className="text-gray-600 mt-1">Dane synchronizowane automatycznie co 30 minut</p>
        </div>
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

      {/* Filtry */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-gray-500" />
            <span className="font-medium text-gray-700">Okres:</span>
          </div>

          <select
            value={filters.view}
            onChange={(e) => handleViewChange(e.target.value)}
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
            onChange={(e) => handleDateChange('startDate', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />

          <input
            type="text"
            placeholder="Data do (DD.MM.YYYY)"
            value={filters.endDate}
            onChange={(e) => handleDateChange('endDate', e.target.value)}
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

        {plans.length === 0 ? (
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
            </table>
          </div>
        )}
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
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <HelpCircle className="w-6 h-6 text-orange-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Plany Sprzedazowe - Pomoc</h2>
              </div>
              <button onClick={() => setShowHelp(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Do czego sluzy ten widok?</h3>
                <p className="text-gray-600">
                  Widok Plany Sprzedazowe prezentuje dzienne plany sprzedazy dla poszczegolnych magazynow (GLS, 4F, JEANS).
                  Dane sa synchronizowane automatycznie co 30 minut z arkusza Google.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Glowne funkcjonalnosci:</h3>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                    <DollarSign className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Sumy planow</p>
                      <p className="text-sm text-gray-600">Laczne wartosci planow sprzedazy dla kazdego magazynu oraz srednie dzienne.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
                    <Calendar className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Filtrowanie po datach</p>
                      <p className="text-sm text-gray-600">Wybor okresu: ostatni tydzien, aktualny miesiac lub dowolny zakres dat.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-purple-50 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Wykresy trendow</p>
                      <p className="text-sm text-gray-600">Wizualizacja planow w postaci wykresow liniowych i slupkowych.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-orange-50 rounded-lg">
                    <Warehouse className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Porownanie magazynow</p>
                      <p className="text-sm text-gray-600">Tabela szczegolowych planow dziennych z podsumowaniem.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Wskazowka</h4>
                <p className="text-sm text-gray-600">
                  Dane sa pobierane z arkusza Google Sheets. Mozesz zmieniac zakres dat aby analizowac rozne okresy.
                  Wykres liniowy pokazuje trend, a slupkowy pozwala porownac magazyny.
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

export default SalesPlans
