const shell = require("shelljs");

shell.mkdir("-p", "build/public");
shell.cp("-R", "src/server/config.json", "build/server/config.json");
shell.cp("-R", "src/public/css", "build/public/css");
shell.cp("-R", "src/public/index.html", "build/public/index.html");
