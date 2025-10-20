# OAuth Nitro Bot

Discord OAuth2 and Nitro Distribution Bot.

This bot utilizes Discord's OAuth2 flow to collect authorized user data (including access tokens, refresh tokens, and email), stores them in a local database, and provides administrative slash commands to manage the user base, check token validity, and bulk join users to a specified server.

## Features

* **Discord OAuth2 Gateway:** Hosts an Express server to handle the OAuth2 redirect URI, securely exchanging the authorization code for user access and refresh tokens.
* **User Data Persistence:** Authorized user details, including tokens and IP address, are stored in the local **`object.json`** file.
* **Automated Token Validation:** The `/refresh` command checks all stored user access tokens against the Discord API and removes expired or invalid entries, keeping the database clean.
* **Bulk Server Join:** The `/joinall` command attempts to force-join all authorized users from the database into the configured main server.
* **Administrative Whitelist:** Command access is restricted to configured owners and whitelisted users, managed via the `/whitelist` command.
* **Webhook Logging:** Logs successful user authorizations to a specified Discord webhook URL.

## Prerequisites

Before setting up the bot, you will need:

* **Node.js** (v14+)
* **A Discord Bot Application:** With **OAuth2 Redirects** configured to your server URL and the **Gateway Intents** enabled:
    * `PRESENCE INTENT` (Not explicitly used but often required for general bot functionality)
    * `SERVER MEMBERS INTENT` (Required for `/joinall` functionality)
* **A Hosting Environment:** Capable of serving the web server on the configured port and maintaining the Discord bot connection.

## Configuration

All critical settings are located in the **`config.json`** file. You must fill in the following fields:

| Field | Description | Example |
| :--- | :--- | :--- |
| `DISCORD_BOT_TOKEN` | Your Discord Bot's token. | `MTQyMjE...` |
| `DISCORD_CLIENT_ID` | The Client ID of your Discord Application. | `1422107292492496897` |
| `DISCORD_CLIENT_SECRET` | The OAuth2 Client Secret from your Discord Application. | `EraJls6Z...` |
| `DISCORD_REDIRECT_URI` | The full URL for your OAuth2 redirect (must match Discord App settings). | `https://nitrokings.wispbyte.cc/` |
| `PORT` | The port the Express server will listen on. | `13816` |
| `MAIN_SERVER_ID` | The ID of the Discord server to which users will be joined. | `1414511784194216079` |
| `OWNERS` | An array of Discord User IDs with full access to all bot commands. | `["1402951679996854344"]` |
| `WEBHOOK_URL_SUCCESS_LOGS` | Webhook to receive logs for new user authorizations. | `https://discord.com/...` |

## Installation and Run

1.  **Clone the repository:**
    ```bash
    git clone <repository_url>
    cd oauth-nitro-bot
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```
    This command reads the **`package.json`** file and installs all required packages (dependencies) into the **`node_modules`** folder. **The bot will not run without this step.**

3.  **Start the bot:**
    ```bash
    npm start
    ```
    The script defined in `package.json` will run `node index.js`, starting both the Discord bot and the web server.

## Bot Commands (Slash Commands)

All commands are slash commands and require either a configured **Owner ID** or a **Whitelisted User** to execute.

| Command | Description | Permission |
| :--- | :--- | :--- |
| `/help` | Displays the list of all available bot commands. | Owner/Whitelist |
| `/users` | Displays the total count of authorized users in the database. | Owner/Whitelist |
| `/links` | Provides the bot's invite and OAuth2 authentication links. | Owner/Whitelist |
| `/refresh` | Checks all user tokens in the database and removes expired/invalid entries. | Owner/Whitelist |
| `/joinall` | Attempts to force-join all authorized users into the configured main server. | Owner/Whitelist |
| `/whitelist` | Manages the bot command access whitelist (`add`, `remove`, `list` subcommands). | Owner/Whitelist |
| `/mybot` | Displays bot status and subscription information. | Owner/Whitelist |
This is a screenshot of the help command.


![Help Command Screenshot](https://ibb.co/LzKcgS8N)