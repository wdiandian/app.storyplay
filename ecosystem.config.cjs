module.exports = {
  apps: [
    {
      name: "storyplay",
      script: "npm",
      args: "start",
      cwd: "/var/www/storyplay/app",
      env: {
        NODE_ENV: "production",
        HOSTNAME: "127.0.0.1",
        PORT: "3000",
      },
    },
  ],
};
