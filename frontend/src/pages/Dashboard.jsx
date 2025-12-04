import React, { useState } from 'react'
import { LayoutDashboard, BarChart3, HelpCircle, X, TrendingUp, Package, DollarSign } from 'lucide-react'
import DashboardTable from './DashboardTable'
import DashboardCharts from './DashboardCharts'

function Dashboard() {
  const [activeTab, setActiveTab] = useState('table');
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow p-2 flex space-x-2">
        <button
          onClick={() => setActiveTab('table')}
          className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all ${
            activeTab === 'table'
              ? 'bg-primary-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span>Dashboard Tabelaryczny</span>
        </button>
        <button
          onClick={() => setActiveTab('charts')}
          className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all ${
            activeTab === 'charts'
              ? 'bg-primary-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span>Dashboard Wykresy</span>
        </button>
      </div>

      {/* Content */}
      <div className="transition-all duration-300">
        {activeTab === 'table' ? <DashboardTable /> : <DashboardCharts />}
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
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                  <HelpCircle className="w-6 h-6 text-primary-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Dashboard - Pomoc</h2>
              </div>
              <button onClick={() => setShowHelp(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Do czego sluzy ten widok?</h3>
                <p className="text-gray-600">
                  Dashboard to glowny panel informacyjny systemu Inteligentne Zakupy. Prezentuje kluczowe wskazniki
                  sprzedazy, stany magazynowe oraz trendy w formie tabel i wykresow.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Glowne funkcjonalnosci:</h3>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                    <LayoutDashboard className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Dashboard Tabelaryczny</p>
                      <p className="text-sm text-gray-600">Szczegolowe dane w formie tabel z mozliwoscia sortowania i filtrowania.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
                    <BarChart3 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Dashboard Wykresy</p>
                      <p className="text-sm text-gray-600">Wizualizacja danych w postaci interaktywnych wykresow.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-purple-50 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Analiza trendow</p>
                      <p className="text-sm text-gray-600">Monitorowanie zmian sprzedazy w czasie i identyfikacja trendow.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-orange-50 rounded-lg">
                    <Package className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Stan magazynu</p>
                      <p className="text-sm text-gray-600">Przeglad aktualnych stanow magazynowych i alertow o niskich zapasach.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Wskazowka</h4>
                <p className="text-sm text-gray-600">
                  Przelaczaj miedzy zakladkami "Dashboard Tabelaryczny" i "Dashboard Wykresy" aby zobaczyc dane w preferowanej formie.
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

export default Dashboard
