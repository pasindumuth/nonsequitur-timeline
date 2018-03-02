const shell = require("shelljs");

shell.mkdir("-p", "build/public");
shell.cp("-R", "src/server/config.json", "build/server/config.json");
shell.cp("-R", "src/public/", "build/public/");
