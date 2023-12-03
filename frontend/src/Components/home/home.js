import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './home.css';

const tagToUsernameMap = {
  "#PJYJGGCG": "CoffeeCreamer",
  "#YCO98JGU": "andrewsomeister",
  "#UR80QUY": "Taminator"
};

const Home = () => {
    const [quickStats, setQuickStats] = useState(null);
    const [biggestSweat, setBiggestSweat] = useState(null); // Changed to null
    const [topBrawlers, setTopBrawlers] = useState([]);
    const [expandedBattles, setExpandedBattles] = useState({
        'Solo Queue': {},
        'Queue with the Boys': {}
    });

    useEffect(() => {
        axios.get('/api/quick-stats')
            .then(response => {
                setQuickStats(response.data);
    
                // Initialize expandedBattles state for each battle
                const newExpandedBattles = {};
                Object.keys(response.data.groupedBattles).forEach(category => {
                    newExpandedBattles[category] = {};
                    response.data.groupedBattles[category].forEach((_, index) => {
                        newExpandedBattles[category][index] = true;
                    });
                });
    
                setExpandedBattles(newExpandedBattles);
            })
            .catch(error => {
                console.error('Error fetching quick stats', error);
            });
    }, []);

    useEffect(() => {
        if (quickStats && quickStats.groupedBattles['Solo Queue']) {
            calculateBiggestSweat(quickStats.groupedBattles['Solo Queue']);
            setTopBrawlers(quickStats.topBrawlers);
        }
    }, [quickStats]);

    const calculateBiggestSweat = (soloBattles) => {
        let sweatCount = { 'CoffeeCreamer': 0, 'andrewsomeister': 0, 'Taminator': 0 };
        soloBattles.forEach(battle => {
            if (battle.summary.includes('CoffeeCreamer')) sweatCount['CoffeeCreamer']++;
            if (battle.summary.includes('andrewsomeister')) sweatCount['andrewsomeister']++;
            if (battle.summary.includes('Taminator')) sweatCount['Taminator']++;
        });
    
        let maxCount = 0;
        let sweat = null;
        Object.entries(sweatCount).forEach(([player, count]) => {
            if (count > maxCount) {
                maxCount = count;
                sweat = player;
            }
        });
    
        if (!sweat) { // In case there's a tie or no matches
            sweat = 'No clear biggest sweat, whole squad equally buns';
        }
        
        setBiggestSweat(sweat);
    };

    const formatDateTime = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleString();
    };

    const getPlayerUsername = (tag) => {
        return tagToUsernameMap[tag] || tag;
    };

    const toggleBattleDetails = (index, category) => {
        console.log("Before toggle:", expandedBattles[category][index]); // Log before toggle
    
        setExpandedBattles(prevState => {
            const newCategoryState = { ...prevState[category] };
            newCategoryState[index] = !newCategoryState[index];
            console.log(`Toggled battle index ${index} in category ${category}:`, newCategoryState[index]);
    
            console.log("After toggle:", newCategoryState[index]); // Log after toggle
            return {
                ...prevState,
                [category]: newCategoryState
            };
        });
    };
    

    const renderBattles = (battles, category) => {
        return battles.map((battle, index) => {
            console.log(`Rendering battle index ${index} in category ${category}:`, battle);
            console.log(`Is battle expanded? ${expandedBattles[category][index]}`);
            const outcomeClass = battle.outcome === 'victory' ? 'battle-win' : 'battle-loss';
    
            return (
                <li key={index} className={outcomeClass}>
                    <div className="battle-summary" onClick={() => toggleBattleDetails(index, category)}>
                        {battle.summary}
                    </div>

                    <div className={`battle-details ${expandedBattles[category][index] ? 'open' : ''}`}>

                        <ul>
                            <li>Brawler: {battle.details}</li>
                            <li>Mode: {battle.gameMode}</li>
                            <li>Outcome: {battle.outcome}</li>
                            <li>Time: {formatDateTime(battle.time)}</li>
                            {battle.starPlayer && <li>{battle.starPlayer}</li>}
                        </ul>
                    </div>
                </li>
            );
        });
    };

    return (
        <div className="home-container">
            <h1>Welcome to Brawl Metrics!</h1>
            <p>Your go-to platform for tracking CoffeeCreamer, Taminator, and andrewsomeister.</p>
    
            <div className="biggest-sweat">
                {biggestSweat && <p>{biggestSweat} is the biggest sweat of the day!</p>}
            </div>
    
            {quickStats && (
                <div className="stats-container">
                    <div className="column">
                        <h3>Current Trophy Count</h3>
                        <ul>
                            {quickStats.recentTrophyChanges?.map((change, index) => (
                                <li key={index}>{getPlayerUsername(change.playerInfo.tag)}: {change.playerInfo.trophies} trophies</li>
                            ))}
                        </ul>

                        <h3>Top Brawlers</h3>
                        <ul>
                            {topBrawlers.map((brawler, index) => (
                                <li key={index}>{brawler.name} ({brawler.playerName}): {brawler.trophies} trophies</li>
                            ))}
                        </ul>
                    </div>
    
                    <div className="column">
                        <h3>Recent Solo Queue</h3>
                        <ul>
                            {quickStats.groupedBattles['Solo Queue'] ? renderBattles(quickStats.groupedBattles['Solo Queue'], 'Solo Queue') : <p>No recent solo queue battles.</p>}
                        </ul>
                    </div>
    
                    <div className="column">
                        <h3>Recent Queue with the Boys</h3>
                        <ul>
                            {quickStats.groupedBattles['Queue with the Boys'] ? renderBattles(quickStats.groupedBattles['Queue with the Boys'], 'Queue with the Boys') : <p>No recent group queue battles.</p>}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Home;