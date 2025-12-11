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
  DollarSign,
  Sun,
  BarChart3,
  Warehouse,
  ShoppingBag
} from 'lucide-react'

// Struktura menu z sekcjami
const menuStructure = [
  {
    type: 'item',
    path: '/',
    icon: LayoutDashboard,
    label: 'Dashboard'
  },
  {
    type: 'section',
    label: 'Sprzedaż',
    icon: BarChart3,
    items: [
      {
        path: '/sales-analysis',
        icon: TrendingUp,
        label: 'Analiza Sprzedaży'
      },
      {
        path: '/sales-plans',
        icon: Calendar,
        label: 'Plany Sprzedażowe'
      }
    ]
  },
  {
    type: 'section',
    label: 'Magazyn',
    icon: Warehouse,
    items: [
      {
        path: '/stany-magazynowe',
        icon: Package,
        label: 'Stany Magazynowe'
      },
      {
        path: '/minimal-stocks',
        icon: ClipboardList,
        label: 'Stany Minimalne'
      },
      {
        path: '/dead-stock',
        icon: AlertTriangle,
        label: 'Martwe Stany'
      },
      {
        path: '/warehouse-rotation',
        icon: DollarSign,
        label: 'Rotacja Magazynu'
      }
    ]
  },
  {
    type: 'section',
    label: 'Zakupy',
    icon: ShoppingBag,
    items: [
      {
        path: '/seasonality',
        icon: Sun,
        label: 'Sezonowość'
      },
      {
        path: '/purchase-proposals',
        icon: ClipboardList,
        label: 'Suplementy'
      }
    ]
  }
]

function Sidebar({ isOpen }) {
  const location = useLocation()

  const renderMenuItem = (item, isSubItem = false) => {
    const Icon = item.icon
    const isActive = location.pathname === item.path

    return (
      <Link
        key={item.path}
        to={item.path}
        className={`flex items-center space-x-2 px-3 py-1.5 rounded-md transition-all ${
          isSubItem ? 'ml-4' : ''
        } ${
          isActive
            ? 'bg-primary-50 text-primary-700 border-l-2 border-primary-600'
            : 'text-gray-700 hover:bg-gray-50'
        }`}
      >
        <Icon className={`w-4 h-4 ${isActive ? 'text-primary-600' : 'text-gray-500'}`} />
        <span className={`text-sm ${isActive ? 'font-medium text-primary-700' : 'text-gray-700'}`}>
          {item.label}
        </span>
      </Link>
    )
  }

  return (
    <aside
      className={`fixed left-0 top-16 h-[calc(100vh-4rem)] bg-white border-r border-gray-200 transition-all duration-300 ${
        isOpen ? 'w-56' : 'w-0'
      } overflow-y-auto overflow-x-hidden`}
    >
      <nav className="p-2 space-y-1">
        {menuStructure.map((entry, index) => {
          if (entry.type === 'item') {
            return renderMenuItem(entry)
          }

          if (entry.type === 'section') {
            const SectionIcon = entry.icon
            return (
              <div key={entry.label} className={index > 0 ? 'pt-2' : ''}>
                <div className="flex items-center space-x-2 px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <SectionIcon className="w-3 h-3" />
                  <span>{entry.label}</span>
                </div>
                <div className="space-y-0.5">
                  {entry.items.map(item => renderMenuItem(item, true))}
                </div>
              </div>
            )
          }

          return null
        })}
      </nav>
    </aside>
  )
}

export default Sidebar
