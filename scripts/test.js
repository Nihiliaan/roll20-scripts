/**
 * Roll20 Suite - 核心逻辑自动化轻量测试套件
 * 运行方式: node scripts/test.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

console.log('==============================================');
console.log('🧪 开始运行 Roll20 Suite 单元测试套件...');
console.log('==============================================');

let passedTests = 0;
let failedTests = 0;

async function test(name, fn) {
    try {
        await fn();
        console.log(`  ✅ PASS: ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`  ❌ FAIL: ${name}`);
        console.error(err);
        failedTests++;
    }
}

// 模拟沙箱环境与加载源码
const rootDir = path.resolve(__dirname, '..');
function loadModuleInContext(filePath, sandbox = {}) {
    const raw = fs.readFileSync(path.join(rootDir, filePath), 'utf8');
    const cleaned = raw.replace(/^import .*$/gm, '').replace(/^export default /gm, '').replace(/^export /gm, '');
    const context = vm.createContext(sandbox);
    // 在 context 末尾将顶层 lexical 声明 (class/function) 显式挂载到 global/context 对象上
    const wrapped = `
        ${cleaned}
        ;((ctx) => {
            try { if (typeof escapeHtml !== 'undefined') ctx.escapeHtml = escapeHtml; } catch(e){}
            try { if (typeof Roll20Bridge !== 'undefined') ctx.Roll20Bridge = Roll20Bridge; } catch(e){}
            try { if (typeof RecalcService !== 'undefined') ctx.RecalcService = RecalcService; } catch(e){}
            try { if (typeof BuffLifecycle !== 'undefined') ctx.BuffLifecycle = BuffLifecycle; } catch(e){}
            try { if (typeof Pf1eBuffManager !== 'undefined') ctx.Pf1eBuffManager = Pf1eBuffManager; } catch(e){}
            try { if (typeof TokenBuffManager !== 'undefined') ctx.TokenBuffManager = TokenBuffManager; } catch(e){}
            try { if (typeof TurnOrderObserver !== 'undefined') ctx.TurnOrderObserver = TurnOrderObserver; } catch(e){}
            try { if (typeof Pf1eBuffUI !== 'undefined') ctx.Pf1eBuffUI = Pf1eBuffUI; } catch(e){}
            try { if (typeof CharacterSheetTitleCopier !== 'undefined') ctx.CharacterSheetTitleCopier = CharacterSheetTitleCopier; } catch(e){}
            try { if (typeof SuiteConfigStore !== 'undefined') ctx.SuiteConfigStore = SuiteConfigStore; } catch(e){}
        })(this);
    `;
    vm.runInContext(wrapped, context);
    return context;
}

// 辅助创建符合 Backbone 属性模型的 Mock 节点
function createMockAttr(name, current) {
    return {
        get(prop) {
            if (prop === 'name') return name;
            if (prop === 'current') return current;
            return undefined;
        },
        attributes: { name, current }
    };
}

async function runAllTests() {
    // 1. 测试 Roll20Bridge.escapeHtml 与 XSS 转义
    const bridgeContext = loadModuleInContext('src/core/Roll20Bridge.js', {
        window: {},
        console: console
    });
    const { escapeHtml, Roll20Bridge } = bridgeContext;

    await test('Roll20Bridge.escapeHtml 转义 HTML 关键字符', () => {
        assert.strictEqual(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
        assert.strictEqual(escapeHtml("Tom & 'Jerry'"), 'Tom &amp; &#39;Jerry&#39;');
        assert.strictEqual(escapeHtml('Normal text 123'), 'Normal text 123');
    });

    await test('Roll20Bridge.escapeHtml 处理空值与非字符串', () => {
        assert.strictEqual(escapeHtml(null), '');
        assert.strictEqual(escapeHtml(undefined), '');
        assert.strictEqual(escapeHtml(123), '123');
        assert.strictEqual(escapeHtml(false), 'false');
        assert.strictEqual(Roll20Bridge.escapeHtml('<tag>'), '&lt;tag&gt;');
    });

    // 2. 测试 Roll20Bridge.generateStandardRowId
    const managerContext = loadModuleInContext('src/modules/pf1e-buff-tracker/Pf1eBuffManager.js', {
        window: {},
        console: console,
        Roll20Bridge: bridgeContext.Roll20Bridge
    });
    const { Pf1eBuffManager } = managerContext;

    await test('Roll20Bridge.generateStandardRowId 规格与无下划线保证', () => {
        const id = Roll20Bridge.generateStandardRowId();
        assert.strictEqual(typeof id, 'string');
        assert.strictEqual(id.length, 20);
        assert.strictEqual(id.startsWith('-'), true);
        assert.strictEqual(id.includes('_'), false);

        // 批量生成 2000 个 ID，校验绝对不产生下划线（规避 repeating_buff2__xxx 截断事故）
        for (let i = 0; i < 2000; i++) {
            const generated = Roll20Bridge.generateStandardRowId();
            assert.strictEqual(generated.length, 20);
            assert.strictEqual(generated.startsWith('-'), true);
            assert.strictEqual(generated.includes('_'), false, `生成的 ID 包含非法下划线: ${generated}`);
        }
    });

    // 3. 测试 BuffLifecycle 轮数生命周期纯算法核心
    const lifecycleContext = loadModuleInContext('src/core/BuffLifecycle.js', {
        console: console
    });
    const { BuffLifecycle } = lifecycleContext;

    await test('BuffLifecycle.decrementEntry Buff 语义: 常驻跳过 / 逐轮递减 / 归零过期', () => {
        // 常驻 (rounds=null) 跳过且不改动
        const permanent = { name: '常驻祝福', rounds: null };
        assert.strictEqual(BuffLifecycle.decrementEntry(permanent), null);
        assert.strictEqual(permanent.rounds, null);

        // NaN 轮数跳过
        assert.strictEqual(BuffLifecycle.decrementEntry({ name: 'x', rounds: NaN }), null);

        // 正常递减
        const normal = { name: '加速术', rounds: 3 };
        const dec = BuffLifecycle.decrementEntry(normal);
        assert.strictEqual(dec.status, 'decremented');
        assert.strictEqual(dec.remaining, 2);
        assert.strictEqual(normal.rounds, 2);

        // 归零过期
        const last = { name: '加速术', rounds: 1 };
        const exp = BuffLifecycle.decrementEntry(last);
        assert.strictEqual(exp.status, 'expired');
        assert.strictEqual(exp.remaining, 0);
    });

    await test('BuffLifecycle.decrementEntry Debuff 语义: 未激活跳过 / 归零关停 / 负数正计轮', () => {
        // 未激活跳过
        assert.strictEqual(BuffLifecycle.decrementEntry({ name: 'd', rounds: 5, enabled: false }, { isDebuff: true }), null);

        // 正数递减
        const active = { name: '流血', rounds: 2, enabled: true };
        const dec = BuffLifecycle.decrementEntry(active, { isDebuff: true });
        assert.strictEqual(dec.status, 'decremented');
        assert.strictEqual(dec.remaining, 1);

        // 归零关停: enabled 置 false, rounds 归 0
        const last = { name: '流血', rounds: 1, enabled: true };
        const exp = BuffLifecycle.decrementEntry(last, { isDebuff: true });
        assert.strictEqual(exp.status, 'expired');
        assert.strictEqual(exp.remaining, 0);
        assert.strictEqual(last.enabled, false);
        assert.strictEqual(last.rounds, 0);

        // 0/负数持续正计轮 (counted)
        const counting = { name: '流血', rounds: 0, enabled: true };
        const cnt = BuffLifecycle.decrementEntry(counting, { isDebuff: true });
        assert.strictEqual(cnt.status, 'counted');
        assert.strictEqual(cnt.remaining, -1);
        assert.strictEqual(counting.rounds, -1);
        assert.strictEqual(counting.enabled, true, '正计轮不得关停');
    });

    await test('BuffLifecycle.incrementEntry 统一加回 1 轮', () => {
        assert.strictEqual(BuffLifecycle.incrementEntry({ name: 'x', rounds: null }), null);
        assert.strictEqual(BuffLifecycle.incrementEntry({ name: 'd', rounds: 5, enabled: false }, { isDebuff: true }), null);

        const buff = { name: '加速术', rounds: 2 };
        const res = BuffLifecycle.incrementEntry(buff);
        assert.strictEqual(res.status, 'incremented');
        assert.strictEqual(res.remaining, 3);
        assert.strictEqual(buff.rounds, 3);
    });

    // 4. 测试 TurnOrderObserver 回合推进与回退侦测
    const turnObserverContext = loadModuleInContext('src/core/TurnOrderObserver.js', {
        window: {},
        console: console
    });
    const { TurnOrderObserver } = turnObserverContext;

    await test('TurnOrderObserver 多单位标准回合前进侦测', () => {
        const observer = new TurnOrderObserver();
        let eventFired = null;
        observer.on('turnStarted', (data) => { eventFired = data; });

        const oldList = [{ id: 'token_a' }, { id: 'token_b' }, { id: 'token_c' }];
        const newList = [{ id: 'token_b' }, { id: 'token_c' }, { id: 'token_a' }];

        observer.cachedOrder = oldList;
        observer._lastLocalIntent = { action: 'forward', timestamp: Date.now() };
        observer.handleTurnorderChange(JSON.stringify(newList));

        assert.ok(eventFired, '必须触发 turnStarted 事件');
        assert.strictEqual(eventFired.startedTokenId, 'token_b');
        assert.strictEqual(eventFired.endedTokenId, 'token_a');
        assert.strictEqual(eventFired.isLocalUserAction, true);
    });

    await test('TurnOrderObserver 多单位标准回合回退侦测', () => {
        const observer = new TurnOrderObserver();
        let eventFired = null;
        observer.on('turnReverted', (data) => { eventFired = data; });

        const oldList = [{ id: 'token_b' }, { id: 'token_c' }, { id: 'token_a' }];
        const newList = [{ id: 'token_a' }, { id: 'token_b' }, { id: 'token_c' }];

        observer.cachedOrder = oldList;
        observer._lastLocalIntent = { action: 'back', timestamp: Date.now() };
        observer.handleTurnorderChange(JSON.stringify(newList));

        assert.ok(eventFired, '必须触发 turnReverted 事件');
        assert.strictEqual(eventFired.revertedTokenId, 'token_a');
        assert.strictEqual(eventFired.isLocalUserAction, true);
    });

    await test('TurnOrderObserver 单战斗单位 PR 自减回合推进侦测 (边界修复)', () => {
        const observer = new TurnOrderObserver();
        let startedData = null;
        observer.on('turnStarted', (data) => { startedData = data; });

        const oldList = [{ id: 'boss_token', pr: '10' }];
        const newList = [{ id: 'boss_token', pr: '9' }];

        observer.cachedOrder = oldList;
        observer._lastLocalIntent = { action: 'forward', timestamp: Date.now() };
        observer.handleTurnorderChange(JSON.stringify(newList));

        assert.ok(startedData, '单单位 PR 减小时必须触发 turnStarted');
        assert.strictEqual(startedData.startedTokenId, 'boss_token');
        assert.strictEqual(startedData.endedTokenId, 'boss_token');
        assert.strictEqual(startedData.isLocalUserAction, true);
    });

    await test('TurnOrderObserver 单战斗单位 PR 自增回合回退侦测 (边界修复)', () => {
        const observer = new TurnOrderObserver();
        let revertedData = null;
        observer.on('turnReverted', (data) => { revertedData = data; });

        const oldList = [{ id: 'boss_token', pr: '9' }];
        const newList = [{ id: 'boss_token', pr: '10' }];

        observer.cachedOrder = oldList;
        observer._lastLocalIntent = { action: 'back', timestamp: Date.now() };
        observer.handleTurnorderChange(JSON.stringify(newList));

        assert.ok(revertedData, '单单位 PR 增大时必须触发 turnReverted');
        assert.strictEqual(revertedData.revertedTokenId, 'boss_token');
        assert.strictEqual(revertedData.isLocalUserAction, true);
    });

    // 4. 测试 Pf1eBuffManager.getAllBuffs O(N) 一次性聚合解析
    await test('Pf1eBuffManager.getAllBuffs O(N) 属性索引正确解析', async () => {
        const mockCharacter = {
            id: 'char_hero',
            attribs: {
                models: [
                    createMockAttr('repeating_buff2_-row001_name', '加速术 (Haste)'),
                    createMockAttr('repeating_buff2_-row001_enable_toggle', '1'),
                    createMockAttr('repeating_buff2_-row001_rounds', '5'),
                    createMockAttr('repeating_buff2_-row002_name', '护盾术 (Shield)'),
                    createMockAttr('repeating_buff2_-row002_enable_toggle', '0'),
                    createMockAttr('repeating_buff2_-row002_rounds', '10'),
                    createMockAttr('hp', '55'), // 无关属性
                    createMockAttr('repeating_buff2_malformed', 'skip_me') // 畸形名称
                ]
            }
        };

        const buffs = await Pf1eBuffManager.getAllBuffs(mockCharacter);
        assert.strictEqual(buffs.length, 2);

        const haste = buffs.find(b => b.rowId === '-row001');
        assert.ok(haste);
        assert.strictEqual(haste.name, '加速术 (Haste)');
        assert.strictEqual(haste.enabled, true);
        assert.strictEqual(haste.rounds, 5);

        const shield = buffs.find(b => b.rowId === '-row002');
        assert.ok(shield);
        assert.strictEqual(shield.name, '护盾术 (Shield)');
        assert.strictEqual(shield.enabled, false);
        assert.strictEqual(shield.rounds, 10);
    });

    // 5. 测试 Pf1eBuffUI.getActiveBuffsSync
    const uiContext = loadModuleInContext('src/modules/pf1e-buff-tracker/Pf1eBuffUI.js', {
        window: {},
        console: console,
        Roll20Bridge: bridgeContext.Roll20Bridge,
        Pf1eBuffManager: Pf1eBuffManager
    });
    const { Pf1eBuffUI } = uiContext;

    await test('Pf1eBuffUI.getActiveBuffsSync 仅返回启用状态的 Buff 且轮数精确', () => {
        const mockCharacter = {
            id: 'char_hero',
            attribs: {
                models: [
                    createMockAttr('repeating_buff2_-rowA_name', '神恩 (Divine Favor)'),
                    createMockAttr('repeating_buff2_-rowA_enable_toggle', '1'),
                    createMockAttr('repeating_buff2_-rowA_rounds', '3'),
                    createMockAttr('repeating_buff2_-rowB_name', '未开启祝福'),
                    createMockAttr('repeating_buff2_-rowB_enable_toggle', '0'),
                    createMockAttr('repeating_buff2_-rowB_rounds', '10')
                ]
            }
        };

        const activeBuffs = Pf1eBuffUI.getActiveBuffsSync(mockCharacter);
        assert.strictEqual(activeBuffs.length, 1);
        assert.strictEqual(activeBuffs[0].rowId, '-rowA');
        assert.strictEqual(activeBuffs[0].name, '神恩 (Divine Favor)');
        assert.strictEqual(activeBuffs[0].rounds, 3);
    });

    // 6. 测试 SuiteConfigStore 读写与默认值
    let mockStorageData = {};
    const mockLocalStorage = {
        getItem: (key) => mockStorageData[key] || null,
        setItem: (key, val) => { mockStorageData[key] = String(val); }
    };

    const storeContext = loadModuleInContext('src/core/SuiteConfigStore.js', {
        localStorage: mockLocalStorage,
        window: {
            dispatchEvent: () => {}
        },
        CustomEvent: function(type, params) { this.type = type; this.detail = params?.detail; },
        console: console
    });
    const { SuiteConfigStore } = storeContext;

    await test('SuiteConfigStore 默认值与持久化更新', () => {
        // 默认值（复选框与队友互见默认开启，其余默认关闭）
        assert.strictEqual(SuiteConfigStore.getSetting('buff_show_checkbox'), true);
        assert.strictEqual(SuiteConfigStore.getSetting('party_buffs_visible'), true);
        assert.strictEqual(SuiteConfigStore.getSetting('turnorder_buff_abbr'), false);
        assert.strictEqual(SuiteConfigStore.getSetting('unknown_key', 'fallback_val'), 'fallback_val');

        // 更新配置
        SuiteConfigStore.setSetting('buff_show_checkbox', false);
        assert.strictEqual(SuiteConfigStore.getSetting('buff_show_checkbox'), false);

        // 容错：当 localStorage 内容损坏时返回默认值
        mockStorageData['r20_suite_user_settings'] = '{bad json!';
        assert.strictEqual(SuiteConfigStore.getSetting('buff_show_checkbox'), true);
    });

    // 7. 测试 RecalcService 防抖合并与未就绪兜底
    const mockSandboxDoc = {
        open: () => {},
        write: () => {},
        close: () => {},
        createElement: () => ({ src: '', onload: () => {}, onerror: () => {} }),
        head: { appendChild: () => {} }
    };
    const mockSandboxIframe = {
        id: '',
        style: {},
        contentDocument: mockSandboxDoc,
        contentWindow: {},
        remove: () => {}
    };
    const mockBrowserDocument = {
        createElement: () => mockSandboxIframe,
        body: { appendChild: () => {} }
    };

    const recalcContext = loadModuleInContext('src/core/RecalcService.js', {
        Roll20Bridge: {
            ensureCharacterAttributes: async () => {}
        },
        document: mockBrowserDocument,
        Blob: class { constructor(parts) { this.parts = parts; } },
        URL: { createObjectURL: () => 'blob:mock-url', revokeObjectURL: () => {} },
        console: console,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout
    });
    const { RecalcService } = recalcContext;

    await test('RecalcService.request 具备角色维度的防抖合并 (Coalescing)', async () => {
        const mockChar = { id: 'char_test_01', get: () => 'Test Hero', attribs: { models: [] } };
        assert.strictEqual(RecalcService.pendingRequests.size, 0);

        // 连续快速触发 5 次
        RecalcService.request(mockChar, { reason: 'hit_1' });
        RecalcService.request(mockChar, { reason: 'hit_2' });
        RecalcService.request(mockChar, { reason: 'hit_3' });
        RecalcService.request(mockChar, { reason: 'hit_4' });
        RecalcService.request(mockChar, { reason: 'hit_5' });

        // 验证：同一个角色 5 次调用合并为一个定时器任务
        assert.strictEqual(RecalcService.pendingRequests.size, 1);
        assert.ok(RecalcService.pendingRequests.has('char_test_01'));

        // 清理定时器
        RecalcService.destroy();
        assert.strictEqual(RecalcService.pendingRequests.size, 0);
    });

    await test('RecalcService.flush 在沙箱未就绪时回退写入幂等真值 recalc1="1"', async () => {
        let createdAttr = null;
        let savedAttr = null;
        const mockChar = {
            id: 'char_test_02',
            get: () => 'Test Hero 2',
            attribs: {
                models: [],
                create: (data) => {
                    createdAttr = data;
                    return data;
                }
            }
        };

        await RecalcService.flush(mockChar, { reason: 'test_fallback' });
        assert.ok(createdAttr, '必须创建 recalc1 属性');
        assert.strictEqual(createdAttr.name, 'recalc1');
        assert.strictEqual(createdAttr.current, '1');
    });

    await test('RecalcService.enqueue 串行任务队列与相同角色任务合并', async () => {
        RecalcService.destroy();
        const executionOrder = [];
        let resolveTrigger = null;

        // 模拟沙箱已挂载
        RecalcService.sandboxIframe = {};
        RecalcService.listeners['change:recalc1'] = [
            () => {
                // 模拟沙箱收到事件后立即触发完成
                setTimeout(() => {
                    if (RecalcService.currentJobResolve) {
                        RecalcService.currentJobResolve();
                    }
                }, 5);
            }
        ];

        const charA = { id: 'char_A', get: () => 'Char A', attribs: { models: [] } };
        const charB = { id: 'char_B', get: () => 'Char B', attribs: { models: [] } };

        // 模拟任务入队：charA 立即开始执行，charB 进队列，第二个 charB 与第一个 charB 合并
        const p1 = RecalcService.enqueue(charA, { reason: 'init_A' });
        const p2 = RecalcService.enqueue(charB, { reason: 'init_B' });
        const p3 = RecalcService.enqueue(charB, { reason: 'update_B' });

        // charA 正在处理，charB 在队列中（第二个 charB 被合并入 subResolves），队列长度应为 1
        assert.strictEqual(RecalcService.queue.length, 1);
        assert.strictEqual(RecalcService.queue[0].character.id, 'char_B');
        assert.strictEqual(RecalcService.queue[0].subResolves.length, 1);
        assert.strictEqual(RecalcService.isProcessing, true);

        await Promise.all([p1, p2, p3]);
        assert.strictEqual(RecalcService.queue.length, 0);
        assert.strictEqual(RecalcService.isProcessing, false);
        RecalcService.destroy();
    });

    await test('RecalcService 沙箱 getAttrs 自动拦截 recalc1 返回 "1" 且缺省值回退正常', async () => {
        RecalcService.destroy();

        RecalcService.bootSandbox('/* dummy official script */');
        assert.ok(mockSandboxIframe.contentWindow.getAttrs, '沙箱必须注入 getAttrs');

        // 设置上下文角色，其属性表中 recalc1="0"，且缺失 melee_bab
        const mockChar = {
            id: 'char_test_03',
            get: () => 'Test Hero 3',
            attribs: {
                models: [
                    createMockAttr('recalc1', '0'),
                    createMockAttr('STR', '14')
                ]
            }
        };
        RecalcService.currentContextChar = mockChar;

        // 异步调用沙箱内的 getAttrs
        const queryNames = ['recalc1', 'STR', 'melee_bab', 'melee-ability', 'non_existent_key'];
        const res = await new Promise((resolve) => {
            mockSandboxIframe.contentWindow.getAttrs(queryNames, (data) => resolve(data));
        });

        // 验证 1: recalc1 必须被动态拦截并置为 "1"，驱动官方 ju() 进入全量计算分支
        assert.strictEqual(res.recalc1, '1', 'recalc1 必须返回 "1"');
        // 验证 2: 既有属性必须原样读取
        assert.strictEqual(res.STR, '14');
        // 验证 3: 缺失的官方下拉框属性必须从 MANUAL_DROPDOWN_DEFAULTS 兜底
        assert.strictEqual(res.melee_bab, 'bab');
        assert.strictEqual(res['melee-ability'], 'STR-mod');
        // 验证 4: 不存在的普通属性返回空字符串
        assert.strictEqual(res.non_existent_key, '');

        RecalcService.destroy();
    });

    // 8. 测试 TokenBuffManager 自定义字段存取与回合生命周期
    function createMockToken(initialField) {
        const state = { field: initialField || '', saves: [] };
        return {
            state,
            get: (prop) => (prop === 'r20_suite_buffs' ? state.field : '哥布林侦察兵'),
            save: (obj) => { state.saves.push(obj); if ('r20_suite_buffs' in obj) state.field = obj.r20_suite_buffs; }
        };
    }

    const tokenContext = loadModuleInContext('src/modules/token-buff/TokenBuffManager.js', {
        console: console,
        BuffLifecycle: lifecycleContext.BuffLifecycle,
        Roll20Bridge: bridgeContext.Roll20Bridge
    });
    const { TokenBuffManager } = tokenContext;

    await test('TokenBuffManager 自定义字段读写往返（不触碰 gmnotes）', () => {
        const token = createMockToken('');
        // 用户笔记独立存放，读写 Buff 不得触碰 gmnotes
        token.state.gmnotes = encodeURIComponent('GM 的普通备注文本');

        // 注意: vm 沙箱跨 realm 数组原型不同，只能用长度/元素断言
        assert.strictEqual(TokenBuffManager.getTokenBuffs(token).length, 0);

        TokenBuffManager.applyOrRefreshBuff(token, '加速术 (Haste)', 3);
        TokenBuffManager.applyOrRefreshBuff(token, '常驻祝福', null);

        // 用户 gmnotes 不得被读写过程触碰
        assert.strictEqual(token.state.gmnotes, encodeURIComponent('GM 的普通备注文本'), 'gmnotes 必须保持不动');
        // 自定义字段里是结构化 JSON
        const stored = JSON.parse(token.state.field);
        assert.ok(Array.isArray(stored.buffs) && stored.buffs.length === 2, '自定义字段必须持久化 Buff 列表');

        const buffs = TokenBuffManager.getTokenBuffs(token);
        assert.strictEqual(buffs.length, 2);
        const haste = buffs.find(b => b.name === '加速术 (Haste)');
        assert.strictEqual(haste.rounds, 3);

        // 同名刷新只更新轮数
        TokenBuffManager.applyOrRefreshBuff(token, '加速术 (Haste)', 9);
        const refreshed = TokenBuffManager.getTokenBuffs(token);
        assert.strictEqual(refreshed.length, 2);
        assert.strictEqual(refreshed.find(b => b.name === '加速术 (Haste)').rounds, 9);
    });

    await test('TokenBuffManager.decrementBuffs 回合扣减: 递减 / 过期除名 / Debuff 关停与正计轮', () => {
        const token = createMockToken(JSON.stringify({
            buffs: [{ name: '加速术', rounds: 2 }, { name: '常驻', rounds: null }],
            debuffs: [{ name: '流血', rounds: 1, enabled: true }, { name: '眩晕', rounds: 0, enabled: true }]
        }));

        const processed = TokenBuffManager.decrementBuffs(token);
        // 常驻 Buff (rounds=null) 与列表本身不产生扣减记录
        assert.strictEqual(processed.length, 3);
        assert.ok(!processed.some(p => p.name === '常驻'), '常驻条目不得产生扣减记录');

        const byName = (n) => processed.find(p => p.name === n);
        assert.strictEqual(byName('加速术').status, 'decremented');
        assert.strictEqual(byName('加速术').remaining, 1);
        assert.strictEqual(byName('[Debuff] 流血').status, 'expired');
        assert.strictEqual(byName('[Debuff] 眩晕').status, 'counted');

        // 持久化校验: 加速术 2->1, 过期条目除名; 流血关停; 眩晕 0->-1
        const buffs = TokenBuffManager.getTokenBuffs(token);
        assert.strictEqual(buffs.length, 2);
        assert.strictEqual(buffs.find(b => b.name === '加速术').rounds, 1);
        assert.ok(buffs.find(b => b.name === '常驻'), '常驻 Buff 不得被除名');

        const debuffs = TokenBuffManager.getTokenDebuffs(token);
        assert.strictEqual(debuffs.find(d => d.name === '流血').enabled, false);
        assert.strictEqual(debuffs.find(d => d.name === '流血').rounds, 0);
        assert.strictEqual(debuffs.find(d => d.name === '眩晕').rounds, -1);
        assert.strictEqual(debuffs.find(d => d.name === '眩晕').enabled, true);
    });

    await test('TokenBuffManager 未激活 Buff 不参与扣减/回退（与人物卡语义一致）', () => {
        const token = createMockToken(JSON.stringify({
            buffs: [{ name: '已关停', enabled: false, rounds: 5 }, { name: '激活中', enabled: true, rounds: 3 }],
            debuffs: []
        }));

        const processed = TokenBuffManager.decrementBuffs(token);
        assert.strictEqual(processed.length, 1, '只有激活中的 Buff 产生扣减记录');
        assert.strictEqual(processed[0].name, '激活中');
        assert.strictEqual(TokenBuffManager.getTokenBuffs(token).find(b => b.name === '已关停').rounds, 5, '未激活 Buff 轮数不得被扣减');
        assert.strictEqual(TokenBuffManager.getTokenBuffs(token).find(b => b.name === '激活中').rounds, 2, '激活中 Buff 正常扣减 3→2');

        TokenBuffManager.incrementBuffsOnTurnRevert(token);
        assert.strictEqual(TokenBuffManager.getTokenBuffs(token).find(b => b.name === '已关停').rounds, 5, '未激活 Buff 不得被回退加轮');
        assert.strictEqual(TokenBuffManager.getTokenBuffs(token).find(b => b.name === '激活中').rounds, 3, '激活中 Buff 回退 +1（2→3）');
    });

    await test('删除主 Buff 级联: 同步清除人物卡子 Buff 与 Token 子 Buff', () => {
        // 混合下游: 宿主 ROW → 人物卡子 Buff C1(child1) + Token 子 Buff T1(tok1)
        const HybridBridge = Object.create(bridgeContext.Roll20Bridge);
        const tokenMocks = {};
        HybridBridge.getTokenGraphic = (id) => tokenMocks[id] || null;

        function makeAttr(models, name, current) {
            const attr = {
                get(p) { return p === 'name' ? name : (p === 'current' ? current : undefined); },
                save(o) { if ('current' in o) current = o.current; },
                destroy() { const i = models.indexOf(attr); if (i >= 0) models.splice(i, 1); }
            };
            return attr;
        }
        function makeChar(id, models) {
            return {
                id,
                get(n) { return n === 'name' ? ('角色' + id) : undefined; },
                attribs: {
                    models,
                    create(d) { const a = makeAttr(models, d.name, d.current); models.push(a); return a; }
                }
            };
        }
        const charMocks = {};
        const campaignMock = { characters: { get: (id) => charMocks[id] || null, models: [] } };

        const hostModels = [];
        const host = makeChar('host1', hostModels);
        hostModels.push(
            makeAttr(hostModels, 'repeating_buff2_ROW_name', '主Buff'),
            makeAttr(hostModels, 'repeating_buff2_ROW_enable_toggle', '1'),
            makeAttr(hostModels, 'repeating_buff2_ROW_rounds', '3'),
            makeAttr(hostModels, 'repeating_buff2_ROW_link_children', JSON.stringify([
                { charId: 'tok1', rowId: 'T1' },
                { charId: 'child1', rowId: 'C1' }
            ]))
        );

        const childModels = [];
        const childChar = makeChar('child1', childModels);
        childModels.push(
            makeAttr(childModels, 'repeating_buff2_C1_name', '子Buff'),
            makeAttr(childModels, 'repeating_buff2_C1_enable_toggle', '1'),
            makeAttr(childModels, 'repeating_buff2_C1_rounds', '2'),
            makeAttr(childModels, 'repeating_buff2_C1_link_host_id', 'host1'),
            makeAttr(childModels, 'repeating_buff2_C1_link_source_row_id', 'ROW')
        );

        const tokenMock = createMockToken(JSON.stringify({
            buffs: [{ rowId: 'T1', name: '衝鋒', enabled: true, rounds: 1, extraAttrs: { link_host_id: 'host1', link_source_row_id: 'ROW' } }],
            debuffs: []
        }));
        tokenMocks['tok1'] = tokenMock;
        charMocks['host1'] = host;
        charMocks['child1'] = childChar;
        campaignMock.characters.models = [host, childChar];

        const managerContext2 = loadModuleInContext('src/modules/pf1e-buff-tracker/Pf1eBuffManager.js', {
            window: { Campaign: campaignMock },
            console: console,
            queueMicrotask: queueMicrotask,
            Roll20Bridge: HybridBridge,
            TokenBuffManager: tokenContext.TokenBuffManager,
            RecalcService: { request: () => {} }
        });
        const PM2 = managerContext2.Pf1eBuffManager;

        return (async () => {
            await PM2.deleteBuffRowPermanently(host, 'ROW');

            // Token 子条目被移除
            const tokenBuffs = TokenBuffManager.getTokenBuffs(tokenMock);
            assert.strictEqual(tokenBuffs.length, 0, 'Token 子 Buff 必须随主 Buff 级联删除');

            // 人物卡子 Buff 的属性被销毁
            assert.strictEqual(childModels.filter(a => (a.get('name') || '').startsWith('repeating_buff2_C1')).length, 0, '人物卡子 Buff 属性必须被销毁');

            // 宿主自身 ROW 属性被销毁，link_children 一并清除
            assert.strictEqual(hostModels.filter(a => (a.get('name') || '').startsWith('repeating_buff2_ROW')).length, 0, '宿主主 Buff 属性必须被销毁');
        })();
    });

    await test('TokenBuffManager.incrementBuffsOnTurnRevert 先攻回退加回轮数', () => {
        const token = createMockToken(JSON.stringify({
            buffs: [{ name: '加速术', rounds: 2 }, { name: '常驻', rounds: null }],
            debuffs: [{ name: '流血', rounds: 1, enabled: true }, { name: '未激活', rounds: 5, enabled: false }]
        }));

        const processed = TokenBuffManager.incrementBuffsOnTurnRevert(token);
        // 常驻与未激活 Debuff 不参与
        assert.strictEqual(processed.length, 2);

        const buffs = TokenBuffManager.getTokenBuffs(token);
        assert.strictEqual(buffs.find(b => b.name === '加速术').rounds, 3);
        assert.strictEqual(buffs.find(b => b.name === '常驻').rounds, null);

        const debuffs = TokenBuffManager.getTokenDebuffs(token);
        assert.strictEqual(debuffs.find(d => d.name === '流血').rounds, 2);
        assert.strictEqual(debuffs.find(d => d.name === '未激活').rounds, 5, '未激活 Debuff 不得被加回');
    });

    // 9. 测试 CharacterSheetTitleCopier 属性查找、语法替换与事件触发
    const copierContext = loadModuleInContext('src/modules/pf1e-buff-tracker/CharacterSheetTitleCopier.js', {
        window: {
            navigator: { clipboard: { writeText: async () => true } }
        },
        document: {
            createElement: () => ({ style: {}, appendChild: () => {}, remove: () => {}, select: () => {} }),
            execCommand: () => true,
            getElementById: () => null
        },
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        console: console
    });
    const { CharacterSheetTitleCopier } = copierContext;

    await test('CharacterSheetTitleCopier.findTargetTitle 准确捕获直接属性与关联控件', () => {
        // 场景 A: 自身具有 title
        const elA = {
            getAttribute: (k) => k === 'title' ? '@{STR-mod}' : null
        };
        const resA = CharacterSheetTitleCopier.findTargetTitle(elA);
        assert.ok(resA);
        assert.strictEqual(resA.rawTitle, '@{STR-mod}');
        assert.strictEqual(resA.element, elA);

        // 场景 B: 点击 label 内部无 title 的 span，但 label 内有带 title 的 input
        const innerInput = {
            getAttribute: (k) => k === 'title' ? '@{bab}' : null
        };
        const labelEl = {
            getAttribute: () => null,
            querySelector: (sel) => sel.includes('input') ? innerInput : null
        };
        const childSpan = {
            getAttribute: () => null,
            closest: (sel) => sel === 'label' ? labelEl : null
        };
        const resB = CharacterSheetTitleCopier.findTargetTitle(childSpan);
        assert.ok(resB);
        assert.strictEqual(resB.rawTitle, '@{bab}');
        assert.strictEqual(resB.element, innerInput);

        // 场景 C: 向上回溯查找到父级 title
        const parentDiv = {
            tagName: 'DIV',
            classList: { contains: () => false },
            getAttribute: (k) => k === 'title' ? 'Action Tip' : null,
            parentElement: null
        };
        const leafDiv = {
            tagName: 'DIV',
            classList: { contains: () => false },
            getAttribute: () => null,
            closest: () => null,
            parentElement: parentDiv
        };
        const resC = CharacterSheetTitleCopier.findTargetTitle(leafDiv);
        assert.ok(resC);
        assert.strictEqual(resC.rawTitle, 'Action Tip');
        assert.strictEqual(resC.element, parentDiv);

        // 场景 D: 无 title
        const emptyEl = {
            getAttribute: () => null,
            closest: () => null,
            parentElement: null
        };
        assert.strictEqual(CharacterSheetTitleCopier.findTargetTitle(emptyEl), null);
    });

    await test('CharacterSheetTitleCopier.resolveMacroTitle 智能展开 Repeating Section $X', () => {
        // 场景 A: 普通宏属性，原样返回
        const elNormal = { closest: () => null };
        assert.strictEqual(CharacterSheetTitleCopier.resolveMacroTitle('@{character_name}', elNormal), '@{character_name}');

        // 场景 B: Repeating 宏，包含 $X 且位于 .repitem 中
        const mockRepItem = {
            getAttribute: (k) => k === 'data-reprowid' ? '-Nz8xyz123' : null
        };
        const elInRepeating = {
            closest: (sel) => sel === '.repitem' ? mockRepItem : null
        };
        assert.strictEqual(
            CharacterSheetTitleCopier.resolveMacroTitle('@{repeating_buff2_$X_name}', elInRepeating),
            '@{repeating_buff2_-Nz8xyz123_name}'
        );
        assert.strictEqual(
            CharacterSheetTitleCopier.resolveMacroTitle('repeating_buff2_$X_b1_bonus', elInRepeating),
            'repeating_buff2_-Nz8xyz123_b1_bonus'
        );

        // 场景 C: 小写 $x 占位符兼容
        assert.strictEqual(
            CharacterSheetTitleCopier.resolveMacroTitle('@{repeating_ability_$x_description}', elInRepeating),
            '@{repeating_ability_-Nz8xyz123_description}'
        );
    });

    await test('CharacterSheetTitleCopier.handleEvent 精确阻断与双通道触发', async () => {
        let copiedText = '';
        const mockDoc = {
            body: { appendChild: () => {} },
            getElementById: () => null,
            createElement: () => ({ style: {}, appendChild: () => {}, remove: () => {} })
        };
        copierContext.window.navigator.clipboard.writeText = async (text) => {
            copiedText = text;
            return true;
        };

        const targetEl = {
            getAttribute: (k) => k === 'title' ? '@{AC}' : null,
            classList: { remove: () => {}, add: () => {} },
            getBoundingClientRect: () => ({ left: 10, top: 20, width: 30, height: 40 })
        };

        // 触发 A: Alt + 左键 (altKey: true, button: 0)
        let defaultPrevented = false;
        let propagationStopped = false;
        const eventAltLeft = {
            altKey: true,
            button: 0,
            target: targetEl,
            preventDefault: () => { defaultPrevented = true; },
            stopPropagation: () => { propagationStopped = true; },
            stopImmediatePropagation: () => {}
        };
        CharacterSheetTitleCopier.handleEvent(eventAltLeft, mockDoc);
        await new Promise(r => setTimeout(r, 10));
        assert.ok(defaultPrevented, '必须阻止原生行为');
        assert.ok(propagationStopped, '必须阻止原生冒泡');
        assert.strictEqual(copiedText, '@{AC}');

        // 触发 B: 鼠标中键点击 (button: 1)
        copiedText = '';
        defaultPrevented = false;
        const eventMiddle = {
            altKey: false,
            button: 1,
            target: targetEl,
            preventDefault: () => { defaultPrevented = true; },
            stopPropagation: () => { propagationStopped = true; },
            stopImmediatePropagation: () => {}
        };
        CharacterSheetTitleCopier.handleEvent(eventMiddle, mockDoc);
        await new Promise(r => setTimeout(r, 10));
        assert.ok(defaultPrevented);
        assert.strictEqual(copiedText, '@{AC}');

        // 负例 C: 普通左键点击 (altKey: false, button: 0) -> 绝不触发
        copiedText = '';
        defaultPrevented = false;
        const eventNormalLeft = {
            altKey: false,
            button: 0,
            target: targetEl,
            preventDefault: () => { defaultPrevented = true; },
            stopPropagation: () => {},
            stopImmediatePropagation: () => {}
        };
        CharacterSheetTitleCopier.handleEvent(eventNormalLeft, mockDoc);
        await new Promise(r => setTimeout(r, 10));
        assert.strictEqual(defaultPrevented, false, '普通左键点击严禁被拦截');
        assert.strictEqual(copiedText, '', '普通左键点击严禁复制');

        RecalcService.destroy();
    });

    console.log('==============================================');
    console.log(`🎉 测试执行完成! 通过: ${passedTests}, 失败: ${failedTests}`);
    console.log('==============================================');

    if (failedTests > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runAllTests().catch(err => {
    console.error('测试运行器异常:', err);
    process.exit(1);
});
