

module.exports = {
  TOKEN: "",
  language: "en",
  ownerID: ["1004206704994566164", ""], 
  mongodbUri : "mongodb+srv://purnimabiswas2345:23452345@cluster0.1ewmc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
  spotifyClientId : "b4a81d8295cd481e8d539a409ce9accb",
  spotifyClientSecret : "8f3127d2007c4702acdf8e64143dd2e4",
  setupFilePath: './commands/setup.json',
  commandsDir: './commands',  
  embedColor: "#1db954",
  activityName: "YouTube Music", 
  activityType: "LISTENING",  // Available activity types : LISTENING , PLAYING
  SupportServer: "https://discord.gg/xQF9f9yUEM",
  embedTimeout: 5, 
  errorLog: "", 
  nodes: [
     {
      name: "LavalinkHub",
      password: "catfein",
      host: "lava-sg.catfein.co.id",
      port:  5000,
      secure: false
    }
  ]
}