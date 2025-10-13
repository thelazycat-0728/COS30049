require("dotenv").config();

const app = require("./src/app");
const config = require("./src/config/config");

const PORT = config.server.port;

app.listen(PORT, () => {
  console.log(`🚀 Server running in ${config.server.env} mode on port ${PORT}`);
});
