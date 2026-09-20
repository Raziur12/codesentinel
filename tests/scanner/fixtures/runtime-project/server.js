const http = require("node:http");

const server = http.createServer((request, response) => {
  response.end("ok");
});

server.listen(3000);
