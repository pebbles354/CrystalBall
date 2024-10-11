import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getFirestore, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import Header from '../components/Header';

// Your web app's Firebase configuration
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

function QueryList() {
  const [queries, setQueries] = useState([]);

  useEffect(() => {
    const fetchQueries = async () => {
      const q = query(collection(db, "queries"), orderBy("created_at", "desc"));
      const querySnapshot = await getDocs(q);
      const queriesList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setQueries(queriesList);
    };

    fetchQueries();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
        <Header />
      <h1 className="text-3xl font-bold mb-6">Recent Searches</h1>
      <ul className="space-y-4">
        {queries.map((query) => (
          <li key={query.id} className="border-b pb-4">
            <Link 
              to={`/output/${query.id}`} 
              className="text-blue-500 hover:text-blue-700"
            >
              {query.searchValue}
            </Link>
            <p className="text-sm text-gray-500">
              {query.created_at.toDate().toLocaleString()}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default QueryList;
