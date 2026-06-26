import * as mysql from 'mysql2/promise';

async function listTables() {
  const connection = await mysql.createConnection({
    host: '72.60.219.145',
    user: 'apparatus',
    password: 'ASPune$2210$',
    database: 'milk_delivery',
  });

  try {
    const [rows] = await connection.query('SHOW TABLES');
    // console.log(rows);
    const tableNames = (rows as any[]).map((row) => Object.values(row)[0]);
    console.log('TABLE_LIST_START');
    tableNames.forEach((name) => console.log(name));
    console.log('TABLE_LIST_END');
  } catch (error) {
    console.error('Error fetching tables:', error);
  } finally {
    await connection.end();
  }
}

listTables();
