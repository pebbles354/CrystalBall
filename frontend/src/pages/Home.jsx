// Home.js
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import CrystalBall from '../assets/CrystalBall.png'; // Assuming the image is in the assets folder
import Header from '../components/Header';

function formatDateToYYYYMMDD(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // getMonth() is zero-indexed, so we add 1
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

const today = new Date();
const formattedDate = formatDateToYYYYMMDD(today);

function Home() {
  const [searchValue, setSearchValue] = useState('');
  const [selectedDate, setSelectedDate] = useState(formattedDate);
  const [selectedStock, setSelectedStock] = useState('S&P 500');
  const navigate = useNavigate();


  function agentAnalysis(searchValue, selectedStock, selectedDate) {
    navigate('/output', { state: { searchValue, selectedStock, selectedDate } });
  }
  
  console.log(selectedDate);

  const handleLuckyClick = () => {
    const scenarios = [
      "Taylor announces a new tour",
      "Trump wins the 2024 election",
      "There's a tornado in Kansas",
      "Escalation of war in the Middle East"
    ];
    const randomScenario = scenarios[Math.floor(Math.random() * scenarios.length)];
    setSearchValue(randomScenario);
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen pt-20 relative">
      <Header />
      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center">
          <img src={CrystalBall} alt="Crystal Ball Logo" className="w-60 h-60" />
          {/* <h1 className="text-2xl mb-3">Crystal Ball</h1> */}
          <h1 className="text-l mb-6">Stock Predictions based on hypothetical events</h1>
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" d="M12.9 14.32a8 8 0 111.414-1.414l4.387 4.387a1 1 0 01-1.414 1.414l-4.387-4.387zM8 14a6 6 0 100-12 6 6 0 000 12z" clipRule="evenodd"></path>
              </svg>
            </div>
            <input
              type="text"
              className="w-full p-3 pl-10 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter a scenario of something that may happen in the world"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-center space-x-2 mt-4">
          <select
            className="p-1 border border-gray-300 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedStock}
            onChange={(e) => setSelectedStock(e.target.value)}
            disabled
          >
            <option value="S&P 500">S&P 500</option>
            <option value="NASDAQ">NASDAQ</option>
          </select>
          <input
            type="date"
            className="p-1 border border-gray-300 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
        <div className="flex justify-center mt-4 space-x-4">
          <button onClick={() => agentAnalysis(searchValue, selectedStock, selectedDate)} className="px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600">
            Read my [stocks] future
          </button>
          <button onClick={handleLuckyClick} className="px-4 py-2 text-white bg-gray-500 rounded-lg hover:bg-gray-600">
            I&apos;m feeling lucky
          </button>
        </div>
      </div>
    </div>
  );
}

export default Home;