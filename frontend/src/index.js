import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './index.css';
import App from './App';
import Home from './Components/home/home';
import Profile from './Components/profile/profile';
import Navbar from './Components/navbar/navbar';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Router>
      <Navbar /> {/* Navbar is included here */}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/profile/:playerTag" element={<Profile />} /> {/* Use `element` instead of `component` */}
        {/* Add other routes as needed */}
      </Routes>
    </Router>
  </React.StrictMode>
);

reportWebVitals();
