function jinheBirthdayGuard(book, context, anchor, ops) {
  const chat = context.chat || [];
  const floor = chat.findIndex((row, i) => pt(row) && ft(row, i) === anchor);
  let state;
  for (let i = floor; i >= 0 && !state; i--) {
    const row = chat[i];
    state = row.variables?.[row.swipe_id ?? 0]?.stat_data;
  }
  const people = new Map();
  for (const person of [...Object.values(state?.collection?.roster || {}), ...Object.values(state?.active_girls || {})]) {
    if (person?.name && person.age_tag) people.set(person.name, person.age_tag);
  }
  const calendar = Ie(book, 'sheet_global_data');
  const dateCell = calendar?.headers.indexOf('当前时间');
  const proposedDate = ops.findLast(op => Ie(book, op.table) === calendar &&
    (op.column === '当前时间' || op.row?.当前时间));
  const today = String(proposedDate?.value || proposedDate?.row?.当前时间 ||
    calendar?.rows.values().next().value?.[dateCell] || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  const known = new Map();
  for (const table of book.tables.values()) {
    const birthday = table.headers.indexOf('生日'), name = table.headers.indexOf('姓名');
    if (birthday < 1 || name < 1) continue;
    for (const row of table.rows.values()) {
      if (row[name] && row[birthday]) known.set(table.tableId + '|' + row[name], row[birthday]);
    }
  }
  function firstDate(value, ageTag) {
    const birth = String(value || '').match(/^\d{4}-(\d{2})-(\d{2})$/);
    const age = String(ageTag || '').match(/^(\d{1,3})(?:周?岁)?$/);
    if (!today || !birth || !age || Number(age[1]) > 120) return value;
    const monthDay = birth[1] + '-' + birth[2];
    const year = Number(today[1]) - Number(age[1]) - Number(monthDay > today[2] + '-' + today[3]);
    const lastDay = new Date(Date.UTC(year, Number(birth[1]), 0)).getUTCDate();
    if (+birth[1] < 1 || +birth[1] > 12 || +birth[2] < 1) return value;
    return year + '-' + birth[1] + '-' + String(Math.min(+birth[2], lastDay)).padStart(2,'0');
  }
  return op => {
    const table = Ie(book, op.table);
    if (!table) return op;
    const b = table.headers.indexOf('生日'), n = table.headers.indexOf('姓名');
    if (b < 1 || n < 1) return op;
    const row = table.rows.get(Number(op.rowId));
    const cell = op.kind === 'cell' && op.column === '生日';
    const insert = op.kind === 'row_insert', upsert = op.kind === 'row_upsert';
    if (!cell && !insert && !upsert) return op;
    const name = (insert ? op.row?.姓名 : upsert ? op.cells?.[n] : null) || row?.[n];
    const key = table.tableId + '|' + name;
    const fixed = row?.[b] || (name && known.get(key));
    if (cell && fixed && row?.[b] === fixed) return null;
    const input = cell ? op.value : insert ? op.row?.生日 : op.cells?.[b];
    const age = table.tableId === 'sheet_protagonist' ? state?.player?.return_profile?.age : people.get(name);
    const value = fixed || firstDate(input, age);
    if (name && value) known.set(key,value);
    if (value === input) return op;
    if (cell) return {...op,value};
    if (insert) return {...op,row:{...op.row,生日:value}};
    const cells = [...(op.cells || [])];
    cells[b] = value;
    return {...op,cells};
  };
}
