const axios = require('axios');

exports.handler = async (event) => {
    const apiKey = process.env.API_KEY;
    const response = await axios.get('https://api.brawlstars.com/v1/players/%23PJYJGGCG', {
        headers: {
            'Authorization': `Bearer ${apiKey}`  // Using the API key from environment variables
        }
    });
    return {
        statusCode: 200,
        body: JSON.stringify(response.data),
    };
};
