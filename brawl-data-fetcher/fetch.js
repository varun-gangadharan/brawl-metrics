const axios = require('axios');
const cron = require('node-cron');
const { MongoClient } = require('mongodb');

const API_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiIsImtpZCI6IjI4YTMxOGY3LTAwMDAtYTFlYi03ZmExLTJjNzQzM2M2Y2NhNSJ9.eyJpc3MiOiJzdXBlcmNlbGwiLCJhdWQiOiJzdXBlcmNlbGw6Z2FtZWFwaSIsImp0aSI6ImMzZjhiMmZhLWQwNzEtNDhlZi05NjFkLWJjZTNiOTczM2JlNSIsImlhdCI6MTY5ODM5NzYwMCwic3ViIjoiZGV2ZWxvcGVyLzdkYjk2ZTRkLWNjYWQtMDA2MS1hODY0LTNjNmRkMDQ5NWFhZSIsInNjb3BlcyI6WyJicmF3bHN0YXJzIl0sImxpbWl0cyI6W3sidGllciI6ImRldmVsb3Blci9zaWx2ZXIiLCJ0eXBlIjoidGhyb3R0bGluZyJ9LHsiY2lkcnMiOlsiMy4xMy44NC42OCJdLCJ0eXBlIjoiY2xpZW50In1dfQ.XVxuWaoV9HvPAP062r6toQoCy7PD8lswz2zgBnIF643BkQUT0kZ3ZpiAGn9kUBDl9dOYMiwDLXxtV_-kk5LXlw';
const MONGO_URI = 'mongodb+srv://varwhiz:varAws1m63@brawlcluster.oci3nfn.mongodb.net/?retryWrites=true&w=majority';

const BRAWL_STARS_API_ENDPOINT = 'https://api.brawlstars.com/v1';

async function connectToDatabase(uri) {
    try {
        const client = await MongoClient.connect(uri);
        console.log('Connected to Database');
        return client.db('brawlstars');
    } catch (err) {
        console.error('Database connection error:', err);
        process.exit(1); // Exit script with a failure code
    }
}

async function initializeDatabase(db) {
    // Creating indexes for the 'players' collection
    await db.collection('players').createIndex({ tag: 1 }, { unique: true });

    // Creating indexes for the 'battles' collection
    await db.collection('battles').createIndex({ "compositeId": 1 }, { unique: true });


    await db.collection('achievements').createIndex({ playerTag: 1 }, { unique: true });

    // Creating indexes for 'funMetrics' collection
 
    await db.collection('funMetrics').createIndex({ metricName: 1 });

   
    await db.collection('visualizationData').createIndex({ vizId: 1 });

    console.log('Database indices have been initialized.');
}

function getPlayerTrophies(battle, playerTag) {
    if (!battle.battle.players) return null;
    const player = battle.battle.players.find(p => p.tag === playerTag);
    return player ? player.trophies : null;
}

async function processBattleLogs(battleLogResponse, playerTag, db) {
    for (const battle of battleLogResponse.items) {
        

        const playerTrophies = getPlayerTrophies(battle, playerTag);

        // Extract required battle info
        let battleData;
        if (["soloShowdown", "duoShowdown"].includes(battle.battle.mode)) {
            const isWin = battle.battle.rank === 1 || battle.battle.trophyChange > 0;
            battleData = {
                battleId: battle.event.id,  // Assuming a unique ID is present
                playerTag: playerTag,
                time: new Date(battle.battleTime),
                event: battle.event,
                mode: battle.battle.mode,
                map: battle.event.map,
                rank: battle.battle.rank,
                trophyChange: battle.battle.trophyChange,
                outcome: isWin ? 'victory' : 'defeat',
                playerTrophies: playerTrophies
            };
        } else {
            battleData = {
                battleId: battle.event.id,  // Assuming a unique ID is present
                playerTag: playerTag,
                time: new Date(battle.battleTime),
                event: battle.event,
                mode: battle.battle.mode,
                map: battle.event.map,
                outcome: battle.battle.result,
                starPlayer: battle.battle.starPlayer,
                teams: battle.battle.teams,
                duration: battle.battle.duration,
                trophyChange: battle.battle.trophyChange,
                playerTrophies: playerTrophies
            };
        }

        const compositeId = `${playerTag}-${battle.event.id}-${battle.battleTime.replace(/[^0-9]/g, '')}`;
        battleData.compositeId = compositeId;

        // Update battle info in DB using compositeId
        await db.collection('battles').updateOne(
            { compositeId: compositeId },
            { $set: battleData },
            { upsert: true }
        );

        // Update achievements and player stats
        const incrementFields = { totalBattles: 1 };
        if (battleData.outcome === 'victory') {
            incrementFields['totalVictories'] = 1;
            incrementFields['winStreak'] = 1; // Reset or handled elsewhere if a loss is recorded
        } else {
            incrementFields['lossStreak'] = 1; // Reset or handled elsewhere if a victory is recorded
        }

        // Updating trophies and calculating stats
        incrementFields['totalTrophiesWon'] = battleData.trophyChange;

        // Update the achievements and playerStats collection
        await db.collection('achievements').updateOne(
            { playerTag: playerTag },
            { $inc: incrementFields, $set: { lastBattleTime: battleData.time } },
            { upsert: true }
        );

        await db.collection('playerStats').updateOne(
            { playerTag: playerTag },
            { 
                $inc: {
                    'battlesPlayed': 1,
                    'trophies': battleData.trophyChange
                },
                $set: { lastActive: battleData.time },
                $max: { 'highestTrophies': playerTrophies }
            },
            { upsert: true }
        );

        // Historical data updates for trend analysis
        await db.collection('battleHistory').insertOne({ ...battleData, timeStamp: new Date() });
    }
}

async function updateLeaderboards(db) {
    const leaderboard = await db.collection('playerStats')
                                .find({})
                                .sort({ trophies: -1 })
                                .limit(100) // Top 100 players
                                .toArray();
    console.log("Leaderboard data:", leaderboard);
    // Additional code to store or utilize the leaderboard data as required
}

async function checkAndUpdateMilestones(playerTag, db) {
    const milestones = [100, 500, 1000, 5000]; // Define your milestones
    const playerStats = await db.collection('playerStats').findOne({ playerTag: playerTag });
    
    milestones.forEach(async (milestone) => {
        if (playerStats.trophies >= milestone && !playerStats.milestones.includes(milestone)) {
            // Update milestones in the database
            await db.collection('playerStats').updateOne(
                { playerTag: playerTag },
                { $push: { milestones: milestone } }
            );
            console.log(`Player ${playerTag} reached a new milestone: ${milestone} trophies!`);
        }
    });
}

async function calculateMVP(db, timeframe = 'weekly') {
    let groupByFormat = '%Y-%m-%d';
    if (timeframe === 'monthly') groupByFormat = '%Y-%m';

    const today = new Date();
    const pastDate = new Date();
    pastDate.setDate(today.getDate() - (timeframe === 'weekly' ? 7 : 30));

    const pipeline = [
        { $match: { time: { $gte: pastDate, $lte: today } } },
        { $group: { 
            _id: { $dateToString: { format: groupByFormat, date: "$time" } },
            playerTag: "$playerTag",
            totalTrophies: { $sum: "$trophyChange" }
          } 
        },
        { $sort: { totalTrophies: -1 } },
        { $limit: 1 }
    ];

    const results = await db.collection('battles').aggregate(pipeline).toArray();
    console.log(`MVP ${timeframe}:`, results);
}



async function calculatePlayerTrend(playerTag, db) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const pipeline = [
        { $match: { playerTag: playerTag, time: { $gte: thirtyDaysAgo } } },
        { $group: { _id: "$playerTag", avgTrophies: { $avg: "$trophyChange" } } }
    ];

    const results = await db.collection('battles').aggregate(pipeline).toArray();
    console.log(`Average trophies won per battle for player ${playerTag} in the last 30 days:`, results);
}

async function flagExceptionalPerformances(db) {
    const threshold = 30; // Define your own threshold for exceptional performance

    const pipeline = [
        { $match: { trophyChange: { $gte: threshold } } },
        { $group: { _id: "$playerTag", highTrophyWins: { $sum: 1 } } }
    ];

    const exceptionalPerformances = await db.collection('battles').aggregate(pipeline).toArray();
    console.log("Players with exceptional performances:", exceptionalPerformances);
}

async function fetchData(db) {
    try {
        const playerTags = ['#PJYJGGCG', '#YCO98JGU', '#UR80QUY']; // Add more player tags as needed

        const playerFetchPromises = playerTags.map(async (tag) => {
            // Fetch player and their battlelog concurrently
            const playerInfoPromise = axios.get(`${BRAWL_STARS_API_ENDPOINT}/players/${encodeURIComponent(tag)}`, {
                headers: { Authorization: `Bearer ${API_KEY}` }
            });

            const battleLogPromise = axios.get(`${BRAWL_STARS_API_ENDPOINT}/players/${encodeURIComponent(tag)}/battlelog`, {
                headers: { Authorization: `Bearer ${API_KEY}` }
            });

            const [playerResponse, battleLogResponse] = await Promise.all([playerInfoPromise, battleLogPromise]);

            // Update player data
            const playerData = {
                tag,
                playerInfo: playerResponse.data,
            };
            await db.collection('players').updateOne({ tag }, { $set: playerData }, { upsert: true });

            // Filter new battles and process
            const lastBattleTime = await db.collection('achievements').findOne({ playerTag: tag }, { projection: { lastBattleTime: 1 } });
            const newBattles = battleLogResponse.data.items.filter(battle => new Date(battle.battleTime) > new Date(lastBattleTime?.lastBattleTime || 0));
            
            if (newBattles.length > 0) {
                await processBattleLogs({ items: newBattles }, tag, db);
            }

            // After updating battles, check for updates in leaderboards and milestones
            await updateLeaderboards(db);
            await checkAndUpdateMilestones(tag, db);
        });

        await Promise.all(playerFetchPromises);

        // Additional analytical functions after fetching and updating
        for (const tag of playerTags) {
            await calculatePlayerTrend(tag, db); // Calculate trends per player
        }
        await calculateMVP(db); // Calculate MVP of a timeframe
        await flagExceptionalPerformances(db); // Flag exceptional performances globally

    } catch (error) {
        console.error('Error fetching data:', error);
    }
}


async function main() {
    const db = await connectToDatabase(MONGO_URI);
    await initializeDatabase(db);
    fetchData(db);
    cron.schedule('0 * * * *', () => fetchData(db));
}

main();
