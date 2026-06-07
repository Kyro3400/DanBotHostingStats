const Discord = require("discord.js");
const Chalk = require("chalk");
const fs = require('fs');
const path = require('path');

const cap = require("../util/cap");
const { COMMANDS_DIR, isSafeCommandName, resolveCommandModule } = require("../util/resolveCommandModule.js");
const Config = require('../../config.json');
const MiscConfigs = require('../../config/misc-configs.js');
const { Sentry } = require('../../index.js');

/**
 * 
 * @param {Discord.Client} client 
 * @param {Discord.Message} message 
 * @returns void
 */
module.exports = async (client, message) => {

    // Add reactions to suggestion channels.
    if (MiscConfigs.suggestionChannels.some((channel) => channel == message.channel.id)) {
        if (!message.content.startsWith(">")) {
            await message.react("👍");
            await message.react("👎");
        }
    }

    // Staff that can invoke the bot for DMs.
    if (message.channel.type === Discord.ChannelType.DM) {
        // Allow users to send messages on behalf of the bot if they are allowed
        if (MiscConfigs.dmAllowedUsers.includes(message.author.id)) {
            const args = message.content.trim().split(/ +/g);

            try {
                const msg = await client.channels.cache
                    .get(args[0])
                    .send(cap(message.content.split(" ").slice(1).join(" "), 2000));
                message.reply(msg.url);
            } catch (err) {
                message.channel.send({content: `\`\`\`${err.message}\`\`\``});
            }
        }
    };

    if (message.author.bot) return; // Stop bots from running commands.
    if (message.channel.type === Discord.ChannelType.DM) return; // Stop commands in DMs.

    const prefix = Config.DiscordBot.Prefix;
    if (!message.content.toLowerCase().startsWith(prefix.toLowerCase())) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/g);
    const commandargs = message.content.split(" ").slice(1).join(" ");
    const command = args.shift().toLowerCase();

    console.log(
        Chalk.magenta("[DISCORD] ") +
            Chalk.yellow(
                `[${message.author.username}] [${message.author.id}] >> ${prefix}${command} ${commandargs}`,
            ),
    );

    try {

        // Checks if the command is allowed in the channel or category.
        // Staff bypass channel requirements.
        if (
            !MiscConfigs.allowedChannels.includes(message.channel.id) &&                            // Channel is not present in allowedChannels.
            !MiscConfigs.allowedCategories.includes(message.channel.parentID) &&                    // Channel is not in allowed category.
            !message.member.roles.cache.find((x) => x.id === Config.DiscordBot.Roles.Staff) &&      // Making sure the user isn't staff.
            !message.member.roles.cache.find((x) => x.id === Config.DiscordBot.Roles.BotAdmin)      // Making sure the user isn't a bot Administrator.
        ) return;

        if (!isSafeCommandName(command)) {
            await message.reply("Command not found.").catch(() => {});
            return;
        }

        const categories = fs.readdirSync(COMMANDS_DIR).filter((name) => {
            if (!isSafeCommandName(name)) return false;
            return fs.statSync(path.join(COMMANDS_DIR, name)).isDirectory();
        });

        if (categories.includes(command)) {
            if (!args[0]) {
                const helpFilePath = resolveCommandModule([command, "help.js"]);
                if (helpFilePath) {
                    let commandFile = require(helpFilePath);
                    await commandFile.run(client, message, args);
                } else {
                    message.reply("Help command not found.");
                }
            } else {
                const subCommand = args[0].toLowerCase();
                const commandFilePath = resolveCommandModule([command, `${subCommand}.js`]);
                if (commandFilePath) {
                    let commandFile = require(commandFilePath);
                    await commandFile.run(client, message, args);
                } else {
                    message.reply("Sub-command not found.");
                }
            }
        } else {
            const commandFilePath = resolveCommandModule([`${command}.js`]);
            if (commandFilePath) {
                let commandFile = require(commandFilePath);
                await commandFile.run(client, message, args);
            } else {
                await message.reply("Command not found.").catch(() => {});
            }
        }
    } catch (Error) {
        Sentry.captureException(Error);
    }
};