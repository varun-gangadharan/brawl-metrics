require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const app = express();
const port = 3001; // You can choose any port that is not in use

app.use(express.json()); // Middleware to parse JSON bodies

// MongoDB connection string
const MONGO_URI = process.env.MONGO_URI;


// Connect to MongoDB
const client = new MongoClient(MONGO_URI);

async function run() {
    try {
        await client.connect();
        console.log('Connected to MongoDB');

        // Define API endpoints here

    } catch (error) {
        console.error('Failed to connect to MongoDB', error);
    }
}

run().catch(error => {
    console.error('Error connecting to MongoDB:', error);
});


app.listen(port, async () => {
    console.log(`Server running on port ${port}`);
    await run();
});

