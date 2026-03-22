const Discord = require("discord.js");

const Config = require("../../../config.json");
const Status = require("../../../config/status-configs.js");
const db = require("../../database.js");

exports.description = "Display all status-config items, keys, and live DB states using components v2.";

const ITEMS_PER_PAGE = 3;
const VIEW_TIMEOUT_MS = 5 * 60 * 1000;

function formatNullableBoolean(value) {
    if (value === true) return "true";
    if (value === false) return "false";
    return "null";
}

function getNodeStatusText(statusData, serverData, maxLimit) {
    const serverUsage = serverData
        ? `${serverData.servers}/${serverData.maxCount}`
        : `0/${maxLimit ?? 0}`;

    if (statusData?.maintenance) {
        return { text: "🟣 Maintenance", usage: serverUsage };
    }

    if (statusData?.status) {
        return { text: "🟢 Online", usage: serverUsage };
    }

    if (statusData?.is_vm_online == null) {
        return { text: "🔴 Offline", usage: serverUsage };
    }

    return {
        text: statusData.is_vm_online ? "🟠 Wings Offline" : "🔴 System Offline",
        usage: serverUsage,
    };
}

function getServiceStatusText(statusData) {
    if (statusData?.maintenance) return "🟣 Maintenance";
    return statusData?.status ? "🟢 Online" : "🔴 Offline";
}

function formatTimestamp(timestamp) {
    if (!timestamp || Number.isNaN(Number(timestamp))) return "unknown";
    return `<t:${Math.floor(Number(timestamp) / 1000)}:R>`;
}

async function buildStatusGroups() {
    const groups = [];

    for (const [nodeCategory, nodes] of Object.entries(Status.Nodes || {})) {
        const items = await Promise.all(
            Object.entries(nodes).map(async ([nodeKey, nodeData]) => {
                const [nodeStatusData, nodeServerData] = await Promise.all([
                    db.getNodeStatus(nodeKey.toLowerCase()),
                    db.getNodeServers(nodeKey.toLowerCase()),
                ]);

                const nodeStatus = getNodeStatusText(nodeStatusData, nodeServerData, nodeData.MaxLimit);

                return {
                    type: "node",
                    displayName: nodeData.Name,
                    key: nodeKey.toLowerCase(),
                    statusText: nodeStatus.text,
                    serverUsage: nodeStatus.usage,
                    dbStatus: formatNullableBoolean(nodeStatusData?.status),
                    dbIsVmOnline: formatNullableBoolean(nodeStatusData?.is_vm_online),
                    dbMaintenance: formatNullableBoolean(nodeStatusData?.maintenance),
                    lastUpdate: formatTimestamp(nodeStatusData?.timestamp),
                    nodeId: String(nodeData.ID ?? "unknown"),
                    serverId: String(nodeData.serverID ?? "unknown"),
                    maxLimit: String(nodeData.MaxLimit ?? "unknown"),
                    ip: String(nodeData.IP ?? "unknown"),
                    location: String(nodeData.Location ?? "unknown"),
                };
            })
        );

        groups.push({
            menuLabel: `Nodes - ${nodeCategory}`,
            items,
        });
    }

    for (const [category, services] of Object.entries(Status)) {
        if (category === "Nodes") continue;

        const items = await Promise.all(
            Object.entries(services).map(async ([serviceKey, serviceData]) => {
                const serviceStatusData = await db.getNodeStatus(serviceKey.toLowerCase());

                return {
                    type: "service",
                    displayName: String(serviceData.name ?? serviceKey),
                    key: serviceKey.toLowerCase(),
                    statusText: getServiceStatusText(serviceStatusData),
                    dbStatus: formatNullableBoolean(serviceStatusData?.status),
                    dbIsVmOnline: formatNullableBoolean(serviceStatusData?.is_vm_online),
                    dbMaintenance: formatNullableBoolean(serviceStatusData?.maintenance),
                    lastUpdate: formatTimestamp(serviceStatusData?.timestamp),
                    ip: String(serviceData.IP ?? "unknown"),
                    location: String(serviceData.Location ?? "unknown"),
                };
            })
        );

        groups.push({
            menuLabel: category,
            items,
        });
    }

    return groups;
}

function renderItem(item, index) {
    if (item.type === "node") {
        return [
            `### ${index}. ${item.displayName}`,
            `- Key: \`${item.key}\``,
            `- Type: Node`,
            `- Current Status: ${item.statusText}`,
            `- DB Flags: status=${item.dbStatus}, is_vm_online=${item.dbIsVmOnline}, maintenance=${item.dbMaintenance}`,
            `- Server Usage: ${item.serverUsage}`,
            `- Node Values: ID=${item.nodeId}, serverID=${item.serverId}, maxLimit=${item.maxLimit}`,
            `- Network: IP=${item.ip}, location=${item.location}`,
            `- Last Update: ${item.lastUpdate}`,
        ].join("\n");
    }

    return [
        `### ${index}. ${item.displayName}`,
        `- Key: \`${item.key}\``,
        `- Type: Service`,
        `- Current Status: ${item.statusText}`,
        `- DB Flags: status=${item.dbStatus}, is_vm_online=${item.dbIsVmOnline}, maintenance=${item.dbMaintenance}`,
        `- Values: IP=${item.ip}, location=${item.location}`,
        `- Last Update: ${item.lastUpdate}`,
    ].join("\n");
}

function buildClosedView(messageText) {
    const container = new Discord.ContainerBuilder()
        .setAccentColor(0x4f545c)
        .addTextDisplayComponents((textDisplay) =>
            textDisplay.setContent(messageText)
        );

    return [container];
}

function buildLiveView(statusGroups, selectedGroupIndex, currentPage) {
    if (!statusGroups.length) {
        return {
            components: buildClosedView("No status items were found in status-configs."),
            page: 1,
        };
    }

    const safeGroupIndex = Math.min(Math.max(selectedGroupIndex, 0), statusGroups.length - 1);
    const activeGroup = statusGroups[safeGroupIndex];
    const totalPages = Math.max(1, Math.ceil(activeGroup.items.length / ITEMS_PER_PAGE));
    const safePage = Math.min(Math.max(currentPage, 1), totalPages);

    const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
    const visibleItems = activeGroup.items.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const headerText = [
        "## Staff Status List",
        `Category: **${activeGroup.menuLabel}**`,
        `Items: **${activeGroup.items.length}** | Page: **${safePage}/${totalPages}**`,
        "Use this list to copy keys when updating status values.",
        `Maintenance toggle: \`${Config.DiscordBot.Prefix}staff maintenance <nodeKey>\``,
    ].join("\n");

    const bodyText = visibleItems.length
        ? visibleItems.map((item, i) => renderItem(item, startIndex + i + 1)).join("\n\n")
        : "No items in this category.";

    const categoryOptions = statusGroups.slice(0, 25).map((group, index) => ({
        label: group.menuLabel.slice(0, 100),
        description: `${group.items.length} item(s)`.slice(0, 100),
        value: String(index),
        default: index === safeGroupIndex,
    }));

    const categorySelect = new Discord.StringSelectMenuBuilder()
        .setCustomId("staff_status_list_category")
        .setPlaceholder("Select a status category")
        .addOptions(categoryOptions);

    const previousButton = new Discord.ButtonBuilder()
        .setCustomId("staff_status_list_prev")
        .setLabel("Previous")
        .setStyle(Discord.ButtonStyle.Secondary)
        .setDisabled(safePage <= 1);

    const nextButton = new Discord.ButtonBuilder()
        .setCustomId("staff_status_list_next")
        .setLabel("Next")
        .setStyle(Discord.ButtonStyle.Secondary)
        .setDisabled(safePage >= totalPages);

    const refreshButton = new Discord.ButtonBuilder()
        .setCustomId("staff_status_list_refresh")
        .setLabel("Refresh")
        .setStyle(Discord.ButtonStyle.Primary);

    const closeButton = new Discord.ButtonBuilder()
        .setCustomId("staff_status_list_close")
        .setLabel("Close")
        .setStyle(Discord.ButtonStyle.Danger);

    const container = new Discord.ContainerBuilder()
        .setAccentColor(0x7388d9)
        .addTextDisplayComponents((textDisplay) =>
            textDisplay.setContent(headerText)
        )
        .addSeparatorComponents((separator) => separator)
        .addTextDisplayComponents((textDisplay) =>
            textDisplay.setContent(bodyText)
        )
        .addActionRowComponents((actionRow) =>
            actionRow.setComponents(categorySelect)
        )
        .addActionRowComponents((actionRow) =>
            actionRow.setComponents(previousButton, nextButton, refreshButton, closeButton)
        );

    return {
        components: [container],
        page: safePage,
    };
}

/**
 *
 * @param {Discord.Client} client
 * @param {Discord.Message} message
 * @param {Array} args
 * @returns void
 */
exports.run = async (client, message, args) => {
    const hasStaffRole = message.member.roles.cache.find((r) => r.id === Config.DiscordBot.Roles.Staff);
    const hasBotAdminRole = message.member.roles.cache.find((r) => r.id === Config.DiscordBot.Roles.BotAdmin);

    if (!hasStaffRole && !hasBotAdminRole) return;

    let statusGroups = await buildStatusGroups();
    let selectedGroupIndex = 0;
    let currentPage = 1;

    const initialView = buildLiveView(statusGroups, selectedGroupIndex, currentPage);
    currentPage = initialView.page;

    const statusMessage = await message.reply({
        components: initialView.components,
        flags: Discord.MessageFlags.IsComponentsV2,
        allowedMentions: { repliedUser: false },
    });

    const collector = statusMessage.createMessageComponentCollector({
        time: VIEW_TIMEOUT_MS,
    });

    collector.on("collect", async (interaction) => {
        if (interaction.user.id !== message.author.id) {
            await interaction.reply({
                content: "Only the command user can use this status menu.",
                ephemeral: true,
            }).catch(() => {});
            return;
        }

        if (interaction.customId === "staff_status_list_close") {
            collector.stop("closed");
            await interaction.update({
                components: buildClosedView("Status list closed."),
            }).catch(() => {});
            return;
        }

        if (interaction.customId === "staff_status_list_category") {
            selectedGroupIndex = Number(interaction.values?.[0] ?? 0);
            currentPage = 1;
        } else if (interaction.customId === "staff_status_list_prev") {
            currentPage -= 1;
        } else if (interaction.customId === "staff_status_list_next") {
            currentPage += 1;
        } else if (interaction.customId === "staff_status_list_refresh") {
            statusGroups = await buildStatusGroups();
            if (!statusGroups.length) {
                selectedGroupIndex = 0;
                currentPage = 1;
            } else if (selectedGroupIndex > statusGroups.length - 1) {
                selectedGroupIndex = statusGroups.length - 1;
            }
        }

        const updatedView = buildLiveView(statusGroups, selectedGroupIndex, currentPage);
        currentPage = updatedView.page;

        await interaction.update({
            components: updatedView.components,
        }).catch(() => {});
    });

    collector.on("end", async (_, reason) => {
        if (reason === "closed") return;

        await statusMessage.edit({
            components: buildClosedView("Status list expired. Run the command again for a fresh list."),
        }).catch(() => {});
    });
};
