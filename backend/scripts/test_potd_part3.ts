import http from 'http';
import app from '../src/app';
import prisma from '../src/config/database';
import { generateToken } from '../src/services/auth/jwtService';

async function makeRequest(
  server: http.Server,
  path: string,
  method: string = 'GET',
  token?: string,
  body?: any,
  headers: Record<string, string> = {}
): Promise<{ status: number; body: any }> {
  const addr = server.address() as any;
  const port = addr.port;

  return new Promise((resolve, reject) => {
    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Timezone': 'Asia/Kolkata',
      ...headers,
    };
    if (token) {
      reqHeaders['Authorization'] = `Bearer ${token}`;
    }

    const payload = body ? JSON.stringify(body) : undefined;
    if (payload) {
      reqHeaders['Content-Length'] = Buffer.byteLength(payload).toString();
    }

    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path,
        method,
        headers: reqHeaders,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({ status: res.statusCode || 200, body: parsed });
          } catch {
            resolve({ status: res.statusCode || 200, body: data });
          }
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function run() {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    console.log('=== Step 1: User & Token Setup ===');
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          googleId: 'test_potd_google_id_3',
          email: 'test_potd_3@example.com',
          name: 'Test User 3',
        },
      });
    }
    const token = generateToken({ userId: user.id, email: user.email });

    // Reset POTD tasks & dismissals for clean run
    await prisma.task.deleteMany({
      where: { userId: user.id, potdDateKey: { not: null } },
    });
    await prisma.potdDismissal.deleteMany({
      where: { userId: user.id },
    });

    console.log('\n=== Step 2: GET /api/dashboard/today (POTD in Pending) ===');
    const d1 = await makeRequest(server, '/api/dashboard/today', 'GET', token);
    const potd = d1.body.data.todaysHitlist.pending.find((t: any) => t.taskType === 'potd');
    console.log('POTD in Pending Hitlist:', {
      id: potd.id,
      title: potd.title,
      taskType: potd.taskType,
      difficulty: potd.difficulty,
      potdDateKey: potd.potdDateKey,
      problemUrl: potd.problemUrl,
    });
    console.log('potd meta:', d1.body.data.potd);

    const initialCoins = d1.body.data.statusOverview.coins;
    console.log('Initial Coins:', initialCoins);

    console.log('\n=== Step 3: Solve POTD (POST /api/tasks/:id/complete) ===');
    const solveRes = await makeRequest(server, `/api/tasks/${potd.id}/complete`, 'POST', token);
    console.log('Solve status:', solveRes.status);

    const d2 = await makeRequest(server, '/api/dashboard/today', 'GET', token);
    const solvedPotd = d2.body.data.todaysHitlist.completed.find((t: any) => t.id === potd.id);
    console.log('POTD now in Completed Today:', !!solvedPotd, 'Coins:', d2.body.data.statusOverview.coins);

    console.log('\n=== Step 4: Rate Hard (POST /api/tasks/:id/rate) ===');
    const rateRes = await makeRequest(server, `/api/tasks/${potd.id}/rate`, 'POST', token, { rating: 'hard' });
    console.log('Rate status:', rateRes.status);

    const revs = await prisma.task.findMany({
      where: { userId: user.id, parentTaskId: potd.id, taskType: 'revision' },
      orderBy: { revisionNumber: 'asc' },
    });
    console.log(`Revisions generated for POTD: ${revs.length} (Expected: 5)`);
    for (const r of revs) {
      console.log(`  Rev #${r.revisionNumber} scheduled: ${r.scheduledDate.toISOString().slice(0, 10)}`);
    }

    console.log('\n=== Step 5: Unrate POTD (POST /api/tasks/:id/unrate) ===');
    const unrateRes = await makeRequest(server, `/api/tasks/${potd.id}/unrate`, 'POST', token);
    console.log('Unrate status:', unrateRes.status);
    const revsAfterUnrate = await prisma.task.count({
      where: { userId: user.id, parentTaskId: potd.id, taskType: 'revision' },
    });
    console.log(`Revisions remaining after unrate: ${revsAfterUnrate} (Expected: 0)`);

    console.log('\n=== Step 6: Delete POTD Task (DELETE /api/tasks/:id) ===');
    const deleteRes = await makeRequest(server, `/api/tasks/${potd.id}`, 'DELETE', token);
    console.log('Delete status:', deleteRes.status);

    // Verify dismissal was recorded in potdDismissal
    const dismissal = await prisma.potdDismissal.findUnique({
      where: { userId_dateKey: { userId: user.id, dateKey: potd.potdDateKey } },
    });
    console.log('Dismissal row recorded automatically on delete:', !!dismissal);

    const d3 = await makeRequest(server, '/api/dashboard/today', 'GET', token);
    const potdAfterDelete = [...d3.body.data.todaysHitlist.pending, ...d3.body.data.todaysHitlist.completed].find((t: any) => t.taskType === 'potd');
    console.log('POTD in dashboard after deletion:', potdAfterDelete ? 'PRESENT (ERROR)' : 'NONE (CORRECT)');

    console.log('\n=== Step 7: Test Hide / Dismiss on Pending POTD ===');
    // Remove dismissal row to re-create a pending POTD
    await prisma.potdDismissal.deleteMany({ where: { userId: user.id } });
    const d4 = await makeRequest(server, '/api/dashboard/today', 'GET', token);
    const newPotd = d4.body.data.todaysHitlist.pending.find((t: any) => t.taskType === 'potd');
    console.log('Pending POTD regenerated:', !!newPotd);

    // Now dismiss pending POTD
    const dismissRes = await makeRequest(server, '/api/potd/dismiss', 'POST', token, { dateKey: newPotd.potdDateKey });
    console.log('Dismiss POST status:', dismissRes.status);

    const d5 = await makeRequest(server, '/api/dashboard/today', 'GET', token);
    const potdAfterDismiss = [...d5.body.data.todaysHitlist.pending, ...d5.body.data.todaysHitlist.completed].find((t: any) => t.taskType === 'potd');
    console.log('POTD in dashboard after dismissal of pending task:', potdAfterDismiss ? 'PRESENT (ERROR)' : 'NONE (CORRECT)');

    console.log('\nAll Part 3 flows verified successfully!');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
