import React from 'react';
import './leaderboard.css'; // Import the CSS styling

const Leaderboard = ({ leaderboardData }) => {
    // Assuming leaderboardData is an array of player objects
    return (
        <div className="leaderboard-container">
            <h1>Leaderboard</h1>
            <table>
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Player</th>
                        <th>Trophies</th>
                        {/* Add other columns as needed */}
                    </tr>
                </thead>
                <tbody>
                    {leaderboardData.map((player, index) => (
                        <tr key={player.id}>
                            <td>{index + 1}</td>
                            <td>{player.name}</td>
                            <td>{player.trophies}</td>
                            {/* Add other player details as needed */}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default Leaderboard;
