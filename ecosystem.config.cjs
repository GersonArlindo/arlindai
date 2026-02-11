// ecosystem.config.cjs
module.exports = {
    apps: [{
        name: 'arlindai',
        script: 'bun',
        args: 'run index.ts',
        cwd: '/root/ArlinAI/arlindai',  // Ruta absoluta
        watch: false,
        env: {
            NODE_ENV: 'production',
            PORT: 3009
        },
        instances: 1,
        exec_mode: 'fork',
        autorestart: true,
        max_restarts: 10,
        min_uptime: '10s'
    }]
};