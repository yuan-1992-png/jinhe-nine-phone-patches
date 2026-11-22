const countyStatusRuntime='__jinheCountyStatus164';
const countyStatusSlot='.jinhe-county-status-slot';
const countyStatusFrame='.jinhe-county-status-frame';
const countyStatusAvatar='金河县的精神小妹们v1.6.4 · 九号随身机.png';
const countyStatusRegexId='6b3fa3c9-fac5-45f1-bf3d-3cab3ce25a01';
const countyStatusBootstrap='<script>const countyBridge=window.frameElement?.jinheCountyStatus;'+
  'if(countyBridge)Object.assign(window,countyBridge);<\/script>';
const countyStatusDocument=countyStatusHtml.replace('<head>','<head>'+countyStatusBootstrap);

function mountCountyStatusBars() {
  const host=window.parent, doc=host.document;
  const chatRoot=doc.getElementById('chat');
  if (!chatRoot) return;
  const context=()=>host.SillyTavern?.getContext?.();
  const activeChat=ctx=>String(ctx?.getCurrentChatId?.()??ctx?.chatId??'');
  host[countyStatusRuntime]?.();
  let pending=0;
  function reconcile() {
    pending=0;
    const ctx=context(), chat=ctx?.chat, chatId=activeChat(ctx);
    const card=ctx?.characters?.[ctx.characterId];
    if (!chatId||!Array.isArray(chat)||ctx.groupId||card?.avatar!==countyStatusAvatar) return;

    const render=ctx.extensionSettings?.tavern_helper?.render;
    const depth=Number.isInteger(render?.depth)&&render.depth>=0?render.depth:5;
    const eligible=new Set();
    if (render?.enabled!==false) {
      for (let id=chat.length-1;id>=0&&(depth===0||eligible.size<depth);id--) {
        if (!render?.depth_ignore_hidden||!chat[id]?.is_system) eligible.add(id);
      }
    }

    const allowed=ctx.extensionSettings?.character_allowed_regex;
    const hudRule=card.data?.extensions?.regex_scripts?.find(rule=>rule.id===countyStatusRegexId);
    const canRestore=hudRule?.disabled!==true&&(!Array.isArray(allowed)||allowed.includes(countyStatusAvatar));
    for (const floor of chatRoot.querySelectorAll('.mes[mesid]')) {
      const id=Number(floor.getAttribute('mesid')),row=chat[id];
      const body=floor.querySelector('.mes_text');
      if (!body) continue;
      let slot=body.querySelector(countyStatusSlot);
      const attached=slot?.querySelector(countyStatusFrame);
      if (!canRestore||!Number.isInteger(id)||!eligible.has(id)||!row||row.is_user) {
        attached?.remove();
        continue;
      }
      // Initial or rebuilt message DOM can predate the character regexes.
      if (!slot&&/<StatusPlaceHolderImpl\s*\/\s*>/i.test(row.mes||'')) {
        slot=doc.createElement('div');
        slot.className='jinhe-county-status-slot';
        slot.setAttribute('aria-label','金河县状态栏');
        const stale=[...body.querySelectorAll('pre')].find(pre=>
          pre.textContent.includes('<!doctype html>')&&pre.textContent.includes('id="csg-hud-root"'));
        if (stale) stale.replaceWith(slot);
        else body.append(slot);
      }
      if (!slot) continue;
      if (attached?.jinheCountyStatus?.getCurrentMessageId()===id) continue;

      const frame=doc.createElement('iframe');
      frame.className='jinhe-county-status-frame';
      frame.title='金河县状态栏';
      frame.style.cssText='display:block;width:100%;height:220px;border:0;background:transparent';
      const isCurrent=()=>frame.isConnected&&activeChat(context())===chatId;
      frame.jinheCountyStatus={
        getCurrentMessageId:()=>isCurrent()?id:-1,
        getVariables:()=>isCurrent()?getVariables({type:'message',message_id:id}):{},
        getChatMessages:()=>isCurrent()?getChatMessages(id):[],
      };
      frame.srcdoc=countyStatusDocument;
      slot.replaceChildren(frame);
    }
  }

  const requestRefresh=()=>{
    if (!pending) pending=host.requestAnimationFrame(reconcile);
  };
  const chatStructure = '.mes,.mes_text,.jinhe-county-status-slot,.jinhe-county-status-frame,statusplaceholderimpl';
  const affectsStatus = node => node.nodeType === 1 && (node.matches(chatStructure) || node.querySelector(chatStructure));
  const observer=new host.MutationObserver(records=>{
    for (const record of records) {
      if ([...record.addedNodes,...record.removedNodes].some(affectsStatus)) {requestRefresh();return;}
    }
  });
  observer.observe(chatRoot,{childList:true,subtree:true});
  const bindings=[tavern_events.CHARACTER_MESSAGE_RENDERED,tavern_events.MESSAGE_UPDATED,
    tavern_events.MESSAGE_SWIPED,tavern_events.MORE_MESSAGES_LOADED]
    .filter(Boolean).map(event=>eventOn(event,requestRefresh));
  const destroy=()=>{
    observer.disconnect();
    if (pending) host.cancelAnimationFrame(pending);
    for (const binding of bindings) binding?.stop?.();
    for (const frame of chatRoot.querySelectorAll(countyStatusFrame)) frame.remove();
    if (host[countyStatusRuntime]===destroy) delete host[countyStatusRuntime];
  };
  host[countyStatusRuntime]=destroy;
  window.addEventListener('pagehide',destroy,{once:true});
  requestRefresh();
}

$(()=>mountCountyStatusBars());
