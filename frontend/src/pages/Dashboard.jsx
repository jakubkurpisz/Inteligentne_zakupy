import { TrendingUp, TrendingDown, AlertCircle, Package, DollarSign, ShoppingBag } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const salesData = [
  { name: 'Pon', sprzedaz: 4000, cel: 3500 },
  { name: 'Wt', sprzedaz: 3000, cel: 3500 },
  { name: 'Śr', sprzedaz: 5000, cel: 3500 },
  { name: 'Czw', sprzedaz: 4500, cel: 3500 },
  { name: 'Pt', sprzedaz: 6000, cel: 3500 },
  { name: 'Sob', sprzedaz: 5500, cel: 3500 },
  { name: 'Nd', sprzedaz: 4200, cel: 3500 },
]

const topProducts = [
  { name: 'Produkt A', sprzedaz: 1250, zmiana: 12 },
  { name: 'Produkt B', sprzedaz: 980, zmiana: -5 },
  { name: 'Produkt C', sprzedaz: 850, zmiana: 8 },
  { name: 'Produkt D', sprzedaz: 720, zmiana: 15 },
  { name: 'Produkt E', sprzedaz: 650, zmiana: -3 },
]

function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Nagłówek */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Przegląd kluczowych wskaźników i analiz</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Ostatnia aktualizacja</p>
          <p className="text-sm font-medium text-gray-900">{new Date().toLocaleString('pl-PL')}</p>
        </div>
      </div>

      {/* Statystyki */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="stat-card border-primary-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Sprzedaż dziś</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">32,450 zł</p>
              <div className="flex items-center mt-2 text-green-600">
                <TrendingUp className="w-4 h-4 mr-1" />
                <span className="text-sm font-medium">+12.5%</span>
                <span className="text-xs text-gray-500 ml-1">vs wczoraj</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </div>

        <div className="stat-card border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Transakcje</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">147</p>
              <div className="flex items-center mt-2 text-green-600">
                <TrendingUp className="w-4 h-4 mr-1" />
                <span className="text-sm font-medium">+8.3%</span>
                <span className="text-xs text-gray-500 ml-1">vs wczoraj</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="stat-card border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Poziom zapasów</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">2,845</p>
              <div className="flex items-center mt-2 text-orange-600">
                <TrendingDown className="w-4 h-4 mr-1" />
                <span className="text-sm font-medium">-5.2%</span>
                <span className="text-xs text-gray-500 ml-1">vs tydzień temu</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="stat-card border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Alerty</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">12</p>
              <div className="flex items-center mt-2 text-red-600">
                <AlertCircle className="w-4 h-4 mr-1" />
                <span className="text-sm font-medium">3 krytyczne</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Wykresy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Sprzedaż tygodniowa</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="sprzedaz" stroke="#0ea5e9" strokeWidth={2} name="Sprzedaż" />
              <Line type="monotone" dataKey="cel" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" name="Cel" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top 5 produktów</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topProducts}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="sprzedaz" fill="#0ea5e9" name="Sprzedaż (zł)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Rekomendacje AI */}
      <div className="card bg-gradient-to-br from-primary-50 to-blue-50 border-2 border-primary-200">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-xl">G</span>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Rekomendacje AI na dziś</h3>
            <ul className="space-y-2">
              <li className="flex items-start">
                <span className="w-2 h-2 bg-primary-600 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
                <span className="text-gray-700">
                  <strong>Zwiększ zapasy</strong> produktu A o 25% - prognozowany wzrost popytu w przyszłym tygodniu
                </span>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-primary-600 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
                <span className="text-gray-700">
                  <strong>Przecena zalecana</strong> dla produktu X - brak rotacji od 45 dni, sugerowana zniżka 30%
                </span>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-primary-600 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
                <span className="text-gray-700">
                  <strong>Sezon świąteczny</strong> - rozważ zwiększenie stanów magazynowych kategorii "prezenty" o 40%
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
