const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkNDM1M2U5Yi1jYTk2LTRjOGQtOTAyNC1mOGFlNzhkYzIxZmIiLCJlbWFpbCI6InNoaTl2YW01a3VtN2FyQGdtYWlsLmNvbSIsImlhdCI6MTc4ODQ3MzcwNywiZXhwIjoxNzg5MDc4NTA3fQ.CBny-MpzwGTTMHyPc4N2dQbCrb8omo3A1Vlz5-syM8o';
const taskId = '2b306039-732f-4981-be66-d15477383a00';

async function testUnrate() {
  console.log('--- Calling /unrate ---');
  const res = await fetch(`http://localhost:5000/api/tasks/${taskId}/unrate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  const json = await res.json();
  console.log(`STATUS: ${res.status}`);
  console.log('STATUS_FIELD:', json.data?.status, 'RATING:', json.data?.rating);
}

testUnrate().catch(console.error);
