import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import './profile.css';

const Profile = () => {
    const { playerTag: urlPlayerTag } = useParams();
    const [playerData, setPlayerData] = useState(null);
    const [playerStats, setPlayerStats] = useState(null);
    const [recentBattles, setRecentBattles] = useState(null);
    const [activeTab, setActiveTab] = useState('brawlers');
    const [statsViewType, setStatsViewType] = useState('brawlers');
    const [expandedSections, setExpandedSections] = useState({});
    const [profileExpandedBattles, setProfileExpandedBattles] = useState({});

    const lastActive = playerStats ? new Date(playerStats.lastActive).toLocaleString() : "Loading...";



    // Function to toggle battle card expansion
    const toggleBattle = (index) => {
        setProfileExpandedBattles(prev => {
            const newExpanded = { ...prev };
            newExpanded[index] = !newExpanded[index];
            console.log(`Toggling battle card at index ${index}:`, newExpanded);
            return newExpanded;
        });
    };
    
    


    const getProfilePic = (playerName) => {
        switch(playerName) {
            case 'Taminator':
                return '/justin.png';
            case 'CoffeeCreamer':
                return '/varun.png';
            case 'andrewsomeister':
                return '/andrew.png';
            default:
                return 'default-profile-pic.jpg'; // Fallback to a default picture
        }
    }

    const profilePicUrl = getProfilePic(playerData?.name);
    console.log('pic url: ')
    console.log(profilePicUrl)

    const toggleSection = (key) => {
        setExpandedSections(prev => {
            const newState = { ...prev };
            newState[key] = !newState[key];
            return newState;
        });
    };
    

    useEffect(() => {
        if (!urlPlayerTag) {
            console.log('Player tag not provided in URL.');
            return;
        }

        const formattedPlayerTag = encodeURIComponent(urlPlayerTag.startsWith('#') ? urlPlayerTag : `#${urlPlayerTag}`);
        
        // Fetch player data
        axios.get(`http://localhost:3001/api/players/${formattedPlayerTag}`)
            .then(response => setPlayerData(response.data))
            .catch(error => console.error('Error fetching player data:', error));

        // Fetch player stats
        axios.get(`http://localhost:3001/api/players/${formattedPlayerTag}/stats`)
            .then(response => setPlayerStats(response.data))
            .catch(error => console.error('Error fetching player stats:', error));

        // Fetch recent battles
        axios.get(`http://localhost:3001/api/players/${formattedPlayerTag}/recent-battles`)
            .then(response => setRecentBattles(response.data))
            .catch(error => console.error('Error fetching recent battles:', error));
    }, [urlPlayerTag]);

    // Function to display stats for each game mode
    const displayGameModeStats = (gameModes) => {
        return Object.entries(gameModes).map(([modeName, stats], index) => (
            <div key={index}>
                <h4>{modeName}</h4>
                <p>Wins: {stats.wins}</p>
                <p>Losses: {stats.losses}</p>
                <p>Win Rate: {stats.winRate}</p>
            </div>
        ));
    };

    const displayPlayerStats = (playerStats) => {
        let organizedStats = {};
        let holisticStats = {};
    
        // Organize stats by brawlers or game modes and calculate holistic stats
        Object.entries(playerStats.brawlerStats || {}).forEach(([brawlerName, gameModes]) => {
            Object.entries(gameModes).forEach(([modeName, stats]) => {
                const wins = stats.wins || 0;
                const losses = stats.losses || 0;
    
                let key = statsViewType === 'brawlers' ? brawlerName : modeName;
                if (!organizedStats[key]) {
                    organizedStats[key] = [];
                    holisticStats[key] = { wins: 0, losses: 0 };
                }
                organizedStats[key].push({ brawlerName, modeName, wins, losses });
                holisticStats[key].wins += wins;
                holisticStats[key].losses += losses;
            });
        });
    
        return Object.entries(organizedStats).map(([key, stats], index) => (
            <div key={index} className="stats-group">
                <h3 onClick={() => toggleSection(key)}>{key}</h3>
                <div className="holistic-stats">
                    <p>Total Wins: {holisticStats[key].wins}</p>
                    <p>Total Losses: {holisticStats[key].losses}</p>
                    <p>Total Win Rate: {((holisticStats[key].wins / (holisticStats[key].wins + holisticStats[key].losses)) * 100).toFixed(2)}%</p>
                </div>
                {expandedSections[key] && stats.map((stat, statIndex) => (
                    <div key={statIndex} className="stat">
                        {statsViewType === 'gameModes' && <p>Brawler: {stat.brawlerName}</p>}
                        {statsViewType === 'brawlers' && <p>Mode: {stat.modeName}</p>}
                        <p>Wins: {stat.wins}</p>
                        <p>Losses: {stat.losses}</p>
                        <p>Win Rate: {((stat.wins / (stat.wins + stat.losses)) * 100).toFixed(2)}%</p>
                    </div>
                ))}
            </div>
        ));
    };
    
    

    const displayGameModeStatsOrganized = (playerStats) => {
        // Aggregate stats by game modes
        let gameModeStats = {};
        Object.entries(playerStats.brawlerStats || {}).forEach(([brawlerName, gameModes]) => {
            Object.entries(gameModes).forEach(([modeName, stats]) => {
                if (!gameModeStats[modeName]) {
                    gameModeStats[modeName] = { wins: 0, losses: 0, winRate: 0, count: 0 };
                }
                gameModeStats[modeName].wins += stats.wins;
                gameModeStats[modeName].losses += stats.losses;
                gameModeStats[modeName].count += 1;
            });
        });
    
        // Calculate win rates
        Object.values(displayGameModeStatsOrganized).forEach(mode => {
            mode.winRate = ((mode.wins / (mode.wins + mode.losses)) * 100).toFixed(2) + '%';
        });
    
        return (
            <div className="game-mode-stats">
                {Object.entries(gameModeStats).map(([modeName, stats], index) => (
                    <div key={index} className="game-mode-stat">
                        <h3>{modeName}</h3>
                        <p>Wins: {stats.wins}</p>
                        <p>Losses: {stats.losses}</p>
                        <p>Win Rate: {stats.winRate}</p>
                    </div>
                ))}
            </div>
        );
    };

    // Function to display stats for each brawler
    const displayBrawlerStats = (brawlerStats) => {
        return Object.entries(brawlerStats || {}).map(([brawlerName, gameModes], index) => (
            <div key={index}>
                <h3>{brawlerName}</h3>
                {displayGameModeStats(gameModes)}
            </div>
        ));
    };

    // Function to display recent battles
    const displayRecentBattles = (battles) => {
        return battles.map((battle, index) => (
            <div key={index} className={`battle-card ${battle.outcome} ${profileExpandedBattles[index] ? 'expanded' : ''}`}
            onClick={() => toggleBattle(index)}>
                <h3>Battle on {new Date(battle.time).toLocaleDateString()}</h3>
                <p>Mode: {battle.event.mode}</p>
                <p>Map: {battle.event.map}</p>
                <p>Outcome: {battle.outcome}</p>
                {profileExpandedBattles[index] && (
                    <div className="battle-details">
                        {Array.isArray(battle.teams) && battle.teams.map((team, teamIndex) => (
                            <div key={teamIndex} className="team">
                                <h4>Team {teamIndex + 1}</h4>
                                {team.map((player, playerIndex) => (
                                    <div key={playerIndex} className="player-info">
                                        <p>Player: {player.name}</p>
                                        <p>Brawler: {player.brawler.name}</p>
                                        <p>Trophies: {player.brawler.trophies}</p>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        ));
    };
    


    if (!playerData) {
        return <div className="loading">Loading...</div>;
    }

    console.log('ting: ')
    console.log(profilePicUrl)
    return (
        <div className="profile">
            <div className="profile-header">
                <img src={profilePicUrl} alt={`${playerData?.name}'s profile`} className="profile-pic" />
                <h1>Player Profile: {playerData?.name}</h1>
                <p className="trophies">Trophies: {playerData?.trophies}</p>
                <p className="last-active">Last Active: {lastActive}</p>
            </div>

            <div className="tabs">
                <div className={`tab ${activeTab === 'brawlers' ? 'active' : ''}`} onClick={() => setActiveTab('brawlers')}>Brawlers</div>
                <div className={`tab ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>Player Stats</div>
                <div className={`tab ${activeTab === 'battles' ? 'active' : ''}`} onClick={() => setActiveTab('battles')}>Recent Battles</div>
            </div>

            {activeTab === 'brawlers' && (
                <div className="tab-content brawlers active">
                    <h2>Brawlers:</h2>
                    <div className="brawler-list">
                        {playerData.brawlers && playerData.brawlers.map((brawler, index) => (
                            <div key={index} className="brawler">
                                <h3>{brawler.name}</h3>
                                <p>Trophies: {brawler.trophies}</p>
                                <p>Power: {brawler.power}</p>
                                <p>Rank: {brawler.rank}</p>
                                <p>Gadgets: {brawler.gadgets.map(gadget => gadget.name).join(', ') || 'None'}</p>
                                <p>Star Powers: {brawler.starPowers.map(sp => sp.name).join(', ') || 'None'}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'stats' && (
                <div className="tab-content stats active">
                    <h2>Player Stats:</h2>
                    <div className="stats-view-toggle">
                        <button onClick={() => setStatsViewType('brawlers')}>By Brawlers</button>
                        <button onClick={() => setStatsViewType('gameModes')}>By Game Modes</button>
                    </div>
                    {playerStats ? (
                        <div className="stats-grid">
                            {displayPlayerStats(playerStats)}
                        </div>
                    ) : (
                        <p>Loading player stats...</p>
                    )}
                </div>
            )}

            {activeTab === 'battles' && (
                <div className="tab-content recent-battles active">
                    <h2>Recent Battles:</h2>
                    {recentBattles ? (
                        displayRecentBattles(recentBattles)
                    ) : (
                        <p>Loading recent battles...</p>
                    )}
                </div>
            )}
        </div>
    );
};

export default Profile;
