import { Database, Bell, Shield, Sliders, Save, RefreshCw } from 'lucide-react'
import { useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5555'

function Settings() {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshMessage, setRefreshMessage] = useState('')
  const [refreshStatus, setRefreshStatus] = useState(null)

  const handleRefreshDatabase = async () => {
    setIsRefreshing(true)
    setRefreshMessage('')
    setRefreshStatus(null)

    try {
      const response = await fetch(`${API_URL}/api/update-database`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (response.ok) {
        setRefreshMessage(data.message || 'Baza danych została pomyślnie odświeżona!')
        setRefreshStatus('success')
      } else {
        setRefreshMessage(data.detail || 'Wystąpił błąd podczas odświeżania bazy danych')
        setRefreshStatus('error')
      }
    } catch (error) {
      setRefreshMessage('Błąd połączenia z serwerem: ' + error.message)
      setRefreshStatus('error')
    } finally {
      setIsRefreshing(false)
      // Automatycznie ukryj komunikat po 10 sekundach
      setTimeout(() => {
        setRefreshMessage('')
        setRefreshStatus(null)
      }, 10000)
    }
  }

  return (
    <div className="space-y-6">
      {/* Nagłówek */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Ustawienia</h1>
        <p className="text-gray-500 mt-1">Konfiguracja systemu i integracji</p>
      </div>

      {/* Integracja z Subiekt */}
      <div className="card">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
            <Database className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Integracja z Subiekt</h2>
            <p className="text-sm text-gray-500">Konfiguracja połączenia z systemem Subiekt</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ścieżka do bazy danych Subiekt
            </label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="C:\Subiekt\Data\database.db"
              defaultValue="C:\Subiekt\Data\database.db"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Częstotliwość synchronizacji
              </label>
              <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent">
                <option>Co 5 minut</option>
                <option>Co 15 minut</option>
                <option>Co 30 minut</option>
                <option>Co godzinę</option>
                <option>Ręcznie</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status połączenia
              </label>
              <div className="flex items-center space-x-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-green-900">Połączono</span>
                <span className="text-xs text-gray-500 ml-auto">Ostatnia sync: przed 3 min</span>
              </div>
            </div>
          </div>

          {/* Komunikat statusu odświeżania */}
          {refreshMessage && (
            <div
              className={`p-4 rounded-lg ${
                refreshStatus === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-800'
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}
            >
              <p className="text-sm font-medium">{refreshMessage}</p>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <button
              onClick={handleRefreshDatabase}
              disabled={isRefreshing}
              className={`btn-secondary flex items-center space-x-2 ${
                isRefreshing ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Odświeżanie...' : 'Odśwież bazę danych'}</span>
            </button>
            <button className="btn-primary flex items-center space-x-2">
              <Save className="w-4 h-4" />
              <span>Zapisz ustawienia</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dane do gromadzenia */}
      <div className="card">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <Sliders className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Dane do gromadzenia</h2>
            <p className="text-sm text-gray-500">Wybierz, jakie informacje system ma analizować</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Szczegółowe dane klientów</p>
              <p className="text-sm text-gray-500">Imię, nazwisko, historia zakupów, preferencje</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Dokładne czasy transakcji</p>
              <p className="text-sm text-gray-500">Godzina, minuta każdej sprzedaży dla analiz szczytów</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Informacje o promocjach</p>
              <p className="text-sm text-gray-500">Jakie produkty w promocji, rabaty, skuteczność</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Terminy ważności produktów</p>
              <p className="text-sm text-gray-500">Dla lepszego zarządzania produktami spożywczymi</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Koszty zakupu i marże</p>
              <p className="text-sm text-gray-500">Ceny zakupu, marże, rentowność produktów</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Alerty i powiadomienia */}
      <div className="card">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
            <Bell className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Alerty i powiadomienia</h2>
            <p className="text-sm text-gray-500">Konfiguruj automatyczne powiadomienia</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email do powiadomień
            </label>
            <input
              type="email"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="email@example.com"
              defaultValue="admin@firma.pl"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-gray-900">Niski stan magazynowy</p>
                <input type="checkbox" className="w-4 h-4 text-primary-600" defaultChecked />
              </div>
              <p className="text-sm text-gray-500">Powiadom gdy zapasy spadną poniżej minimum</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-gray-900">Wykrycie martwych zapasów</p>
                <input type="checkbox" className="w-4 h-4 text-primary-600" defaultChecked />
              </div>
              <p className="text-sm text-gray-500">Alert gdy produkt nie sprzedaje się &gt;90 dni</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-gray-900">Niska marża</p>
                <input type="checkbox" className="w-4 h-4 text-primary-600" defaultChecked />
              </div>
              <p className="text-sm text-gray-500">Gdy marża spadnie poniżej progu</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-gray-900">Raport dzienny</p>
                <input type="checkbox" className="w-4 h-4 text-primary-600" defaultChecked />
              </div>
              <p className="text-sm text-gray-500">Codzienny raport sprzedaży o 20:00</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bezpieczeństwo */}
      <div className="card">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Bezpieczeństwo i prywatność</h2>
            <p className="text-sm text-gray-500">Zarządzanie dostępem i danymi</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Czas przechowywania danych (miesiące)
              </label>
              <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent">
                <option>12 miesięcy</option>
                <option>24 miesiące</option>
                <option>36 miesięcy</option>
                <option>Bez limitu</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Poziom logowania
              </label>
              <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent">
                <option>Podstawowy</option>
                <option>Szczegółowy</option>
                <option>Debug</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Szyfrowanie danych wrażliwych</p>
              <p className="text-sm text-gray-500">Szyfruj dane finansowe i osobowe</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Model AI */}
      <div className="card bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-xl">G</span>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Konfiguracja modelu AI</h3>
            <p className="text-sm text-gray-600 mb-4">
              System wykorzystuje Gemini AI do generowania prognoz i rekomendacji
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/70 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-900 mb-1">Status modelu</p>
                <p className="text-sm text-green-600 font-medium">Aktywny i trenowany</p>
              </div>
              <div className="bg-white/70 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-900 mb-1">Ostatnie trenowanie</p>
                <p className="text-sm text-gray-600">Wczoraj, 23:45</p>
              </div>
              <div className="bg-white/70 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-900 mb-1">Dokładność prognoz</p>
                <p className="text-sm text-gray-600">91.5%</p>
              </div>
              <div className="bg-white/70 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-900 mb-1">Przeanalizowane dane</p>
                <p className="text-sm text-gray-600">24 miesiące historii</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Zapisz wszystkie ustawienia */}
      <div className="flex items-center justify-end space-x-3">
        <button className="btn-secondary">Przywróć domyślne</button>
        <button className="btn-primary flex items-center space-x-2">
          <Save className="w-4 h-4" />
          <span>Zapisz wszystkie ustawienia</span>
        </button>
      </div>
    </div>
  )
}

export default Settings
