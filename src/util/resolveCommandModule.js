const fs = require("fs");
const path = require("path");

const COMMANDS_DIR = path.resolve(__dirname, "../commands");
const SAFE_COMMAND_NAME = /^[a-z0-9-]+$/;

/**
 * @param {string} name
 * @returns {boolean}
 */
function isSafeCommandName(name) {
    return typeof name === "string" && SAFE_COMMAND_NAME.test(name);
}

/**
 * Resolves a command module path under src/commands and rejects traversal.
 *
 * @param {string[]} relativeParts - e.g. ["staff", "code.js"] or ["ping.js"]
 * @returns {string | null}
 */
function resolveCommandModule(relativeParts) {
    if (!Array.isArray(relativeParts) || relativeParts.length === 0) {
        return null;
    }

    for (const part of relativeParts) {
        if (typeof part !== "string" || part.length === 0) {
            return null;
        }

        if (part.includes("/") || part.includes("\\")) {
            return null;
        }

        const baseName = part.endsWith(".js") ? part.slice(0, -3) : part;
        if (!isSafeCommandName(baseName)) {
            return null;
        }
    }

    const filePath = path.resolve(COMMANDS_DIR, ...relativeParts);
    const commandsPrefix = COMMANDS_DIR + path.sep;

    if (filePath !== COMMANDS_DIR && !filePath.startsWith(commandsPrefix)) {
        return null;
    }

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        return null;
    }

    return filePath;
}

module.exports = {
    COMMANDS_DIR,
    isSafeCommandName,
    resolveCommandModule,
};
