import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';

import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore, collection, addDoc } from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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
const analytics = getAnalytics(app);
const auth = getAuth();
const db = getFirestore(app);


function Output() {

    const location = useLocation();
    const { searchValue, selectedStock, selectedDate } = location.state || {};

    const [personasGenerated, setPersonasGenerated] = useState(false);
    const [personaResponses, setPersonaResponses] = useState([]);

    const [summaryResult, setSummaryResult] = useState(null);
    
    const [aggregatedResponses, setAggregatedResponses] = useState({})
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const signInUser = async () => {
            try {
                const user = auth.currentUser;
                console.log("User: ", user);
                if (!user) {
                    await signInAnonymously(auth);
                    console.log("User signed in anonymously");
                } else {
                    console.log("User already signed in");
                }
            } catch (error) {
                console.error("Error signing in anonymously:", error);
            }
        };

        signInUser();
    }, []);

    async function downloadCSV() {
      try {
        const response = await fetch('https://crystalball-2sp6.onrender.com/download_csv');

        if (response.ok) {
          const csvContent = await response.text();
          console.log("CSV content: ", csvContent);

          // Parse CSV content
          function parseCSVRow(row) {
            const result = [];
            let insideQuotes = false;
            let currentValue = '';
            
            for (let char of row) {
              if (char === '"') {
                insideQuotes = !insideQuotes;
              } else if (char === ',' && !insideQuotes) {
                result.push(currentValue.trim());
                currentValue = '';
              } else {
                currentValue += char;
              }
            }
            result.push(currentValue.trim());
            return result;
          }

          const rows = csvContent.split('\n').map(parseCSVRow);
          console.log("Parsed CSV rows: ", rows);

          // Convert CSV rows to objects and update personaResponses
          const headers = rows[0];
          const data = rows.slice(1).map((row, rowIndex) => {
            let obj = {};
            row.forEach((cell, index) => {
              obj[headers[index]] = cell;
            });
            // Parse llmResponse
            if (obj.llmResponse) {
              try {
                // Use regex to extract values directly
                const directionMatch = obj.llmResponse.match(/'direction':\s*<Direction\.(\w+):\s*'(\w+)'>/);
                const strengthMatch = obj.llmResponse.match(/'strength':\s*([\d.]+)/);
                const rationaleMatch = obj.llmResponse.match(/'rationale':\s*'([^']*)'/);
                
                obj.direction = directionMatch ? directionMatch[2] : 'N/A';
                obj.strength = strengthMatch ? parseFloat(strengthMatch[1]) : 0;
                obj.rationale = rationaleMatch ? rationaleMatch[1] : 'Error parsing response';
                
                // Parse weight
                obj.weight = parseFloat(obj.weight.replace('%', '')) / 100;
              } catch (e) {
                console.error(`Error parsing row ${rowIndex + 2}:`, e);
                console.log("Problematic row:", obj);
                
                obj.direction = 'N/A';
                obj.strength = 0;
                obj.rationale = 'Error parsing response';
                obj.weight = 0;
              }
            }
            return obj;
          });

          console.log("Persona responses: ", data);

          // Parse for only valid responses
          const validResponses = data.filter(response => 
            response && 
            response.direction && 
            ['SELL', 'BUY', 'HOLD'].includes(response.direction.toUpperCase()) &&
            !response.llmResponse.includes("Error processing response")
          );

          console.log("Valid responses: ", validResponses);
          setPersonaResponses(validResponses);


          // Calculate percentages for buy, sell, and hold

          // Initialize accumulators for each direction
          let weightedSell = 0;
          let weightedBuy = 0;
          let weightedHold = 0;
          let totalWeight = 0;

          validResponses.forEach(response => {
            const direction = response.direction.toUpperCase();
            const weight = response.weight;

            totalWeight += weight;

            if (direction === 'SELL') {
              weightedSell += weight;
            } else if (direction === 'BUY') {
              weightedBuy += weight;
            } else if (direction === 'HOLD') {
              weightedHold += weight;
            }
          });

          if (totalWeight > 0) {
            const sellPercent = Math.round((weightedSell / totalWeight) * 100);
            const buyPercent = Math.round((weightedBuy / totalWeight) * 100);
            const holdPercent = Math.round((weightedHold / totalWeight) * 100);

            console.log("Aggregated weighted responses: ", {
              sell_percent: sellPercent,
              buy_percent: buyPercent,
              hold_percent: holdPercent
            });

            setAggregatedResponses({
              sell_percent: sellPercent,
              buy_percent: buyPercent,
              hold_percent: holdPercent
            });

            return {validResponses, sellPercent, buyPercent, holdPercent};
          } else {
            console.log("No valid responses found");
          }


          
        } else {
          console.error("Failed to download CSV");
        }
      } catch (error) {
        console.error("Error while downloading CSV", error);
      }
    }
    
    const surveyAgents = async (mode) => {
      setIsLoading(true);
      try {
        const endpoint = mode === 'lite' ? 'processAgentsLite' : 'processAgents';
        const response = await axios.post(`https://crystalball-2sp6.onrender.com/${endpoint}`, {
          posed_question: searchValue,
          instrument: selectedStock,
          date: selectedDate,
        });

        console.log(response.data);

        const CSVResponse = await downloadCSV();
        const summaryResponse = await summarizeResponses();

        // Push data to Firebase
        const user = auth.currentUser;
        if (user) {
          try {
            const docRef = await addDoc(collection(db, "queries"), {
              created_at: new Date(),
              userID: user.uid,
              searchValue,
              selectedStock,
              selectedDate,
              personaResponses: CSVResponse.validResponses,
              summaryResponse,
              sellPercent: CSVResponse.sellPercent,
              buyPercent: CSVResponse.buyPercent,
              holdPercent: CSVResponse.holdPercent,
              mode: mode
            });
            console.log("Document written with ID: ", docRef.id);
          } catch (e) {
            console.error("Error adding document: ", e);
          }
        } else {
          console.error("No user signed in");
        }

      } catch (error) {
        if (error.response) {
            console.error("Error surveying agents:", error.response.data);
        } else if (error.request) {
            console.error("No response received:", error.request);
        } else {
            console.error("Error setting up request:", error.message);
        }
      } finally {
        setIsLoading(false);
      }
    }

    const summarizeResponses = async () => {
      try {
        const response = await axios.post('https://crystalball-2sp6.onrender.com/getFinalReasoning', {
          posed_question: searchValue,
          instrument: selectedStock,
          date: selectedDate,
        });

        console.log("Final reasoning response: ", response.data);
        
        // Extract the JSON string from the final_reasoning property
        const jsonString = response.data.final_reasoning.replace(/```json\n|\n```/g, '');
        const parsedResult = JSON.parse(jsonString);

        console.log("Parsed result: ", parsedResult);
        
        // Update state with the parsed object
        setSummaryResult(parsedResult);
        setPersonasGenerated(true);
        return parsedResult;

      } catch (error) {
        console.error("Error getting final reasoning:", error);
        // Handle the error appropriately
      }
    }
  
    return (
    <div className="flex flex-col items-center justify-start min-h-screen pt-20">
      <Header />


      <div className="w-full max-w-4xl">
        <div className="flex flex-col items-start mb-6">
          <h1 className="text-2xl font-bold mb-3">{selectedStock} impact if {searchValue}</h1>
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="text-gray-500 text-sm">{selectedDate}</span>
          </div>
        </div>

        <div className="flex justify-center mt-4 mb-4 space-x-4">
          <button 
            className="px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:bg-blue-300"
            onClick={() => surveyAgents('lite')}
            disabled={isLoading}
          >
            Survey ~100 agents
          </button>
          <button 
            className="px-4 py-2 text-white bg-green-500 rounded-lg hover:bg-green-600 disabled:bg-green-300"
            onClick={() => surveyAgents('regular')}
            disabled={isLoading}
          >
            Survey ~1000 agents
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-2 mb-6">Note: Surveying 1000 agents will likely hit rate limit issues</p>

        {isLoading && (
          <div className="flex justify-center items-center mb-8">
            <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )}

        <div className="mb-8 border border-gray-300 rounded-lg shadow-sm bg-white p-6">
          <p className="text-4xl mt-4 mb-6 text-left">
            {summaryResult ? (
              <>
                Your stock is expected to <span className={summaryResult.market_prediction === 'BULLISH' ? 'text-green-500' : summaryResult.market_prediction === 'BEARISH' ? 'text-red-500' : 'text-gray-500'}>{summaryResult.market_prediction}</span> {summaryResult.market_prediction === 'BULLISH' ? '⬆️' : summaryResult.market_prediction === 'BEARISH' ? '⬇️' : ''}
              </>
            ) : (
              "Press survey agents button to generate results"
            )}
          </p>
          {summaryResult && (
            <>
              <p className="text-left text-gray-500">{summaryResult.summary}</p>
              <div className="flex gap-2">
                <div className={`p-4 border border-gray-300 rounded-lg shadow-sm bg-red-100`} style={{ width: `${aggregatedResponses.sell_percent}%` }}></div>
                <div className={`p-4 border border-gray-300 rounded-lg shadow-sm bg-gray-100`} style={{ width: `${aggregatedResponses.hold_percent}%` }}></div>
                <div className={`p-4 border border-gray-300 rounded-lg shadow-sm bg-green-100`} style={{ width: `${aggregatedResponses.buy_percent}%` }}></div>
              </div>
              <p className="text-lg font-semibold text-gray-700 mt-6 mb-2 text-left">Weighted directions</p>
              <div className="flex">
                <div className="text-left mr-8">
                  <p className="text-lg font-semibold text-gray-500">Sell</p>
                  <p className="text-2xl">⬇️ {aggregatedResponses.sell_percent}%</p>
                </div>
                <div className="text-left mr-8">
                  <p className="text-lg font-semibold text-gray-500">Hold</p>
                  <p className="text-2xl">😐 {aggregatedResponses.hold_percent}%</p>
                </div>
                <div className="text-left">
                  <p className="text-lg font-semibold text-gray-500">Buy</p>
                  <p className="text-2xl">⬆️ {aggregatedResponses.buy_percent}%</p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="mb-6">
          <h2 className="text-2xl font-semibold mb-2 text-left">Source Sample Set</h2>
          <p className="text-sm text-gray-500 mb-4 text-left">Showing {personaResponses.length}</p>
          <div className="flex overflow-x-scroll space-x-4">
            {personaResponses.map((source, index) => (
              <div key={index} className="flex-shrink-0 flex-nowrap p-4 border border-gray-300 rounded-lg shadow-sm w-[400px]">
                <h3 className="text-lg font-semibold text-left mb-2">{source.name}</h3>
                <p className="text-sm text-gray-500 mb-4 text-left">{source.subcategory} - {source.category}</p>
                <p className="mb-2 text-left"><strong>Direction:</strong> <span className={source.direction === 'BUY' ? 'text-green-500' : source.direction === 'SELL' ? 'text-red-500' : 'text-gray-500'}>{source.direction}</span></p>
                <p className="mb-2 text-left"><strong>Strength:</strong> {source.strength}</p>
                <p className="mb-2 text-left"><strong>Rationale:</strong> {source.rationale}</p>
              </div>
            ))}
          </div>
        </div>

        {summaryResult && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-2 text-left">Investor Rationale</h2>
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-left border-b border-gray-300 pt-2">Sell Themes</h3>
              <p className="text-left mt-2">{summaryResult.sell_summary}</p>
            </div>
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-left border-b border-gray-300 pt-2">Buy Themes</h3>
              <p className="text-left mt-2">{summaryResult.buy_summary}</p>
            </div>
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-left border-b border-gray-300 pt-2">Hold Themes</h3>
              <p className="text-left mt-2">{summaryResult.hold_summary}</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default Output;