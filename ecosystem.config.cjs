// ecosystem.config.cjs
module.exports = {
    apps: [{
        name: 'arlindai',
        script: './index.ts',
        interpreter: 'bun',
        watch: false,
        env: {
            NODE_ENV: 'production',
            PORT: 3000
        },
        instances: 1,
        exec_mode: 'fork'
    }]
};