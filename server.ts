import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { Pool } from 'pg';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS editor_prompts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid()
      );
      ALTER TABLE editor_prompts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      
      CREATE TABLE IF NOT EXISTS editor_prompt_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        prompt_id UUID REFERENCES editor_prompts(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } finally {
    client.release();
  }
}

// Routes
app.get('/api/health', (req, res) => {
  res.json({ hasDatabase: !!process.env.DATABASE_URL });
});

app.get('/api/prompt', async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      let result = await client.query(`
        SELECT p.id, 'Main Prompt' as title, p.created_at,
               (SELECT content FROM editor_prompt_versions pv WHERE pv.prompt_id = p.id ORDER BY pv.created_at DESC LIMIT 1) as latest_content
        FROM editor_prompts p
        ORDER BY p.created_at ASC
        LIMIT 1
      `);
      
      if (result.rows.length === 0) {
        await client.query('BEGIN');
        const promptResult = await client.query(
          "INSERT INTO editor_prompts (id) VALUES (DEFAULT) RETURNING *"
        );
        const prompt = promptResult.rows[0];
        prompt.title = 'Main Prompt';
        const versionResult = await client.query(
          "INSERT INTO editor_prompt_versions (prompt_id, content) VALUES ($1, '') RETURNING content",
          [prompt.id]
        );
        await client.query('COMMIT');
        prompt.latest_content = versionResult.rows[0].content;
        res.json(prompt);
      } else {
        res.json(result.rows[0]);
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/prompts/:id/versions', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM editor_prompt_versions WHERE prompt_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/prompts/:id/versions', async (req, res) => {
  const { content } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO editor_prompt_versions (prompt_id, content) VALUES ($1, $2) RETURNING *',
      [req.params.id, content]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/prompt_versions/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM editor_prompt_versions WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function startServer() {
  if (process.env.DATABASE_URL) {
    await initDb().catch(console.error);
  } else {
    console.warn('DATABASE_URL is not set. Database features will fail.');
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
