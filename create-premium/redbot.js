module.exports = {
    isGameServer: false,
    isDisabled: false,
    subCategory: "Bots",
    createServer: createServer
}

function createServer(ServerName, UserID){
    return {
        name: ServerName,
        user: UserID,
        nest: 5,
        egg: 72,
        docker_image: "ghcr.io/parkervcp/yolks:bot_red",
        startup:
            "PATH=$PATH:/home/container/.local/bin redbot pterodactyl --token {{TOKEN}} --prefix {{PREFIX}}",
        limits: {
            memory: 0,
            swap: -1,
            disk: 0,
            io: 500,
            cpu: 0,
        },
        environment: {
            TOKEN: "FILL_THIS_OUT",
            PREFIX: "FILL_THIS_OUT",
            OWNER: "FILL_THIS_OUT",
        },
        feature_limits: {
            databases: 2,
            allocations: 5,
            backups: 10,
        },
        deploy: {
            locations: botswebdbPREM,
            dedicated_ip: false,
            port_range: [],
        },
        start_on_completion: false,
    };
};