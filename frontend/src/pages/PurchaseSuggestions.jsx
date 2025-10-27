import { ShoppingCart, Tag, TrendingDown, Clock, Package, DollarSign } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const purchaseSuggestions = [
  {
    product: 'Laptop Dell XPS 15',
    category: 'Elektronika',
    currentStock: 12,
    recommendedOrder: 25,
    avgSalesPerWeek: 6,
    daysToStockout: 14,
    priority: 'high',
    reason: 'Prognozowany wzrost popytu o 40% w następnym miesiącu'
  },
  {
    product: 'Kawa ziarnista 1kg',
    category: 'Spożywcze',
    currentStock: 8,
    recommendedOrder: 40,
    avgSalesPerWeek: 9,
    daysToStockout: 6,
    priority: 'critical',
    reason: 'Niski stan magazynowy, ryzyko wyczerpania zapasów'
  },
  {
    product: 'Mysz bezprzewodowa',
    category: 'Elektronika',
    currentStock: 35,
    recommendedOrder: 20,
    avgSalesPerWeek: 4,
    daysToStockout: 60,
    priority: 'low',
    reason: 'Standardowe uzupełnienie zapasów'
  },
  {
    product: 'Słuchawki Bluetooth',
    category: 'Elektronika',
    currentStock: 18,
    recommendedOrder: 30,
    avgSalesPerWeek: 7,
    daysToStockout: 18,
    priority: 'medium',
    reason: 'Zbliżający się sezon świąteczny - zwiększony popyt'
  },
]

const discountSuggestions = [
  {
    product: 'Kurtka zimowa XL',
    category: 'Odzież',
    currentStock: 45,
    daysInStock: 120,
    rotationRate: 0.8,
    currentPrice: 299,
    suggestedPrice: 209,
    discount: 30,
    reason: 'Koniec sezonu, wolna rotacja'
  },
  {
    product: 'Tablet Android 10"',
    category: 'Elektronika',
    currentStock: 22,
    daysInStock: 85,
    rotationRate: 1.2,
    currentPrice: 899,
    suggestedPrice: 719,
    discount: 20,
    reason: 'Nowy model w drodze, upłynnij obecny'
  },
  {
    product: 'Świece zapachowe zestaw',
    category: 'Dom i ogród',
    currentStock: 60,
    daysInStock: 95,
    rotationRate: 0.5,
    currentPrice: 49,
    suggestedPrice: 34,
    discount: 30,
    reason: 'Bardzo wolna rotacja, zbyt duże zapasy'
  },
]

const rotationData = [
  { category: 'Elektronika', rotacja: 8.5, optymalny: 7 },
  { category: 'Odzież', rotacja: 4.2, optymalny: 6 },
  { category: 'Spożywcze', rotacja: 12.3, optymalny: 10 },
  { category: 'Dom i ogród', rotacja: 3.8, optymalny: 5 },
]

function PurchaseSuggestions() {
  return (
    <div className="space-y-6">
      {/* Nagłówek */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sugestie Zakupów i Przecen</h1>
          <p className="text-gray-500 mt-1">Inteligentne rekomendacje optymalizacji zapasów i cen</p>
        </div>
      </div>

      {/* Statystyki */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card bg-blue-50 border-2 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Produkty do zamówienia</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">24</p>
            </div>
            <ShoppingCart className="w-10 h-10 text-blue-600" />
          </div>
        </div>

        <div className="card bg-orange-50 border-2 border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Produkty do przeceny</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">15</p>
            </div>
            <Tag className="w-10 h-10 text-orange-600" />
          </div>
        </div>

        <div className="card bg-green-50 border-2 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Potencjalne oszczędności</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">12,450 zł</p>
            </div>
            <DollarSign className="w-10 h-10 text-green-600" />
          </div>
        </div>

        <div className="card bg-purple-50 border-2 border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Średnia rotacja</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">7.2x</p>
            </div>
            <Package className="w-10 h-10 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Sugestie zakupów */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <ShoppingCart className="w-5 h-5 mr-2 text-primary-600" />
            Rekomendowane zamówienia
          </h2>
          <button className="btn-primary text-sm">Generuj zamówienie</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">Priorytet</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">Produkt</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-900">Stan obecny</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-900">Do zamówienia</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-900">Dni do wyczerpania</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">Powód</th>
              </tr>
            </thead>
            <tbody>
              {purchaseSuggestions.map((item, index) => (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-4 px-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                      item.priority === 'critical' ? 'bg-red-100 text-red-800' :
                      item.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                      item.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {item.priority === 'critical' ? 'Krytyczny' :
                       item.priority === 'high' ? 'Wysoki' :
                       item.priority === 'medium' ? 'Średni' : 'Niski'}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <p className="font-medium text-gray-900">{item.product}</p>
                    <p className="text-sm text-gray-500">{item.category}</p>
                  </td>
                  <td className="py-4 px-4 text-center font-medium text-gray-900">{item.currentStock} szt.</td>
                  <td className="py-4 px-4 text-center">
                    <span className="font-bold text-primary-600 text-lg">{item.recommendedOrder} szt.</span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <div className="flex items-center justify-center space-x-1">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className={`font-medium ${
                        item.daysToStockout < 10 ? 'text-red-600' :
                        item.daysToStockout < 20 ? 'text-orange-600' : 'text-green-600'
                      }`}>
                        {item.daysToStockout} dni
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-600">{item.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sugestie przecen */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <Tag className="w-5 h-5 mr-2 text-orange-600" />
            Rekomendowane przeceny
          </h2>
          <button className="btn-secondary text-sm">Zastosuj przeceny</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">Produkt</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-900">Stan magazynowy</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-900">Dni w magazynie</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-900">Cena obecna</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-900">Cena sugerowana</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-900">Przecena</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">Powód</th>
              </tr>
            </thead>
            <tbody>
              {discountSuggestions.map((item, index) => (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-4 px-4">
                    <p className="font-medium text-gray-900">{item.product}</p>
                    <p className="text-sm text-gray-500">{item.category}</p>
                  </td>
                  <td className="py-4 px-4 text-center font-medium text-gray-900">{item.currentStock} szt.</td>
                  <td className="py-4 px-4 text-center text-gray-600">{item.daysInStock} dni</td>
                  <td className="py-4 px-4 text-center font-medium text-gray-900">{item.currentPrice} zł</td>
                  <td className="py-4 px-4 text-center">
                    <span className="font-bold text-green-600 text-lg">{item.suggestedPrice} zł</span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-red-100 text-red-700">
                      <TrendingDown className="w-4 h-4 mr-1" />
                      -{item.discount}%
                    </span>
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-600">{item.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Analiza rotacji */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Rotacja towarów według kategorii</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={rotationData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="rotacja" fill="#0ea5e9" name="Aktualna rotacja (razy/rok)" />
            <Bar dataKey="optymalny" fill="#10b981" name="Optymalna rotacja (razy/rok)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Insighty */}
      <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Package className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Kluczowe rekomendacje</h3>
            <div className="space-y-3">
              <div className="bg-white/70 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-900 mb-1">Optymalizacja zamówień</p>
                <p className="text-sm text-gray-600">
                  Realizując sugerowane zamówienia, możesz zmniejszyć ryzyko utraty sprzedaży o 85%
                  przy jednoczesnym zmniejszeniu kosztów magazynowania o 12,450 zł miesięcznie.
                </p>
              </div>
              <div className="bg-white/70 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-900 mb-1">Dynamiczne przeceny</p>
                <p className="text-sm text-gray-600">
                  Zastosowanie sugerowanych przecen może uwolnić kapitał o wartości ~28,000 zł
                  i zwiększyć miejsce magazynowe o 15%.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PurchaseSuggestions
