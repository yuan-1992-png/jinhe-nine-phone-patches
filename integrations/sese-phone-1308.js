const jinheSeseAvatar = '金河县的精神小妹们v1.6.4 · 九号随身机.png';
const jinheSeseApi = (() => {
    const host = (0, v.NP)();
    const contacts = n(8233);

    function current(scope) {
        const ctx = host.SillyTavern?.getContext?.();
        if (!scope?.chat || ctx?.groupId || ctx?.chatId !== scope.chat || scope.character !== jinheSeseAvatar ||
            ctx.characters?.[ctx.characterId]?.avatar !== jinheSeseAvatar) return false;
        const storage = ctx.chatMetadata?.unifiedStatusbar?.storageId;
        return typeof storage === 'string' && storage && k.storageId === storage &&
            ['ready', 'uninitialized'].includes(k.state);
    }

    function recentMessages(lines,limit) {
        const recent=[];
        for(let i=lines.length-1; i>=0 && recent.length<limit; i--) {
            if (lines[i]?.type==='text' || lines[i]?.type==='voice') recent.push(lines[i]);
        }
        return recent.reverse();
    }
    function read(scope, names, limit=2000) {
        if (!current(scope)) return null;
        const data = T();
        const key = name => typeof name === 'string' ? name.normalize('NFKC').replace(/\s+/g,'').toLowerCase() : '';
        const wanted = new Set(names.map(key));
        return {
            friends: (data.friends || []).slice(),
            conversations: data.conversations.filter(chat => chat.kind === 'private'&&wanted.has(key(chat.title))).map(chat => ({
                name: chat.title,
                messages: recentMessages(chat.messages,limit).map(line => ({
                    id: line.id, from: line.from, type: line.type, content: line.content, ts: line.ts, storyTime: line.storyTime || line.storyStamp || '',
                })),
            })),
        };
    }

    async function append(scope, updates) {
        if (!current(scope)) return false;
        const data = T();
        const changes = updates.slice(0, 100).filter(item =>
            typeof item?.name === 'string' && item.name.length <= 60 && Array.isArray(item.messages)
        ).map(({name, addFriend, messages, times=[]}) => {
            const chat = contacts.R(data, name);
            const ids = new Set(chat?.messages.map(line => line.id));
            return {
                name,
                times: new Map(times.filter(x => ids.has(x.id) && x.id.startsWith('jinhe_nine_') && typeof x.storyTime === 'string' && x.storyTime.length<=60).map(x=>[x.id,x.storyTime])),
                addFriend: addFriend && !contacts.P1(data, name),
                messages: messages.slice(-250).filter(line => typeof line?.id === 'string' &&
                    line.id.startsWith('jinhe_nine_') && !ids.has(line.id) && ['text', 'voice'].includes(line.type) &&
                    typeof line.content === 'string' && line.content.length <= 4000 && Number.isFinite(line.ts)),
            };
        }).filter(item => item.addFriend || item.messages.length || item.times.size);
        if (changes.length) {
            L(store => {
                for (const {name, addFriend, messages, times} of changes) {
                    if (addFriend) {
                        contacts.H$(store, name);
                        contacts.GU(store, name);
                    }
                    if (!messages.length && !times.size) continue;
                    const chat = contacts.lu(store, name);
                    for (const line of chat.messages) if (times.has(line.id)) { line.storyTime = times.get(line.id); delete line.storyStamp; }
                    if (!messages.length) continue;
                    for (const line of messages) {
                        chat.messages.push({...line, from: line.from === 'me' ? 'me' : chat.title});
                    }
                    chat.messages.sort((a, b) => a.ts - b.ts);
                    if (chat.messages.length > 2000) chat.messages.splice(0, chat.messages.length - 2000);
                    chat.updatedAt = Math.max(chat.updatedAt || 0, chat.messages.at(-1)?.ts || 0);
                }
            });
        }
        if (D) {clearTimeout(D); D = null;}
        return await B() && current(scope);
    }
    return Object.freeze({read, append, revision: scope => current(scope) ? z() : null});
})();
try { (0, v.NP)().__jinheSeseAdapter164 = jinheSeseApi; } catch {}
