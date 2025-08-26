
require('dotenv').config();

module.exports = {
  TOKEN: process.env.TOKEN || "",  // Keep explicit for clarity
  language: "en",
  ownerID: ["728922361340100658", ""],
  mongodbUri : process.env.MONGODB_URI || "",  // Now from .env instead of hardcoded
  spotifyClientId : "",
  spotifyClientSecret : "",
  setupFilePath: './commands/setup.json',
  commandsDir: './commands',  
  embedColor: "#1db954",
  activityName: "YouTube Music", 
  activityType: "LISTENING",  // Available activity types : LISTENING , PLAYING
  SupportServer: "https://discord.gg/qX9ugahuqh",
  embedTimeout: 5, 
  errorLog: "", 
  nodes: [
     {
      name: "ARNAB LAVALINK",
      password: "arnab2345",
      host: "5.39.63.207",
      port: 3730,
      secure: false
    }
  ]
}