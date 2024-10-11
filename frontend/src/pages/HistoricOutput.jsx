import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import Header from '../components/Header';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD8NZhB9CcpnGqITgLuHd4ZUHP0tAYcozw",
  authDomain: "crystalball-d10e4.firebaseapp.com",
  projectId: "crystalball-d10e4",
  storageBucket: "crystalball-d10e4.appspot.com",
  messagingSenderId: "688728391370",
  appId: "1:688728391370:web:58b1f2f19c91b2bb4abe33",
  measurementId: "G-92K77WL5BY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function HistoricOutput() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const docRef = doc(db, "queries", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setData(docSnap.data());
        } else {
          console.log("No such document!");
        }
      } catch (error) {
        console.error("Error fetching document:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!data) {
    return <div>No data found for this query.</div>;
  }

  return (
    <div className="flex flex-col items-center justify-start min-h-screen pt-20">
        <Header />

        {data && (
        <div className="w-full max-w-4xl">
            <div className="flex flex-col items-start mb-6">
                <h1 className="text-2xl font-bold mb-3">{data.selectedStock} impact if {data.searchValue}</h1>
                <div className="flex flex-wrap gap-2 mb-3">
                    <span className="text-gray-500 text-sm">{data.selectedDate}</span>
                </div>
            </div>

            <div className="mb-8 border border-gray-300 rounded-lg shadow-sm bg-white p-6">
                <p className="text-4xl mt-4 mb-6 text-left">
                    Your stock is expected to <span className={data.summaryResponse.market_prediction === 'BULLISH' ? 'text-green-500' : data.summaryResponse.market_prediction === 'BEARISH' ? 'text-red-500' : 'text-gray-500'}>{data.summaryResponse.market_prediction}</span> {data.summaryResponse.market_prediction === 'BULLISH' ? '⬆️' : data.summaryResponse.market_prediction === 'BEARISH' ? '⬇️' : ''}
                </p>
                <p className="text-left text-gray-500">{data.summaryResponse.summary}</p>
                <div className="flex gap-2">
                    <div className={`p-4 border border-gray-300 rounded-lg shadow-sm bg-red-100`} style={{ width: `${data.sellPercent}%` }}></div>
                    <div className={`p-4 border border-gray-300 rounded-lg shadow-sm bg-gray-100`} style={{ width: `${data.holdPercent}%` }}></div>
                    <div className={`p-4 border border-gray-300 rounded-lg shadow-sm bg-green-100`} style={{ width: `${data.buyPercent}%` }}></div>
                </div>
                <p className="text-lg font-semibold text-gray-700 mt-6 mb-2 text-left">Weighted directions</p>
                <div className=" flex">
                    <div className="text-left mr-8">
                    <p className="text-lg font-semibold text-gray-500">Sell</p>
                    <p className="text-2xl">⬇️ {data.sellPercent}%</p>
                    </div>
                    <div className="text-left mr-8">
                    <p className="text-lg font-semibold text-gray-500">Hold</p>
                    <p className="text-2xl">😐 {data.holdPercent}%</p>
                    </div>
                    <div className="text-left">
                    <p className="text-lg font-semibold text-gray-500">Buy</p>
                    <p className="text-2xl">⬆️ {data.buyPercent}%</p>
                    </div>
                </div>
            </div>

            <div className="mb-6">
                <h2 className="text-2xl font-semibold mb-2 text-left">Source Sample Set</h2>
                <p className="text-sm text-gray-500 mb-4 text-left">Showing {data.personaResponses.length}</p>
                <div className="flex overflow-x-scroll space-x-4">
                    {data.personaResponses.map((source, index) => (
                        <div key={index} className="flex-shrink-0 flex-nowrap p-4 border border-gray-300 rounded-lg shadow-sm w-[400px]">
                            <h3 className="text-lg font-semibold text-left ">{source.name}</h3>
                            <p className="text-sm text-gray-500 mb-4 text-left">{source.subcategory} - {source.category}</p>
                            <p className="mb-2 text-left"><strong>Direction:</strong> <span className={source.direction === 'BUY' ? 'text-green-500' : source.direction === 'SELL' ? 'text-red-500' : 'text-gray-500'}>{source.direction}</span></p>
                            <p className="mb-2 text-left"><strong>Strength:</strong> {source.strength}</p>
                            <p className="mb-2 text-left"><strong>Rationale:</strong> {source.rationale}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mb-8">
                <h2 className="text-2xl font-semibold mb-2 text-left">Investor Rationale</h2>
                <div className="mb-4">
                    <h3 className="text-lg font-semibold text-left border-b border-gray-300 pt-2">Sell Themes</h3>
                    <p className="text-left mt-2">{data.summaryResponse.sell_summary}</p>
                </div>
                <div className="mb-4">
                    <h3 className="text-lg font-semibold text-left border-b border-gray-300 pt-2">Buy Themes</h3>
                    <p className="text-left mt-2">{data.summaryResponse.buy_summary}</p>
                </div>
                    <div className="mb-4">
                    <h3 className="text-lg font-semibold text-left border-b border-gray-300 pt-2">Hold Themes</h3>
                    <p className="text-left mt-2">{data.summaryResponse.hold_summary}</p>
                </div>
            </div>
          </div>
        )}
    </div>
  );
}

export default HistoricOutput;
