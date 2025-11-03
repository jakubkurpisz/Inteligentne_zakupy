import React, { useState } from 'react'
import { LayoutDashboard, BarChart3 } from 'lucide-react'
import DashboardTable from './DashboardTable'
import DashboardCharts from './DashboardCharts'

function Dashboard() {
  const [activeTab, setActiveTab] = useState('table');

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
    </div>
  )
}

export default Dashboard
