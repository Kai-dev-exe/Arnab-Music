

module.exports = {
  TOKEN: "",
  language: "en",
  ownerID: ["1004206704994566164", ""], 
  mongodbUri : "",
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
      "identifier": "Catfein ID",
      "password": "catfein",
      "host": "lava.catfein.com",
      "port": 4000,
      "secure": false
    },
    {
      name: "INZEWORLD.COM (DE)",
      password: "saher.inzeworld.com",
      host: "lava.inzeworld.com",
      port:  3128,
      secure: false
    },
    {
      "identifier": "ChalresNaig Node",
      "password": "NAIGLAVA-dash.techbyte.host",
      "host": "lavahatry4.techbyte.host",
      "port": 3000,
      "secure": false
    }
  ]

}
