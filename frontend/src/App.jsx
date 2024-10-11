import './App.css'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Output from './pages/Output';
import QueryList from './pages/QueryList';
import HistoricOutput from './pages/HistoricOutput';
import { Analytics } from "@vercel/analytics/react"


function App() {

  return (
    <>
      <Analytics />
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/output" element={<Output />} />
          <Route path="/previous" element={<QueryList />} />
          <Route path="/output/:id" element={<HistoricOutput />} />
          {/* You can add more routes here for additional pages */}
        </Routes>
      </Router>
    </>
  )
}

export default App
