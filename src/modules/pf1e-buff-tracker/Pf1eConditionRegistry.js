/**
 * Pf1eConditionRegistry.js
 * 严格按照 Pathfinder 1e 核心规则书 (CRB, Appendix 1: Conditions) 整理的完全状态注册表
 * 集中管理状态元数据、角色卡属性映射、战役自定义棋子标记 (Token Markers) 与中文规则悬浮提示
 */

export const PF1E_CONDITIONS = {
    "bleed": {
        id: "bleed",
        nameZh: "流血",
        nameEn: "Bleed",
        isNativeSheet: true,
        attrKey: "condition-Bleed",
        roundsKey: "condition-Bleed_rounds",
        markerName: "Bleeding Out",
        fallbackMarker: "bleeding-eye",
        description: "每轮开始受持续伤害，直至受DC 15医疗检定或治疗法术"
    },
    "blinded": {
        id: "blinded",
        nameZh: "目盲",
        nameEn: "Blinded",
        isNativeSheet: true,
        attrKey: "condition-Blinded",
        roundsKey: "condition-Blinded_rounds",
        markerName: "Blinded",
        fallbackMarker: "bleeding-eye",
        description: "AC -2，失去敏捷加值，察觉检定自动失败，全隐蔽(50%失手)"
    },
    "confused": {
        id: "confused",
        nameZh: "困惑",
        nameEn: "Confused",
        isNativeSheet: false, // CRB 核心状态，卡面无原生复选框
        attrKey: "custom_cond_confused",
        roundsKey: "custom_cond_confused_rounds",
        markerName: "Confused",
        fallbackMarker: "brain-freeze",
        description: "无法自主行动，每轮掷 d100 决定行为(攻击盟友/发呆/正常)"
    },
    "cowering": {
        id: "cowering",
        nameZh: "畏縮",
        nameEn: "Cowering",
        isNativeSheet: true,
        attrKey: "condition-Cowering",
        roundsKey: "condition-Cowering_rounds",
        markerName: "screaming",
        fallbackMarker: "screaming",
        description: "极度恐惧冻结，AC -2，失去敏捷加值，无法采取任何动作"
    },
    "dazed": {
        id: "dazed",
        nameZh: "暈眩",
        nameEn: "Dazed",
        isNativeSheet: true,
        attrKey: "condition-Dazed",
        roundsKey: "condition-Dazed_rounds",
        markerName: "half-haze",
        fallbackMarker: "half-haze",
        description: "无法采取任何动作，AC 不受直接减值"
    },
    "dazzled": {
        id: "dazzled",
        nameZh: "目眩",
        nameEn: "Dazzled",
        isNativeSheet: true,
        attrKey: "condition-Dazzled",
        roundsKey: "condition-Dazzled_rounds",
        markerName: "aura",
        fallbackMarker: "aura",
        description: "强光致盲，攻击检定与视力察觉检定承受 -1 减值"
    },
    "dead": {
        id: "dead",
        nameZh: "死亡",
        nameEn: "Dead",
        isNativeSheet: true,
        attrKey: "condition-Dead",
        roundsKey: "condition-Dead_rounds",
        markerName: "006-Dead",
        fallbackMarker: "dead",
        description: "生命值降至负体质值以下，无法行动与自行恢复"
    },
    "deafened": {
        id: "deafened",
        nameZh: "耳聾",
        nameEn: "Deafened",
        isNativeSheet: true,
        attrKey: "condition-Deafened",
        roundsKey: "condition-Deafened_rounds",
        markerName: "Deafened",
        fallbackMarker: "black-flag",
        description: "先攻检定 -4，听力察觉自动失败，言语成分法术 20% 失败率"
    },
    "disabled": {
        id: "disabled",
        nameZh: "癱瘓",
        nameEn: "Disabled",
        isNativeSheet: true,
        attrKey: "condition-Disabled",
        roundsKey: "condition-Disabled_rounds",
        markerName: "snail",
        fallbackMarker: "snail",
        description: "生命恰为 0，每轮只能做单个移动或标动，做标动受 1 伤害转濒死"
    },
    "drowning": {
        id: "drowning",
        nameZh: "溺水",
        nameEn: "Drowning",
        isNativeSheet: true,
        attrKey: "condition-Drowning",
        roundsKey: "condition-Drowning_rounds",
        markerName: "bubble",
        fallbackMarker: "bubble",
        description: "溺水缺氧，无法呼吸，陷入昏迷与濒死"
    },
    "dying": {
        id: "dying",
        nameZh: "瀕死",
        nameEn: "Dying",
        isNativeSheet: true,
        attrKey: "condition-Dying",
        roundsKey: "condition-Dying_rounds",
        markerName: "half-heart",
        fallbackMarker: "half-heart",
        description: "生命值为负，处于昏迷无助，每轮需体质检定否则流失生命"
    },
    "entangled": {
        id: "entangled",
        nameZh: "糾纏",
        nameEn: "Entangled",
        isNativeSheet: true,
        attrKey: "condition-Entangled",
        roundsKey: "condition-Entangled_rounds",
        markerName: "Entangle",
        fallbackMarker: "fishing-net",
        description: "移动半速无法奔跑，敏捷 -4，攻击检定 -2，施法需集中检定"
    },
    "exhausted": {
        id: "exhausted",
        nameZh: "力竭",
        nameEn: "Exhausted",
        isNativeSheet: true,
        attrKey: "condition-Exhausted",
        roundsKey: "condition-Exhausted_rounds",
        markerName: "Exhausted",
        fallbackMarker: "back-pain",
        description: "移动半速，力量和敏捷受到 -6 减值，休息 1 小时转为疲乏"
    },
    "fascinated": {
        id: "fascinated",
        nameZh: "迷魂",
        nameEn: "Fascinated",
        isNativeSheet: true,
        attrKey: "condition-Fascinated",
        roundsKey: "condition-Fascinated_rounds",
        markerName: "Charmed",
        fallbackMarker: "aura",
        description: "驻足注视目标，察觉等技能受到 -4 减值，受到潜在威胁解除"
    },
    "fatigued": {
        id: "fatigued",
        nameZh: "疲乏",
        nameEn: "Fatigued",
        isNativeSheet: true,
        attrKey: "condition-Fatigued",
        roundsKey: "condition-Fatigued_rounds",
        markerName: "back-pain",
        fallbackMarker: "snail",
        description: "无法奔跑或冲锋，力量和敏捷受到 -2 减值，休息 8 小时解除"
    },
    "flat_footed": {
        id: "flat_footed",
        nameZh: "措手不及",
        nameEn: "Flat-Footed",
        isNativeSheet: true,
        attrKey: "condition-Flat-Footed",
        roundsKey: "condition-Flat-Footed_rounds",
        markerName: "arrowed",
        fallbackMarker: "fist",
        description: "战斗尚未行动，失去 AC 敏捷加值，无法进行借机攻击"
    },
    "frightened": {
        id: "frightened",
        nameZh: "恐慌",
        nameEn: "Frightened",
        isNativeSheet: true, // 对应角色卡 condition-Fear (恐慌任意)
        attrKey: "condition-Fear",
        roundsKey: "condition-Fear_rounds",
        markerName: "Frightened",
        fallbackMarker: "screaming",
        description: "承受 -2 攻击/豁免/技能检定，且必须全力逃离恐惧源"
    },
    "grappled": {
        id: "grappled",
        nameZh: "擒抱",
        nameEn: "Grappled",
        isNativeSheet: true,
        attrKey: "condition-Grappled",
        roundsKey: "condition-Grappled_rounds",
        markerName: "Grappled",
        fallbackMarker: "grab",
        description: "无法移动，敏捷 -4，攻击与战技检定 -2，施法需集中检定"
    },
    "helpless": {
        id: "helpless",
        nameZh: "無助",
        nameEn: "Helpless",
        isNativeSheet: true,
        attrKey: "condition-Helpless",
        roundsKey: "condition-Helpless_rounds",
        markerName: "padlock",
        fallbackMarker: "padlock",
        description: "完全无法防卫，敏捷视同为 0 (-5 AC)，近战受击可被政变"
    },
    "incorporeal": {
        id: "incorporeal",
        nameZh: "虛體",
        nameEn: "Incorporeal",
        isNativeSheet: true,
        attrKey: "condition-Incorporeal",
        roundsKey: "condition-Incorporeal_rounds",
        markerName: "Incorporeal",
        fallbackMarker: "aura",
        description: "无实体，免疫非魔法攻击，魔法武器伤害半额，可穿透实物"
    },
    "invisible": {
        id: "invisible",
        nameZh: "隱形",
        nameEn: "Invisible",
        isNativeSheet: true,
        attrKey: "condition-Invisible",
        roundsKey: "condition-Invisible_rounds",
        markerName: "Invisible",
        fallbackMarker: "ninja-mask",
        description: "视觉不可见，拥有全隐蔽(50%失手)，攻击有视觉目标 +2"
    },
    "nauseated": {
        id: "nauseated",
        nameZh: "反胃",
        nameEn: "Nauseated",
        isNativeSheet: true,
        attrKey: "condition-Nauseated",
        roundsKey: "condition-Nauseated_rounds",
        markerName: "chemical-bolt",
        fallbackMarker: "chemical-bolt",
        description: "极度胃部不适，每轮只能做单个移动动作，不可攻击或施法"
    },
    "paralyzed": {
        id: "paralyzed",
        nameZh: "麻痺",
        nameEn: "Paralyzed",
        isNativeSheet: true,
        attrKey: "condition-Paralyzed",
        roundsKey: "condition-Paralyzed_rounds",
        markerName: "Paralyzed",
        fallbackMarker: "padlock",
        description: "肌肉僵直，力量敏捷视同为 0，完全无助，无法移动或发声"
    },
    "petrified": {
        id: "petrified",
        nameZh: "石化",
        nameEn: "Petrified",
        isNativeSheet: true,
        attrKey: "condition-Petrified",
        roundsKey: "condition-Petrified_rounds",
        markerName: "Petrified",
        fallbackMarker: "white-tower",
        description: "转变为石头形态，完全无助，视同昏迷并停止感知"
    },
    "pinned": {
        id: "pinned",
        nameZh: "壓制",
        nameEn: "Pinned",
        isNativeSheet: true,
        attrKey: "condition-Pinned",
        roundsKey: "condition-Pinned_rounds",
        markerName: "padlock",
        fallbackMarker: "grab",
        description: "擒抱升级状态，完全无法移动，极度缺乏防御，无法说话"
    },
    "prone": {
        id: "prone",
        nameZh: "俯臥",
        nameEn: "Prone",
        isNativeSheet: true,
        attrKey: "condition-Prone",
        roundsKey: "condition-Prone_rounds",
        markerName: "Prone",
        fallbackMarker: "tread",
        description: "倒地，近战攻击 -4，近战受击 AC -4，远程受击 AC +4"
    },
    "sickened": {
        id: "sickened",
        nameZh: "噁心",
        nameEn: "Sickened",
        isNativeSheet: true,
        attrKey: "condition-Sickened",
        roundsKey: "condition-Sickened_rounds",
        markerName: "chemical-bolt",
        fallbackMarker: "chemical-bolt",
        description: "轻度恶心不适，攻击、伤害、豁免、技能检定受到 -2 减值"
    },
    "stable": {
        id: "stable",
        nameZh: "穩定",
        nameEn: "Stable",
        isNativeSheet: true,
        attrKey: "condition-Stable",
        roundsKey: "condition-Stable_rounds",
        markerName: "Stabilized",
        fallbackMarker: "half-heart",
        description: "生命值为负但已停止失血，昏迷但不再自动濒死流失生命"
    },
    "staggered": {
        id: "staggered",
        nameZh: "恍惚",
        nameEn: "Staggered",
        isNativeSheet: true,
        attrKey: "condition-Staggered",
        roundsKey: "condition-Staggered_rounds",
        markerName: "Staggered",
        fallbackMarker: "stopwatch",
        description: "每轮只能执行一个移动动作或标准动作(二选一)"
    },
    "stunned": {
        id: "stunned",
        nameZh: "Stunned", // 规则震慑，角色卡标签为 Stunned
        nameEn: "Stunned",
        isNativeSheet: true,
        attrKey: "condition-Stunned",
        roundsKey: "condition-Stunned_rounds",
        markerName: "Stunned",
        fallbackMarker: "lightning-helix",
        description: "丢弃手中武器，无法采取动作，AC -2 并失去敏捷加值"
    },
    "suffocating": {
        id: "suffocating",
        nameZh: "窒息",
        nameEn: "Suffocating",
        isNativeSheet: true,
        attrKey: "condition-Suffocating",
        roundsKey: "condition-Suffocating_rounds",
        markerName: "bubble",
        fallbackMarker: "bubble",
        description: "严重缺氧，逐轮消耗体质，进入濒死并迅速死亡"
    },
    "unconscious": {
        id: "unconscious",
        nameZh: "昏迷",
        nameEn: "Unconscious",
        isNativeSheet: true,
        attrKey: "condition-Unconscious",
        roundsKey: "condition-Unconscious_rounds",
        markerName: "Unconcious",
        fallbackMarker: "sleepy",
        description: "失去知觉并倒地，完全无助，无法采取任何动作"
    }
};

/**
 * 状态注册管理类
 */
export class Pf1eConditionRegistry {
    /**
     * 根据任意键名、属性名或中文名匹配状态定义
     */
    static find(keyOrName) {
        if (!keyOrName) return null;
        const lower = String(keyOrName).trim().toLowerCase();

        // 1. 直接 ID 匹配
        if (PF1E_CONDITIONS[lower]) return PF1E_CONDITIONS[lower];

        // 2. 遍历匹配 attrKey, nameZh, nameEn, markerName
        for (const def of Object.values(PF1E_CONDITIONS)) {
            if (def.attrKey && def.attrKey.toLowerCase() === lower) return def;
            if (def.nameZh.toLowerCase() === lower) return def;
            if (def.nameEn.toLowerCase() === lower) return def;
            if (def.markerName && def.markerName.toLowerCase() === lower) return def;
        }
        return null;
    }

    /**
     * 动态匹配当前战役中可用的 Marker Tag (优先自定义 Marker，回退默认)
     * @param {string} condId 状态 ID
     * @param {Array} campaignMarkers 当前战役 Campaign.get("token_markers") 数组
     * @returns {string} 可直接写入 statusmarkers 的 Tag
     */
    static resolveMarkerTag(condId, campaignMarkers = null) {
        const def = this.find(condId);
        if (!def) return "";

        let markers = campaignMarkers;
        if (!markers && window.Campaign) {
            try {
                markers = JSON.parse(window.Campaign.get("token_markers") || "[]");
            } catch (e) {
                markers = [];
            }
        }

        // 1. 尝试在当前战役的自定义标记包中寻找精准同名 Tag (如 Confused::6485456)
        if (Array.isArray(markers) && def.markerName) {
            const match = markers.find(m => m.name && m.name.toLowerCase() === def.markerName.toLowerCase());
            if (match && match.tag) {
                return match.tag;
            }
        }

        // 2. 回退到默认内置标记
        return def.fallbackMarker || def.markerName || "";
    }

    /**
     * 规范化 statusmarkers 字符串：绝不添加数字，自动滤除已有数字 (@数字)
     * @param {string} currentMarkers 当前 statusmarkers 字符串
     * @param {string} tagToAdd 拟添加的标记 Tag
     * @param {boolean} add 是否添加 (true 为添加，false 为移除)
     * @returns {string} 干净的 statusmarkers 字符串
     */
    static mutateStatusmarkers(currentMarkers, tagToAdd, add = true) {
        if (!tagToAdd) return currentMarkers || "";

        // 拆分现有标记，并一律剥离 @数字
        const existing = (currentMarkers || "")
            .split(",")
            .map(s => s.trim().replace(/@\d+$/, ""))
            .filter(Boolean);

        const cleanTag = tagToAdd.replace(/@\d+$/, "").trim();

        const tagSet = new Set(existing);
        if (add) {
            tagSet.add(cleanTag);
        } else {
            tagSet.delete(cleanTag);
            // 同时兼容无 tag 后缀的简写名称移除
            const namePart = cleanTag.split("::")[0];
            for (const item of [...tagSet]) {
                if (item === namePart || item.startsWith(`${namePart}::`)) {
                    tagSet.delete(item);
                }
            }
        }

        return Array.from(tagSet).join(",");
    }

    /**
     * 将单个 markerTag 解析为纯中文名称（精简无英文无冒号效果）
     * @param {string} tag 例如 "Blinded::6485443" 或 "skull"
     * @returns {string} 例如 "目盲"
     */
    static getTooltipForMarker(tag) {
        if (!tag) return "";
        const cleanTag = tag.split("::")[0];
        const def = this.find(cleanTag) || this.find(tag);
        if (def) {
            return def.nameZh;
        }

        // 战役常见扩展 Buff/Debuff 标记纯中文映射
        const EXTRA_ZH_MAP = {
            "red": "紅",
            "blue": "藍",
            "green": "綠",
            "brown": "棕",
            "purple": "紫",
            "pink": "粉",
            "yellow": "黃",
            "dead": "死亡",
            "Hex": "惡咒",
            "Poisoned": "中毒",
            "Raging": "狂暴",
            "Blessed": "祝福術",
            "Hasted": "加速術",
            "Slowed": "緩慢",
            "Flying": "飛行",
            "MageArmor": "法師護甲",
            "Shield of Faith": "虔誠之盾",
            "Bulls Strength": "公牛之力",
            "Cats Grace": "貓之優雅",
            "Bears Endurance": "巨熊堅韌",
            "Foxs Cunning": "狐之狡黠",
            "Owls Wisdom": "梟之睿智",
            "Eagles Splendor": "鷹之光彩",
            "Advantage": "優勢",
            "Disadvantage": "劣勢",
            "OnFire": "著火",
            "Possessed": "附身",
            "Symbio": "共生",
            "Blink": "閃現術",
            "Blur": "朦朧術",
            "Mirror Image": "鏡像術",
            "Sanctuary": "聖域術",
            "Truesight": "真知術",
            "Spirit Guardians": "守護之靈",
            "DivineFavor": "神恩"
        };
        return EXTRA_ZH_MAP[cleanTag] || cleanTag;
    }

    /**
     * 将当前 Token 拥有的状态标记解析为纯中文文本列表（供悬浮 Tooltip 提示）
     * @param {string} statusmarkersStr 
     * @returns {string[]} 中文状态名称数组
     */
    static getReadableNamesFromMarkers(statusmarkersStr) {
        if (!statusmarkersStr) return [];
        const tags = statusmarkersStr.split(",").map(s => s.trim().replace(/@\d+$/, "")).filter(Boolean);
        const names = [];

        for (const tag of tags) {
            const tagName = tag.split("::")[0];
            const def = this.find(tagName) || this.find(tag);
            if (def) {
                names.push(`${def.nameZh} (${def.nameEn})`);
            } else {
                names.push(tagName);
            }
        }
        return names;
    }
}
