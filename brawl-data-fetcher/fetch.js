require('dotenv').config();
const axios = require('axios');
const cron = require('node-cron');
const { MongoClient } = require('mongodb');
const moment = require('moment-timezone');


const fs = require('fs');
const logFile = 'application.log';

function logMessage(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;

    // Log to console
    console.log(logEntry);

    // Append to a log file
    fs.appendFileSync(logFile, logEntry);
}

const API_KEY = process.env.API_KEY;
const MONGO_URI = process.env.MONGO_URI;

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



function parseBattleTime(battleTime) {
    logMessage(`parseBattleTime called with battleTime: ${battleTime}`);
    
    if (!battleTime) {
        console.error('Invalid battleTime:', battleTime);
        return null;  // Returning null to handle this scenario upstream
    }

    try {
        // Assuming the date format from the API is like '20231030T123456.000Z' (ISO 8601 format)
        const format = 'YYYYMMDDTHHmmss.SSS[Z]'; // Adjusted format 

        // Parsing the date in the specified format
        const parsedDate = moment(battleTime, format);

        if (!parsedDate.isValid()) {
            throw new Error(`Invalid date format for ${battleTime}`);
        }
        console.log("Parsed Date:", parsedDate.toISOString());
        // Converting to a specific timezone (e.g., 'America/Chicago')
        return parsedDate.tz('America/Chicago').format();
    } catch (error) {
        console.error('Error parsing battleTime:', battleTime, 'Error:', error);
        return null;
    }
}

function normalizeTag(tag) {
    return tag.toUpperCase().replace(/O/g, "0");
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
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));


function getPlayerTrophies(battle, playerTag) {
    if (!battle.battle.players) return null;
    const player = battle.battle.players.find(p => p.tag === playerTag);
    return player ? player.trophies : null;
}

function findBrawlerId(battle, playerTag) {
    let brawlerId = null;
    if (battle.battle.teams) {
        for (const team of battle.battle.teams) {
            for (const player of team) {
                //console.log(player.tag, playerTag)
                if (normalizeTag(player.tag) === normalizeTag(playerTag)) {
                    brawlerId = player.brawler.id;
                    logMessage(`Found player in teams. Player tag: ${player.tag}, Brawler ID: ${brawlerId}`);
                    break;
                }
            }
            if (brawlerId) break;
        }
    } else if (battle.battle.players) {
        for (const player of battle.battle.players) {
            //console.log(player.tag, playerTag)
            if (normalizeTag(player.tag) === normalizeTag(playerTag)) {
                brawlerId = player.brawler.id;
                logMessage(`Found player in players. Player tag: ${player.tag}, Brawler ID: ${brawlerId}`);
                break;
            }
        }
    }
    return brawlerId;
}

function findBrawlerName(battle, playerTag) {
    let brawlerName = null;
    if (battle.battle.teams) {
        for (const team of battle.battle.teams) {
            for (const player of team) {
                if (normalizeTag(player.tag) === normalizeTag(playerTag)) {
                    if (!player.brawler.name) {
                        logMessage(`Brawler name is undefined for player tag: ${player.tag}, Brawler ID: ${player.brawler.id}`);
                        console.log(player); // Log the entire player object for inspection
                    }
                    brawlerName = player.brawler.name;
                    logMessage(`Found player in teams. Player tag: ${player.tag}, Brawler Name: ${brawlerName}`);
                    break;
                }
            }
            if (brawlerName) break;
        }
    } else if (battle.battle.players) {
        for (const player of battle.battle.players) {
            if (normalizeTag(player.tag) === normalizeTag(playerTag)) {
                if (!player.brawler.name) {
                    logMessage(`Brawler name is undefined for player tag: ${player.tag}, Brawler ID: ${player.brawler.id}`);
                    console.log(player); // Log the entire player object for inspection
                }
                brawlerName = player.brawler.name;
                logMessage(`Found player in players. Player tag: ${player.tag}, Brawler Name: ${brawlerName}`);
                break;
            }
        }
    }
    return brawlerName;
}

async function updateBrawlerStatsInDb(brawlerName, mapName, modeName, battle, db) {
    const winLossUpdate = battle.battle.result === 'victory' ? { $inc: { wins: 1 } } : { $inc: { losses: 1 } };
    try {
        await db.collection('brawlerStats').updateOne(
            { brawlerName, mapName, modeName },
            { ...winLossUpdate, $setOnInsert: { winRate: "0.00" } },
            { upsert: true }
        );
        logMessage(`Stats updated for Brawler: ${brawlerName}, Map: ${mapName}, Mode: ${modeName}.`);
    } catch (error) {
        logMessage(`Error updating Brawler stats in DB: ${error.message}`);
    }
}

async function calculateAndStoreWinRates(db) {
    const cursor = db.collection('brawlerStats').find({});
    for await (const brawlerStat of cursor) {
        // Treat undefined losses as 0
        const losses = brawlerStat.losses || 0;
        const totalBattles = brawlerStat.wins + losses;
        const winRate = totalBattles > 0 ? (brawlerStat.wins / totalBattles) * 100 : 0;
        await db.collection('brawlerStats').updateOne(
            { _id: brawlerStat._id },
            { $set: { winRate: winRate.toFixed(2) } }
        );
        logMessage(`Win rate updated for brawlerName: ${brawlerStat.brawlerName} to ${winRate.toFixed(2)}%`);
    }
}
function prepareBattleData(battle, playerTag, cstBattleTime, brawlerId) {
    const isWin = battle.battle.result === 'victory';
    const battleData = {
        battleId: battle.event.id, // Assuming a unique ID is present
        playerTag: playerTag,
        time: new Date(cstBattleTime),
        event: battle.event,
        mode: battle.battle.mode,
        map: battle.event.map,
        outcome: isWin ? 'victory' : 'defeat',
        brawlerId: brawlerId,
        brawlerName: findBrawlerName(battle, playerTag)
        // Additional fields can be added here as needed
    };

    if (battle.battle.rank) {
        battleData.rank = battle.battle.rank;
        battleData.trophyChange = battle.battle.trophyChange;
    }

    if (battle.battle.starPlayer) {
        battleData.starPlayer = battle.battle.starPlayer;
        battleData.teams = battle.battle.teams;
        battleData.duration = battle.battle.duration;
    }

    battleData.playerTrophies = getPlayerTrophies(battle, playerTag);

    return battleData;
}

async function updateBattleInDb(battleData, db) {
    const compositeId = `${battleData.playerTag}-${battleData.battleId}-${battleData.time.getTime()}`;
    try {
        await db.collection('battles').updateOne(
            { compositeId: compositeId },
            { $set: battleData },
            { upsert: true },
            {brawlerUsed: battleData.brawlerName}
        );
        logMessage(`DB update successful for battleId: ${battleData.battleId}, playerTag: ${battleData.playerTag}`);
    } catch (error) {
        logMessage(`Error updating battle in DB: ${error.message}`);
    }
}


async function processEachBattle(battle, playerTag, db, battleStats) {
    const cstBattleTime = parseBattleTime(battle.battleTime);
    const brawlerId = findBrawlerId(battle, playerTag);
    if (!brawlerId) return;

    const mapName = battle.event.map;
    const modeName = battle.battle.mode;

    const brawlerName = findBrawlerName(battle, playerTag);
    await updateBrawlerStatsInDb(brawlerName, mapName, modeName, battle, db);
    const battleData = prepareBattleData(battle, playerTag, cstBattleTime, brawlerId);
    await updateBattleInDb(battleData, db);

    battleStats.wins += battleData.outcome === 'victory' ? 1 : 0;
    battleStats.losses += battleData.outcome === 'defeat' ? 1 : 0;

    await updatePlayerStatsInDb(playerTag, battleData, db, battleStats);

    // Delay to prevent rate limiting, if needed
    await sleep(100);
}

function logBattleOutcome(battleData) {
    // This could be a console log or logging to a file or external system
    console.log(`Battle outcome for playerTag: ${battleData.playerTag}, BattleId: ${battleData.battleId}, Outcome: ${battleData.outcome}`);
}

async function updatePlayerStatsInDb(playerTag, battleData, db, battleStats) {
    const increments = {
        'battlesPlayed': 1,
        'trophies': battleData.trophyChange || 0 // Fallback to 0 if trophyChange is not a number
    };

    // This line prepares the path for the nested brawler stats
    const brawlerStatPath = `brawlerStats.${battleData.brawlerName}.${battleData.mode}`;

    const brawlerUsagePath = `brawlerStats.${battleData.brawlerName}.usage`;
    const brawlerUsageIncrement = { $inc: { [brawlerUsagePath]: 1 } };

    // Prepare win or loss increment
    const winLossUpdate = battleData.outcome === 'victory' ? 
        { $inc: { [`${brawlerStatPath}.wins`]: 1 } } : 
        { $inc: { [`${brawlerStatPath}.losses`]: 1 } };

    if (battleData.outcome === 'victory') {
        increments['winStreak'] = 1;
        increments['lossStreak'] = 0;
    } else if (battleData.outcome === 'defeat') {
        increments['winStreak'] = 0;
        increments['lossStreak'] = 1;
    }

    try {
        // First, update the win or loss count
        await db.collection('playerStats').updateOne(
            { playerTag: playerTag },
            winLossUpdate,
            brawlerUsageIncrement,
            { upsert: true }
        );

        // Then, retrieve the updated stats to calculate the win rate
        const playerStat = await db.collection('playerStats').findOne({ playerTag: playerTag });
        const brawlerModeStats = playerStat.brawlerStats[battleData.brawlerName][battleData.mode] || { wins: 0, losses: 0 };
        const wins = brawlerModeStats.wins || 0; // Ensure wins is set to 0 if undefined
        const losses = brawlerModeStats.losses || 0; // Ensure losses is set to 0 if undefined
        const totalBattles = wins + losses;
        const winRate = totalBattles > 0 ? (wins / totalBattles) * 100 : 0;

        // Finally, update the win rate
        await db.collection('playerStats').updateOne(
            { playerTag: playerTag },
            {
                $set: { 
                    [`${brawlerStatPath}.winRate`]: winRate.toFixed(2),
                    'lastActive': battleData.time,
                    'lastOutcome': battleData.outcome
                },
                $inc: increments,
                $max: { 'highestTrophies': battleData.playerTrophies }
            }
        );

        logMessage(`Player stats updated for playerTag: ${playerTag}`);
    } catch (error) {
        logMessage(`Error updating player stats in DB: ${error.message}`);
    }
}

function calculateWinRate(wins, totalBattles) {
    return totalBattles > 0 ? (wins / totalBattles) * 100 : 0;
}


async function processBattleLogs(battleLogResponse, playerTag, db) {
    logMessage(`processBattleLogs called for playerTag: ${playerTag}`);

    if (!battleLogResponse.items || battleLogResponse.items.length === 0) {
        logMessage(`No new battles found for playerTag: ${playerTag}.`);
        return;
    }

    logMessage(`Found ${battleLogResponse.items.length} battles for processing.`);
    let battleStats = { wins: 0, losses: 0 };

    for (const battle of battleLogResponse.items) {
        await processEachBattle(battle, playerTag, db, battleStats);
    }

    const winRate = calculateWinRate(battleStats.wins, battleStats.wins + battleStats.losses);
    logMessage(`Win rate for playerTag: ${playerTag} is ${winRate.toFixed(2)}%`);
    calculateAndStoreWinRates(db);

    // Additional logging and updates can be done here...
}


async function calculateWinRates(db) {
    const brawlers = await db.collection('brawlerStats').find({}).toArray();
    
    brawlers.forEach(brawler => {
        if (brawler.wins + brawler.losses > 0) {
            const winRate = brawler.wins / (brawler.wins + brawler.losses);
            console.log(`Brawler ${brawler.brawlerId} on ${brawler.mapName} (${brawler.modeName}) - Win Rate: ${winRate.toFixed(2)}`);
        }
    });
}

function checkLogSizeAndRotate() {
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > maxSize) {
        fs.renameSync(logFile, logFile + '.1'); // simple rotation, consider timestamp or incrementing numbers
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
    let playerStats = await db.collection('playerStats').findOne({ playerTag: playerTag });
    
    // Ensure playerStats and playerStats.milestones are initialized
    if (!playerStats) {
        playerStats = { trophies: 0, milestones: [] };
    } else if (!Array.isArray(playerStats.milestones)) {
        playerStats.milestones = [];  // Initialize milestones as an array if not set
    }
    
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
            _id: "$playerTag",
            totalTrophies: { $sum: "$trophyChange" }
          } 
        },
        { $sort: { totalTrophies: -1 } },
        { $limit: 1 }
    ];

    const results = await db.collection('battles').aggregate(pipeline).toArray();
    if (results.length > 0) {
        await db.collection('records').updateOne(
            { recordType: 'MVP', timeframe: timeframe },
            { $set: { playerTag: results[0]._id, totalTrophies: results[0].totalTrophies } },
            { upsert: true }
        );
    }
    console.log(`MVP ${timeframe}:`, results);
}

async function calculateMostImprovedPlayer(db, timeframe = 30) {
    // Adjust the timeframe according to your snapshot interval

    const previousSnapshotDate = new Date();
    previousSnapshotDate.setDate(previousSnapshotDate.getDate() - timeframe);

    const pipeline = [
        {
            $match: {
                lastActive: { $gte: previousSnapshotDate }
            }
        },
        {
            $project: {
                playerTag: 1,
                trophyIncrease: { $subtract: ["$highestTrophies", "$baselineTrophies"] }
            }
        },
        { $sort: { trophyIncrease: -1 } },
        { $limit: 1 }
    ];

    const result = await db.collection('playerStats').aggregate(pipeline).toArray();
    if (result.length > 0) {
        // Update Most Improved Player in the database
        await db.collection('records').updateOne(
            { recordType: 'Most Improved Player', timeframe: timeframe },
            { $set: { playerTag: result[0].playerTag, trophyIncrease: result[0].trophyIncrease } },
            { upsert: true }
        );

        console.log(`Most Improved Player:`, result[0]);
    } else {
        console.log("No player improvement data available for the specified timeframe.");
    }
}


async function calculatePlayerTrend(playerTag, db) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const pipeline = [
        { $match: { playerTag: playerTag, time: { $gte: thirtyDaysAgo } } },
        { $group: { _id: "$playerTag", avgTrophies: { $avg: "$trophyChange" } } }
    ];

    const results = await db.collection('battles').aggregate(pipeline).toArray();

    if (results.length > 0) {
        const trendData = {
            date: new Date(),  // Capture the date when this analysis was run
            avgTrophies: results[0].avgTrophies
        };

        // Update the playerTrends collection
        await db.collection('playerTrends').updateOne(
            { playerTag: playerTag },
            { $push: { trends: trendData } },
            { upsert: true }
        );

        console.log(`Average trophies won per battle for player ${playerTag} in the last 30 days:`, results);
    }
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
            }).catch(error => {
                logMessage(`Error fetching player info for tag ${tag}: ${error.message}`);
            });

            const battleLogPromise = axios.get(`${BRAWL_STARS_API_ENDPOINT}/players/${encodeURIComponent(tag)}/battlelog`, {
                headers: { Authorization: `Bearer ${API_KEY}` }
            }).catch(error => {
                logMessage(`Error fetching battle log for tag ${tag}: ${error.message}`);
            });
            const [playerResponse, battleLogResponse] = await Promise.all([playerInfoPromise, battleLogPromise]);

            if (!playerResponse || !battleLogResponse) {
                logMessage(`Skipping processing due to error in fetching data for player tag ${tag}.`);
            }
            
            

            //LOGGING TO SEE BATTLELOG API RESPONSE
            console.log(`Battle log for ${tag}:`, JSON.stringify(battleLogResponse.data, null, 2));

            // Update player data
            const playerData = {
                tag,
                playerInfo: playerResponse.data,
            };
            await db.collection('players').updateOne({ tag }, { $set: playerData }, { upsert: true });

            // Validate that battleLogResponse is not empty or malformed
            if (!battleLogResponse || !battleLogResponse.data) {
                logMessage(`Invalid or empty battle log response for tag ${tag}.`);
                return;
            }

            // Filter new battles and process
            const lastBattleTime = await db.collection('achievements').findOne({ playerTag: tag }, { projection: { lastBattleTime: 1 } });
            logMessage(`Last Battle Time for ${tag}: ${lastBattleTime?.lastBattleTime || "No previous battles logged"}`);
            
            // Log the battle times from the API response
            //if (battleLogResponse && battleLogResponse.data && battleLogResponse.data.items) {
                //battleLogResponse.data.items.forEach((item, index) => {
                    //logMessage(`API Battle Time for ${tag} - Battle ${index + 1}: ${item.battleTime}`);
                //});
            //} else {
                //logMessage(`Battle log response for ${tag} is empty or invalid.`);
            //}
            
            const newBattles = battleLogResponse.data.items.filter(battle => {
                const format = "YYYYMMDDTHHmmss.SSSZ";
                const parsedAPIDate = moment(battle.battleTime, format);
                if (!parsedAPIDate.isValid()) {
                    logMessage(`Invalid date encountered in API response for battle time: ${battle.battleTime}`);
                    return false; // skip this iteration
                }

                const parsedLastBattleDate = lastBattleTime?.lastBattleTime ? new Date(lastBattleTime.lastBattleTime) : new Date(0);
                if (isNaN(parsedLastBattleDate)) {
                    logMessage(`Invalid last battle date from database for tag ${tag}`);
                    return false; // consider appropriate action here
                }
                
                //logMessage(`Parsed API Date for ${tag} - ${battle.battleTime}: ${parsedAPIDate.toISOString()}`);
                //logMessage(`Parsed Last Battle Date for ${tag}: ${parsedLastBattleDate.toISOString()}`);
                
                const isBattleNew = parsedAPIDate > parsedLastBattleDate;
                //logMessage(`Is Battle New for ${tag}? ${isBattleNew}`);
                
                return isBattleNew;
            });
            
            
            if (newBattles.length > 0) {
                //logMessage(`New battles for ${tag}: ${newBattles.length}`);
                console.log(`New Battles for ${tag}:`, JSON.stringify(newBattles, null, 2)); // Detailed view of new battles
                await processBattleLogs({ items: newBattles }, tag, db);
            } else{
                //logMessage(`No new battles for ${tag}`);
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
        // ... inside fetchData, after Promise.all(playerFetchPromises)

        await calculateWinRates(db);
        await calculateMVP(db); // Calculate MVP of a timeframe
        await calculateMostImprovedPlayer(db);
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
    checkLogSizeAndRotate();
}

main();
