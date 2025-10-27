import { Brain, Calendar, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts'

const forecastData = [
  { period: 'Tydz 1', rzeczywiste: 4500, prognoza: null, dolnyPrzedzial: null, gornyPrzedzial: null },
  { period: 'Tydz 2', rzeczywiste: 4800, prognoza: null, dolnyPrzedzial: null, gornyPrzedzial: null },
  { period: 'Tydz 3', rzeczywiste: 5200, prognoza: null, dolnyPrzedzial: null, gornyPrzedzial: null },
  { period: 'Tydz 4', rzeczywiste: 4900, prognoza: null, dolnyPrzedzial: null, gornyPrzedzial: null },
  { period: 'Tydz 5', rzeczywiste: null, prognoza: 5400, dolnyPrzedzial: 4800, gornyPrzedzial: 6000 },
  { period: 'Tydz 6', rzeczywiste: null, prognoza: 5800, dolnyPrzedzial: 5100, gornyPrzedzial: 6500 },
  { period: 'Tydz 7', rzeczywiste: null, prognoza: 6200, dolnyPrzedzial: 5400, gornyPrzedzial: 7000 },
  { period: 'Tydz 8', rzeczywiste: null, prognoza: 5900, dolnyPrzedzial: 5200, gornyPrzedzial: 6600 },
]

const productForecasts = [
  {
    name: 'Laptop Dell XPS 15',
    category: 'Elektronika',
    currentStock: 12,
    forecastedDemand: 28,
    confidence: 92,
    status: 'warning',
    recommendation: 'Zamów 20 sztuk w ciągu 3 dni'
  },
  {
    name: 'Kurtka zimowa M',
    category: 'Odzież',
    currentStock: 45,
    forecastedDemand: 15,
    confidence: 88,
    status: 'ok',
    recommendation: 'Poziom zapasów optymalny'
  },
  {
    name: 'Kawa ziarnista 1kg',
    category: 'Spożywcze',
    currentStock: 8,
    forecastedDemand: 35,
    confidence: 95,
    status: 'critical',
    recommendation: 'PILNE: Zamów 30 sztuk natychmiast'
  },
  {
    name: 'Zestaw narzędzi',
    category: 'Dom i ogród',
    currentStock: 22,
    forecastedDemand: 18,
    confidence: 85,
    status: 'ok',
    recommendation: 'Poziom zapasów optymalny'
  },
]

const seasonalEvents = [
  { event: 'Czarny Piątek', date: '24.11.2024', impact: '+45%', category: 'Elektronika' },
  { event: 'Święta Bożego Narodzenia', date: '20-26.12.2024', impact: '+65%', category: 'Wszystkie' },
  { event: 'Wyprzedaż zimowa', date: '01-15.01.2025', impact: '+30%', category: 'Odzież' },
]

function DemandForecast() {
  return (
    <div className="space-y-6">
      {/* Nagłówek */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Prognozowanie Popytu</h1>
          <p className="text-gray-500 mt-1">Przewidywanie przyszłego zapotrzebowania z wykorzystaniem AI</p>
        </div>
        <div className="flex items-center space-x-2 px-4 py-2 bg-green-100 rounded-lg">
          <Brain className="w-5 h-5 text-green-600" />
          <span className="text-sm font-medium text-green-900">Model AI: Aktywny</span>
        </div>
      </div>

      {/* Wykres prognozy */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Prognoza sprzedaży - następne 4 tygodnie</h2>
          <div className="text-sm text-gray-500">
            Dokładność modelu: <span className="font-medium text-green-600">91.5%</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={forecastData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey="dolnyPrzedzial"
              stackId="1"
              stroke="none"
              fill="#bae6fd"
              fillOpacity={0.3}
              name="Dolny przedział"
            />
            <Area
              type="monotone"
              dataKey="gornyPrzedzial"
              stackId="1"
              stroke="none"
              fill="#bae6fd"
              fillOpacity={0.3}
              name="Górny przedział"
            />
            <Line
              type="monotone"
              dataKey="rzeczywiste"
              stroke="#10b981"
              strokeWidth={3}
              dot={{ r: 5 }}
              name="Rzeczywista sprzedaż"
            />
            <Line
              type="monotone"
              dataKey="prognoza"
              stroke="#0ea5e9"
              strokeWidth={3}
              strokeDasharray="5 5"
              dot={{ r: 5 }}
              name="Prognozowana sprzedaż"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Prognozy produktów */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Prognozy dla kluczowych produktów</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">Produkt</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">Kategoria</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-900">Stan magazynowy</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-900">Prognoza (30 dni)</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-900">Pewność</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">Rekomendacja</th>
              </tr>
            </thead>
            <tbody>
              {productForecasts.map((product, index) => (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-4 px-4">
                    <div className="flex items-center space-x-2">
                      {product.status === 'critical' && (
                        <AlertCircle className="w-5 h-5 text-red-500" />
                      )}
                      {product.status === 'warning' && (
                        <AlertCircle className="w-5 h-5 text-orange-500" />
                      )}
                      {product.status === 'ok' && (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      )}
                      <span className="font-medium text-gray-900">{product.name}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-600">{product.category}</td>
                  <td className="py-4 px-4 text-center">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      product.status === 'critical' ? 'bg-red-100 text-red-800' :
                      product.status === 'warning' ? 'bg-orange-100 text-orange-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {product.currentStock} szt.
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center font-medium text-gray-900">
                    {product.forecastedDemand} szt.
                  </td>
                  <td className="py-4 px-4 text-center">
                    <div className="flex items-center justify-center">
                      <div className="w-full max-w-[80px]">
                        <div className="bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-primary-600 h-2 rounded-full"
                            style={{ width: `${product.confidence}%` }}
                          ></div>
                        </div>
                      </div>
                      <span className="ml-2 text-sm font-medium text-gray-900">{product.confidence}%</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-600">{product.recommendation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Wydarzenia sezonowe */}
      <div className="card bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-200">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Calendar className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Nadchodzące wydarzenia sezonowe</h3>
            <div className="space-y-3">
              {seasonalEvents.map((event, index) => (
                <div key={index} className="bg-white/70 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{event.event}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {event.date} • Kategoria: {event.category}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center space-x-1 text-green-600">
                      <TrendingUp className="w-4 h-4" />
                      <span className="font-bold text-lg">{event.impact}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Prognozowany wzrost</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Czynniki wpływające na prognozę */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card bg-blue-50 border-2 border-blue-200">
          <h3 className="font-semibold text-gray-900 mb-3">Dane historyczne</h3>
          <p className="text-sm text-gray-600 mb-2">Analiza obejmuje:</p>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• 24 miesiące danych sprzedaży</li>
            <li>• 150+ sezonowych wzorców</li>
            <li>• 50+ akcji promocyjnych</li>
          </ul>
        </div>

        <div className="card bg-purple-50 border-2 border-purple-200">
          <h3 className="font-semibold text-gray-900 mb-3">Czynniki zewnętrzne</h3>
          <p className="text-sm text-gray-600 mb-2">Uwzględnione:</p>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Święta i wydarzenia</li>
            <li>• Trendy rynkowe</li>
            <li>• Pogoda i sezonowość</li>
          </ul>
        </div>

        <div className="card bg-green-50 border-2 border-green-200">
          <h3 className="font-semibold text-gray-900 mb-3">Algorytmy AI</h3>
          <p className="text-sm text-gray-600 mb-2">Wykorzystywane:</p>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• ARIMA (szeregi czasowe)</li>
            <li>• Prophet (sezonowość)</li>
            <li>• XGBoost (wzorce)</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default DemandForecast
