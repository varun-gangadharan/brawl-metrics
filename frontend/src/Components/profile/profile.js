import React from 'react';
import './profile.css'; // Import the CSS styling

const Profile = ({ playerData }) => {
    // Check if playerData is available
    if (!playerData) {
        return <div>Player data currently unavailable... Varun fucked something up</div>; // Or any other fallback UI
    }

    return (
        <div className="profile-container">
            <h1>Player Profile: {playerData.name}</h1>
            
            <div className="player-stats">
                {/* Display player statistics here */}
            </div>

            <div className="brawler-stats">
                <h2>Brawlers Stats</h2>
                {/* List of brawlers with win rates and usage frequency */}
            </div>

            <div className="recent-battles">
                <h2>Recent Battles</h2>
                {/* Recent battles section */}
            </div>
        </div>
    );
}

export default Profile;
