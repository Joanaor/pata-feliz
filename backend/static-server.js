const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.FRONTEND_PORT || 5500);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8"
};

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  const relativePath = url === "/" ? "frontend/index.html" : url.replace(/^\//, "");
  const filePath = path.resolve(root, relativePath);

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      return res.end("Not found");
    }

    res.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream"
    });
    res.end(data);
  });
}).listen(port, "127.0.0.1", () => {
  console.log(`Frontend rodando em http://127.0.0.1:${port}/frontend/index.html`);
});
