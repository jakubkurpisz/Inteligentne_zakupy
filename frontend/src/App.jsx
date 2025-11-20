import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import Dashboard from './pages/Dashboard'
import SalesAnalysisNew from './pages/SalesAnalysisNew'
import StanyMagazynowe from './pages/StanyMagazynowe'
import DemandForecast from './pages/DemandForecast'
import PurchaseSuggestions from './pages/PurchaseSuggestions'
import DeadStock from './pages/DeadStock'
import WarehouseRotation from './pages/WarehouseRotation'
import SalesPlans from './pages/SalesPlans'
import PurchaseProposals from './pages/PurchaseProposals'
import Settings from './pages/Settings'

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/sales-analysis" element={<SalesAnalysisNew />} />
          <Route path="/stany-magazynowe" element={<StanyMagazynowe />} />
          <Route path="/demand-forecast" element={<DemandForecast />} />
          <Route path="/purchase-suggestions" element={<PurchaseSuggestions />} />
          <Route path="/purchase-proposals" element={<PurchaseProposals />} />
          <Route path="/dead-stock" element={<DeadStock />} />
          <Route path="/warehouse-rotation" element={<WarehouseRotation />} />
          <Route path="/sales-plans" element={<SalesPlans />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
