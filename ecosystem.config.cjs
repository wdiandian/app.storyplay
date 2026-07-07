module.exports = {
  apps: [
    {
      name: "storyplay-app",
      script: "npm",
      args: "start",
      cwd: "/var/www/storyplay-app/app",
      env: {
        NODE_ENV: process.env.NODE_ENV || "production",
        HOSTNAME: process.env.HOSTNAME || "127.0.0.1",
        PORT: process.env.PORT || "3001",
        DATABASE_URL: process.env.DATABASE_URL,
        PGSSL: process.env.PGSSL || "false",
      },
    },
  ],
};
