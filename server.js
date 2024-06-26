const express = require("express");
import("node-fetch").then(fetch => {
}).catch(err => {
    console.error('Failed to load node-fetch:', err);
});
const fs = require("fs");
const https = require("https");
const crypto = require('crypto');
const session = require('express-session');
const { URLSearchParams } = require('url');
const app = express();
const port = 3000;
const CLIENT_ID = '' //in discord dev apps get the app id and put it here
const CLIENT_SECRET = '' //in the discord dev app when you make the Oauth2 get the token and put it here
const REDIRECT_URI = 'http://localhost:3000/callback' //callback address

const generateRandomString = () => {
    return crypto.randomBytes(32).toString('hex');
  };
  
const secret = generateRandomString();

app.use(session({
    secret: secret,
    resave: false,
    saveUninitialized: false
}));

app.get('/', (req, res) => {
    const authorizationUrl = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=identify`;
    res.redirect(authorizationUrl);
});

const database = {
    "x":["1104064312630329396","https://cdn.discordapp.com/avatars/1104064312630329396/8d624d3fe2c8638897c346bdc95269d8.png"],
    "inf":["1025244907151032370","https://cdn.discordapp.com/attachments/1190435941786071182/1232495617733955665/055e3f920286a55856c2d970f21a463a.png?ex=6629aa7d&is=662858fd&hm=a6f332dcf19f1bacedeb90a3b174563e9f50ff869c4eaa71768718e68df3781c&"],
};

app.post('/database', express.json(), (req, res) => {
    const { user, discordId, discordAvatarLink } = req.body;

    if (!user || !discordId || !discordAvatarLink) {
        return res.status(400).json({ error: 'Missing fields' });
    }

    if (database[user]) {
        return res.status(409).json({ error: 'User already exists and cannot be changed' });
    }

    database[user] = [discordId, discordAvatarLink];
    res.status(201).json({ message: 'User data added' });
});

app.get('/callback', async (req, res) => {
    const code = req.query.code;
    const tokenUrl = 'https://discord.com/api/oauth2/token';
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        scope: 'identify',
    });

    try {
        const tokenResponse = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params,
        });

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        const userData = await userResponse.json();

        console.log("Retrieved user data:", userData);

        if (!req.session.userData) {
            req.session.userData = {};
        }

        req.session.userData.avatarUrl = `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`;

        console.log("User data after setting avatar URL:", req.session.userData);

        res.send(`
            <script>
                const userDataToSend = {
                    discordId: '${userData.id}',
                    discordAvatarLink: '${req.session.userData.avatarUrl}',
                };
                const database = 'http://localhost:3000/database';

                const enteredAccountName = prompt('Enter your scenexe2 account name:');
                if (enteredAccountName) {
                    userDataToSend.user = enteredAccountName;

                    fetch(database, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(userDataToSend),
                    })
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Failed to add user data to the database');
                        }
                        return response.json();
                    })
                    .then(data => {
                        console.log('User data added to the database:', data);
                        window.location.href = '/account/' + encodeURIComponent(enteredAccountName);
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        alert('Error fetching user data');
                    });
                } else {
                    window.location.href = '/'; // Redirect back to homepage if no account name entered
                }
            </script>
        `);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Error fetching user data');
    }
});


app.get("/account/:user", async (req, res) => {
	const user = req.params.user;
	const url = `https://scenexe2.io/account?u=${user}`;
    const userData = req.session.userData;

	try {
		const response = await fetch(url);
		const data = await response.json();
        const userData = req.session.userData;

		const formatNumber = (num) => {
			if (num >= 1e15)
				return (num / 1e15).toFixed(1).replace(/\.0$/, "") + "qa";
			if (num >= 1e12) return (num / 1e12).toFixed(1).replace(/\.0$/, "") + "t";
			if (num >= 1e9) return (num / 1e9).toFixed(1).replace(/\.0$/, "") + "b";
			if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, "") + "m";
			if (num >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
			return num;
		};

        async function playercount() {
            const url = 'https://scenexe2.io/playercount';
            try {
                const response = await fetch(url);
                const data = await response.json();
                let playerCountList = '';
                for (const key in data) {
                    if (data.hasOwnProperty(key) && key !== 'total') {
                        playerCountList += `${key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim()}: ${data[key]}<br>`;
                    }
                }
                return playerCountList;
            } catch (error) {
                console.error('Error fetching player count:', error);
                return 'Error fetching player count';
            }
        }

		function formatStars(stars) {
			if (stars >= 1000) {
				return stars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
			}
			return stars;
		}

        function formatTime(seconds) {
            const days = Math.floor(seconds / (3600 * 24));
            const hours = Math.floor((seconds % (3600 * 24)) / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const remainingSeconds = seconds % 60;
        
            if (days > 0) {
                return `${days}d`;
            } else if (hours > 0) {
                return `${hours}h`;
            } else if (minutes > 0) {
                return `${minutes}m`;
            } else {
                return `${seconds}s`;
            }
        }
        
        const pfp = database[user] ? database[user][1] : 'https://cdn.discordapp.com/attachments/1190435941786071182/1232493881204015144/db6b020c58607f70fd2075d4891671d7.png?ex=6629a8df&is=6628575f&hm=b54a778ad090e0ddcd32d52c66a1207a387bc503671eab4fea9729554d3c3731&';
        const backgrounds = [
            "https://cdn.discordapp.com/attachments/1215616270100074516/1231024713107509349/image.png?ex=6635741a&is=6622ff1a&hm=20d5e6cde113220d0d9f548b079bddffcc72c3de0998519bdaa40bd898796839&",
            "https://cdn.discordapp.com/attachments/1215616270100074516/1231024713426538496/image.png?ex=6635741b&is=6622ff1b&hm=4c78e36b2c79a14363e94974e210ebe729cbcd83afe3c3d29983c811ea609e68&",
            "https://cdn.discordapp.com/attachments/1215616270100074516/1231024713720008784/image.png?ex=6635741b&is=6622ff1b&hm=2f5b033a506d3573aee2595a130126348c6ef06ac5cd44479a8437ec952dc65a&",
            "https://cdn.discordapp.com/attachments/1215616270100074516/1231024713988313158/image.png?ex=6635741b&is=6622ff1b&hm=f94e9456ebafbbab0ad5ea73ca8664ab15281828d91a0140cb6f25c56c839b4a&",
        ]
        const background = backgrounds[Math.floor(Math.random() * backgrounds.length)];
        const playercountlist = await playercount();
		const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" rel="stylesheet">
        <style>
             body {
                overflow: hidden;
                font-family: 'Roboto', sans-serif;
                font-weight: 700;
                background-image: url('${background}'); 
                background-size: cover;
                background-repeat: no-repeat;
                color: white;
                text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 2px 2px 0 #000;
                margin: 0;
                height: 100vh;
                display: flex;
                flex-direction: column;
                align-items: flex-start;
                justify-content: flex-start;
                padding: 20px;
                z-index: 1;
            }

            body::before {
                content: "";
                position: fixed;
                top: 0;
                right: 0;
                bottom: 0;
                left: 0;
                background-color: rgba(0, 0, 0, 0.5);
                z-index: 0;
            }
    
            .profile-container {
                display: flex;
                align-items: center;
                gap: 20px;
                z-index: 3;
            }
            
            .profile-image {
                width: 92px;
                height: 92px;
                border-radius: 50%;
                border-style: solid;
                border-color: black;
                border-width: 5px;
                z-index: 3;
            }
            
            .profile-info {
                display: flex;
                flex-direction: column;
                z-index: 3;
            }
    
            .profile-info h1 {
                font-size: 3em;
                margin: -3px;
                z-index: 3;
            }

            .profile-info p {
                font-size: 1.2em;
                margin: -3px;
                z-index: 3;
            }
            
            .description {
                font-size: 1.2em;
                margin-top: 5px;
                z-index: 3;
            }
            
            .stats-container {
                display: flex;
                justify-content: space-between;
                width: 100%;
                max-width: 600px;
                margin-bottom: 30px;
                z-index: 3;
            }
            
            .stats-item {
                flex: 1;
                text-align: center; 
                font-weight: bold;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 0px 65px;
                z-index: 3;
            }
            
            .stats-item .text {
                font-size: 1.4em;
                z-index: 3;
            }
            
            .stats-item .value {
                font-size: 0.8em;
                z-index: 3;
            }

            hr {
                color: white;
                border: 0;
                border-top: 3px solid rgb(0,0,0);
                height: 20px;
                width: 100%;
                z-index: 3;
            }

            .hr2 {
                color: white;
                border: 0;
                border-top: 3px solid rgb(0,0,0);
                height: 20px;
                width: 100%;
                z-index: 3;
                margin-bottom: 5px;
            }

            .search-container {
                position: fixed;
                top: 10px;
                right: 10px;
                z-index: 1000;
            }
    
            .search-form {
                display: flex;
                align-items: center;
                border-style: solid;
                border-width: 4px;
                border-color: rgb(0, 0, 0);
                border-radius: 5px;
                background-color: rgba(0, 0, 0, 0.3);
                padding: 3px 5px;
            }
    
            .search-input {
                flex-grow: 0;
                border: none;
                background-color: transparent;
                color: white;
            }
    
            .search-button-image {
                cursor: pointer;
                width: 25px; 
                height: 25px;
                border-style: solid;
                border-color: rgba(0, 0, 0, 1);
                border-width: 3px;
                border-radius: 3px;
                background-color: white;
            }

            .boxes-container {
                display: flex;
                flex-wrap: wrap;
                justify-content: space-between;
                gap: 20px; 
            }

            .box {
                background: rgba(69, 69, 69, 0.3);
                border: solid 2px black;
                border-radius: 5px;
                padding: 20px;
                margin-top: 20px;
                font-size: 25px;
                z-index: 100;
            }

            .box-title {
                font-size: 25px;
            }

            .box-value {
                font-size: 20px;
                max-height: 300px;
                overflow-y: scroll;
                z-index: 101;
            }
        </style>
    </head>
    <body>
         <div class="search-container">
            <form class="search-form" id="searchForm">
                <input class="search-input" type="text" name="query" placeholder="Search...">
                <img class="search-button-image" src="https://scenexe.io/assets/search.png" onclick="search();" alt="Search">
            </form>
        </div>
        <script>
        document.getElementById('searchForm').addEventListener('submit', function(event) {
            event.preventDefault();
            const input = document.querySelector('.search-input').value;
            window.location.href = '/account/' + encodeURIComponent(input);
        });
        </script>
        <div class="profile-container">
            <img class="profile-image" src="${pfp}" alt="Profile Picture">
            <div class="profile-info">
                <h1>${data.username}</h1>
                <p>⭐${formatStars(data.stars)}</p>
            </div>
        </div>
        <div class="description">${data.description}</div>
        <hr>
        <div class="stats-container">
            <div class="stats-item">
                <div class="text">High Score</div>
                <div class="value">${formatNumber(data.maxScore)}</div>
            </div>
            <div class="stats-item">
                <div class="text">Celestial Kills</div>
                <div class="value">${formatNumber(data.celestialKills)}</div>
            </div>
            <div class="stats-item">
                <div class="text">Ascensions</div>
                <div class="value">${formatNumber(data.ascensions)}</div>
            </div>
            <div class="stats-item">
                <div class="text">Playtime</div>
                <div class="value">${formatTime(data.timePlayed)}</div>
            </div>
            <div class="stats-item">
                <div class="text">Tank Kills</div>
                <div class="value">${formatNumber(data.tankKills)}</div>
            </div>
        </div>
        <hr>
        <div class="boxes-container">
            <div class="box">
                <div class="box-value">
                    <div class="box-title">Player Count</div>
                    <hr class="hr2">
                    <div>${playercountlist}</div>
                </div>
            </div>
            <div class="box">
                <div class="box-value">
                    <div class="box-title">Additional Info</div>
                    <hr class="hr2">
                    <div>Polygon Kills: ${formatNumber(data.polygonKills)}</div>
                </div>
            </div>
        </div>
    </body>
    </html>                 
    `;
		res.send(html);
	} catch (error) {
		console.error(error);
		res.status(500).send("Error fetching data");
	}
});

//if you want to host on your own domain
/*
const privateKey = fs.readFileSync('key.pem', 'utf8'); 
const certificate = fs.readFileSync('cert.pem', 'utf8');

const credentials = { key: privateKey, cert: certificate };

const httpsServer = https.createServer(credentials, app);

httpsServer.listen(port, () => {
    console.log(`Server running at https://your-domain.com:${port}`);
});
*/

app.listen(port, '0.0.0.0', () => {
	console.log(`Server running at http://0.0.0.0:${port}`);
});
