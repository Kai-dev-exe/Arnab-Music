
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
  
  // Webhook URL for real-time Lavalink notifications (optional)
  // Get webhook URL from: Server Settings > Integrations > Webhooks > Create Webhook
  // Then paste the webhook URL in your .env file as WEBHOOK_URL=your_webhook_url_here
  webhookUrl: process.env.WEBHOOK_URL || "",  // Leave empty to disable webhook notifications
  nodes: [
    {
       name: "ARINO",
       password: "youshallnotpass",
       host: "89.251.21.21",
       port: 25577,
       secure: false
     },
    
    {
      name: "Serenetia-LDP-NonSSL",
      password: "https://dsc.gg/ajidevserver",
      host: "lavalink.serenetia.com",
      port: 80,
      secure: false
    },

    {
      name: "RY4N",
      password: "youshallnotpass",
      host: "mine.visionhost.cloud",
      port: 2002,
      secure: false
    },

    // {
    //   name: "ARNAB LAVALINK",
    //   password: "arnab2345",
    //   host: "5.39.63.207",
    //   port: 3730,
    //   secure: false
    // }
  ]
}