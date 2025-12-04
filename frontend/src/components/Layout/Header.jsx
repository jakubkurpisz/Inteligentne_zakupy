import { Menu, Bell, Settings, User } from 'lucide-react'

function Header({ onMenuClick }) {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="px-4 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={onMenuClick}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Menu className="w-6 h-6 text-gray-600" />
          </button>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">G</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Sporting AI</h1>
            <span className="text-sm text-gray-500 hidden md:inline">
              Analiza Sprzedaży i Zakupów
            </span>
          </div>
        </div>

{/* Kafelki ukryte */}
      </div>
    </header>
  )
}

export default Header
