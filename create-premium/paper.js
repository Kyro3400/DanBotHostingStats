module.exports = {
    isGameServer: true,
    isDisabled: false,
    subCategory: "Minecraft",
    createServer: createServer
}

function createServer(ServerName, UserID){
    return {
        name: ServerName,
        user: UserID,
        nest: 1,
        egg: 3,
        docker_image: "ghcr.io/pterodactyl/yolks:java_17",
        startup:
            "java -Xms128M -Xmx{{SERVER_MEMORY}}M -Dterminal.jline=false -Dterminal.ansi=true -jar {{SERVER_JARFILE}}",
        limits: {
            memory: 6144,
            swap: -1,
            disk: 0,
            io: 500,
            cpu: 0,
        },
        environment: {
            MINECRAFT_VERSION: "latest",
            SERVER_JARFILE: "server.jar",
            DL_PATH:
                "https://papermc.io/api/v2/projects/paper/versions/1.16.5/builds/503/downloads/paper-1.16.5-503.jar",
            BUILD_NUMBER: "latest",
        },
        feature_limits: {
            databases: 2,
            allocations: 5,
            backups: 10,
        },
        deploy: {
            locations: gamingPREM,
            dedicated_ip: false,
            port_range: [],
        },
        start_on_completion: false,
        oom_disabled: false,
    }
};