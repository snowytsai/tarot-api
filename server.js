import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ⭐ App API Key
const APP_API_KEY = process.env.APP_API_KEY;

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20
});

app.use("/tarot", limiter);

// ⭐ API Key 檢查
function checkApiKey(req, res, next) {
  const key = req.headers["x-api-key"];

  if (!key || key !== APP_API_KEY) {
    return res.status(403).json({
      error: "API key invalid"
    });
  }

  next();
}

app.use("/tarot", checkApiKey);

// ⭐ 統一取文字
function extractText(response) {
  try {
    if (response.output_text) {
      return response.output_text.trim();
    }

    const text = response.output?.[0]?.content?.[0]?.text;
    if (text) {
      return text.trim();
    }

    return "";
  } catch {
    return "";
  }
}

// =========================
// Tarot routes
// =========================

app.post("/tarot/single", async (req, res) => {
  try {
    const { question, category, cardName, isReversed } = req.body;

    const prompt = `
你是一位溫和理性的塔羅解牌者。
請用繁體中文解讀以下牌卡。

問題：${question}
分類：${category}
牌：${cardName}
牌位：${isReversed ? "逆位" : "正位"}

請提供：
1. 此刻狀態
2. 可能發展
3. 建議

控制在200字內。
`.trim();

    const response = await client.responses.create({
      model: "gpt-5-mini",
      input: prompt,
      max_output_tokens: 700
    });

    const text = extractText(response);

    res.json({
      reading: text || "暫時無法取得解牌內容"
    });
  } catch (error) {
    console.error("single tarot error =", error);
    res.status(500).json({
      error: "AI解牌失敗"
    });
  }
});

app.post("/tarot/three", async (req, res) => {
  try {
    const { question, category, cards } = req.body;

    const cardsText = cards.map(
      c => `${c.label}：${c.name}（${c.isReversed ? "逆位" : "正位"}）`
    ).join("\n");

    const prompt = `
請用繁體中文解讀以下三張塔羅牌。

問題：${question}
分類：${category}

${cardsText}

請提供：
1. 整體狀態
2. 發展方向
3. 建議

控制在300字內。
`.trim();

    const response = await client.responses.create({
      model: "gpt-5-mini",
      input: prompt,
      max_output_tokens: 900
    });

    const text = extractText(response);

    res.json({
      reading: text || "暫時無法取得解牌內容"
    });
  } catch (error) {
    console.error("three tarot error =", error);
    res.status(500).json({
      error: "AI解牌失敗"
    });
  }
});

// ⭐ 星象（從 cosmos API 來）
app.post("/tarot/daily-astrology", async (req, res) => {
  try {
    const { astrologyText } = req.body;

    res.json({
      astrology: astrologyText || ""
    });
  } catch (error) {
    console.error("daily astrology error =", error);
    res.status(500).json({
      error: "daily astrology failed"
    });
  }
});

// ⭐ 只做長版：星象 + 塔羅完整融合解析
app.post("/tarot/daily-combined", async (req, res) => {
  try {
    const {
      cardName,
      isReversed,
      astrologyText,
      keywords,
      dailyHint
    } = req.body;

    const orientation = isReversed ? "逆位" : "正位";

    const prompt = `
你是一位溫和、清楚、自然的塔羅解讀者。
請根據以下資料，產出「星象 + 牌卡」融合後的完整建議。

【今日星象】
${astrologyText || "今日星象資料暫時無法取得"}

【塔羅牌】
${cardName}（${orientation}）

【牌卡關鍵字】
${Array.isArray(keywords) ? keywords.join("、") : ""}

【今日提醒】
${dailyHint || ""}

請用繁體中文輸出，內容請自然分成幾段，包含：

1. 今日整體能量
2. 星象與牌卡的交互影響
3. 今日最重要的提醒
4. 實際可行的行動建議

要求：
- 不要條列數字
- 不要過度玄學
- 語氣自然，像真的在對人說話
- 不要重複貼原始星象資料
- 不要只是改寫關鍵字
- 要真的把星象與牌義融合
- 約 220～320 字
`.trim();

    const response = await client.responses.create({
      model: "gpt-5-mini",
      input: prompt,
      max_output_tokens: 900
    });

    const text = extractText(response);

    res.json({
      reading: text || "暫時無法取得完整建議"
    });
  } catch (error) {
    console.error("daily combined error =", error);
    res.status(500).json({
      error: "融合解讀失敗"
    });
  }
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Tarot API running");
});