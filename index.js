const { program } = require('commander');
const fs = require('fs');
const express = require('express');
const app = express();
const path = require('path');
const multer = require('multer');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');    

program
    .requiredOption('-h, --host <host>')
    .requiredOption('-p, --port <int>')
    .requiredOption('-c, --cache <path>');

program.parse(process.argv);
const options = program.opts();
const upload = multer({ dest: path.join(options.cache, 'uploads') });
const inventoryFile = path.join(options.cache, 'inventory.json');

async function ensureCacheDir() {
    try {
        await fs.promises.access(path.join(options.cache));
    } catch {
        await fs.promises.mkdir(options.cache, { recursive: true });
    }
}
async function ensureInventoryFile() {
    try {
        await fs.promises.access(inventoryFile);
    } catch {
        await fs.promises.writeFile(inventoryFile, JSON.stringify([]));
    }
}
async function readInventory() { 
    return JSON.parse(await fs.promises.readFile(inventoryFile, 'utf8')); 
}
async function writeInventory(data) { 
    await fs.promises.writeFile(inventoryFile, JSON.stringify(data, null, 2)); 
}

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Inventory API',  
      version: '1.0.0',
    },
    servers: [{ url: `http://${options.host}:${options.port}` }],
  },
  apis: ['./index.js'] 
};

app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerJsdoc(swaggerOptions)));

let nextId = 1;

/**
 * @swagger
 * /register:
 *   post:
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - inventory_name
 *             properties:
 *               inventory_name:
 *                 type: string
 *               description:
 *                 type: string
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: item registered
 *       400:
 *         description: error validation
 */
app.post('/register', upload.single('photo'), async (req, res) => {
    const { inventory_name, description } = req.body;
    if (!inventory_name) return res.status(400).send('Name is required');

    const item = { 
        id: nextId++, 
        inventory_name: inventory_name, 
        description: description || '', 
        photo: req.file ? req.file.filename : null,
    };

    const list = await readInventory();
    list.push(item);
    await writeInventory(list);
    res.status(201).json(item);
});

/**
 * @swagger
 * /inventory:
 *   get:
 *     responses:
 *       200:
 *         description: items list
 */
app.get('/inventory', async (req, res) => { res.status(200).json(await readInventory()); });

/**
 * @swagger
 * /inventory/{id}:
 *   get:   
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Item details
 *       404:
 *         description: Item not found
 */
app.get('/inventory/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const list = await readInventory();
    const item = list.find(i => i.id === id);
    
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.status(200).json(item);
});
/**
 * @swagger
 * /inventory/{id}:
 *   put:
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               inventory_name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Item updated
 *       404:
 *         description: Item not found
 */
app.put('/inventory/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const list = await readInventory();
    const item = list.find(i => i.id === id);
    
    if (!item) return res.status(404).json({ error: 'Item not found' });
    
    const { inventory_name, description } = req.body;
    if (inventory_name) item.inventory_name = inventory_name;
    if (description) item.description = description;
    
    await writeInventory(list);
    res.status(200).json(item);
});
/**
 * @swagger
 * /inventory/{id}/photo:
 *   get:
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Photo file
 *       404:
 *         description: Photo not found
 */
app.get('/inventory/:id/photo', async (req, res) => {
    const id = parseInt(req.params.id); 
    const list = await readInventory();
    const item = list.find(i => i.id === id);
    if (!item || !item.photo) return res.status(404).json({ error: 'Photo not found' });

    const photoPath = path.resolve(options.cache, 'uploads', path.basename(item.photo));

    try {
        await fs.promises.access(photoPath);
        res.setHeader("Content-Type", "image/jpeg");
        res.sendFile(photoPath);
    } catch (err) {
        res.status(404).json({ error: 'Photo file not found' });
    }
});
/**
 * @swagger
 * /inventory/{id}/photo:
 *   put:
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - photo
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Photo updated
 *       404:
 *         description: Photo not found
 */
app.put('/inventory/:id/photo', upload.single('photo'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const list = await readInventory();
        const item = list.find(i => i.id === id);
        
        if (!item) return res.status(404).json({ error: 'Item not found' });
        if (!req.file) return res.status(400).json({ error: 'Photo is required' });
        if (item.photo) await fs.promises.unlink(path.join(options.cache, 'uploads', item.photo));
        
        item.photo = req.file.filename;
        await writeInventory(list);
        res.status(200).json({ message: 'Photo updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error updating photo' });
    }
});
/**
 * @swagger
 * /inventory/{id}:
 *   delete:
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Item deleted
 *       404:
 *         description: Item not found
 */
app.delete('/inventory/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const list = await readInventory();
    const itemIndex = list.findIndex(i => i.id === id);
    
    if (itemIndex === -1) return res.status(404).json({ error: 'Item not found' });
    
    const item = list[itemIndex];
    
    if (item.photo) {
        const photoPath = path.join(options.cache, 'uploads', item.photo);
        try {
            await fs.promises.unlink(photoPath);
        } catch (err) {
            console.log('Photo not found or already deleted');
        }
    }
    
    list.splice(itemIndex, 1);
    await writeInventory(list);
    
    res.status(200).json({ message: 'Item deleted successfully' });
});

app.get('/RegisterForm.html', (req, res) => { res.sendFile(path.join(path.resolve(), 'src', 'RegisterForm.html')); });
app.get('/SearchForm.html', (req, res) => { res.sendFile(path.join(path.resolve(), 'src', 'SearchForm.html')); });
/**
 * @swagger
 * /search:
 *   post:
 *     requestBody:
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *             properties:
 *               id:
 *                 type: integer
 *               has_photo:
 *                 type: string
 *     responses:
 *       200:
 *         description: Item found
 *       404:
 *         description: Item not found
 */
app.post('/search', async (req, res) => {
    const id = parseInt(req.body.id);
    const includePhoto = req.body.includePhoto === 'on';
    const list = await readInventory();
    const item = list.find(i => i.id === id);
    
    if (!item) return res.status(404).json({ error: 'Item not found' });
    
    let description = item.description;
    if (includePhoto && item.photo) {
        description += ` Photo: ${item.photo}`;
    }
    
    res.status(200).json({
        id: item.id,
        inventory_name: item.inventory_name,
        description: description,
        photo_url: item.photo
    });
});

app.use((req, res) => { res.status(405).json({ error: 'Method not allowed' }); });

(async () => {
    await ensureCacheDir();
    await ensureInventoryFile();

    const list = await readInventory();
    if (list.length > 0) {
        nextId = Math.max(...list.map(item => item.id)) + 1;
    }

    app.listen(options.port, options.host, () => {
        console.log(`Server listening on http://${options.host}:${options.port}`);
    });
})();