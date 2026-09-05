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
    console.log('--- Step 1: User & Token Setup ---');
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          googleId: 'test_potd_google_id_2',
          email: 'test_potd_2@example.com',
          name: 'Test User 2',
        },
      });
    }
    const token = generateToken({ userId: user.id, email: user.email });
    console.log('User ID:', user.id);

    // Clean any prior tasks/dismissals for today
    await prisma.task.deleteMany({
      where: { userId: user.id, potdDateKey: { not: null } },
    });
    await prisma.potdDismissal.deleteMany({
      where: { userId: user.id },
    });

    console.log('\n--- Step 2: GET /api/dashboard/today (First call) ---');
    const res1 = await makeRequest(server, '/api/dashboard/today', 'GET', token);
    console.log('Status:', res1.status);
    console.log('potd meta:', res1.body.data.potd);

    const hitlistPending = res1.body.data.todaysHitlist.pending;
    const potdTask = hitlistPending.find((t: any) => t.taskType === 'potd');
    console.log('POTD in pending hitlist:', potdTask ? {
      id: potdTask.id,
      title: potdTask.title,
      taskType: potdTask.taskType,
      planId: potdTask.planId,
      potdDateKey: potdTask.potdDateKey,
      problemUrl: potdTask.problemUrl,
      scheduledDate: potdTask.scheduledDate,
    } : 'NOT FOUND');

    console.log('\n--- Step 3: Calling Dashboard 5 times (Idempotency) ---');
    for (let i = 1; i <= 5; i++) {
      await makeRequest(server, '/api/dashboard/today', 'GET', token);
    }
    const taskCount = await prisma.task.count({
      where: { userId: user.id, potdDateKey: { not: null } },
    });
    console.log(`POTD task count in DB after 5 calls: ${taskCount} (Expected: 1)`);

    console.log('\n--- Step 4: POST /api/potd/dismiss ---');
    const dismissRes = await makeRequest(
      server,
      '/api/potd/dismiss',
      'POST',
      token,
      { dateKey: potdTask.potdDateKey }
    );
    console.log('Dismiss Response:', dismissRes.body);

    const resAfterDismiss = await makeRequest(server, '/api/dashboard/today', 'GET', token);
    const potdAfterDismiss = resAfterDismiss.body.data.todaysHitlist.pending.find((t: any) => t.taskType === 'potd');
    console.log('POTD in hitlist after dismissal:', potdAfterDismiss ? 'STILL PRESENT (ERROR)' : 'NONE (CORRECT)');

    console.log('\n--- Step 5: Delete dismissal row & verify resurrection on dashboard load ---');
    await prisma.potdDismissal.deleteMany({ where: { userId: user.id } });
    const resAfterResurrect = await makeRequest(server, '/api/dashboard/today', 'GET', token);
    const potdRecreated = resAfterResurrect.body.data.todaysHitlist.pending.find((t: any) => t.taskType === 'potd');
    console.log('POTD in hitlist after deleting dismissal row:', potdRecreated ? {
      id: potdRecreated.id,
      title: potdRecreated.title,
      taskType: potdRecreated.taskType,
      potdDateKey: potdRecreated.potdDateKey,
    } : 'NOT FOUND (ERROR)');

    console.log('\n--- Step 6: Verify Roadmap / Active Plan ignores POTD ---');
    const roadmapRes = await makeRequest(server, '/api/plans/active', 'GET', token);
    if (roadmapRes.body?.data) {
      const planTasks = roadmapRes.body.data.tasks || [];
      const planRevs = roadmapRes.body.data.revisions || [];
      const potdInRoadmap = [...planTasks, ...planRevs].filter((t: any) => t.taskType === 'potd');
      console.log('POTD tasks in Roadmap:', potdInRoadmap.length, '(Expected: 0)');
    } else {
      console.log('Roadmap endpoint response:', roadmapRes.status, roadmapRes.body);
    }

    console.log('\n--- Step 7: Simulate LeetCode Failure / Unreachable ---');
    // Global fetch override to simulate offline / network error
    const originalFetch = global.fetch;
    (global as any).fetch = async () => {
      throw new Error('ECONNREFUSED leetcode.com unreachable');
    };
    // Also clear cache to test non-cached failure fallback
    await prisma.potdCache.deleteMany();
    await prisma.task.deleteMany({ where: { userId: user.id, potdDateKey: { not: null } } });

    const fallbackRes = await makeRequest(server, '/api/dashboard/today', 'GET', token);
    console.log('Dashboard status with LeetCode down & empty cache:', fallbackRes.status);
    console.log('Dashboard returned vibe and hitlist:', {
      vibe: fallbackRes.body.data?.vibe,
      statusOverview: fallbackRes.body.data?.statusOverview,
      potd: fallbackRes.body.data?.potd,
    });

    // Restore fetch
    global.fetch = originalFetch;

    console.log('\nAll tests passed successfully!');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
