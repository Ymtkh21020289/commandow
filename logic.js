// logic.js (v3: ルール修正版)

// --- 1. 定数・設定 ---
const CARD_TYPE = {
    BLANK: 'blank',         // 白紙（攻/防）
    SKILL: 'skill',         // スキル
    JOKER: 'joker',         // 必殺技
    SPELL_BREAK: 'break'    // スペルブレイク
};

const CARD_MODE = {
    ATTACK: 'attack',
    DEFENSE: 'defense'
};

// --- 2. カードクラス ---
class Card {
    constructor(type) {
        this.type = type;
        this.value = 0;
        this.mode = CARD_MODE.ATTACK; // デフォルト
        this.initValue();
    }

    initValue() {
        if (this.type === CARD_TYPE.BLANK || this.type === CARD_TYPE.SKILL) {
            this.value = Math.floor(Math.random() * 13) + 1;
        } else if (this.type === CARD_TYPE.JOKER) {
            this.value = 14;
        } else if (this.type === CARD_TYPE.SPELL_BREAK) {
            this.value = 0; // 数値判定用
        }
    }

    toString() {
        let modeStr = (this.type === CARD_TYPE.BLANK) ? `(${this.mode === CARD_MODE.ATTACK ? '攻' : '防'})` : '';
        let valStr = (this.type === CARD_TYPE.SPELL_BREAK) ? "∞" : this.value;
        return `[${this.type.toUpperCase()}${modeStr}:${valStr}]`;
    }
}

// --- 3. 状態異常クラス ---
class StatusEffect {
    constructor(name, type, value1, value2 = null) {
        this.name = name;
        this.type = type;
        this.val1 = value1;
        this.val2 = value2;
    }
    onTurnEnd(owner) {
        if (this.name === '死毒') {
            const damage = 2;
            console.log(`  ☠️ [毒] ${owner.name}に${damage}ダメージ (残スタック:${this.val1 - 1})`);
            owner.receiveDamage(damage);
            this.val1 -= 1;
        }
    }
    onTakeDamage(owner, damageAmount) {
        if (this.name === '負傷' && this.val2 > 0) {
            console.log(`  🩸 [負傷] 追加ダメージ ${this.val1}! (残回数:${this.val2 - 1})`);
            owner.hp -= this.val1;
            this.val2 -= 1;
        }
    }
    isExpired() {
        if (this.name === '死毒') return this.val1 <= 0;
        if (this.name === '負傷') return this.val2 <= 0;
        return false;
    }
}

// --- 4. キャラクターデータ定義 ---
const CHARACTERS = {
    berserker: {
        name: "バーサーカー",
        maxHp: 20,
        scMax: 0,
        jkpCost: 8,
        passive: (player, eventType, data) => {
            if (eventType === 'attack_hit' && data.card.type === CARD_TYPE.BLANK) {
                console.log(`  🔥 [パッシブ] 闘争本能: JKP+1`);
                player.jkp += 1;
            }
        },
        skillEffect: (myself, opponent, cardValue) => {
            console.log(`  ⚔️ [スキル] 双撃!`);
            opponent.receiveDamage(cardValue);
            opponent.receiveDamage(cardValue);
            opponent.addStatus(new StatusEffect('負傷', 'debuff', 1, 1));
        },
        jokerEffect: (myself, opponent) => {
            console.log(`  👹 [JOKER] 怪力乱神!`);
            opponent.addStatus(new StatusEffect('負傷', 'debuff', 1, 20));
            opponent.receiveDamage(10); // 仮威力
        }
    },
    venom: {
        name: "ヴェノム",
        maxHp: 36,
        scMax: 0,
        jkpCost: 0,
        passive: (player, eventType, data) => {
            if (eventType === 'attack_hit' && data.card.type === CARD_TYPE.BLANK) {
                console.log(`  🧪 [パッシブ] 毒爪: 死毒+2`);
                data.opponent.addStatus(new StatusEffect('死毒', 'debuff', 2));
            }
        },
        skillEffect: (myself, opponent, cardValue) => {
            console.log(`  🌫️ [スキル] ポイズンミスト!`);
            opponent.addStatus(new StatusEffect('死毒', 'debuff', 5));
        },
        jokerEffect: (myself, opponent) => {
            console.log(`  💉 [JOKER] オーバードーズ!`);
            let poison = opponent.statusList.find(s => s.name === '死毒');
            if (poison) {
                let dmg = Math.floor(poison.val1 / 2);
                let heal = Math.floor(dmg / 2);
                console.log(`  毒吸収: ${dmg}ダメ与え、${heal}回復`);
                opponent.receiveDamage(dmg);
                myself.hp += heal;
            }
        }
    }
};

// --- 5. プレイヤークラス ---
class Player {
    constructor(charKey) {
        this.charData = CHARACTERS[charKey];
        this.name = this.charData.name;
        this.hp = this.charData.maxHp;
        this.jkp = 0;
        this.hand = [];
        this.statusList = [];
    }

    drawHand() {
        this.hand = [];
        // 白紙x2 (初期はATTACKモード)
        this.hand.push(new Card(CARD_TYPE.BLANK));
        this.hand.push(new Card(CARD_TYPE.BLANK));
        this.hand.push(new Card(CARD_TYPE.SKILL));
        this.hand.push(new Card(CARD_TYPE.JOKER));
        this.hand.push(new Card(CARD_TYPE.SPELL_BREAK));
    }

    // デバフ追加
    addStatus(newEffect) {
        let existing = this.statusList.find(e => e.name === newEffect.name);
        if (existing) {
            if (existing.name === '死毒') existing.val1 += newEffect.val1;
            else if (existing.name === '負傷') this.statusList.push(newEffect);
        } else {
            this.statusList.push(newEffect);
        }
    }

    receiveDamage(amount) {
        this.statusList.forEach(s => s.onTakeDamage(this, amount));
        this.statusList = this.statusList.filter(s => !s.isExpired());
        this.hp -= amount;
        if (this.hp < 0) this.hp = 0;
        console.log(`  > ${this.name} HP: ${this.hp}`);
    }
}

// --- 6. ゲーム管理クラス ---
class Game {
    constructor(p1Key, p2Key) {
        this.p1 = new Player(p1Key);
        this.p2 = new Player(p2Key);
        this.turn = 1;
    }

    startTurn() {
        console.log(`\n=== ターン ${this.turn} 開始 ===`);
        console.log(`[状態] ${this.p1.name}(HP:${this.p1.hp}, JKP:${this.p1.jkp}) vs ${this.p2.name}(HP:${this.p2.hp}, JKP:${this.p2.jkp})`);
        this.p1.drawHand();
        this.p2.drawHand();
    }

    // カードが出せるかチェック（UI側でこれを呼んでボタンを無効化する）
    isCardPlayable(player, cardIndex) {
        const card = player.hand[cardIndex];
        if (!card) return false;
        
        // JKP不足チェック
        if (card.type === CARD_TYPE.JOKER && player.jkp < player.charData.jkpCost) {
            console.log(`🚫 ${player.name}はJKP不足(${player.jkp}/${player.charData.jkpCost})のためジョーカーを選択できません。`);
            return false;
        }
        return true;
    }

    // モード変更（白紙カードを攻撃⇔防御に切り替え）
    toggleCardMode(player, cardIndex) {
        const card = player.hand[cardIndex];
        if (card && card.type === CARD_TYPE.BLANK) {
            card.mode = (card.mode === CARD_MODE.ATTACK) ? CARD_MODE.DEFENSE : CARD_MODE.ATTACK;
            console.log(`${player.name}のカード${cardIndex}を ${card.mode} に変更しました。`);
        }
    }

    resolveBattle(p1CardIndex, p2CardIndex) {
        // 事前チェック
        if (!this.isCardPlayable(this.p1, p1CardIndex) || !this.isCardPlayable(this.p2, p2CardIndex)) {
            console.log("エラー: 選択できないカードが含まれています。処理を中断します。");
            return;
        }

        const c1 = this.p1.hand[p1CardIndex];
        const c2 = this.p2.hand[p2CardIndex];

        console.log(`\n⚔️ マッチ: ${this.p1.name} ${c1.toString()} vs ${this.p2.name} ${c2.toString()}`);

        let winner = null;
        let isBreakVictory = false;

        // 1. スペルブレイク vs ジョーカー (ブレイク勝利)
        if (c1.type === CARD_TYPE.SPELL_BREAK && c2.type === CARD_TYPE.JOKER) winner = this.p1;
        else if (c2.type === CARD_TYPE.SPELL_BREAK && c1.type === CARD_TYPE.JOKER) winner = this.p2;
        
        // 2. スペルブレイク vs その他 (ブレイク敗北＆ペナルティ)
        else if (c1.type === CARD_TYPE.SPELL_BREAK) {
            winner = this.p2; 
            isBreakVictory = true;
        }
        else if (c2.type === CARD_TYPE.SPELL_BREAK) {
            winner = this.p1;
            isBreakVictory = true;
        }
        
        // 3. 数値勝負
        else {
            if (c1.value > c2.value) {
                winner = this.p1;
            } else if (c2.value > c1.value) {
                winner = this.p2;
            } else {
                // 数値が同じ場合
                // 「防御モード」は同数値の「攻撃/スキル」に勝利する
                const p1Def = (c1.mode === CARD_MODE.DEFENSE);
                const p2Def = (c2.mode === CARD_MODE.DEFENSE);
                
                if (p1Def && !p2Def) winner = this.p1; // P1防御 vs P2攻撃など -> P1勝
                else if (!p1Def && p2Def) winner = this.p2; // P2防御 vs P1攻撃など -> P2勝
                else {
                    // 両方防御、あるいは両方攻撃で同値なら引き分け
                    winner = null;
                }
            }
        }

        // --- 結果適用 ---
        if (winner) {
            const loser = (winner === this.p1) ? this.p2 : this.p1;
            const winCard = (winner === this.p1) ? c1 : c2;
            
            console.log(`🏅 勝者: ${winner.name}`);

            if (isBreakVictory) {
                console.log(`  ⚡ スペルブレイク失敗！ ${loser.name}は被ダメージが増加(1)！`);
                loser.receiveDamage(1); 
            }

            this.applyCardEffect(winner, loser, winCard);
        } else {
            console.log("Draw (引き分け - 何も起こらない)");
        }
    }

    applyCardEffect(winner, loser, card) {
        // パッシブ発火チェック (攻撃モードで勝利時のみ)
        if (card.type === CARD_TYPE.BLANK && card.mode === CARD_MODE.ATTACK) {
             if (winner.charData.passive) {
                 winner.charData.passive(winner, 'attack_hit', { opponent: loser, card: card });
             }
        }

        switch (card.type) {
            case CARD_TYPE.BLANK:
                if (card.mode === CARD_MODE.ATTACK) {
                    console.log(`  👊 通常攻撃！ 威力:${card.value}`);
                    loser.receiveDamage(card.value);
                } else {
                    console.log(`  🛡️ 防御成功！ (効果なし)`);
                    // 何も起こらない
                }
                break;
            
            case CARD_TYPE.SKILL:
                winner.charData.skillEffect(winner, loser, card.value);
                break;

            case CARD_TYPE.JOKER:
                winner.jkp -= winner.charData.jkpCost;
                winner.charData.jokerEffect(winner, loser);
                break;
            
            case CARD_TYPE.SPELL_BREAK:
                console.log(`  ✨ スペルブレイク成功！ (効果なし)`);
                // 将来的にパッシブ等を入れるならここ
                break;
        }
    }

    endTurn() {
        console.log(`\n--- ターン終了処理 ---`);
        this.p1.jkp += 1;
        this.p2.jkp += 1;
        [this.p1, this.p2].forEach(p => {
            p.statusList.forEach(s => s.onTurnEnd(p));
            p.statusList = p.statusList.filter(s => !s.isExpired());
        });
        this.turn++;
    }
}

// --- テスト実行 ---
const game = new Game('berserker', 'venom');

game.startTurn();

// テスト1: バーサーカーの手札を表示して、白紙を防御モードに変えてみる
console.log("変更前:", game.p1.hand[0].toString());
game.toggleCardMode(game.p1, 0); // 0番目のカードを防御に変更
console.log("変更後:", game.p1.hand[0].toString());

// テスト2: JKP不足チェック
// ヴェノム(JKP0でもOK) vs バーサーカー(JKP不足)
// バーサーカーがジョーカー(index 3)を出そうとする
if (game.isCardPlayable(game.p1, 3)) {
    console.log("P1はジョーカーを出せます");
} else {
    console.log("P1はジョーカーを出せません（期待通りの動作）");
}

// 戦闘実行（仮にP1は防御(0)、P2はスキル(2)を出す）
// ※もし数値が同じなら防御側のP1が勝つはず
game.resolveBattle(0, 2);
game.endTurn();
