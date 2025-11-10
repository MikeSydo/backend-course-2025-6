const { program } = require('commander');
const fs = require('fs');
const express = require('express');
const app = express();

program
    .requiredOption('-h, --host <host>')
    .requiredOption('-p, --port <int>')
    .requiredOption('-c, --cache <path>');

program.parse(process.argv);
const options = program.opts();

async function ensureCacheDir() {
    try {
        await fs.promises.access(options.cache);
    } catch {
        await fs.promises.mkdir(options.cache, { recursive: true });
    }
}

app.get('/', async (req, res) => {
    res.send('Test server');
});

(async () => {
    await ensureCacheDir();
    app.listen(options.port, options.host, () => {
        console.log(`Server listening on http://${options.host}:${options.port}`);
    });
})();