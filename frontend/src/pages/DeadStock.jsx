import { AlertTriangle, XCircle, TrendingDown, Calendar, DollarSign, Package } from 'lucide-react'

const deadStockItems = [
  {
    product: 'Monitor LED 24" Model 2020',
    category: 'Elektronika',
    stock: 35,
    daysInStock: 180,
    purchaseValue: 24500,
    currentValue: 14700,
    loss: 9800,
    lastSale: '2024-04-15',
    severity: 'critical',
    suggestions: [
      'Przecena 40% - spodziewana sprzedaż 70%',
      'Pakiet z klawiaturą - możliwy wzrost sprzedaży o 50%',
      'Zwrot do dostawcy - możliwe odzyskanie 60% wartości'
    ]
  },
  {
    product: 'Kurtka skórzana L - Kolekcja 2022',
    category: 'Odzież',
    stock: 28,
    daysInStock: 450,
    purchaseValue: 16800,
    currentValue: 6720,
    loss: 10080,
    lastSale: '2023-11-20',
    severity: 'critical',
    suggestions: [
      'Przecena 60% - natychmiastowa likwidacja',
      'Outlet online - możliwa sprzedaż w 30 dni',
      'Darowizna - odliczenie podatkowe'
    ]
  },
  {
    product: 'Słuchawki przewodowe Basic',
    category: 'Elektronika',
    stock: 120,
    daysInStock: 240,
    purchaseValue: 3600,
    currentValue: 1800,
    loss: 1800,
    lastSale: '2024-02-10',
    severity: 'high',
    suggestions: [
      'Przecena 50% - spodziewana sprzedaż 80%',
      'Gratisy przy zakupie - wykorzystaj jako bonus',
      'Sprzedaż hurtowa - szybka likwidacja'
    ]
  },
  {
    product: 'Lampa biurkowa LED - stary model',
    category: 'Dom i ogród',
    stock: 45,
    daysInStock: 165,
    purchaseValue: 6750,
    currentValue: 4050,
    loss: 2700,
    lastSale: '2024-05-08',
    severity: 'medium',
    suggestions: [
      'Przecena 30% - możliwa sprzedaż w 60 dni',
      'Bundle z innymi produktami',
      'Promocja "Produkt miesiąca"'
    ]
  },
]

const alertsSummary = [
  {
    type: 'Brak sprzedaży >90 dni',
    count: 24,
    totalValue: 68400,
    icon: XCircle,
    color: 'red'
  },
  {
    type: 'Wolna rotacja',
    count: 38,
    totalValue: 45200,
    icon: TrendingDown,
    color: 'orange'
  },
  {
    type: 'Nadmierny zapas',
    count: 15,
    totalValue: 32100,
    icon: Package,
    color: 'yellow'
  },
]

function DeadStock() {
  return (
    <div className="space-y-6">
      {/* Nagłówek */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Martwe Zapasy i Alerty</h1>
          <p className="text-gray-500 mt-1">Identyfikacja i zarządzanie towarami o niskiej rotacji</p>
        </div>
        <div className="flex items-center space-x-2 px-4 py-2 bg-red-100 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <span className="text-sm font-medium text-red-900">77 aktywnych alertów</span>
        </div>
      </div>

      {/* Podsumowanie alertów */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {alertsSummary.map((alert, index) => {
          const Icon = alert.icon
          return (
            <div key={index} className={`card bg-${alert.color}-50 border-2 border-${alert.color}-200`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <Icon className={`w-5 h-5 text-${alert.color}-600`} />
                    <p className="text-sm font-medium text-gray-900">{alert.type}</p>
                  </div>
                  <p className="text-3xl font-bold text-gray-900">{alert.count}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Wartość: <span className="font-medium">{alert.totalValue.toLocaleString()} zł</span>
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Szczegółowa lista martwych zapasów */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Produkty wymagające pilnej uwagi</h2>
          <div className="flex space-x-2">
            <button className="btn-secondary text-sm">Eksportuj listę</button>
            <button className="btn-primary text-sm">Utwórz akcję</button>
          </div>
        </div>

        <div className="space-y-4">
          {deadStockItems.map((item, index) => (
            <div
              key={index}
              className={`border-2 rounded-lg p-6 ${
                item.severity === 'critical' ? 'border-red-300 bg-red-50' :
                item.severity === 'high' ? 'border-orange-300 bg-orange-50' :
                'border-yellow-300 bg-yellow-50'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <AlertTriangle className={`w-6 h-6 ${
                      item.severity === 'critical' ? 'text-red-600' :
                      item.severity === 'high' ? 'text-orange-600' :
                      'text-yellow-600'
                    }`} />
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{item.product}</h3>
                      <p className="text-sm text-gray-600">{item.category}</p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                    item.severity === 'critical' ? 'bg-red-200 text-red-900' :
                    item.severity === 'high' ? 'bg-orange-200 text-orange-900' :
                    'bg-yellow-200 text-yellow-900'
                  }`}>
                    {item.severity === 'critical' ? 'KRYTYCZNY' :
                     item.severity === 'high' ? 'WYSOKI' : 'ŚREDNI'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Stan magazynowy</p>
                  <p className="text-lg font-bold text-gray-900">{item.stock} szt.</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Dni w magazynie</p>
                  <p className="text-lg font-bold text-gray-900">{item.daysInStock} dni</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Wartość zakupu</p>
                  <p className="text-lg font-bold text-gray-900">{item.purchaseValue.toLocaleString()} zł</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Wartość obecna</p>
                  <p className="text-lg font-bold text-orange-600">{item.currentValue.toLocaleString()} zł</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Strata wartości</p>
                  <p className="text-lg font-bold text-red-600">-{item.loss.toLocaleString()} zł</p>
                </div>
              </div>

              <div className="bg-white/70 rounded-lg p-4 mb-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <p className="text-sm text-gray-600">
                    Ostatnia sprzedaż: <span className="font-medium text-gray-900">{item.lastSale}</span>
                  </p>
                </div>
              </div>

              <div className="bg-white/70 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-900 mb-2">Sugerowane działania AI:</p>
                <ul className="space-y-2">
                  {item.suggestions.map((suggestion, idx) => (
                    <li key={idx} className="flex items-start space-x-2">
                      <span className="w-1.5 h-1.5 bg-primary-600 rounded-full mt-1.5 flex-shrink-0"></span>
                      <span className="text-sm text-gray-700">{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Analiza kosztów */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-200">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Koszty martwych zapasów</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Zamrożony kapitał:</span>
                  <span className="text-lg font-bold text-gray-900">145,600 zł</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Koszt magazynowania/miesiąc:</span>
                  <span className="text-lg font-bold text-orange-600">4,380 zł</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Utrata wartości:</span>
                  <span className="text-lg font-bold text-red-600">24,380 zł</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <TrendingDown className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Potencjał odzyskania</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Przez przeceny:</span>
                  <span className="text-lg font-bold text-gray-900">~87,360 zł</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Przez zwroty:</span>
                  <span className="text-lg font-bold text-gray-900">~43,680 zł</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Oszczędności magazynowe:</span>
                  <span className="text-lg font-bold text-green-600">4,380 zł/mies.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rekomendacje AI */}
      <div className="card bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Plan działania rekomendowany przez AI</h3>
            <div className="space-y-3">
              <div className="bg-white/70 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-900 mb-1">Pilne działania (7 dni)</p>
                <p className="text-sm text-gray-600">
                  Uruchom agresywne promocje dla 12 produktów o wartości 68,400 zł. Potencjalne odzyskanie: 60-70%.
                </p>
              </div>
              <div className="bg-white/70 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-900 mb-1">Średnioterminowe (30 dni)</p>
                <p className="text-sm text-gray-600">
                  Negocjuj zwroty z dostawcami dla 8 produktów. Skontaktuj się z platformami outlet dla pozostałych.
                </p>
              </div>
              <div className="bg-white/70 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-900 mb-1">Prewencja</p>
                <p className="text-sm text-gray-600">
                  Wdróż automatyczne alerty dla produktów bez sprzedaży >45 dni. Zoptymalizuj poziomy zamówień.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DeadStock
