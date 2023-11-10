import React from 'react';
import './OopsieTracker.css'; // Import the CSS styling

const OopsieTracker = ({ oopsieData }) => {
    // Assuming oopsieData is an array of player objects with defeat or losing streak details

    return (
        <div className="oopsie-container">
            <h1>Oopsie Tracker</h1>

            <div className="oopsie-list">
                {oopsieData.map((player, index) => (
                    <div key={index} className="player-oopsie">
                        <h2>{player.name}</h2>
                        <p>Defeats: {player.defeats}</p>
                        <p>Losing Streak: {player.losingStreak}</p>
                        {/* Include other relevant details */}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default OopsieTracker;
