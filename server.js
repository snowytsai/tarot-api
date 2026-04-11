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
// 本日塔羅 daily
// =========================
app.post("/tarot/daily", async (req, res) => {
  try {
    const { question, category, cardName, isReversed } = req.body;

    const prompt = `
你是一位溫和且有洞察力的塔羅解牌者。
請根據以下資訊，用繁體中文輸出「本日塔羅指引」。

請務必嚴格依照下面格式輸出，不要加任何前言、說明或 markdown：

本日關鍵詞：關鍵詞1｜關鍵詞2｜關鍵詞3
今日短版指引：一句18到30字的提醒
完整解析：90到140字的完整解析

問題：${question}
分類：${category}
牌名：${cardName}
牌位：${isReversed ? "逆位" : "正位"}
`;

    const response = await client.responses.create({
      model: "gpt-5-mini",
      input: prompt,
      max_output_tokens: 900,
    });

    const text = extractText(response);

    console.log("daily text =", text);

    // ⭐ 用字串解析（穩定）
    const keywordsMatch = text.match(/本日關鍵詞：(.+)/);
    const shortMatch = text.match(/今日短版指引：(.+)/);
    const longMatch = text.match(/完整解析：([\s\S]+)/);

    const keywords = keywordsMatch
      ? keywordsMatch[1].split("｜").map(s => s.trim()).filter(Boolean)
      : [];

    const shortSummary = shortMatch ? shortMatch[1].trim() : "";
    const longReading = longMatch ? longMatch[1].trim() : "";

    // ❗ fallback（保護）
    if (!shortSummary || !longReading) {
      return res.json({
        keywords: ["解析失敗"],
        shortSummary: "請重新嘗試一次",
        longReading: text || "暫時無法取得本日解牌內容"
      });
    }

    res.json({
      keywords,
      shortSummary,
      longReading
    });

  } catch (error) {
    console.error("daily tarot error =", error);
    res.status(500).json({
      error: "解析失敗",
      detail: error?.message || "unknown error"
    });
  }
});

// =========================
// 單張塔羅 single
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
`;

    const response = await client.responses.create({
      model: "gpt-5-mini",
      input: prompt,
      max_output_tokens: 700
    });

    console.log("single raw response =", JSON.stringify(response, null, 2));

    const text =
      response.output_text?.trim() ||
      response.output?.flatMap(item => item.content || [])
        ?.map(item => item.text || "")
        ?.join("\n")
        ?.trim() ||
      "";

    res.json({
      reading: text || "暫時無法取得解牌內容"
    });

  } catch (error) {
    console.error("single tarot error =", error);
    res.status(500).json({
      error: "解析失敗",
      detail: error?.message || "unknown error"
    });
  }
});

// =========================
// 三張塔羅 three
// =========================
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
`;

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
      error: "解析失敗",
      detail: error?.message || "unknown error"
    });
  }
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Tarot API running");
});
