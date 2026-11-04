import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URI })
const r = await pool.query(`select id, filename, "url", "prefix", "_objectkey" from media order by id`)
for (const row of r.rows) console.log(JSON.stringify(row))
await pool.end()
