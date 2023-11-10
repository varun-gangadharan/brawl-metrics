// src/components/Home.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import styled from 'styled-components';
import './home.css'; // Import the CSS styling

const Home = () => {
  return (
    
      <div className="home-container">
          
          <h1>Welcome to Brawl Metrics!</h1>
          <p>Your go-to platform for tracking CoffeeCreamer, Taminator, and andrewsomeister.</p>
          
          <div className="stats-container">
              <h2>Quick Stats</h2>
              {/* Display quick stats here */}
          </div>

          <div className="search-bar">
              <input type="text" placeholder="Search players by tag..." />
              <button>Search</button>
          </div>
      </div>
  );
}

export default Home;
