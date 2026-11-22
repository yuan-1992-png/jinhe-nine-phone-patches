import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root=fileURLToPath(new URL('..',import.meta.url));
const read=name=>readFileSync(name,'utf8').replace(/^\uFEFF/,'');
const json=name=>JSON.parse(read(name));
const baseline=json(join(root,'patches','baseline.json'));
const anchor='const phoneHtml=__JINHE_EMBEDDED_HTML__;';
const payload=/^const phoneHtml=(".*");$/m;
const lf=value=>value.replaceAll('\r\n','\n');
const sha=value=>createHash('sha256').update(value).digest('hex');
const ids={
  phone:'ad0eae10-ae9f-46ce-993e-ded512e25003',
  zod:'ad0eae10-ae9f-46ce-993e-ded512e25001',
  turn:'ad0eae10-ae9f-46ce-993e-ded512e25002',
};
const patchNames=['phone-host','phone-ui','zod','turn','status-ui'];
const statusRegexId='6b3fa3c9-fac5-45f1-bf3d-3cab3ce25a01';
const statusScriptId='ad0eae10-ae9f-46ce-993e-ded512e25004';

function updateRule(entries) {
  const eligible=Object.values(entries||{}).filter(entry=>entry.comment==='[mvu_update]变量更新规则');
  if(eligible.length!==1) throw Error('世界书里应有一条 [mvu_update]变量更新规则。');
  const rule=eligible[0], newline=rule.content.includes('\r\n')?'\r\n':'\n';
  const oldMoney='金额为整数元，送礼、共同消费和帮付填实际对象的 ID。';
  const oldStamina=/^    stamina:\r?\n(?: {6,}[^ \r\n][^\r\n]*\r?\n){3}/m;
  if(!rule.content.includes(oldMoney)||!oldStamina.test(rule.content)) throw Error('世界书规则与原版 v1.6.4 不匹配。');
  rule.content=rule.content
    .replace(oldMoney,'金额为整数元。普通买单用 expense 并省略 person。送礼、共同消费和帮付的 person 填实际收款对象 ID，并遵守各场景原有的付款条件。id 是独立付款编号，每笔使用不同编号。')
    .replace(oldStamina,['    stamina:','      type: number（固定为 100）','      check:',
      '        - 腰力为无限，九号机显示 ∞。行动和休息均不改变这个值，变量更新中省略此字段。',''].join(newline));
}

function applyPatch(cwd,name) {
  const file=join(root,'patches',name+'.patch');
  const result=spawnSync('git',['apply','--unidiff-zero','--whitespace=nowarn',file],{
    cwd,encoding:'utf8',env:{...process.env,GIT_CEILING_DIRECTORIES:dirname(cwd)},
  });
  if(result.error) throw result.error;
  if(result.status!==0) throw Error(result.stderr.trim()||'无法应用 '+name);
}

function applySese(file) {
  const item=json(file), key='ce6d9a4b-e5f6-48e3-a908-eb42d2007e2e';
  if(item.id!==key||typeof item.content!=='string'||sha(lf(item.content))!==baseline.sesePhone) {
    throw Error('小手机脚本与 V1.308 维护版基线不匹配。');
  }
  const marker='function R(e){return L(t=>q(t,e)),B()}';
  const loader=/^  var EMBEDDED_HTML = (".*");$/m, initial=lf(item.content), match=loader.exec(initial);
  if(!match) throw Error('找不到小手机的内嵌模块。');
  let html=JSON.parse(match[1]);
  if(html.split(marker).length!==2) throw Error('找不到唯一的小手机存储适配位置。');
  html=html.replace(marker,()=>marker+'\n'+read(join(root,'integrations','sese-phone-1308.js'))+'\n');
  new vm.Script(html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i)[1]);
  item.content=initial.slice(0,match.index)+'  var EMBEDDED_HTML = '+JSON.stringify(html).replaceAll('<','\\u003c')+';'+
    initial.slice(match.index+match[0].length);
  new vm.Script(item.content);
  return item;
}

function applyLedger(file) {
  const item=json(file), source=lf(item.content || '');
  if(item.id!=='5fb341e7-cb20-433a-868b-b2fadd06caa5'||sha(source)!==baseline.seseLedger) throw Error('台账脚本与 V1.165 基线不匹配。');
  const match=/s\.textContent = (".*");/.exec(source);
  if(!match) throw Error('缺少台账内嵌模块。');
  let bundle=JSON.parse(match[1]);
  function replaceOnce(from,to) {
    if(bundle.split(from).length!==2) throw Error('台账写入入口与基线不匹配。');
    bundle=bundle.replace(from,()=>to);
  }
  const guard=read(join(root,'integrations','ledger-birthday.js')).trim();
  replaceOnce('function Fe(e,t){',guard+'\nfunction Fe(e,t){');
  replaceOnce('v();const u=qe(o),f=[];for(const e of r){const t=Fe(o,e);',
    "v();const u=qe(o),f=[],applied=[];const guard=n==='ai' && c?.characterId==='金河县的精神小妹们v1.6.4 · 九号随身机.png' ? jinheBirthdayGuard(o,c,d.anchor,r) : op=>op;for(const input of r){const e=guard(input);if(!e)continue;const t=Fe(o,e);applied.push(e);");
  replaceOnce('source:n,ops:r,changedTables:m,atTime:t()','source:n,ops:applied,changedTables:m,atTime:t()');
  item.content=source.replace(match[0],()=> 's.textContent = '+JSON.stringify(bundle).replaceAll('<','\\u003c')+';');
  new vm.Script(item.content);
  return item;
}

function mountStatusRenderer(scripts,rule,rendered) {
  const start=rendered.indexOf('<!doctype html>'),end=rendered.lastIndexOf('</html>')+'</html>'.length;
  if(start<0||end<=start||scripts.some(s=>s.id===statusScriptId)) {
    throw Error('无法生成金河县的状态栏挂载脚本。');
  }
  const html=rendered.slice(start,end);
  for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new vm.Script(match[1]);
  const content='const countyStatusHtml='+JSON.stringify(html).replaceAll('<','\\u003c')+';\n'+
    read(join(root,'integrations','status-host.js'));
  new vm.Script(content);
  scripts.push({type:'script',id:statusScriptId,name:'金河县 · 同楼层状态栏',enabled:true,content,
    info:'让状态栏跟随同一楼层和当前回答显示。',button:{enabled:false,buttons:[]},data:{},export_with:{data:true,button:true}});
  rule.replaceString='\n\n<div class="jinhe-county-status-slot" aria-label="金河县状态栏"></div>\n\n';
}

function run(cardFile,out,flags) {
  const card=json(cardFile);
  const container=card.data||card, scripts=container.extensions?.tavern_helper?.scripts;
  const records=Object.fromEntries(Object.entries(ids).map(([k,id])=>[k,scripts?.find(x=>x.id===id)]));
  for(const [k,record] of Object.entries(records)) {
    if(typeof record?.content!=='string'||sha(lf(record.content))!==baseline[k]) {
      throw Error(k+' 脚本与原版 v1.6.4 基线不匹配。');
    }
  }
  const source=lf(records.phone.content), found=payload.exec(source);
  if(!found) throw Error('找不到九号机页面源码。');
  const status=container.extensions?.regex_scripts?.find(rule=>rule.id===statusRegexId);
  if(typeof status?.replaceString!=='string'||sha(lf(status.replaceString))!==baseline.statusUi) {
    throw Error('状态栏正则与原版 v1.6.4 基线不匹配。');
  }
  const base={
    'phone-host':source.slice(0,found.index)+anchor+source.slice(found.index+found[0].length),
    'phone-ui':lf(JSON.parse(found[1])),
    zod:lf(records.zod.content),
    turn:lf(records.turn.content),
    'status-ui':lf(status.replaceString),
  };
  // git apply needs an isolated directory. The author input stays untouched.
  const work=mkdtempSync(join(dirname(out),'.jinhe-nine-'));
  try {
    for(const name of patchNames) {
      writeFileSync(join(work,name+'.js'),base[name]);
      applyPatch(work,name);
      base[name]=lf(read(join(work,name+'.js')));
    }
  } finally {
    for(const name of patchNames) rmSync(join(work,name+'.js'),{force:true});
    rmdirSync(work);
  }
  if(flags.has('--task-prompts')) {
    const presets=json(flags.get('--task-prompts'));
    const tasks=['portrait','storyImage','wardrobeItem','wardrobeOutfit','mapScene','itemOverview'];
    if(!['tags','zh','en'].includes(presets.savedMode)||tasks.some(k=>typeof presets.templates?.[k]?.tags!=='string')) {
      throw Error('任务模板格式有误。');
    }
    base['phone-ui']=base['phone-ui'].replace(/^const phoneStatusbarTaskPrompts=.*;$/m,
      ()=> 'const phoneStatusbarTaskPrompts='+JSON.stringify(presets)+';');
  }
  for (const match of base['phone-ui'].matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if(!match[1].includes('application/json')) new vm.Script(match[2]);
  }
  records.phone.content=base['phone-host'].replace(anchor,()=> 'const phoneHtml='+
    JSON.stringify(base['phone-ui']).replaceAll('<','\\u003c')+';');
  records.zod.content=base.zod;
  records.turn.content=base.turn;
  const regexes=container.extensions.regex_scripts;
  const rule=json(join(root,'integrations','display-snapshot.json'));
  const position=regexes.findIndex(entry=>entry.id==='6b3fa3c9-fac5-45f1-bf3d-3cab3ce25a09');
  if(position<0||regexes.some(entry=>entry.id===rule.id)) throw Error('无法定位人物快照显示规则。');
  regexes.splice(position,0,rule);
  mountStatusRenderer(scripts,status,base['status-ui']);
  if (typeof vm.SourceTextModule==='function') {
    for (const value of Object.values(records)) new vm.SourceTextModule(value.content);
  }
  updateRule(container.character_book?.entries);
  const world=flags.has('--world')?json(flags.get('--world')):null;
  if(world) updateRule(world.entries);
  const sese=flags.has('--sese-phone')?applySese(flags.get('--sese-phone')):null;
  const ledger=flags.has('--sese-ledger')?applyLedger(flags.get('--sese-ledger')):null;
  // A fresh output folder avoids overwriting existing cards or exported data.
  mkdirSync(out);
  const emit=(name,value)=>writeFileSync(join(out,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
  emit('jinhe-v1.6.4-patched.card.json',card);
  if(world) emit('jinhe-v1.6.4-patched.world.json',world);
  if(sese) emit('sese-phone-v1.308-patched.script.json',sese);
  if(ledger) emit('sese-ledger-v1.165-patched.script.json',ledger);
  console.log('补丁合并完成。'+out);
}

try {
  const [, , card,out,...args]=process.argv;
  if(!card||!out||args.length%2) throw Error('用法: node scripts/apply.mjs CARD.json OUTPUT [--world WORLD.json] [--sese-phone SCRIPT.json] [--task-prompts PROMPTS.json] [--sese-ledger LEDGER.json]');
  const flags=new Map();
  for(let i=0;i<args.length;i+=2) {
    if(!['--world','--sese-phone','--task-prompts','--sese-ledger'].includes(args[i])) throw Error('未知选项 '+args[i]);
    flags.set(args[i],resolve(args[i+1]));
  }
  run(resolve(card),resolve(out),flags);
} catch(error) {
  console.error(error.message);
  process.exitCode=1;
}
