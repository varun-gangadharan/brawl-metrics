require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const app = express();
const port = 3001;

app.use(express.json());



const MONGO_URI = process.env.MONGO_URI;
const client = new MongoClient(MONGO_URI, { useUnifiedTopology: true });

async function connectToMongoDB() {
    try {
        await client.connect();
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('Failed to connect to MongoDB', error);
    }
}

connectToMongoDB().catch(console.error);

const tagToUsernameMap = {
    "#PJYJGGCG": "CoffeeCreamer",
    "#YCO98JGU": "andrewsomeister",
    "#UR80QUY": "Taminator"
};
const getPlayerUsername = (tag) => {
    return tagToUsernameMap[tag] || tag;
};

// Quick Stats Endpoint
app.get('/api/quick-stats', async (req, res) => {
    const tagsOfInterest = ['#PJYJGGCG', '#YCO98JGU', '#UR80QUY']; // Add the tags you are interested in
    let attemptCount = 0;
    const maxAttempts = 5;

    try {
        // Fetch the most recent trophy changes for all players
        const recentTrophyChanges = await client.db('brawlstars').collection('players')
            .find({}, { projection: { _id: 0, 'playerInfo.tag': 1, 'playerInfo.trophies': 1 } })
            .sort({ 'playerInfo.trophies': -1 })
            .limit(5)
            .toArray();

        let groups = { 'Solo Queue': [], 'Queue with the Boys': [] };
        let skip = 0;

        // Loop until an equal number of battles is obtained for both groups or a maximum of 5 each
        while (groups['Solo Queue'].length < 7 || groups['Queue with the Boys'].length < 7) {
            const recentBattles = await client.db('brawlstars').collection('battles')
                .find({}, { projection: { _id: 0, brawlerName: 1, event: 1, outcome: 1, time: 1, playerTag: 1, starPlayer: 1, teams: 1 } })
                .sort({ time: -1 })
                .limit(20)
                .skip(skip)
                .toArray();

            if (recentBattles.length === 0) {
                console.log(`No new battles found on attempt ${attemptCount + 1}`);
                attemptCount++;
                if (attemptCount >= maxAttempts) {
                    console.log("Max attempts reached. Exiting loop.");
                    break;
                }
                continue;
            }

            skip += 20;
            
            //console.log("Raw Recent Battles:", recentBattles);

            // Process the battles
            const processedBattles = recentBattles.map(battle => {
                try {
                    // Check if 'event' object exists
                    if (!battle.event) {
                        console.error('Battle with missing event:', battle);
                        return null;
                    }
    
                    const event = battle.event || {};
    
                    let playersInBattle = [];
                    let isVarunInBattle = false, isAndrewInBattle = false, isJustinInBattle = false;
                    
                    if (battle.teams) {
                        playersInBattle = battle.teams.flat().map(player => `${player.brawler.name} (${getPlayerUsername(player.tag)})`);
                        isVarunInBattle = battle.teams.some(team => team.some(player => player.tag === "#PJYJGGCG"));
                        isAndrewInBattle = battle.teams.some(team => team.some(player => player.tag === "#YCO98JGU"));
                        isJustinInBattle = battle.teams.some(team => team.some(player => player.tag === "#UR80QUY"));
                    } else {
                        // Handle solo showdown battles
                        const playerUsername = getPlayerUsername(battle.playerTag);
                        playersInBattle = [`${battle.brawlerName} (${playerUsername})`];
                        isVarunInBattle = battle.playerTag === "#PJYJGGCG";
                        isAndrewInBattle = battle.playerTag === "#YCO98JGU";
                        isJustinInBattle = battle.playerTag === "#UR80QUY";
                    }

                    let starPlayerName = 'No Star Player'; // Default value
                    if (battle.starPlayer && battle.starPlayer.name) {
                        if (['CoffeeCreamer', 'Taminator', 'andrewsomeister'].includes(battle.starPlayer.name)) {
                            starPlayerName = `Star Player: ${battle.starPlayer.name}`;
                        } else {
                            starPlayerName = "Star Player: rando";
                        }
                    }
    
                    return {
                        playersInBattle,
                        brawlerAndTag: `${battle.brawlerName} (${battle.playerTag})`,
                        event: battle.event, // Include the entire event object
                        outcome: battle.outcome,
                        time: battle.time,
                        playerTag: battle.playerTag,
                        isStarPlayer: starPlayerName,
                        playedWithVarun: isVarunInBattle,
                        playedWithAndrew: isAndrewInBattle,
                        playedWithJustin: isJustinInBattle
                    };
                } catch (error) {
                    console.error('Error in /api/quick-stats:', error.message);
                    res.status(500).json({ message: error.message });
                }
                
            }).filter(battle => battle != null); // Filter out null entries
            //console.log("Processed Battles:", processedBattles);
            const newGroups = groupBattlesByPlayers(processedBattles);

            const maxBattlesToShow = 10;
            groups['Solo Queue'] = [...groups['Solo Queue'], ...newGroups['Solo Queue']].slice(0, maxBattlesToShow);
            groups['Queue with the Boys'] = [...groups['Queue with the Boys'], ...newGroups['Queue with the Boys']].slice(0, maxBattlesToShow);

            console.log("Final Grouped Battles:", groups);

            // Check if the required number of battles is reached
            if (groups['Solo Queue'].length >= maxBattlesToShow && groups['Queue with the Boys'].length >= maxBattlesToShow) break;

        }

        // Combine brawlers from all players
        let combinedBrawlers = [];
        const playersData = await client.db('brawlstars').collection('players')
            .find({}, { projection: { _id: 0, 'playerInfo.name': 1, 'playerInfo.brawlers': 1 } })
            .toArray();

        playersData.forEach(player => {
            // Add player's name to each brawler
            player.playerInfo.brawlers.forEach(brawler => {
                brawler.playerName = player.playerInfo.name; // Store player's name with brawler
            });
            combinedBrawlers = combinedBrawlers.concat(player.playerInfo.brawlers);
        });

        // Sort brawlers by trophies
        combinedBrawlers.sort((a, b) => b.trophies - a.trophies);

        // Select top 7 brawlers
        const topBrawlers = combinedBrawlers.slice(0, 7);

        
        console.log("Grouped Battles:", groups);

        console.log("Final Grouped Battles:", groups);
        

        res.json({ recentTrophyChanges, groupedBattles: groups, topBrawlers });
    } catch (error) {
        console.error('Error in /api/quick-stats:', error.message);
        res.status(500).json({ message: error.message });
    }
});


function groupBattlesByPlayers(battles) {
    let groups = { 'Solo Queue': [], 'Queue with the Boys': [] };

    battles.forEach(battle => {
        console.log("Processing battle for grouping:", battle);
        if (!battle.event) {
            console.error('Battle with missing event object:', battle);
            return;
        }

        // Determine if the battle is a group battle or a solo queue
        let isGroupBattle = (battle.playedWithVarun && battle.playedWithAndrew) ||
                    (battle.playedWithVarun && battle.playedWithJustin) ||
                    (battle.playedWithAndrew && battle.playedWithJustin);

        const playerUsername = getPlayerUsername(battle.playerTag);
        const brawlerName = battle.brawlerAndTag.split(' ')[0];

        if (isGroupBattle) {
            // Use battle time as a unique identifier to group battles
            const battleKey = battle.time.toISOString(); // Adjust this based on your data format

            if (!groups['Queue with the Boys'][battleKey]) {
                groups['Queue with the Boys'][battleKey] = {
                    players: [],
                    gameMode: battle.event.mode,
                    outcome: battle.outcome,
                    time: battle.time,
                    starPlayer: battle.isStarPlayer ? `Star Player: ${battle.playerTag}` : 'No Star Player'
                };
            }

            // Add player details to the group battle
            groups['Queue with the Boys'][battleKey].players.push(`${brawlerName} (${playerUsername})`);
            
        } else {
            // Handle solo game
            groups['Solo Queue'].push({
                summary: `${playerUsername} `,
                details: `${brawlerName} (${playerUsername})`,
                gameMode: battle.event.mode,
                outcome: battle.outcome,
                time: battle.time,
                starPlayer: battle.isStarPlayer ? `Star Player: ${battle.playerTag}` : ''
            });
        }
    });
    // Convert grouped battles object to array
    groups['Queue with the Boys'] = Object.values(groups['Queue with the Boys']).map(groupedBattle => ({
        summary: `${groupedBattle.players.join(', ')}`,
        details: `Brawlers: ${groupedBattle.players.join(', ')}`,
        gameMode: groupedBattle.gameMode,
        outcome: groupedBattle.outcome,
        time: groupedBattle.time,
        starPlayer: groupedBattle.starPlayer
    }));

    return groups;
}





// Player Search by Tag Endpoint
app.get('/api/players/search/:tag', async (req, res) => {
    try {
        const playerData = await client.db('brawlstars').collection('players').findOne({ tag: req.params.tag });
        res.json(playerData);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Player Stats Endpoint
app.get('/api/players/:playerTag/stats', async (req, res) => {
    try {
        const playerStats = await client.db('brawlstars').collection('playerStats').findOne({ playerTag: req.params.playerTag });
        res.json(playerStats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Player Brawlers Endpoint
app.get('/api/players/:playerTag/brawlers', async (req, res) => {
    try {
        // Example logic, adjust according to your actual data structure
        const brawlers = await client.db('brawlstars').collection('brawlerStats').find({ playerTag: req.params.playerTag }).toArray();
        res.json(brawlers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Recent Battles Endpoint
app.get('/api/players/:playerTag/recent-battles', async (req, res) => {
    try {
        const recentBattles = await client.db('brawlstars').collection('battleHistory').find({ playerTag: req.params.playerTag }).limit(10).toArray();
        res.json(recentBattles);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Leaderboards Endpoint
app.get('/api/leaderboards', async (req, res) => {
    try {
        // Implement leaderboard logic (e.g., top players by trophies)
        // This is an example and needs to be adjusted based on your requirements
        const leaderboards = await client.db('brawlstars').collection('players').find().sort({ trophies: -1 }).limit(10).toArray();
        res.json(leaderboards);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Milestone Achievements Endpoint
app.get('/api/milestones', async (req, res) => {
    try {
        // Fetch milestones data (example, adjust as needed)
        const milestones = await client.db('brawlstars').collection('achievements').find().toArray();
        res.json(milestones);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// MVP Data Endpoint
app.get('/api/mvp', async (req, res) => {
    try {
        // Fetch MVP data (example, adjust as needed)
        const mvp = await client.db('brawlstars').collection('records').findOne({ recordType: "MVP" });
        res.json(mvp);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Oopsie Data Endpoint
app.get('/api/oopsie-tracker', async (req, res) => {
    try {
        // Fetch data for players with most defeats or losing streaks (example, adjust as needed)
        const oopsies = await client.db('brawlstars').collection('players').find().sort({ lossStreak: -1 }).limit(10).toArray();
        res.json(oopsies);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
