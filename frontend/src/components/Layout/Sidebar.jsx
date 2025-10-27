import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  TrendingUp,
  LineChart,
  ShoppingCart,
  AlertTriangle,
  Settings,
  Database
} from 'lucide-react'

const menuItems = [
  {
    path: '/',
    icon: LayoutDashboard,
    label: 'Dashboard',
    description: 'Przegląd ogólny'
  },
  {
    path: '/sales-analysis',
    icon: TrendingUp,
    label: 'Analiza Sprzedaży',
    description: 'Raporty i trendy'
  },
  {
    path: '/demand-forecast',
    icon: LineChart,
    label: 'Prognozowanie',
    description: 'Przewidywanie popytu'
  },
  {
    path: '/purchase-suggestions',
    icon: ShoppingCart,
    label: 'Sugestie Zakupów',
    description: 'Rekomendacje AI'
  },
  {
    path: '/dead-stock',
    icon: AlertTriangle,
    label: 'Martwe Zapasy',
    description: 'Alerty i ostrzeżenia'
  },
  {
    path: '/settings',
    icon: Settings,
    label: 'Ustawienia',
    description: 'Konfiguracja systemu'
  }
]

function Sidebar({ isOpen }) {
  const location = useLocation()

  return (
    <aside
      className={`fixed left-0 top-16 h-[calc(100vh-4rem)] bg-white border-r border-gray-200 transition-all duration-300 ${
        isOpen ? 'w-64' : 'w-0'
      } overflow-hidden`}
    >
      <nav className="p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                isActive
                  ? 'bg-primary-50 text-primary-700 border-l-4 border-primary-600'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-primary-600' : 'text-gray-500'}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${isActive ? 'text-primary-700' : 'text-gray-900'}`}>
                  {item.label}
                </p>
                <p className="text-xs text-gray-500 truncate">{item.description}</p>
              </div>
            </Link>
          )
        })}
      </nav>

      <div className="absolute bottom-4 left-4 right-4">
        <div className="bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg p-4 text-white">
          <Database className="w-8 h-8 mb-2" />
          <p className="text-sm font-medium">Integracja z Subiekt</p>
          <p className="text-xs opacity-90 mt-1">Ostatnia synchronizacja: przed 5 min</p>
          <button className="mt-3 w-full bg-white/20 hover:bg-white/30 text-white text-xs py-2 rounded transition-colors">
            Synchronizuj dane
          </button>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
