import React from 'react';
import './MVP.css'; // Import the CSS styling

const MVPPage = ({ mvpData, onNavigate }) => {
    // Assuming mvpData is an object containing MVP's information and onNavigate is a function to handle navigation

    return (
        <div className="mvp-container">
            <h1>MVP of the Week/Month</h1>

            <div className="mvp-details">
                <h2>{mvpData.name}</h2>
                {/* Include more performance metrics as needed */}
                <p>Trophies: {mvpData.trophies}</p>
                <p>Win Rate: {mvpData.winRate}%</p>
                {/* Add other details and metrics */}
            </div>

            <button onClick={() => onNavigate('prev')}>Previous MVP</button>
            <button onClick={() => onNavigate('next')}>Next MVP</button>
        </div>
    );
}

export default MVPPage;
