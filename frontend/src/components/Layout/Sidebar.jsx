import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  TrendingUp,
  LineChart,
  ShoppingCart,
  AlertTriangle,
  Settings,
  Package,
  Calendar,
  ClipboardList,
  DollarSign
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
    description: 'Historia transakcji'
  },
  {
    path: '/stany-magazynowe',
    icon: Package,
    label: 'Stany Magazynowe',
    description: 'Produkty w magazynie'
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
    path: '/purchase-proposals',
    icon: ClipboardList,
    label: 'Propozycje Zakupowe',
    description: 'Suplementy - stany min.'
  },
  {
    path: '/dead-stock',
    icon: AlertTriangle,
    label: 'Martwe Stany',
    description: 'Analiza rotacji zapasów'
  },
  {
    path: '/warehouse-rotation',
    icon: DollarSign,
    label: 'Rotacja Magazynu',
    description: 'Analiza wartości'
  },
  {
    path: '/sales-plans',
    icon: Calendar,
    label: 'Plany Sprzedażowe',
    description: 'Zarządzanie planami'
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
    </aside>
  )
}

export default Sidebar
