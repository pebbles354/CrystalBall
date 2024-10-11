import React, {useState, useEffect} from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';

function Output() {

    const location = useLocation();
    const { searchValue, selectedStock, selectedDate } = location.state || {};

    const [personasGenerated, setPersonasGenerated] = useState(false);
    const [personaResponses, setPersonaResponses] = useState([]);

    const [summaryResult, setSummaryResult] = useState(null);
    
    const [aggregatedResponses, setAggregatedResponses] = useState({})

      // const [data, setData] = useState({
      //   prompt: searchValue,
      //   date: selectedDate,
      //   stock: selectedStock,
      //   result: { trend: "", decrease: 0, neutral: 0, increase: 0 },
      //   themes: [],
      //   sources: []
      // });


    async function downloadCSV() {
      try {
        const response = await fetch('http://localhost:8000/download_csv');

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
              } catch (e) {
                console.error(`Error parsing llmResponse for row ${rowIndex + 2}:`, e);
                console.log("Problematic llmResponse:", obj.llmResponse);
                
                obj.direction = 'N/A';
                obj.strength = 0;
                obj.rationale = 'Error parsing response';
              }
            }
            return obj;
          });

          console.log("Persona responses: ", data);


          // Calculate percentages for buy, sell, and hold
          const validResponses = data.filter(response => 
            response && response.direction && ['SELL', 'BUY', 'HOLD'].includes(response.direction.toUpperCase())
          );

          console.log("Valid responses: ", validResponses);

          setPersonaResponses(validResponses);

          const totalResponses = validResponses.length;
          
          if (totalResponses > 0) {
            const sellCount = validResponses.filter(r => r.direction.toUpperCase() === 'SELL').length;
            const buyCount = validResponses.filter(r => r.direction.toUpperCase() === 'BUY').length;
            const holdCount = validResponses.filter(r => r.direction.toUpperCase() === 'HOLD').length;

            const sellPercent = Math.round((sellCount / totalResponses) * 100);
            const buyPercent = Math.round((buyCount / totalResponses) * 100);
            const holdPercent = Math.round((holdCount / totalResponses) * 100);


            console.log("Aggregated responses: ", {
              sell_percent: sellPercent,
              buy_percent: buyPercent,
              hold_percent: holdPercent
            });

            setAggregatedResponses({
              sell_percent: sellPercent,
              buy_percent: buyPercent,
              hold_percent: holdPercent
            });
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
    

    const surveyAgents = async () => {
      try {
        const response = await axios.post('http://localhost:8000/processAgents', {
          posed_question: searchValue,          // Ensure this matches the 'prompt' field in EventContext
          instrument: selectedStock,  // Ensure this matches the 'selectedStock' field
          date: selectedDate,    // Ensure this matches the 'selectedDate' field
          // Add other fields if EventContext has more
        });

        console.log(response.data);

        await downloadCSV(); // Call downloadCSV after surveying agents
        await summarizeResponses(); // Automatically call summarizeResponses after downloading CSV

      } catch (error) {
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.error("Error surveying agents:", error.response.data);
        } else if (error.request) {
            // The request was made but no response was received
            console.error("No response received:", error.request);
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error("Error setting up request:", error.message);
        }
      }
    }



    const summarizeResponses = async () => {
      try {
        const response = await axios.post('http://localhost:8000/getFinalReasoning', {
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
        setPersonasGenerated(true); // Assuming you want to show results after summarizing
      } catch (error) {
        console.error("Error getting final reasoning:", error);
        // Handle the error appropriately
      }
    }
  
  
    return (
    <div className="flex flex-col items-center justify-start min-h-screen pt-20">
      <div className="w-full max-w-4xl">
        <div className="flex flex-col items-start mb-6">
          <h1 className="text-2xl font-bold mb-3">{selectedStock} impact if {searchValue}</h1>
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="text-gray-500 text-sm">{selectedDate}</span>
          </div>
        </div>

        <div className="flex justify-center mt-4  mb-4 space-x-4">
          <button 
            className="px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600"
            onClick={surveyAgents}
          >
            Survey Agents
          </button>
        </div>

        <div className="mb-8 border border-gray-300 rounded-lg shadow-sm bg-white p-6">
          {/* <h2 className="text-xl font-semibold mb-2 text-left">Result</h2> */}
          <p className="text-4xl mt-4 mb-6 text-left">
            {summaryResult ? (
              <>
                Your stock is expected to <span className={summaryResult.market_prediction === 'BULLISH' ? 'text-green-500' : summaryResult.market_prediction === 'BEARISH' ? 'text-red-500' : 'text-gray-500'}>{summaryResult.market_prediction}</span> {summaryResult.market_prediction === 'BULLISH' ? '⬆️' : summaryResult.market_prediction === 'BEARISH' ? '⬇️' : ''}
              </>
            ) : (
              "No results generated yet"
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
              <div className="mt-6 flex">
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
                <h3 className="text-lg font-semibold text-left mb-8">{source.name}</h3>
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