import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import DataPage from './pages/DataPage';
import BacktestPage from './pages/BacktestPage';
import ResultsPage from './pages/ResultsPage';
import TradesPage from './pages/TradesPage';
import OptimizePage from './pages/OptimizePage';
import StrategiesPage from './pages/StrategiesPage';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<DataPage />} />
          <Route path="backtest" element={<BacktestPage />} />
          <Route path="results" element={<ResultsPage />} />
          <Route path="trades" element={<TradesPage />} />
          <Route path="optimize" element={<OptimizePage />} />
          <Route path="strategies" element={<StrategiesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
