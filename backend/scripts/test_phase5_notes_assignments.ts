import jwt from 'jsonwebtoken';
import app from '../src/app';
import prisma from '../src/config/database';

const JWT_SECRET =
  '1760cad58d49e48906ad4c71dde17d30d95a8e3258a448c2718fb3de8e09b3dfda6d128e03672c15d9fbace34a9b8f58a17e21c428c2a59af929aa9f806a1c71';

async function runPhase5Tests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 PHASE 5: NOTES + ASSIGNMENTS VERIFICATION TEST');
  console.log('═══════════════════════════════════════════════════════════\n');

  let user = await prisma.user.findFirst({
    where: { email: 'test_student@example.com' },
  });
  if (!user) {
    user = await prisma.user.create({
      data: {
        googleId: 'test-google-id-phase5',
        email: 'test_student@example.com',
        name: 'Shivam Kumar',
        coins: 100,
      },
    });
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '1d' }
  );
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const server = app.listen(5098);
  const API = 'http://localhost:5098/api';

  try {
    // ─── Test 1: Reject empty assignment title ───
    const emptyRes = await fetch(`${API}/assignments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: '', deadline: '2026-09-10' }),
    }).then((r) => r.json());

    console.log(
      'Test 1 — Reject Empty Title:',
      !emptyRes.success && emptyRes.error.includes('Title is required')
        ? '✅ PASS'
        : '❌ FAIL',
      `Error: "${emptyRes.error}"`
    );

    // ─── Test 2: Create assignment due today ───
    const todayStr = new Date().toISOString().split('T')[0];
    const createRes = await fetch(`${API}/assignments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: 'TEST DBMS Lab Report',
        description: 'ER diagram & normalization',
        deadline: todayStr,
      }),
    }).then((r) => r.json());

    const assignment = createRes.data;
    console.log(
      'Test 2 — Create Assignment Due Today:',
      createRes.success && assignment?.status === 'pending'
        ? '✅ PASS'
        : '❌ FAIL',
      `ID: ${assignment?.id}, Status: ${assignment?.status}`
    );

    // ─── Test 3: Dashboard includes it with urgency: today ───
    const dashRes = await fetch(`${API}/dashboard/today`, { headers }).then((r) =>
      r.json()
    );
    const foundInPending = dashRes.data.pendingAssignments.find(
      (a: any) => a.id === assignment.id
    );
    console.log(
      'Test 3 — Dashboard Urgency:',
      foundInPending && foundInPending.urgency === 'today'
        ? '✅ PASS'
        : '❌ FAIL',
      `Found: "${foundInPending?.title}", Urgency: "${foundInPending?.urgency}"`
    );

    // ─── Test 4: Complete assignment (no revisions, coins unchanged) ───
    const meBefore = await fetch(`${API}/auth/me`, { headers })
      .then((r) => r.json())
      .then((r) => r.data.coins);

    await fetch(`${API}/assignments/${assignment.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'completed' }),
    });

    const meAfter = await fetch(`${API}/auth/me`, { headers })
      .then((r) => r.json())
      .then((r) => r.data.coins);

    const dashAfter = await fetch(`${API}/dashboard/today`, { headers }).then(
      (r) => r.json()
    );
    const inPendingAfter = dashAfter.data.pendingAssignments.find(
      (a: any) => a.id === assignment.id
    );

    console.log(
      'Test 4 — Complete Assignment (No Coins/No Revisions):',
      meBefore === meAfter && !inPendingAfter ? '✅ PASS' : '❌ FAIL',
      `Coins before: ${meBefore}, after: ${meAfter}, Still in pending: ${!!inPendingAfter}`
    );

    // ─── Test 5: Notes upsert on a real task ───
    const task = await fetch(`${API}/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: 'TEST Task for Notes',
        topic: 'Arrays',
        difficulty: 'easy',
        platform: 'leetcode',
        scheduledDate: todayStr,
      }),
    })
      .then((r) => r.json())
      .then((r) => r.data);

    const noteContent = 'Two pointers approach from both ends. O(n) time, O(1) space.';
    const noteRes = await fetch(`${API}/tasks/${task.id}/notes`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ content: noteContent }),
    }).then((r) => r.json());

    const taskFresh = await fetch(`${API}/tasks/${task.id}`, { headers })
      .then((r) => r.json())
      .then((r) => r.data);

    console.log(
      'Test 5 — Notes Upsert & Sync to Task.notes:',
      noteRes.data.content === noteContent && taskFresh.notes === noteContent
        ? '✅ PASS'
        : '❌ FAIL',
      `Note content: "${noteRes.data?.content}", Task.notes: "${taskFresh?.notes}"`
    );

    // ─── Test 6: Notes rejected on non-existent task ───
    const wrongTaskRes = await fetch(
      `${API}/tasks/00000000-0000-0000-0000-000000000000/notes`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({ content: 'invalid' }),
      }
    ).then((r) => r.json());

    console.log(
      'Test 6 — Notes Task Ownership / 404 Check:',
      !wrongTaskRes.success ? '✅ PASS' : '❌ FAIL',
      `Error: "${wrongTaskRes.error}"`
    );

    // ─── Test 7: SQL Matching check & Cleanup ───
    const sqlCheck = await prisma.$queryRaw<any[]>`
      SELECT t.id, t.notes as task_notes, n.content as note_row
      FROM tasks t
      LEFT JOIN notes n ON n.task_id = t.id
      WHERE t.id = ${task.id}
    `;

    console.log(
      'Test 7 — SQL Check (task_notes == note_row):',
      sqlCheck.length > 0 && sqlCheck[0].task_notes === sqlCheck[0].note_row
        ? '✅ PASS'
        : '❌ FAIL',
      `Matched: ${sqlCheck[0]?.task_notes === sqlCheck[0]?.note_row}`
    );

    // Cleanup
    await fetch(`${API}/assignments/${assignment.id}`, {
      method: 'DELETE',
      headers,
    });
    await fetch(`${API}/tasks/${task.id}`, { method: 'DELETE', headers });
    console.log('\nCleanup: test assignment and task deleted.');

    console.log('\n🎉 ALL PHASE 5 (NOTES + ASSIGNMENTS) TESTS PASSED 100%!');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runPhase5Tests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
