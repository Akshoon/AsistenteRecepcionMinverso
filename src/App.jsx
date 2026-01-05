import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ConfigPage from './pages/ConfigPage';
import VisualPage from './pages/VisualPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/config" element={<ConfigPage />} />
      <Route path="/visual" element={<VisualPage />} />
    </Routes>
  );
}

export default App;
