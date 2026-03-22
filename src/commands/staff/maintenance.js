const Discord = require("discord.js");
const Config = require('../../../config.json');
const db = require('../../database.js');

exports.description = "Put a Node in maintenance.";

/**
 * 
 * @param {Discord.Client} client
 * @param {Discord.Message} message
 * @param {Array} args
 * @returns void
 */
exports.run = async (client, message, args) => {

    //Checks if the user has the Bot System Administrator Role.
    if (!message.member.roles.cache.find((r) => r.id === Config.DiscordBot.Roles.BotAdmin)) return;

    if (!args[1] || args[1].toLowerCase() === "help") {
        const prefix = Config.DiscordBot.Prefix;
        const embed = new Discord.EmbedBuilder()
            .setTitle('Maintenance Command Help')
            .setDescription(`Toggle maintenance mode for a node.\n\n**Usage:**\n\`${prefix}staff maintenance <NodeName>\`\n\n**Example:**\n\`${prefix}staff maintenance node1\`\n\n**What it does:**\n- Puts a node into or out of maintenance mode.\n- Only Bot System Administrators can use this command.`)
            .addFields([
                { name: 'Arguments', value: '`<NodeName>` — The database name of the node to toggle maintenance for.' },
                { name: 'Permissions', value: 'Requires the Bot System Administrator role.' },
                { name: 'Notes', value: 'Maintenance mode disables user access to the node.' }
            ])
            .setColor(0x5865F2);

        const row = new Discord.ActionRowBuilder()
            .addComponents(
                new Discord.ButtonBuilder()
                    .setCustomId('maintenance_help_close')
                    .setLabel('Close')
                    .setStyle(Discord.ButtonStyle.Danger)
            );

        const helpMsg = await message.reply({
            embeds: [embed],
            components: [row],
            allowedMentions: { repliedUser: false }
        });

        // Create a collector for the close button
        const filter = (i) => i.customId === 'maintenance_help_close' && i.user.id === message.author.id;
        const collector = helpMsg.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async (interaction) => {
            await interaction.update({ content: 'Help menu closed.', embeds: [], components: [] }).catch(() => {});
        });
        collector.on('end', async (_, reason) => {
            if (reason === 'time') {
                await helpMsg.edit({ content: 'Help menu expired.', embeds: [], components: [] }).catch(() => {});
            }
        });
        return;
    } else {
        const Data = await db.getNodeStatus(args[1].toLowerCase());

        if (Data == null) {
            return await message.reply("Invalid Node provided. Please provide a valid Node DB name.");
        } else {
            try {
                if (Data.maintenance) {
                    await db.setNodeStatusFields(args[1], { maintenance: false });
                    await message.reply(`Successfully put ${args[1]} out of maintenance mode.`);
                } else if (Data.maintenance == false) {
                    await db.setNodeStatusFields(args[1], { maintenance: true });
                    await message.reply(`Successfully put ${args[1]} into maintenance mode.`);
                } else if (Data.maintenance == null) {
                    await db.setNodeStatusFields(args[1], { maintenance: false });
                    await message.reply(`Successfully put ${args[1]} into maintenance mode (FIRST).`);
                }
            } catch (err) {
                await message.reply(`Unable to update maintenance mode for ${args[1]}.`);
            }
        }
    }
};
