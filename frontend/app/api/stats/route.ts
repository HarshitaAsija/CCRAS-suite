import { NextResponse } from 'next/server';
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  let envPath = path.resolve(process.cwd(), '../.env');
  let envVars: Record<string, string> = {};
  
  try {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      content.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          envVars[match[1].trim()] = match[2].trim();
        }
      });
    }
  } catch (e) {
    console.error("Error reading .env:", e);
  }

  const host = process.env.CCRAS_DB_HOST || envVars.CCRAS_DB_HOST || envVars.POSTGRES_SERVER || '100.101.210.91';
  const port = parseInt(process.env.CCRAS_DB_PORT || envVars.CCRAS_DB_PORT || envVars.POSTGRES_PORT || '5432');
  const database = process.env.CCRAS_DB_NAME || envVars.CCRAS_DB_NAME || envVars.POSTGRES_DB || 'ccras_db';
  const user = process.env.CCRAS_DB_USER || envVars.CCRAS_DB_USER || envVars.POSTGRES_USER || 'anshika';
  const password = process.env.CCRAS_DB_PASSWORD || envVars.CCRAS_DB_PASSWORD || envVars.POSTGRES_PASSWORD || 'anshi_123';

  const client = new Client({ 
    host, 
    port, 
    database, 
    user, 
    password,
    connectionTimeoutMillis: 8000,
  });

  const getCount = async (table: string): Promise<number> => {
    try {
      const res = await client.query(`SELECT count(*) FROM "${table}"`);
      return parseInt(res.rows[0].count, 10);
    } catch {
      return 0;
    }
  };

  try {
    await client.connect();

    // Papers Ingested: main papers + uploaded papers
    const papers = await getCount('papers');
    const uploadedPapers = await getCount('uploaded_papers');
    const papersIngested = papers + uploadedPapers;

    // Entities Discovered
    const entitiesDiscovered = await getCount('entities');

    // Active Hypotheses
    const activeHypotheses = await getCount('hypothesis_seeds');

    // Graph Nodes
    const graphNodes = await getCount('relationship_instances');

    // Research Gaps
    const researchGaps = await getCount('gap_candidates');

    // Studies created
    const contradictions = await getCount('studies');

    await client.end();

    return NextResponse.json({
      papersIngested,
      entitiesDiscovered,
      activeHypotheses,
      graphNodes,
      researchGaps,
      contradictions,
      papers,
      uploadedPapers,
    }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' }
    });
  } catch (error: any) {
    console.error('PostgreSQL connection failed:', error?.message);
    if (client) await client.end().catch(() => {});
    return NextResponse.json(
      { error: 'Failed to connect to database', details: error.message }, 
      { status: 500 }
    );
  }
}
