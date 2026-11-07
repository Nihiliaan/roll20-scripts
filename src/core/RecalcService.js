import { Roll20Bridge } from "./Roll20Bridge.js";

/**
 * 官方人物卡原生下拉框缺省字典表 (Neceros 官方 SheetWorker 规范)
 * 当角色卡属性尚未在 DOM 中被用户显式改动时，用作原生兜底，确保 BAB 与关键属性加值不为 0
 */
export const MANUAL_DROPDOWN_DEFAULTS = {
    "HP-ability": "CON-mod",
    "init-ability": "DEX-mod",
    "Fort-ability": "CON-mod",
    "Ref-ability": "DEX-mod",
    "Will-ability": "WIS-mod",
    "melee-ability": "STR-mod",
    "melee2-ability": "0",
    "ranged-ability": "DEX-mod",
    "ranged2-ability": "0",
    "melee_bab": "bab",
    "melee2_bab": "bab",
    "ranged_bab": "bab",
    "ranged2_bab": "bab",
    "cmb_bab": "bab",
    "cmb2_bab": "bab",
    "sanity-ability": "0",
    "concentration-0-ability": "0",
    "concentration-1-ability": "0",
    "concentration-2-ability": "0",
    "AC-ability": "DEX-mod",
    "FF-ability": "0",
    "CMD-ability": "0",
    "CMD-ability1": "STR-mod",
    "CMD-ability2": "DEX-mod",
    "selected-ability-psionic-power": "0",
    "kineticist_ability": "CON-mod"
};

/**
 * RecalcService.js
 * 负责官方人物卡攻防、豁免等衍生属性全量重新计算的单源服务
 * 
 * 核心架构：常驻“在线引用无头重算单例沙箱” (Headless Worker Singleton Sandbox)
 * 1. 零本地代码冗余与零外部上传：战役加载后，直接就地在线引用 Roll20 官方下发的原生脚本 (Campaign.characters[0].characterSheet.workerScripts[0])；
 * 2. 在常驻后台隐藏 iframe 中通过标准 Blob URL 外部库引用 (<script src="blob:...">) 挂载，彻底规避 eval；
 * 3. 建立 Roll20 原生 SheetWorker 7 大宿主桩 (on, getAttrs, setAttrs, getSectionIDs, getTranslationByKey, getTranslationLanguage, generateRowID)；
 * 4. 采用单例动态上下文 (currentContextChar) + 串行任务队列 (Sequential Job Queue)，毫秒级顺序计算各角色；
 * 5. 无论卡片在屏幕上开没开，修改 Buff 后统一向该沙箱派发带 sourceType="player" 的 change:recalc1 事件；
 * 6. 监听 setAttrs 回写 recalc1: 0 判定计算完成，原汁原味运行官方 ju()，属性秒级回写到 character.attribs 内存中；
 * 7. 具备角色维度 300ms 防抖合并 (Coalescing)，避免多 Buff 连续操作导致的并发雪崩。
 */
export class RecalcService {
    static isInitialized = false;
    static workerScriptCode = null;
    static sandboxIframe = null;
    static listeners = {};
    static currentContextChar = null;
    static currentJobResolve = null;

    // 串行执行任务队列与并发锁
    static queue = [];
    static isProcessing = false;

    // 角色维度的防抖任务表 (Map: characterId -> timerId)
    static pendingRequests = new Map();
    static COALESCE_DELAY_MS = 300;

    /**
     * 全局初始化：在线获取官方 Worker 脚本并启动无头沙箱
     */
    static async init() {
        if (this.isInitialized) return;
        this.isInitialized = true;

        console.log("[RecalcService] 正在初始化官方重算在线单例沙箱...");
        try {
            // 从 Campaign 中就地读取 Roll20 官方在线加载好的 worker 脚本
            this.workerScriptCode = this.extractWorkerScriptFromCampaign();
            if (this.workerScriptCode) {
                this.bootSandbox(this.workerScriptCode);
            } else {
                console.log("[RecalcService] 官方 worker 脚本暂未就绪，启动轮询等待在线模板加载...");
                this.pollForWorkerScript();
            }
        } catch (err) {
            console.error("[RecalcService] 初始化沙箱异常:", err);
        }
    }

    /**
     * 从 Campaign.characters 中就地在线提取官方已加载的 worker 源码
     */
    static extractWorkerScriptFromCampaign() {
        if (typeof window === "undefined" || !window.Campaign?.characters?.models) return null;
        for (const char of window.Campaign.characters.models) {
            // 1. 优先直接读取 Roll20 官方在线下载并解析完毕的 workerScripts 数组
            const ws = char.characterSheet?.workerScripts;
            if (Array.isArray(ws) && ws[0] && typeof ws[0] === "string" && ws[0].length > 1000) {
                console.log(`[RecalcService] 成功在线获取官方 Worker 脚本 (从 workerScripts[0]，长度: ${ws[0].length} 字符)`);
                return ws[0];
            }
            // 2. 兜底：若尚未被 Roll20 提取进 workerScripts，则从 layouthtml 原生标签中提取
            const html = char.characterSheet?.layouthtml;
            if (html && html.includes("text/worker")) {
                const match = html.match(/<script[^>]*type=["']text\/worker["'][^>]*>([\s\S]*?)<\/script>/i);
                if (match && match[1]) {
                    console.log(`[RecalcService] 成功在线提取官方 Worker 脚本 (从 layouthtml 模板，长度: ${match[1].length} 字符)`);
                    return match[1];
                }
            }
        }
        return null;
    }

    /**
     * 轮询等待 Roll20 官方模板在线加载完成
     */
    static pollForWorkerScript(retries = 30) {
        let count = 0;
        const intervalId = setInterval(() => {
            count++;
            const code = this.extractWorkerScriptFromCampaign();
            if (code) {
                clearInterval(intervalId);
                this.workerScriptCode = code;
                this.bootSandbox(code);
            } else if (count >= retries) {
                clearInterval(intervalId);
                console.warn("[RecalcService] 等待官方在线模板超时，将在首次开卡时延迟挂载沙箱");
            }
        }, 500);
    }

    /**
     * 启动隐藏执行沙箱 iframe（采用标准 Blob URL 外部库引用方式加载，零 eval）
     */
    static bootSandbox(scriptCode) {
        if (typeof document === "undefined") return;
        if (this.sandboxIframe) {
            try { this.sandboxIframe.remove(); } catch (e) {}
            this.sandboxIframe = null;
        }

        const iframe = document.createElement("iframe");
        iframe.id = "r20-suite-recalc-sandbox";
        iframe.style.cssText = "position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;";
        document.body.appendChild(iframe);
        this.sandboxIframe = iframe;

        // 通过 doc.open()/write()/close() 强制同步建立干净上下文
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
            doc.open();
            doc.write("<!DOCTYPE html><html><head></head><body></body></html>");
            doc.close();
        }

        const iwin = iframe.contentWindow;
        if (!iwin) return;

        // 注入宿主已有的原生 Underscore.js 依赖
        iwin._ = (typeof window !== "undefined" ? window._ : null) || (typeof unsafeWindow !== "undefined" ? unsafeWindow._ : null) || (typeof _ !== "undefined" ? _ : null);

        this.listeners = {};

        // 1. 实现 on(events, cb)
        iwin.on = (events, cb) => {
            (events || "").split(" ").forEach(evt => {
                const clean = evt.trim();
                if (!clean) return;
                if (!this.listeners[clean]) this.listeners[clean] = [];
                this.listeners[clean].push(cb);
            });
        };

        // 2. 实现 getAttrs(names, cb)
        iwin.getAttrs = (names, cb) => {
            const char = this.currentContextChar;
            const res = {};
            if (!char || !char.attribs) {
                if (typeof cb === "function") setTimeout(() => cb(res), 0);
                return;
            }
            const models = char.attribs.models || [];
            const map = new Map();
            for (let i = 0; i < models.length; i++) {
                const a = models[i];
                map.set(a.get("name"), a.get("current"));
            }
            for (let i = 0; i < names.length; i++) {
                const n = names[i];
                // 核心修复点 1：沙箱重算期间查询 recalc1 时，必须返回 "1"，确保官方 ju() 分支判定为需要全量重算
                if (n === "recalc1") {
                    res[n] = "1";
                    continue;
                }
                const val = map.get(n);
                if (val !== undefined && val !== null && val !== "") {
                    res[n] = String(val);
                } else if (MANUAL_DROPDOWN_DEFAULTS[n] !== undefined) {
                    // 核心修复点 2：官方下拉框默认值（如 melee_bab: "bab", melee-ability: "STR-mod"）
                    res[n] = MANUAL_DROPDOWN_DEFAULTS[n];
                } else {
                    res[n] = (val !== undefined && val !== null) ? String(val) : "";
                }
            }
            if (typeof cb === "function") {
                setTimeout(() => cb(res), 0);
            }
        };

        // 3. 实现 setAttrs(values, options, cb)
        iwin.setAttrs = (vals, opts, cb) => {
            if (typeof opts === "function") { cb = opts; opts = {}; }
            const char = this.currentContextChar;
            if (char && char.attribs && vals) {
                const silent = !!(opts && opts.silent);
                const existingMap = new Map();
                for (const a of (char.attribs.models || [])) {
                    existingMap.set(a.get("name"), a);
                }
                for (const [k, v] of Object.entries(vals)) {
                    const cur = (v !== undefined && v !== null) ? String(v) : "";
                    let attr = existingMap.get(k);
                    if (!attr) {
                        const newAttr = char.attribs.create({ name: k, current: cur });
                        if (newAttr) existingMap.set(k, newAttr);
                    } else if (String(attr.get("current")) !== cur) {
                        attr.save({ current: cur }, { silent: silent, byScript: true });
                    }
                }
            }

            if (typeof cb === "function") {
                setTimeout(cb, 0);
            }

            // 监听官方 ju() 结束信号：当写入 recalc1 === 0 时，代表本轮所有属性已全量收敛写回完毕
            if (vals && (vals.recalc1 === 0 || vals.recalc1 === "0" || vals.recalc1 === false)) {
                if (this.currentJobResolve) {
                    const resolve = this.currentJobResolve;
                    this.currentJobResolve = null;
                    setTimeout(resolve, 0);
                }
            }
        };

        // 4. 实现 getSectionIDs(section, cb)
        iwin.getSectionIDs = (section, cb) => {
            const char = this.currentContextChar;
            if (!char || !char.attribs) {
                if (typeof cb === "function") setTimeout(() => cb([]), 0);
                return;
            }
            const cleanSec = section.replace(/^repeating_/, "");
            const prefix = `repeating_${cleanSec}_`;
            const ids = new Set();
            const models = char.attribs.models || [];
            for (let i = 0; i < models.length; i++) {
                const name = models[i].get("name") || "";
                if (name.startsWith(prefix)) {
                    const rest = name.substring(prefix.length);
                    const idx = rest.indexOf("_");
                    if (idx > 0) {
                        ids.add(rest.substring(0, idx));
                    }
                }
            }
            const res = Array.from(ids);
            if (typeof cb === "function") {
                setTimeout(() => cb(res), 0);
            }
        };

        // 5. 实现国际化与行 ID 辅助桩
        iwin.getTranslationByKey = (k) => k || "";
        iwin.getTranslationLanguage = () => "en";
        iwin.generateRowID = () => "-" + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);

        // 6. 标准“在线库引用”：使用 Blob URL 生成同源外部脚本文件，通过 <script src="..."> 加载，严禁使用 eval
        try {
            const blob = new Blob([scriptCode], { type: "text/javascript" });
            const blobUrl = URL.createObjectURL(blob);
            const scriptEl = doc.createElement("script");
            scriptEl.src = blobUrl;
            scriptEl.onload = () => {
                URL.revokeObjectURL(blobUrl);
                console.log(`[RecalcService] 官方重算引擎作为独立库文件加载就绪 (Blob URL)，已注册规则数: ${Object.keys(this.listeners).length}`);
            };
            scriptEl.onerror = (e) => {
                URL.revokeObjectURL(blobUrl);
                console.error("[RecalcService] 挂载官方脚本库异常:", e);
            };
            doc.head.appendChild(scriptEl);
        } catch (scriptErr) {
            console.error("[RecalcService] 创建脚本 Blob URL 异常:", scriptErr);
        }
    }

    /**
     * 请求对指定角色进行攻防加值全量重新计算
     * 具备 300ms 角色维度防抖合并
     * @param {object} character Character Backbone 模型
     * @param {object} options { reason: string }
     */
    static request(character, { reason = "buff_mutation" } = {}) {
        if (!character || !character.id) return;

        // 若沙箱尚未初始化，补救提取与挂载
        if (!this.sandboxIframe && !this.workerScriptCode) {
            this.workerScriptCode = this.extractWorkerScriptFromCampaign();
            if (this.workerScriptCode) this.bootSandbox(this.workerScriptCode);
        }

        const charId = character.id;
        if (this.pendingRequests.has(charId)) {
            clearTimeout(this.pendingRequests.get(charId));
        }

        const timerId = setTimeout(async () => {
            this.pendingRequests.delete(charId);
            await this.enqueue(character, { reason });
        }, this.COALESCE_DELAY_MS);

        this.pendingRequests.set(charId, timerId);
    }

    /**
     * 将重算任务提交至全局单例串行执行队列
     * @param {object} character 
     * @param {object} options 
     * @returns {Promise<void>}
     */
    static enqueue(character, { reason = "enqueue" } = {}) {
        return new Promise((resolve) => {
            // 合并相同角色的排队任务，避免队列积压
            const existingIdx = this.queue.findIndex(j => j.character.id === character.id);
            if (existingIdx >= 0) {
                const oldJob = this.queue[existingIdx];
                oldJob.reason = `${oldJob.reason}+${reason}`;
                oldJob.subResolves.push(resolve);
                return;
            }

            this.queue.push({
                character,
                reason,
                resolve,
                subResolves: []
            });
            this.processNext();
        });
    }

    /**
     * 串行消费任务队列核心调度器
     */
    static async processNext() {
        if (this.isProcessing || this.queue.length === 0) return;
        this.isProcessing = true;

        const job = this.queue.shift();
        const { character, reason, resolve, subResolves } = job;
        const completeJob = () => {
            resolve();
            for (const r of subResolves) {
                try { r(); } catch (e) {}
            }
        };

        try {
            await Roll20Bridge.ensureCharacterAttributes(character);

            // 预先确保缺失的下拉框默认值（如 melee_bab、melee-ability 等）在 character.attribs 中建立
            // 避免未在卡片手动点选过的实体缺少 BAB/属性源导致近战/远程加值为 0
            if (character.attribs && character.attribs.models) {
                const existingNames = new Set(character.attribs.models.map(a => a.get("name")));
                const canCreate = typeof character.attribs.create === "function";
                for (const [defKey, defVal] of Object.entries(MANUAL_DROPDOWN_DEFAULTS)) {
                    if (!existingNames.has(defKey) && canCreate) {
                        character.attribs.create({ name: defKey, current: defVal });
                        existingNames.add(defKey);
                    }
                }
                let recalcAttr = character.attribs.models.find(a => a.get("name") === "recalc1");
                if (!recalcAttr && canCreate) {
                    character.attribs.create({ name: "recalc1", current: "1" });
                } else if (recalcAttr) {
                    if (typeof recalcAttr.set === "function") {
                        recalcAttr.set("current", "1");
                    } else {
                        recalcAttr.current = "1";
                    }
                }
            }

            const recalcListeners = this.listeners["change:recalc1"] || [];
            if (this.sandboxIframe && recalcListeners.length > 0) {
                console.log(`[RecalcService] 正在单例沙箱中为 [${character.get("name")}] 执行官方原生重算 (原因: ${reason})...`);
                const startTime = Date.now();
                this.currentContextChar = character;

                await new Promise((done) => {
                    let finished = false;
                    const timeoutId = setTimeout(() => {
                        if (!finished) {
                            finished = true;
                            console.warn(`[RecalcService] 角色 [${character.get("name")}] 沙箱重算超时(4000ms)，触发自动恢复`);
                            done();
                        }
                    }, 4000);

                    this.currentJobResolve = () => {
                        if (!finished) {
                            finished = true;
                            clearTimeout(timeoutId);
                            done();
                        }
                    };

                    const eventObj = {
                        sourceAttribute: "recalc1",
                        sourceType: "player", // 👈 必须传 player 穿透官方白名单门禁！
                        previousValue: "0",
                        newValue: "1"
                    };

                    for (const fn of recalcListeners) {
                        try {
                            fn(eventObj);
                        } catch (fnErr) {
                            console.error("[RecalcService] 沙箱回调执行异常:", fnErr);
                        }
                    }
                });

                const elapsed = Date.now() - startTime;
                console.log(`[RecalcService] [${character.get("name")}] 官方重算完毕，总耗时: ${elapsed}ms`);
                this.currentContextChar = null;
                completeJob();
            } else {
                // 沙箱未就绪时的幂等属性兜底写入
                console.warn(`[RecalcService] 沙箱未就绪，使用幂等属性写入兜底 [${character.get("name")}] recalc1="1"`);
                let recalcAttr = character.attribs?.models?.find(a => a.get("name") === "recalc1");
                if (!recalcAttr && character.attribs) {
                    character.attribs.create({ name: "recalc1", current: "1" });
                } else if (recalcAttr) {
                    recalcAttr.save({ current: "1" }, { silent: false });
                }
                completeJob();
            }
        } catch (err) {
            console.error(`[RecalcService] 处理 [${character.get("name")}] 重算任务异常:`, err);
            this.currentContextChar = null;
            completeJob();
        } finally {
            this.isProcessing = false;
            this.processNext();
        }
    }

    /**
     * 立即强制执行角色重算 (绕过防抖，直接排队)
     * @param {object} character 
     * @param {object} options
     */
    static async flush(character, { reason = "manual_flush" } = {}) {
        if (!character || !character.id) return;
        const charId = character.id;
        if (this.pendingRequests.has(charId)) {
            clearTimeout(this.pendingRequests.get(charId));
            this.pendingRequests.delete(charId);
        }

        return this.enqueue(character, { reason });
    }

    /**
     * 资源清理与注销 (热重载支持)
     */
    static destroy() {
        for (const timerId of this.pendingRequests.values()) {
            clearTimeout(timerId);
        }
        this.pendingRequests.clear();
        this.queue = [];
        this.isProcessing = false;

        if (this.currentJobResolve) {
            try { this.currentJobResolve(); } catch (e) {}
            this.currentJobResolve = null;
        }

        if (this.sandboxIframe) {
            try { this.sandboxIframe.remove(); } catch (e) {}
            this.sandboxIframe = null;
        }
        this.listeners = {};
        this.currentContextChar = null;
        this.isInitialized = false;
        console.log("[RecalcService] 服务已注销并清理沙箱资源");
    }
}
