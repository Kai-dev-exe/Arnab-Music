
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
      name: "Serenetia",
      password: "https://dsc.gg/ajidevserver",
      host: "lavalinkv4.serenetia.com",
      port: 80,
      secure: false
    },

    {
      name: "Ajieblogs",
      password: "https://dsc.gg/ajidevserver",
      host: "lava-v4.ajieblogs.eu.org",
      port: 80,
      secure: false
    },

     {
       name: "Jirayu",
       password: "youshallnotpass",
       host: "lavalink.jirayu.net",
       port: 13592,
       secure: false
    }
  ]
}